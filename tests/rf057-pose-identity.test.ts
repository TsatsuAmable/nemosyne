import { describe, it, expect, vi } from 'vitest';
import { NetworkManager } from '../src/network/NetworkManager.ts';
import { BinaryPoseSerializer } from '../src/network/BinaryPoseSerializer.ts';
import { sha256Uint31 } from '../src/security/CryptoHash.ts';

// Force a compressed numeric-ID collision for two distinct string peers so the
// collision adversary can be exercised without searching 2^31 space. All other
// peer IDs keep their real deterministic digest.
vi.mock('../src/security/CryptoHash.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/security/CryptoHash.ts')>();
  return {
    ...actual,
    sha256Uint31: (key: string): number => {
      if (key === 'victim-a' || key === 'victim-b') return 424242;
      return actual.sha256Uint31(key);
    },
  };
});

class FakeChannel extends EventTarget {
  readyState: RTCDataChannelState = 'open';
  binaryType: BinaryType = 'arraybuffer';
  sent: unknown[] = [];

  send(data: unknown): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 'closed';
    this.dispatchEvent(new Event('close'));
  }
}

function poseBuffer(
  peerId: number,
  sequence: number,
  position: [number, number, number],
  rotation: [number, number, number, number]
): ArrayBuffer {
  return BinaryPoseSerializer.serialize({ peerId, sequence, position, rotation });
}

function deliver(channel: FakeChannel, data: unknown): void {
  channel.dispatchEvent(new MessageEvent('message', { data }));
}

function wireParticipant(manager: NetworkManager, peerId: string): FakeChannel {
  manager.peerRoles.set(peerId, 'participant');
  const channel = new FakeChannel();
  manager._wireChannel(peerId, channel as unknown as RTCDataChannel, 'participant');
  return channel;
}

describe('RF-057: channel-bound pose sequence identity and framing', () => {
  it('peer A forging peer B numeric identity with max sequence cannot poison peer B (or peer A)', () => {
    const manager = new NetworkManager({ peerId: 'receiver-local', role: 'participant', iceServers: [] });
    const channelA = wireParticipant(manager, 'attacker-peer');
    const channelB = wireParticipant(manager, 'victim-peer');

    const onPose = vi.fn();
    manager.addEventListener('remoteCameraPose', onPose);

    const numericB = sha256Uint31('victim-peer');
    // Attacker A sends B's numeric identity with the maximum sequence over A's own channel.
    deliver(channelA, poseBuffer(numericB, 0xffffffff, [10, 0, 0], [0, 0, 0, 1]));

    // Mismatch frame is dropped outright — no event, no state mutation.
    expect(onPose).not.toHaveBeenCalled();

    // B's legitimate next pose is still accepted.
    deliver(channelB, poseBuffer(numericB, 1, [1, 1, 1], [0, 0, 0, 1]));
    expect(onPose).toHaveBeenCalledTimes(1);
    expect(onPose.mock.calls[0][0].detail.peerId).toBe('victim-peer');

    // A's forged frame did not even poison A's own sequence state.
    deliver(channelA, poseBuffer(sha256Uint31('attacker-peer'), 1, [2, 0, 0], [0, 0, 0, 1]));
    expect(onPose).toHaveBeenCalledTimes(2);
    expect(onPose.mock.calls[1][0].detail.peerId).toBe('attacker-peer');
  });

  it('rejects a duplicate same-peer frame', () => {
    const manager = new NetworkManager({ peerId: 'local-peer', role: 'participant', iceServers: [] });
    const channel = wireParticipant(manager, 'peer-b');

    const onPose = vi.fn();
    manager.addEventListener('remoteCameraPose', onPose);

    const numericB = sha256Uint31('peer-b');
    deliver(channel, poseBuffer(numericB, 5, [1, 0, 0], [0, 0, 0, 1]));
    deliver(channel, poseBuffer(numericB, 5, [2, 0, 0], [0, 0, 0, 1])); // duplicate

    expect(onPose).toHaveBeenCalledTimes(1);
    expect(onPose.mock.calls[0][0].detail.position[0]).toBeCloseTo(1, 5);
  });

  it('rejects an out-of-order same-peer frame', () => {
    const manager = new NetworkManager({ peerId: 'local-peer', role: 'participant', iceServers: [] });
    const channel = wireParticipant(manager, 'peer-b');

    const onPose = vi.fn();
    manager.addEventListener('remoteCameraPose', onPose);

    const numericB = sha256Uint31('peer-b');
    deliver(channel, poseBuffer(numericB, 10, [9, 9, 9], [0, 0, 0, 1]));
    deliver(channel, poseBuffer(numericB, 9, [1, 1, 1], [0, 0, 0, 1])); // older

    expect(onPose).toHaveBeenCalledTimes(1);
    expect(onPose.mock.calls[0][0].detail.position[0]).toBeCloseTo(9, 5);
  });

  it('reconnect resets sequence state for a fresh channel generation and stale close is inert', () => {
    const manager = new NetworkManager({ peerId: 'local-peer', role: 'participant', iceServers: [] });
    manager.peerRoles.set('peer-b', 'participant');
    const stale = new FakeChannel();
    manager._wireChannel('peer-b', stale as unknown as RTCDataChannel, 'participant');

    const onPose = vi.fn();
    manager.addEventListener('remoteCameraPose', onPose);

    const numericB = sha256Uint31('peer-b');
    deliver(stale, poseBuffer(numericB, 5, [1, 0, 0], [0, 0, 0, 1]));
    expect(onPose).toHaveBeenCalledTimes(1);

    // A forged max sequence poisons only the old channel generation's state.
    deliver(stale, poseBuffer(numericB, 0xffffffff, [2, 0, 0], [0, 0, 0, 1]));
    expect(onPose).toHaveBeenCalledTimes(2);

    // New channel generation for the same string peer begins a fresh sequence space.
    const fresh = new FakeChannel();
    manager._wireChannel('peer-b', fresh as unknown as RTCDataChannel, 'participant');

    deliver(fresh, poseBuffer(numericB, 1, [3, 0, 0], [0, 0, 0, 1]));
    expect(onPose).toHaveBeenCalledTimes(3);
    expect(onPose.mock.calls[2][0].detail.position[0]).toBeCloseTo(3, 5);

    // The stale channel closing must not delete the replacement or its state.
    stale.close();
    expect(manager.channels.get('peer-b')).toBe(fresh);
    deliver(fresh, poseBuffer(numericB, 2, [4, 0, 0], [0, 0, 0, 1]));
    expect(onPose).toHaveBeenCalledTimes(4);

    // A forged high sequence arriving on the superseded channel AFTER the
    // replacement is wired is inert: the message handler guards on the live channel.
    deliver(stale, poseBuffer(numericB, 0xfffffffe, [9, 0, 0], [0, 0, 0, 1]));
    expect(onPose).toHaveBeenCalledTimes(4);
  });

  it('reconnect where the old channel is torn down before replacement wiring also resets sequence state', () => {
    const manager = new NetworkManager({ peerId: 'local-peer', role: 'participant', iceServers: [] });
    manager.peerRoles.set('peer-b', 'participant');
    const stale = new FakeChannel();
    manager._wireChannel('peer-b', stale as unknown as RTCDataChannel, 'participant');

    const onPose = vi.fn();
    manager.addEventListener('remoteCameraPose', onPose);

    const numericB = sha256Uint31('peer-b');
    deliver(stale, poseBuffer(numericB, 0xffffffff, [1, 0, 0], [0, 0, 0, 1]));
    expect(onPose).toHaveBeenCalledTimes(1);

    // Real reconnect order: the superseded connection is closed first.
    manager._closePeer('peer-b', { close: () => {} } as unknown as RTCPeerConnection);
    expect(manager.channels.has('peer-b')).toBe(false);

    const fresh = new FakeChannel();
    manager._wireChannel('peer-b', fresh as unknown as RTCDataChannel, 'participant');

    deliver(fresh, poseBuffer(numericB, 1, [3, 0, 0], [0, 0, 0, 1]));
    expect(onPose).toHaveBeenCalledTimes(2);
    expect(onPose.mock.calls[1][0].detail.position[0]).toBeCloseTo(3, 5);
  });

  it('requires exactly 40-byte frames: 39-byte and 41-byte frames are rejected', () => {
    const manager = new NetworkManager({ peerId: 'local-peer', role: 'participant', iceServers: [] });
    const channel = wireParticipant(manager, 'peer-b');

    const onPose = vi.fn();
    manager.addEventListener('remoteCameraPose', onPose);

    const numericB = sha256Uint31('peer-b');
    const good = poseBuffer(numericB, 1, [1, 0, 0], [0, 0, 0, 1]);

    deliver(channel, good.slice(0, 39));
    expect(onPose).not.toHaveBeenCalled();

    const padded = new ArrayBuffer(41);
    new Uint8Array(padded).set(new Uint8Array(good), 0);
    deliver(channel, padded);
    expect(onPose).not.toHaveBeenCalled();

    deliver(channel, good);
    expect(onPose).toHaveBeenCalledTimes(1);
  });

  it('fails closed on NaN/Infinity and out-of-bound pose/quaternion components', () => {
    const manager = new NetworkManager({ peerId: 'local-peer', role: 'participant', iceServers: [] });
    const channel = wireParticipant(manager, 'peer-b');

    const onPose = vi.fn();
    manager.addEventListener('remoteCameraPose', onPose);

    const numericB = sha256Uint31('peer-b');
    const base = () => poseBuffer(numericB, 1, [1, 0, 0], [0, 0, 0, 1]);

    const nanPos = base();
    new DataView(nanPos).setFloat32(8, NaN, true);
    deliver(channel, nanPos);
    expect(onPose).not.toHaveBeenCalled();

    const infRot = base();
    new DataView(infRot).setFloat32(32, Infinity, true);
    deliver(channel, infRot);
    expect(onPose).not.toHaveBeenCalled();

    const farPos = base();
    new DataView(farPos).setFloat32(8, 2e6, true);
    deliver(channel, farPos);
    expect(onPose).not.toHaveBeenCalled();

    const bigQuat = base();
    new DataView(bigQuat).setFloat32(20, 1.5, true);
    deliver(channel, bigQuat);
    expect(onPose).not.toHaveBeenCalled();

    const degenerateQuat = poseBuffer(numericB, 1, [1, 0, 0], [0, 0, 0, 0]);
    deliver(channel, degenerateQuat);
    expect(onPose).not.toHaveBeenCalled();

    deliver(channel, base());
    expect(onPose).toHaveBeenCalledTimes(1);
  });

  it('numeric-ID collision cannot merge sequence state across distinct string peers', () => {
    // 'victim-a' and 'victim-b' share the mocked numeric digest 424242.
    const manager = new NetworkManager({ peerId: 'local-peer', role: 'participant', iceServers: [] });
    const channelA = wireParticipant(manager, 'victim-a');
    const channelB = wireParticipant(manager, 'victim-b');

    const onPose = vi.fn();
    manager.addEventListener('remoteCameraPose', onPose);

    const collidingNumeric = sha256Uint31('victim-a');
    expect(sha256Uint31('victim-b')).toBe(collidingNumeric);

    // A advances its own counter to the maximum.
    deliver(channelA, poseBuffer(collidingNumeric, 0xffffffff, [1, 0, 0], [0, 0, 0, 1]));
    expect(onPose).toHaveBeenCalledTimes(1);
    expect(onPose.mock.calls[0][0].detail.peerId).toBe('victim-a');

    // B's counter is independent: a low sequence is accepted for B.
    deliver(channelB, poseBuffer(collidingNumeric, 1, [2, 0, 0], [0, 0, 0, 1]));
    expect(onPose).toHaveBeenCalledTimes(2);
    expect(onPose.mock.calls[1][0].detail.peerId).toBe('victim-b');

    // Both peers continue advancing independently.
    deliver(channelB, poseBuffer(collidingNumeric, 2, [3, 0, 0], [0, 0, 0, 1]));
    expect(onPose).toHaveBeenCalledTimes(3);
    deliver(channelA, poseBuffer(collidingNumeric, 100, [4, 0, 0], [0, 0, 0, 1]));
    expect(onPose).toHaveBeenCalledTimes(3); // A's counter is at 0xffffffff
  });
});
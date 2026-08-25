import { describe, expect, it, vi } from 'vitest';
import { NetworkManager } from '../src/network/NetworkManager.ts';

class FakeDataChannel extends EventTarget {
  readyState: RTCDataChannelState = 'connecting';
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

function asRtcDataChannel(channel: FakeDataChannel): RTCDataChannel {
  return channel as unknown as RTCDataChannel;
}

function dispatchJson(channel: FakeDataChannel, payload: Record<string, unknown>): void {
  channel.dispatchEvent(
    new MessageEvent('message', {
      data: JSON.stringify(payload),
    })
  );
}

describe('NetworkManager signalling authority across RTC recovery', () => {
  it('rejects raw observer mutations from the signalling-authoritative role', () => {
    const manager = new NetworkManager({ peerId: 'participant-a', role: 'participant', iceServers: [] });
    const observerId = 'observer-b';
    const channel = new FakeDataChannel();
    const onDelta = vi.fn();
    const onOperation = vi.fn();

    manager.peerRoles.set(observerId, 'observer');
    manager._wireChannel(observerId, asRtcDataChannel(channel), 'observer');
    channel.readyState = 'open';
    channel.dispatchEvent(new Event('open'));

    // Even if a presentation-side peer object were accidentally or maliciously
    // relabelled, mutation authority remains the role admitted by signalling.
    manager.room.updatePeerRole(observerId, 'participant');
    manager.addEventListener('stateDelta', onDelta);
    manager.addEventListener('remoteDatasetOperation', onOperation);

    dispatchJson(channel, {
      type: 'delta',
      peerId: observerId,
      topic: 'layout',
      data: { layout: 'forbidden' },
    });
    dispatchJson(channel, {
      type: 'datasetOperation',
      peerId: observerId,
      op: { op: 'sort', column: 'x' },
    });

    expect(manager.peerRoles.get(observerId)).toBe('observer');
    expect(onDelta).not.toHaveBeenCalled();
    expect(onOperation).not.toHaveBeenCalled();
  });

  it('keeps observer authority when a stale channel closes after replacement', () => {
    const manager = new NetworkManager({ peerId: 'participant-a', role: 'participant', iceServers: [] });
    const observerId = 'observer-b';
    const stale = new FakeDataChannel();
    const replacement = new FakeDataChannel();
    const onOperation = vi.fn();

    manager.peerRoles.set(observerId, 'observer');
    manager._wireChannel(observerId, asRtcDataChannel(stale), 'observer');
    manager._wireChannel(observerId, asRtcDataChannel(replacement), 'observer');

    stale.close();

    expect(manager.channels.get(observerId)).toBe(asRtcDataChannel(replacement));
    expect(manager.peerRoles.get(observerId)).toBe('observer');

    replacement.readyState = 'open';
    replacement.dispatchEvent(new Event('open'));
    manager.addEventListener('remoteDatasetOperation', onOperation);
    dispatchJson(replacement, {
      type: 'datasetOperation',
      peerId: observerId,
      op: { op: 'filter', column: 'x' },
    });

    expect(onOperation).not.toHaveBeenCalled();
  });

  it('assigns exactly one offer owner for participant-observer and equal-role pairs', () => {
    const participant = new NetworkManager({
      peerId: 'participant-a',
      role: 'participant',
      iceServers: [],
    });
    const observer = new NetworkManager({ peerId: 'observer-b', role: 'observer', iceServers: [] });

    expect(participant._shouldInitiateConnection(observer.peerId, observer.role)).toBe(true);
    expect(observer._shouldInitiateConnection(participant.peerId, participant.role)).toBe(false);

    const peerA = new NetworkManager({ peerId: 'peer-a', role: 'participant', iceServers: [] });
    const peerB = new NetworkManager({ peerId: 'peer-b', role: 'participant', iceServers: [] });
    expect(peerA._shouldInitiateConnection(peerB.peerId, peerB.role)).toBe(true);
    expect(peerB._shouldInitiateConnection(peerA.peerId, peerA.role)).toBe(false);
  });
});

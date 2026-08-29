// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { BinaryPoseSerializer } from '../src/network/BinaryPoseSerializer.ts';
import { CollaborativeStateSync } from '../src/network/CollaborativeStateSync.ts';
import { sha256Uint31 } from '../src/security/CryptoHash.ts';

describe('Sprint 19.1: Zero-Copy Network Sync — BinaryPoseSerializer', () => {
  it('serializes and deserializes peerId, sequence, position, and rotation with full roundtrip fidelity', () => {
    const pose = {
      peerId: 42,
      sequence: 7,
      position: [1.5, -2.25, 3.0] as [number, number, number],
      rotation: [0.1, 0.2, 0.3, 0.9] as [number, number, number, number],
    };

    const buffer = BinaryPoseSerializer.serialize(pose);
    expect(buffer.byteLength).toBe(40);

    const result = BinaryPoseSerializer.deserialize(buffer);
    expect(result).not.toBeNull();
    expect(result!.peerId).toBe(42);
    expect(result!.sequence).toBe(7);
    expect(result!.position[0]).toBeCloseTo(1.5, 4);
    expect(result!.position[1]).toBeCloseTo(-2.25, 4);
    expect(result!.position[2]).toBeCloseTo(3.0, 4);
    expect(result!.rotation[0]).toBeCloseTo(0.1, 4);
    expect(result!.rotation[1]).toBeCloseTo(0.2, 4);
    expect(result!.rotation[2]).toBeCloseTo(0.3, 4);
    expect(result!.rotation[3]).toBeCloseTo(0.9, 4);
  });

  it('deserialize returns null for buffers shorter than 40 bytes', () => {
    expect(BinaryPoseSerializer.deserialize(new ArrayBuffer(32))).toBeNull();
    expect(BinaryPoseSerializer.deserialize(new ArrayBuffer(0))).toBeNull();
    expect(BinaryPoseSerializer.deserialize(new ArrayBuffer(39))).toBeNull();
  });

  it('deserialize rejects buffers longer than the 40-byte wire contract', () => {
    const buffer = BinaryPoseSerializer.serialize({
      peerId: 42,
      sequence: 7,
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
    });
    const padded = new ArrayBuffer(41);
    new Uint8Array(padded).set(new Uint8Array(buffer), 0);
    expect(padded.byteLength).toBe(41);
    expect(BinaryPoseSerializer.deserialize(padded)).toBeNull();
  });

  it('deserialize rejects NaN/Infinity and out-of-bound pose components', () => {
    const base = () =>
      BinaryPoseSerializer.serialize({
        peerId: 1,
        sequence: 1,
        position: [1, 0, 0],
        rotation: [0, 0, 0, 1],
      });

    const nanPos = base();
    new DataView(nanPos).setFloat32(8, NaN, true);
    expect(BinaryPoseSerializer.deserialize(nanPos)).toBeNull();

    const infPos = base();
    new DataView(infPos).setFloat32(16, Infinity, true);
    expect(BinaryPoseSerializer.deserialize(infPos)).toBeNull();

    const farPos = base();
    new DataView(farPos).setFloat32(8, 2e6, true);
    expect(BinaryPoseSerializer.deserialize(farPos)).toBeNull();

    const bigQuat = base();
    new DataView(bigQuat).setFloat32(20, 2, true);
    expect(BinaryPoseSerializer.deserialize(bigQuat)).toBeNull();

    const degenerateQuat = BinaryPoseSerializer.serialize({
      peerId: 1,
      sequence: 1,
      position: [1, 0, 0],
      rotation: [0, 0, 0, 0],
    });
    expect(BinaryPoseSerializer.deserialize(degenerateQuat)).toBeNull();
  });

  it('acceptsSequence advances only monotonically for a caller-owned key', () => {
    const state = new Map<string, number>();

    expect(BinaryPoseSerializer.acceptsSequence(state, 'peer-1', 1)).toBe(true);
    expect(BinaryPoseSerializer.acceptsSequence(state, 'peer-1', 5)).toBe(true);
    expect(BinaryPoseSerializer.acceptsSequence(state, 'peer-1', 100)).toBe(true);
  });

  it('acceptsSequence rejects duplicate sequence numbers for the same key', () => {
    const state = new Map<string, number>();
    BinaryPoseSerializer.acceptsSequence(state, 'peer-1', 5); // sets counter to 5
    expect(BinaryPoseSerializer.acceptsSequence(state, 'peer-1', 5)).toBe(false); // duplicate
  });

  it('acceptsSequence drops out-of-order (older) sequence numbers for the same key', () => {
    const state = new Map<string, number>();
    BinaryPoseSerializer.acceptsSequence(state, 'peer-1', 10); // sets counter to 10
    expect(BinaryPoseSerializer.acceptsSequence(state, 'peer-1', 9)).toBe(false); // older
    expect(BinaryPoseSerializer.acceptsSequence(state, 'peer-1', 3)).toBe(false); // much older
    expect(BinaryPoseSerializer.acceptsSequence(state, 'peer-1', 11)).toBe(true); // next valid
  });

  it('acceptsSequence tracks sequence counters independently per key', () => {
    const state = new Map<string, number>();
    BinaryPoseSerializer.acceptsSequence(state, 'peer-1', 50);
    BinaryPoseSerializer.acceptsSequence(state, 'peer-2', 10);

    // Peer 1 should reject seq 50 (dup) but peer 2 should reject seq 10 (dup)
    expect(BinaryPoseSerializer.acceptsSequence(state, 'peer-1', 50)).toBe(false);
    expect(BinaryPoseSerializer.acceptsSequence(state, 'peer-2', 10)).toBe(false);

    // But each peer can advance independently
    expect(BinaryPoseSerializer.acceptsSequence(state, 'peer-1', 51)).toBe(true);
    expect(BinaryPoseSerializer.acceptsSequence(state, 'peer-2', 11)).toBe(true);
  });

  it('sequence state is caller-owned: a fresh state map starts at zero', () => {
    const first = new Map<string, number>();
    BinaryPoseSerializer.acceptsSequence(first, 'peer-1', 99);

    const second = new Map<string, number>();
    // A fresh (e.g. recreated-after-reconnect) state map accepts seq 1 again.
    expect(BinaryPoseSerializer.acceptsSequence(second, 'peer-1', 1)).toBe(true);
  });

  it('does not leak sequence state across independent state maps', () => {
    const mapA = new Map<string, number>();
    const mapB = new Map<string, number>();
    BinaryPoseSerializer.acceptsSequence(mapA, 'peer-x', 99);
    expect(BinaryPoseSerializer.acceptsSequence(mapB, 'peer-x', 1)).toBe(true);
  });
});

describe('Sprint 19.1: Zero-Copy Network Sync — CollaborativeStateSync binary path', () => {
  it('sendBinaryPose uses a numeric peer ID derived from localPeerId string', () => {
    const sync = new CollaborativeStateSync('peer-alice');
    const numericId = sync.getNumericPeerId();

    // Should be a non-negative integer
    expect(numericId).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(numericId)).toBe(true);

    // Same string should produce same numeric ID (deterministic)
    const sync2 = new CollaborativeStateSync('peer-alice');
    expect(sync2.getNumericPeerId()).toBe(numericId);

    // Different strings should (almost certainly) produce different IDs
    const sync3 = new CollaborativeStateSync('peer-bob');
    expect(sync3.getNumericPeerId()).not.toBe(numericId);
  });

  it('binary messages from different peerIds are stored under distinct peer map keys', () => {
    const sync = new CollaborativeStateSync('peer-local');

    // Simulate receiving binary pose from peer 101
    const buf1 = BinaryPoseSerializer.serialize({
      peerId: 101,
      sequence: 1,
      position: [1, 0, 0],
      rotation: [0, 0, 0, 1],
    });

    // Simulate receiving binary pose from peer 202
    const buf2 = BinaryPoseSerializer.serialize({
      peerId: 202,
      sequence: 1,
      position: [2, 0, 0],
      rotation: [0, 0, 0, 1],
    });

    let onMessageHandler: ((event: MessageEvent) => void) | null = null;
    const mockChannel = {
      readyState: 'open',
      binaryType: 'arraybuffer',
      send: () => {},
      set onmessage(fn: ((event: MessageEvent) => void) | null) {
        onMessageHandler = fn;
      },
    } as unknown as RTCDataChannel;

    sync.setDataChannel(mockChannel);

    // Deliver both binary messages
    onMessageHandler!({ data: buf1 } as MessageEvent);
    onMessageHandler!({ data: buf2 } as MessageEvent);

    const peers = sync.getConnectedPeers();
    expect(peers.length).toBe(2);

    const peerIds = peers.map((p) => p.peerId);
    expect(peerIds).toContain('101');
    expect(peerIds).toContain('202');
  });

  it('drops out-of-order binary pose packets and does not overwrite newer peer state', () => {
    const sync = new CollaborativeStateSync('peer-local');

    const bufNew = BinaryPoseSerializer.serialize({
      peerId: 55,
      sequence: 10,
      position: [9, 9, 9],
      rotation: [0, 0, 0, 1],
    });
    const bufOld = BinaryPoseSerializer.serialize({
      peerId: 55,
      sequence: 5, // older — should be dropped
      position: [1, 1, 1],
      rotation: [0, 0, 0, 1],
    });

    let onMessageHandler: ((event: MessageEvent) => void) | null = null;
    const mockChannel = {
      readyState: 'open',
      binaryType: 'arraybuffer',
      send: () => {},
      set onmessage(fn: ((event: MessageEvent) => void) | null) {
        onMessageHandler = fn;
      },
    } as unknown as RTCDataChannel;

    sync.setDataChannel(mockChannel);

    // Deliver newer packet first, then the stale one
    onMessageHandler!({ data: bufNew } as MessageEvent);
    onMessageHandler!({ data: bufOld } as MessageEvent);

    const peers = sync.getConnectedPeers();
    expect(peers.length).toBe(1);
    // Position should reflect the newer packet [9,9,9], not the dropped stale [1,1,1]
    expect(peers[0].cameraPose!.position[0]).toBeCloseTo(9, 3);
  });

  it('rejects a binary pose whose numeric ID mismatches the bound channel peer', () => {
    const sync = new CollaborativeStateSync('peer-local');

    let onMessageHandler: ((event: MessageEvent) => void) | null = null;
    const mockChannel = {
      readyState: 'open',
      binaryType: 'arraybuffer',
      send: () => {},
      set onmessage(fn: ((event: MessageEvent) => void) | null) {
        onMessageHandler = fn;
      },
    } as unknown as RTCDataChannel;

    // Trusted channel binding: sequence state is keyed by the string identity
    // and payload numeric mismatches fail closed (RF-057).
    sync.setDataChannel(mockChannel, 'trusted-remote');

    const wrong = BinaryPoseSerializer.serialize({
      peerId: 999,
      sequence: 1,
      position: [1, 0, 0],
      rotation: [0, 0, 0, 1],
    });
    onMessageHandler!({ data: wrong } as MessageEvent);
    expect(sync.getConnectedPeers()).toHaveLength(0);

    const right = BinaryPoseSerializer.serialize({
      peerId: sha256Uint31('trusted-remote'),
      sequence: 1,
      position: [2, 0, 0],
      rotation: [0, 0, 0, 1],
    });
    onMessageHandler!({ data: right } as MessageEvent);
    expect(sync.getConnectedPeers()).toHaveLength(1);
  });
});
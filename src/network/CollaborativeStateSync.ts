/**
 * WebRTC Multi-User Collaborative State Synchronizer.
 *
 * Replicates active dataset selection, filter operations, gaze target vectors,
 * and spatial camera poses across peer data channels.
 *
 * Sprint 19.1: Binary pose packets now carry a numeric peerId header.
 * Out-of-order / duplicate packets are dropped via BinaryPoseSerializer.validateSequence().
 */

import { BinaryPoseSerializer } from './BinaryPoseSerializer.ts';

export interface PeerState {
  peerId: string;
  datasetName?: string;
  cameraPose?: { position: [number, number, number]; rotation: [number, number, number, number] };
  activeFilter?: string;
  lastUpdatedMs: number;
}

/**
 * Simple djb2 hash of a string, clamped to a non-negative 31-bit integer.
 * Used to derive a stable numeric peer ID from an arbitrary string peer ID.
 */
function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  // Mask to 31 bits to guarantee non-negative value (safe for uint32 wire format)
  return Math.abs(hash) % 0x7fffffff;
}

export class CollaborativeStateSync {
  localPeerId: string;
  private _peers: Map<string, PeerState> = new Map();
  private _dataChannel: RTCDataChannel | null = null;
  private _poseSequence = 0;
  private _numericPeerId: number;

  constructor(localPeerId = `peer-${Math.random().toString(36).slice(2, 8)}`) {
    this.localPeerId = localPeerId;
    this._numericPeerId = djb2Hash(localPeerId);
  }

  setDataChannel(channel: RTCDataChannel): void {
    this._dataChannel = channel;
    this._dataChannel.binaryType = 'arraybuffer';

    this._dataChannel.onmessage = (event) => {
      try {
        if (event.data instanceof ArrayBuffer) {
          const pose = BinaryPoseSerializer.deserialize(event.data);
          if (pose) {
            // Drop out-of-order or duplicate packets via monotonic sequence check
            if (!BinaryPoseSerializer.validateSequence(pose.peerId, pose.sequence)) {
              return;
            }
            this.applyPeerState({
              peerId: pose.peerId.toString(),
              cameraPose: { position: pose.position, rotation: pose.rotation },
              lastUpdatedMs: Date.now(),
            });
          }
          return;
        }

        const message = JSON.parse(event.data) as PeerState;
        if (message.peerId && message.peerId !== this.localPeerId) {
          this.applyPeerState(message);
        }
      } catch (err) {
        console.warn('[CollaborativeStateSync] Failed to parse peer message:', err);
      }
    };
  }

  sendBinaryPose(position: [number, number, number], rotation: [number, number, number, number]): void {
    if (!this._dataChannel || this._dataChannel.readyState !== 'open') return;
    const buffer = BinaryPoseSerializer.serialize({
      peerId: this._numericPeerId,
      sequence: ++this._poseSequence,
      position,
      rotation,
    });
    this._dataChannel.send(buffer);
  }

  broadcastLocalState(state: Omit<PeerState, 'peerId' | 'lastUpdatedMs'>): void {
    const payload: PeerState = {
      ...state,
      peerId: this.localPeerId,
      lastUpdatedMs: Date.now(),
    };

    if (this._dataChannel && this._dataChannel.readyState === 'open') {
      this._dataChannel.send(JSON.stringify(payload));
    }
  }

  applyPeerState(peerState: PeerState): void {
    this._peers.set(peerState.peerId, { ...peerState });
  }

  getConnectedPeers(): PeerState[] {
    return Array.from(this._peers.values());
  }

  /** Expose numeric peer ID for testing. */
  getNumericPeerId(): number {
    return this._numericPeerId;
  }
}

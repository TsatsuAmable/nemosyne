/**
 * WebRTC Multi-User Collaborative State Synchronizer.
 *
 * Replicates active dataset selection, filter operations, gaze target vectors,
 * and spatial camera poses across peer data channels.
 *
 * Sprint 19.1: Binary pose packets now carry a numeric peerId header.
 * Out-of-order / duplicate packets are dropped via BinaryPoseSerializer.validateSequence().
 */

import { sha256Uint31 } from '../security/CryptoHash.ts';
import { BinaryPoseSerializer } from './BinaryPoseSerializer.ts';

export interface PeerState {
  peerId: string;
  datasetName?: string;
  cameraPose?: { position: [number, number, number]; rotation: [number, number, number, number] };
  activeFilter?: string;
  lastUpdatedMs: number;
}

export class CollaborativeStateSync {
  localPeerId: string;
  private _peers: Map<string, PeerState> = new Map();
  private _dataChannel: RTCDataChannel | null = null;
  private _poseSequence = 0;
  private _numericPeerId: number;

  constructor(localPeerId = `peer-${Math.random().toString(36).slice(2, 8)}`) {
    this.localPeerId = localPeerId;
    // BinaryPoseSerializer carries uint32 peer IDs. SHA-256-derived truncation
    // provides stable collision resistance without pretending to authenticate
    // the caller-chosen peerId; authentication remains a signalling/ticket concern.
    this._numericPeerId = sha256Uint31(localPeerId);
  }

  setDataChannel(channel: RTCDataChannel): void {
    this._dataChannel = channel;
    this._dataChannel.binaryType = 'arraybuffer';

    this._dataChannel.onmessage = (event) => {
      try {
        if (event.data instanceof ArrayBuffer) {
          const pose = BinaryPoseSerializer.deserialize(event.data);
          if (pose) {
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

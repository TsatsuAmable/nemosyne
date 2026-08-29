/**
 * WebRTC Multi-User Collaborative State Synchronizer.
 *
 * Replicates active dataset selection, filter operations, gaze target vectors,
 * and spatial camera poses across peer data channels.
 *
 * Binary pose replay/staleness state is owned per-instance (this synchronizer
 * maps to one peer data channel) and never by a shared global map. When the
 * channel's trusted string peer identity is supplied via `setDataChannel`,
 * sequence state is keyed by that identity and mismatched payload numeric IDs
 * are rejected. The payload numeric ID is never an authoritative identity.
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
  /** Per-instance sequence state keyed by string peer identity (RF-057). */
  private _sequenceState: Map<string, number> = new Map();
  /** Trusted string identity of the channel-bound remote peer, when known. */
  private _remotePeerId: string | undefined;

  constructor(localPeerId = `peer-${crypto.randomUUID()}`) {
    this.localPeerId = localPeerId;
    // BinaryPoseSerializer carries uint32 peer IDs. SHA-256-derived truncation
    // provides stable collision resistance without pretending to authenticate
    // the caller-chosen peerId; authentication remains a signalling/ticket concern.
    this._numericPeerId = sha256Uint31(localPeerId);
  }

  setDataChannel(channel: RTCDataChannel, remotePeerId?: string): void {
    this._dataChannel = channel;
    this._remotePeerId = remotePeerId;
    this._sequenceState.clear();
    this._dataChannel.binaryType = 'arraybuffer';

    this._dataChannel.onmessage = (event) => {
      try {
        if (event.data instanceof ArrayBuffer) {
          const pose = BinaryPoseSerializer.deserialize(event.data);
          if (!pose) return;
          // The channel-bound string identity is the ONLY sequence key.
          // If _remotePeerId is absent, fail closed — never fall back to the
          // payload numeric ID (C2-forbidden untrusted-field keying).
          if (this._remotePeerId === undefined) {
            return;
          }
          if (pose.peerId !== sha256Uint31(this._remotePeerId)) {
            return;
          }
          if (!BinaryPoseSerializer.acceptsSequence(this._sequenceState, this._remotePeerId, pose.sequence)) {
            return;
          }
          this.applyPeerState({
            peerId: pose.peerId.toString(),
            cameraPose: { position: pose.position, rotation: pose.rotation },
            lastUpdatedMs: Date.now(),
          });
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

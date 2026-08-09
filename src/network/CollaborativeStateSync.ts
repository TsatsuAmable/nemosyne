/**
 * WebRTC Multi-User Collaborative State Synchronizer.
 *
 * Replicates active dataset selection, filter operations, gaze target vectors,
 * and spatial camera poses across peer data channels.
 */

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

  constructor(localPeerId = `peer-${Math.random().toString(36).slice(2, 8)}`) {
    this.localPeerId = localPeerId;
  }

  setDataChannel(channel: RTCDataChannel): void {
    this._dataChannel = channel;
    this._dataChannel.binaryType = 'arraybuffer';

    this._dataChannel.onmessage = (event) => {
      try {
        if (event.data instanceof ArrayBuffer) {
          const pose = BinaryPoseSerializer.deserialize(event.data);
          if (pose) {
            this.applyPeerState({
              peerId: 'remote-binary-peer',
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
}

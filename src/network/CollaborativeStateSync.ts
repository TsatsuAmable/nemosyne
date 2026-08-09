/**
 * WebRTC Multi-User Collaborative State Synchronizer.
 *
 * Replicates active dataset selection, filter operations, gaze target vectors,
 * and spatial camera poses across peer data channels.
 */

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

  constructor(localPeerId = `peer-${Math.random().toString(36).slice(2, 8)}`) {
    this.localPeerId = localPeerId;
  }

  setDataChannel(channel: RTCDataChannel): void {
    this._dataChannel = channel;
    this._dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as PeerState;
        if (message.peerId && message.peerId !== this.localPeerId) {
          this.applyPeerState(message);
        }
      } catch (err) {
        console.warn('[CollaborativeStateSync] Failed to parse peer message:', err);
      }
    };
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

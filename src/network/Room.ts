/**
 * Lightweight room model for multi-user Nemosyne sessions.
 *
 * A room is identified by a string roomId. It tracks local peer state and a
 * map of remote peers. State changes are serializable and can be broadcast
 * over a WebRTC data channel.
 */

export interface RemotePeer {
  peerId: string;
  name: string;
  joinedAt: number;
  state: Record<string, unknown>;
  lastSeenAt: number;
}

export interface RemotePeerSnapshot {
  peerId: string;
  name: string;
  state: Record<string, unknown>;
}

export interface RoomJSON {
  roomId: string;
  localPeerId: string;
  localName: string;
  peers: RemotePeerSnapshot[];
  createdAt: number;
}

export class Room {
  roomId: string;
  localPeerId: string;
  localName: string;
  peers: Map<string, RemotePeer>;
  createdAt: number;
  localState: Record<string, unknown> = {};

  constructor(roomId: string, localPeerId: string, localName: string = 'Analyst') {
    this.roomId = roomId;
    this.localPeerId = localPeerId;
    this.localName = localName;
    this.peers = new Map<string, RemotePeer>();
    this.createdAt = Date.now();
  }

  addPeer(peerId: string, name: string = 'Analyst'): RemotePeer | null {
    if (peerId === this.localPeerId) return null;
    const peer: RemotePeer = {
      peerId,
      name,
      joinedAt: Date.now(),
      state: {},
      lastSeenAt: Date.now(),
    };
    this.peers.set(peerId, peer);
    return peer;
  }

  removePeer(peerId: string): boolean {
    return this.peers.delete(peerId);
  }

  updatePeerState(peerId: string, state: Record<string, unknown>): boolean {
    const peer = this.peers.get(peerId);
    if (!peer) return false;
    peer.state = { ...peer.state, ...state };
    peer.lastSeenAt = Date.now();
    return true;
  }

  setLocalState(state: Record<string, unknown>): void {
    this.localState = { ...this.localState, ...state };
  }

  getPeerIds(): string[] {
    return [...this.peers.keys()];
  }

  getRemoteSnapshot(): RemotePeerSnapshot[] {
    return [...this.peers.entries()].map(([peerId, peer]) => ({
      peerId,
      name: peer.name,
      state: peer.state,
    }));
  }

  toJSON(): RoomJSON {
    return {
      roomId: this.roomId,
      localPeerId: this.localPeerId,
      localName: this.localName,
      peers: this.getRemoteSnapshot(),
      createdAt: this.createdAt,
    };
  }
}

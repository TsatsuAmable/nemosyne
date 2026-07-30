/**
 * Lightweight room model for multi-user Nemosyne sessions.
 *
 * A room is identified by a string roomId. It tracks local peer state and a
 * map of remote peers. State changes are serializable and can be broadcast
 * over a WebRTC data channel.
 */

export class Room {
  constructor(roomId, localPeerId, localName = 'Analyst') {
    this.roomId = roomId;
    this.localPeerId = localPeerId;
    this.localName = localName;
    this.peers = new Map(); // peerId -> { peerId, name, joinedAt, state }
    this.createdAt = Date.now();
  }

  addPeer(peerId, name = 'Analyst') {
    if (peerId === this.localPeerId) return null;
    const peer = {
      peerId,
      name,
      joinedAt: Date.now(),
      state: {},
      lastSeenAt: Date.now(),
    };
    this.peers.set(peerId, peer);
    return peer;
  }

  removePeer(peerId) {
    return this.peers.delete(peerId);
  }

  updatePeerState(peerId, state) {
    const peer = this.peers.get(peerId);
    if (!peer) return false;
    peer.state = { ...peer.state, ...state };
    peer.lastSeenAt = Date.now();
    return true;
  }

  setLocalState(state) {
    this.localState = { ...this.localState, ...state };
  }

  getPeerIds() {
    return [...this.peers.keys()];
  }

  getRemoteSnapshot() {
    return [...this.peers.entries()].map(([peerId, peer]) => ({
      peerId,
      name: peer.name,
      state: peer.state,
    }));
  }

  toJSON() {
    return {
      roomId: this.roomId,
      localPeerId: this.localPeerId,
      localName: this.localName,
      peers: this.getRemoteSnapshot(),
      createdAt: this.createdAt,
    };
  }
}

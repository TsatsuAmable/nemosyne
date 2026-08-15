/**
 * Lightweight room model for multi-user Nemosyne sessions.
 *
 * A room is identified by a string roomId. It tracks local peer state and a
 * map of remote peers. State changes are serializable and can be broadcast
 * over a WebRTC data channel.
 */

export type NetworkRole = 'participant' | 'observer';

export interface RemotePeer {
  peerId: string;
  name: string;
  role: NetworkRole;
  joinedAt: number;
  state: Record<string, unknown>;
  lastSeenAt: number;
}

/**
 * Keys stripped from incoming peer state as defense-in-depth against
 * per-object prototype pollution. A malicious peer can send
 * `{"type":"state","__proto__":{...}}` over the data channel; this
 * message does NOT funnel through Dataset, so we filter it here at the
 * remote-triggerable merge site.
 */
const DANGEROUS_STATE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Rebuild a state object from its own enumerable keys, dropping any
 * `__proto__`, `constructor`, or `prototype` entries. Returns a fresh
 * plain object. Non-object/null input collapses to `{}`.
 */
function sanitizeState(state: Record<string, unknown>): Record<string, unknown> {
  if (!state || typeof state !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(state)) {
    if (DANGEROUS_STATE_KEYS.has(key)) continue;
    out[key] = state[key];
  }
  return out;
}

export interface RemotePeerSnapshot {
  peerId: string;
  name: string;
  role: NetworkRole;
  state: Record<string, unknown>;
}

export interface RoomJSON {
  roomId: string;
  localPeerId: string;
  localName: string;
  localRole: NetworkRole;
  peers: RemotePeerSnapshot[];
  createdAt: number;
}

export class Room {
  roomId: string;
  localPeerId: string;
  localName: string;
  localRole: NetworkRole;
  peers: Map<string, RemotePeer>;
  createdAt: number;
  localState: Record<string, unknown> = {};

  constructor(
    roomId: string,
    localPeerId: string,
    localName: string = 'Analyst',
    localRole: NetworkRole = 'participant'
  ) {
    this.roomId = roomId;
    this.localPeerId = localPeerId;
    this.localName = localName;
    this.localRole = localRole;
    this.peers = new Map<string, RemotePeer>();
    this.createdAt = Date.now();
  }

  addPeer(peerId: string, name: string = 'Analyst', role: NetworkRole = 'participant'): RemotePeer | null {
    if (peerId === this.localPeerId) return null;
    const peer: RemotePeer = {
      peerId,
      name,
      role,
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
    const incoming = sanitizeState(state);
    peer.state = { ...peer.state, ...incoming };
    peer.lastSeenAt = Date.now();
    return true;
  }

  updatePeerRole(peerId: string, role: NetworkRole): boolean {
    const peer = this.peers.get(peerId);
    if (!peer) return false;
    peer.role = role;
    return true;
  }

  canMutateSharedState(role: NetworkRole = this.localRole): boolean {
    return role === 'participant';
  }

  setLocalState(state: Record<string, unknown>): void {
    const incoming = sanitizeState(state);
    this.localState = { ...this.localState, ...incoming };
  }

  getPeerIds(): string[] {
    return [...this.peers.keys()];
  }

  getRemoteSnapshot(): RemotePeerSnapshot[] {
    return [...this.peers.entries()].map(([peerId, peer]) => ({
      peerId,
      name: peer.name,
      role: peer.role,
      state: peer.state,
    }));
  }

  toJSON(): RoomJSON {
    return {
      roomId: this.roomId,
      localPeerId: this.localPeerId,
      localName: this.localName,
      localRole: this.localRole,
      peers: this.getRemoteSnapshot(),
      createdAt: this.createdAt,
    };
  }
}

import { SignallingChannel } from './SignallingChannel.js';
import { Room } from './Room.js';

/**
 * Manages WebRTC peer connections and a shared room for Nemosyne collaboration.
 *
 * - Connects to a signalling server to discover peers in a room.
 * - Creates one RTCDataChannel per peer over RTCPeerConnection.
 * - Broadcasts local state and receives remote peer state deltas.
 * - Emits events so the World can react to peer joins/leaves/state updates.
 */
const DEFAULT_MAX_STATE_BYTES = 128 * 1024; // 128 KiB

export class NetworkManager extends EventTarget {
  constructor({
    signallingUrl,
    roomId,
    peerId,
    peerName = 'Analyst',
    iceServers = null,
    maxStateBytes = DEFAULT_MAX_STATE_BYTES,
  } = {}) {
    super();
    this.signallingUrl = signallingUrl ?? this._defaultSignallingUrl();
    this.roomId = roomId ?? 'default';
    this.peerId = peerId ?? this._generatePeerId();
    this.peerName = peerName;
    this.iceServers = iceServers ?? [{ urls: 'stun:stun.l.google.com:19302' }];
    this.maxStateBytes = maxStateBytes;

    this.room = new Room(this.roomId, this.peerId, this.peerName);
    this.signalling = null;
    this.connections = new Map(); // peerId -> RTCPeerConnection
    this.channels = new Map(); // peerId -> RTCDataChannel
    this._connected = false;
    this._localState = {};
  }

  get isConnected() {
    return this._connected;
  }

  async connect(roomId = null) {
    if (roomId) this.roomId = roomId;
    this.signalling = new SignallingChannel(this.signallingUrl, this.roomId, this.peerId);
    this.signalling.addEventListener('open', () => {
      this._connected = true;
      this.dispatchEvent(new CustomEvent('connected', { detail: { roomId: this.roomId } }));
    });
    this.signalling.addEventListener('signal', (event) => this._onSignal(event.detail));
    this.signalling.addEventListener('close', () => this._onDisconnected());
    this.signalling.addEventListener('error', () => this._onDisconnected());
    await this.signalling.connect();
  }

  disconnect() {
    this._connected = false;
    for (const [peerId, conn] of this.connections) {
      this._closePeer(peerId, conn);
    }
    this.connections.clear();
    this.channels.clear();
    this.signalling?.disconnect();
    this.signalling = null;
    this.dispatchEvent(new Event('disconnected'));
  }

  setLocalState(state) {
    const next = { ...this._localState, ...state };
    const payload = JSON.stringify({ type: 'state', peerId: this.peerId, state: next });
    if (new Blob([payload]).size > this.maxStateBytes) {
      console.warn('[NetworkManager] state payload exceeds maximum size; update dropped');
      return;
    }
    this._localState = next;
    for (const [peerId, channel] of this.channels) {
      if (channel.readyState === 'open') {
        try {
          channel.send(payload);
        } catch (err) {
          console.warn(`[NetworkManager] send to ${peerId} failed:`, err);
        }
      }
    }
  }

  broadcast(message) {
    this.setLocalState(message);
  }

  _onSignal({ from, data } = {}) {
    if (!from || !data || typeof data !== 'object') return;
    if (data.type === 'offer') this._handleOffer(from, data);
    else if (data.type === 'answer') this._handleAnswer(from, data);
    else if (data.type === 'ice') this._handleIce(from, data);
    else if (data.type === 'join') {
      this._initiateConnection(from);
    }
  }

  async _initiateConnection(peerId) {
    if (peerId === this.peerId || this.connections.has(peerId)) return;
    const conn = this._createConnection(peerId);
    this.connections.set(peerId, conn);

    const channel = conn.createDataChannel('nemosyne', { ordered: true });
    this._wireChannel(peerId, channel);

    const offer = await conn.createOffer();
    await conn.setLocalDescription(offer);
    this.signalling.sendSignal(peerId, { type: 'offer', sdp: offer.sdp });
  }

  async _handleOffer(peerId, { sdp }) {
    if (peerId === this.peerId) return;
    const conn = this._createConnection(peerId);
    this.connections.set(peerId, conn);

    conn.addEventListener('datachannel', (event) => {
      this._wireChannel(peerId, event.channel);
    });

    await conn.setRemoteDescription({ type: 'offer', sdp });
    const answer = await conn.createAnswer();
    await conn.setLocalDescription(answer);
    this.signalling.sendSignal(peerId, { type: 'answer', sdp: answer.sdp });
  }

  async _handleAnswer(peerId, { sdp }) {
    const conn = this.connections.get(peerId);
    if (!conn) return;
    await conn.setRemoteDescription({ type: 'answer', sdp });
  }

  async _handleIce(peerId, { candidate }) {
    const conn = this.connections.get(peerId);
    if (!conn) return;
    try {
      await conn.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[NetworkManager] failed to add ICE candidate:', err);
    }
  }

  _createConnection(peerId) {
    const conn = new RTCPeerConnection({ iceServers: this.iceServers });

    conn.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        this.signalling?.sendSignal(peerId, {
          type: 'ice',
          candidate: event.candidate.toJSON(),
        });
      }
    });

    conn.addEventListener('connectionstatechange', () => {
      if (conn.connectionState === 'disconnected' || conn.connectionState === 'failed') {
        this._closePeer(peerId, conn);
        this.connections.delete(peerId);
        this.channels.delete(peerId);
        this.room.removePeer(peerId);
        this.dispatchEvent(new CustomEvent('peerLeft', { detail: { peerId } }));
      }
    });

    return conn;
  }

  _wireChannel(peerId, channel) {
    this.channels.set(peerId, channel);

    channel.addEventListener('open', () => {
      const peer = this.room.addPeer(peerId);
      if (peer) {
        this.dispatchEvent(new CustomEvent('peerJoined', { detail: peer }));
      }
      // Broadcast current state to the new peer.
      try {
        channel.send(
          JSON.stringify({ type: 'state', peerId: this.peerId, state: this._localState })
        );
      } catch (_) {
        // Peer may have disconnected before state arrived; ignore send failures.
      }
    });

    channel.addEventListener('message', (event) => {
      if (new Blob([event.data]).size > this.maxStateBytes) return;
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!payload || typeof payload !== 'object') return;
      if (payload.type === 'state' && payload.peerId) {
        this.room.updatePeerState(payload.peerId, payload.state ?? {});
        this.dispatchEvent(
          new CustomEvent('peerState', {
            detail: { peerId: payload.peerId, state: payload.state },
          })
        );
      }
    });

    channel.addEventListener('close', () => {
      this.channels.delete(peerId);
      this.room.removePeer(peerId);
      this.dispatchEvent(new CustomEvent('peerLeft', { detail: { peerId } }));
    });
  }

  _closePeer(peerId, conn) {
    try {
      conn.close();
    } catch (_) {
      // Connection may already be closed; ignore.
    }
    this.channels.delete(peerId);
    this.room.removePeer(peerId);
  }

  _onDisconnected() {
    if (this._connected) {
      this._connected = false;
      this.dispatchEvent(new Event('disconnected'));
    }
  }

  _defaultSignallingUrl() {
    if (typeof location === 'undefined') return 'wss://localhost:5173/__signal';
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}/__signal`;
  }

  _generatePeerId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

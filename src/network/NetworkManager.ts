import { SignallingChannel } from './SignallingChannel.ts';
import { Room } from './Room.ts';

/**
 * Manages WebRTC peer connections and a shared room for Nemosyne collaboration.
 *
 * - Connects to a signalling server to discover peers in a room.
 * - Creates one RTCDataChannel per peer over RTCPeerConnection.
 * - Broadcasts local state and receives remote peer state deltas.
 * - Emits events so the World can react to peer joins/leaves/state updates.
 */
const DEFAULT_MAX_STATE_BYTES = 128 * 1024; // 128 KiB

export interface NetworkManagerOptions {
  signallingUrl?: string;
  roomId?: string;
  peerId?: string;
  peerName?: string;
  iceServers?: RTCIceServer[] | null;
  maxStateBytes?: number;
}

export class NetworkManager extends EventTarget {
  signallingUrl: string;
  roomId: string;
  peerId: string;
  peerName: string;
  iceServers: RTCIceServer[];
  maxStateBytes: number;

  room: Room;
  signalling: SignallingChannel | null = null;
  connections: Map<string, RTCPeerConnection> = new Map();
  channels: Map<string, RTCDataChannel> = new Map();
  _connected: boolean = false;
  _localState: Record<string, unknown> = {};

  constructor({
    signallingUrl,
    roomId,
    peerId,
    peerName = 'Analyst',
    iceServers = null,
    maxStateBytes = DEFAULT_MAX_STATE_BYTES,
  }: NetworkManagerOptions = {}) {
    super();
    this.signallingUrl = signallingUrl ?? this._defaultSignallingUrl();
    this.roomId = roomId ?? 'default';
    this.peerId = peerId ?? this._generatePeerId();
    this.peerName = peerName;
    this.iceServers = iceServers ?? [{ urls: 'stun:stun.l.google.com:19302' }];
    this.maxStateBytes = maxStateBytes;

    this.room = new Room(this.roomId, this.peerId, this.peerName);
  }

  get isConnected(): boolean {
    return this._connected;
  }

  async connect(roomId: string | null = null): Promise<void> {
    if (roomId) this.roomId = roomId;
    this.signalling = new SignallingChannel(this.signallingUrl, this.roomId, this.peerId);
    this.signalling.addEventListener('open', () => {
      this._connected = true;
      this.dispatchEvent(new CustomEvent('connected', { detail: { roomId: this.roomId } }));
    });
    this.signalling.addEventListener('signal', (event: Event) => {
      const customEvt = event as CustomEvent;
      this._onSignal(customEvt.detail);
    });
    this.signalling.addEventListener('close', () => this._onDisconnected());
    this.signalling.addEventListener('error', () => this._onDisconnected());
    await this.signalling.connect();
  }

  disconnect(): void {
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

  setLocalState(state: Record<string, unknown>): void {
    const next = { ...this._localState, ...state };
    const payload = JSON.stringify({ type: 'state', peerId: this.peerId, state: next });
    if (new Blob([payload]).size > this.maxStateBytes) {
      console.warn('[NetworkManager] state payload exceeds maximum size; update dropped');
      return;
    }
    this._localState = next;
    this._sendToAllOpenChannels(payload);
  }

  broadcast(message: Record<string, unknown>): void {
    this.setLocalState(message);
  }

  broadcastUserTelemetry(telemetry: Record<string, unknown>): void {
    this.broadcast({ type: 'userTelemetry', telemetry, peerId: this.peerId });
  }

  /**
   * Broadcasts a targeted state delta to all peers for a given topic.
   */
  broadcastStateDelta(topic: string, data: Record<string, unknown>, timestamp: number = Date.now()): void {
    const deltaPayload = JSON.stringify({
      type: 'delta',
      peerId: this.peerId,
      topic,
      data,
      timestamp,
    });
    this._sendToAllOpenChannels(deltaPayload);
  }

  /**
   * Synchronizes a dataset operation (filter, transform, sort, aggregate) across WebRTC peers.
   */
  broadcastDatasetOperation(op: Record<string, unknown>, timestamp: number = Date.now()): void {
    const payload = JSON.stringify({
      type: 'datasetOperation',
      peerId: this.peerId,
      op,
      timestamp,
    });
    this._sendToAllOpenChannels(payload);
  }

  /**
   * Synchronizes selected item IDs across WebRTC peers.
   */
  broadcastSelection(selectedIds: string[]): void {
    const payload = JSON.stringify({
      type: 'selectionSync',
      peerId: this.peerId,
      selectedIds,
      timestamp: Date.now(),
    });
    this._sendToAllOpenChannels(payload);
  }

  /**
   * Throttled 60Hz/20Hz camera pose synchronization for peer VR presence.
   */
  _lastPoseSendTime = 0;
  broadcastCameraPose(position: number[], rotation: number[], throttleMs: number = 50): void {
    const now = Date.now();
    if (now - this._lastPoseSendTime < throttleMs) return;
    this._lastPoseSendTime = now;

    const payload = JSON.stringify({
      type: 'cameraPose',
      peerId: this.peerId,
      position,
      rotation,
      timestamp: now,
    });
    this._sendToAllOpenChannels(payload);
  }

  private _sendToAllOpenChannels(payload: string): void {
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

  _onSignal({ from, data }: { from?: string; data?: any } = {}): void {
    if (!from || !data || typeof data !== 'object') return;
    if (data.type === 'offer') this._handleOffer(from, data);
    else if (data.type === 'answer') this._handleAnswer(from, data);
    else if (data.type === 'ice') this._handleIce(from, data);
    else if (data.type === 'join') {
      this._initiateConnection(from);
    }
  }

  async _initiateConnection(peerId: string): Promise<void> {
    if (peerId === this.peerId || this.connections.has(peerId)) return;
    const conn = this._createConnection(peerId);
    this.connections.set(peerId, conn);

    const channel = conn.createDataChannel('nemosyne', { ordered: true });
    this._wireChannel(peerId, channel);

    const offer = await conn.createOffer();
    await conn.setLocalDescription(offer);
    this.signalling?.sendSignal(peerId, { type: 'offer', sdp: offer.sdp });
  }

  async _handleOffer(peerId: string, { sdp }: { sdp: string }): Promise<void> {
    if (peerId === this.peerId) return;
    const conn = this._createConnection(peerId);
    this.connections.set(peerId, conn);

    conn.addEventListener('datachannel', (event: Event) => {
      const channelEvt = event as RTCDataChannelEvent;
      this._wireChannel(peerId, channelEvt.channel);
    });

    await conn.setRemoteDescription({ type: 'offer', sdp });
    const answer = await conn.createAnswer();
    await conn.setLocalDescription(answer);
    this.signalling?.sendSignal(peerId, { type: 'answer', sdp: answer.sdp });
  }

  async _handleAnswer(peerId: string, { sdp }: { sdp: string }): Promise<void> {
    const conn = this.connections.get(peerId);
    if (!conn) return;
    await conn.setRemoteDescription({ type: 'answer', sdp });
  }

  async _handleIce(peerId: string, { candidate }: { candidate: RTCIceCandidateInit }): Promise<void> {
    const conn = this.connections.get(peerId);
    if (!conn) return;
    try {
      await conn.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[NetworkManager] failed to add ICE candidate:', err);
    }
  }

  _createConnection(peerId: string): RTCPeerConnection {
    const conn = new RTCPeerConnection({ iceServers: this.iceServers });

    conn.addEventListener('icecandidate', (event: RTCPeerConnectionIceEvent) => {
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

  _wireChannel(peerId: string, channel: RTCDataChannel): void {
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

    channel.addEventListener('message', (event: MessageEvent) => {
      if (new Blob([event.data]).size > this.maxStateBytes) return;
      let payload: any;
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
      } else if (payload.type === 'delta' && payload.peerId) {
        this.dispatchEvent(
          new CustomEvent('stateDelta', {
            detail: {
              peerId: payload.peerId,
              topic: payload.topic,
              data: payload.data,
              timestamp: payload.timestamp,
            },
          })
        );
      } else if (payload.type === 'datasetOperation' && payload.peerId) {
        this.dispatchEvent(
          new CustomEvent('remoteDatasetOperation', {
            detail: {
              peerId: payload.peerId,
              op: payload.op,
              timestamp: payload.timestamp,
            },
          })
        );
      } else if (payload.type === 'selectionSync' && payload.peerId) {
        this.dispatchEvent(
          new CustomEvent('remoteSelection', {
            detail: {
              peerId: payload.peerId,
              selectedIds: payload.selectedIds ?? [],
              timestamp: payload.timestamp,
            },
          })
        );
      } else if (payload.type === 'cameraPose' && payload.peerId) {
        this.dispatchEvent(
          new CustomEvent('remoteCameraPose', {
            detail: {
              peerId: payload.peerId,
              position: payload.position,
              rotation: payload.rotation,
              timestamp: payload.timestamp,
            },
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

  _closePeer(peerId: string, conn: RTCPeerConnection): void {
    try {
      conn.close();
    } catch (_) {
      // Connection may already be closed; ignore.
    }
    this.channels.delete(peerId);
    this.room.removePeer(peerId);
  }

  _onDisconnected(): void {
    if (this._connected) {
      this._connected = false;
      this.dispatchEvent(new Event('disconnected'));
    }
  }

  _defaultSignallingUrl(): string {
    if (typeof location === 'undefined') return 'wss://localhost:5173/__signal';
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}/__signal`;
  }

  _generatePeerId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

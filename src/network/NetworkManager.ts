import { SignallingChannel } from './SignallingChannel.ts';
import { Room, type NetworkRole } from './Room.ts';
import { BinaryPoseSerializer } from './BinaryPoseSerializer.ts';
import { sha256Uint31 } from '../security/CryptoHash.ts';

/**
 * Manages WebRTC peer connections and a shared room for Nemosyne collaboration.
 *
 * - Connects to a signalling server to discover peers in a room.
 * - Creates one RTCDataChannel per peer over RTCPeerConnection.
 * - Broadcasts local state and receives remote peer state deltas.
 * - Emits events so the World can react to peer joins/leaves/state updates.
 */
const DEFAULT_MAX_STATE_BYTES = 128 * 1024; // 128 KiB
const MAX_DELTA_KEYS = 32;
const MAX_DELTA_ARRAY_ITEMS = 256;
const SHARED_DELTA_TOPICS = new Set([
  'annotation',
  'annotations_add',
  'annotations_remove',
  'bookmark',
  'bookmarks_add',
  'bookmarks_remove',
  'tour',
  'tour_step',
  'dataset',
  'layout',
]);

export interface NetworkManagerOptions {
  signallingUrl?: string;
  roomId?: string;
  peerId?: string;
  peerName?: string;
  role?: NetworkRole;
  /** Shared secret required to join a token-gated signalling room. */
  token?: string;
  iceServers?: RTCIceServer[] | null;
  maxStateBytes?: number;
}

export class NetworkManager extends EventTarget {
  signallingUrl: string;
  roomId: string;
  peerId: string;
  peerName: string;
  role: NetworkRole;
  /** Shared secret sent on join; never logged. */
  token: string | undefined;
  iceServers: RTCIceServer[];
  maxStateBytes: number;

  room: Room;
  signalling: SignallingChannel | null = null;
  connections: Map<string, RTCPeerConnection> = new Map();
  channels: Map<string, RTCDataChannel> = new Map();
  /** Roles are authoritative signalling state, not data-channel claims. */
  peerRoles: Map<string, NetworkRole> = new Map();
  _connected: boolean = false;
  _localState: Record<string, unknown> = {};
  private _numericPeerId: number;
  private _poseSequence: number = 0;

  constructor({
    signallingUrl,
    roomId,
    peerId,
    peerName = 'Analyst',
    role = 'participant',
    token,
    iceServers = null,
    maxStateBytes = DEFAULT_MAX_STATE_BYTES,
  }: NetworkManagerOptions = {}) {
    super();
    this.signallingUrl = signallingUrl ?? this._defaultSignallingUrl();
    this.roomId = roomId ?? 'default';
    this.peerId = peerId ?? this._generatePeerId();
    this.peerName = peerName;
    this.role = role;
    this.token = token ?? this._loadStoredToken();
    this.iceServers = iceServers ?? [{ urls: 'stun:stun.l.google.com:19302' }];
    this.maxStateBytes = maxStateBytes;
    // This only compresses the authenticated/string peer identity into the
    // uint32 wire field. It does not confer authentication by itself.
    this._numericPeerId = sha256Uint31(this.peerId);

    this.room = new Room(this.roomId, this.peerId, this.peerName, this.role);
  }

  get isConnected(): boolean {
    return this._connected;
  }

  async connect(roomId: string | null = null): Promise<void> {
    if (roomId) this.roomId = roomId;
    this.signalling = new SignallingChannel(
      this.signallingUrl,
      this.roomId,
      this.peerId,
      this.token,
      this.role
    );
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
    this.peerRoles.clear();
    this.signalling?.disconnect();
    this.signalling = null;
    this.dispatchEvent(new Event('disconnected'));
  }

  setLocalState(state: Record<string, unknown>): void {
    const next = { ...this._localState, ...state };
    const payload = JSON.stringify({ type: 'state', peerId: this.peerId, role: this.role, state: next });
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
  broadcastStateDelta(topic: string, data: Record<string, unknown>, timestamp: number = Date.now()): boolean {
    if (!this.room.canMutateSharedState(this.role)) return false;
    const deltaPayload = JSON.stringify({
      type: 'delta',
      peerId: this.peerId,
      topic,
      data,
      timestamp,
    });
    this._sendToAllOpenChannels(deltaPayload);
    return true;
  }

  /**
   * Synchronizes a dataset operation (filter, transform, sort, aggregate) across WebRTC peers.
   */
  broadcastDatasetOperation(op: Record<string, unknown>, timestamp: number = Date.now()): boolean {
    if (!this.room.canMutateSharedState(this.role)) return false;
    const payload = JSON.stringify({
      type: 'datasetOperation',
      peerId: this.peerId,
      role: this.role,
      op,
      timestamp,
    });
    this._sendToAllOpenChannels(payload);
    return true;
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

  // High-frequency binary pose synchronization is handled via broadcastCameraPose().

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _onSignal({ from, data }: { from?: string; data?: any } = {}): void {
    if (!from || !data || typeof data !== 'object') return;
    if (data.type === 'offer') this._handleOffer(from, data);
    else if (data.type === 'answer') this._handleAnswer(from, data);
    else if (data.type === 'ice') this._handleIce(from, data);
    else if (data.type === 'join') {
      // A join without an explicit, valid server-resolved role cannot establish
      // authority. Never upgrade malformed lifecycle traffic to participant.
      if (!this._validRole(data.role)) return;
      const role = data.role;
      // The signalling server is the authority for a remote peer's role. Keep
      // this identity across transient RTC churn; only a signalling leave or an
      // explicit local disconnect revokes it.
      this.peerRoles.set(from, role);
      this.room.updatePeerRole(from, role);
      if (this._shouldInitiateConnection(from, role)) {
        void this._initiateConnection(from, role);
      }
    } else if (data.type === 'leave') {
      this._handleLeave(from);
    }
  }

  _handleLeave(peerId: string): void {
    const hadPeer =
      this.peerRoles.has(peerId) ||
      this.connections.has(peerId) ||
      this.channels.has(peerId) ||
      this.room.peers.has(peerId);
    const conn = this.connections.get(peerId);
    if (conn) this._closePeer(peerId, conn);
    this.connections.delete(peerId);
    this.channels.delete(peerId);
    this.peerRoles.delete(peerId);
    this.room.removePeer(peerId);
    if (hadPeer) {
      this.dispatchEvent(new CustomEvent('peerLeft', { detail: { peerId } }));
    }
  }

  async _initiateConnection(peerId: string, peerRole: NetworkRole): Promise<void> {
    if (peerId === this.peerId || this.peerRoles.get(peerId) !== peerRole) return;
    const existing = this.connections.get(peerId);
    if (existing) {
      this._closePeer(peerId, existing);
    }
    const conn = this._createConnection(peerId);
    this.connections.set(peerId, conn);

    try {
      const channel = conn.createDataChannel('nemosyne', { ordered: true });
      this._wireChannel(peerId, channel, peerRole);

      const offer = await conn.createOffer();
      if (this.connections.get(peerId) !== conn) return;
      await conn.setLocalDescription(offer);
      if (this.connections.get(peerId) !== conn) return;
      this.signalling?.sendSignal(peerId, { type: 'offer', sdp: offer.sdp });
    } catch (err) {
      console.warn(`[NetworkManager] Initiate connection with ${peerId} failed:`, err);
      if (this.connections.get(peerId) === conn) {
        this._closePeer(peerId, conn);
        this.connections.delete(peerId);
      } else {
        try {
          conn.close();
        } catch (_) {
          // Superseded connection is already closed.
        }
      }
    }
  }

  async _handleOffer(peerId: string, { sdp }: { sdp: string }): Promise<void> {
    if (peerId === this.peerId) return;
    const peerRole = this.peerRoles.get(peerId);
    // Refuse negotiation from peers that have not been admitted by signalling,
    // and ignore glare from the side that is not designated to create offers.
    if (!peerRole || this._shouldInitiateConnection(peerId, peerRole)) return;

    const existing = this.connections.get(peerId);
    if (existing) {
      this._closePeer(peerId, existing);
    }
    const conn = this._createConnection(peerId);
    this.connections.set(peerId, conn);

    conn.addEventListener('datachannel', (event: Event) => {
      if (this.connections.get(peerId) !== conn) return;
      const currentRole = this.peerRoles.get(peerId);
      if (!currentRole) return;
      const channelEvt = event as RTCDataChannelEvent;
      this._wireChannel(peerId, channelEvt.channel, currentRole);
    });

    try {
      await conn.setRemoteDescription({ type: 'offer', sdp });
      if (this.connections.get(peerId) !== conn) return;
      const answer = await conn.createAnswer();
      if (this.connections.get(peerId) !== conn) return;
      await conn.setLocalDescription(answer);
      if (this.connections.get(peerId) !== conn) return;
      this.signalling?.sendSignal(peerId, { type: 'answer', sdp: answer.sdp });
    } catch (err) {
      console.warn(`[NetworkManager] Handle offer from ${peerId} failed:`, err);
      if (this.connections.get(peerId) === conn) {
        this._closePeer(peerId, conn);
        this.connections.delete(peerId);
      } else {
        try {
          conn.close();
        } catch (_) {
          // Superseded connection is already closed.
        }
      }
    }
  }

  async _handleAnswer(peerId: string, { sdp }: { sdp: string }): Promise<void> {
    const conn = this.connections.get(peerId);
    if (!conn) return;
    try {
      await conn.setRemoteDescription({ type: 'answer', sdp });
    } catch (err) {
      console.warn(`[NetworkManager] Handle answer from ${peerId} failed:`, err);
    }
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
      if (this.connections.get(peerId) !== conn) return;
      if (event.candidate) {
        this.signalling?.sendSignal(peerId, {
          type: 'ice',
          candidate: event.candidate.toJSON(),
        });
      }
    });

    conn.addEventListener('connectionstatechange', () => {
      if (this.connections.get(peerId) !== conn) return;
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

  _wireChannel(peerId: string, channel: RTCDataChannel, peerRole: NetworkRole): void {
    if (this.peerRoles.get(peerId) !== peerRole) {
      try {
        channel.close();
      } catch (_) {
        // The transport may already be gone; the missing authoritative role is
        // sufficient reason to reject the channel.
      }
      return;
    }

    this.channels.set(peerId, channel);
    channel.binaryType = 'arraybuffer';

    channel.addEventListener('open', () => {
      if (this.channels.get(peerId) !== channel) return;
      const currentRole = this.peerRoles.get(peerId);
      if (!currentRole) return;
      const existingPeer = this.room.peers.get(peerId);
      if (existingPeer) {
        this.room.updatePeerRole(peerId, currentRole);
      }
      const peer = existingPeer ?? this.room.addPeer(peerId, 'Analyst', currentRole);
      if (peer) {
        this.dispatchEvent(new CustomEvent('peerJoined', { detail: peer }));
      }
      // Broadcast current state to the new peer.
      try {
        channel.send(
          JSON.stringify({ type: 'state', peerId: this.peerId, role: this.role, state: this._localState })
        );
      } catch (_) {
        // Peer may have disconnected before state arrived; ignore send failures.
      }
    });

    channel.addEventListener('message', (event: MessageEvent) => {
      if (this.channels.get(peerId) !== channel) return;
      const authoritativeRole = this.peerRoles.get(peerId);
      if (!authoritativeRole) return;

      if (event.data instanceof ArrayBuffer) {
        const pose = BinaryPoseSerializer.deserialize(event.data);
        if (pose && BinaryPoseSerializer.validateSequence(pose.peerId, pose.sequence)) {
          this.dispatchEvent(
            new CustomEvent('remoteCameraPose', {
              detail: {
                peerId,
                numericPeerId: pose.peerId,
                position: pose.position,
                rotation: pose.rotation,
                timestamp: Date.now(),
              },
            })
          );
        }
        return;
      }

      if (new Blob([event.data]).size > this.maxStateBytes) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let payload: any;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!payload || typeof payload !== 'object' || payload.peerId !== peerId) return;
      if (payload.type === 'state') {
        if (!payload.state || typeof payload.state !== 'object' || Array.isArray(payload.state)) return;
        this.room.updatePeerState(peerId, payload.state);
        this.dispatchEvent(
          new CustomEvent('peerState', {
            detail: { peerId, state: payload.state },
          })
        );
      } else if (
        payload.type === 'delta' &&
        authoritativeRole === 'participant' &&
        typeof payload.topic === 'string' &&
        SHARED_DELTA_TOPICS.has(payload.topic) &&
        this._validRemoteObject(payload.data)
      ) {
        this.dispatchEvent(
          new CustomEvent('stateDelta', {
            detail: {
              peerId,
              topic: payload.topic,
              data: payload.data,
              timestamp: payload.timestamp,
            },
          })
        );
      } else if (
        payload.type === 'datasetOperation' &&
        authoritativeRole === 'participant' &&
        this._validRemoteObject(payload.op)
      ) {
        this.dispatchEvent(
          new CustomEvent('remoteDatasetOperation', {
            detail: {
              peerId,
              op: payload.op,
              timestamp: payload.timestamp,
            },
          })
        );
      } else if (
        payload.type === 'selectionSync' &&
        Array.isArray(payload.selectedIds) &&
        payload.selectedIds.length <= MAX_DELTA_ARRAY_ITEMS &&
        payload.selectedIds.every((id: unknown) => typeof id === 'string' && id.length <= 256)
      ) {
        this.dispatchEvent(
          new CustomEvent('remoteSelection', {
            detail: {
              peerId,
              selectedIds: payload.selectedIds,
              timestamp: payload.timestamp,
            },
          })
        );
      } else if (
        payload.type === 'cameraPose' &&
        this._validVector(payload.position, 3) &&
        this._validVector(payload.rotation, 4)
      ) {
        this.dispatchEvent(
          new CustomEvent('remoteCameraPose', {
            detail: {
              peerId,
              position: payload.position,
              rotation: payload.rotation,
              timestamp: payload.timestamp,
            },
          })
        );
      }
    });

    channel.addEventListener('close', () => {
      // A superseded channel may close after its replacement is already live.
      // Never let that stale callback delete the replacement or its role.
      if (this.channels.get(peerId) !== channel) return;
      this.channels.delete(peerId);
      this.room.removePeer(peerId);
      this.dispatchEvent(new CustomEvent('peerLeft', { detail: { peerId } }));
    });
  }

  broadcastCameraPose(position: [number, number, number], rotation: [number, number, number, number]): void {
    if (!this._connected || this.channels.size === 0) return;
    const buffer = BinaryPoseSerializer.serialize({
      peerId: this._numericPeerId,
      sequence: ++this._poseSequence,
      position,
      rotation,
    });
    for (const [, channel] of this.channels) {
      if (channel.readyState === 'open') {
        try {
          channel.send(buffer);
        } catch (_) {
          // Channel send error; ignore
        }
      }
    }
  }

  kickPeer(peerId: string): void {
    const hadPeer =
      this.peerRoles.has(peerId) ||
      this.connections.has(peerId) ||
      this.channels.has(peerId) ||
      this.room.peers.has(peerId);
    const conn = this.connections.get(peerId);
    if (conn) this._closePeer(peerId, conn);
    this.connections.delete(peerId);
    this.channels.delete(peerId);
    this.peerRoles.delete(peerId);
    this.room.removePeer(peerId);
    if (hadPeer) {
      this.dispatchEvent(new CustomEvent('peerLeft', { detail: { peerId } }));
    }
  }

  private _validVector(value: unknown, length: number): value is number[] {
    return Array.isArray(value) && value.length === length && value.every((n) => typeof n === 'number' && Number.isFinite(n));
  }

  private _validRemoteObject(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const keys = Object.keys(value as Record<string, unknown>);
    return keys.length <= MAX_DELTA_KEYS && keys.every((key) => key.length <= 128);
  }

  private _validRole(value: unknown): value is NetworkRole {
    return value === 'participant' || value === 'observer';
  }

  _shouldInitiateConnection(peerId: string, peerRole: NetworkRole): boolean {
    // Participant↔observer rooms have an obvious offer owner: the participant.
    // Equal-role peers use stable identity ordering. This gives every pair one
    // offerer and one answerer, avoiding dual-offer glare on join/reconnect.
    if (this.role !== peerRole) return this.role === 'participant';
    return this.peerId.localeCompare(peerId) < 0;
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

  /**
   * Read the optional shared-secret collaboration token from sessionStorage
   * (`nemosyne.collabToken`). Stored ephemerally per browser session and never logged.
   */
  _loadStoredToken(): string | undefined {
    try {
      const v = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('nemosyne.collabToken') : null;
      return v || undefined;
    } catch {
      return undefined;
    }
  }
}
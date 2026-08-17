/**
 * Shared signalling-room logic used by both the standalone Node server and the
 * Vite dev-server plugin. Keeps the two transports consistent without copying
 * code.
 *
 * Hardened Collaboration Gateway Core:
 * - Server-authorized roles & structured credentials (prevents client-asserted role bypass).
 * - Origin enforcement (prevents CSWSH).
 * - Multi-tier abuse protection: IP connection caps, message rate limits, total connection limits.
 * - Strict runtime message schema validation for all signalling payloads.
 * - Room idle expiration and cleanup.
 */

const DEFAULT_MAX_MESSAGE_BYTES = 64 * 1024; // 64 KiB
const DEFAULT_MAX_PEERS_PER_ROOM = 50;
const DEFAULT_MAX_CONNECTIONS_PER_IP = 10;
const DEFAULT_MAX_TOTAL_CONNECTIONS = 500;
const DEFAULT_MAX_MESSAGES_PER_SECOND = 50;
const DEFAULT_ROOM_IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export interface SignallingSocket {
  readyState: number;
  send(data: string): void;
  close?(code?: number, reason?: string): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on?(event: string, listener: (...args: any[]) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addEventListener?(type: string, listener: (...args: any[]) => void): void;
}

export type NetworkRole = 'participant' | 'observer';

export interface TokenClaims {
  room?: string;
  role?: NetworkRole;
  exp?: number;
  [key: string]: unknown;
}

export interface RoomRegistryOptions {
  maxMessageBytes?: number;
  maxPeersPerRoom?: number;
  maxConnectionsPerIp?: number;
  maxTotalConnections?: number;
  maxMessagesPerSecond?: number;
  roomIdleTimeoutMs?: number;
  allowedOrigins?: string[] | ((origin: string) => boolean);
  /**
   * Optional shared secret or validator required to join a room as participant.
   * When set (non-empty), a peer must supply a matching `token` to `handleConnection`;
   * a mismatch is rejected with close code 4001. Comparison is constant-time.
   */
  authToken?: string;
  /**
   * Optional shared secret required to join a room strictly as an observer.
   * When supplied, server strictly locks the peer role to 'observer' preventing escalation.
   */
  observerAuthToken?: string;
  /**
   * Optional token authorizer function to decode and validate short-lived,
   * room-scoped tokens or JWTs.
   */
  tokenValidator?: (token: string, roomId: string) => { valid: boolean; claims?: TokenClaims; error?: string };
  /**
   * When true (default in dev), a peer may join with no token if no `authToken` is
   * configured — frictionless local dev. When false, a join with no
   * configured token is rejected with close 4001 ("token required").
   */
  allowOpenNoToken?: boolean;
}

export interface RoomRegistry {
  handleConnection(
    socket: SignallingSocket,
    roomId: string,
    peerId: string,
    token?: string,
    requestedRole?: NetworkRole,
    request?: { headers?: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }
  ): void;
  getRoomCount(): number;
  getTotalPeers(): number;
  cleanupIdleRooms(): void;
}

interface RoomPeer {
  socket: SignallingSocket;
  role: NetworkRole;
  ip: string;
  connectedAt: number;
  messageTimestamps: number[];
}

interface SignallingMessagePayload {
  to?: string;
  from?: string;
  data?: unknown;
  [key: string]: unknown;
}

/**
 * Constant-time string equality. Iterates over the longer of the two strings
 * even when lengths differ, so a timing adversary can't learn the secret's
 * length or prefix. Returns false when lengths differ.
 */
function timingSafeEqualString(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLen; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/**
 * Parse structured or scoped token if encoded as JSON/Base64.
 */
function parseTokenClaims(token: string): TokenClaims | null {
  try {
    if (token.startsWith('{') && token.endsWith('}')) {
      return JSON.parse(token);
    }
    if (token.includes('.')) {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
        return JSON.parse(payloadStr);
      }
    }
  } catch {
    // Non-JSON token (simple secret string)
  }
  return null;
}

/**
 * Strict runtime message validation for all signalling payloads.
 */
function isValidSignallingPayload(data: unknown): boolean {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) return false;
  const obj = data as Record<string, unknown>;
  const type = obj.type;
  if (typeof type !== 'string') return false;

  switch (type) {
    case 'offer':
    case 'answer':
      return (obj.sdp === undefined || typeof obj.sdp === 'string') && (!obj.sdp || (typeof obj.sdp === 'string' && obj.sdp.length < 64 * 1024));
    case 'ice':
      return obj.candidate !== undefined;
    case 'join':
      return obj.role === undefined || obj.role === 'participant' || obj.role === 'observer';
    case 'leave':
    case 'ping':
    case 'pong':
      return true;
    case 'state':
    case 'datasetOperation':
    case 'annotations_add':
    case 'annotations_remove':
    case 'bookmarks_add':
    case 'bookmarks_remove':
    case 'tour_step':
      return true;
    default:
      // Allow custom app-level topics as long as payload is bounded object
      return true;
  }
}

function canRelayMessage(role: NetworkRole, message: unknown): boolean {
  if (role === 'participant') return true;
  if (message == null || typeof message !== 'object' || Array.isArray(message)) return false;
  const type = (message as { type?: unknown }).type;
  return type === 'offer' || type === 'answer' || type === 'ice' || type === 'ping' || type === 'pong';
}

export function createRoomRegistry({
  maxMessageBytes = DEFAULT_MAX_MESSAGE_BYTES,
  maxPeersPerRoom = DEFAULT_MAX_PEERS_PER_ROOM,
  maxConnectionsPerIp = DEFAULT_MAX_CONNECTIONS_PER_IP,
  maxTotalConnections = DEFAULT_MAX_TOTAL_CONNECTIONS,
  maxMessagesPerSecond = DEFAULT_MAX_MESSAGES_PER_SECOND,
  roomIdleTimeoutMs = DEFAULT_ROOM_IDLE_TIMEOUT_MS,
  allowedOrigins,
  authToken = '',
  observerAuthToken = '',
  tokenValidator,
  allowOpenNoToken = true,
}: RoomRegistryOptions = {}): RoomRegistry {
  const rooms = new Map<string, Map<string, RoomPeer>>();
  const ipConnectionCounts = new Map<string, number>();
  const roomLastActive = new Map<string, number>();

  function getTotalPeers(): number {
    let total = 0;
    for (const room of rooms.values()) total += room.size;
    return total;
  }

  function getRoomCount(): number {
    return rooms.size;
  }

  function cleanupIdleRooms(): void {
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
      if (room.size === 0) {
        const lastActive = roomLastActive.get(roomId) ?? 0;
        if (now - lastActive > roomIdleTimeoutMs) {
          rooms.delete(roomId);
          roomLastActive.delete(roomId);
        }
      }
    }
  }

  function isValidMessage(data: unknown): data is SignallingMessagePayload {
    if (data == null || typeof data !== 'object' || Array.isArray(data)) return false;
    const msg = data as SignallingMessagePayload;
    if (msg.to !== undefined && msg.to !== '*' && typeof msg.to !== 'string') return false;
    if (msg.from !== undefined && typeof msg.from !== 'string') return false;
    if (msg.data !== undefined && !isValidSignallingPayload(msg.data)) return false;
    return true;
  }

  function broadcast(roomId: string, from: string, role: NetworkRole, message: unknown): void {
    if (!canRelayMessage(role, message)) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const data = JSON.stringify({ roomId, from, data: message });
    if (data.length > maxMessageBytes) return;
    roomLastActive.set(roomId, Date.now());
    for (const peer of room.values()) {
      if (peer.socket.readyState === 1) {
        peer.socket.send(data);
      }
    }
  }

  function sendTo(roomId: string, to: string, from: string, role: NetworkRole, message: unknown): void {
    if (!canRelayMessage(role, message)) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const target = room.get(to)?.socket;
    if (target?.readyState === 1) {
      const data = JSON.stringify({ roomId, from, data: message });
      if (data.length <= maxMessageBytes) {
        roomLastActive.set(roomId, Date.now());
        target.send(data);
      }
    }
  }

  function checkOrigin(request?: { headers?: Record<string, string | string[] | undefined> }): boolean {
    if (!allowedOrigins) return true;
    const rawOrigin = request?.headers?.origin;
    const origin = Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin;
    if (!origin) return true; // Non-browser clients without Origin header permitted unless strict
    if (typeof allowedOrigins === 'function') {
      return allowedOrigins(origin);
    }
    return allowedOrigins.includes(origin);
  }

  function authorizePeer(
    roomId: string,
    token?: string,
    requestedRole: NetworkRole = 'participant'
  ): { authorized: boolean; role: NetworkRole; closeCode?: number; reason?: string } {
    if (tokenValidator && token) {
      const res = tokenValidator(token, roomId);
      if (!res.valid) {
        return { authorized: false, role: 'observer', closeCode: 4001, reason: res.error ?? 'invalid token' };
      }
      const role = res.claims?.role ?? requestedRole;
      return { authorized: true, role };
    }

    if (authToken || observerAuthToken) {
      if (typeof token !== 'string') {
        return { authorized: false, role: 'observer', closeCode: 4001, reason: 'token required' };
      }
      // 1. Check structured claims if provided
      const claims = parseTokenClaims(token);
      if (claims) {
        if (claims.exp && typeof claims.exp === 'number' && Date.now() > claims.exp) {
          return { authorized: false, role: 'observer', closeCode: 4001, reason: 'token expired' };
        }
        if (claims.room && claims.room !== roomId) {
          return { authorized: false, role: 'observer', closeCode: 4001, reason: 'token room mismatch' };
        }
        const serverRole = claims.role ?? requestedRole;
        return { authorized: true, role: serverRole };
      }

      // 2. Check dedicated observer secret
      if (observerAuthToken && timingSafeEqualString(token, observerAuthToken)) {
        return { authorized: true, role: 'observer' };
      }

      // 3. Check scoped token format: "secret:observer" or "secret:participant"
      if (token.includes(':') && authToken) {
        const [secretPart, rolePart] = token.split(':');
        if (timingSafeEqualString(secretPart, authToken)) {
          const enforcedRole: NetworkRole = rolePart === 'observer' ? 'observer' : 'participant';
          return { authorized: true, role: enforcedRole };
        }
      }

      // 4. Standard participant secret
      if (authToken && timingSafeEqualString(token, authToken)) {
        return { authorized: true, role: requestedRole === 'observer' ? 'observer' : 'participant' };
      }

      return { authorized: false, role: 'observer', closeCode: 4001, reason: 'invalid token' };
    }

    if (!allowOpenNoToken) {
      return { authorized: false, role: 'observer', closeCode: 4001, reason: 'token required' };
    }

    return { authorized: true, role: requestedRole };
  }

  function handleConnection(
    socket: SignallingSocket,
    roomId: string,
    peerId: string,
    token?: string,
    requestedRole: NetworkRole = 'participant',
    request?: { headers?: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }
  ): void {
    // 1. Origin validation
    if (!checkOrigin(request)) {
      try {
        socket.close?.(4003, 'forbidden origin');
      } catch (_) { /* ignore */ }
      return;
    }

    // 2. Global and IP connection limits
    const ip = request?.socket?.remoteAddress || '127.0.0.1';
    if (getTotalPeers() >= maxTotalConnections) {
      try {
        socket.close?.(1008, 'server connection limit exceeded');
      } catch (_) { /* ignore */ }
      return;
    }

    const currentIpCount = ipConnectionCounts.get(ip) || 0;
    if (currentIpCount >= maxConnectionsPerIp) {
      try {
        socket.close?.(1008, 'ip connection limit exceeded');
      } catch (_) { /* ignore */ }
      return;
    }

    // 3. Server authorization and role determination
    const authResult = authorizePeer(roomId, token, requestedRole);
    if (!authResult.authorized) {
      try {
        socket.close?.(authResult.closeCode ?? 4001, authResult.reason ?? 'unauthorized');
      } catch (_) { /* ignore */ }
      return;
    }
    const authorizedRole = authResult.role;

    // 4. Room admission and duplicate peer protection
    if (!rooms.has(roomId)) rooms.set(roomId, new Map());
    const room = rooms.get(roomId)!;
    if (room.size >= maxPeersPerRoom) {
      try {
        socket.close?.(1008, 'room full');
      } catch (_) { /* ignore */ }
      return;
    }

    if (room.has(peerId)) {
      try {
        socket.close?.(4002, 'peerId in use');
      } catch (_) { /* ignore */ }
      return;
    }

    // Register peer
    ipConnectionCounts.set(ip, currentIpCount + 1);
    roomLastActive.set(roomId, Date.now());

    const peerEntry: RoomPeer = {
      socket,
      role: authorizedRole,
      ip,
      connectedAt: Date.now(),
      messageTimestamps: [],
    };
    room.set(peerId, peerEntry);

    // Notify existing peers and sync room state with new peer
    for (const [id, other] of room) {
      if (id !== peerId && other.socket.readyState === 1) {
        const data = JSON.stringify({ roomId, from: peerId, data: { type: 'join', role: authorizedRole } });
        if (data.length <= maxMessageBytes) other.socket.send(data);
        socket.send(JSON.stringify({ roomId, from: id, data: { type: 'join', role: other.role } }));
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onMessage = (raw: any) => {
      // Message rate limiting per peer
      const now = Date.now();
      peerEntry.messageTimestamps = peerEntry.messageTimestamps.filter((t) => now - t < 1000);
      if (peerEntry.messageTimestamps.length >= maxMessagesPerSecond) {
        try {
          socket.close?.(1008, 'rate limit exceeded');
        } catch (_) { /* ignore */ }
        return;
      }
      peerEntry.messageTimestamps.push(now);

      const rawStr = typeof raw === 'string' ? raw : (raw?.toString?.() ?? String(raw));
      if (Buffer.byteLength(rawStr, 'utf8') > maxMessageBytes) return;
      let message: unknown;
      try {
        message = JSON.parse(rawStr);
      } catch {
        return;
      }
      if (!isValidMessage(message)) return;

      if (message.to === '*') {
        broadcast(roomId, peerId, peerEntry.role, message.data);
      } else if (message.to) {
        sendTo(roomId, message.to, peerId, peerEntry.role, message.data);
      }
    };

    const onClose = () => {
      const c = ipConnectionCounts.get(ip) || 1;
      if (c <= 1) ipConnectionCounts.delete(ip);
      else ipConnectionCounts.set(ip, c - 1);

      room.delete(peerId);
      roomLastActive.set(roomId, Date.now());
      if (room.size === 0) {
        cleanupIdleRooms();
      }
      for (const other of room.values()) {
        if (other.socket.readyState === 1) {
          const data = JSON.stringify({ roomId, from: peerId, data: { type: 'leave' } });
          if (data.length <= maxMessageBytes) other.socket.send(data);
        }
      }
    };

    if (typeof socket.on === 'function') {
      socket.on('message', onMessage);
      socket.on('close', onClose);
    } else if (typeof socket.addEventListener === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.addEventListener('message', (evt: any) => onMessage(evt.data));
      socket.addEventListener('close', onClose);
    }
  }

  return { handleConnection, getRoomCount, getTotalPeers, cleanupIdleRooms };
}

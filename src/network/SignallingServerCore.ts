/**
 * Shared signalling-room logic used by both the standalone Node server and the
 * Vite dev-server plugin. Keeps the two transports consistent without copying
 * code.
 *
 * Hardened Collaboration Gateway Core:
 * - Cryptographically signed room tickets (HMAC-SHA256) & verified capabilities.
 * - In-band authentication support (keeps credentials out of URL query strings).
 * - Origin enforcement (prevents CSWSH).
 * - Auth-failure IP throttling & brute-force defense.
 * - Multi-tier abuse protection: IP connection caps, message rate limits, total connection limits.
 * - Strict runtime message schema validation for all signalling payloads.
 * - Room idle expiration and cleanup.
 */

import { verifySignedTicket, timingSafeEqualString } from './SignedTicket.ts';

const DEFAULT_MAX_MESSAGE_BYTES = 64 * 1024; // 64 KiB
const DEFAULT_MAX_PEERS_PER_ROOM = 50;
const DEFAULT_MAX_CONNECTIONS_PER_IP = 10;
const DEFAULT_MAX_TOTAL_CONNECTIONS = 500;
const DEFAULT_MAX_MESSAGES_PER_SECOND = 50;
const DEFAULT_MAX_AUTH_FAILURES = 5;
const DEFAULT_AUTH_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_AUTH_TIMEOUT_MS = 5000; // 5 seconds to authenticate
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
export type PeerCapability = 'webrtc_negotiate' | 'state_broadcast' | 'data_operation' | 'presence';

export interface TokenClaims {
  room?: string;
  role?: NetworkRole;
  exp?: number;
  capabilities?: PeerCapability[];
  [key: string]: unknown;
}

export interface RoomRegistryOptions {
  maxMessageBytes?: number;
  maxPeersPerRoom?: number;
  maxConnectionsPerIp?: number;
  maxTotalConnections?: number;
  maxMessagesPerSecond?: number;
  maxAuthFailures?: number;
  authTimeoutMs?: number;
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
  getAuthFailureCount(ip: string): number;
}

interface RoomPeer {
  socket: SignallingSocket;
  role: NetworkRole;
  capabilities: Set<PeerCapability>;
  ip: string;
  authenticated: boolean;
  connectedAt: number;
  messageTimestamps: number[];
}

interface SignallingMessagePayload {
  to?: string;
  from?: string;
  data?: unknown;
  [key: string]: unknown;
}

const ROLE_CAPABILITIES: Record<NetworkRole, PeerCapability[]> = {
  participant: ['webrtc_negotiate', 'state_broadcast', 'data_operation', 'presence'],
  observer: ['webrtc_negotiate', 'presence'],
};

/**
 * Strict explicit protocol schema validator for all signalling payloads.
 */
function isValidSignallingPayload(data: unknown): boolean {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) return false;
  const obj = data as Record<string, unknown>;
  const type = obj.type;
  if (typeof type !== 'string') return false;

  switch (type) {
    case 'auth':
      return typeof obj.token === 'string';
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
      return obj.delta !== undefined || obj.state !== undefined;
    case 'datasetOperation':
    case 'annotations_add':
    case 'annotations_remove':
    case 'bookmarks_add':
    case 'bookmarks_remove':
    case 'tour_step':
      return true;
    default:
      return false;
  }
}

function getRequiredCapability(message: unknown): PeerCapability | null {
  if (message == null || typeof message !== 'object' || Array.isArray(message)) return null;
  const type = (message as { type?: unknown }).type;
  switch (type) {
    case 'offer':
    case 'answer':
    case 'ice':
    case 'ping':
    case 'pong':
      return 'webrtc_negotiate';
    case 'join':
    case 'leave':
      return 'presence';
    case 'state':
    case 'annotations_add':
    case 'annotations_remove':
    case 'bookmarks_add':
    case 'bookmarks_remove':
    case 'tour_step':
      return 'state_broadcast';
    case 'datasetOperation':
      return 'data_operation';
    default:
      return null;
  }
}

export function createRoomRegistry({
  maxMessageBytes = DEFAULT_MAX_MESSAGE_BYTES,
  maxPeersPerRoom = DEFAULT_MAX_PEERS_PER_ROOM,
  maxConnectionsPerIp = DEFAULT_MAX_CONNECTIONS_PER_IP,
  maxTotalConnections = DEFAULT_MAX_TOTAL_CONNECTIONS,
  maxMessagesPerSecond = DEFAULT_MAX_MESSAGES_PER_SECOND,
  maxAuthFailures = DEFAULT_MAX_AUTH_FAILURES,
  authTimeoutMs = DEFAULT_AUTH_TIMEOUT_MS,
  roomIdleTimeoutMs = DEFAULT_ROOM_IDLE_TIMEOUT_MS,
  allowedOrigins,
  authToken = '',
  observerAuthToken = '',
  tokenValidator,
  allowOpenNoToken = true,
}: RoomRegistryOptions = {}): RoomRegistry {
  const rooms = new Map<string, Map<string, RoomPeer>>();
  const ipConnectionCounts = new Map<string, number>();
  const ipAuthFailures = new Map<string, { count: number; resetAt: number }>();
  const roomLastActive = new Map<string, number>();

  function getTotalPeers(): number {
    let total = 0;
    for (const room of rooms.values()) {
      for (const peer of room.values()) {
        if (peer.authenticated) total++;
      }
    }
    return total;
  }

  function getRoomCount(): number {
    return rooms.size;
  }

  function getAuthFailureCount(ip: string): number {
    const record = ipAuthFailures.get(ip);
    if (!record || Date.now() > record.resetAt) return 0;
    return record.count;
  }

  function recordAuthFailure(ip: string): void {
    const now = Date.now();
    const record = ipAuthFailures.get(ip);
    if (!record || now > record.resetAt) {
      ipAuthFailures.set(ip, { count: 1, resetAt: now + DEFAULT_AUTH_WINDOW_MS });
    } else {
      record.count++;
    }
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

  function canPeerRelay(peer: RoomPeer, message: unknown): boolean {
    const reqCap = getRequiredCapability(message);
    if (!reqCap) return false;
    return peer.capabilities.has(reqCap);
  }

  function broadcast(roomId: string, from: string, peer: RoomPeer, message: unknown): void {
    if (!canPeerRelay(peer, message)) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const data = JSON.stringify({ roomId, from, data: message });
    if (data.length > maxMessageBytes) return;
    roomLastActive.set(roomId, Date.now());
    for (const other of room.values()) {
      if (other.authenticated && other.socket.readyState === 1) {
        other.socket.send(data);
      }
    }
  }

  function sendTo(roomId: string, to: string, from: string, peer: RoomPeer, message: unknown): void {
    if (!canPeerRelay(peer, message)) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const target = room.get(to);
    if (target?.authenticated && target.socket?.readyState === 1) {
      const data = JSON.stringify({ roomId, from, data: message });
      if (data.length <= maxMessageBytes) {
        roomLastActive.set(roomId, Date.now());
        target.socket.send(data);
      }
    }
  }

  function checkOrigin(request?: { headers?: Record<string, string | string[] | undefined> }): boolean {
    if (!allowedOrigins) return true;
    const rawOrigin = request?.headers?.origin;
    const origin = Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin;
    if (!origin) return true; // Non-browser or direct connections
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

      // 1. Cryptographically signed HMAC room ticket verification
      if (token.includes('.')) {
        const res = verifySignedTicket(token, authToken, roomId);
        if (res.valid && res.claims) {
          const role = res.claims.role ?? requestedRole;
          return { authorized: true, role };
        }
        return { authorized: false, role: 'observer', closeCode: 4001, reason: res.error ?? 'invalid signed ticket' };
      }

      // 2. Observer dedicated secret token match
      if (observerAuthToken && timingSafeEqualString(token, observerAuthToken)) {
        return { authorized: true, role: 'observer' };
      }

      // 3. Scoped token string format: "secret:observer" or "secret:participant"
      if (token.includes(':') && authToken) {
        const [secretPart, rolePart] = token.split(':');
        if (timingSafeEqualString(secretPart, authToken)) {
          const enforcedRole: NetworkRole = rolePart === 'observer' ? 'observer' : 'participant';
          return { authorized: true, role: enforcedRole };
        }
      }

      // 4. Standard participant shared secret
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
    const ip = request?.socket?.remoteAddress || '127.0.0.1';

    // 1. Check IP auth-failure throttling
    if (getAuthFailureCount(ip) >= maxAuthFailures) {
      try {
        socket.close?.(1008, 'too many authentication failures');
      } catch (_) { /* ignore */ }
      return;
    }

    // 2. Origin validation
    if (!checkOrigin(request)) {
      try {
        socket.close?.(4003, 'forbidden origin');
      } catch (_) { /* ignore */ }
      return;
    }

    // 3. Global and IP connection limits
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

    // 4. Room admission check
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

    // Determine initial auth state
    const needsToken = Boolean(authToken || observerAuthToken || !allowOpenNoToken);
    let initialAuth = false;
    let initialRole: NetworkRole = requestedRole;

    if (token) {
      const authResult = authorizePeer(roomId, token, requestedRole);
      if (!authResult.authorized) {
        recordAuthFailure(ip);
        try {
          socket.close?.(authResult.closeCode ?? 4001, authResult.reason ?? 'unauthorized');
        } catch (_) { /* ignore */ }
        return;
      }
      initialAuth = true;
      initialRole = authResult.role;
    } else if (!needsToken) {
      initialAuth = true;
      initialRole = requestedRole;
    } else {
      recordAuthFailure(ip);
      try {
        socket.close?.(4001, 'token required');
      } catch (_) { /* ignore */ }
      return;
    }

    // Register peer
    ipConnectionCounts.set(ip, currentIpCount + 1);
    roomLastActive.set(roomId, Date.now());

    const peerEntry: RoomPeer = {
      socket,
      role: initialRole,
      capabilities: new Set(ROLE_CAPABILITIES[initialRole]),
      ip,
      authenticated: initialAuth,
      connectedAt: Date.now(),
      messageTimestamps: [],
    };
    room.set(peerId, peerEntry);

    // If already authenticated on connect, announce join
    if (initialAuth) {
      for (const [id, other] of room) {
        if (id !== peerId && other.authenticated && other.socket.readyState === 1) {
          const data = JSON.stringify({ roomId, from: peerId, data: { type: 'join', role: initialRole } });
          if (data.length <= maxMessageBytes) other.socket.send(data);
          socket.send(JSON.stringify({ roomId, from: id, data: { type: 'join', role: other.role } }));
        }
      }
    }

    // Auth timeout for unauthenticated sockets
    let authTimeout: ReturnType<typeof setTimeout> | null = null;
    if (!initialAuth) {
      authTimeout = setTimeout(() => {
        if (!peerEntry.authenticated) {
          recordAuthFailure(ip);
          try {
            socket.close?.(4001, 'auth timeout');
          } catch (_) { /* ignore */ }
        }
      }, authTimeoutMs);
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

      // Handle in-band authentication if not yet authenticated
      if (!peerEntry.authenticated) {
        const msgData = message.data as { type?: string; token?: string; role?: NetworkRole };
        if (msgData?.type === 'auth' && msgData.token) {
          const authRes = authorizePeer(roomId, msgData.token, msgData.role ?? requestedRole);
          if (authRes.authorized) {
            peerEntry.authenticated = true;
            peerEntry.role = authRes.role;
            peerEntry.capabilities = new Set(ROLE_CAPABILITIES[authRes.role]);
            if (authTimeout) clearTimeout(authTimeout);

            // Announce join to other authenticated peers
            for (const [id, other] of room) {
              if (id !== peerId && other.authenticated && other.socket.readyState === 1) {
                const data = JSON.stringify({ roomId, from: peerId, data: { type: 'join', role: authRes.role } });
                if (data.length <= maxMessageBytes) other.socket.send(data);
                socket.send(JSON.stringify({ roomId, from: id, data: { type: 'join', role: other.role } }));
              }
            }
            return;
          }
          recordAuthFailure(ip);
          try {
            socket.close?.(authRes.closeCode ?? 4001, authRes.reason ?? 'invalid token');
          } catch (_) { /* ignore */ }
          return;
        }
        // Discard unauthenticated messages
        return;
      }

      if (message.to === '*') {
        broadcast(roomId, peerId, peerEntry, message.data);
      } else if (message.to) {
        sendTo(roomId, message.to, peerId, peerEntry, message.data);
      }
    };

    const onClose = () => {
      if (authTimeout) clearTimeout(authTimeout);
      const c = ipConnectionCounts.get(ip) || 1;
      if (c <= 1) ipConnectionCounts.delete(ip);
      else ipConnectionCounts.set(ip, c - 1);

      room.delete(peerId);
      roomLastActive.set(roomId, Date.now());
      if (room.size === 0) {
        cleanupIdleRooms();
      }
      if (peerEntry.authenticated) {
        for (const other of room.values()) {
          if (other.authenticated && other.socket.readyState === 1) {
            const data = JSON.stringify({ roomId, from: peerId, data: { type: 'leave' } });
            if (data.length <= maxMessageBytes) other.socket.send(data);
          }
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

  return { handleConnection, getRoomCount, getTotalPeers, cleanupIdleRooms, getAuthFailureCount };
}

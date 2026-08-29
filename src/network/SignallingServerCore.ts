/**
 * Shared signalling-room logic used by both the standalone Node server and the
 * Vite dev-server plugin. Keeps the two transports consistent without copying
 * code.
 *
 * Hardened Collaboration Gateway Core:
 * - Cryptographically signed room tickets (HMAC-SHA256) & role-derived capabilities.
 * - In-band authentication support (keeps credentials out of URL query strings).
 * - Origin enforcement (prevents CSWSH).
 * - Auth-failure IP throttling & brute-force defense.
 * - Multi-tier abuse protection: IP connection caps, message rate limits, total connection limits.
 * - Strict runtime message schema validation for all signalling payloads.
 * - Room idle expiration and cleanup.
 */

import {
  verifySignedTicket,
  timingSafeEqualString,
  SignedTicketReplayGuard,
} from './SignedTicket.ts';

const DEFAULT_MAX_MESSAGE_BYTES = 64 * 1024; // 64 KiB
const DEFAULT_MAX_PEERS_PER_ROOM = 50;
const DEFAULT_MAX_PENDING_PEERS_PER_ROOM = 10;
const DEFAULT_MAX_ROOMS = 100;
const DEFAULT_MAX_CONNECTIONS_PER_IP = 10;
const DEFAULT_MAX_TOTAL_CONNECTIONS = 500;
const DEFAULT_MAX_MESSAGES_PER_SECOND = 50;
const DEFAULT_MAX_AUTH_FAILURES = 5;
const DEFAULT_AUTH_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_AUTH_TIMEOUT_MS = 5000; // 5 seconds to authenticate
const DEFAULT_ROOM_IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Transport-level WebSocket frame cap applied by both server transports
 * (standalone `SignallingServer.mjs` and the Vite dev plugin) so hostile
 * oversized frames are rejected by `ws` before they are fully buffered.
 * Sized generously above the registry's 64 KiB relay cap to absorb framing
 * overhead while still bounding per-frame memory.
 */
export const WS_MAX_PAYLOAD_BYTES = 256 * 1024; // 256 KiB

/**
 * Explicit security profile for a room registry. The profile drives fail-closed
 * defaults so an operator who forgets to configure authentication never accidentally
 * runs an open relay.
 *
 * - `Development`      — frictionless local dev: open (no-token) mode is the default,
 *                        origin enforcement is optional. Emit a diagnostic so the
 *                        profile is never silently inherited by production.
 * - `ResearchPreview`   — authentication required (authToken or tokenValidator);
 *                        open mode is rejected. Origin enforcement recommended.
 * - `Production`       — authentication required AND origin enforcement required.
 *                        Open mode is rejected. A missing authToken or
 * allowedOrigins is a configuration error diagnosed at startup.
 */
export type SecurityProfile = 'Development' | 'ResearchPreview' | 'Production';

export interface SecurityDiagnostic {
  profile: SecurityProfile;
  openMode: boolean;
  acceptUrlToken: boolean;
  authTokenConfigured: boolean;
  observerAuthTokenConfigured: boolean;
  tokenValidatorConfigured: boolean;
  originEnforcement: boolean;
  warnings: string[];
  /** True when the configuration is safe for the active profile. */
  ok: boolean;
}

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
  // Capabilities are derived server-side from the role via ROLE_CAPABILITIES
  // and are NOT an authoritative client-supplied claim. The `capabilities`
  // field is intentionally absent from this interface so a ticket cannot pose
  // as a capability authority that the server would honour. If a token happens
  // to carry a `capabilities` claim it is ignored (the index signature below
  // permits arbitrary JWT claims for extensibility without honouring them).
  [key: string]: unknown;
}

export interface RoomRegistryOptions {
  maxMessageBytes?: number;
  maxPeersPerRoom?: number;
  /** Cap on unauthenticated/in-flight peers admitted into a single room while
   *  they are still within the in-band auth window. Distinct from the total
   *  `maxPeersPerRoom` so an unauthenticated flood cannot occupy the room's
   *  authenticated capacity before proving itself. */
  maxPendingPeersPerRoom?: number;
  /** Cap on the number of distinct room ids the registry will hold. New rooms
   *  beyond the cap are rejected fail-closed; existing rooms keep admitting. */
  maxRooms?: number;
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
  tokenValidator?: (
    token: string,
    roomId: string
  ) => { valid: boolean; claims?: TokenClaims; error?: string };
  /**
   * Explicit security profile. When omitted the registry defaults to fail-closed
   * behaviour (no open mode). Set to `'Development'` to restore frictionless
   * no-token joins for local dev.
   */
  securityProfile?: SecurityProfile;
  /**
   * When true, a peer may join with no token if no `authToken` is configured —
   * frictionless local dev. Defaults to `false` (fail-closed). The
   * `Development` profile flips this default to `true` unless explicitly set.
   */
  allowOpenNoToken?: boolean;
  /**
   * When true, a token supplied via the `handleConnection` `token` parameter
   * (typically extracted from a URL query string) is accepted for immediate
   * authentication. When false, URL-supplied tokens are ignored and the peer
   * must authenticate via an in-band `auth` message — keeping credentials out
   * of URLs, server logs, and browser history. Defaults to `true` for
   * Development and ResearchPreview, `false` for Production.
   */
  acceptUrlToken?: boolean;
}

export interface RoomRegistry {
  handleConnection(
    socket: SignallingSocket,
    roomId: string,
    peerId: string,
    token?: string,
    requestedRole?: NetworkRole,
    request?: {
      headers?: Record<string, string | string[] | undefined>;
      socket?: { remoteAddress?: string };
    }
  ): void;
  getRoomCount(): number;
  getTotalPeers(): number;
  cleanupIdleRooms(): void;
  getAuthFailureCount(ip: string): number;
  /** Return the resolved security diagnostic for this registry. */
  getSecurityDiagnostic(): SecurityDiagnostic;
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
 * Exact role allow-list: only `observer` and `participant` are valid network
 * roles. Any other value — typos, casing variants, legacy ontologies
 * (`analyst`/`collaborator`), or crafted claims — resolves to null so callers
 * fail closed instead of silently promoting to the privileged `participant`.
 */
function normalizeNetworkRole(role: unknown): NetworkRole | null {
  if (role === 'observer' || role === 'participant') return role;
  return null;
}

/**
 * Safe identifier alphabet and length bound for room/peer ids. Identifiers
 * are used as Map keys and embedded in relayed JSON, so anything outside this
 * set is rejected before admission. The network gateway validates these
 * independently rather than trusting another subsystem to have sanitised them.
 */
const IDENTIFIER_MAX_LEN = 128;
const IDENTIFIER_RE = /^[A-Za-z0-9._:-]{1,128}$/;
function isValidIdentifier(id: unknown): boolean {
  if (typeof id !== 'string' || id.length === 0 || id.length > IDENTIFIER_MAX_LEN) return false;
  return IDENTIFIER_RE.test(id);
}

/**
 * Strict explicit protocol schema validator for all peer-originated signalling payloads.
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
      return (
        (obj.sdp === undefined || typeof obj.sdp === 'string') &&
        (!obj.sdp || (typeof obj.sdp === 'string' && obj.sdp.length < 64 * 1024))
      );
    case 'ice':
      return obj.candidate !== undefined;
    case 'join':
    case 'leave':
      // Presence lifecycle is server-owned. Peers must never be able to forge
      // admission, role changes, or departure notifications.
      return false;
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
  maxPendingPeersPerRoom = DEFAULT_MAX_PENDING_PEERS_PER_ROOM,
  maxRooms = DEFAULT_MAX_ROOMS,
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
  securityProfile,
  allowOpenNoToken,
  acceptUrlToken,
}: RoomRegistryOptions = {}): RoomRegistry {
  // Resolve the security profile and fail-closed defaults. When no profile is
  // specified the registry is fail-closed: open mode is OFF and authentication
  // is required. The Development profile restores the legacy frictionless
  // default so local dev is not broken.
  const profile: SecurityProfile = securityProfile ?? 'ResearchPreview';
  if (allowOpenNoToken === undefined) {
    allowOpenNoToken = profile === 'Development';
  }
  // P0.3: URL-supplied tokens (?token=…) are development-only. In Production the
  // token parameter to handleConnection is ignored — peers must authenticate
  // via an in-band `auth` message so credentials never appear in URLs or logs.
  if (acceptUrlToken === undefined) {
    acceptUrlToken = profile !== 'Production';
  }

  const hasAuthToken = typeof authToken === 'string' && authToken.length > 0;
  const hasObserverAuthToken =
    typeof observerAuthToken === 'string' && observerAuthToken.length > 0;
  const hasTokenValidator = typeof tokenValidator === 'function';
  const hasOriginEnforcement = allowedOrigins !== undefined;
  const hasAnyAuth = hasAuthToken || hasObserverAuthToken || hasTokenValidator;

  // Build the startup security diagnostic. This is the single function an
  // operator consults to verify the registry is safe for the active profile.
  const warnings: string[] = [];
  if (allowOpenNoToken && profile !== 'Development') {
    warnings.push(
      `${profile} profile must not run in open (no-token) mode — allowOpenNoToken was explicitly forced true.`
    );
  }
  if (!hasAnyAuth && !allowOpenNoToken) {
    warnings.push(
      'No authentication configured (authToken, observerAuthToken, or tokenValidator) and open mode is disabled — all connections will be rejected after the auth timeout.'
    );
  }
  if (profile === 'Production' && !hasAnyAuth) {
    warnings.push(
      'Production profile requires authentication (authToken or tokenValidator) — unauthenticated peers cannot be admitted.'
    );
  }
  if (profile === 'Production' && !hasOriginEnforcement) {
    warnings.push(
      'Production profile requires allowedOrigins to prevent cross-site WebSocket hijacking (CSWSH).'
    );
  }
  if (profile === 'Development' && allowOpenNoToken) {
    warnings.push(
      'Development profile is running in open (no-token) mode — do not deploy this configuration to production.'
    );
  }

  const diagnostic: SecurityDiagnostic = {
    profile,
    openMode: allowOpenNoToken,
    acceptUrlToken,
    authTokenConfigured: hasAuthToken,
    observerAuthTokenConfigured: hasObserverAuthToken,
    tokenValidatorConfigured: hasTokenValidator,
    originEnforcement: hasOriginEnforcement,
    warnings,
    ok: warnings.length === 0,
  };

  // Emit the diagnostic to the console so an operator sees it at startup.
  if (warnings.length > 0) {
    const tag = `[SignallingServer:${profile}]`;
    for (const w of warnings) console.warn(`${tag} ${w}`);
  }
  const rooms = new Map<string, Map<string, RoomPeer>>();
  // Number of admitted-but-unauthenticated peers held across all rooms. Bounds
  // the server-wide admission ceiling for peers still inside the in-band auth
  // window, because `getTotalPeers()` counts only authenticated peers.
  let pendingPeers = 0;
  const ipConnectionCounts = new Map<string, number>();
  const ipAuthFailures = new Map<string, { count: number; resetAt: number }>();
  const roomLastActive = new Map<string, number>();
  // Replay authority: one nonce store per registry instance, consumed atomically
  // with successful ticket admission and evicted when the ticket expires. Kept
  // inside the registry so replay enforcement lives on the admission path.
  const signedTicketReplayGuard = new SignedTicketReplayGuard();

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
    signedTicketReplayGuard.clearExpired(now);
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

  function sendTo(
    roomId: string,
    to: string,
    from: string,
    peer: RoomPeer,
    message: unknown
  ): void {
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

  function checkOrigin(request?: {
    headers?: Record<string, string | string[] | undefined>;
  }): boolean {
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
    // Normalize the requested role to the exact ontology up front: a foreign or
    // malformed request must not flow into any branch below as a pseudo-role.
    // Least-privilege fallback: unknown requests resolve to `observer`.
    requestedRole = normalizeNetworkRole(requestedRole) ?? 'observer';

    if (tokenValidator && token) {
      const res = tokenValidator(token, roomId);
      if (!res.valid) {
        return {
          authorized: false,
          role: 'observer',
          closeCode: 4001,
          reason: res.error ?? 'invalid token',
        };
      }
      // The validator is an extension point, but its role output must still be
      // allow-listed: a validator that returns `analyst`, `collaborator`, or any
      // other value must fail closed rather than promote the peer.
      const role = normalizeNetworkRole(res.claims?.role) ?? normalizeNetworkRole(requestedRole);
      if (!role) {
        return {
          authorized: false,
          role: 'observer',
          closeCode: 4001,
          reason: 'invalid role in token claims',
        };
      }
      return { authorized: true, role };
    }

    if (authToken || observerAuthToken) {
      if (typeof token !== 'string') {
        return { authorized: false, role: 'observer', closeCode: 4001, reason: 'token required' };
      }

      // 1. Cryptographically signed canonical HMAC room ticket verification.
      //    The nonce is consumed atomically with successful admission by the
      //    per-registry replay guard; a replayed ticket is rejected here even
      //    though its signature, scope, and expiry all remain valid.
      if (authToken && token.includes('.')) {
        const res = verifySignedTicket(token, authToken, roomId);
        if (res.valid && res.claims) {
          const role = normalizeNetworkRole(res.claims.role);
          if (!role) {
            return {
              authorized: false,
              role: 'observer',
              closeCode: 4001,
              reason: 'invalid role in ticket',
            };
          }
          if (!signedTicketReplayGuard.consume(res.claims.nonce, res.claims.exp)) {
            return {
              authorized: false,
              role: 'observer',
              closeCode: 4001,
              reason: 'ticket replay detected (nonce already consumed)',
            };
          }
          return { authorized: true, role };
        }
        return {
          authorized: false,
          role: 'observer',
          closeCode: 4001,
          reason: res.error ?? 'invalid signed ticket',
        };
      }

      // 2. Observer dedicated secret token match
      if (observerAuthToken && timingSafeEqualString(token, observerAuthToken)) {
        return { authorized: true, role: 'observer' };
      }

      // 3. Scoped token string format: "secret:observer" or "secret:participant".
      //    Exact allow-list: only these two suffixes are accepted. Every other
      //    suffix (typo, casing variant, empty, extra segments, unknown role) is
      //    rejected — a typo must never promote to the privileged `participant`.
      if (authToken && token.includes(':')) {
        const idx = token.indexOf(':');
        const secretPart = token.slice(0, idx);
        const rolePart = token.slice(idx + 1);
        if (timingSafeEqualString(secretPart, authToken)) {
          const enforcedRole =
            rolePart === 'observer'
              ? 'observer'
              : rolePart === 'participant'
                ? 'participant'
                : null;
          if (enforcedRole) {
            return { authorized: true, role: enforcedRole };
          }
          return {
            authorized: false,
            role: 'observer',
            closeCode: 4001,
            reason: 'invalid scoped token role',
          };
        }
      }

      // 4. Standard participant shared secret
      if (authToken && timingSafeEqualString(token, authToken)) {
        return { authorized: true, role: requestedRole };
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
    request?: {
      headers?: Record<string, string | string[] | undefined>;
      socket?: { remoteAddress?: string };
    }
  ): void {
    const ip = request?.socket?.remoteAddress || '127.0.0.1';
    // Tracks whether the per-IP auth-failure throttle was already charged for
    // this connection, so a disconnect (or timeout) does not double-charge an
    // IP that was already rejected for a bad token.
    let authFailureRecorded = false;

    // Exact role ontology up front: a foreign requested role must never be stored
    // as a pseudo-role (it would silently become an empty-capability identity).
    // Least-privilege fallback: unknown requests resolve to `observer`.
    requestedRole = normalizeNetworkRole(requestedRole) ?? 'observer';

    // 0. Validate room and peer identifiers (charset + length). The network
    //    gateway validates independently of any other subsystem: identifiers
    //    are used as Map keys and embedded in relayed JSON, so reject anything
    //    outside a safe alphabet before admission.
    if (!isValidIdentifier(roomId)) {
      try {
        socket.close?.(4003, 'invalid room id');
      } catch (_) {
        /* ignore */
      }
      return;
    }
    if (!isValidIdentifier(peerId)) {
      try {
        socket.close?.(4003, 'invalid peer id');
      } catch (_) {
        /* ignore */
      }
      return;
    }

    // 1. Check IP auth-failure throttling
    if (getAuthFailureCount(ip) >= maxAuthFailures) {
      try {
        socket.close?.(1008, 'too many authentication failures');
      } catch (_) {
        /* ignore */
      }
      return;
    }

    // 2. Origin validation
    if (!checkOrigin(request)) {
      try {
        socket.close?.(4003, 'forbidden origin');
      } catch (_) {
        /* ignore */
      }
      return;
    }

    // 3. Global and IP connection limits. Unauthenticated (in-flight) peers
    //    count toward the server-wide ceiling so a flood of pending connections
    //    cannot bypass `maxTotalConnections` by never authenticating.
    if (getTotalPeers() + pendingPeers >= maxTotalConnections) {
      try {
        socket.close?.(1008, 'server connection limit exceeded');
      } catch (_) {
        /* ignore */
      }
      return;
    }

    const currentIpCount = ipConnectionCounts.get(ip) || 0;
    if (currentIpCount >= maxConnectionsPerIp) {
      try {
        socket.close?.(1008, 'ip connection limit exceeded');
      } catch (_) {
        /* ignore */
      }
      return;
    }

    // 4. Room admission check. Room creation is capped so a distributed flood of
    //    distinct room ids cannot grow the registry without bound; the cap applies
    //    only to NEW rooms (existing rooms keep admitting). Within a room, both
    //    the authenticated capacity and the pending (unauthenticated) capacity
    //    are enforced so pre-auth flood peers cannot occupy authenticated slots.
    if (!rooms.has(roomId)) {
      if (rooms.size >= maxRooms) {
        try {
          socket.close?.(1008, 'too many rooms');
        } catch (_) {
          /* ignore */
        }
        return;
      }
      rooms.set(roomId, new Map());
    }
    const room = rooms.get(roomId)!;
    if (room.size >= maxPeersPerRoom) {
      try {
        socket.close?.(1008, 'room full');
      } catch (_) {
        /* ignore */
      }
      return;
    }

    const needsToken = Boolean(authToken || observerAuthToken || !allowOpenNoToken);
    // A peer admitted with a URL token (when accepted) is not an in-flight
    // pending peer: it either authenticates immediately or is rejected at the
    // URL-token gate. Only peers that enter the room unauthenticated consume a
    // pending slot, so a legitimate authenticated peer is never displaced by a
    // pre-auth flood.
    const willJoinPending = needsToken && !(token && acceptUrlToken);
    if (willJoinPending) {
      let pendingInRoom = 0;
      for (const other of room.values()) {
        if (!other.authenticated) pendingInRoom++;
      }
      if (pendingInRoom >= maxPendingPeersPerRoom) {
        try {
          socket.close?.(1008, 'too many unauthenticated peers in room');
        } catch (_) {
          /* ignore */
        }
        return;
      }
    }

    if (room.has(peerId)) {
      try {
        socket.close?.(4002, 'peerId in use');
      } catch (_) {
        /* ignore */
      }
      return;
    }

    // Determine initial auth state. A token supplied via the URL query string
    // authenticates immediately — but only when `acceptUrlToken` is true
    // (Development / ResearchPreview). In Production, URL-supplied tokens are
    // ignored so credentials never appear in URLs or server logs; the peer
    // must authenticate via an in-band `auth` message within the auth-timeout
    // window.
    let initialAuth = false;
    let initialRole: NetworkRole = requestedRole;

    if (token && acceptUrlToken) {
      const authResult = authorizePeer(roomId, token, requestedRole);
      if (!authResult.authorized) {
        recordAuthFailure(ip);
        authFailureRecorded = true;
        try {
          socket.close?.(authResult.closeCode ?? 4001, authResult.reason ?? 'unauthorized');
        } catch (_) {
          /* ignore */
        }
        return;
      }
      initialAuth = true;
      initialRole = authResult.role;
    } else if (!needsToken) {
      initialAuth = true;
      initialRole = requestedRole;
    } else {
      // No URL token but token is required — admit as unauthenticated and allow
      // in-band authentication within authTimeoutMs. The peer cannot relay or
      // observe join/leave traffic until it authenticates (gated below and in
      // onMessage). IP / total connection limits above still bound the pending
      // connection pool against abuse.
      initialAuth = false;
      initialRole = requestedRole;
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
    if (!initialAuth) pendingPeers++;

    // If already authenticated on connect, announce join
    if (initialAuth) {
      for (const [id, other] of room) {
        if (id !== peerId && other.authenticated && other.socket.readyState === 1) {
          const data = JSON.stringify({
            roomId,
            from: peerId,
            data: { type: 'join', role: initialRole },
          });
          if (data.length <= maxMessageBytes) other.socket.send(data);
          socket.send(
            JSON.stringify({ roomId, from: id, data: { type: 'join', role: other.role } })
          );
        }
      }
    }

    // Auth timeout for unauthenticated sockets
    let authTimeout: ReturnType<typeof setTimeout> | null = null;
    if (!initialAuth) {
      authTimeout = setTimeout(() => {
        if (!peerEntry.authenticated) {
          recordAuthFailure(ip);
          authFailureRecorded = true;
          try {
            socket.close?.(4001, 'auth timeout');
          } catch (_) {
            /* ignore */
          }
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
        } catch (_) {
          /* ignore */
        }
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
            if (!peerEntry.authenticated) pendingPeers--;
            peerEntry.authenticated = true;
            peerEntry.role = authRes.role;
            peerEntry.capabilities = new Set(ROLE_CAPABILITIES[authRes.role]);
            if (authTimeout) clearTimeout(authTimeout);

            // Announce join to other authenticated peers
            for (const [id, other] of room) {
              if (id !== peerId && other.authenticated && other.socket.readyState === 1) {
                const data = JSON.stringify({
                  roomId,
                  from: peerId,
                  data: { type: 'join', role: authRes.role },
                });
                if (data.length <= maxMessageBytes) other.socket.send(data);
                socket.send(
                  JSON.stringify({ roomId, from: id, data: { type: 'join', role: other.role } })
                );
              }
            }
            return;
          }
          recordAuthFailure(ip);
          authFailureRecorded = true;
          try {
            socket.close?.(authRes.closeCode ?? 4001, authRes.reason ?? 'invalid token');
          } catch (_) {
            /* ignore */
          }
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
      // A peer that disconnected without ever authenticating is charged as an
      // auth failure so rapid reconnect-before-timeout triggers the per-IP
      // lockout instead of bypassing it by closing early.
      if (!peerEntry.authenticated) {
        pendingPeers--;
        if (!authFailureRecorded) recordAuthFailure(ip);
      }
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

  return {
    handleConnection,
    getRoomCount,
    getTotalPeers,
    cleanupIdleRooms,
    getAuthFailureCount,
    getSecurityDiagnostic: () => diagnostic,
  };
}

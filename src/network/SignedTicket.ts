/**
 * SERVER-ONLY MODULE. Do not import from browser-reachable application code.
 *
 * The canonical ticket authority depends on Node `crypto`. Browser-safe network
 * consumers must use `src/network/index.ts`; signalling/server code imports this
 * module through `src/network/server.ts`. Dependency-cruiser enforces that
 * boundary on every architecture check.
 *
 * Replay scope is deliberately per signalling-registry instance. A deployment
 * with multiple signalling replicas MUST use a shared nonce store before it can
 * claim replay protection across replicas. Sharing only the HMAC secret is not
 * sufficient.
 */
import * as crypto from 'node:crypto';

/**
 * Canonical Signed Room Ticket — signalling admission authority (Stream C / C1).
 *
 * This module is the SINGLE versioned, replay-safe, fail-closed ticket authority
 * for Nemosyne collaboration rooms. It subsumes and replaces the former
 * replay-permissive `SignedTicket.ts` schema AND the off-path WebCrypto
 * `SignedTicketVerifier.ts` duplicate:
 *
 * - One versioned schema: `version/room/role/issuedAt/exp/nonce`.
 * - One role ontology: exactly `observer` | `participant`. Any other role value
 *   (`analyst`, `collaborator`, typos, casing variants) is rejected.
 * - Replay protection: `nonce` is mandatory and is consumed atomically with a
 *   successful admission via {@link SignedTicketReplayGuard}. A captured ticket
 *   cannot be replayed within a registry instance before its expiry.
 * - One cryptographic mechanism: Node `crypto` HMAC-SHA256 (synchronous,
 *   coherent with the synchronous `authorizePeer` admission path). There is no
 *   silent WebCrypto fallback and no second verifier.
 *
 * Wire format (unchanged from the live path): `base64url(JSON claims) . hex(HMAC)`.
 * `SignallingServerCore.authorizePeer` detects tickets via `token.includes('.')`.
 */

export const SIGNED_TICKET_VERSION = 1 as const;
export type SignedTicketVersion = typeof SIGNED_TICKET_VERSION;

export const TICKET_ROLES = ['observer', 'participant'] as const;
export type TicketRole = (typeof TICKET_ROLES)[number];

export interface TicketClaims {
  version: SignedTicketVersion;
  room: string;
  role: TicketRole;
  /** Issuance timestamp in milliseconds. */
  issuedAt: number;
  /** Expiration timestamp in milliseconds. */
  exp: number;
  /** Mandatory unique nonce; consumed on successful admission (replay guard). */
  nonce: string;
  // Capabilities are derived server-side from `role` via ROLE_CAPABILITIES. A
  // ticket never carries an authoritative capabilities claim — foreign claims
  // are ignored by the server.
}

/** Discriminated failure kinds so callers can distinguish security outcomes. */
export type TicketErrorKind =
  | 'malformed'
  | 'unsupported_version'
  | 'invalid_role'
  | 'missing_nonce'
  | 'expired'
  | 'future_issued'
  | 'room_mismatch'
  | 'malformed_signature'
  | 'invalid_signature'
  | 'replay';

export interface TicketVerificationResult {
  valid: boolean;
  claims?: TicketClaims;
  error?: string;
  errorKind?: TicketErrorKind;
}

/** HMAC-SHA256 output length, in hex characters. */
const HMAC_SHA256_HEX_LEN = 64;
const HEX_RE = /^[0-9a-fA-F]{64}$/;
const FUTURE_ISSUE_SKEW_MS = 60_000;

/**
 * Constant-time comparison backed by Node's native crypto implementation.
 * The temporary buffers are acceptable on the admission path; do not move this
 * helper into per-message verification without first profiling allocation cost.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const aBytes = Buffer.from(a, 'utf8');
  const bBytes = Buffer.from(b, 'utf8');
  const length = Math.max(aBytes.length, bBytes.length);
  const paddedA = Buffer.alloc(length);
  const paddedB = Buffer.alloc(length);
  aBytes.copy(paddedA);
  bBytes.copy(paddedB);
  const equalBytes = crypto.timingSafeEqual(paddedA, paddedB);
  return equalBytes && aBytes.length === bBytes.length;
}

/** True when `value` is exactly `observer` or `participant`. */
function isValidTicketRole(value: unknown): value is TicketRole {
  return value === 'observer' || value === 'participant';
}

/**
 * Create a cryptographically signed, versioned HMAC-SHA256 room ticket.
 *
 * The creator stamps the canonical version, issuance time, and a unique nonce.
 * A caller may supply `issuedAt`/`nonce` for deterministic issuance, but a
 * ticket without a nonce cannot be created through this authority — nonce is
 * mandatory for replay-sensitive tickets.
 *
 * @throws {TypeError} when claims are not a well-formed canonical ticket
 * (unknown role, missing room, non-numeric exp).
 */
export function createSignedTicket(
  claims: { room: string; role: TicketRole; exp: number; issuedAt?: number; nonce?: string },
  secret: string
): string {
  if (!claims || typeof claims !== 'object') {
    throw new TypeError('createSignedTicket: claims object required');
  }
  if (typeof claims.room !== 'string' || claims.room.length === 0) {
    throw new TypeError('createSignedTicket: claims.room must be a non-empty string');
  }
  if (!isValidTicketRole(claims.role)) {
    throw new TypeError(
      `createSignedTicket: claims.role must be one of ${TICKET_ROLES.join(' | ')}; got ${String(claims.role)}`
    );
  }
  if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) {
    throw new TypeError('createSignedTicket: claims.exp must be a finite number (ms)');
  }

  const ticket: TicketClaims = {
    version: SIGNED_TICKET_VERSION,
    room: claims.room,
    role: claims.role,
    issuedAt: claims.issuedAt ?? Date.now(),
    exp: claims.exp,
    nonce: claims.nonce ?? crypto.randomBytes(16).toString('hex'),
  };

  const payloadStr = JSON.stringify(ticket);
  const payloadB64 = Buffer.from(payloadStr, 'utf8').toString('base64url');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadB64);
  return `${payloadB64}.${hmac.digest('hex')}`;
}

/**
 * Verify a canonical signed room ticket WITHOUT consuming its nonce.
 *
 * This is the stateless cryptographic/claims check. Replay enforcement happens
 * at admission time (see {@link SignedTicketReplayGuard}), because it requires
 * the per-registry nonce state owned by the admission authority. A ticket that
 * passes here is valid-but-unconsumed; it becomes admitted only when the
 * admission path also consumes its nonce.
 *
 * Rejects unsigned, malformed, unknown-version, nonce-less, unknown-role,
 * tampered, expired, future-issued, or room-mismatched tickets.
 */
export function verifySignedTicket(
  ticket: string,
  secret: string,
  expectedRoom?: string,
  now: number = Date.now()
): TicketVerificationResult {
  if (!ticket || typeof ticket !== 'string') {
    return { valid: false, errorKind: 'malformed', error: 'ticket missing or invalid' };
  }

  const parts = ticket.split('.');
  if (parts.length !== 2) {
    return {
      valid: false,
      errorKind: 'malformed',
      error: 'malformed ticket structure (signature missing)',
    };
  }

  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature) {
    return { valid: false, errorKind: 'malformed', error: 'invalid ticket components' };
  }

  // Validate signature shape before any cryptographic work. HMAC-SHA256 output
  // length is public, so rejecting wrong-length / non-hex signatures does not
  // leak a secret and avoids spending CPU on clearly-invalid inputs.
  if (!HEX_RE.test(signature)) {
    return {
      valid: false,
      errorKind: 'malformed_signature',
      error: `invalid HMAC signature shape: signature must be ${HMAC_SHA256_HEX_LEN} hex characters`,
    };
  }

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadB64);
  const expectedSig = hmac.digest('hex');

  if (!timingSafeEqualString(signature, expectedSig)) {
    return {
      valid: false,
      errorKind: 'invalid_signature',
      error: 'invalid ticket cryptographic signature',
    };
  }

  let parsed: unknown;
  try {
    const jsonStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    parsed = JSON.parse(jsonStr);
  } catch {
    return { valid: false, errorKind: 'malformed', error: 'corrupt ticket payload JSON' };
  }

  const schemaError = validateClaims(parsed);
  if (schemaError) return schemaError;

  const claims = parsed as TicketClaims;

  if (claims.version !== SIGNED_TICKET_VERSION) {
    return { valid: false, errorKind: 'unsupported_version', error: 'unsupported ticket version' };
  }

  if (now > claims.exp) {
    return { valid: false, errorKind: 'expired', error: 'ticket expired' };
  }

  if (now < claims.issuedAt - FUTURE_ISSUE_SKEW_MS) {
    return { valid: false, errorKind: 'future_issued', error: 'ticket issue timestamp is in the future' };
  }

  if (expectedRoom && claims.room !== expectedRoom) {
    return { valid: false, errorKind: 'room_mismatch', error: 'ticket room scope mismatch' };
  }

  return { valid: true, claims };
}

/** Structural/schema validation of the parsed payload. Returns a rejection, or null when valid. */
function validateClaims(value: unknown): TicketVerificationResult | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errorKind: 'malformed', error: 'corrupt ticket claims schema' };
  }
  const claims = value as Record<string, unknown>;
  if (typeof claims.version !== 'number') {
    return {
      valid: false,
      errorKind: 'malformed',
      error: 'corrupt ticket claims schema: version missing',
    };
  }
  if (typeof claims.room !== 'string' || claims.room.length === 0) {
    return {
      valid: false,
      errorKind: 'malformed',
      error: 'corrupt ticket claims schema: room missing',
    };
  }
  if (!isValidTicketRole(claims.role)) {
    return {
      valid: false,
      errorKind: 'invalid_role',
      error: 'invalid role in ticket',
    };
  }
  if (typeof claims.issuedAt !== 'number' || !Number.isFinite(claims.issuedAt)) {
    return {
      valid: false,
      errorKind: 'malformed',
      error: 'corrupt ticket claims schema: issuedAt missing',
    };
  }
  if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) {
    return {
      valid: false,
      errorKind: 'malformed',
      error: 'corrupt ticket claims schema: exp missing',
    };
  }
  if (typeof claims.nonce !== 'string' || claims.nonce.length === 0) {
    return { valid: false, errorKind: 'missing_nonce', error: 'ticket missing required nonce' };
  }
  return null;
}

/**
 * Per-registry replay guard. Consumes a nonce exactly once and evicts entries
 * once their ticket expiration has passed, bounding the replay window to the
 * ticket lifetime and bounding memory growth to active tickets.
 *
 * DEPLOYMENT BOUNDARY: this store is owned by one registry instance. Replay
 * protection therefore holds only within one running instance. Multiple
 * signalling replicas sharing an HMAC secret MUST also share nonce-consumption
 * state. Until a shared nonce store exists, a multi-replica deployment must be
 * recorded as replay-protection degraded rather than described as replay-safe.
 */
export class SignedTicketReplayGuard {
  private readonly _usedNonces = new Map<string, number>();

  constructor(private readonly _now: () => number = Date.now) {}

  /**
   * Mark a nonce as consumed. Returns true only on first use; false when the
   * nonce is empty or already consumed (replay).
   */
  consume(nonce: string, expiresAt: number): boolean {
    if (!nonce || this._usedNonces.has(nonce)) return false;
    this._usedNonces.set(nonce, expiresAt);
    return true;
  }

  /** Evict nonces whose ticket expiration timestamp has passed. */
  clearExpired(now: number = this._now()): void {
    for (const [nonce, expiresAt] of this._usedNonces.entries()) {
      if (now > expiresAt) {
        this._usedNonces.delete(nonce);
      }
    }
  }

  /** Active (unexpired, unconsumed-by-other) nonce count for inspection/telemetry. */
  get size(): number {
    return this._usedNonces.size;
  }
}

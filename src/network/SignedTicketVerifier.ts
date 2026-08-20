/**
 * Signed Ticket Verifier for WebRTC Collaboration Security.
 *
 * Implements standards-based HMAC-SHA256 authentication for participant tickets
 * with expiration, role validation, room pinning, and replay prevention.
 *
 * Security authority model:
 *   - Exactly one cryptographic implementation: Web Crypto SubtleCrypto HMAC-SHA256.
 *   - No FNV, CRC, ad hoc digest, or weak keyed hash fallback is permitted.
 *   - If Web Crypto is unavailable, authentication is explicitly unavailable and
 *     verification fails with a typed {@link CryptoCapabilityError}. This mirrors
 *     Nemosyne's `KernelUnavailable` principle: absence of a security-critical
 *     capability must never silently substitute a weaker mechanism.
 */

/** HMAC-SHA256 output length, in bytes. Signatures are validated against this. */
const HMAC_SHA256_BYTES = 32;
const HMAC_SHA256_HEX_LEN = HMAC_SHA256_BYTES * 2;
const HEX_RE = /^[0-9a-fA-F]*$/;

export interface SignedRoomTicket {
  version: 1;
  sessionId: string;
  participantId: string;
  role: 'analyst' | 'observer' | 'collaborator';
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  signatureHex: string;
}

/** Discriminated failure kinds so callers can distinguish security outcomes. */
export type TicketErrorKind =
  | 'unsupported_version'
  | 'session_mismatch'
  | 'expired'
  | 'future_issued'
  | 'replay'
  | 'malformed_signature'
  | 'invalid_signature'
  | 'capability_unavailable';

export interface TicketVerificationResult {
  valid: boolean;
  ticket?: SignedRoomTicket;
  error?: string;
  errorKind?: TicketErrorKind;
}

/**
 * Typed error raised when the Web Crypto HMAC-SHA256 capability is unavailable.
 * This is a *capability* failure, not an "invalid credentials" outcome, and must
 * never be interpreted as "authentication failed but proceed".
 */
export class CryptoCapabilityError extends Error {
  readonly errorKind = 'capability_unavailable' as const;
  constructor(message = 'Web Crypto HMAC-SHA256 capability unavailable') {
    super(message);
    this.name = 'CryptoCapabilityError';
  }
}

/**
 * Constant-time comparison over equal-length byte arrays. Callers MUST validate
 * lengths before relying on the result for a secret; HMAC output length is public
 * (always {@link HMAC_SHA256_BYTES}) so length divergence is returned directly.
 */
export function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Constant-time string comparison (legacy, retained for backward compatibility).
 * Prefer {@link timingSafeEqualBytes} for signature comparison over decoded bytes.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLen; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** Decode a hex string to a byte array. Returns null if the string is not valid hex. */
function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !HEX_RE.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

export class SignedTicketVerifier {
  private readonly _usedNonces = new Map<string, number>();

  /**
   * Produce the canonical signing payload string for a ticket. The signature is
   * computed over this exact string, so any field change invalidates it.
   */
  static canonicalPayload(ticket: Omit<SignedRoomTicket, 'signatureHex'>): string {
    return `${ticket.version}:${ticket.sessionId}:${ticket.participantId}:${ticket.role}:${ticket.issuedAt}:${ticket.expiresAt}:${ticket.nonce}`;
  }

  /**
   * Sign a ticket with HMAC-SHA256 via Web Crypto. Throws {@link CryptoCapabilityError}
   * if Web Crypto is unavailable — there is no fallback hash.
   */
  static async signTicket(
    ticketWithoutSig: Omit<SignedRoomTicket, 'signatureHex'>,
    secret: string
  ): Promise<SignedRoomTicket> {
    const payload = this.canonicalPayload(ticketWithoutSig);
    const signatureHex = await this._computeHmacSha256(payload, secret);
    return {
      ...ticketWithoutSig,
      signatureHex,
    };
  }

  /**
   * Verify an incoming signed ticket against the shared secret and session parameters.
   *
   * Failure kinds are distinguished via {@link TicketVerificationResult.errorKind}:
   *   - `unsupported_version`    malformed ticket / wrong version
   *   - `session_mismatch`       ticket scoped to a different room
   *   - `expired`                 ticket past expiresAt
   *   - `future_issued`           issuedAt unreasonably in the future
   *   - `replay`                  nonce already consumed
   *   - `malformed_signature`     signature missing, wrong length, or non-hex
   *   - `invalid_signature`       signature well-formed but cryptographically wrong
   *   - `capability_unavailable`   Web Crypto HMAC-SHA256 unavailable
   *
   * A `capability_unavailable` result is NEVER a "valid but continue" outcome.
   */
  async verifyTicket(
    ticket: SignedRoomTicket,
    secret: string,
    expectedSessionId: string,
    now: number = Date.now()
  ): Promise<TicketVerificationResult> {
    if (!ticket || ticket.version !== 1) {
      return { valid: false, errorKind: 'unsupported_version', error: 'Unsupported ticket format version' };
    }

    if (ticket.sessionId !== expectedSessionId) {
      return { valid: false, errorKind: 'session_mismatch', error: 'Ticket session ID does not match current room' };
    }

    if (now > ticket.expiresAt) {
      return { valid: false, errorKind: 'expired', error: 'Ticket has expired' };
    }

    if (now < ticket.issuedAt - 60_000) {
      return { valid: false, errorKind: 'future_issued', error: 'Ticket issue timestamp is in the future' };
    }

    if (this._usedNonces.has(ticket.nonce)) {
      return { valid: false, errorKind: 'replay', error: 'Ticket replay detected (nonce already consumed)' };
    }

    // Validate signature shape before any cryptographic work. HMAC-SHA256 output
    // length is public, so rejecting wrong-length / non-hex signatures does not
    // leak a secret and avoids spending CPU on clearly-invalid inputs.
    const sig = ticket.signatureHex;
    if (typeof sig !== 'string' || sig.length !== HMAC_SHA256_HEX_LEN || !HEX_RE.test(sig)) {
      return {
        valid: false,
        errorKind: 'malformed_signature',
        error: `Invalid HMAC cryptographic signature: signature must be ${HMAC_SHA256_HEX_LEN} hex characters`,
      };
    }

    const providedBytes = hexToBytes(sig);
    if (!providedBytes || providedBytes.length !== HMAC_SHA256_BYTES) {
      return {
        valid: false,
        errorKind: 'malformed_signature',
        error: 'Invalid HMAC cryptographic signature: signature could not be decoded',
      };
    }

    const payload = SignedTicketVerifier.canonicalPayload(ticket);
    let expectedHex: string;
    try {
      expectedHex = await SignedTicketVerifier._computeHmacSha256(payload, secret);
    } catch (err) {
      if (err instanceof CryptoCapabilityError) {
        return { valid: false, errorKind: 'capability_unavailable', error: err.message };
      }
      throw err;
    }

    const expectedBytes = hexToBytes(expectedHex);
    if (!expectedBytes || expectedBytes.length !== HMAC_SHA256_BYTES) {
      // Defensive: the computed HMAC must always be 32 bytes. Treat as capability failure.
      return { valid: false, errorKind: 'capability_unavailable', error: 'Invalid HMAC cryptographic signature: computed signature malformed' };
    }

    if (!timingSafeEqualBytes(providedBytes, expectedBytes)) {
      return { valid: false, errorKind: 'invalid_signature', error: 'Invalid HMAC cryptographic signature' };
    }

    // Mark nonce as consumed with its expiration timestamp. The secret is never
    // stored alongside the nonce and is never included in any telemetry/log output.
    this._usedNonces.set(ticket.nonce, ticket.expiresAt);
    return { valid: true, ticket };
  }

  /**
   * Compute HMAC-SHA256(payload, secret) as a lowercase hex string using Web Crypto.
   * Throws {@link CryptoCapabilityError} if SubtleCrypto is unavailable — there is
   * no non-cryptographic fallback.
   */
  private static async _computeHmacSha256(message: string, secret: string): Promise<string> {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle || typeof subtle.importKey !== 'function' || typeof subtle.sign !== 'function') {
      throw new CryptoCapabilityError();
    }
    const encoder = new TextEncoder();
    const key = await subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuf = await subtle.sign('HMAC', key, encoder.encode(message));
    const bytes = new Uint8Array(sigBuf);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  /**
   * Evict nonces whose ticket expiration timestamp has passed.
   */
  clearExpiredNonces(now: number = Date.now()): void {
    for (const [nonce, expiresAt] of this._usedNonces.entries()) {
      if (now > expiresAt) {
        this._usedNonces.delete(nonce);
      }
    }
  }

  /**
   * Get active nonce count for inspection/telemetry. Nonce values themselves are
   * not exposed here to avoid accidental logging of ticket material.
   */
  get activeNonceCount(): number {
    return this._usedNonces.size;
  }
}
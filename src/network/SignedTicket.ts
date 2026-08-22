import * as crypto from 'crypto';
import type { NetworkRole } from './SignallingServerCore.ts';

export interface TokenClaims {
  room: string;
  role: NetworkRole;
  exp: number; // Expiration timestamp in milliseconds
  nonce?: string;
  // Capabilities are derived server-side from `role`; a ticket does not carry
  // an authoritative capabilities claim (the server would ignore it anyway).
  [key: string]: unknown;
}

/** Constant-time comparison backed by Node's native crypto implementation. */
export function timingSafeEqualString(a: string, b: string): boolean {
  const aBytes = Buffer.from(a, 'utf8');
  const bBytes = Buffer.from(b, 'utf8');
  if (aBytes.length !== bBytes.length) return false;
  return crypto.timingSafeEqual(aBytes, bBytes);
}

/**
 * Create a cryptographically signed HMAC-SHA256 room ticket.
 */
export function createSignedTicket(claims: TokenClaims, secret: string): string {
  const payloadStr = JSON.stringify(claims);
  const payloadB64 = Buffer.from(payloadStr, 'utf8').toString('base64url');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadB64);
  const signature = hmac.digest('hex');
  return `${payloadB64}.${signature}`;
}

/**
 * Verify a cryptographically signed HMAC-SHA256 room ticket.
 * Rejects unsigned, tampered, expired, or room-mismatched tickets.
 */
export function verifySignedTicket(
  ticket: string,
  secret: string,
  expectedRoom?: string
): { valid: boolean; claims?: TokenClaims; error?: string } {
  if (!ticket || typeof ticket !== 'string') {
    return { valid: false, error: 'ticket missing or invalid' };
  }

  const parts = ticket.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'malformed ticket structure (signature missing)' };
  }

  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature) {
    return { valid: false, error: 'invalid ticket components' };
  }

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadB64);
  const expectedSig = hmac.digest('hex');

  if (!timingSafeEqualString(signature, expectedSig)) {
    return { valid: false, error: 'invalid ticket cryptographic signature' };
  }

  let claims: TokenClaims;
  try {
    const jsonStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    claims = JSON.parse(jsonStr);
  } catch {
    return { valid: false, error: 'corrupt ticket payload JSON' };
  }

  if (typeof claims.exp !== 'number' || Date.now() > claims.exp) {
    return { valid: false, error: 'ticket expired' };
  }

  if (expectedRoom && claims.room !== expectedRoom) {
    return { valid: false, error: 'ticket room scope mismatch' };
  }

  if (claims.role !== 'participant' && claims.role !== 'observer') {
    return { valid: false, error: 'invalid role in ticket' };
  }

  return { valid: true, claims };
}

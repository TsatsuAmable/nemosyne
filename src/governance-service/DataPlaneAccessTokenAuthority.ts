import { createHmac, createPublicKey, verify as verifySignature, type KeyObject } from 'node:crypto';

import {
  SqliteDataPlaneCredentialSessionStoreV1,
  type DataPlaneCredentialSessionStoreV1,
} from './DataPlaneCredentialSessionStore.ts';

const MAX_TOKEN_LIFETIME_SECONDS = 300;
const MAX_CLOCK_SKEW_SECONDS = 60;
const MAX_ISSUER_BYTES = 2048;
const MAX_SUBJECT_BYTES = 256;
const MAX_JTI_BYTES = 256;
const MAX_SCOPE_BYTES = 2048;
const CREDENTIAL_SESSION_DOMAIN = 'nemosyne:credential-session:v1\n';
const UTF8 = new TextEncoder();
const PRIVATE_JWK_FIELDS = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth'] as const;

export const DATA_PLANE_SCOPES = [
  'consent:read',
  'consent:write',
  'events:capture',
  'events:write',
  'events:export',
  'events:erase',
] as const;

export type DataPlaneScope = (typeof DATA_PLANE_SCOPES)[number];
export type DataPlaneJwsAlgorithm = 'RS256' | 'ES256' | 'EdDSA';

export interface DataPlaneAuthenticatedPrincipalV1 {
  readonly issuer: string;
  readonly subject: string;
  readonly tokenId: string;
  readonly scopes: ReadonlySet<DataPlaneScope>;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export interface DataPlaneJwkResolver {
  resolve(issuer: string, kid: string, algorithm: DataPlaneJwsAlgorithm): JsonWebKey | null;
}

export interface DataPlaneAccessTokenAuthorityOptions {
  readonly issuer: string;
  readonly audience: string;
  readonly allowedAlgorithms: readonly DataPlaneJwsAlgorithm[];
  readonly keyResolver: DataPlaneJwkResolver;
  readonly credentialSessionKey: Uint8Array;
  readonly credentialSessionStore?: DataPlaneCredentialSessionStoreV1;
  /** Compatibility-only. Production should inject the PostgreSQL session store. */
  readonly dataDirectory?: string;
  readonly now?: () => Date;
  readonly clockSkewSeconds?: number;
}

export type DataPlaneAuthErrorCode =
  | 'INVALID_AUTHORIZATION'
  | 'INVALID_TOKEN'
  | 'TOKEN_PROFILE_REFUSED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_NOT_YET_VALID'
  | 'UNKNOWN_KEY'
  | 'INVALID_SIGNATURE'
  | 'INSUFFICIENT_SCOPE'
  | 'CREDENTIAL_REVOKED'
  | 'AUTH_CONFIGURATION_INVALID';

export class DataPlaneAuthError extends Error {
  readonly code: DataPlaneAuthErrorCode;

  constructor(code: DataPlaneAuthErrorCode, message: string) {
    super(message);
    this.name = 'DataPlaneAuthError';
    this.code = code;
  }
}

interface JwtHeader {
  readonly typ: unknown;
  readonly alg: unknown;
  readonly kid: unknown;
}

interface JwtClaims {
  readonly iss: unknown;
  readonly sub: unknown;
  readonly aud: unknown;
  readonly exp: unknown;
  readonly iat: unknown;
  readonly jti: unknown;
  readonly scope: unknown;
}

function utf8Length(value: string): number {
  return UTF8.encode(value).byteLength;
}

function decodeBase64Url(segment: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) {
    throw new DataPlaneAuthError('INVALID_TOKEN', 'JWT segment is not canonical base64url text');
  }
  try {
    const decoded = Buffer.from(segment, 'base64url');
    if (decoded.toString('base64url') !== segment) throw new Error('non-canonical encoding');
    return decoded;
  } catch {
    throw new DataPlaneAuthError('INVALID_TOKEN', 'JWT segment cannot be decoded canonically');
  }
}

function parseJsonSegment<T>(segment: string, label: string): T {
  const bytes = decodeBase64Url(segment);
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new DataPlaneAuthError('INVALID_TOKEN', `${label} is not valid UTF-8`);
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not object');
    return parsed as T;
  } catch {
    throw new DataPlaneAuthError('INVALID_TOKEN', `${label} is not a JSON object`);
  }
}

function requireBoundedString(value: unknown, label: string, maxBytes: number): string {
  if (typeof value !== 'string' || value.length === 0 || utf8Length(value) > maxBytes) {
    throw new DataPlaneAuthError('TOKEN_PROFILE_REFUSED', `${label} must be a non-empty bounded string`);
  }
  return value;
}

function requireNumericDate(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new DataPlaneAuthError('TOKEN_PROFILE_REFUSED', `${label} must be a non-negative integer NumericDate`);
  }
  return value;
}

function assertHttpsIssuer(issuer: string): void {
  let url: URL;
  try { url = new URL(issuer); } catch { throw new DataPlaneAuthError('AUTH_CONFIGURATION_INVALID', 'issuer must be an absolute HTTPS URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new DataPlaneAuthError('AUTH_CONFIGURATION_INVALID', 'issuer must be an HTTPS authority without credentials or fragment');
  }
  if (utf8Length(issuer) > MAX_ISSUER_BYTES) throw new DataPlaneAuthError('AUTH_CONFIGURATION_INVALID', 'issuer exceeds the RFC 0004 bound');
}

function parseScopes(scopeClaim: unknown): ReadonlySet<DataPlaneScope> {
  const scope = requireBoundedString(scopeClaim, 'scope', MAX_SCOPE_BYTES);
  if (/\s{2,}|^\s|\s$/.test(scope)) throw new DataPlaneAuthError('TOKEN_PROFILE_REFUSED', 'scope must be single-space-delimited');
  const tokens = scope.split(' ');
  if (new Set(tokens).size !== tokens.length) throw new DataPlaneAuthError('TOKEN_PROFILE_REFUSED', 'scope contains duplicates');
  const allowed = new Set<string>(DATA_PLANE_SCOPES);
  for (const token of tokens) if (!allowed.has(token)) throw new DataPlaneAuthError('TOKEN_PROFILE_REFUSED', 'scope contains an unapproved data-plane scope');
  return new Set(tokens as DataPlaneScope[]);
}

function assertAudience(aud: unknown, expected: string): void {
  if (typeof aud === 'string') {
    if (aud !== expected) throw new DataPlaneAuthError('TOKEN_PROFILE_REFUSED', 'audience does not match');
    return;
  }
  if (Array.isArray(aud) && aud.length === 1 && aud[0] === expected) return;
  throw new DataPlaneAuthError('TOKEN_PROFILE_REFUSED', 'audience must contain exactly the configured audience');
}

function createVerificationKey(jwk: JsonWebKey): KeyObject {
  const record = jwk as Record<string, unknown>;
  if (PRIVATE_JWK_FIELDS.some((field) => field in record && record[field] !== undefined)) {
    throw new DataPlaneAuthError('UNKNOWN_KEY', 'private JWK material is not accepted');
  }
  try {
    return createPublicKey({ key: jwk, format: 'jwk' });
  } catch {
    throw new DataPlaneAuthError('UNKNOWN_KEY', 'JWK cannot be imported as a public verification key');
  }
}

function verifyJws(algorithm: DataPlaneJwsAlgorithm, key: KeyObject, signingInput: Uint8Array, signature: Uint8Array): boolean {
  try {
    if (algorithm === 'RS256') return verifySignature('RSA-SHA256', signingInput, key, signature);
    if (algorithm === 'ES256') return verifySignature('sha256', signingInput, { key, dsaEncoding: 'ieee-p1363' }, signature);
    return verifySignature(null, signingInput, key, signature);
  } catch { return false; }
}

function lengthFrame(values: readonly string[]): Buffer {
  const chunks: Buffer[] = [];
  for (const value of values) {
    const bytes = Buffer.from(value, 'utf8');
    const length = Buffer.allocUnsafe(4);
    length.writeUInt32BE(bytes.byteLength, 0);
    chunks.push(length, bytes);
  }
  return Buffer.concat(chunks);
}

export class DataPlaneAccessTokenAuthority {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly allowedAlgorithms: ReadonlySet<DataPlaneJwsAlgorithm>;
  private readonly keyResolver: DataPlaneJwkResolver;
  private readonly now: () => Date;
  private readonly clockSkewSeconds: number;
  private readonly credentialSessionKey: Uint8Array;
  private readonly credentialSessionStore: DataPlaneCredentialSessionStoreV1;

  constructor(options: DataPlaneAccessTokenAuthorityOptions) {
    assertHttpsIssuer(options.issuer);
    if (!options.audience || utf8Length(options.audience) > 256) throw new DataPlaneAuthError('AUTH_CONFIGURATION_INVALID', 'audience must be a non-empty bounded string');
    if (options.allowedAlgorithms.length === 0 || new Set(options.allowedAlgorithms).size !== options.allowedAlgorithms.length) throw new DataPlaneAuthError('AUTH_CONFIGURATION_INVALID', 'at least one unique asymmetric JWS algorithm is required');
    if (options.credentialSessionKey.byteLength < 32) throw new DataPlaneAuthError('AUTH_CONFIGURATION_INVALID', 'credential-session key must contain at least 256 bits');
    if (options.credentialSessionStore && options.dataDirectory) throw new DataPlaneAuthError('AUTH_CONFIGURATION_INVALID', 'configure exactly one credential-session persistence authority');
    if (!options.credentialSessionStore && !options.dataDirectory) throw new DataPlaneAuthError('AUTH_CONFIGURATION_INVALID', 'credential-session persistence authority is required');
    const skew = options.clockSkewSeconds ?? MAX_CLOCK_SKEW_SECONDS;
    if (!Number.isInteger(skew) || skew < 0 || skew > MAX_CLOCK_SKEW_SECONDS) throw new DataPlaneAuthError('AUTH_CONFIGURATION_INVALID', 'clock skew must be between 0 and 60 seconds');

    this.issuer = options.issuer;
    this.audience = options.audience;
    this.allowedAlgorithms = new Set(options.allowedAlgorithms);
    this.keyResolver = options.keyResolver;
    this.now = options.now ?? (() => new Date());
    this.clockSkewSeconds = skew;
    this.credentialSessionKey = options.credentialSessionKey;
    this.credentialSessionStore = options.credentialSessionStore ?? new SqliteDataPlaneCredentialSessionStoreV1(options.dataDirectory as string);
  }

  async close(): Promise<void> {
    await this.credentialSessionStore.close();
  }

  async authenticateBearer(authorizationHeader: string, requiredScope: DataPlaneScope): Promise<DataPlaneAuthenticatedPrincipalV1> {
    if (!authorizationHeader.startsWith('Bearer ') || authorizationHeader.length <= 7 || authorizationHeader.includes('\n')) throw new DataPlaneAuthError('INVALID_AUTHORIZATION', 'Authorization must contain one Bearer token');
    return this.authenticateToken(authorizationHeader.slice(7), requiredScope);
  }

  async authenticateToken(token: string, requiredScope: DataPlaneScope): Promise<DataPlaneAuthenticatedPrincipalV1> {
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some((part) => part.length === 0)) throw new DataPlaneAuthError('INVALID_TOKEN', 'access token must use compact JWS serialization');
    const [headerPart, payloadPart, signaturePart] = parts;
    const header = parseJsonSegment<JwtHeader>(headerPart, 'JWT header');
    const claims = parseJsonSegment<JwtClaims>(payloadPart, 'JWT claims');

    if (header.typ !== 'at+jwt') throw new DataPlaneAuthError('TOKEN_PROFILE_REFUSED', 'typ must be at+jwt');
    if (header.alg !== 'RS256' && header.alg !== 'ES256' && header.alg !== 'EdDSA') throw new DataPlaneAuthError('TOKEN_PROFILE_REFUSED', 'JWS algorithm is not in the RFC 0004 asymmetric set');
    if (!this.allowedAlgorithms.has(header.alg)) throw new DataPlaneAuthError('TOKEN_PROFILE_REFUSED', 'JWS algorithm is not enabled for this deployment');
    const kid = requireBoundedString(header.kid, 'kid', 256);
    const issuer = requireBoundedString(claims.iss, 'iss', MAX_ISSUER_BYTES);
    const subject = requireBoundedString(claims.sub, 'sub', MAX_SUBJECT_BYTES);
    const tokenId = requireBoundedString(claims.jti, 'jti', MAX_JTI_BYTES);
    if (issuer !== this.issuer) throw new DataPlaneAuthError('TOKEN_PROFILE_REFUSED', 'issuer does not match configured authority');
    assertAudience(claims.aud, this.audience);
    const issuedAt = requireNumericDate(claims.iat, 'iat');
    const expiresAt = requireNumericDate(claims.exp, 'exp');
    if (expiresAt <= issuedAt || expiresAt - issuedAt > MAX_TOKEN_LIFETIME_SECONDS) throw new DataPlaneAuthError('TOKEN_PROFILE_REFUSED', 'token lifetime must be positive and no more than five minutes');
    const nowSeconds = Math.floor(this.now().getTime() / 1000);
    if (!Number.isSafeInteger(nowSeconds)) throw new DataPlaneAuthError('AUTH_CONFIGURATION_INVALID', 'server clock is invalid');
    if (issuedAt - this.clockSkewSeconds > nowSeconds) throw new DataPlaneAuthError('TOKEN_NOT_YET_VALID', 'token issued-at time is in the future');
    if (expiresAt + this.clockSkewSeconds < nowSeconds) throw new DataPlaneAuthError('TOKEN_EXPIRED', 'access token has expired');
    const scopes = parseScopes(claims.scope);
    if (!scopes.has(requiredScope)) throw new DataPlaneAuthError('INSUFFICIENT_SCOPE', 'required endpoint scope is absent');

    const jwk = this.keyResolver.resolve(issuer, kid, header.alg);
    if (!jwk) throw new DataPlaneAuthError('UNKNOWN_KEY', 'verification key is unavailable');
    const key = createVerificationKey(jwk);
    const signingInput = Buffer.from(`${headerPart}.${payloadPart}`, 'ascii');
    const signature = decodeBase64Url(signaturePart);
    if (!verifyJws(header.alg, key, signingInput, signature)) throw new DataPlaneAuthError('INVALID_SIGNATURE', 'access-token signature is invalid');

    const sessionHandle = this.sessionHandle(issuer, subject, tokenId);
    const seenAt = this.now().toISOString();
    if (await this.credentialSessionStore.touch(sessionHandle, seenAt) === 'REVOKED') throw new DataPlaneAuthError('CREDENTIAL_REVOKED', 'credential session has been revoked');
    return Object.freeze({ issuer, subject, tokenId, scopes, issuedAt, expiresAt });
  }

  async revoke(principal: Pick<DataPlaneAuthenticatedPrincipalV1, 'issuer' | 'subject' | 'tokenId'>): Promise<void> {
    const sessionHandle = this.sessionHandle(principal.issuer, principal.subject, principal.tokenId);
    if (!(await this.credentialSessionStore.revoke(sessionHandle, this.now().toISOString()))) throw new DataPlaneAuthError('INVALID_TOKEN', 'credential session is not known to this service');
  }

  private sessionHandle(issuer: string, subject: string, tokenId: string): string {
    const hmac = createHmac('sha256', this.credentialSessionKey);
    hmac.update(CREDENTIAL_SESSION_DOMAIN, 'ascii');
    hmac.update(lengthFrame([issuer, subject, tokenId]));
    return `csv1_${hmac.digest('hex')}`;
  }
}

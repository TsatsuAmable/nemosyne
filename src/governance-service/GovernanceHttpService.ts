import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import {
  DataPlaneAccessTokenAuthority,
  DataPlaneAuthError,
  type DataPlaneAuthenticatedPrincipalV1,
  type DataPlaneJwsAlgorithm,
  type DataPlaneScope,
} from './DataPlaneAccessTokenAuthority.ts';
import { OidcJwksAuthority, OidcJwksError } from './OidcJwksAuthority.ts';
import { SqliteProductAnalyticsEventIngestion } from './ProductAnalyticsEventIngestion.ts';
import {
  ProductAnalyticsAuthorityError,
  SqliteProductAnalyticsConsentAuthority,
  type AuthenticatedPrincipalV1,
  type ProductAnalyticsCaptureAuthorizationRequestV1,
  type ProductAnalyticsGrantRequestV1,
  type ProductAnalyticsRevocationRequestV1,
} from './ProductAnalyticsConsentAuthority.ts';

const MAX_JSON_BODY_BYTES = 16 * 1024;
const MAX_EVENT_BATCH_BYTES = 2_000_000;
const MAX_EVENT_LINE_BYTES = 1_250_000;
const MAX_EVENT_LINES = 16;
const MAX_HEADER_BYTES = 16 * 1024;
const HEADER_TIMEOUT_MS = 5_000;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_CONNECTIONS = 128;
const MAX_AUTHENTICATED_IN_FLIGHT = 64;
const SOURCE_WINDOW_MS = 60_000;
const SOURCE_WINDOW_LIMIT = 30;
const PRINCIPAL_CAPTURE_WINDOW_LIMIT = 60;
const UTF8 = new TextDecoder('utf-8', { fatal: true });

export interface GovernanceHttpResponseV1 {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export interface GovernanceHttpRequestV1 {
  readonly method: string;
  readonly path: string;
  readonly origin: string | null;
  readonly authorizationValues: readonly string[];
  readonly contentType: string | null;
  readonly contentEncoding: string | null;
  readonly sourceId: string;
  readonly readBody: (maxBytes?: number) => Promise<Uint8Array>;
}

export interface GovernanceAuthenticatorV1 {
  authenticate(authorizationHeader: string, requiredScope: DataPlaneScope): Promise<DataPlaneAuthenticatedPrincipalV1>;
}

export interface GovernanceHttpServiceOptions {
  readonly allowedOrigins: readonly string[];
  readonly authenticator: GovernanceAuthenticatorV1;
  readonly consentAuthority: SqliteProductAnalyticsConsentAuthority;
  readonly eventIngestion?: SqliteProductAnalyticsEventIngestion;
  readonly now?: () => number;
  readonly requestId?: () => string;
}

interface RouteDefinition {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly scope: DataPlaneScope;
  readonly action: 'current' | 'grant' | 'revoke' | 'capture' | 'ingest';
}

const ROUTES: readonly RouteDefinition[] = [
  { method: 'GET', path: '/v1/governance/consents/product-analytics/current', scope: 'consent:read', action: 'current' },
  { method: 'POST', path: '/v1/governance/consents/product-analytics/grants', scope: 'consent:write', action: 'grant' },
  { method: 'POST', path: '/v1/governance/consents/product-analytics/revocations', scope: 'consent:write', action: 'revoke' },
  { method: 'POST', path: '/v1/governance/consents/product-analytics/capture-authorizations', scope: 'events:capture', action: 'capture' },
  { method: 'POST', path: '/v1/governed-events/batches', scope: 'events:write', action: 'ingest' },
] as const;

function jsonResponse(status: number, body: unknown, origin: string | null): GovernanceHttpResponseV1 {
  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  };
  if (origin) {
    headers['access-control-allow-origin'] = origin;
    headers.vary = 'Origin';
  }
  return Object.freeze({ status, headers: Object.freeze(headers), body: JSON.stringify(body) });
}

function errorResponse(status: number, code: string, origin: string | null): GovernanceHttpResponseV1 {
  return jsonResponse(status, Object.freeze({ schemaVersion: '1', code }), origin);
}

function normalizeOrigin(origin: string): string {
  const parsed = new URL(origin);
  if (parsed.username || parsed.password || parsed.hash || parsed.pathname !== '/' || parsed.search) {
    throw new Error('origin must be an exact scheme/host/port origin');
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new Error('non-local origins must use HTTPS');
  }
  return parsed.origin;
}

function decodeCanonicalBase64Url(segment: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new DataPlaneAuthError('INVALID_TOKEN', 'invalid JWT segment');
  const decoded = Buffer.from(segment, 'base64url');
  if (decoded.toString('base64url') !== segment) throw new DataPlaneAuthError('INVALID_TOKEN', 'non-canonical JWT segment');
  return decoded;
}

function peekVerificationKey(authorizationHeader: string): { kid: string; algorithm: DataPlaneJwsAlgorithm } {
  if (!authorizationHeader.startsWith('Bearer ') || authorizationHeader.length <= 7 || authorizationHeader.includes('\n')) {
    throw new DataPlaneAuthError('INVALID_AUTHORIZATION', 'Authorization must contain one Bearer token');
  }
  const token = authorizationHeader.slice(7);
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw new DataPlaneAuthError('INVALID_TOKEN', 'access token must use compact JWS serialization');
  }
  let header: unknown;
  try {
    header = JSON.parse(UTF8.decode(decodeCanonicalBase64Url(parts[0])));
  } catch (error) {
    if (error instanceof DataPlaneAuthError) throw error;
    throw new DataPlaneAuthError('INVALID_TOKEN', 'JWT header is invalid');
  }
  if (!header || typeof header !== 'object' || Array.isArray(header)) {
    throw new DataPlaneAuthError('INVALID_TOKEN', 'JWT header is not an object');
  }
  const record = header as Record<string, unknown>;
  const algorithm = record.alg;
  const kid = record.kid;
  if (algorithm !== 'RS256' && algorithm !== 'ES256' && algorithm !== 'EdDSA') {
    throw new DataPlaneAuthError('TOKEN_PROFILE_REFUSED', 'unsupported JWS algorithm');
  }
  if (typeof kid !== 'string' || kid.length === 0 || Buffer.byteLength(kid, 'utf8') > 256) {
    throw new DataPlaneAuthError('TOKEN_PROFILE_REFUSED', 'kid must be a bounded non-empty string');
  }
  return { kid, algorithm };
}

export function createOidcGovernanceAuthenticator(
  tokenAuthority: DataPlaneAccessTokenAuthority,
  jwksAuthority: OidcJwksAuthority
): GovernanceAuthenticatorV1 {
  return Object.freeze({
    async authenticate(authorizationHeader: string, requiredScope: DataPlaneScope) {
      const { kid, algorithm } = peekVerificationKey(authorizationHeader);
      await jwksAuthority.resolveForVerification(kid, algorithm);
      return tokenAuthority.authenticateBearer(authorizationHeader, requiredScope);
    },
  });
}

class FixedWindowLimiter {
  private readonly buckets = new Map<string, { startedAt: number; count: number }>();
  constructor(private readonly now: () => number) {}

  take(key: string, limit: number): boolean {
    const current = this.now();
    const existing = this.buckets.get(key);
    if (!existing || current - existing.startedAt >= SOURCE_WINDOW_MS) {
      this.buckets.set(key, { startedAt: current, count: 1 });
      return true;
    }
    if (existing.count >= limit) return false;
    existing.count += 1;
    return true;
  }
}

export class GovernanceHttpService {
  private readonly origins: ReadonlySet<string>;
  private readonly authenticator: GovernanceAuthenticatorV1;
  private readonly consentAuthority: SqliteProductAnalyticsConsentAuthority;
  private readonly eventIngestion: SqliteProductAnalyticsEventIngestion | null;
  private readonly limiter: FixedWindowLimiter;
  private readonly requestId: () => string;
  private authenticatedInFlight = 0;

  constructor(options: GovernanceHttpServiceOptions) {
    if (options.allowedOrigins.length === 0) throw new Error('at least one exact allowed origin is required');
    const origins = options.allowedOrigins.map(normalizeOrigin);
    if (new Set(origins).size !== origins.length) throw new Error('allowed origins must be unique');
    this.origins = new Set(origins);
    this.authenticator = options.authenticator;
    this.consentAuthority = options.consentAuthority;
    this.eventIngestion = options.eventIngestion ?? null;
    this.limiter = new FixedWindowLimiter(options.now ?? Date.now);
    this.requestId = options.requestId ?? randomUUID;
  }

  async dispatch(request: GovernanceHttpRequestV1): Promise<GovernanceHttpResponseV1> {
    const origin = this.authorizeOrigin(request.origin);
    if (request.method === 'OPTIONS') return this.preflight(request, origin);

    const route = ROUTES.find((candidate) => candidate.method === request.method && candidate.path === request.path);
    if (!route) return errorResponse(404, 'NOT_FOUND', origin);
    if (request.authorizationValues.length !== 1) {
      const allowed = this.limiter.take(`unauthenticated:${request.sourceId}`, SOURCE_WINDOW_LIMIT);
      return errorResponse(allowed ? 401 : 429, allowed ? 'AUTHENTICATION_REQUIRED' : 'RATE_LIMITED', origin);
    }
    if (this.authenticatedInFlight >= MAX_AUTHENTICATED_IN_FLIGHT) return errorResponse(429, 'BUSY', origin);

    this.authenticatedInFlight += 1;
    try {
      let authenticated: DataPlaneAuthenticatedPrincipalV1;
      try {
        authenticated = await this.authenticator.authenticate(request.authorizationValues[0], route.scope);
      } catch (error) {
        const allowed = this.limiter.take(`unauthenticated:${request.sourceId}`, SOURCE_WINDOW_LIMIT);
        if (!allowed) return errorResponse(429, 'RATE_LIMITED', origin);
        if (error instanceof DataPlaneAuthError || error instanceof OidcJwksError) {
          return errorResponse(error instanceof DataPlaneAuthError && error.code === 'INSUFFICIENT_SCOPE' ? 403 : 401, 'AUTHENTICATION_REFUSED', origin);
        }
        return errorResponse(503, 'AUTHORITY_UNAVAILABLE', origin);
      }

      const principal: AuthenticatedPrincipalV1 = Object.freeze({ issuer: authenticated.issuer, subject: authenticated.subject });
      if (route.action === 'ingest') return this.ingestBatch(request, principal, origin);
      if (route.action === 'capture' && !this.limiter.take(`capture:${authenticated.issuer}\n${authenticated.subject}`, PRINCIPAL_CAPTURE_WINDOW_LIMIT)) {
        return errorResponse(429, 'RATE_LIMITED', origin);
      }

      try {
        if (route.action === 'current') return jsonResponse(200, this.consentAuthority.getCurrent(principal), origin);
        if (request.contentEncoding !== null && request.contentEncoding !== 'identity') {
          return errorResponse(415, 'CONTENT_ENCODING_REFUSED', origin);
        }
        if (request.contentType?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
          return errorResponse(415, 'MEDIA_TYPE_REFUSED', origin);
        }
        const body = await this.readJson(request);
        if (route.action === 'grant') return jsonResponse(200, this.consentAuthority.grant(principal, body as ProductAnalyticsGrantRequestV1), origin);
        if (route.action === 'revoke') return jsonResponse(200, this.consentAuthority.revoke(principal, body as ProductAnalyticsRevocationRequestV1), origin);
        return jsonResponse(200, this.consentAuthority.authorizeCapture(principal, body as ProductAnalyticsCaptureAuthorizationRequestV1), origin);
      } catch (error) {
        if (error instanceof ProductAnalyticsAuthorityError) {
          const status = error.code === 'CONSENT_REVISION_CONFLICT' || error.code === 'ACTION_ID_CONFLICT' ? 409 : error.code === 'CONSENT_REQUIRED' ? 403 : 400;
          return errorResponse(status, error.code, origin);
        }
        if (error instanceof SyntaxError || error instanceof TypeError) return errorResponse(400, 'INVALID_REQUEST', origin);
        throw error;
      }
    } finally {
      this.authenticatedInFlight -= 1;
    }
  }

  private async ingestBatch(
    request: GovernanceHttpRequestV1,
    principal: AuthenticatedPrincipalV1,
    origin: string | null
  ): Promise<GovernanceHttpResponseV1> {
    if (!this.eventIngestion) return errorResponse(503, 'INGESTION_UNAVAILABLE', origin);
    if (request.contentEncoding !== null && request.contentEncoding !== 'identity') return errorResponse(415, 'CONTENT_ENCODING_REFUSED', origin);
    if (request.contentType?.split(';', 1)[0].trim().toLowerCase() !== 'application/x-ndjson') return errorResponse(415, 'MEDIA_TYPE_REFUSED', origin);

    let lines: readonly string[];
    try {
      lines = await this.frameNdjson(request);
    } catch (error) {
      return errorResponse(error instanceof TypeError && error.message === 'UTF8_REFUSED' ? 400 : 413, 'BATCH_FRAMING_REFUSED', origin);
    }

    const dispositions = [];
    for (let index = 0; index < lines.length; index += 1) {
      const disposition = await this.eventIngestion.ingestLine(principal, lines[index]);
      dispositions.push(Object.freeze({
        index,
        eventId: disposition.eventId,
        status: disposition.status,
        reasonCode: disposition.reasonCode,
      }));
    }
    const allAccepted = dispositions.every((item) => item.status === 'STORED' || item.status === 'EXACT_DUPLICATE');
    return jsonResponse(allAccepted ? 200 : 207, Object.freeze({
      schemaVersion: '1',
      requestId: `gerqv1_${this.requestId()}`,
      dispositions: Object.freeze(dispositions),
    }), origin);
  }

  private authorizeOrigin(origin: string | null): string | null {
    if (origin === null) return null;
    let normalized: string;
    try { normalized = normalizeOrigin(origin); } catch { throw new GovernanceTransportError(403, 'ORIGIN_REFUSED'); }
    if (!this.origins.has(normalized) || normalized !== origin) throw new GovernanceTransportError(403, 'ORIGIN_REFUSED');
    return normalized;
  }

  private preflight(request: GovernanceHttpRequestV1, origin: string | null): GovernanceHttpResponseV1 {
    if (!origin) return errorResponse(403, 'ORIGIN_REQUIRED', null);
    const routeExists = ROUTES.some((route) => route.path === request.path);
    if (!routeExists) return errorResponse(404, 'NOT_FOUND', origin);
    return Object.freeze({
      status: 204,
      headers: Object.freeze({
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'authorization, content-type',
        'access-control-max-age': '600',
        vary: 'Origin',
        'cache-control': 'no-store',
      }),
      body: '',
    });
  }

  private async readJson(request: GovernanceHttpRequestV1): Promise<unknown> {
    const bytes = await request.readBody(MAX_JSON_BODY_BYTES);
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_JSON_BODY_BYTES) throw new TypeError('request body size refused');
    let text: string;
    try { text = UTF8.decode(bytes); } catch { throw new TypeError('request body must be valid UTF-8'); }
    return JSON.parse(text) as unknown;
  }

  private async frameNdjson(request: GovernanceHttpRequestV1): Promise<readonly string[]> {
    const bytes = await request.readBody(MAX_EVENT_BATCH_BYTES);
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_EVENT_BATCH_BYTES) throw new TypeError('SIZE_REFUSED');
    let text: string;
    try { text = UTF8.decode(bytes); } catch { throw new TypeError('UTF8_REFUSED'); }
    const lines = text.split('\n').map((line) => line.endsWith('\r') ? line.slice(0, -1) : line).filter((line) => line.length > 0);
    if (lines.length === 0 || lines.length > MAX_EVENT_LINES) throw new TypeError('COUNT_REFUSED');
    if (lines.some((line) => Buffer.byteLength(line, 'utf8') > MAX_EVENT_LINE_BYTES)) throw new TypeError('SIZE_REFUSED');
    return Object.freeze(lines);
  }
}

class GovernanceTransportError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}

async function readIncomingBody(request: IncomingMessage, maxBytes = MAX_JSON_BODY_BYTES): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.byteLength;
    if (total > maxBytes) throw new TypeError('request body size refused');
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

function authorizationValues(request: IncomingMessage): string[] {
  const values: string[] = [];
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    if (request.rawHeaders[index]?.toLowerCase() === 'authorization') values.push(request.rawHeaders[index + 1] ?? '');
  }
  return values;
}

function writeResponse(response: ServerResponse, result: GovernanceHttpResponseV1): void {
  response.writeHead(result.status, result.headers);
  response.end(result.body);
}

export function createGovernanceHttpServer(service: GovernanceHttpService): Server {
  const server = createServer({ maxHeaderSize: MAX_HEADER_BYTES }, async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://governance.invalid');
      const result = await service.dispatch({
        method: request.method ?? '',
        path: url.pathname,
        origin: typeof request.headers.origin === 'string' ? request.headers.origin : null,
        authorizationValues: authorizationValues(request),
        contentType: typeof request.headers['content-type'] === 'string' ? request.headers['content-type'] : null,
        contentEncoding: typeof request.headers['content-encoding'] === 'string' ? request.headers['content-encoding'] : null,
        sourceId: request.socket.remoteAddress ?? 'unknown',
        readBody: (maxBytes) => readIncomingBody(request, maxBytes),
      });
      writeResponse(response, result);
      if (result.status >= 400 && !request.complete) request.resume();
    } catch (error) {
      if (error instanceof GovernanceTransportError) {
        writeResponse(response, errorResponse(error.status, error.code, null));
        if (!request.complete) request.resume();
        return;
      }
      writeResponse(response, errorResponse(500, 'INTERNAL_ERROR', null));
      if (!request.complete) request.resume();
    }
  });
  server.headersTimeout = HEADER_TIMEOUT_MS;
  server.requestTimeout = REQUEST_TIMEOUT_MS;
  server.maxConnections = MAX_CONNECTIONS;
  return server;
}

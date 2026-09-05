import type { DataPlaneAuthenticatedPrincipalV1, DataPlaneScope } from './DataPlaneAccessTokenAuthority.ts';
import {
  type GovernanceAuthenticatorV1,
  type GovernanceHttpRequestV1,
  type GovernanceHttpResponseV1,
} from './GovernanceHttpService.ts';
import {
  GestureLearningAuthorityError,
  type GestureLearningCaptureAuthorizationRequestV1,
  type GestureLearningErasureRequestV1,
  type GestureLearningExportRequestV1,
  type GestureLearningGrantRequestV1,
  type GestureLearningPurpose,
  type GestureLearningRevocationRequestV1,
  type SqliteGestureLearningGovernanceV1,
} from './GestureLearningGovernance.ts';
import { GOVERNED_PURPOSES } from '../governance/index.ts';
import type { AuthenticatedPrincipalV1 } from './ProductAnalyticsConsentAuthority.ts';

const MAX_JSON_BODY_BYTES = 16 * 1024;
const MAX_EVENT_BATCH_BYTES = 2_000_000;
const MAX_EVENT_LINE_BYTES = 1_250_000;
const MAX_EVENT_LINES = 16;
const UTF8 = new TextDecoder('utf-8', { fatal: true });

interface RouteDefinition {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly scope: DataPlaneScope;
  readonly purpose: GestureLearningPurpose | null;
  readonly action: 'current' | 'grant' | 'revoke' | 'capture' | 'ingest' | 'export' | 'erase';
}

const ROUTES: readonly RouteDefinition[] = [
  { method: 'GET', path: '/v1/governance/gesture-learning/derived/current', scope: 'consent:read', purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING, action: 'current' },
  { method: 'POST', path: '/v1/governance/gesture-learning/derived/grants', scope: 'consent:write', purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING, action: 'grant' },
  { method: 'POST', path: '/v1/governance/gesture-learning/derived/revocations', scope: 'consent:write', purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING, action: 'revoke' },
  { method: 'POST', path: '/v1/governance/gesture-learning/raw/current', scope: 'consent:read', purpose: GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH, action: 'current' },
  { method: 'POST', path: '/v1/governance/gesture-learning/raw/grants', scope: 'consent:write', purpose: GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH, action: 'grant' },
  { method: 'POST', path: '/v1/governance/gesture-learning/raw/revocations', scope: 'consent:write', purpose: GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH, action: 'revoke' },
  { method: 'POST', path: '/v1/governance/gesture-learning/capture-authorizations', scope: 'events:capture', purpose: null, action: 'capture' },
  { method: 'POST', path: '/v1/governed-events/gesture-learning/batches', scope: 'events:write', purpose: null, action: 'ingest' },
  { method: 'POST', path: '/v1/governed-exports/gesture-learning', scope: 'events:export', purpose: null, action: 'export' },
  { method: 'POST', path: '/v1/governed-erasure/gesture-learning', scope: 'events:erase', purpose: null, action: 'erase' },
] as const;

function responseHeaders(contentType: string, origin: string | null): Readonly<Record<string, string>> {
  const headers: Record<string, string> = {
    'content-type': contentType,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  };
  if (origin) {
    headers['access-control-allow-origin'] = origin;
    headers.vary = 'Origin';
  }
  return Object.freeze(headers);
}

function jsonResponse(status: number, body: unknown, origin: string | null): GovernanceHttpResponseV1 {
  return Object.freeze({ status, headers: responseHeaders('application/json; charset=utf-8', origin), body: JSON.stringify(body) });
}

function ndjsonResponse(status: number, body: string, origin: string | null): GovernanceHttpResponseV1 {
  return Object.freeze({ status, headers: responseHeaders('application/x-ndjson; charset=utf-8', origin), body });
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

function principalFromAuthenticated(value: DataPlaneAuthenticatedPrincipalV1): AuthenticatedPrincipalV1 {
  return Object.freeze({ issuer: value.issuer, subject: value.subject });
}

export interface GestureLearningHttpServiceOptionsV1 {
  readonly allowedOrigins: readonly string[];
  readonly authenticator: GovernanceAuthenticatorV1;
  readonly governance: SqliteGestureLearningGovernanceV1;
}

export class GestureLearningHttpServiceV1 {
  private readonly origins: ReadonlySet<string>;
  private readonly authenticator: GovernanceAuthenticatorV1;
  private readonly governance: SqliteGestureLearningGovernanceV1;

  constructor(options: GestureLearningHttpServiceOptionsV1) {
    if (options.allowedOrigins.length === 0) throw new Error('at least one exact allowed origin is required');
    const normalized = options.allowedOrigins.map(normalizeOrigin);
    if (new Set(normalized).size !== normalized.length) throw new Error('allowed origins must be unique');
    this.origins = new Set(normalized);
    this.authenticator = options.authenticator;
    this.governance = options.governance;
  }

  handles(path: string): boolean {
    return ROUTES.some((route) => route.path === path);
  }

  async dispatch(request: GovernanceHttpRequestV1): Promise<GovernanceHttpResponseV1> {
    const origin = this.authorizeOrigin(request.origin);
    const route = ROUTES.find((candidate) => candidate.method === request.method && candidate.path === request.path);
    if (!route) return errorResponse(404, 'NOT_FOUND', origin);
    if (request.authorizationValues.length !== 1) return errorResponse(401, 'AUTHENTICATION_REQUIRED', origin);

    let authenticated: DataPlaneAuthenticatedPrincipalV1;
    try {
      authenticated = await this.authenticator.authenticate(request.authorizationValues[0], route.scope);
    } catch {
      return errorResponse(401, 'AUTHENTICATION_REFUSED', origin);
    }
    const principal = principalFromAuthenticated(authenticated);

    try {
      if (route.action === 'current') {
        return jsonResponse(200, this.governance.getCurrent(principal, route.purpose!), origin);
      }
      if (route.action === 'ingest') return this.ingestBatch(request, principal, origin);
      if (request.contentEncoding !== null && request.contentEncoding !== 'identity') return errorResponse(415, 'CONTENT_ENCODING_REFUSED', origin);
      if (request.contentType?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') return errorResponse(415, 'MEDIA_TYPE_REFUSED', origin);
      const body = await this.readJson(request);
      if (route.action === 'grant') {
        const grant = body as GestureLearningGrantRequestV1;
        if (grant.purpose !== route.purpose) return errorResponse(400, 'PURPOSE_ROUTE_MISMATCH', origin);
        return jsonResponse(200, this.governance.grant(principal, grant), origin);
      }
      if (route.action === 'revoke') {
        const revoke = body as GestureLearningRevocationRequestV1;
        if (revoke.purpose !== route.purpose) return errorResponse(400, 'PURPOSE_ROUTE_MISMATCH', origin);
        return jsonResponse(200, this.governance.revoke(principal, revoke), origin);
      }
      if (route.action === 'capture') {
        return jsonResponse(200, this.governance.authorizeCapture(principal, body as GestureLearningCaptureAuthorizationRequestV1), origin);
      }
      if (route.action === 'export') {
        const exported = this.governance.exportRecords(principal, body as GestureLearningExportRequestV1);
        return ndjsonResponse(200, exported.body, origin);
      }
      return jsonResponse(200, this.governance.erase(principal, body as GestureLearningErasureRequestV1), origin);
    } catch (error) {
      if (error instanceof GestureLearningAuthorityError) {
        const status = error.code === 'CONSENT_REVISION_CONFLICT' || error.code === 'ACTION_ID_CONFLICT'
          ? 409
          : error.code === 'CONSENT_REQUIRED' || error.code === 'PROTOCOL_REQUIRED'
            ? 403
            : error.code === 'EXPORT_LIMIT_REFUSED'
              ? 413
              : error.code === 'LIFECYCLE_UNHEALTHY'
                ? 503
                : 400;
        return errorResponse(status, error.code, origin);
      }
      if (error instanceof SyntaxError || error instanceof TypeError) return errorResponse(400, 'INVALID_REQUEST', origin);
      return errorResponse(500, 'INTERNAL_ERROR', origin);
    }
  }

  private authorizeOrigin(origin: string | null): string | null {
    if (origin === null) return null;
    let normalized: string;
    try { normalized = normalizeOrigin(origin); } catch { throw new TypeError('origin refused'); }
    if (!this.origins.has(normalized)) throw new TypeError('origin refused');
    return normalized;
  }

  private async readJson(request: GovernanceHttpRequestV1): Promise<unknown> {
    const bytes = await request.readBody(MAX_JSON_BODY_BYTES);
    if (bytes.byteLength > MAX_JSON_BODY_BYTES) throw new TypeError('request body too large');
    const text = UTF8.decode(bytes);
    return JSON.parse(text);
  }

  private async ingestBatch(
    request: GovernanceHttpRequestV1,
    principal: AuthenticatedPrincipalV1,
    origin: string | null,
  ): Promise<GovernanceHttpResponseV1> {
    if (request.contentEncoding !== null && request.contentEncoding !== 'identity') return errorResponse(415, 'CONTENT_ENCODING_REFUSED', origin);
    const mediaType = request.contentType?.split(';', 1)[0].trim().toLowerCase();
    if (mediaType !== 'application/x-ndjson') return errorResponse(415, 'MEDIA_TYPE_REFUSED', origin);
    this.governance.assertReadyForIngestion();
    const bytes = await request.readBody(MAX_EVENT_BATCH_BYTES);
    if (bytes.byteLength > MAX_EVENT_BATCH_BYTES) return errorResponse(413, 'BATCH_TOO_LARGE', origin);
    let text: string;
    try { text = UTF8.decode(bytes); } catch { return errorResponse(400, 'INVALID_UTF8', origin); }
    const lines = text.split('\n').filter((line) => line.length > 0);
    if (lines.length < 1 || lines.length > MAX_EVENT_LINES || lines.some((line) => Buffer.byteLength(line, 'utf8') > MAX_EVENT_LINE_BYTES)) {
      return errorResponse(413, 'BATCH_LIMIT_REFUSED', origin);
    }
    const dispositions = [];
    for (const line of lines) dispositions.push(await this.governance.ingestLine(principal, line));
    return jsonResponse(200, Object.freeze({ schemaVersion: '1', dispositions }), origin);
  }
}

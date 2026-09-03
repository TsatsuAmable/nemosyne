import type { DataPlaneJwkResolver, DataPlaneJwsAlgorithm } from './DataPlaneAccessTokenAuthority.ts';

const MAX_DOCUMENT_BYTES = 256 * 1024;
const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_CACHE_AGE_MS = 60 * 60 * 1000;
const MAX_JWKS_KEYS = 64;
const UTF8 = new TextDecoder('utf-8', { fatal: true });
const PRIVATE_JWK_FIELDS = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth'] as const;
const SUPPORTED_JWK_ALGORITHMS = new Set<DataPlaneJwsAlgorithm>(['RS256', 'ES256', 'EdDSA']);

type JwkRecord = JsonWebKey & Record<string, unknown>;

export type OidcJwksErrorCode =
  | 'JWKS_CONFIGURATION_INVALID'
  | 'DISCOVERY_UNAVAILABLE'
  | 'DISCOVERY_REFUSED'
  | 'JWKS_UNAVAILABLE'
  | 'JWKS_REFUSED'
  | 'UNKNOWN_KEY';

export class OidcJwksError extends Error {
  readonly code: OidcJwksErrorCode;

  constructor(code: OidcJwksErrorCode, message: string) {
    super(message);
    this.name = 'OidcJwksError';
    this.code = code;
  }
}

export interface OidcJwksAuthorityOptions {
  readonly issuer: string;
  readonly fetcher?: typeof fetch;
  readonly now?: () => number;
  readonly timeoutMs?: number;
  readonly cacheMaxAgeMs?: number;
}

interface DiscoveryDocument {
  readonly issuer?: unknown;
  readonly jwks_uri?: unknown;
}

interface JwksDocument {
  readonly keys?: unknown;
}

interface CachedJwks {
  readonly fetchedAt: number;
  readonly keys: ReadonlyMap<string, JsonWebKey>;
}

function parseHttpsUrl(value: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new OidcJwksError('JWKS_CONFIGURATION_INVALID', `${label} must be an absolute HTTPS URL`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new OidcJwksError('JWKS_CONFIGURATION_INVALID', `${label} must be HTTPS without credentials or fragment`);
  }
  return url;
}

function discoveryUrlForIssuer(issuer: string): string {
  const url = parseHttpsUrl(issuer, 'issuer');
  const path = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
  url.pathname = `${path}/.well-known/openid-configuration`;
  url.search = '';
  return url.toString();
}

function validateJwksUri(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new OidcJwksError('DISCOVERY_REFUSED', 'discovery jwks_uri must be a non-empty string');
  }
  try {
    return parseHttpsUrl(value, 'jwks_uri').toString();
  } catch (error) {
    if (error instanceof OidcJwksError) {
      throw new OidcJwksError('DISCOVERY_REFUSED', error.message);
    }
    throw error;
  }
}

function hasPrivateMaterial(jwk: JsonWebKey): boolean {
  const record = jwk as JwkRecord;
  return PRIVATE_JWK_FIELDS.some((field) => record[field] !== undefined);
}

function jwkKid(jwk: JsonWebKey): string | null {
  const kid = (jwk as JwkRecord).kid;
  return typeof kid === 'string' && kid.length > 0 && kid.length <= 256 ? kid : null;
}

function isSupportedPublicSigningJwk(jwk: JsonWebKey): boolean {
  if (!jwkKid(jwk)) return false;
  if (hasPrivateMaterial(jwk)) return false;
  if (jwk.use !== undefined && jwk.use !== 'sig') return false;
  if (jwk.key_ops !== undefined && (!Array.isArray(jwk.key_ops) || !jwk.key_ops.includes('verify'))) return false;
  if (jwk.alg !== undefined && !SUPPORTED_JWK_ALGORITHMS.has(jwk.alg as DataPlaneJwsAlgorithm)) return false;
  if (jwk.kty === 'RSA') return typeof jwk.n === 'string' && typeof jwk.e === 'string';
  if (jwk.kty === 'EC') return jwk.crv === 'P-256' && typeof jwk.x === 'string' && typeof jwk.y === 'string';
  if (jwk.kty === 'OKP') return jwk.crv === 'Ed25519' && typeof jwk.x === 'string';
  return false;
}

function isPublicVerificationJwk(jwk: JsonWebKey, algorithm: DataPlaneJwsAlgorithm): boolean {
  if (!isSupportedPublicSigningJwk(jwk)) return false;
  if (jwk.alg !== undefined && jwk.alg !== algorithm) return false;
  if (algorithm === 'RS256') return jwk.kty === 'RSA';
  if (algorithm === 'ES256') return jwk.kty === 'EC' && jwk.crv === 'P-256';
  return jwk.kty === 'OKP' && jwk.crv === 'Ed25519';
}

export class OidcJwksAuthority implements DataPlaneJwkResolver {
  private readonly issuer: string;
  private readonly discoveryUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private readonly cacheMaxAgeMs: number;
  private cache: CachedJwks | null = null;

  constructor(options: OidcJwksAuthorityOptions) {
    parseHttpsUrl(options.issuer, 'issuer');
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const cacheMaxAgeMs = options.cacheMaxAgeMs ?? MAX_CACHE_AGE_MS;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > DEFAULT_TIMEOUT_MS) {
      throw new OidcJwksError('JWKS_CONFIGURATION_INVALID', 'JWKS timeout must be between 1 and 5000 ms');
    }
    if (!Number.isInteger(cacheMaxAgeMs) || cacheMaxAgeMs < 1 || cacheMaxAgeMs > MAX_CACHE_AGE_MS) {
      throw new OidcJwksError('JWKS_CONFIGURATION_INVALID', 'JWKS cache age must be between 1 ms and one hour');
    }
    this.issuer = options.issuer;
    this.discoveryUrl = discoveryUrlForIssuer(options.issuer);
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? Date.now;
    this.timeoutMs = timeoutMs;
    this.cacheMaxAgeMs = cacheMaxAgeMs;
  }

  resolve(issuer: string, kid: string, algorithm: DataPlaneJwsAlgorithm): JsonWebKey | null {
    if (issuer !== this.issuer || !this.cache || !this.isFresh(this.cache)) return null;
    const key = this.cache.keys.get(kid);
    return key && isPublicVerificationJwk(key, algorithm) ? key : null;
  }

  async resolveForVerification(kid: string, algorithm: DataPlaneJwsAlgorithm): Promise<JsonWebKey> {
    if (!this.cache || !this.isFresh(this.cache)) {
      await this.refresh();
    }
    let key = this.resolve(this.issuer, kid, algorithm);
    if (key) return key;

    await this.refresh();
    key = this.resolve(this.issuer, kid, algorithm);
    if (!key) throw new OidcJwksError('UNKNOWN_KEY', 'kid is unavailable after one forced JWKS refresh');
    return key;
  }

  async refresh(): Promise<void> {
    const discovery = await this.fetchJson<DiscoveryDocument>(this.discoveryUrl, 'DISCOVERY_UNAVAILABLE');
    if (discovery.issuer !== this.issuer) {
      throw new OidcJwksError('DISCOVERY_REFUSED', 'discovery issuer does not exactly match configured issuer');
    }
    const jwksUri = validateJwksUri(discovery.jwks_uri);
    const jwks = await this.fetchJson<JwksDocument>(jwksUri, 'JWKS_UNAVAILABLE');
    if (!Array.isArray(jwks.keys) || jwks.keys.length === 0 || jwks.keys.length > MAX_JWKS_KEYS) {
      throw new OidcJwksError('JWKS_REFUSED', 'JWKS keys must be a non-empty bounded array');
    }

    const keys = new Map<string, JsonWebKey>();
    for (const candidate of jwks.keys) {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        throw new OidcJwksError('JWKS_REFUSED', 'every JWKS key must be an object');
      }
      const jwk = candidate as JsonWebKey;
      const kid = jwkKid(jwk);
      if (!kid || !isSupportedPublicSigningJwk(jwk)) {
        throw new OidcJwksError('JWKS_REFUSED', 'JWKS contains private, non-signing or unsupported key material');
      }
      if (keys.has(kid)) {
        throw new OidcJwksError('JWKS_REFUSED', 'duplicate JWKS kid is ambiguous');
      }
      keys.set(kid, Object.freeze({ ...jwk }));
    }

    this.cache = Object.freeze({ fetchedAt: this.now(), keys });
  }

  private isFresh(cache: CachedJwks): boolean {
    const age = this.now() - cache.fetchedAt;
    return age >= 0 && age <= this.cacheMaxAgeMs;
  }

  private async fetchJson<T>(url: string, unavailableCode: 'DISCOVERY_UNAVAILABLE' | 'JWKS_UNAVAILABLE'): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(url, {
        method: 'GET',
        redirect: 'manual',
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        throw new OidcJwksError(unavailableCode, 'redirects are refused for OIDC/JWKS authority fetches');
      }
      if (!response.ok) {
        throw new OidcJwksError(unavailableCode, `authority fetch returned HTTP ${response.status}`);
      }
      const contentLength = response.headers.get('content-length');
      if (contentLength !== null) {
        const parsedLength = Number(contentLength);
        if (!Number.isSafeInteger(parsedLength) || parsedLength < 0 || parsedLength > MAX_DOCUMENT_BYTES) {
          throw new OidcJwksError(unavailableCode, 'authority response exceeds the 256 KiB bound');
        }
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_DOCUMENT_BYTES) {
        throw new OidcJwksError(unavailableCode, 'authority response exceeds the 256 KiB bound');
      }
      let text: string;
      try {
        text = UTF8.decode(bytes);
      } catch {
        throw new OidcJwksError(unavailableCode, 'authority response is not valid UTF-8');
      }
      try {
        const parsed = JSON.parse(text) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not object');
        return parsed as T;
      } catch {
        throw new OidcJwksError(unavailableCode, 'authority response is not a JSON object');
      }
    } catch (error) {
      if (error instanceof OidcJwksError) throw error;
      throw new OidcJwksError(unavailableCode, 'authority fetch failed or timed out');
    } finally {
      clearTimeout(timer);
    }
  }
}

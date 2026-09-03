import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { OidcJwksAuthority, OidcJwksError } from '../src/governance-service/OidcJwksAuthority.ts';

const ISSUER = 'https://identity.example.test/tenant';
const DISCOVERY = `${ISSUER}/.well-known/openid-configuration`;
const JWKS_URI = 'https://keys.example.test/jwks';
const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const RSA_JWK = { ...publicKey.export({ format: 'jwk' }), kid: 'rsa-1', alg: 'RS256', use: 'sig' };

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json', ...init.headers },
    ...init,
  });
}

function expectCode(work: () => Promise<unknown>, code: string): Promise<void> {
  return expect(work()).rejects.toMatchObject({ name: 'OidcJwksError', code });
}

describe('PT4B4 OIDC metadata and JWKS authority', () => {
  it('discovers and resolves a compatible public key, then reuses a fresh cache', async () => {
    const requests: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      const url = String(input);
      requests.push(url);
      if (url === DISCOVERY) return jsonResponse({ issuer: ISSUER, jwks_uri: JWKS_URI });
      if (url === JWKS_URI) return jsonResponse({ keys: [RSA_JWK] });
      return new Response(null, { status: 404 });
    };
    const authority = new OidcJwksAuthority({ issuer: ISSUER, fetcher, now: () => 1000 });
    const key = await authority.resolveForVerification('rsa-1', 'RS256');
    expect(key.kid).toBe('rsa-1');
    expect(authority.resolve(ISSUER, 'rsa-1', 'RS256')?.kid).toBe('rsa-1');
    expect(await authority.resolveForVerification('rsa-1', 'RS256')).toBe(key);
    expect(requests).toEqual([DISCOVERY, JWKS_URI]);
  });

  it('refuses insecure configuration, issuer mismatch, redirects and unsafe jwks_uri values', async () => {
    expect(() => new OidcJwksAuthority({ issuer: 'http://identity.example.test' })).toThrow(OidcJwksError);

    const mismatch = new OidcJwksAuthority({
      issuer: ISSUER,
      fetcher: async () => jsonResponse({ issuer: 'https://other.example.test', jwks_uri: JWKS_URI }),
    });
    await expectCode(() => mismatch.refresh(), 'DISCOVERY_REFUSED');

    const redirect = new OidcJwksAuthority({
      issuer: ISSUER,
      fetcher: async () => new Response(null, { status: 302, headers: { location: 'https://other.example.test' } }),
    });
    await expectCode(() => redirect.refresh(), 'DISCOVERY_UNAVAILABLE');

    const unsafe = new OidcJwksAuthority({
      issuer: ISSUER,
      fetcher: async () => jsonResponse({ issuer: ISSUER, jwks_uri: 'http://keys.example.test/jwks' }),
    });
    await expectCode(() => unsafe.refresh(), 'DISCOVERY_REFUSED');
  });

  it('bounds metadata and JWKS documents before accepting them', async () => {
    const oversizedMetadata = new OidcJwksAuthority({
      issuer: ISSUER,
      fetcher: async () => new Response('{}', { status: 200, headers: { 'content-length': String(256 * 1024 + 1) } }),
    });
    await expectCode(() => oversizedMetadata.refresh(), 'DISCOVERY_UNAVAILABLE');

    const oversizedJwks = new OidcJwksAuthority({
      issuer: ISSUER,
      fetcher: async (input) => {
        if (String(input) === DISCOVERY) return jsonResponse({ issuer: ISSUER, jwks_uri: JWKS_URI });
        return new Response('x'.repeat(256 * 1024 + 1), { status: 200 });
      },
    });
    await expectCode(() => oversizedJwks.refresh(), 'JWKS_UNAVAILABLE');
  });

  it('refuses malformed, duplicate, private and algorithm-confused key sets', async () => {
    const cases: unknown[] = [
      { keys: [] },
      { keys: [{ ...RSA_JWK }, { ...RSA_JWK }] },
      { keys: [{ ...RSA_JWK, d: 'private-material' }] },
    ];
    for (const jwks of cases) {
      const authority = new OidcJwksAuthority({
        issuer: ISSUER,
        fetcher: async (input) =>
          String(input) === DISCOVERY
            ? jsonResponse({ issuer: ISSUER, jwks_uri: JWKS_URI })
            : jsonResponse(jwks),
      });
      await expectCode(() => authority.refresh(), 'JWKS_REFUSED');
    }

    const authority = new OidcJwksAuthority({
      issuer: ISSUER,
      fetcher: async (input) =>
        String(input) === DISCOVERY
          ? jsonResponse({ issuer: ISSUER, jwks_uri: JWKS_URI })
          : jsonResponse({ keys: [RSA_JWK] }),
    });
    await authority.refresh();
    await expectCode(() => authority.resolveForVerification('rsa-1', 'ES256'), 'UNKNOWN_KEY');
  });

  it('refreshes exactly once for an unknown kid and refuses if it remains absent', async () => {
    let metadataFetches = 0;
    let jwksFetches = 0;
    const authority = new OidcJwksAuthority({
      issuer: ISSUER,
      fetcher: async (input) => {
        if (String(input) === DISCOVERY) {
          metadataFetches += 1;
          return jsonResponse({ issuer: ISSUER, jwks_uri: JWKS_URI });
        }
        jwksFetches += 1;
        return jsonResponse({ keys: [RSA_JWK] });
      },
    });
    await expectCode(() => authority.resolveForVerification('unknown', 'RS256'), 'UNKNOWN_KEY');
    expect(metadataFetches).toBe(2);
    expect(jwksFetches).toBe(2);
  });

  it('never serves stale keys when the required refresh fails', async () => {
    let now = 1_000;
    let fail = false;
    const authority = new OidcJwksAuthority({
      issuer: ISSUER,
      now: () => now,
      cacheMaxAgeMs: 100,
      fetcher: async (input) => {
        if (fail) throw new Error('offline');
        return String(input) === DISCOVERY
          ? jsonResponse({ issuer: ISSUER, jwks_uri: JWKS_URI })
          : jsonResponse({ keys: [RSA_JWK] });
      },
    });
    await authority.refresh();
    now += 101;
    fail = true;
    expect(authority.resolve(ISSUER, 'rsa-1', 'RS256')).toBeNull();
    await expectCode(() => authority.resolveForVerification('rsa-1', 'RS256'), 'DISCOVERY_UNAVAILABLE');
  });

  it('turns a timed-out/aborted discovery request into fail-closed unavailability', async () => {
    const fetcher: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    const authority = new OidcJwksAuthority({ issuer: ISSUER, fetcher, timeoutMs: 5 });
    await expectCode(() => authority.refresh(), 'DISCOVERY_UNAVAILABLE');
  });
});

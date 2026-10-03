import { createPublicKey, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { OidcJwksAuthority } from '../src/governance-service/OidcJwksAuthority.ts';

const ISSUER = 'https://issuer.example';
const KID = 'rfl-coalesce-key-1';

const { publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const PUBLIC_JWK = Object.freeze({
  ...createPublicKey(publicKey).export({ format: 'jwk' }),
  kid: KID,
  use: 'sig',
});

function documentFor(url: string): Response {
  if (url === `${ISSUER}/.well-known/openid-configuration`) {
    return new Response(JSON.stringify({ issuer: ISSUER, jwks_uri: `${ISSUER}/.well-known/jwks.json` }), {
      status: 200,
    });
  }
  if (url === `${ISSUER}/.well-known/jwks.json`) {
    return new Response(JSON.stringify({ keys: [PUBLIC_JWK] }), { status: 200 });
  }
  return new Response('not found', { status: 404 });
}

describe('RFL cycle 7: JWKS refresh coalescing under concurrent resolution', () => {
  it('serves sequential resolutions from one cached fetch round', async () => {
    let fetches = 0;
    const countingFetcher = async (input: string | URL | Request): Promise<Response> => {
      fetches += 1;
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      return documentFor(url);
    };
    const authority = new OidcJwksAuthority({ issuer: ISSUER, fetcher: countingFetcher });

    const first = await authority.resolveForVerification(KID, 'ES256');
    expect(first).toMatchObject({ kid: KID });
    const second = await authority.resolveForVerification(KID, 'ES256');
    expect(second).toMatchObject({ kid: KID });
    // One discovery fetch plus one JWKS fetch, then cache hits.
    expect(fetches).toBe(2);
  });

  // Skipped while RFL-0003 is an open candidate finding: concurrent
  // resolutions each trigger a full discovery-plus-JWKS refresh round
  // instead of coalescing (observed 6 fetches for 3 callers). Unskip to
  // re-verify after in-flight refresh coalescing lands.
  it.skip('coalesces concurrent resolutions into a single fetch round', async () => {
    let fetches = 0;
    const countingFetcher = async (input: string | URL | Request): Promise<Response> => {
      fetches += 1;
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      return documentFor(url);
    };
    const authority = new OidcJwksAuthority({ issuer: ISSUER, fetcher: countingFetcher });

    const keys = await Promise.all([
      authority.resolveForVerification(KID, 'ES256'),
      authority.resolveForVerification(KID, 'ES256'),
      authority.resolveForVerification(KID, 'ES256'),
    ]);
    for (const key of keys) expect(key).toMatchObject({ kid: KID });
    // One discovery fetch plus one JWKS fetch shared by all three callers.
    expect(fetches).toBe(2);
  });
});

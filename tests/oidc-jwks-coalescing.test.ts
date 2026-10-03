import { createPublicKey, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { OidcJwksAuthority } from '../src/governance-service/OidcJwksAuthority.ts';

const ISSUER = 'https://issuer.example';
const KID = 'coalesce-regression-key-1';

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
    return new Response(JSON.stringify({ keys: [PUBLIC_JWK] }), {
      status: 200,
    });
  }
  return new Response('not found', { status: 404 });
}

describe('RFL-0003 fix falsifiers: JWKS refresh coalescing (production OidcJwksAuthority)', () => {
  it('shares one refresh round across concurrent cold-start resolutions', async () => {
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
    expect(fetches).toBe(2);
  });

  it('clears a failed shared round so the next resolution starts a fresh refresh', async () => {
    let failures = 0;
    const flakyFetcher = async (input: string | URL | Request): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      failures += 1;
      if (failures <= 1) return new Response('boom', { status: 500 });
      return documentFor(url);
    };
    const authority = new OidcJwksAuthority({ issuer: ISSUER, fetcher: flakyFetcher });

    const firstRoundFailures = await Promise.allSettled([
      authority.resolveForVerification(KID, 'ES256'),
      authority.resolveForVerification(KID, 'ES256'),
    ]);
    for (const outcome of firstRoundFailures) expect(outcome.status).toBe('rejected');

    const recovered = await authority.resolveForVerification(KID, 'ES256');
    expect(recovered).toMatchObject({ kid: KID });
  });
});
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  DataPlaneAccessTokenAuthority,
  DataPlaneAuthError,
  type DataPlaneJwkResolver,
} from '../src/governance-service/DataPlaneAccessTokenAuthority.ts';

const ISSUER = 'https://identity.example.test';
const AUDIENCE = 'nemosyne-data-plane';
const SUBJECT = 'researcher-123';
const JTI = 'credential-session-001';
const NOW_SECONDS = 1_788_408_000;

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: 'jwk' });
const resolver: DataPlaneJwkResolver = {
  resolve: (_issuer, kid, algorithm) => (kid === 'test-rs256' && algorithm === 'RS256' ? publicJwk : null),
};

const roots: string[] = [];
afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

function root(): string {
  const value = mkdtempSync(join(tmpdir(), 'nemosyne-pt4b3-'));
  roots.push(value);
  return value;
}

function authority(dataDirectory: string, keyResolver: DataPlaneJwkResolver = resolver): DataPlaneAccessTokenAuthority {
  return new DataPlaneAccessTokenAuthority({
    issuer: ISSUER,
    audience: AUDIENCE,
    allowedAlgorithms: ['RS256'],
    keyResolver,
    dataDirectory,
    credentialSessionKey: new Uint8Array(32).fill(7),
    now: () => new Date(NOW_SECONDS * 1000),
    clockSkewSeconds: 60,
  });
}

function b64(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function token(options: {
  typ?: string;
  alg?: string;
  kid?: string;
  iss?: string;
  sub?: string;
  aud?: string | string[];
  iat?: number;
  exp?: number;
  jti?: string;
  scope?: string;
} = {}): string {
  const header = b64({ typ: options.typ ?? 'at+jwt', alg: options.alg ?? 'RS256', kid: options.kid ?? 'test-rs256' });
  const payload = b64({
    iss: options.iss ?? ISSUER,
    sub: options.sub ?? SUBJECT,
    aud: options.aud ?? AUDIENCE,
    iat: options.iat ?? NOW_SECONDS - 10,
    exp: options.exp ?? NOW_SECONDS + 120,
    jti: options.jti ?? JTI,
    scope: options.scope ?? 'consent:read events:capture events:write',
  });
  const signingInput = `${header}.${payload}`;
  const signature = sign('RSA-SHA256', Buffer.from(signingInput, 'ascii'), privateKey).toString('base64url');
  return `${signingInput}.${signature}`;
}

async function expectCode(work: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await work();
    throw new Error('expected authentication refusal');
  } catch (error) {
    expect(error).toBeInstanceOf(DataPlaneAuthError);
    expect((error as DataPlaneAuthError).code).toBe(code);
  }
}

describe('PT4B3 data-plane access-token authority', () => {
  it('accepts only a correctly signed at+jwt with the exact endpoint scope', async () => {
    const service = authority(root());
    const principal = await service.authenticateBearer(`Bearer ${token()}`, 'events:capture');
    expect(principal.issuer).toBe(ISSUER);
    expect(principal.subject).toBe(SUBJECT);
    expect(principal.tokenId).toBe(JTI);
    expect(principal.scopes.has('events:capture')).toBe(true);
    await service.close();
  });

  it('refuses ID-token typ, symmetric/none algorithms and unknown keys before admission', async () => {
    const service = authority(root());
    await expectCode(() => service.authenticateToken(token({ typ: 'JWT' }), 'events:capture'), 'TOKEN_PROFILE_REFUSED');
    await expectCode(() => service.authenticateToken(token({ alg: 'HS256' }), 'events:capture'), 'TOKEN_PROFILE_REFUSED');
    await expectCode(() => service.authenticateToken(token({ alg: 'none' }), 'events:capture'), 'TOKEN_PROFILE_REFUSED');
    await expectCode(() => service.authenticateToken(token({ kid: 'missing' }), 'events:capture'), 'UNKNOWN_KEY');
    await service.close();
  });

  it('refuses private JWK CRT material even when a custom resolver bypasses JWKS filtering', async () => {
    const privateFieldResolver: DataPlaneJwkResolver = {
      resolve: () => ({ ...publicJwk, p: 'private-field' } as JsonWebKey),
    };
    const service = authority(root(), privateFieldResolver);
    await expectCode(() => service.authenticateToken(token(), 'events:capture'), 'UNKNOWN_KEY');
    await service.close();
  });

  it('refuses extra audiences, overlong lifetimes, future/expired tokens and absent endpoint scope', async () => {
    const service = authority(root());
    await expectCode(() => service.authenticateToken(token({ aud: [AUDIENCE, 'other'] }), 'events:capture'), 'TOKEN_PROFILE_REFUSED');
    await expectCode(() => service.authenticateToken(token({ iat: NOW_SECONDS - 1, exp: NOW_SECONDS + 301 }), 'events:capture'), 'TOKEN_PROFILE_REFUSED');
    await expectCode(() => service.authenticateToken(token({ iat: NOW_SECONDS + 61, exp: NOW_SECONDS + 120 }), 'events:capture'), 'TOKEN_NOT_YET_VALID');
    await expectCode(() => service.authenticateToken(token({ iat: NOW_SECONDS - 200, exp: NOW_SECONDS - 61 }), 'events:capture'), 'TOKEN_EXPIRED');
    await expectCode(() => service.authenticateToken(token({ scope: 'consent:read events:write' }), 'events:capture'), 'INSUFFICIENT_SCOPE');
    await service.close();
  });

  it('refuses a canonically encoded modified signature', async () => {
    const service = authority(root());
    const valid = token();
    const [head, body, signature] = valid.split('.');
    const bytes = Buffer.from(signature, 'base64url');
    bytes[0] ^= 0x01;
    const changed = `${head}.${body}.${bytes.toString('base64url')}`;
    await expectCode(() => service.authenticateToken(changed, 'events:capture'), 'INVALID_SIGNATURE');
    await service.close();
  });

  it('persists local credential revocation across reopen without persisting raw identity or bearer text', async () => {
    const dataDirectory = root();
    const bearer = token();
    let service = authority(dataDirectory);
    const principal = await service.authenticateToken(bearer, 'events:capture');
    await service.revoke(principal);
    await service.close();

    service = authority(dataDirectory);
    await expectCode(() => service.authenticateToken(bearer, 'events:capture'), 'CREDENTIAL_REVOKED');
    await service.close();

    const database = readFileSync(join(dataDirectory, 'governance.sqlite'));
    expect(database.includes(Buffer.from(ISSUER))).toBe(false);
    expect(database.includes(Buffer.from(SUBJECT))).toBe(false);
    expect(database.includes(Buffer.from(bearer))).toBe(false);
  });

  it('rejects weak credential-session secrets and non-HTTPS issuers', () => {
    const dataDirectory = root();
    expect(() => new DataPlaneAccessTokenAuthority({ issuer: 'http://identity.example.test', audience: AUDIENCE, allowedAlgorithms: ['RS256'], keyResolver: resolver, dataDirectory, credentialSessionKey: new Uint8Array(32) })).toThrow(DataPlaneAuthError);
    expect(() => new DataPlaneAccessTokenAuthority({ issuer: ISSUER, audience: AUDIENCE, allowedAlgorithms: ['RS256'], keyResolver: resolver, dataDirectory, credentialSessionKey: new Uint8Array(31) })).toThrow(DataPlaneAuthError);
  });
});

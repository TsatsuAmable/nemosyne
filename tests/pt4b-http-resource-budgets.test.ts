import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type { DataPlaneAuthenticatedPrincipalV1, DataPlaneScope } from '../src/governance-service/DataPlaneAccessTokenAuthority.ts';
import {
  GovernanceHttpService,
  type GovernanceAuthenticatorV1,
  type GovernanceHttpRequestV1,
} from '../src/governance-service/GovernanceHttpService.ts';
import { SqliteProductAnalyticsConsentAuthority } from '../src/governance-service/ProductAnalyticsConsentAuthority.ts';

const ORIGIN = 'https://app.nemosyne.test';
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function consentAuthority() {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'nemosyne-pt4b-budget-'));
  directories.push(dataDirectory);
  return new SqliteProductAnalyticsConsentAuthority({
    dataDirectory,
    purposePseudonymKey: { version: 'p1', key: new Uint8Array(32).fill(7) },
    deletionHandleKey: { version: 'd1', key: new Uint8Array(32).fill(9) },
    now: () => new Date('2026-09-03T05:00:00.000Z'),
  });
}

const PRINCIPAL: DataPlaneAuthenticatedPrincipalV1 = Object.freeze({
  issuer: 'https://issuer.example',
  subject: 'subject-123',
  tokenId: 'token-1',
  scopes: new Set<DataPlaneScope>(['consent:write', 'events:write']),
  issuedAt: 1,
  expiresAt: 2,
});

const authenticator: GovernanceAuthenticatorV1 = {
  async authenticate() {
    return PRINCIPAL;
  },
};

function request(overrides: Partial<GovernanceHttpRequestV1> = {}): GovernanceHttpRequestV1 {
  return {
    method: 'POST',
    path: '/v1/governance/consents/product-analytics/grants',
    origin: ORIGIN,
    authorizationValues: ['Bearer test-token'],
    contentType: 'application/json',
    contentEncoding: null,
    sourceId: '127.0.0.1',
    readBody: async () => Buffer.from('{}'),
    ...overrides,
  };
}

describe('PT4B transport resource budgets', () => {
  it('refuses a third simultaneous request for one authenticated principal before reading its body', async () => {
    const consent = consentAuthority();
    const service = new GovernanceHttpService({ allowedOrigins: [ORIGIN], consentAuthority: consent, authenticator });
    const releases: Array<() => void> = [];
    let bodyReads = 0;
    const heldRequest = () => request({
      readBody: async () => {
        bodyReads += 1;
        await new Promise<void>((resolve) => releases.push(resolve));
        return Buffer.from('{}');
      },
    });

    const first = service.dispatch(heldRequest());
    const second = service.dispatch(heldRequest());
    while (bodyReads < 2) await new Promise((resolve) => setTimeout(resolve, 0));

    let thirdBodyReads = 0;
    const third = await service.dispatch(request({
      readBody: async () => {
        thirdBodyReads += 1;
        return Buffer.from('{}');
      },
    }));
    expect(third.status).toBe(429);
    expect(JSON.parse(third.body)).toMatchObject({ code: 'BUSY' });
    expect(thirdBodyReads).toBe(0);

    for (const release of releases) release();
    await Promise.all([first, second]);
    consent.close();
  });

  it('limits one authenticated principal to twelve event batches per minute before body parsing', async () => {
    const consent = consentAuthority();
    const service = new GovernanceHttpService({ allowedOrigins: [ORIGIN], consentAuthority: consent, authenticator });
    let bodyReads = 0;
    const batch = () => service.dispatch(request({
      path: '/v1/governed-events/batches',
      contentType: 'application/x-ndjson',
      readBody: async () => {
        bodyReads += 1;
        return Buffer.from('{}\n');
      },
    }));

    for (let index = 0; index < 12; index += 1) {
      const response = await batch();
      expect(response.status).toBe(503);
      expect(JSON.parse(response.body)).toMatchObject({ code: 'INGESTION_UNAVAILABLE' });
    }
    const refused = await batch();
    expect(refused.status).toBe(429);
    expect(JSON.parse(refused.body)).toMatchObject({ code: 'RATE_LIMITED' });
    expect(bodyReads).toBe(0);
    consent.close();
  });
});

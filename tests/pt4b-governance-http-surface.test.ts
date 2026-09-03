import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE, PRODUCT_OPERATION_FAMILY_ID } from '../src/governance/index.ts';
import type { DataPlaneAuthenticatedPrincipalV1, DataPlaneScope } from '../src/governance-service/DataPlaneAccessTokenAuthority.ts';
import {
  GovernanceHttpService,
  createGovernanceHttpServer,
  type GovernanceAuthenticatorV1,
  type GovernanceHttpRequestV1,
} from '../src/governance-service/GovernanceHttpService.ts';
import { SqliteProductAnalyticsConsentAuthority } from '../src/governance-service/ProductAnalyticsConsentAuthority.ts';

const ORIGIN = 'https://app.nemosyne.test';
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function directory(): string {
  const value = mkdtempSync(join(tmpdir(), 'nemosyne-pt4b5-'));
  temporaryDirectories.push(value);
  return value;
}

function consentAuthority() {
  let uuid = 0;
  return new SqliteProductAnalyticsConsentAuthority({
    dataDirectory: directory(),
    purposePseudonymKey: { version: 'p1', key: new Uint8Array(32).fill(7) },
    deletionHandleKey: { version: 'd1', key: new Uint8Array(32).fill(9) },
    now: () => new Date('2026-09-03T05:00:00.000Z'),
    uuid: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`,
  });
}

const PRINCIPAL: DataPlaneAuthenticatedPrincipalV1 = Object.freeze({
  issuer: 'https://issuer.example',
  subject: 'subject-123',
  tokenId: 'token-1',
  scopes: new Set<DataPlaneScope>(['consent:read', 'consent:write', 'events:capture']),
  issuedAt: 1,
  expiresAt: 2,
});

function authenticator(log: DataPlaneScope[] = []): GovernanceAuthenticatorV1 {
  return {
    async authenticate(_authorizationHeader, requiredScope) {
      log.push(requiredScope);
      return PRINCIPAL;
    },
  };
}

function request(
  overrides: Partial<GovernanceHttpRequestV1> = {},
  body: unknown = {}
): GovernanceHttpRequestV1 {
  return {
    method: 'GET',
    path: '/v1/governance/consents/product-analytics/current',
    origin: ORIGIN,
    authorizationValues: ['Bearer test-token'],
    contentType: null,
    contentEncoding: null,
    sourceId: '127.0.0.1',
    readBody: async () => Buffer.from(JSON.stringify(body)),
    ...overrides,
  };
}

describe('PT4B5 governance HTTP surface', () => {
  it('authenticates before reading a protected request body', async () => {
    const authority = consentAuthority();
    let bodyReads = 0;
    const service = new GovernanceHttpService({
      allowedOrigins: [ORIGIN],
      consentAuthority: authority,
      authenticator: {
        async authenticate() {
          throw new Error('identity authority unavailable');
        },
      },
    });

    const response = await service.dispatch(
      request({
        method: 'POST',
        path: '/v1/governance/consents/product-analytics/grants',
        contentType: 'application/json',
        readBody: async () => {
          bodyReads += 1;
          return Buffer.from('{"secret":"must-not-be-read"}');
        },
      })
    );

    expect(response.status).toBe(503);
    expect(response.body).not.toContain('secret');
    expect(bodyReads).toBe(0);
    authority.close();
  });

  it('rejects duplicate Authorization fields and unsupported media before body parsing', async () => {
    const authority = consentAuthority();
    let bodyReads = 0;
    const service = new GovernanceHttpService({ allowedOrigins: [ORIGIN], consentAuthority: authority, authenticator: authenticator() });
    const base = {
      method: 'POST',
      path: '/v1/governance/consents/product-analytics/grants',
      readBody: async () => {
        bodyReads += 1;
        return Buffer.from('{}');
      },
    } as const;

    const duplicate = await service.dispatch(request({ ...base, authorizationValues: ['Bearer a', 'Bearer b'], contentType: 'application/json' }));
    expect(duplicate.status).toBe(401);
    const media = await service.dispatch(request({ ...base, contentType: 'text/plain' }));
    expect(media.status).toBe(415);
    expect(bodyReads).toBe(0);
    authority.close();
  });

  it('routes exact consent and capture scopes through the durable authority', async () => {
    const authority = consentAuthority();
    const scopes: DataPlaneScope[] = [];
    const service = new GovernanceHttpService({ allowedOrigins: [ORIGIN], consentAuthority: authority, authenticator: authenticator(scopes) });

    const initial = await service.dispatch(request());
    expect(initial.status).toBe(200);
    expect(JSON.parse(initial.body)).toMatchObject({ schemaVersion: '1', purpose: 'product-analytics', status: 'DENIED', revision: null });

    const grant = await service.dispatch(
      request(
        {
          method: 'POST',
          path: '/v1/governance/consents/product-analytics/grants',
          contentType: 'application/json',
        },
        {
          schemaVersion: '1',
          purpose: 'product-analytics',
          notice: PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE,
          confirmed: true,
          actionId: '11111111-1111-4111-8111-111111111111',
          expectedPriorRevision: null,
        }
      )
    );
    expect(grant.status).toBe(200);
    expect(JSON.parse(grant.body)).toMatchObject({ status: 'GRANTED', revision: '1' });

    const capture = await service.dispatch(
      request(
        {
          method: 'POST',
          path: '/v1/governance/consents/product-analytics/capture-authorizations',
          contentType: 'application/json',
        },
        {
          schemaVersion: '1',
          familyId: PRODUCT_OPERATION_FAMILY_ID,
          eventId: '22222222-2222-4222-8222-222222222222',
          producerInstanceId: 'piv1_33333333-3333-4333-8333-333333333333',
          streamId: 'strv1_44444444-4444-4444-8444-444444444444',
          streamSequence: 0,
        }
      )
    );
    expect(capture.status).toBe(200);
    expect(JSON.parse(capture.body)).toMatchObject({ familyId: PRODUCT_OPERATION_FAMILY_ID, streamSequence: 0 });
    expect(scopes).toEqual(['consent:read', 'consent:write', 'events:capture']);
    authority.close();
  });

  it('fails closed on origin confusion and exposes a bounded real listener envelope', async () => {
    const authority = consentAuthority();
    const service = new GovernanceHttpService({ allowedOrigins: [ORIGIN], consentAuthority: authority, authenticator: authenticator() });
    await expect(service.dispatch(request({ origin: 'https://app.nemosyne.test/' }))).rejects.toMatchObject({ status: 403, code: 'ORIGIN_REFUSED' });
    await expect(service.dispatch(request({ origin: 'https://evil.example' }))).rejects.toMatchObject({ status: 403, code: 'ORIGIN_REFUSED' });

    const server = createGovernanceHttpServer(service);
    expect(server.headersTimeout).toBe(5_000);
    expect(server.requestTimeout).toBe(10_000);
    expect(server.maxConnections).toBe(128);
    server.close();
    authority.close();
  });

  it('answers only allowlisted CORS preflight without authenticating or reading a body', async () => {
    const authority = consentAuthority();
    const scopes: DataPlaneScope[] = [];
    const service = new GovernanceHttpService({ allowedOrigins: [ORIGIN], consentAuthority: authority, authenticator: authenticator(scopes) });
    const response = await service.dispatch(request({ method: 'OPTIONS', authorizationValues: [] }));
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(response.headers['access-control-allow-headers']).toBe('authorization, content-type');
    expect(scopes).toEqual([]);
    authority.close();
  });
});

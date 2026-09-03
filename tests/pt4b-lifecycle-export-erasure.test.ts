import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

import {
  GOVERNED_DATA_CLASSES,
  GOVERNED_PURPOSES,
  PRODUCT_ANALYTICS_DATA_SERVICE_AUTHORITY_REFERENCE,
  PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE,
  PRODUCT_ANALYTICS_OPERATION_RETENTION_REFERENCE,
  PRODUCT_OPERATION_FAMILY_ID,
  PRODUCT_OPERATION_SOURCE_COMPONENT,
  computeGovernedEventContentDigestV1,
  computeGovernedPayloadDigestV1,
  type GovernedEventEnvelopeV1,
  type RuntimeComponentReferenceV1,
} from '../src/governance/index.ts';
import type { DataPlaneAuthenticatedPrincipalV1, DataPlaneScope } from '../src/governance-service/DataPlaneAccessTokenAuthority.ts';
import { GovernanceHttpService, type GovernanceAuthenticatorV1, type GovernanceHttpRequestV1 } from '../src/governance-service/GovernanceHttpService.ts';
import {
  SqliteProductAnalyticsConsentAuthority,
  type AuthenticatedPrincipalV1,
} from '../src/governance-service/ProductAnalyticsConsentAuthority.ts';
import { SqliteProductAnalyticsEventIngestion } from '../src/governance-service/ProductAnalyticsEventIngestion.ts';
import {
  CONSENT_LIFECYCLE_ENFORCEMENT_RETENTION_DIGEST,
  SqliteProductAnalyticsLifecycleAuthority,
} from '../src/governance-service/ProductAnalyticsLifecycleAuthority.ts';

const ORIGIN = 'https://app.nemosyne.test';
const PRINCIPAL: AuthenticatedPrincipalV1 = Object.freeze({ issuer: 'https://issuer.example', subject: 'subject-123' });
const OTHER_PRINCIPAL: AuthenticatedPrincipalV1 = Object.freeze({ issuer: 'https://issuer.example', subject: 'subject-456' });
const PURPOSE_KEY = Object.freeze({ version: 'p1', key: new Uint8Array(32).fill(7) });
const DELETION_KEY = Object.freeze({ version: 'd1', key: new Uint8Array(32).fill(9) });
const directories: string[] = [];

afterEach(() => { for (const value of directories.splice(0)) rmSync(value, { recursive: true, force: true }); });

function directory(): string {
  const value = mkdtempSync(join(tmpdir(), 'nemosyne-pt4b7-'));
  directories.push(value);
  return value;
}

function uuidFactory(): () => string {
  let value = 0;
  return () => `00000000-0000-4000-8000-${String(++value).padStart(12, '0')}`;
}

function runtimeRef(id: string, character: string): RuntimeComponentReferenceV1 {
  return {
    schemaVersion: '1',
    componentId: id,
    version: '1.0.0+sha.0123456789abcdef',
    artifactDigest: { algorithm: 'SHA256', value: character.repeat(64) },
  };
}

function createAuthorities(dataDirectory: string, nowRef: { value: Date }) {
  const consent = new SqliteProductAnalyticsConsentAuthority({
    dataDirectory,
    purposePseudonymKey: PURPOSE_KEY,
    deletionHandleKey: DELETION_KEY,
    now: () => nowRef.value,
    uuid: uuidFactory(),
  });
  const ingestion = new SqliteProductAnalyticsEventIngestion({
    dataDirectory,
    deletionHandleKey: DELETION_KEY,
    now: () => nowRef.value,
    uuid: uuidFactory(),
  });
  const lifecycle = new SqliteProductAnalyticsLifecycleAuthority({
    dataDirectory,
    deletionHandleKey: DELETION_KEY,
    now: () => nowRef.value,
    uuid: uuidFactory(),
  });
  return { consent, ingestion, lifecycle };
}

function grant(consent: SqliteProductAnalyticsConsentAuthority, principal: AuthenticatedPrincipalV1, actionId: string) {
  return consent.grant(principal, {
    schemaVersion: '1',
    purpose: 'product-analytics',
    notice: PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE,
    confirmed: true,
    actionId,
    expectedPriorRevision: null,
  });
}

function capture(
  consent: SqliteProductAnalyticsConsentAuthority,
  principal: AuthenticatedPrincipalV1,
  eventId: string,
  sequence: number,
  streamId = 'strv1_44444444-4444-4444-8444-444444444444'
) {
  return consent.authorizeCapture(principal, {
    schemaVersion: '1',
    familyId: PRODUCT_OPERATION_FAMILY_ID,
    eventId,
    producerInstanceId: 'piv1_33333333-3333-4333-8333-333333333333',
    streamId,
    streamSequence: sequence,
  });
}

function envelope(captureAuthorization: ReturnType<typeof capture>, operation = 'filter'): GovernedEventEnvelopeV1 {
  const payload = { operation };
  const content: Omit<GovernedEventEnvelopeV1, 'contentDigest'> = {
    schemaVersion: '1',
    eventFamilyId: PRODUCT_OPERATION_FAMILY_ID,
    payloadSchemaVersion: '1',
    eventId: captureAuthorization.eventId,
    streamId: captureAuthorization.streamId,
    producerInstanceId: captureAuthorization.producerInstanceId,
    streamSequence: captureAuthorization.streamSequence,
    capturedAt: captureAuthorization.authorizedAt,
    sourceComponent: PRODUCT_OPERATION_SOURCE_COMPONENT,
    mode: 'PRODUCT',
    purpose: GOVERNED_PURPOSES.PRODUCT_ANALYTICS,
    dataClasses: [GOVERNED_DATA_CLASSES.PRODUCT_INTERACTION_METADATA],
    effectiveSensitivity: 'PSEUDONYMOUS',
    identities: {
      profilePseudonymId: captureAuthorization.profilePseudonymId,
      productSessionId: 'psv1_55555555-5555-4555-8555-555555555555',
      investigationId: null,
      discoveryEpisodeId: null,
    },
    dataset: null,
    runtime: {
      schemaVersion: '1',
      components: {
        applicationBuild: runtimeRef('nemosyne-app', 'a'),
        deploymentConfiguration: runtimeRef('private-preview', 'b'),
        wasmKernel: null,
        representationTreatment: null,
        monetaEngine: null,
        fitnessModel: null,
        nil: null,
        perceptionGestureTreatment: null,
        uiTreatment: runtimeRef('product-ui', 'c'),
        platformRuntime: runtimeRef('browser-runtime', 'd'),
      },
      randomSeeds: {},
    },
    authorization: [{
      schemaVersion: '1',
      basis: 'CONSENT_RECEIPT',
      purpose: GOVERNED_PURPOSES.PRODUCT_ANALYTICS,
      authority: PRODUCT_ANALYTICS_DATA_SERVICE_AUTHORITY_REFERENCE,
      evidence: captureAuthorization.receipt,
      policy: PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE,
    }],
    retention: { schemaVersion: '1', policy: PRODUCT_ANALYTICS_OPERATION_RETENTION_REFERENCE },
    payload,
    payloadDigest: computeGovernedPayloadDigestV1(payload),
  };
  return { ...content, contentDigest: computeGovernedEventContentDigestV1(content) };
}

async function storeEvent(
  consent: SqliteProductAnalyticsConsentAuthority,
  ingestion: SqliteProductAnalyticsEventIngestion,
  principal: AuthenticatedPrincipalV1,
  eventId: string,
  actionId: string,
  streamId: string
) {
  grant(consent, principal, actionId);
  const authorization = capture(consent, principal, eventId, 0, streamId);
  expect(await ingestion.ingestLine(principal, JSON.stringify(envelope(authorization)))).toMatchObject({ status: 'STORED' });
  return authorization;
}

function authenticatedPrincipal(scopes: readonly DataPlaneScope[]): DataPlaneAuthenticatedPrincipalV1 {
  return Object.freeze({
    issuer: PRINCIPAL.issuer,
    subject: PRINCIPAL.subject,
    tokenId: 'token-1',
    scopes: new Set(scopes),
    issuedAt: 1,
    expiresAt: 2,
  });
}

function request(path: string, body: unknown): GovernanceHttpRequestV1 {
  return {
    method: 'POST',
    path,
    origin: ORIGIN,
    authorizationValues: ['Bearer test-token'],
    contentType: 'application/json',
    contentEncoding: null,
    sourceId: '127.0.0.1',
    readBody: async () => Buffer.from(JSON.stringify(body)),
  };
}

describe('PT4B7 governed lifecycle, export and erasure', () => {
  it('pins the reviewed lifecycle policy and exports only the authenticated principal in stable NDJSON order', async () => {
    expect(CONSENT_LIFECYCLE_ENFORCEMENT_RETENTION_DIGEST).toBe('71aa3033cdf5d085ec806c7bf19f71d4b88b5902a0a66b6ea1a13730d6257085');
    const dataDirectory = directory();
    const nowRef = { value: new Date('2026-09-03T05:00:00.000Z') };
    const { consent, ingestion, lifecycle } = createAuthorities(dataDirectory, nowRef);
    await storeEvent(consent, ingestion, PRINCIPAL, '22222222-2222-4222-8222-222222222221', '11111111-1111-4111-8111-111111111111', 'strv1_44444444-4444-4444-8444-444444444441');
    await storeEvent(consent, ingestion, OTHER_PRINCIPAL, '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111112', 'strv1_44444444-4444-4444-8444-444444444442');

    const exported = lifecycle.exportRecords(PRINCIPAL, {
      schemaVersion: '1',
      actionId: '77777777-7777-4777-8777-777777777777',
      from: '2026-09-03T04:59:00.000Z',
      to: '2026-09-03T05:01:00.000Z',
    });
    const lines = exported.body.trimEnd().split('\n').map((line) => JSON.parse(line));
    expect(exported.contentType).toBe('application/x-ndjson');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ kind: 'MANIFEST', recordCount: 1, familyId: PRODUCT_OPERATION_FAMILY_ID });
    expect(lines[1]).toMatchObject({ kind: 'RECORD', envelope: { eventId: '22222222-2222-4222-8222-222222222221' } });
    expect(exported.body).not.toContain('22222222-2222-4222-8222-222222222222');

    lifecycle.close();
    ingestion.close();
    consent.close();
  });

  it('keeps export available after revocation, then erases only the principal service scope and makes exact erasure retry idempotent', async () => {
    const dataDirectory = directory();
    const nowRef = { value: new Date('2026-09-03T05:00:00.000Z') };
    const { consent, ingestion, lifecycle } = createAuthorities(dataDirectory, nowRef);
    const ownGrant = grant(consent, PRINCIPAL, '11111111-1111-4111-8111-111111111111');
    const ownCapture = capture(consent, PRINCIPAL, '22222222-2222-4222-8222-222222222221', 0, 'strv1_44444444-4444-4444-8444-444444444441');
    expect(await ingestion.ingestLine(PRINCIPAL, JSON.stringify(envelope(ownCapture)))).toMatchObject({ status: 'STORED' });
    await storeEvent(consent, ingestion, OTHER_PRINCIPAL, '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111112', 'strv1_44444444-4444-4444-8444-444444444442');
    const revoked = consent.revoke(PRINCIPAL, {
      schemaVersion: '1',
      purpose: 'product-analytics',
      actionId: '66666666-6666-4666-8666-666666666666',
      expectedCurrentRevision: ownGrant.revision!,
    });

    expect(lifecycle.exportRecords(PRINCIPAL, {
      schemaVersion: '1',
      actionId: '77777777-7777-4777-8777-777777777777',
      from: '2026-09-03T04:59:00.000Z',
      to: '2026-09-03T05:01:00.000Z',
    }).recordCount).toBe(1);

    const erasureRequest = {
      schemaVersion: '1' as const,
      actionId: '88888888-8888-4888-8888-888888888888',
      expectedConsentRevision: revoked.revision!,
    };
    const erased = lifecycle.erase(PRINCIPAL, erasureRequest);
    expect(erased.result).toBe('SERVICE_SCOPE_RESOLVED');
    expect(lifecycle.erase(PRINCIPAL, erasureRequest)).toEqual(erased);
    expect(erased.dispositions).toContainEqual({ artifact: 'CONSENT_REVISIONS', disposition: 'POLICY_GOVERNED_RETENTION' });
    expect(erased.dispositions).toContainEqual({ artifact: 'LOCAL_OFFLINE_ARTIFACTS', disposition: 'OUTSIDE_SERVICE_CONTROL' });

    expect(lifecycle.exportRecords(PRINCIPAL, {
      schemaVersion: '1',
      actionId: '77777777-7777-4777-8777-777777777778',
      from: '2026-09-03T04:59:00.000Z',
      to: '2026-09-03T05:01:00.000Z',
    }).recordCount).toBe(0);
    expect(lifecycle.exportRecords(OTHER_PRINCIPAL, {
      schemaVersion: '1',
      actionId: '77777777-7777-4777-8777-777777777779',
      from: '2026-09-03T04:59:00.000Z',
      to: '2026-09-03T05:01:00.000Z',
    }).recordCount).toBe(1);

    const db = new DatabaseSync(join(dataDirectory, 'governance.sqlite'), { readOnly: true });
    expect((db.prepare('SELECT COUNT(*) AS count FROM product_analytics_consent_revisions').get() as { count: number }).count).toBeGreaterThan(0);
    expect((db.prepare('SELECT COUNT(*) AS count FROM governed_product_events').get() as { count: number }).count).toBe(1);
    db.close();

    lifecycle.close();
    ingestion.close();
    consent.close();
  });

  it('makes records unexportable at 30 days and physically purges overdue rows before readiness returns healthy', async () => {
    const dataDirectory = directory();
    const nowRef = { value: new Date('2026-09-03T05:00:00.000Z') };
    const { consent, ingestion, lifecycle } = createAuthorities(dataDirectory, nowRef);
    await storeEvent(consent, ingestion, PRINCIPAL, '22222222-2222-4222-8222-222222222221', '11111111-1111-4111-8111-111111111111', 'strv1_44444444-4444-4444-8444-444444444441');

    nowRef.value = new Date('2026-10-03T05:00:00.000Z');
    expect(lifecycle.exportRecords(PRINCIPAL, {
      schemaVersion: '1', actionId: '77777777-7777-4777-8777-777777777777', from: '2026-09-03T04:00:00.000Z', to: '2026-09-10T04:00:00.000Z',
    }).recordCount).toBe(0);

    nowRef.value = new Date('2026-10-04T05:00:00.000Z');
    expect(lifecycle.readiness().readyForIngestion).toBe(false);
    expect(lifecycle.runRetention().readyForIngestion).toBe(true);
    const db = new DatabaseSync(join(dataDirectory, 'governance.sqlite'), { readOnly: true });
    expect((db.prepare('SELECT COUNT(*) AS count FROM governed_product_events').get() as { count: number }).count).toBe(0);
    db.close();

    lifecycle.close();
    ingestion.close();
    consent.close();
  });

  it('routes lifecycle endpoints through distinct export and erase scopes after authentication', async () => {
    const dataDirectory = directory();
    const nowRef = { value: new Date('2026-09-03T05:00:00.000Z') };
    const { consent, ingestion, lifecycle } = createAuthorities(dataDirectory, nowRef);
    const granted = grant(consent, PRINCIPAL, '11111111-1111-4111-8111-111111111111');
    const scopes: DataPlaneScope[] = [];
    const authenticator: GovernanceAuthenticatorV1 = {
      async authenticate(_header, requiredScope) {
        scopes.push(requiredScope);
        return authenticatedPrincipal(['events:export', 'events:erase']);
      },
    };
    const service = new GovernanceHttpService({
      allowedOrigins: [ORIGIN],
      consentAuthority: consent,
      eventIngestion: ingestion,
      lifecycleAuthority: lifecycle,
      authenticator,
    });

    const exported = await service.dispatch(request('/v1/governed-exports/product-analytics', {
      schemaVersion: '1', actionId: '77777777-7777-4777-8777-777777777777', from: '2026-09-03T04:59:00.000Z', to: '2026-09-03T05:01:00.000Z',
    }));
    expect(exported.status).toBe(200);
    expect(exported.headers['content-type']).toBe('application/x-ndjson; charset=utf-8');

    const erased = await service.dispatch(request('/v1/governed-erasure/product-analytics', {
      schemaVersion: '1', actionId: '88888888-8888-4888-8888-888888888888', expectedConsentRevision: granted.revision!,
    }));
    expect(erased.status).toBe(200);
    expect(JSON.parse(erased.body)).toMatchObject({ result: 'SERVICE_SCOPE_RESOLVED' });
    expect(scopes).toEqual(['events:export', 'events:erase']);

    lifecycle.close();
    ingestion.close();
    consent.close();
  });
});

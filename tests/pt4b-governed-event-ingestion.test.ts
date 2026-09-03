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
import { SqliteProductAnalyticsConsentAuthority, type AuthenticatedPrincipalV1 } from '../src/governance-service/ProductAnalyticsConsentAuthority.ts';
import { SqliteProductAnalyticsEventIngestion } from '../src/governance-service/ProductAnalyticsEventIngestion.ts';

const PRINCIPAL: AuthenticatedPrincipalV1 = Object.freeze({ issuer: 'https://issuer.example', subject: 'subject-123' });
const PURPOSE_KEY = Object.freeze({ version: 'p1', key: new Uint8Array(32).fill(7) });
const DELETION_KEY = Object.freeze({ version: 'd1', key: new Uint8Array(32).fill(9) });
const NOW = new Date('2026-09-03T05:00:00.000Z');
const directories: string[] = [];

afterEach(() => { for (const value of directories.splice(0)) rmSync(value, { recursive: true, force: true }); });

function directory(): string {
  const value = mkdtempSync(join(tmpdir(), 'nemosyne-pt4b6-'));
  directories.push(value);
  return value;
}

function uuidFactory(): () => string {
  let value = 0;
  return () => `00000000-0000-4000-8000-${String(++value).padStart(12, '0')}`;
}

function runtimeRef(id: string, character: string): RuntimeComponentReferenceV1 {
  return { schemaVersion: '1', componentId: id, version: '1.0.0+sha.0123456789abcdef', artifactDigest: { algorithm: 'SHA256', value: character.repeat(64) } };
}

function createAuthorities(dataDirectory: string) {
  const consent = new SqliteProductAnalyticsConsentAuthority({
    dataDirectory,
    purposePseudonymKey: PURPOSE_KEY,
    deletionHandleKey: DELETION_KEY,
    now: () => NOW,
    uuid: uuidFactory(),
  });
  const ingestion = new SqliteProductAnalyticsEventIngestion({
    dataDirectory,
    deletionHandleKey: DELETION_KEY,
    now: () => NOW,
    uuid: uuidFactory(),
  });
  return { consent, ingestion };
}

function grant(consent: SqliteProductAnalyticsConsentAuthority) {
  return consent.grant(PRINCIPAL, {
    schemaVersion: '1',
    purpose: 'product-analytics',
    notice: PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE,
    confirmed: true,
    actionId: '11111111-1111-4111-8111-111111111111',
    expectedPriorRevision: null,
  });
}

function capture(consent: SqliteProductAnalyticsConsentAuthority, eventId: string, sequence: number) {
  return consent.authorizeCapture(PRINCIPAL, {
    schemaVersion: '1',
    familyId: PRODUCT_OPERATION_FAMILY_ID,
    eventId,
    producerInstanceId: 'piv1_33333333-3333-4333-8333-333333333333',
    streamId: 'strv1_44444444-4444-4444-8444-444444444444',
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

describe('PT4B6 governed event ingestion and transactional store', () => {
  it('stores sequence zero, consumes capture authorization, and treats exact replay as idempotent', async () => {
    const dataDirectory = directory();
    const { consent, ingestion } = createAuthorities(dataDirectory);
    grant(consent);
    const authorization = capture(consent, '22222222-2222-4222-8222-222222222222', 0);
    const json = JSON.stringify(envelope(authorization));

    expect(await ingestion.ingestLine(PRINCIPAL, json)).toMatchObject({ status: 'STORED', eventId: authorization.eventId });
    expect(await ingestion.ingestLine(PRINCIPAL, json)).toMatchObject({ status: 'EXACT_DUPLICATE', eventId: authorization.eventId });

    const db = new DatabaseSync(join(dataDirectory, 'governance.sqlite'), { readOnly: true });
    expect((db.prepare('SELECT COUNT(*) AS count FROM governed_product_events').get() as { count: number }).count).toBe(1);
    expect((db.prepare('SELECT consumed_at FROM product_analytics_capture_authorizations WHERE event_id = ?').get(authorization.eventId) as { consumed_at: string | null }).consumed_at).toBe(NOW.toISOString());
    db.close();
    ingestion.close();
    consent.close();
  });

  it('refuses a stream gap without consuming the capture authorization or writing an event', async () => {
    const dataDirectory = directory();
    const { consent, ingestion } = createAuthorities(dataDirectory);
    grant(consent);
    const authorization = capture(consent, '22222222-2222-4222-8222-222222222223', 1);
    expect(await ingestion.ingestLine(PRINCIPAL, JSON.stringify(envelope(authorization)))).toMatchObject({ status: 'GAP_REFUSED' });

    const db = new DatabaseSync(join(dataDirectory, 'governance.sqlite'), { readOnly: true });
    expect((db.prepare('SELECT COUNT(*) AS count FROM governed_product_events').get() as { count: number }).count).toBe(0);
    expect((db.prepare('SELECT consumed_at FROM product_analytics_capture_authorizations WHERE event_id = ?').get(authorization.eventId) as { consumed_at: string | null }).consumed_at).toBeNull();
    db.close();
    ingestion.close();
    consent.close();
  });

  it('re-checks current consent inside the storage transaction after capture authorization issuance', async () => {
    const dataDirectory = directory();
    const { consent, ingestion } = createAuthorities(dataDirectory);
    const granted = grant(consent);
    const authorization = capture(consent, '22222222-2222-4222-8222-222222222224', 0);
    consent.revoke(PRINCIPAL, {
      schemaVersion: '1', purpose: 'product-analytics', actionId: '66666666-6666-4666-8666-666666666666', expectedCurrentRevision: granted.revision!,
    });
    expect(await ingestion.ingestLine(PRINCIPAL, JSON.stringify(envelope(authorization)))).toMatchObject({ status: 'REFUSED_GOVERNANCE' });
    ingestion.close();
    consent.close();
  });
});

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
import { SqliteProductAnalyticsConsentAuthority } from '../src/governance-service/ProductAnalyticsConsentAuthority.ts';
import {
  ReviewedProductAnalyticsRuntimeAuthority,
  RuntimePinnedProductAnalyticsEventIngestion,
} from '../src/governance-service/ProductAnalyticsRuntimeAuthority.ts';

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

function runtimeRef(componentId: string, version: string, character: string): RuntimeComponentReferenceV1 {
  return {
    schemaVersion: '1',
    componentId,
    version,
    artifactDigest: { algorithm: 'SHA256', value: character.repeat(64) },
  };
}

const APP = runtimeRef('nemosyne-app', '1.0.0+sha.0123456789abcdef', 'a');
const DEPLOYMENT = runtimeRef('private-preview', '1.0.0+sha.0123456789abcdef', 'b');
const UI = runtimeRef('product-ui', '1.0.0+sha.0123456789abcdef', 'c');
const PLATFORM = runtimeRef('browser-runtime', 'chromium-140', 'd');

function envelope(overrides: Partial<GovernedEventEnvelopeV1['runtime']['components']> = {}): GovernedEventEnvelopeV1 {
  const payload = { operation: 'filter' };
  const content: Omit<GovernedEventEnvelopeV1, 'contentDigest'> = {
    schemaVersion: '1',
    eventFamilyId: PRODUCT_OPERATION_FAMILY_ID,
    payloadSchemaVersion: '1',
    eventId: '22222222-2222-4222-8222-222222222222',
    streamId: 'strv1_44444444-4444-4444-8444-444444444444',
    producerInstanceId: 'piv1_33333333-3333-4333-8333-333333333333',
    streamSequence: 0,
    capturedAt: '2026-09-03T05:00:00.000Z',
    sourceComponent: PRODUCT_OPERATION_SOURCE_COMPONENT,
    mode: 'PRODUCT',
    purpose: GOVERNED_PURPOSES.PRODUCT_ANALYTICS,
    dataClasses: [GOVERNED_DATA_CLASSES.PRODUCT_INTERACTION_METADATA],
    effectiveSensitivity: 'PSEUDONYMOUS',
    identities: {
      profilePseudonymId: 'ppv1_k1_21c135cf2ec5ade8d7d9483d69ca18a5a59b7475fe8ba4576055f890fa1b65dc',
      productSessionId: 'psv1_55555555-5555-4555-8555-555555555555',
      investigationId: null,
      discoveryEpisodeId: null,
    },
    dataset: null,
    runtime: {
      schemaVersion: '1',
      components: {
        applicationBuild: APP,
        deploymentConfiguration: DEPLOYMENT,
        wasmKernel: null,
        representationTreatment: null,
        monetaEngine: null,
        fitnessModel: null,
        nil: null,
        perceptionGestureTreatment: null,
        uiTreatment: UI,
        platformRuntime: PLATFORM,
        ...overrides,
      },
      randomSeeds: {},
    },
    authorization: [{
      schemaVersion: '1',
      basis: 'CONSENT_RECEIPT',
      purpose: GOVERNED_PURPOSES.PRODUCT_ANALYTICS,
      authority: PRODUCT_ANALYTICS_DATA_SERVICE_AUTHORITY_REFERENCE,
      evidence: { id: 'receipt-1', revision: '1', digest: { algorithm: 'SHA256', value: 'e'.repeat(64) } },
      policy: PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE,
    }],
    retention: { schemaVersion: '1', policy: PRODUCT_ANALYTICS_OPERATION_RETENTION_REFERENCE },
    payload,
    payloadDigest: computeGovernedPayloadDigestV1(payload),
  };
  return { ...content, contentDigest: computeGovernedEventContentDigestV1(content) };
}

function authority() {
  return new ReviewedProductAnalyticsRuntimeAuthority({
    schemaVersion: '1',
    applicationBuild: APP,
    deploymentConfiguration: DEPLOYMENT,
    uiTreatment: UI,
    allowedPlatformRuntimes: [{ componentId: PLATFORM.componentId, version: PLATFORM.version }],
  });
}

describe('PT4B8 reviewed deployment runtime authority', () => {
  it('requires exact server-pinned build/deployment/UI references and only allowlisted platform versions', () => {
    const runtime = authority();
    expect(runtime.accepts(envelope())).toBe(true);
    expect(runtime.accepts(envelope({ applicationBuild: { ...APP, version: 'other' } }))).toBe(false);
    expect(runtime.accepts(envelope({ deploymentConfiguration: { ...DEPLOYMENT, artifactDigest: { algorithm: 'SHA256', value: 'f'.repeat(64) } } }))).toBe(false);
    expect(runtime.accepts(envelope({ uiTreatment: { ...UI, componentId: 'other-ui' } }))).toBe(false);
    expect(runtime.accepts(envelope({ platformRuntime: { ...PLATFORM, version: 'unreviewed' } }))).toBe(false);
  });

  it('refuses a runtime mismatch before consent/storage authority and admits a matching runtime to the next authority', async () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), 'nemosyne-pt4b8-runtime-'));
    directories.push(dataDirectory);
    const now = () => new Date('2026-09-03T05:00:00.000Z');
    const deletionHandleKey = { version: 'd1', key: new Uint8Array(32).fill(9) };
    const consent = new SqliteProductAnalyticsConsentAuthority({
      dataDirectory,
      purposePseudonymKey: { version: 'p1', key: new Uint8Array(32).fill(7) },
      deletionHandleKey,
      now,
    });
    const ingestion = new RuntimePinnedProductAnalyticsEventIngestion({
      dataDirectory,
      deletionHandleKey,
      runtimeAuthority: authority(),
      now,
    });
    const principal = { issuer: 'https://issuer.example', subject: 'subject-123' };

    const mismatched = envelope({ applicationBuild: { ...APP, version: 'tampered' } });
    const mismatchResult = await ingestion.ingestLine(principal, JSON.stringify(mismatched));
    expect(mismatchResult).toMatchObject({ status: 'REFUSED_GOVERNANCE', reasonCode: 'RUNTIME_MANIFEST_MISMATCH' });

    const matchingResult = await ingestion.ingestLine(principal, JSON.stringify(envelope()));
    expect(matchingResult).toMatchObject({ status: 'REFUSED_GOVERNANCE', reasonCode: 'CONSENT_REQUIRED' });
    ingestion.close();
    consent.close();
  });
});

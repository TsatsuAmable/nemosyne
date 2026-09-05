import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  DERIVED_GESTURE_NOTICE_REFERENCE,
  GOVERNED_PURPOSES,
  RAW_GESTURE_NOTICE_REFERENCE,
  type AuthorizationEvidenceV1,
  type RuntimeComponentReferenceV1,
  type RuntimeProvenanceV1,
} from '../src/governance/index.ts';
import type { DataPlaneAuthenticatedPrincipalV1, DataPlaneScope } from '../src/governance-service/DataPlaneAccessTokenAuthority.ts';
import {
  GestureLearningHttpServiceV1,
} from '../src/governance-service/GestureLearningHttpService.ts';
import {
  SqliteGestureLearningGovernanceV1,
  type GestureLearningCaptureAuthorizationRequestV1,
  type GestureLearningCaptureAuthorizationV1,
  type GestureLearningEventDispositionV1,
} from '../src/governance-service/GestureLearningGovernance.ts';
import type { GovernanceAuthenticatorV1, GovernanceHttpRequestV1 } from '../src/governance-service/GovernanceHttpService.ts';
import {
  GovernedGestureCaptureUploaderV1,
  type GestureLearningGovernanceTransportV1,
} from '../src/vr/input/GovernedGestureCaptureUploader.ts';

const ORIGIN = 'https://app.nemosyne.test';
const PRINCIPAL = Object.freeze({ issuer: 'https://issuer.example', subject: 'gesture-subject-1' });
const PURPOSE_KEY = Object.freeze({ version: 'p1', key: new Uint8Array(32).fill(7) });
const DELETION_KEY = Object.freeze({ version: 'd1', key: new Uint8Array(32).fill(9) });
const RAW_PROTOCOL: AuthorizationEvidenceV1 = Object.freeze({
  id: 'pt6-raw-protocol-1',
  revision: 'protocol-v1',
  digest: Object.freeze({ algorithm: 'SHA256', value: 'a'.repeat(64) }),
});
const WRONG_PROTOCOL: AuthorizationEvidenceV1 = Object.freeze({
  id: 'pt6-raw-protocol-wrong',
  revision: 'protocol-v1',
  digest: Object.freeze({ algorithm: 'SHA256', value: 'b'.repeat(64) }),
});
const directories: string[] = [];

afterEach(() => {
  for (const value of directories.splice(0)) rmSync(value, { recursive: true, force: true });
});

function directory(): string {
  const value = mkdtempSync(join(tmpdir(), 'nemosyne-pt6c-'));
  directories.push(value);
  return value;
}

function uuidFactory(start = 0): () => string {
  let value = start;
  return () => `00000000-0000-4000-8000-${String(++value).padStart(12, '0')}`;
}

function runtimeRef(id: string, character: string): RuntimeComponentReferenceV1 {
  return Object.freeze({
    schemaVersion: '1',
    componentId: id,
    version: '1.0.0+sha.0123456789abcdef',
    artifactDigest: Object.freeze({ algorithm: 'SHA256', value: character.repeat(64) }),
  });
}

function runtime(): RuntimeProvenanceV1 {
  return Object.freeze({
    schemaVersion: '1',
    components: Object.freeze({
      applicationBuild: runtimeRef('nemosyne-app', '1'),
      deploymentConfiguration: runtimeRef('private-preview', '2'),
      wasmKernel: null,
      representationTreatment: null,
      monetaEngine: null,
      fitnessModel: null,
      nil: null,
      perceptionGestureTreatment: runtimeRef('gesture-treatment', '3'),
      uiTreatment: null,
      platformRuntime: runtimeRef('browser-runtime', '4'),
    }),
    randomSeeds: Object.freeze({}),
  });
}

function authenticated(scope: DataPlaneScope): DataPlaneAuthenticatedPrincipalV1 {
  return Object.freeze({
    issuer: PRINCIPAL.issuer,
    subject: PRINCIPAL.subject,
    tokenId: `token-${scope}`,
    scopes: new Set([scope]),
    issuedAt: 1,
    expiresAt: 2,
  });
}

const AUTHENTICATOR: GovernanceAuthenticatorV1 = Object.freeze({
  async authenticate(_authorizationHeader: string, requiredScope: DataPlaneScope) {
    return authenticated(requiredScope);
  },
});

function request(
  method: string,
  path: string,
  body: unknown = null,
  contentType = 'application/json',
  authorizationValues: readonly string[] = ['Bearer test-token'],
): GovernanceHttpRequestV1 {
  const bytes = body === null
    ? new Uint8Array()
    : new TextEncoder().encode(typeof body === 'string' ? body : JSON.stringify(body));
  return Object.freeze({
    method,
    path,
    origin: ORIGIN,
    authorizationValues,
    contentType: body === null ? null : contentType,
    contentEncoding: null,
    sourceId: '127.0.0.1',
    readBody: async () => bytes,
  });
}

function createHarness(nowRef: { value: Date }) {
  const governance = new SqliteGestureLearningGovernanceV1({
    dataDirectory: directory(),
    purposePseudonymKey: PURPOSE_KEY,
    deletionHandleKey: DELETION_KEY,
    rawProtocolEvidence: RAW_PROTOCOL,
    now: () => nowRef.value,
    uuid: uuidFactory(100),
  });
  const service = new GestureLearningHttpServiceV1({
    allowedOrigins: [ORIGIN],
    authenticator: AUTHENTICATOR,
    governance,
  });
  return { governance, service };
}

async function grantDerived(service: GestureLearningHttpServiceV1, actionId = '10000000-0000-4000-8000-000000000001') {
  const response = await service.dispatch(request('POST', '/v1/governance/gesture-learning/derived/grants', {
    schemaVersion: '1',
    purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
    notice: DERIVED_GESTURE_NOTICE_REFERENCE,
    confirmed: true,
    actionId,
    expectedPriorRevision: null,
  }));
  expect(response.status).toBe(200);
  return JSON.parse(response.body) as { revision: string; profilePseudonymId: string };
}

async function grantRaw(service: GestureLearningHttpServiceV1, actionId = '10000000-0000-4000-8000-000000000002') {
  const response = await service.dispatch(request('POST', '/v1/governance/gesture-learning/raw/grants', {
    schemaVersion: '1',
    purpose: GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH,
    notice: RAW_GESTURE_NOTICE_REFERENCE,
    confirmed: true,
    actionId,
    expectedPriorRevision: null,
  }));
  expect(response.status).toBe(200);
  return JSON.parse(response.body) as { revision: string; profilePseudonymId: string };
}

function transport(service: GestureLearningHttpServiceV1): GestureLearningGovernanceTransportV1 {
  return Object.freeze({
    async authorizeCapture(captureRequest: GestureLearningCaptureAuthorizationRequestV1): Promise<GestureLearningCaptureAuthorizationV1> {
      const response = await service.dispatch(request('POST', '/v1/governance/gesture-learning/capture-authorizations', captureRequest));
      if (response.status !== 200) throw new Error(`capture authorization failed: ${response.status} ${response.body}`);
      return JSON.parse(response.body) as GestureLearningCaptureAuthorizationV1;
    },
    async ingestLine(jsonText: string): Promise<GestureLearningEventDispositionV1> {
      const response = await service.dispatch(request('POST', '/v1/governed-events/gesture-learning/batches', `${jsonText}\n`, 'application/x-ndjson'));
      if (response.status !== 200) throw new Error(`ingestion failed: ${response.status} ${response.body}`);
      return (JSON.parse(response.body) as { dispositions: GestureLearningEventDispositionV1[] }).dispositions[0]!;
    },
  });
}

describe('PT6C governed gesture-learning collection and lifecycle', () => {
  it('keeps Product/L2/L3 authority separated and requires exact frozen protocol evidence for raw capture', async () => {
    const nowRef = { value: new Date('2026-09-05T06:00:00.000Z') };
    const { governance, service } = createHarness(nowRef);

    const unauthenticated = await service.dispatch(request('GET', '/v1/governance/gesture-learning/derived/current', null, 'application/json', []));
    expect(unauthenticated.status).toBe(401);

    await grantDerived(service);
    const rawWithoutRawConsent = await service.dispatch(request('POST', '/v1/governance/gesture-learning/capture-authorizations', {
      schemaVersion: '1',
      familyId: 'gesture.raw-trajectory-research.v1',
      eventId: '20000000-0000-4000-8000-000000000001',
      producerInstanceId: 'piv1_30000000-0000-4000-8000-000000000001',
      streamId: 'strv1_40000000-0000-4000-8000-000000000001',
      streamSequence: 0,
      protocolEvidence: RAW_PROTOCOL,
    }));
    expect(rawWithoutRawConsent.status).toBe(403);
    expect(JSON.parse(rawWithoutRawConsent.body)).toMatchObject({ code: 'CONSENT_REQUIRED' });

    await grantRaw(service);
    const missingProtocol = await service.dispatch(request('POST', '/v1/governance/gesture-learning/capture-authorizations', {
      schemaVersion: '1',
      familyId: 'gesture.raw-trajectory-research.v1',
      eventId: '20000000-0000-4000-8000-000000000002',
      producerInstanceId: 'piv1_30000000-0000-4000-8000-000000000001',
      streamId: 'strv1_40000000-0000-4000-8000-000000000001',
      streamSequence: 0,
      protocolEvidence: null,
    }));
    expect(missingProtocol.status).toBe(403);
    expect(JSON.parse(missingProtocol.body)).toMatchObject({ code: 'PROTOCOL_REQUIRED' });

    const wrongProtocol = await service.dispatch(request('POST', '/v1/governance/gesture-learning/capture-authorizations', {
      schemaVersion: '1',
      familyId: 'gesture.raw-trajectory-research.v1',
      eventId: '20000000-0000-4000-8000-000000000003',
      producerInstanceId: 'piv1_30000000-0000-4000-8000-000000000001',
      streamId: 'strv1_40000000-0000-4000-8000-000000000001',
      streamSequence: 0,
      protocolEvidence: WRONG_PROTOCOL,
    }));
    expect(wrongProtocol.status).toBe(403);
    expect(JSON.parse(wrongProtocol.body)).toMatchObject({ code: 'PROTOCOL_REQUIRED' });

    const validProtocol = await service.dispatch(request('POST', '/v1/governance/gesture-learning/capture-authorizations', {
      schemaVersion: '1',
      familyId: 'gesture.raw-trajectory-research.v1',
      eventId: '20000000-0000-4000-8000-000000000004',
      producerInstanceId: 'piv1_30000000-0000-4000-8000-000000000001',
      streamId: 'strv1_40000000-0000-4000-8000-000000000001',
      streamSequence: 0,
      protocolEvidence: RAW_PROTOCOL,
    }));
    expect(validProtocol.status).toBe(200);

    governance.close();
  });

  it('stores derived and raw families through the governed uploader, normalizes legacy raw timestamps, and never cross-exports purposes', async () => {
    const nowRef = { value: new Date('2026-09-05T06:00:00.000Z') };
    const { governance, service } = createHarness(nowRef);
    const derivedGrant = await grantDerived(service);
    const rawGrant = await grantRaw(service);
    expect(derivedGrant.profilePseudonymId).not.toBe(rawGrant.profilePseudonymId);

    const uploader = new GovernedGestureCaptureUploaderV1({
      transport: transport(service),
      runtime: runtime(),
      producerInstanceId: 'piv1_30000000-0000-4000-8000-000000000010',
      derivedStreamId: 'strv1_40000000-0000-4000-8000-000000000010',
      rawStreamId: 'strv1_40000000-0000-4000-8000-000000000011',
      uuid: uuidFactory(200),
    });

    await expect(uploader.uploadDerived({
      features: new Array(56).fill(0),
      labelCode: 'CONFIRM:idle',
      evidenceId: 'explicit-confirmation-1',
      recordedAt: '2026-09-05T06:00:00.000Z',
    })).resolves.toMatchObject({ status: 'STORED' });

    await expect(uploader.uploadRaw({
      left: [
        { x: 0, y: 1, z: 2, pinched: false, t: 1_000 },
        { x: 0.1, y: 1.1, z: 2.1, pinched: true, t: 1_010 },
      ],
      right: [
        { x: 3, y: 4, z: 5, pinched: false, t: 1_005 },
        { x: 3.1, y: 4.1, z: 5.1, pinched: true, t: 1_015 },
      ],
      protocolEvidence: RAW_PROTOCOL,
      protocolTargetGesture: 'idle',
    })).resolves.toMatchObject({ status: 'STORED' });

    const derivedExport = governance.exportRecords(PRINCIPAL, {
      schemaVersion: '1',
      actionId: '50000000-0000-4000-8000-000000000001',
      purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
      from: '2026-09-05T05:59:00.000Z',
      to: '2026-09-05T06:01:00.000Z',
    });
    const rawExport = governance.exportRecords(PRINCIPAL, {
      schemaVersion: '1',
      actionId: '50000000-0000-4000-8000-000000000002',
      purpose: GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH,
      from: '2026-09-05T05:59:00.000Z',
      to: '2026-09-05T06:01:00.000Z',
    });
    expect(derivedExport.recordCount).toBe(1);
    expect(rawExport.recordCount).toBe(1);
    expect(derivedExport.body).toContain('gesture.derived-observation.v1');
    expect(derivedExport.body).not.toContain('gesture.raw-trajectory-research.v1');
    expect(rawExport.body).toContain('gesture.raw-trajectory-research.v1');
    expect(rawExport.body).not.toContain('gesture.derived-observation.v1');

    const rawLines = rawExport.body.trimEnd().split('\n').map((line) => JSON.parse(line));
    expect(rawLines[1].envelope.payload.left.map((point: { dtMs: number }) => point.dtMs)).toEqual([0, 10]);
    expect(rawLines[1].envelope.payload.right.map((point: { dtMs: number }) => point.dtMs)).toEqual([5, 15]);
    expect(rawLines[1].envelope.identities.profilePseudonymId).toBe(rawGrant.profilePseudonymId);

    nowRef.value = new Date('2026-09-20T06:00:00.001Z');
    const retained = governance.runRetention();
    expect(retained.purgedEvents).toBe(1);
    expect(governance.exportRecords(PRINCIPAL, {
      schemaVersion: '1',
      actionId: '50000000-0000-4000-8000-000000000003',
      purpose: GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH,
      from: '2026-09-05T05:59:00.000Z',
      to: '2026-09-20T06:01:00.000Z',
    }).recordCount).toBe(0);
    expect(governance.exportRecords(PRINCIPAL, {
      schemaVersion: '1',
      actionId: '50000000-0000-4000-8000-000000000004',
      purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
      from: '2026-09-05T05:59:00.000Z',
      to: '2026-09-20T06:01:00.000Z',
    }).recordCount).toBe(1);

    governance.close();
  });

  it('invalidates queued capture on revocation and erases only the exact revoked purpose scope', async () => {
    const nowRef = { value: new Date('2026-09-05T06:00:00.000Z') };
    const { governance, service } = createHarness(nowRef);
    const derivedGrant = await grantDerived(service);
    await grantRaw(service);

    const uploader = new GovernedGestureCaptureUploaderV1({
      transport: transport(service),
      runtime: runtime(),
      producerInstanceId: 'piv1_30000000-0000-4000-8000-000000000020',
      derivedStreamId: 'strv1_40000000-0000-4000-8000-000000000020',
      rawStreamId: 'strv1_40000000-0000-4000-8000-000000000021',
      uuid: uuidFactory(300),
    });
    await uploader.uploadDerived({
      features: new Array(56).fill(0.25),
      labelCode: 'CORRECT:idle->pinchTogether',
      evidenceId: 'explicit-correction-1',
      recordedAt: '2026-09-05T06:00:00.000Z',
    });
    await uploader.uploadRaw({
      left: [{ x: 0, y: 0, z: 0, pinched: false, t: 10 }],
      right: [{ x: 0, y: 0, z: 0, pinched: false, t: 10 }],
      protocolEvidence: RAW_PROTOCOL,
    });

    const pending = governance.authorizeCapture(PRINCIPAL, {
      schemaVersion: '1',
      familyId: 'gesture.derived-observation.v1',
      eventId: '60000000-0000-4000-8000-000000000001',
      producerInstanceId: 'piv1_30000000-0000-4000-8000-000000000020',
      streamId: 'strv1_40000000-0000-4000-8000-000000000020',
      streamSequence: 1,
      protocolEvidence: null,
    });
    expect(pending.profilePseudonymId).toBe(derivedGrant.profilePseudonymId);

    const revokedResponse = await service.dispatch(request('POST', '/v1/governance/gesture-learning/derived/revocations', {
      schemaVersion: '1',
      purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
      actionId: '70000000-0000-4000-8000-000000000001',
      expectedCurrentRevision: derivedGrant.revision,
    }));
    expect(revokedResponse.status).toBe(200);
    const revoked = JSON.parse(revokedResponse.body) as { revision: string; status: string };
    expect(revoked.status).toBe('DENIED');

    expect(() => governance.authorizeCapture(PRINCIPAL, {
      schemaVersion: '1',
      familyId: 'gesture.derived-observation.v1',
      eventId: '60000000-0000-4000-8000-000000000002',
      producerInstanceId: 'piv1_30000000-0000-4000-8000-000000000020',
      streamId: 'strv1_40000000-0000-4000-8000-000000000020',
      streamSequence: 1,
      protocolEvidence: null,
    })).toThrow(/consent is required/i);

    const erased = governance.erase(PRINCIPAL, {
      schemaVersion: '1',
      actionId: '80000000-0000-4000-8000-000000000001',
      purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
      expectedConsentRevision: revoked.revision,
    });
    expect(erased.result).toBe('SERVICE_SCOPE_RESOLVED');
    expect(erased.erasedEvents).toBe(1);
    expect(governance.erase(PRINCIPAL, {
      schemaVersion: '1',
      actionId: '80000000-0000-4000-8000-000000000001',
      purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
      expectedConsentRevision: revoked.revision,
    })).toEqual(erased);

    expect(governance.exportRecords(PRINCIPAL, {
      schemaVersion: '1',
      actionId: '90000000-0000-4000-8000-000000000001',
      purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
      from: '2026-09-05T05:59:00.000Z',
      to: '2026-09-05T06:01:00.000Z',
    }).recordCount).toBe(0);
    expect(governance.exportRecords(PRINCIPAL, {
      schemaVersion: '1',
      actionId: '90000000-0000-4000-8000-000000000002',
      purpose: GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH,
      from: '2026-09-05T05:59:00.000Z',
      to: '2026-09-05T06:01:00.000Z',
    }).recordCount).toBe(1);

    governance.close();
  });
});

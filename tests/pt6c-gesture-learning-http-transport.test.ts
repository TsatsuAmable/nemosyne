import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  DERIVED_GESTURE_NOTICE_REFERENCE,
  GOVERNED_PURPOSES,
  type AuthorizationEvidenceV1,
  type RuntimeComponentReferenceV1,
  type RuntimeProvenanceV1,
} from '../src/governance/index.ts';
import {
  HttpGestureLearningGovernanceTransportV1,
} from '../src/app/governance/GestureLearningClient.ts';
import type { DataPlaneAuthenticatedPrincipalV1, DataPlaneScope } from '../src/governance-service/DataPlaneAccessTokenAuthority.ts';
import { GestureLearningHttpServiceV1 } from '../src/governance-service/GestureLearningHttpService.ts';
import { SqliteGestureLearningGovernanceV1 } from '../src/governance-service/GestureLearningGovernance.ts';
import type { GovernanceAuthenticatorV1, GovernanceHttpRequestV1 } from '../src/governance-service/GovernanceHttpService.ts';
import { GovernedGestureCaptureUploaderV1 } from '../src/vr/input/GovernedGestureCaptureUploader.ts';

const APP_ORIGIN = 'https://app.nemosyne.test';
const SERVICE_ENDPOINT = 'https://governance.nemosyne.test';
const PRINCIPAL = Object.freeze({ issuer: 'https://issuer.example', subject: 'http-transport-subject' });
const RAW_PROTOCOL: AuthorizationEvidenceV1 = Object.freeze({
  id: 'pt6-http-raw-protocol',
  revision: 'protocol-v1',
  digest: Object.freeze({ algorithm: 'SHA256', value: 'a'.repeat(64) }),
});
const directories: string[] = [];

afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

function directory(): string {
  const path = mkdtempSync(join(tmpdir(), 'nemosyne-pt6c-http-'));
  directories.push(path);
  return path;
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
  async authenticate(authorizationHeader: string, requiredScope: DataPlaneScope) {
    if (authorizationHeader !== 'Bearer pt6-http-token') throw new Error('bad bearer');
    return authenticated(requiredScope);
  },
});

function serviceFetch(service: GestureLearningHttpServiceV1): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
    const headers = new Headers(init?.headers);
    const authorization = headers.get('authorization');
    const body = typeof init?.body === 'string' ? new TextEncoder().encode(init.body) : new Uint8Array();
    const request: GovernanceHttpRequestV1 = Object.freeze({
      method: init?.method ?? 'GET',
      path: url.pathname,
      origin: APP_ORIGIN,
      authorizationValues: authorization ? [authorization] : [],
      contentType: headers.get('content-type'),
      contentEncoding: headers.get('content-encoding'),
      sourceId: '127.0.0.1',
      readBody: async () => body,
    });
    const result = await service.dispatch(request);
    return new Response(result.body, { status: result.status, headers: result.headers });
  }) as typeof fetch;
}

describe('PT6C browser-to-governance transport', () => {
  it('carries a derived observation through bearer-authenticated HTTP-shaped capture and admission', async () => {
    const governance = new SqliteGestureLearningGovernanceV1({
      dataDirectory: directory(),
      purposePseudonymKey: Object.freeze({ version: 'p1', key: new Uint8Array(32).fill(7) }),
      deletionHandleKey: Object.freeze({ version: 'd1', key: new Uint8Array(32).fill(9) }),
      rawProtocolEvidence: RAW_PROTOCOL,
      now: () => new Date('2026-09-05T06:00:00.000Z'),
      uuid: uuidFactory(100),
    });
    governance.grant(PRINCIPAL, {
      schemaVersion: '1',
      purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
      notice: DERIVED_GESTURE_NOTICE_REFERENCE,
      confirmed: true,
      actionId: '10000000-0000-4000-8000-000000000001',
      expectedPriorRevision: null,
    });
    const service = new GestureLearningHttpServiceV1({
      allowedOrigins: [APP_ORIGIN],
      authenticator: AUTHENTICATOR,
      governance,
    });
    const transport = new HttpGestureLearningGovernanceTransportV1({
      endpoint: SERVICE_ENDPOINT,
      oidc: Object.freeze({ bearer: async () => 'pt6-http-token' }),
      fetchImpl: serviceFetch(service),
    });
    const uploader = new GovernedGestureCaptureUploaderV1({
      transport,
      runtime: runtime(),
      producerInstanceId: 'piv1_30000000-0000-4000-8000-000000000001',
      derivedStreamId: 'strv1_40000000-0000-4000-8000-000000000001',
      rawStreamId: 'strv1_40000000-0000-4000-8000-000000000002',
      uuid: uuidFactory(200),
    });

    await expect(uploader.uploadDerived({
      features: new Array(56).fill(0),
      labelCode: 'CONFIRM:idle',
      evidenceId: 'http-production-path-confirmation',
      recordedAt: '2026-09-05T06:00:00.000Z',
    })).resolves.toMatchObject({ status: 'STORED' });

    expect(governance.exportRecords(PRINCIPAL, {
      schemaVersion: '1',
      actionId: '50000000-0000-4000-8000-000000000001',
      purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
      from: '2026-09-05T05:59:00.000Z',
      to: '2026-09-05T06:01:00.000Z',
    }).recordCount).toBe(1);
    governance.close();
  });

  it('fails closed when the capture response is rebound to another event', async () => {
    const transport = new HttpGestureLearningGovernanceTransportV1({
      endpoint: SERVICE_ENDPOINT,
      oidc: Object.freeze({ bearer: async () => 'pt6-http-token' }),
      fetchImpl: (async () => new Response(JSON.stringify({
        schemaVersion: '1',
        authorizationId: 'glav1_bad',
        purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
        familyId: 'gesture.derived-observation.v1',
        eventId: '20000000-0000-4000-8000-000000000099',
        producerInstanceId: 'piv1_30000000-0000-4000-8000-000000000001',
        streamId: 'strv1_40000000-0000-4000-8000-000000000001',
        streamSequence: 0,
        receipt: { id: 'x', revision: '1', digest: { algorithm: 'SHA256', value: 'a'.repeat(64) } },
        protocolEvidence: null,
        profilePseudonymId: 'ppv1_bad',
        authorizedAt: '2026-09-05T06:00:00.000Z',
        expiresAt: '2026-09-05T06:00:30.000Z',
      }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch,
    });
    await expect(transport.authorizeCapture({
      schemaVersion: '1',
      familyId: 'gesture.derived-observation.v1',
      eventId: '20000000-0000-4000-8000-000000000001',
      producerInstanceId: 'piv1_30000000-0000-4000-8000-000000000001',
      streamId: 'strv1_40000000-0000-4000-8000-000000000001',
      streamSequence: 0,
      protocolEvidence: null,
    })).rejects.toThrow(/INVALID_CAPTURE_AUTHORIZATION_RESPONSE/);
  });
});

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
  SqliteGestureLearningGovernanceV1,
  type GestureLearningCaptureAuthorizationRequestV1,
  type GestureLearningCaptureAuthorizationV1,
  type GestureLearningEventDispositionV1,
} from '../src/governance-service/GestureLearningGovernance.ts';
import {
  GovernedGestureCaptureUploaderV1,
  type GestureLearningGovernanceTransportV1,
} from '../src/vr/input/GovernedGestureCaptureUploader.ts';

const PRINCIPAL = Object.freeze({ issuer: 'https://issuer.example', subject: 'ambiguous-delivery-subject' });
const RAW_PROTOCOL: AuthorizationEvidenceV1 = Object.freeze({
  id: 'pt6-raw-protocol-replay',
  revision: 'protocol-v1',
  digest: Object.freeze({ algorithm: 'SHA256', value: 'a'.repeat(64) }),
});
const directories: string[] = [];

afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

function directory(): string {
  const path = mkdtempSync(join(tmpdir(), 'nemosyne-pt6c-replay-'));
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

describe('PT6C ambiguous delivery recovery', () => {
  it('replays the exact envelope after a commit-with-lost-response before accepting a new event', async () => {
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

    let loseFirstResponse = true;
    const transport: GestureLearningGovernanceTransportV1 = Object.freeze({
      async authorizeCapture(request: GestureLearningCaptureAuthorizationRequestV1): Promise<GestureLearningCaptureAuthorizationV1> {
        return governance.authorizeCapture(PRINCIPAL, request);
      },
      async ingestLine(jsonText: string): Promise<GestureLearningEventDispositionV1> {
        const disposition = await governance.ingestLine(PRINCIPAL, jsonText);
        if (loseFirstResponse) {
          loseFirstResponse = false;
          throw new Error('simulated response loss after commit');
        }
        return disposition;
      },
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
      evidenceId: 'first-logical-observation',
      recordedAt: '2026-09-05T06:00:00.000Z',
    })).rejects.toThrow(/response loss/i);

    expect(governance.exportRecords(PRINCIPAL, {
      schemaVersion: '1',
      actionId: '50000000-0000-4000-8000-000000000001',
      purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
      from: '2026-09-05T05:59:00.000Z',
      to: '2026-09-05T06:01:00.000Z',
    }).recordCount).toBe(1);

    await expect(uploader.uploadDerived({
      features: new Array(56).fill(0.5),
      labelCode: 'CONFIRM:idle',
      evidenceId: 'must-not-be-used-while-replaying',
      recordedAt: '2026-09-05T06:00:00.000Z',
    })).resolves.toMatchObject({ status: 'EXACT_DUPLICATE' });

    expect(governance.exportRecords(PRINCIPAL, {
      schemaVersion: '1',
      actionId: '50000000-0000-4000-8000-000000000002',
      purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
      from: '2026-09-05T05:59:00.000Z',
      to: '2026-09-05T06:01:00.000Z',
    }).recordCount).toBe(1);

    await expect(uploader.uploadDerived({
      features: new Array(56).fill(0.5),
      labelCode: 'CONFIRM:idle',
      evidenceId: 'second-logical-observation',
      recordedAt: '2026-09-05T06:00:00.000Z',
    })).resolves.toMatchObject({ status: 'STORED' });

    expect(governance.exportRecords(PRINCIPAL, {
      schemaVersion: '1',
      actionId: '50000000-0000-4000-8000-000000000003',
      purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
      from: '2026-09-05T05:59:00.000Z',
      to: '2026-09-05T06:01:00.000Z',
    }).recordCount).toBe(2);
    governance.close();
  });

  it('rejects an oversized raw trajectory before capture authority is allocated', async () => {
    let authorizeCalls = 0;
    const transport: GestureLearningGovernanceTransportV1 = Object.freeze({
      async authorizeCapture(): Promise<GestureLearningCaptureAuthorizationV1> {
        authorizeCalls += 1;
        throw new Error('must not allocate authority');
      },
      async ingestLine(): Promise<GestureLearningEventDispositionV1> {
        throw new Error('must not ingest');
      },
    });
    const uploader = new GovernedGestureCaptureUploaderV1({
      transport,
      runtime: runtime(),
      producerInstanceId: 'piv1_30000000-0000-4000-8000-000000000010',
      derivedStreamId: 'strv1_40000000-0000-4000-8000-000000000010',
      rawStreamId: 'strv1_40000000-0000-4000-8000-000000000011',
      uuid: uuidFactory(300),
    });
    const tooMany = Array.from({ length: 61 }, (_, index) => ({ x: 0, y: 0, z: 0, pinched: false, t: index }));
    await expect(uploader.uploadRaw({ left: tooMany, right: tooMany, protocolEvidence: RAW_PROTOCOL }))
      .rejects.toThrow(/1-60 samples per hand/i);
    expect(authorizeCalls).toBe(0);
  });
});

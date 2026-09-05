import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE,
  DERIVED_GESTURE_NOTICE_REFERENCE,
  GOVERNED_PURPOSES,
  type AuthorizationEvidenceV1,
  type RuntimeComponentReferenceV1,
  type RuntimeProvenanceV1,
} from '../src/governance/index.ts';
import { SqliteGestureLearningGovernanceV1 } from '../src/governance-service/GestureLearningGovernance.ts';
import { SqliteGestureTrainingSnapshotSourceV1 } from '../src/governance-service/SqliteGestureTrainingSnapshotSource.ts';
import {
  GestureTrainingFeatureDatasetError,
  resolveGestureTrainingFeatureDatasetV1,
} from '../src/learning/GestureTrainingFeatureDataset.ts';
import {
  materializeGestureTrainingSnapshotV1,
  type GestureTrainingSnapshotSourceV1,
} from '../src/learning/GestureTrainingSnapshotMaterializer.ts';
import {
  GovernedGestureCaptureUploaderV1,
  type GestureLearningGovernanceTransportV1,
} from '../src/vr/input/GovernedGestureCaptureUploader.ts';

const PURPOSE_KEY = Object.freeze({ version: 'p1', key: new Uint8Array(32).fill(7) });
const DELETION_KEY = Object.freeze({ version: 'd1', key: new Uint8Array(32).fill(9) });
const RAW_PROTOCOL: AuthorizationEvidenceV1 = Object.freeze({
  id: 'pt8-raw-protocol-1',
  revision: 'protocol-v1',
  digest: Object.freeze({ algorithm: 'SHA256', value: 'a'.repeat(64) }),
});
const CREATED_AT = '2026-09-05T08:00:00.000Z';
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function dataDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'nemosyne-pt8-features-'));
  directories.push(directory);
  return directory;
}

function uuidFactory(start: number): () => string {
  let value = start;
  return () => `00000000-0000-4000-8000-${String(++value).padStart(12, '0')}`;
}

function uuid(prefix: number, tail: number): string {
  return `${String(prefix).padStart(8, '0')}-0000-4000-8000-${String(tail).padStart(12, '0')}`;
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

function transportFor(
  governance: SqliteGestureLearningGovernanceV1,
  principal: Readonly<{ issuer: string; subject: string }>,
): GestureLearningGovernanceTransportV1 {
  return Object.freeze<GestureLearningGovernanceTransportV1>({
    async authorizeCapture(request) {
      return governance.authorizeCapture(principal, request);
    },
    async ingestLine(jsonText) {
      return governance.ingestLine(principal, jsonText);
    },
  });
}

async function seed(governance: SqliteGestureLearningGovernanceV1): Promise<void> {
  for (let index = 0; index < 6; index += 1) {
    const principal = Object.freeze({ issuer: 'https://issuer.example', subject: `pt8-user-${index + 1}` });
    governance.grant(principal, {
      schemaVersion: '1',
      purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
      notice: DERIVED_GESTURE_NOTICE_REFERENCE,
      confirmed: true,
      actionId: uuid(20_000_000 + index, index + 1),
      expectedPriorRevision: null,
    });
    const uploader = new GovernedGestureCaptureUploaderV1({
      transport: transportFor(governance, principal),
      runtime: runtime(),
      producerInstanceId: `piv1_${uuid(30_000_000 + index, index + 1)}`,
      derivedStreamId: `strv1_${uuid(40_000_000 + index, index + 1)}`,
      rawStreamId: `strv1_${uuid(50_000_000 + index, index + 1)}`,
      uuid: uuidFactory(10_000 + index * 100),
    });
    await uploader.uploadDerived({
      features: new Array(56).fill(index / 10),
      labelCode: index % 2 === 0 ? 'CONFIRM:idle' : 'CORRECT:pinchTogether->pinchApart',
      evidenceId: `pt8-label-${index + 1}-a`,
      recordedAt: CREATED_AT,
    });
    await uploader.uploadDerived({
      features: new Array(56).fill(index / 20),
      labelCode: 'CONFIRM:scoopUp',
      evidenceId: `pt8-label-${index + 1}-b`,
      recordedAt: CREATED_AT,
    });
  }
}

function snapshotOptions() {
  return {
    snapshotId: 'gesture-training-pt8-fixture',
    snapshotVersion: '1.0.0',
    createdAt: CREATED_AT,
    splitSeed: 'pt8-profile-split-fixture',
    validationFraction: 0.2,
    testFraction: 0.2,
  } as const;
}

describe('PT8 governed feature resolution', () => {
  it('resolves only exact immutable snapshot members back to governed L2 features', async () => {
    const directory = dataDirectory();
    const governance = new SqliteGestureLearningGovernanceV1({
      dataDirectory: directory,
      purposePseudonymKey: PURPOSE_KEY,
      deletionHandleKey: DELETION_KEY,
      rawProtocolEvidence: RAW_PROTOCOL,
      now: () => new Date(CREATED_AT),
      uuid: uuidFactory(500_000),
    });
    await seed(governance);
    const source = new SqliteGestureTrainingSnapshotSourceV1({ dataDirectory: directory });
    const snapshot = await materializeGestureTrainingSnapshotV1(source, snapshotOptions());
    const dataset = await resolveGestureTrainingFeatureDatasetV1(source, snapshot);

    const expectedCount = (['train', 'validation', 'test'] as const)
      .reduce((sum, split) => sum + snapshot.splits[split].samples.length, 0);
    const actualCount = (['train', 'validation', 'test'] as const)
      .reduce((sum, split) => sum + dataset.splits[split].length, 0);
    expect(actualCount).toBe(expectedCount);
    expect(dataset.featureSchema).toEqual(DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE);
    expect(dataset.splits.train.every((row) => row.features.length === 56)).toBe(true);
    expect(dataset.datasetDigest.value).toMatch(/^[0-9a-f]{64}$/);

    const projected = await source.readDerivedLearningRecords({
      schemaVersion: '1',
      asOf: CREATED_AT,
      maxRecords: expectedCount,
    });
    const reboundSource: GestureTrainingSnapshotSourceV1 = Object.freeze({
      async readDerivedLearningRecords() {
        return projected.map((record, index) => index === 0
          ? { ...record, eventId: projected[1].eventId }
          : record);
      },
    });
    await expect(resolveGestureTrainingFeatureDatasetV1(reboundSource, snapshot))
      .rejects.toBeInstanceOf(GestureTrainingFeatureDatasetError);

    source.close();
    governance.close();
  });
});

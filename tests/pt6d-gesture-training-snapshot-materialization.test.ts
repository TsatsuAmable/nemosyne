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
import {
  SqliteGestureLearningGovernanceV1,
} from '../src/governance-service/GestureLearningGovernance.ts';
import {
  SqliteGestureTrainingSnapshotSourceV1,
} from '../src/governance-service/SqliteGestureTrainingSnapshotSource.ts';
import {
  GestureTrainingMaterializationError,
  materializeGestureTrainingSnapshotV1,
  type GestureTrainingSnapshotSourceV1,
} from '../src/learning/GestureTrainingSnapshotMaterializer.ts';
import {
  GovernedGestureCaptureUploaderV1,
  type GestureLearningGovernanceTransportV1,
} from '../src/vr/input/GovernedGestureCaptureUploader.ts';
import { validateGestureTrainingSnapshotV1 } from '../src/vr/input/GestureLearningContracts.ts';

const PURPOSE_KEY = Object.freeze({ version: 'p1', key: new Uint8Array(32).fill(7) });
const DELETION_KEY = Object.freeze({ version: 'd1', key: new Uint8Array(32).fill(9) });
const RAW_PROTOCOL: AuthorizationEvidenceV1 = Object.freeze({
  id: 'pt6d-raw-protocol-1',
  revision: 'protocol-v1',
  digest: Object.freeze({ algorithm: 'SHA256', value: 'a'.repeat(64) }),
});
const CREATED_AT = '2026-09-05T07:00:00.000Z';
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function dataDirectory(): string {
  const value = mkdtempSync(join(tmpdir(), 'nemosyne-pt6d-'));
  directories.push(value);
  return value;
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
  return Object.freeze({
    async authorizeCapture(request) {
      return governance.authorizeCapture(principal, request);
    },
    async ingestLine(jsonText) {
      return governance.ingestLine(principal, jsonText);
    },
  });
}

async function seedDerivedProfiles(
  governance: SqliteGestureLearningGovernanceV1,
  count = 6,
): Promise<readonly Readonly<{ issuer: string; subject: string }>[]> {
  const principals: Readonly<{ issuer: string; subject: string }>[] = [];
  for (let index = 0; index < count; index += 1) {
    const principal = Object.freeze({ issuer: 'https://issuer.example', subject: `pt6d-user-${index + 1}` });
    principals.push(principal);
    governance.grant(principal, {
      schemaVersion: '1',
      purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
      notice: DERIVED_GESTURE_NOTICE_REFERENCE,
      confirmed: true,
      actionId: uuid(10_000_000 + index, index + 1),
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
    await expect(uploader.uploadDerived({
      features: new Array(56).fill(index / 10),
      labelCode: index % 2 === 0 ? 'CONFIRM:idle' : 'CORRECT:pinchTogether->pinchApart',
      evidenceId: `explicit-gesture-label-${index + 1}-a`,
      recordedAt: CREATED_AT,
    })).resolves.toMatchObject({ status: 'STORED' });
    await expect(uploader.uploadDerived({
      features: new Array(56).fill(index / 20),
      labelCode: 'CONFIRM:scoopUp',
      evidenceId: `explicit-gesture-label-${index + 1}-b`,
      recordedAt: CREATED_AT,
    })).resolves.toMatchObject({ status: 'STORED' });
  }
  return principals;
}

function snapshotOptions() {
  return {
    snapshotId: 'gesture-training-pt6d-fixture',
    snapshotVersion: '1.0.0',
    createdAt: CREATED_AT,
    splitSeed: 'pt6d-profile-split-fixture',
    validationFraction: 0.2,
    testFraction: 0.2,
  } as const;
}

describe('PT6D immutable governed gesture training snapshots', () => {
  it('materializes retained L2 observations into deterministic profile-disjoint immutable snapshots', async () => {
    const directory = dataDirectory();
    const governance = new SqliteGestureLearningGovernanceV1({
      dataDirectory: directory,
      purposePseudonymKey: PURPOSE_KEY,
      deletionHandleKey: DELETION_KEY,
      rawProtocolEvidence: RAW_PROTOCOL,
      now: () => new Date(CREATED_AT),
      uuid: uuidFactory(500_000),
    });
    await seedDerivedProfiles(governance);

    const source = new SqliteGestureTrainingSnapshotSourceV1({ dataDirectory: directory });
    const first = await materializeGestureTrainingSnapshotV1(source, snapshotOptions());
    const second = await materializeGestureTrainingSnapshotV1(source, snapshotOptions());

    expect(first).toEqual(second);
    expect(first.snapshotDigest).toEqual(second.snapshotDigest);
    expect(validateGestureTrainingSnapshotV1(first)).toEqual([]);
    expect(Object.isFrozen(first)).toBe(true);

    const owners = new Map<string, string>();
    let sampleCount = 0;
    for (const splitName of ['train', 'validation', 'test'] as const) {
      for (const profile of first.splits[splitName].profilePseudonymIds) {
        expect(owners.has(profile)).toBe(false);
        owners.set(profile, splitName);
      }
      for (const sample of first.splits[splitName].samples) {
        expect(owners.get(sample.profilePseudonymId)).toBe(splitName);
        expect(sample.consent.purpose).toBe(GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING);
        expect(['EXPLICIT_CONFIRMATION', 'EXPLICIT_CORRECTION']).toContain(sample.label.source);
        sampleCount += 1;
      }
    }
    expect(owners.size).toBe(6);
    expect(sampleCount).toBe(12);

    const projected = await source.readDerivedLearningRecords({ schemaVersion: '1', asOf: CREATED_AT, maxRecords: 100 });
    expect(projected).toHaveLength(12);
    expect(Object.keys(projected[0]).sort()).toEqual(['envelopeJson', 'eventId', 'serverReceivedAt']);
    expect(JSON.stringify(projected)).not.toContain('principal_handle');

    source.close();
    governance.close();
  });

  it('keeps raw L3 research observations out of the training population and refuses them if a source crosses the boundary', async () => {
    const directory = dataDirectory();
    const governance = new SqliteGestureLearningGovernanceV1({
      dataDirectory: directory,
      purposePseudonymKey: PURPOSE_KEY,
      deletionHandleKey: DELETION_KEY,
      rawProtocolEvidence: RAW_PROTOCOL,
      now: () => new Date(CREATED_AT),
      uuid: uuidFactory(600_000),
    });
    const principals = await seedDerivedProfiles(governance);
    const principal = principals[0];
    governance.grant(principal, {
      schemaVersion: '1',
      purpose: GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH,
      notice: RAW_GESTURE_NOTICE_REFERENCE,
      confirmed: true,
      actionId: uuid(70_000_000, 1),
      expectedPriorRevision: null,
    });
    const rawUploader = new GovernedGestureCaptureUploaderV1({
      transport: transportFor(governance, principal),
      runtime: runtime(),
      producerInstanceId: `piv1_${uuid(71_000_000, 1)}`,
      derivedStreamId: `strv1_${uuid(72_000_000, 1)}`,
      rawStreamId: `strv1_${uuid(73_000_000, 1)}`,
      uuid: uuidFactory(700_000),
    });
    await expect(rawUploader.uploadRaw({
      left: [{ x: 0, y: 0, z: 0, pinched: false, t: 1000 }],
      right: [{ x: 0, y: 0, z: 0, pinched: false, t: 1000 }],
      protocolEvidence: RAW_PROTOCOL,
      protocolTargetGesture: 'idle',
    })).resolves.toMatchObject({ status: 'STORED' });

    const source = new SqliteGestureTrainingSnapshotSourceV1({ dataDirectory: directory });
    const snapshot = await materializeGestureTrainingSnapshotV1(source, snapshotOptions());
    const count = (['train', 'validation', 'test'] as const)
      .flatMap((split) => snapshot.splits[split].samples).length;
    expect(count).toBe(12);

    const rawExport = governance.exportRecords(principal, {
      schemaVersion: '1',
      actionId: uuid(74_000_000, 1),
      purpose: GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH,
      from: '2026-09-05T06:59:00.000Z',
      to: '2026-09-05T07:01:00.000Z',
    });
    const rawLine = JSON.parse(rawExport.body.trimEnd().split('\n')[1]) as { serverReceivedAt: string; envelope: { eventId: string } };
    const hostileSource: GestureTrainingSnapshotSourceV1 = Object.freeze({
      async readDerivedLearningRecords() {
        return [{
          eventId: rawLine.envelope.eventId,
          serverReceivedAt: rawLine.serverReceivedAt,
          envelopeJson: JSON.stringify(rawLine.envelope),
        }];
      },
    });

    await expect(materializeGestureTrainingSnapshotV1(hostileSource, snapshotOptions())).rejects.toMatchObject({
      name: 'GestureTrainingMaterializationError',
      issues: expect.arrayContaining([expect.objectContaining({ code: 'WRONG_PURPOSE' })]),
    } satisfies Partial<GestureTrainingMaterializationError>);

    source.close();
    governance.close();
  });

  it('fails closed when the durable source tampers event identity or supplies records newer than the cutoff', async () => {
    const directory = dataDirectory();
    const governance = new SqliteGestureLearningGovernanceV1({
      dataDirectory: directory,
      purposePseudonymKey: PURPOSE_KEY,
      deletionHandleKey: DELETION_KEY,
      rawProtocolEvidence: RAW_PROTOCOL,
      now: () => new Date(CREATED_AT),
      uuid: uuidFactory(800_000),
    });
    await seedDerivedProfiles(governance);
    const source = new SqliteGestureTrainingSnapshotSourceV1({ dataDirectory: directory });
    const rows = await source.readDerivedLearningRecords({ schemaVersion: '1', asOf: CREATED_AT, maxRecords: 100 });

    const reboundSource: GestureTrainingSnapshotSourceV1 = Object.freeze({
      async readDerivedLearningRecords() {
        return [{ ...rows[0], eventId: uuid(90_000_000, 1) }, ...rows.slice(1)];
      },
    });
    await expect(materializeGestureTrainingSnapshotV1(reboundSource, snapshotOptions())).rejects.toMatchObject({
      issues: expect.arrayContaining([expect.objectContaining({ code: 'INVALID_SOURCE_RECORD' })]),
    });

    const futureSource: GestureTrainingSnapshotSourceV1 = Object.freeze({
      async readDerivedLearningRecords() {
        return [{ ...rows[0], serverReceivedAt: '2026-09-05T07:00:00.001Z' }, ...rows.slice(1)];
      },
    });
    await expect(materializeGestureTrainingSnapshotV1(futureSource, snapshotOptions())).rejects.toMatchObject({
      issues: expect.arrayContaining([expect.objectContaining({ code: 'INVALID_SOURCE_RECORD' })]),
    });

    source.close();
    governance.close();
  });
});

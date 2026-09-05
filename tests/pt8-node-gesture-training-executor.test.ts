import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { GESTURE_CLASSES } from '../modules/gesture-intelligence/src/contracts.ts';
import {
  DERIVED_GESTURE_NOTICE_REFERENCE,
  GOVERNED_PURPOSES,
  type AuthorizationEvidenceV1,
  type ImmutableReferenceV1,
  type RuntimeComponentReferenceV1,
  type RuntimeProvenanceV1,
} from '../src/governance/index.ts';
import { SqliteGestureLearningGovernanceV1 } from '../src/governance-service/GestureLearningGovernance.ts';
import { SqliteGestureTrainingSnapshotSourceV1 } from '../src/governance-service/SqliteGestureTrainingSnapshotSource.ts';
import { FileLearningArtifactStoreV1 } from '../src/learning/FileLearningArtifactStore.ts';
import { gestureEvaluationReportReferenceV1 } from '../src/learning/GestureModelUpdateLoop.ts';
import {
  NodeGestureTrainingExecutorV1,
  PT8_GESTURE_TRAINER_ENTRYPOINT,
  type GestureTrainingProcessRunnerV1,
} from '../src/learning/NodeGestureTrainingExecutor.ts';
import {
  buildGestureTrainingDatasetBindingV1,
  buildReproducibleTrainingJobManifestV1,
} from '../src/learning/ReproducibleTrainingJob.ts';
import { materializeGestureTrainingSnapshotV1 } from '../src/learning/GestureTrainingSnapshotMaterializer.ts';
import {
  GovernedGestureCaptureUploaderV1,
  type GestureLearningGovernanceTransportV1,
} from '../src/vr/input/GovernedGestureCaptureUploader.ts';
import { sha256Hex } from '../src/security/CryptoHash.ts';

const PURPOSE_KEY = Object.freeze({ version: 'p1', key: new Uint8Array(32).fill(11) });
const DELETION_KEY = Object.freeze({ version: 'd1', key: new Uint8Array(32).fill(13) });
const RAW_PROTOCOL: AuthorizationEvidenceV1 = Object.freeze({
  id: 'pt8-executor-raw-protocol',
  revision: 'protocol-v1',
  digest: Object.freeze({ algorithm: 'SHA256', value: 'a'.repeat(64) }),
});
const CREATED_AT = '2026-09-05T08:00:00.000Z';
const SOURCE_COMMIT = '1'.repeat(40);
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function directory(): string {
  const value = mkdtempSync(join(tmpdir(), 'nemosyne-pt8-executor-'));
  directories.push(value);
  return value;
}

function ref(id: string, character: string, version = '1.0.0'): ImmutableReferenceV1 {
  return Object.freeze({
    schemaVersion: '1',
    id,
    version,
    digest: Object.freeze({ algorithm: 'SHA256', value: character.repeat(64) }),
  });
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
    const principal = Object.freeze({ issuer: 'https://issuer.example', subject: `pt8-executor-user-${index + 1}` });
    governance.grant(principal, {
      schemaVersion: '1',
      purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
      notice: DERIVED_GESTURE_NOTICE_REFERENCE,
      confirmed: true,
      actionId: uuid(60_000_000 + index, index + 1),
      expectedPriorRevision: null,
    });
    const uploader = new GovernedGestureCaptureUploaderV1({
      transport: transportFor(governance, principal),
      runtime: runtime(),
      producerInstanceId: `piv1_${uuid(61_000_000 + index, index + 1)}`,
      derivedStreamId: `strv1_${uuid(62_000_000 + index, index + 1)}`,
      rawStreamId: `strv1_${uuid(63_000_000 + index, index + 1)}`,
      uuid: uuidFactory(20_000 + index * 100),
    });
    await uploader.uploadDerived({
      features: new Array(56).fill(index / 10),
      labelCode: index % 2 === 0 ? 'CONFIRM:idle' : 'CONFIRM:pinchApart',
      evidenceId: `pt8-executor-label-${index + 1}-a`,
      recordedAt: CREATED_AT,
    });
    await uploader.uploadDerived({
      features: new Array(56).fill(index / 20),
      labelCode: 'CONFIRM:scoopUp',
      evidenceId: `pt8-executor-label-${index + 1}-b`,
      recordedAt: CREATED_AT,
    });
  }
}

interface FeatureRow {
  readonly recordId: string;
  readonly profilePseudonymId: string;
  readonly label: string;
}

function argument(args: readonly string[], name: string): string {
  const index = args.indexOf(name);
  if (index < 0 || index + 1 >= args.length) throw new Error(`missing ${name}`);
  return args[index + 1];
}

function readRows(path: string): readonly FeatureRow[] {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as FeatureRow);
}

class FixtureProcessRunner implements GestureTrainingProcessRunnerV1 {
  readonly calls: Array<Readonly<{ command: string; args: readonly string[]; cwd: string }>> = [];

  run(command: string, args: readonly string[], cwd: string) {
    this.calls.push(Object.freeze({ command, args: Object.freeze([...args]), cwd }));
    const outputDirectory = argument(args, '--output-dir');
    mkdirSync(outputDirectory, { recursive: true });

    if (args[0]?.endsWith('pt8_train.py')) {
      const inputDirectory = argument(args, '--input-dir');
      for (const split of ['validation', 'test'] as const) {
        const rows = readRows(join(inputDirectory, `${split}.jsonl`));
        const predictions = rows.map((row) => JSON.stringify({
          recordId: row.recordId,
          profilePseudonymId: row.profilePseudonymId,
          actualGesture: row.label,
          predictedGesture: row.label,
        })).join('\n');
        writeFileSync(join(outputDirectory, `${split}_predictions.jsonl`), `${predictions}\n`, 'utf8');
      }
      writeFileSync(join(outputDirectory, 'trainer_report.json'), JSON.stringify({
        schemaVersion: 1,
        validationUsedForEarlyStopping: true,
        testEvaluatedAfterWeightsFrozen: true,
      }), 'utf8');
      return Object.freeze({ status: 0, stdout: 'fixture trainer complete', stderr: '' });
    }

    if (args[0]?.endsWith('pt8_export_onnx.py')) {
      const modelBytes = new TextEncoder().encode('pt8-fixture-onnx-candidate');
      writeFileSync(join(outputDirectory, 'gesture_classifier.onnx'), modelBytes);
      writeFileSync(join(outputDirectory, 'model_card.json'), JSON.stringify({
        schemaVersion: 2,
        name: 'gesture_classifier',
        version: argument(args, '--model-version'),
        inputName: 'trajectory',
        outputName: 'probs',
        featureDim: 56,
        classes: GESTURE_CLASSES,
        sha256: sha256Hex(modelBytes),
        promotionDecision: null,
      }), 'utf8');
      return Object.freeze({ status: 0, stdout: 'fixture exporter complete', stderr: '' });
    }

    return Object.freeze({ status: 2, stdout: '', stderr: `unexpected process ${args[0] ?? command}` });
  }
}

function timestamps(): () => string {
  const values = [
    '2026-09-05T08:20:00.000Z',
    '2026-09-05T08:30:00.000Z',
    '2026-09-05T08:31:00.000Z',
    '2026-09-05T08:32:00.000Z',
  ];
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

describe('PT8 concrete Node gesture training executor', () => {
  it('resolves governed features, produces immutable candidate artifacts and returns exact held-out reports without touching runtime assets', async () => {
    const root = directory();
    const governance = new SqliteGestureLearningGovernanceV1({
      dataDirectory: root,
      purposePseudonymKey: PURPOSE_KEY,
      deletionHandleKey: DELETION_KEY,
      rawProtocolEvidence: RAW_PROTOCOL,
      now: () => new Date(CREATED_AT),
      uuid: uuidFactory(900_000),
    });
    await seed(governance);
    const source = new SqliteGestureTrainingSnapshotSourceV1({ dataDirectory: root });
    const snapshot = await materializeGestureTrainingSnapshotV1(source, {
      snapshotId: 'gesture-training-pt8-executor-fixture',
      snapshotVersion: '1.0.0',
      createdAt: CREATED_AT,
      splitSeed: 'pt8-executor-profile-split',
      validationFraction: 0.2,
      testFraction: 0.2,
    });

    const trainingCode = ref('pt8-training-code', 'b');
    const trainer = ref('pt8-python-trainer', 'c');
    const environment = ref('pt8-python-environment', 'd');
    const evaluator = ref('pt8-heldout-evaluator', 'e');
    const manifest = buildReproducibleTrainingJobManifestV1({
      schemaVersion: '1',
      policyVersion: 'reproducible-training-job-v1',
      jobId: 'pt8-concrete-executor-fixture',
      jobVersion: '1.0.0',
      createdAt: '2026-09-05T08:10:00.000Z',
      outputKind: 'GESTURE_MODEL',
      dataset: buildGestureTrainingDatasetBindingV1(snapshot),
      trainingCode,
      sourceCommitSha: SOURCE_COMMIT,
      environment,
      trainer,
      trainerEntrypoint: PT8_GESTURE_TRAINER_ENTRYPOINT,
      runtimeBaseline: ref('pt8-runtime-baseline', 'f'),
      holdoutPolicy: ref('pt8-holdout-policy', '1'),
      config: { deterministic: true },
      randomSeed: 42,
    });
    const runner = new FixtureProcessRunner();
    const executor = new NodeGestureTrainingExecutorV1({
      source,
      artifactStore: new FileLearningArtifactStoreV1({ rootDirectory: join(root, 'artifacts') }),
      workspaceRoot: join(root, 'workspace'),
      pythonExecutable: 'python3',
      trainerScriptPath: '/opt/nemosyne/pt8_train.py',
      exporterScriptPath: '/opt/nemosyne/pt8_export_onnx.py',
      configuredTrainingCode: trainingCode,
      configuredTrainer: trainer,
      configuredEnvironment: environment,
      configuredSourceCommitSha: SOURCE_COMMIT,
      evaluatorArtifact: evaluator,
      processRunner: runner,
      now: timestamps(),
    });

    const result = await executor.execute(manifest, snapshot);

    expect(runner.calls).toHaveLength(2);
    expect(runner.calls.flatMap((call) => call.args).some((entry) => entry.includes('/assets/'))).toBe(false);
    expect(result.receipt.status).toBe('SUCCEEDED');
    expect(result.receipt.outputModel?.id).toMatch(/^gesture-model-bundle-/);
    expect(result.validationReport.accuracy).toBe(1);
    expect(result.testReport.accuracy).toBe(1);
    expect(result.validationReport.modelArtifact).toEqual(result.receipt.outputModel);
    expect(result.testReport.modelArtifact).toEqual(result.receipt.outputModel);
    expect(result.receipt.evaluationReport).toEqual(gestureEvaluationReportReferenceV1(result.testReport));

    source.close();
    governance.close();
  });
});

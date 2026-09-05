import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { GESTURE_CLASSES, type GestureClass } from '../../modules/gesture-intelligence/src/contracts.ts';
import type { ImmutableReferenceV1 } from '../governance/GovernedEventContracts.ts';
import { sha256Hex } from '../security/CryptoHash.ts';
import type { GestureTrainingSnapshotV1 } from '../vr/input/GestureLearningContracts.ts';
import {
  buildGestureEvaluationReportV1,
  type GestureEvaluationObservationV1,
} from './GestureEvaluationReport.ts';
import {
  type GestureTrainingExecutorV1,
  type GestureTrainingExecutionResultV1,
  gestureEvaluationReportReferenceV1,
} from './GestureModelUpdateLoop.ts';
import {
  FileLearningArtifactStoreV1,
  type LearningArtifactDescriptorV1,
} from './FileLearningArtifactStore.ts';
import {
  resolveGestureTrainingFeatureDatasetV1,
  type GestureTrainingFeatureDatasetV1,
  type GestureTrainingFeatureRowV1,
} from './GestureTrainingFeatureDataset.ts';
import type { GestureTrainingSnapshotSourceV1 } from './GestureTrainingSnapshotMaterializer.ts';
import { isImmutableReferenceV1, sameImmutableReferenceV1 } from './LearningContractPrimitives.ts';
import {
  buildTrainingJobReceiptV1,
  trainingJobManifestReferenceV1,
  type ReproducibleTrainingJobManifestV1,
} from './ReproducibleTrainingJob.ts';

export const PT8_GESTURE_TRAINER_ENTRYPOINT = 'nemosyne.gesture.pt8:train+export-onnx:v1' as const;

export interface GestureTrainingProcessResultV1 {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface GestureTrainingProcessRunnerV1 {
  run(command: string, args: readonly string[], cwd: string): GestureTrainingProcessResultV1;
}

export class NodeGestureTrainingProcessRunnerV1 implements GestureTrainingProcessRunnerV1 {
  run(command: string, args: readonly string[], cwd: string): GestureTrainingProcessResultV1 {
    const result = spawnSync(command, [...args], {
      cwd,
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
    });
    return Object.freeze({
      status: result.status ?? -1,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? String(result.error ?? ''),
    });
  }
}

export interface NodeGestureTrainingExecutorOptionsV1 {
  readonly source: GestureTrainingSnapshotSourceV1;
  readonly artifactStore: FileLearningArtifactStoreV1;
  readonly workspaceRoot: string;
  readonly pythonExecutable: string;
  readonly trainerScriptPath: string;
  readonly exporterScriptPath: string;
  readonly configuredTrainingCode: ImmutableReferenceV1;
  readonly configuredTrainer: ImmutableReferenceV1;
  readonly configuredEnvironment: ImmutableReferenceV1;
  readonly configuredSourceCommitSha: string;
  readonly evaluatorArtifact: ImmutableReferenceV1;
  readonly processRunner?: GestureTrainingProcessRunnerV1;
  readonly now?: () => string;
}

export type NodeGestureTrainingExecutionIssueCode =
  | 'CONFIGURATION_MISMATCH'
  | 'TRAINER_FAILED'
  | 'EXPORT_FAILED'
  | 'OUTPUT_MISSING'
  | 'MODEL_CARD_MISMATCH'
  | 'PREDICTION_OUTPUT_INVALID';

export class NodeGestureTrainingExecutionError extends Error {
  constructor(
    readonly code: NodeGestureTrainingExecutionIssueCode,
    message: string,
  ) {
    super(message);
    this.name = 'NodeGestureTrainingExecutionError';
  }
}

interface CandidateModelCardV2 {
  readonly schemaVersion: 2;
  readonly name: 'gesture_classifier';
  readonly version: string;
  readonly inputName: 'trajectory';
  readonly outputName: 'probs';
  readonly featureDim: 56;
  readonly classes: readonly string[];
  readonly sha256: string;
  readonly promotionDecision: null;
}

interface GestureCandidateBundleV1 {
  readonly schemaVersion: '1';
  readonly policyVersion: 'pt8-gesture-candidate-bundle-v1';
  readonly trainingManifest: ImmutableReferenceV1;
  readonly featureDatasetDigest: Readonly<{ algorithm: 'SHA256'; value: string }>;
  readonly onnxArtifact: LearningArtifactDescriptorV1;
  readonly modelCardArtifact: LearningArtifactDescriptorV1;
  readonly trainerReportArtifact: LearningArtifactDescriptorV1;
}

const COMMIT_SHA = /^[0-9a-f]{40}$/;

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value)}\n`);
}

function encodeJsonLines(rows: readonly GestureTrainingFeatureRowV1[]): Uint8Array {
  return new TextEncoder().encode(`${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

function parseModelCard(bytes: Uint8Array): CandidateModelCardV2 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new NodeGestureTrainingExecutionError('MODEL_CARD_MISMATCH', 'candidate model card is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new NodeGestureTrainingExecutionError('MODEL_CARD_MISMATCH', 'candidate model card must be an object');
  }
  return parsed as CandidateModelCardV2;
}

function parsePredictionLines(bytes: Uint8Array): readonly GestureEvaluationObservationV1[] {
  const observations: GestureEvaluationObservationV1[] = [];
  const seen = new Set<string>();
  const gestureSet = new Set<string>(GESTURE_CLASSES);
  for (const [index, line] of new TextDecoder().decode(bytes).split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new NodeGestureTrainingExecutionError('PREDICTION_OUTPUT_INVALID', `prediction line ${index + 1} is not JSON`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new NodeGestureTrainingExecutionError('PREDICTION_OUTPUT_INVALID', `prediction line ${index + 1} is not an object`);
    }
    const row = parsed as Record<string, unknown>;
    if (
      typeof row.recordId !== 'string' ||
      typeof row.profilePseudonymId !== 'string' ||
      typeof row.actualGesture !== 'string' ||
      typeof row.predictedGesture !== 'string' ||
      !gestureSet.has(row.actualGesture) ||
      !gestureSet.has(row.predictedGesture) ||
      seen.has(row.recordId)
    ) {
      throw new NodeGestureTrainingExecutionError(
        'PREDICTION_OUTPUT_INVALID',
        `prediction line ${index + 1} violates the closed PT8 output contract`,
      );
    }
    seen.add(row.recordId);
    observations.push(Object.freeze({
      recordId: row.recordId,
      profilePseudonymId: row.profilePseudonymId,
      actualGesture: row.actualGesture as GestureClass,
      predictedGesture: row.predictedGesture as GestureClass,
    }));
  }
  return Object.freeze(observations);
}

function validateCard(
  card: CandidateModelCardV2,
  modelBytes: Uint8Array,
  manifest: ReproducibleTrainingJobManifestV1,
): void {
  if (
    card.schemaVersion !== 2 ||
    card.name !== 'gesture_classifier' ||
    card.version !== manifest.jobVersion ||
    card.inputName !== 'trajectory' ||
    card.outputName !== 'probs' ||
    card.featureDim !== 56 ||
    !Array.isArray(card.classes) ||
    card.classes.length !== GESTURE_CLASSES.length ||
    !GESTURE_CLASSES.every((gesture, index) => card.classes[index] === gesture) ||
    card.sha256 !== sha256Hex(modelBytes) ||
    card.promotionDecision !== null
  ) {
    throw new NodeGestureTrainingExecutionError(
      'MODEL_CARD_MISMATCH',
      'candidate model card must bind exact ONNX bytes, frozen [1,56]->[1,6] contract, job version and no promotion decision',
    );
  }
}

function referenceFromDescriptor(descriptor: LearningArtifactDescriptorV1): ImmutableReferenceV1 {
  return Object.freeze({
    schemaVersion: descriptor.schemaVersion,
    id: descriptor.id,
    version: descriptor.version,
    digest: descriptor.digest,
  });
}

function artifactStem(manifest: ReproducibleTrainingJobManifestV1): string {
  return manifest.manifestDigest.value.slice(0, 32);
}

/**
 * Repository-runnable PT8 executor. It resolves only exact PT6 snapshot
 * members, executes the configured immutable Python training/export treatment,
 * stores candidate outputs in PT7's content-addressed artifact store, and
 * returns a PT7 receipt plus exact held-out reports. It never mutates runtime
 * assets and never decides whether model metrics authorize promotion.
 */
export class NodeGestureTrainingExecutorV1 implements GestureTrainingExecutorV1 {
  private readonly runner: GestureTrainingProcessRunnerV1;
  private readonly now: () => string;

  constructor(private readonly options: NodeGestureTrainingExecutorOptionsV1) {
    if (
      !options.workspaceRoot ||
      !options.pythonExecutable ||
      !options.trainerScriptPath ||
      !options.exporterScriptPath ||
      !isImmutableReferenceV1(options.configuredTrainingCode) ||
      !isImmutableReferenceV1(options.configuredTrainer) ||
      !isImmutableReferenceV1(options.configuredEnvironment) ||
      !COMMIT_SHA.test(options.configuredSourceCommitSha) ||
      !isImmutableReferenceV1(options.evaluatorArtifact)
    ) {
      throw new NodeGestureTrainingExecutionError(
        'CONFIGURATION_MISMATCH',
        'PT8 executor configuration must bind versioned training code/trainer/environment/evaluator and exact checkout commit',
      );
    }
    this.runner = options.processRunner ?? new NodeGestureTrainingProcessRunnerV1();
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async execute(
    manifest: ReproducibleTrainingJobManifestV1,
    snapshot: GestureTrainingSnapshotV1,
  ): Promise<GestureTrainingExecutionResultV1> {
    if (
      manifest.outputKind !== 'GESTURE_MODEL' ||
      manifest.trainerEntrypoint !== PT8_GESTURE_TRAINER_ENTRYPOINT ||
      !sameImmutableReferenceV1(manifest.trainingCode, this.options.configuredTrainingCode) ||
      !sameImmutableReferenceV1(manifest.trainer, this.options.configuredTrainer) ||
      !sameImmutableReferenceV1(manifest.environment, this.options.configuredEnvironment) ||
      manifest.sourceCommitSha !== this.options.configuredSourceCommitSha
    ) {
      throw new NodeGestureTrainingExecutionError(
        'CONFIGURATION_MISMATCH',
        'manifest training code, trainer, environment, source commit and entrypoint must match the configured immutable PT8 runner',
      );
    }

    mkdirSync(this.options.workspaceRoot, { recursive: true });
    const workspace = mkdtempSync(join(this.options.workspaceRoot, 'pt8-gesture-'));
    const inputDirectory = join(workspace, 'input');
    const outputDirectory = join(workspace, 'output');
    mkdirSync(inputDirectory, { recursive: true });
    mkdirSync(outputDirectory, { recursive: true });
    const startedAt = this.now();

    try {
      const dataset = await resolveGestureTrainingFeatureDatasetV1(this.options.source, snapshot);
      this.writeDataset(inputDirectory, dataset);

      const trainer = this.runner.run(this.options.pythonExecutable, [
        this.options.trainerScriptPath,
        '--input-dir', inputDirectory,
        '--output-dir', outputDirectory,
        '--seed', String(manifest.randomSeed),
      ], workspace);
      if (trainer.status !== 0) {
        throw new NodeGestureTrainingExecutionError(
          'TRAINER_FAILED',
          `PT8 trainer exited ${trainer.status}: ${trainer.stderr}`,
        );
      }

      const exporter = this.runner.run(this.options.pythonExecutable, [
        this.options.exporterScriptPath,
        '--input-dir', outputDirectory,
        '--output-dir', outputDirectory,
        '--model-version', manifest.jobVersion,
      ], workspace);
      if (exporter.status !== 0) {
        throw new NodeGestureTrainingExecutionError(
          'EXPORT_FAILED',
          `PT8 ONNX exporter exited ${exporter.status}: ${exporter.stderr}`,
        );
      }

      const modelBytes = this.readRequired(join(outputDirectory, 'gesture_classifier.onnx'));
      const cardBytes = this.readRequired(join(outputDirectory, 'model_card.json'));
      const reportBytes = this.readRequired(join(outputDirectory, 'trainer_report.json'));
      const validationPredictionBytes = this.readRequired(join(outputDirectory, 'validation_predictions.jsonl'));
      const testPredictionBytes = this.readRequired(join(outputDirectory, 'test_predictions.jsonl'));
      validateCard(parseModelCard(cardBytes), modelBytes, manifest);

      const stem = artifactStem(manifest);
      const onnxArtifact = this.options.artifactStore.put({
        id: `gesture-onnx-${stem}`,
        version: manifest.jobVersion,
        mediaType: 'application/onnx',
        bytes: modelBytes,
      });
      const modelCardArtifact = this.options.artifactStore.put({
        id: `gesture-model-card-${stem}`,
        version: manifest.jobVersion,
        mediaType: 'application/json',
        bytes: cardBytes,
      });
      const trainerReportArtifact = this.options.artifactStore.put({
        id: `gesture-trainer-report-${stem}`,
        version: manifest.jobVersion,
        mediaType: 'application/json',
        bytes: reportBytes,
      });
      const bundle: GestureCandidateBundleV1 = Object.freeze({
        schemaVersion: '1',
        policyVersion: 'pt8-gesture-candidate-bundle-v1',
        trainingManifest: trainingJobManifestReferenceV1(manifest),
        featureDatasetDigest: dataset.datasetDigest,
        onnxArtifact,
        modelCardArtifact,
        trainerReportArtifact,
      });
      const bundleArtifact = this.options.artifactStore.put({
        id: `gesture-model-bundle-${stem}`,
        version: manifest.jobVersion,
        mediaType: 'application/json',
        bytes: encodeJson(bundle),
      });
      const modelArtifact = referenceFromDescriptor(bundleArtifact);

      const validationReport = buildGestureEvaluationReportV1(
        snapshot,
        parsePredictionLines(validationPredictionBytes),
        {
          reportId: `pt8-validation-${stem}`,
          reportVersion: manifest.jobVersion,
          createdAt: this.now(),
          modelArtifact,
          evaluatorArtifact: this.options.evaluatorArtifact,
          split: 'validation',
        },
      );
      const testReport = buildGestureEvaluationReportV1(
        snapshot,
        parsePredictionLines(testPredictionBytes),
        {
          reportId: `pt8-test-${stem}`,
          reportVersion: manifest.jobVersion,
          createdAt: this.now(),
          modelArtifact,
          evaluatorArtifact: this.options.evaluatorArtifact,
          split: 'test',
        },
      );
      const logsArtifact = this.options.artifactStore.put({
        id: `gesture-training-logs-${stem}`,
        version: manifest.jobVersion,
        mediaType: 'text/plain',
        bytes: new TextEncoder().encode(
          `trainer stdout:\n${trainer.stdout}\ntrainer stderr:\n${trainer.stderr}\nexport stdout:\n${exporter.stdout}\nexport stderr:\n${exporter.stderr}\n`,
        ),
      });
      const receipt = buildTrainingJobReceiptV1(manifest, {
        receiptId: `pt8-receipt-${stem}`,
        receiptVersion: manifest.jobVersion,
        startedAt,
        finishedAt: this.now(),
        status: 'SUCCEEDED',
        runnerEnvironment: this.options.configuredEnvironment,
        outputModel: modelArtifact,
        evaluationReport: gestureEvaluationReportReferenceV1(testReport),
        logs: referenceFromDescriptor(logsArtifact),
        failureCode: null,
      });
      return Object.freeze({ receipt, validationReport, testReport });
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  }

  private writeDataset(directory: string, dataset: GestureTrainingFeatureDatasetV1): void {
    for (const split of ['train', 'validation', 'test'] as const) {
      writeFileSync(join(directory, `${split}.jsonl`), encodeJsonLines(dataset.splits[split]));
    }
    writeFileSync(join(directory, 'dataset-manifest.json'), encodeJson({
      schemaVersion: dataset.schemaVersion,
      policyVersion: dataset.policyVersion,
      snapshot: dataset.snapshot,
      featureSchema: dataset.featureSchema,
      datasetDigest: dataset.datasetDigest,
    }));
  }

  private readRequired(path: string): Uint8Array {
    try {
      return Uint8Array.from(readFileSync(path));
    } catch (error) {
      throw new NodeGestureTrainingExecutionError(
        'OUTPUT_MISSING',
        `required training output missing: ${path}: ${String(error)}`,
      );
    }
  }
}

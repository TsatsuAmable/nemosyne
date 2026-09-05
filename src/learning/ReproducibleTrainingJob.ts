import type { ImmutableReferenceV1, Sha256DigestV1 } from '../governance/GovernedEventContracts.ts';
import { canonicalSha256Hex } from '../security/CryptoHash.ts';
import {
  validateGestureTrainingSnapshotV1,
  type GestureTrainingSnapshotV1,
} from '../vr/input/GestureLearningContracts.ts';
import {
  LEARNING_SAFE_ID,
  LEARNING_STABLE_VERSION,
  cloneImmutableReferenceV1,
  deepFreezeLearning,
  exactObjectKeys,
  isImmutableReferenceV1,
  isLearningUtcTimestamp,
  isSha256DigestV1,
  sameImmutableReferenceV1,
} from './LearningContractPrimitives.ts';

export const REPRODUCIBLE_TRAINING_JOB_SCHEMA_VERSION = '1' as const;
export const REPRODUCIBLE_TRAINING_JOB_POLICY_VERSION = 'reproducible-training-job-v1' as const;
export const TRAINING_JOB_RECEIPT_SCHEMA_VERSION = '1' as const;

export type TrainingDatasetKind = 'GESTURE_L2_SNAPSHOT' | 'MONETA_JUDGEMENT_SNAPSHOT';
export type TrainingOutputKind = 'GESTURE_MODEL' | 'FITNESS_MODEL';
export type TrainingConfigScalar = string | number | boolean;

export interface TrainingDatasetBindingV1 {
  readonly kind: TrainingDatasetKind;
  readonly dataset: ImmutableReferenceV1;
  readonly featureSchema: ImmutableReferenceV1;
}

export interface ReproducibleTrainingJobContentV1 {
  readonly schemaVersion: typeof REPRODUCIBLE_TRAINING_JOB_SCHEMA_VERSION;
  readonly policyVersion: typeof REPRODUCIBLE_TRAINING_JOB_POLICY_VERSION;
  readonly jobId: string;
  readonly jobVersion: string;
  readonly createdAt: string;
  readonly outputKind: TrainingOutputKind;
  readonly dataset: TrainingDatasetBindingV1;
  readonly trainingCode: ImmutableReferenceV1;
  readonly sourceCommitSha: string;
  readonly environment: ImmutableReferenceV1;
  readonly trainer: ImmutableReferenceV1;
  readonly trainerEntrypoint: string;
  readonly runtimeBaseline: ImmutableReferenceV1;
  readonly holdoutPolicy: ImmutableReferenceV1;
  readonly config: Readonly<Record<string, TrainingConfigScalar>>;
  readonly randomSeed: number;
}

export interface ReproducibleTrainingJobManifestV1 extends ReproducibleTrainingJobContentV1 {
  readonly manifestDigest: Sha256DigestV1;
}

export interface TrainingJobReceiptContentV1 {
  readonly schemaVersion: typeof TRAINING_JOB_RECEIPT_SCHEMA_VERSION;
  readonly receiptId: string;
  readonly receiptVersion: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly status: 'SUCCEEDED' | 'FAILED';
  readonly manifest: ImmutableReferenceV1;
  readonly runnerEnvironment: ImmutableReferenceV1;
  readonly outputModel: ImmutableReferenceV1 | null;
  readonly evaluationReport: ImmutableReferenceV1 | null;
  readonly logs: ImmutableReferenceV1;
  readonly failureCode: string | null;
}

export interface TrainingJobReceiptV1 extends TrainingJobReceiptContentV1 {
  readonly receiptDigest: Sha256DigestV1;
}

export type TrainingJobContractIssueCode =
  | 'INVALID_MANIFEST_METADATA'
  | 'INVALID_DATASET_BINDING'
  | 'INVALID_IMMUTABLE_REFERENCE'
  | 'INVALID_SOURCE_COMMIT'
  | 'INVALID_TRAINER_ENTRYPOINT'
  | 'INVALID_CONFIG'
  | 'INVALID_RANDOM_SEED'
  | 'MANIFEST_DIGEST_MISMATCH'
  | 'INVALID_RECEIPT_METADATA'
  | 'MANIFEST_BINDING_MISMATCH'
  | 'RUNNER_ENVIRONMENT_MISMATCH'
  | 'INVALID_RECEIPT_OUTPUT'
  | 'RECEIPT_DIGEST_MISMATCH';

export interface TrainingJobContractIssueV1 {
  readonly code: TrainingJobContractIssueCode;
  readonly path: string;
  readonly message: string;
}

export class TrainingJobContractError extends Error {
  readonly issues: readonly TrainingJobContractIssueV1[];

  constructor(issues: readonly TrainingJobContractIssueV1[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
    this.name = 'TrainingJobContractError';
    this.issues = Object.freeze([...issues]);
  }
}

const COMMIT_SHA = /^[0-9a-f]{40}$/;
const ENTRYPOINT = /^[A-Za-z0-9][A-Za-z0-9._/:+-]{0,199}$/;
const CONFIG_KEY = /^[A-Za-z][A-Za-z0-9._-]{0,95}$/;
const MAX_CONFIG_ENTRIES = 128;
const MAX_CONFIG_STRING_BYTES = 1_024;

function cloneDatasetBinding(binding: TrainingDatasetBindingV1): TrainingDatasetBindingV1 {
  return {
    kind: binding.kind,
    dataset: cloneImmutableReferenceV1(binding.dataset),
    featureSchema: cloneImmutableReferenceV1(binding.featureSchema),
  };
}

function validateDatasetBinding(binding: TrainingDatasetBindingV1): TrainingJobContractIssueV1[] {
  const issues: TrainingJobContractIssueV1[] = [];
  if (
    !binding ||
    (binding.kind !== 'GESTURE_L2_SNAPSHOT' && binding.kind !== 'MONETA_JUDGEMENT_SNAPSHOT') ||
    !exactObjectKeys(binding, ['kind', 'dataset', 'featureSchema'])
  ) {
    return [{
      code: 'INVALID_DATASET_BINDING',
      path: 'dataset',
      message: 'training dataset binding must use a declared governed snapshot kind and closed schema',
    }];
  }
  if (!isImmutableReferenceV1(binding.dataset) || !isImmutableReferenceV1(binding.featureSchema)) {
    issues.push({
      code: 'INVALID_DATASET_BINDING',
      path: 'dataset',
      message: 'dataset and feature schema must be immutable versioned references',
    });
  }
  return issues;
}

function validateConfig(config: Readonly<Record<string, TrainingConfigScalar>>): TrainingJobContractIssueV1[] {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return [{ code: 'INVALID_CONFIG', path: 'config', message: 'training config must be a closed scalar object' }];
  }
  const entries = Object.entries(config);
  if (entries.length > MAX_CONFIG_ENTRIES) {
    return [{ code: 'INVALID_CONFIG', path: 'config', message: `training config exceeds ${MAX_CONFIG_ENTRIES} entries` }];
  }
  const encoder = new TextEncoder();
  const issues: TrainingJobContractIssueV1[] = [];
  for (const [key, value] of entries) {
    if (!CONFIG_KEY.test(key)) {
      issues.push({ code: 'INVALID_CONFIG', path: `config.${key}`, message: 'config key is not a bounded stable identifier' });
      continue;
    }
    if (typeof value === 'string') {
      if (encoder.encode(value).byteLength > MAX_CONFIG_STRING_BYTES) {
        issues.push({ code: 'INVALID_CONFIG', path: `config.${key}`, message: 'config string exceeds the bounded UTF-8 size' });
      }
    } else if (typeof value === 'number') {
      if (!Number.isFinite(value)) issues.push({ code: 'INVALID_CONFIG', path: `config.${key}`, message: 'config numbers must be finite' });
    } else if (typeof value !== 'boolean') {
      issues.push({ code: 'INVALID_CONFIG', path: `config.${key}`, message: 'config values may only be string, finite number, or boolean' });
    }
  }
  return issues;
}

export function buildGestureTrainingDatasetBindingV1(snapshot: GestureTrainingSnapshotV1): TrainingDatasetBindingV1 {
  const snapshotIssues = validateGestureTrainingSnapshotV1(snapshot);
  if (snapshotIssues.length > 0) {
    throw new TrainingJobContractError([{
      code: 'INVALID_DATASET_BINDING',
      path: 'snapshot',
      message: `gesture snapshot is invalid: ${snapshotIssues.map((issue) => issue.code).join(',')}`,
    }]);
  }
  return deepFreezeLearning({
    kind: 'GESTURE_L2_SNAPSHOT' as const,
    dataset: {
      schemaVersion: '1' as const,
      id: snapshot.snapshotId,
      version: snapshot.snapshotVersion,
      digest: { algorithm: 'SHA256' as const, value: snapshot.snapshotDigest.value },
    },
    featureSchema: cloneImmutableReferenceV1(snapshot.featureSchema),
  });
}

export function buildReproducibleTrainingJobManifestV1(
  input: ReproducibleTrainingJobContentV1,
): ReproducibleTrainingJobManifestV1 {
  const content: ReproducibleTrainingJobContentV1 = {
    schemaVersion: REPRODUCIBLE_TRAINING_JOB_SCHEMA_VERSION,
    policyVersion: REPRODUCIBLE_TRAINING_JOB_POLICY_VERSION,
    jobId: input.jobId,
    jobVersion: input.jobVersion,
    createdAt: input.createdAt,
    outputKind: input.outputKind,
    dataset: cloneDatasetBinding(input.dataset),
    trainingCode: cloneImmutableReferenceV1(input.trainingCode),
    sourceCommitSha: input.sourceCommitSha,
    environment: cloneImmutableReferenceV1(input.environment),
    trainer: cloneImmutableReferenceV1(input.trainer),
    trainerEntrypoint: input.trainerEntrypoint,
    runtimeBaseline: cloneImmutableReferenceV1(input.runtimeBaseline),
    holdoutPolicy: cloneImmutableReferenceV1(input.holdoutPolicy),
    config: { ...input.config },
    randomSeed: input.randomSeed,
  };
  const candidate = {
    ...content,
    manifestDigest: { algorithm: 'SHA256' as const, value: canonicalSha256Hex(content) },
  };
  const issues = validateReproducibleTrainingJobManifestV1(candidate);
  if (issues.length > 0) throw new TrainingJobContractError(issues);
  return deepFreezeLearning(candidate);
}

export function validateReproducibleTrainingJobManifestV1(
  manifest: ReproducibleTrainingJobManifestV1,
): readonly TrainingJobContractIssueV1[] {
  const issues: TrainingJobContractIssueV1[] = [];
  if (
    !manifest ||
    manifest.schemaVersion !== REPRODUCIBLE_TRAINING_JOB_SCHEMA_VERSION ||
    manifest.policyVersion !== REPRODUCIBLE_TRAINING_JOB_POLICY_VERSION ||
    !LEARNING_SAFE_ID.test(manifest.jobId ?? '') ||
    !LEARNING_STABLE_VERSION.test(manifest.jobVersion ?? '') ||
    !isLearningUtcTimestamp(manifest.createdAt) ||
    (manifest.outputKind !== 'GESTURE_MODEL' && manifest.outputKind !== 'FITNESS_MODEL')
  ) {
    issues.push({ code: 'INVALID_MANIFEST_METADATA', path: 'manifest', message: 'training manifest metadata is invalid or unsupported' });
  }
  issues.push(...validateDatasetBinding(manifest?.dataset));
  for (const [path, reference] of [
    ['trainingCode', manifest?.trainingCode],
    ['environment', manifest?.environment],
    ['trainer', manifest?.trainer],
    ['runtimeBaseline', manifest?.runtimeBaseline],
    ['holdoutPolicy', manifest?.holdoutPolicy],
  ] as const) {
    if (!isImmutableReferenceV1(reference)) {
      issues.push({ code: 'INVALID_IMMUTABLE_REFERENCE', path, message: 'must be an immutable versioned artifact reference' });
    }
  }
  if (!COMMIT_SHA.test(manifest?.sourceCommitSha ?? '')) {
    issues.push({ code: 'INVALID_SOURCE_COMMIT', path: 'sourceCommitSha', message: 'must be the exact lower-case 40-character source commit SHA' });
  }
  if (!ENTRYPOINT.test(manifest?.trainerEntrypoint ?? '')) {
    issues.push({ code: 'INVALID_TRAINER_ENTRYPOINT', path: 'trainerEntrypoint', message: 'must be a bounded logical trainer entrypoint identifier' });
  }
  issues.push(...validateConfig(manifest?.config));
  if (!Number.isSafeInteger(manifest?.randomSeed) || manifest.randomSeed < 0 || manifest.randomSeed > 0x7fffffff) {
    issues.push({ code: 'INVALID_RANDOM_SEED', path: 'randomSeed', message: 'must be a bounded non-negative 31-bit integer' });
  }
  if (!isSha256DigestV1(manifest?.manifestDigest)) {
    issues.push({ code: 'MANIFEST_DIGEST_MISMATCH', path: 'manifestDigest', message: 'manifest digest must be SHA-256' });
  } else {
    const { manifestDigest: _digest, ...content } = manifest;
    if (canonicalSha256Hex(content) !== manifest.manifestDigest.value) {
      issues.push({ code: 'MANIFEST_DIGEST_MISMATCH', path: 'manifestDigest.value', message: 'manifest content does not match its immutable digest' });
    }
  }
  return issues;
}

export function trainingJobManifestReferenceV1(manifest: ReproducibleTrainingJobManifestV1): ImmutableReferenceV1 {
  const issues = validateReproducibleTrainingJobManifestV1(manifest);
  if (issues.length > 0) throw new TrainingJobContractError(issues);
  return deepFreezeLearning({
    schemaVersion: '1' as const,
    id: `training-job:${manifest.jobId}`,
    version: manifest.jobVersion,
    digest: { algorithm: 'SHA256' as const, value: manifest.manifestDigest.value },
  });
}

export function buildTrainingJobReceiptV1(
  manifest: ReproducibleTrainingJobManifestV1,
  input: Omit<TrainingJobReceiptContentV1, 'schemaVersion' | 'manifest'>,
): TrainingJobReceiptV1 {
  const manifestIssues = validateReproducibleTrainingJobManifestV1(manifest);
  if (manifestIssues.length > 0) throw new TrainingJobContractError(manifestIssues);
  const content: TrainingJobReceiptContentV1 = {
    schemaVersion: TRAINING_JOB_RECEIPT_SCHEMA_VERSION,
    receiptId: input.receiptId,
    receiptVersion: input.receiptVersion,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    status: input.status,
    manifest: trainingJobManifestReferenceV1(manifest),
    runnerEnvironment: cloneImmutableReferenceV1(input.runnerEnvironment),
    outputModel: input.outputModel ? cloneImmutableReferenceV1(input.outputModel) : null,
    evaluationReport: input.evaluationReport ? cloneImmutableReferenceV1(input.evaluationReport) : null,
    logs: cloneImmutableReferenceV1(input.logs),
    failureCode: input.failureCode,
  };
  const candidate = {
    ...content,
    receiptDigest: { algorithm: 'SHA256' as const, value: canonicalSha256Hex(content) },
  };
  const issues = validateTrainingJobReceiptV1(candidate, manifest);
  if (issues.length > 0) throw new TrainingJobContractError(issues);
  return deepFreezeLearning(candidate);
}

export function validateTrainingJobReceiptV1(
  receipt: TrainingJobReceiptV1,
  manifest?: ReproducibleTrainingJobManifestV1,
): readonly TrainingJobContractIssueV1[] {
  const issues: TrainingJobContractIssueV1[] = [];
  if (
    !receipt ||
    receipt.schemaVersion !== TRAINING_JOB_RECEIPT_SCHEMA_VERSION ||
    !LEARNING_SAFE_ID.test(receipt.receiptId ?? '') ||
    !LEARNING_STABLE_VERSION.test(receipt.receiptVersion ?? '') ||
    !isLearningUtcTimestamp(receipt.startedAt) ||
    !isLearningUtcTimestamp(receipt.finishedAt) ||
    Date.parse(receipt.finishedAt) < Date.parse(receipt.startedAt) ||
    (receipt.status !== 'SUCCEEDED' && receipt.status !== 'FAILED')
  ) {
    issues.push({ code: 'INVALID_RECEIPT_METADATA', path: 'receipt', message: 'training receipt metadata or execution interval is invalid' });
  }
  for (const [path, reference] of [
    ['manifest', receipt?.manifest],
    ['runnerEnvironment', receipt?.runnerEnvironment],
    ['logs', receipt?.logs],
  ] as const) {
    if (!isImmutableReferenceV1(reference)) {
      issues.push({ code: 'INVALID_IMMUTABLE_REFERENCE', path, message: 'must be an immutable versioned artifact reference' });
    }
  }
  if (manifest) {
    const manifestIssues = validateReproducibleTrainingJobManifestV1(manifest);
    if (manifestIssues.length > 0) {
      issues.push({ code: 'MANIFEST_BINDING_MISMATCH', path: 'manifest', message: 'supplied training manifest is invalid' });
    } else {
      const expected = trainingJobManifestReferenceV1(manifest);
      if (!isImmutableReferenceV1(receipt.manifest) || !sameImmutableReferenceV1(receipt.manifest, expected)) {
        issues.push({ code: 'MANIFEST_BINDING_MISMATCH', path: 'manifest', message: 'receipt does not bind the exact reproducible training manifest' });
      }
      if (!isImmutableReferenceV1(receipt.runnerEnvironment) || !sameImmutableReferenceV1(receipt.runnerEnvironment, manifest.environment)) {
        issues.push({ code: 'RUNNER_ENVIRONMENT_MISMATCH', path: 'runnerEnvironment', message: 'actual runner environment must equal the environment frozen in the manifest' });
      }
    }
  }
  if (receipt?.status === 'SUCCEEDED') {
    if (!isImmutableReferenceV1(receipt.outputModel) || !isImmutableReferenceV1(receipt.evaluationReport) || receipt.failureCode !== null) {
      issues.push({ code: 'INVALID_RECEIPT_OUTPUT', path: 'receipt', message: 'successful training requires immutable model/evaluation outputs and no failure code' });
    }
  } else if (receipt?.status === 'FAILED') {
    if (receipt.outputModel !== null || receipt.evaluationReport !== null || typeof receipt.failureCode !== 'string' || !LEARNING_SAFE_ID.test(receipt.failureCode)) {
      issues.push({ code: 'INVALID_RECEIPT_OUTPUT', path: 'receipt', message: 'failed training may not publish model/evaluation outputs and requires a bounded failure code' });
    }
  }
  if (!isSha256DigestV1(receipt?.receiptDigest)) {
    issues.push({ code: 'RECEIPT_DIGEST_MISMATCH', path: 'receiptDigest', message: 'receipt digest must be SHA-256' });
  } else {
    const { receiptDigest: _digest, ...content } = receipt;
    if (canonicalSha256Hex(content) !== receipt.receiptDigest.value) {
      issues.push({ code: 'RECEIPT_DIGEST_MISMATCH', path: 'receiptDigest.value', message: 'receipt content does not match its immutable digest' });
    }
  }
  return issues;
}

export function trainingJobReceiptReferenceV1(receipt: TrainingJobReceiptV1): ImmutableReferenceV1 {
  const issues = validateTrainingJobReceiptV1(receipt);
  if (issues.length > 0) throw new TrainingJobContractError(issues);
  return deepFreezeLearning({
    schemaVersion: '1' as const,
    id: `training-receipt:${receipt.receiptId}`,
    version: receipt.receiptVersion,
    digest: { algorithm: 'SHA256' as const, value: receipt.receiptDigest.value },
  });
}

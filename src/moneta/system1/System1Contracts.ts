import type { ImmutableReferenceV1 } from '../../governance/GovernedEventContracts.ts';
import {
  LEARNING_SAFE_ID,
  exactObjectKeys,
  isImmutableReferenceV1,
  isLearningUtcTimestamp,
  sameImmutableReferenceV1,
} from '../../learning/LearningContractPrimitives.ts';

export const SYSTEM1_PURPOSES = ['PERCEPTION', 'REPRESENTATION_PROPOSAL'] as const;
export type System1PurposeV1 = (typeof SYSTEM1_PURPOSES)[number];

export const SYSTEM1_MODEL_FORMATS = ['ONNX', 'RUST_NATIVE', 'REMOTE', 'REFERENCE'] as const;
export type System1ModelFormatV1 = (typeof SYSTEM1_MODEL_FORMATS)[number];

export const SYSTEM1_EXECUTION_PROVIDERS = [
  'REFERENCE',
  'ONNX_WASM',
  'ONNX_WEBGPU',
  'RUST_NATIVE',
  'RUST_WASM',
  'REMOTE',
] as const;
export type System1ExecutionProviderV1 = (typeof SYSTEM1_EXECUTION_PROVIDERS)[number];

export const SYSTEM1_PROMOTION_STAGES = ['CANDIDATE', 'SHADOW', 'CANARY', 'PRODUCTION'] as const;
export type System1PromotionStageV1 = (typeof SYSTEM1_PROMOTION_STAGES)[number];

export const SYSTEM1_ABSTAIN_REASONS = [
  'STALE_OBSERVATION',
  'MODEL_UNAVAILABLE',
  'OUT_OF_DISTRIBUTION',
  'INSUFFICIENT_SIGNAL',
  'POLICY_REFUSAL',
  'PROVIDER_REFUSAL',
] as const;
export type System1AbstainReasonV1 = (typeof SYSTEM1_ABSTAIN_REASONS)[number];

export interface System1TensorDimensionV1 {
  readonly min: number;
  readonly max: number;
}

export interface System1TensorSpecV1 {
  readonly name: string;
  readonly dtype: 'float32' | 'float64' | 'int32' | 'int64' | 'bool';
  readonly dimensions: readonly System1TensorDimensionV1[];
}

export type System1CalibrationV1 =
  | Readonly<{ status: 'UNCALIBRATED'; report: null }>
  | Readonly<{ status: 'CALIBRATED'; report: ImmutableReferenceV1 }>;

export interface System1ModelArtifactV1 {
  readonly schemaVersion: '1';
  readonly artifact: ImmutableReferenceV1;
  readonly purpose: System1PurposeV1;
  readonly semanticPurpose: string;
  readonly featureSchema: ImmutableReferenceV1;
  readonly trainingSnapshot: ImmutableReferenceV1 | null;
  readonly curationPolicy: ImmutableReferenceV1 | null;
  readonly trainer: ImmutableReferenceV1 | null;
  readonly environment: ImmutableReferenceV1 | null;
  readonly sourceRevision: ImmutableReferenceV1;
  readonly format: System1ModelFormatV1;
  readonly opset: number | null;
  readonly operatorInventory: readonly string[];
  readonly inputs: readonly System1TensorSpecV1[];
  readonly outputs: readonly System1TensorSpecV1[];
  readonly byteLength: number;
  readonly expectedWorkingMemoryBytes: number;
  readonly calibration: System1CalibrationV1;
  readonly knownFailureConditions: readonly string[];
  readonly promotionStage: System1PromotionStageV1;
  readonly researchFrozen: boolean;
}

export interface System1RuntimeIdentityV1 {
  readonly runtime: ImmutableReferenceV1;
  readonly providerId: string;
  readonly providerVersion: string;
  readonly executionProvider: System1ExecutionProviderV1;
}

export interface System1InferenceRequestV1<TFeatures> {
  readonly requestId: string;
  readonly model: System1ModelArtifactV1;
  readonly featureSchema: ImmutableReferenceV1;
  readonly features: TFeatures;
  readonly observedAt: string;
  readonly requestedAt: string;
  readonly maxObservationAgeMs: number;
}

export type System1ProviderOutcomeV1<TDecision> =
  | Readonly<{
      status: 'DECISION';
      value: TDecision;
      rawScore: number | null;
      calibratedProbability: number | null;
    }>
  | Readonly<{
      status: 'ABSTAIN';
      reason: System1AbstainReasonV1;
      rawScore: number | null;
    }>;

export interface System1ProviderResponseV1<TDecision> {
  readonly model: ImmutableReferenceV1;
  readonly featureSchema: ImmutableReferenceV1;
  readonly inferredAt: string;
  readonly latencyMs: number;
  readonly outcome: System1ProviderOutcomeV1<TDecision>;
}

export type System1InferenceResultV1<TDecision> =
  | Readonly<{
      schemaVersion: '1';
      requestId: string;
      model: ImmutableReferenceV1;
      featureSchema: ImmutableReferenceV1;
      executionStatus: 'EXECUTED';
      runtime: System1RuntimeIdentityV1;
      inferredAt: string;
      observationAgeMs: number;
      latencyMs: number;
      outcome: System1ProviderOutcomeV1<TDecision>;
    }>
  | Readonly<{
      schemaVersion: '1';
      requestId: string;
      model: ImmutableReferenceV1;
      featureSchema: ImmutableReferenceV1;
      executionStatus: 'SKIPPED';
      runtime: null;
      inferredAt: string;
      observationAgeMs: number;
      latencyMs: 0;
      outcome: Readonly<{
        status: 'ABSTAIN';
        reason: 'STALE_OBSERVATION';
        rawScore: null;
      }>;
    }>;

export class System1ContractError extends Error {
  constructor(
    readonly code:
      | 'INVALID_ARTIFACT'
      | 'INVALID_REQUEST'
      | 'IDENTITY_MISMATCH'
      | 'INVALID_PROVIDER_RESULT',
    message: string,
  ) {
    super(message);
    this.name = 'System1ContractError';
  }
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

function validTensorDimension(dimension: System1TensorDimensionV1): boolean {
  return Boolean(
    dimension &&
    exactObjectKeys(dimension, ['min', 'max']) &&
    Number.isSafeInteger(dimension.min) &&
    Number.isSafeInteger(dimension.max) &&
    dimension.min >= 1 &&
    dimension.max >= dimension.min
  );
}

function validTensorSpec(spec: System1TensorSpecV1): boolean {
  return Boolean(
    spec &&
    exactObjectKeys(spec, ['name', 'dtype', 'dimensions']) &&
    LEARNING_SAFE_ID.test(spec.name) &&
    ['float32', 'float64', 'int32', 'int64', 'bool'].includes(spec.dtype) &&
    Array.isArray(spec.dimensions) &&
    spec.dimensions.length > 0 &&
    spec.dimensions.every(validTensorDimension),
  );
}

function validReferenceOrNull(value: ImmutableReferenceV1 | null): boolean {
  return value === null || isImmutableReferenceV1(value);
}

function validCalibration(value: System1CalibrationV1): boolean {
  if (!value || !exactObjectKeys(value, ['status', 'report'])) return false;
  if (value.status === 'UNCALIBRATED') return value.report === null;
  if (value.status === 'CALIBRATED') return isImmutableReferenceV1(value.report);
  return false;
}

export function assertSystem1ModelArtifactV1(artifact: System1ModelArtifactV1): void {
  const invalid =
    !artifact ||
    !hasExactSystem1ArtifactKeysV1(artifact) ||
    artifact.schemaVersion !== '1' ||
    !isImmutableReferenceV1(artifact.artifact) ||
    !isOneOf(artifact.purpose, SYSTEM1_PURPOSES) ||
    typeof artifact.semanticPurpose !== 'string' ||
    artifact.semanticPurpose.trim().length === 0 ||
    !isImmutableReferenceV1(artifact.featureSchema) ||
    !validReferenceOrNull(artifact.trainingSnapshot) ||
    !validReferenceOrNull(artifact.curationPolicy) ||
    !validReferenceOrNull(artifact.trainer) ||
    !validReferenceOrNull(artifact.environment) ||
    !isImmutableReferenceV1(artifact.sourceRevision) ||
    !isOneOf(artifact.format, SYSTEM1_MODEL_FORMATS) ||
    (artifact.opset !== null && (!Number.isSafeInteger(artifact.opset) || artifact.opset < 1)) ||
    !Array.isArray(artifact.operatorInventory) ||
    artifact.operatorInventory.some((operator) => typeof operator !== 'string' || operator.length === 0) ||
    !Array.isArray(artifact.inputs) ||
    artifact.inputs.length === 0 ||
    artifact.inputs.some((spec) => !validTensorSpec(spec)) ||
    !Array.isArray(artifact.outputs) ||
    artifact.outputs.length === 0 ||
    artifact.outputs.some((spec) => !validTensorSpec(spec)) ||
    !Number.isSafeInteger(artifact.byteLength) ||
    artifact.byteLength < 0 ||
    !Number.isSafeInteger(artifact.expectedWorkingMemoryBytes) ||
    artifact.expectedWorkingMemoryBytes < 0 ||
    !validCalibration(artifact.calibration) ||
    !isOneOf(artifact.promotionStage, SYSTEM1_PROMOTION_STAGES) ||
    typeof artifact.researchFrozen !== 'boolean' ||
    !Array.isArray(artifact.knownFailureConditions) ||
    artifact.knownFailureConditions.some((condition) => typeof condition !== 'string' || condition.length === 0);

  if (invalid) {
    throw new System1ContractError('INVALID_ARTIFACT', 'System-1 artifact violates the closed V1 contract');
  }

  if (artifact.format === 'ONNX' && artifact.opset === null) {
    throw new System1ContractError('INVALID_ARTIFACT', 'ONNX artifacts require an opset');
  }
  if (artifact.format !== 'ONNX' && artifact.opset !== null) {
    throw new System1ContractError('INVALID_ARTIFACT', 'non-ONNX artifacts may not claim an ONNX opset');
  }

}

export function assertSystem1RuntimeIdentityV1(runtime: System1RuntimeIdentityV1): void {
  if (
    !runtime ||
    !exactObjectKeys(runtime, ['runtime', 'providerId', 'providerVersion', 'executionProvider']) ||
    !isImmutableReferenceV1(runtime.runtime) ||
    !LEARNING_SAFE_ID.test(runtime.providerId) ||
    !LEARNING_SAFE_ID.test(runtime.providerVersion) ||
    !isOneOf(runtime.executionProvider, SYSTEM1_EXECUTION_PROVIDERS)
  ) {
    throw new System1ContractError('INVALID_PROVIDER_RESULT', 'System-1 runtime identity is invalid');
  }
}

export function assertSystem1InferenceRequestV1<TFeatures>(
  request: System1InferenceRequestV1<TFeatures>,
): void {
  assertSystem1ModelArtifactV1(request.model);
  if (
    !exactObjectKeys(request, [
      'requestId',
      'model',
      'featureSchema',
      'features',
      'observedAt',
      'requestedAt',
      'maxObservationAgeMs',
    ]) ||
    !LEARNING_SAFE_ID.test(request.requestId) ||
    !isImmutableReferenceV1(request.featureSchema) ||
    !sameImmutableReferenceV1(request.featureSchema, request.model.featureSchema) ||
    !isLearningUtcTimestamp(request.observedAt) ||
    !isLearningUtcTimestamp(request.requestedAt) ||
    !Number.isSafeInteger(request.maxObservationAgeMs) ||
    request.maxObservationAgeMs < 0
  ) {
    throw new System1ContractError('INVALID_REQUEST', 'System-1 inference request is invalid');
  }
  if (Date.parse(request.requestedAt) < Date.parse(request.observedAt)) {
    throw new System1ContractError('INVALID_REQUEST', 'requestedAt may not precede observedAt');
  }
}

export function sameSystem1ModelIdentityV1(
  artifact: System1ModelArtifactV1,
  response: System1ProviderResponseV1<unknown>,
): boolean {
  return sameImmutableReferenceV1(artifact.artifact, response.model) &&
    sameImmutableReferenceV1(artifact.featureSchema, response.featureSchema);
}

export function assertSystem1ProviderResponseV1<TDecision>(
  artifact: System1ModelArtifactV1,
  response: System1ProviderResponseV1<TDecision>,
): void {
  if (
    !response ||
    !exactObjectKeys(response, ['model', 'featureSchema', 'inferredAt', 'latencyMs', 'outcome']) ||
    !isImmutableReferenceV1(response.model) ||
    !isImmutableReferenceV1(response.featureSchema) ||
    !sameSystem1ModelIdentityV1(artifact, response) ||
    !isLearningUtcTimestamp(response.inferredAt) ||
    !Number.isFinite(response.latencyMs) ||
    response.latencyMs < 0 ||
    !response.outcome
  ) {
    throw new System1ContractError('INVALID_PROVIDER_RESULT', 'System-1 provider response is invalid');
  }

  const expectedOutcomeKeys = response.outcome.status === 'DECISION'
    ? ['status', 'value', 'rawScore', 'calibratedProbability']
    : ['status', 'reason', 'rawScore'];
  if (!exactObjectKeys(response.outcome, expectedOutcomeKeys)) {
    throw new System1ContractError('INVALID_PROVIDER_RESULT', 'provider outcome contains unknown or missing fields');
  }

  if (response.outcome.rawScore !== null && !Number.isFinite(response.outcome.rawScore)) {
    throw new System1ContractError('INVALID_PROVIDER_RESULT', 'rawScore must be finite or null');
  }

  if (response.outcome.status === 'ABSTAIN') {
    if (!isOneOf(response.outcome.reason, SYSTEM1_ABSTAIN_REASONS)) {
      throw new System1ContractError('INVALID_PROVIDER_RESULT', 'provider returned an unknown ABSTAIN reason');
    }
    return;
  }

  if (response.outcome.status !== 'DECISION') {
    throw new System1ContractError('INVALID_PROVIDER_RESULT', 'provider outcome must be DECISION or ABSTAIN');
  }

  const probability = response.outcome.calibratedProbability;
  if (probability !== null) {
    if (
      artifact.calibration.status !== 'CALIBRATED' ||
      !Number.isFinite(probability) ||
      probability < 0 ||
      probability > 1
    ) {
      throw new System1ContractError(
        'INVALID_PROVIDER_RESULT',
        'calibratedProbability requires a calibrated artifact and a finite [0,1] value',
      );
    }
  }
}

export function hasExactSystem1ArtifactKeysV1(value: unknown): boolean {
  return exactObjectKeys(value, [
    'schemaVersion',
    'artifact',
    'purpose',
    'semanticPurpose',
    'featureSchema',
    'trainingSnapshot',
    'curationPolicy',
    'trainer',
    'environment',
    'sourceRevision',
    'format',
    'opset',
    'operatorInventory',
    'inputs',
    'outputs',
    'byteLength',
    'expectedWorkingMemoryBytes',
    'calibration',
    'knownFailureConditions',
    'promotionStage',
    'researchFrozen',
  ]);
}

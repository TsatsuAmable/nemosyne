import { GESTURE_CLASSES, type GestureClass } from '../../modules/gesture-intelligence/src/contracts.ts';
import type { ImmutableReferenceV1, Sha256DigestV1 } from '../governance/GovernedEventContracts.ts';
import { canonicalSha256Hex } from '../security/CryptoHash.ts';
import {
  validateGestureTrainingSnapshotV1,
  type GestureTrainingSnapshotV1,
} from '../vr/input/GestureLearningContracts.ts';
import {
  validateGestureEvaluationReportV1,
  type GestureEvaluationReportV1,
} from './GestureEvaluationReport.ts';
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
import {
  signModelDeploymentManifestV1,
  type ModelDeploymentManifestContentV1,
  type ModelDeploymentStage,
  type SignedModelDeploymentManifestV1,
} from './ModelDeploymentManifest.ts';
import {
  validateReproducibleTrainingJobManifestV1,
  validateTrainingJobReceiptV1,
  type ReproducibleTrainingJobManifestV1,
  type TrainingJobReceiptV1,
} from './ReproducibleTrainingJob.ts';
import {
  RuntimeModelRegistryV1,
  modelRegistryEntryReferenceV1,
  runtimeRegistryEntryReferenceV1,
  type OperationalModelRegistryEntryV1,
  type RegisterOperationalModelInputV1,
  type RuntimeRegistryEntryV1,
} from './RuntimeModelRegistry.ts';

export const GESTURE_MODEL_QUALIFICATION_SCHEMA_VERSION = '1' as const;
export const GESTURE_MODEL_QUALIFICATION_POLICY_VERSION = 'gesture-model-qualification-v1' as const;
export const GESTURE_MODEL_REVIEW_SCHEMA_VERSION = '1' as const;
export const GESTURE_MODEL_REVIEW_POLICY_VERSION = 'human-reviewed-gesture-promotion-v1' as const;

export type GestureQualificationStage = 'OFFLINE' | 'SHADOW' | 'CANARY';
export type GesturePromotionDisposition =
  | 'REJECT'
  | 'APPROVE_SHADOW'
  | 'APPROVE_CANARY'
  | 'APPROVE_PRODUCTION'
  | 'APPROVE_ROLLBACK';

export interface GestureClassMetricsV1 {
  readonly gesture: GestureClass;
  readonly support: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
}

export interface GestureReportSummaryV1 {
  readonly accuracy: number;
  readonly coverage: number;
  readonly coveredAccuracy: number | null;
  readonly macroF1: number;
  readonly supportedClassCount: number;
  readonly perClass: readonly GestureClassMetricsV1[];
}

export interface GestureQualificationEvidenceContentV1 {
  readonly schemaVersion: typeof GESTURE_MODEL_QUALIFICATION_SCHEMA_VERSION;
  readonly policyVersion: typeof GESTURE_MODEL_QUALIFICATION_POLICY_VERSION;
  readonly evidenceId: string;
  readonly evidenceVersion: string;
  readonly createdAt: string;
  readonly stage: GestureQualificationStage;
  readonly modelArtifact: ImmutableReferenceV1;
  readonly validationReport: ImmutableReferenceV1;
  readonly testReport: ImmutableReferenceV1;
  readonly baselineModel: ImmutableReferenceV1 | null;
  readonly baselineTestReport: ImmutableReferenceV1 | null;
  readonly stabilityArtifact: ImmutableReferenceV1;
  readonly stabilityCaseCount: number;
  readonly stableCaseCount: number;
  readonly knownFailureArtifact: ImmutableReferenceV1;
  readonly knownFailureCaseCount: number;
  readonly knownFailurePassCount: number;
  readonly latencyArtifact: ImmutableReferenceV1;
  readonly latencySampleCount: number;
  readonly p95LatencyMs: number;
  readonly peakResidentBytes: number;
  readonly shadowComparisonArtifact: ImmutableReferenceV1 | null;
  readonly shadowSampleCount: number;
  readonly candidatePreferredCount: number;
  readonly incumbentPreferredCount: number;
  readonly shadowTieCount: number;
  readonly canaryArtifact: ImmutableReferenceV1 | null;
  readonly canaryInvocationCount: number;
  readonly canaryFailureCount: number;
}

export interface GestureQualificationEvidenceV1 extends GestureQualificationEvidenceContentV1 {
  readonly validationSummary: GestureReportSummaryV1;
  readonly testSummary: GestureReportSummaryV1;
  readonly evidenceDigest: Sha256DigestV1;
}

export interface GesturePromotionReviewContentV1 {
  readonly schemaVersion: typeof GESTURE_MODEL_REVIEW_SCHEMA_VERSION;
  readonly policyVersion: typeof GESTURE_MODEL_REVIEW_POLICY_VERSION;
  readonly reviewId: string;
  readonly reviewVersion: string;
  readonly reviewedAt: string;
  readonly disposition: GesturePromotionDisposition;
  readonly reviewerAuthority: ImmutableReferenceV1;
  readonly modelArtifact: ImmutableReferenceV1;
  readonly qualificationEvidence: ImmutableReferenceV1;
  readonly rollbackFromModel: ImmutableReferenceV1 | null;
}

export interface GesturePromotionReviewV1 extends GesturePromotionReviewContentV1 {
  readonly reviewDigest: Sha256DigestV1;
}

export interface GestureTrainingExecutionResultV1 {
  readonly receipt: TrainingJobReceiptV1;
  readonly validationReport: GestureEvaluationReportV1;
  readonly testReport: GestureEvaluationReportV1;
}

export interface GestureTrainingExecutorV1 {
  execute(
    manifest: ReproducibleTrainingJobManifestV1,
    snapshot: GestureTrainingSnapshotV1,
  ): Promise<GestureTrainingExecutionResultV1>;
}

export interface ExecuteGestureTrainingInputV1 {
  readonly manifest: ReproducibleTrainingJobManifestV1;
  readonly snapshot: GestureTrainingSnapshotV1;
  readonly modelRegistration: Omit<RegisterOperationalModelInputV1, 'kind' | 'targetComponent' | 'modelArtifact'>;
}

export interface ExecuteGestureTrainingOutputV1 extends GestureTrainingExecutionResultV1 {
  readonly model: OperationalModelRegistryEntryV1;
}

interface GesturePromotionEvidenceInputV1 {
  readonly modelRegistryEntry: ImmutableReferenceV1;
  readonly runtimeRegistryEntry: ImmutableReferenceV1;
  readonly qualification: GestureQualificationEvidenceV1;
  readonly validationReport: GestureEvaluationReportV1;
  readonly testReport: GestureEvaluationReportV1;
  readonly review: GesturePromotionReviewV1;
  readonly manifestId: string;
  readonly manifestVersion: string;
  readonly createdAt: string;
  readonly signingKeyId: string;
  readonly privateKey: CryptoKey;
  readonly publicKey: CryptoKey;
}

export interface ApplyGesturePromotionInputV1 extends GesturePromotionEvidenceInputV1 {
  readonly stage: Exclude<ModelDeploymentStage, 'ROLLBACK'>;
  readonly rolloutPercent: number;
}

export interface ApplyGestureRollbackInputV1 extends Omit<GesturePromotionEvidenceInputV1, 'modelRegistryEntry'> {
  readonly targetModelRegistryEntry: ImmutableReferenceV1;
}

export type GestureModelUpdateIssueCode =
  | 'INVALID_TRAINING_INPUT'
  | 'TRAINING_LINEAGE_MISMATCH'
  | 'EVALUATION_BINDING_MISMATCH'
  | 'INVALID_QUALIFICATION_EVIDENCE'
  | 'QUALIFICATION_DIGEST_MISMATCH'
  | 'INVALID_OPERATOR_REVIEW'
  | 'REVIEW_DIGEST_MISMATCH'
  | 'REVIEW_STAGE_MISMATCH'
  | 'RUNTIME_ADAPTATION_FORBIDDEN'
  | 'UNKNOWN_MODEL_OR_RUNTIME';

export interface GestureModelUpdateIssueV1 {
  readonly code: GestureModelUpdateIssueCode;
  readonly path: string;
  readonly message: string;
}

export class GestureModelUpdateError extends Error {
  readonly issues: readonly GestureModelUpdateIssueV1[];

  constructor(issues: readonly GestureModelUpdateIssueV1[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
    this.name = 'GestureModelUpdateError';
    this.issues = Object.freeze([...issues]);
  }
}

function cloneNullableReference(reference: ImmutableReferenceV1 | null): ImmutableReferenceV1 | null {
  return reference ? cloneImmutableReferenceV1(reference) : null;
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function reportReference(report: GestureEvaluationReportV1): ImmutableReferenceV1 {
  return deepFreezeLearning({
    schemaVersion: '1' as const,
    id: `gesture-evaluation:${report.reportId}`,
    version: report.reportVersion,
    digest: { algorithm: 'SHA256' as const, value: report.reportDigest.value },
  });
}

export function gestureEvaluationReportReferenceV1(report: GestureEvaluationReportV1): ImmutableReferenceV1 {
  const issues = validateGestureEvaluationReportV1(report);
  if (issues.length > 0) {
    throw new GestureModelUpdateError([{
      code: 'EVALUATION_BINDING_MISMATCH',
      path: 'evaluationReport',
      message: `evaluation report is invalid: ${issues.map((issue) => issue.code).join(',')}`,
    }]);
  }
  return reportReference(report);
}

export function summarizeGestureEvaluationReportV1(report: GestureEvaluationReportV1): GestureReportSummaryV1 {
  const issues = validateGestureEvaluationReportV1(report);
  if (issues.length > 0) {
    throw new GestureModelUpdateError([{
      code: 'EVALUATION_BINDING_MISMATCH',
      path: 'evaluationReport',
      message: `cannot summarize invalid report: ${issues.map((issue) => issue.code).join(',')}`,
    }]);
  }

  const perClass = GESTURE_CLASSES.map((gesture) => {
    const row = report.confusion.find((candidate) => candidate.actualGesture === gesture)!;
    const tp = row.predictions[gesture] ?? 0;
    const fp = report.confusion
      .filter((candidate) => candidate.actualGesture !== gesture)
      .reduce((sum, candidate) => sum + (candidate.predictions[gesture] ?? 0), 0);
    const fn = row.support - tp;
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = row.support === 0 ? 0 : tp / row.support;
    const f1 = 2 * tp + fp + fn === 0 ? 0 : (2 * tp) / (2 * tp + fp + fn);
    return Object.freeze({ gesture, support: row.support, precision, recall, f1 });
  });
  return deepFreezeLearning({
    accuracy: report.accuracy,
    coverage: report.coverage,
    coveredAccuracy: report.coveredAccuracy,
    macroF1: perClass.reduce((sum, metric) => sum + metric.f1, 0) / GESTURE_CLASSES.length,
    supportedClassCount: perClass.filter((metric) => metric.support > 0).length,
    perClass,
  });
}

function validateEvidenceCounts(content: GestureQualificationEvidenceContentV1): GestureModelUpdateIssueV1[] {
  const issues: GestureModelUpdateIssueV1[] = [];
  if (
    !nonNegativeSafeInteger(content.stabilityCaseCount) || content.stabilityCaseCount < 1 ||
    !nonNegativeSafeInteger(content.stableCaseCount) || content.stableCaseCount > content.stabilityCaseCount ||
    !nonNegativeSafeInteger(content.knownFailureCaseCount) || content.knownFailureCaseCount < 1 ||
    !nonNegativeSafeInteger(content.knownFailurePassCount) || content.knownFailurePassCount > content.knownFailureCaseCount ||
    !nonNegativeSafeInteger(content.latencySampleCount) || content.latencySampleCount < 1 ||
    !Number.isFinite(content.p95LatencyMs) || content.p95LatencyMs < 0 ||
    !nonNegativeSafeInteger(content.peakResidentBytes)
  ) {
    issues.push({ code: 'INVALID_QUALIFICATION_EVIDENCE', path: 'offlineEvidence', message: 'offline evidence counts and resource measurements must be bounded and internally consistent' });
  }

  const needsShadow = content.stage === 'SHADOW' || content.stage === 'CANARY';
  if (needsShadow) {
    if (
      !isImmutableReferenceV1(content.shadowComparisonArtifact) ||
      !nonNegativeSafeInteger(content.shadowSampleCount) || content.shadowSampleCount < 1 ||
      !nonNegativeSafeInteger(content.candidatePreferredCount) ||
      !nonNegativeSafeInteger(content.incumbentPreferredCount) ||
      !nonNegativeSafeInteger(content.shadowTieCount) ||
      content.candidatePreferredCount + content.incumbentPreferredCount + content.shadowTieCount !== content.shadowSampleCount
    ) {
      issues.push({ code: 'INVALID_QUALIFICATION_EVIDENCE', path: 'shadowEvidence', message: 'shadow evidence must bind one artifact and reconcile every compared sample' });
    }
  } else if (
    content.shadowComparisonArtifact !== null || content.shadowSampleCount !== 0 ||
    content.candidatePreferredCount !== 0 || content.incumbentPreferredCount !== 0 || content.shadowTieCount !== 0
  ) {
    issues.push({ code: 'INVALID_QUALIFICATION_EVIDENCE', path: 'shadowEvidence', message: 'OFFLINE evidence may not pre-claim shadow results' });
  }

  if (content.stage === 'CANARY') {
    if (
      !isImmutableReferenceV1(content.canaryArtifact) ||
      !nonNegativeSafeInteger(content.canaryInvocationCount) || content.canaryInvocationCount < 1 ||
      !nonNegativeSafeInteger(content.canaryFailureCount) || content.canaryFailureCount > content.canaryInvocationCount
    ) {
      issues.push({ code: 'INVALID_QUALIFICATION_EVIDENCE', path: 'canaryEvidence', message: 'CANARY evidence must bind one artifact and reconcile invocation/failure counts' });
    }
  } else if (content.canaryArtifact !== null || content.canaryInvocationCount !== 0 || content.canaryFailureCount !== 0) {
    issues.push({ code: 'INVALID_QUALIFICATION_EVIDENCE', path: 'canaryEvidence', message: 'pre-canary evidence may not pre-claim canary results' });
  }
  return issues;
}

function validateQualificationContent(
  content: GestureQualificationEvidenceContentV1,
  validationReport: GestureEvaluationReportV1,
  testReport: GestureEvaluationReportV1,
): GestureModelUpdateIssueV1[] {
  const issues: GestureModelUpdateIssueV1[] = [];
  if (
    !content || content.schemaVersion !== GESTURE_MODEL_QUALIFICATION_SCHEMA_VERSION ||
    content.policyVersion !== GESTURE_MODEL_QUALIFICATION_POLICY_VERSION ||
    !LEARNING_SAFE_ID.test(content.evidenceId ?? '') || !LEARNING_STABLE_VERSION.test(content.evidenceVersion ?? '') ||
    !isLearningUtcTimestamp(content.createdAt) || !['OFFLINE', 'SHADOW', 'CANARY'].includes(content.stage)
  ) {
    issues.push({ code: 'INVALID_QUALIFICATION_EVIDENCE', path: 'qualification', message: 'qualification metadata is invalid' });
  }
  for (const [path, reference] of [
    ['modelArtifact', content?.modelArtifact], ['validationReport', content?.validationReport], ['testReport', content?.testReport],
    ['stabilityArtifact', content?.stabilityArtifact], ['knownFailureArtifact', content?.knownFailureArtifact], ['latencyArtifact', content?.latencyArtifact],
  ] as const) {
    if (!isImmutableReferenceV1(reference)) issues.push({ code: 'INVALID_QUALIFICATION_EVIDENCE', path, message: 'must be an immutable versioned reference' });
  }
  if ((content.baselineModel === null) !== (content.baselineTestReport === null)) {
    issues.push({ code: 'INVALID_QUALIFICATION_EVIDENCE', path: 'baseline', message: 'baseline model/report must both exist or both be absent' });
  } else if (content.baselineModel && (!isImmutableReferenceV1(content.baselineModel) || !isImmutableReferenceV1(content.baselineTestReport))) {
    issues.push({ code: 'INVALID_QUALIFICATION_EVIDENCE', path: 'baseline', message: 'baseline references must be immutable' });
  }

  const validationIssues = validateGestureEvaluationReportV1(validationReport);
  const testIssues = validateGestureEvaluationReportV1(testReport);
  if (validationIssues.length > 0 || testIssues.length > 0 || validationReport.split !== 'validation' || testReport.split !== 'test') {
    issues.push({ code: 'EVALUATION_BINDING_MISMATCH', path: 'reports', message: 'qualification requires valid validation and test held-out reports' });
  } else if (
    !sameImmutableReferenceV1(content.modelArtifact, validationReport.modelArtifact) ||
    !sameImmutableReferenceV1(content.modelArtifact, testReport.modelArtifact) ||
    !sameImmutableReferenceV1(content.validationReport, reportReference(validationReport)) ||
    !sameImmutableReferenceV1(content.testReport, reportReference(testReport)) ||
    validationReport.snapshot.snapshotDigest.value !== testReport.snapshot.snapshotDigest.value
  ) {
    issues.push({ code: 'EVALUATION_BINDING_MISMATCH', path: 'reports', message: 'reports must bind the same exact model and immutable PT6 snapshot' });
  }
  issues.push(...validateEvidenceCounts(content));
  return issues;
}

export function buildGestureQualificationEvidenceV1(
  content: GestureQualificationEvidenceContentV1,
  validationReport: GestureEvaluationReportV1,
  testReport: GestureEvaluationReportV1,
): GestureQualificationEvidenceV1 {
  const closed: GestureQualificationEvidenceContentV1 = {
    ...content,
    schemaVersion: GESTURE_MODEL_QUALIFICATION_SCHEMA_VERSION,
    policyVersion: GESTURE_MODEL_QUALIFICATION_POLICY_VERSION,
    modelArtifact: cloneImmutableReferenceV1(content.modelArtifact),
    validationReport: cloneImmutableReferenceV1(content.validationReport),
    testReport: cloneImmutableReferenceV1(content.testReport),
    baselineModel: cloneNullableReference(content.baselineModel),
    baselineTestReport: cloneNullableReference(content.baselineTestReport),
    stabilityArtifact: cloneImmutableReferenceV1(content.stabilityArtifact),
    knownFailureArtifact: cloneImmutableReferenceV1(content.knownFailureArtifact),
    latencyArtifact: cloneImmutableReferenceV1(content.latencyArtifact),
    shadowComparisonArtifact: cloneNullableReference(content.shadowComparisonArtifact),
    canaryArtifact: cloneNullableReference(content.canaryArtifact),
  };
  const issues = validateQualificationContent(closed, validationReport, testReport);
  if (issues.length > 0) throw new GestureModelUpdateError(issues);
  const body = {
    ...closed,
    validationSummary: summarizeGestureEvaluationReportV1(validationReport),
    testSummary: summarizeGestureEvaluationReportV1(testReport),
  };
  return deepFreezeLearning({ ...body, evidenceDigest: { algorithm: 'SHA256' as const, value: canonicalSha256Hex(body) } });
}

export function validateGestureQualificationEvidenceV1(
  evidence: GestureQualificationEvidenceV1,
  validationReport: GestureEvaluationReportV1,
  testReport: GestureEvaluationReportV1,
): readonly GestureModelUpdateIssueV1[] {
  const issues = validateQualificationContent(evidence, validationReport, testReport);
  const expectedValidation = summarizeGestureEvaluationReportV1(validationReport);
  const expectedTest = summarizeGestureEvaluationReportV1(testReport);
  if (
    canonicalSha256Hex(evidence.validationSummary) !== canonicalSha256Hex(expectedValidation) ||
    canonicalSha256Hex(evidence.testSummary) !== canonicalSha256Hex(expectedTest)
  ) {
    issues.push({ code: 'INVALID_QUALIFICATION_EVIDENCE', path: 'summaries', message: 'summaries must be derived from the exact bound reports' });
  }
  const { evidenceDigest: _digest, ...body } = evidence;
  if (!isSha256DigestV1(evidence?.evidenceDigest) || canonicalSha256Hex(body) !== evidence.evidenceDigest.value) {
    issues.push({ code: 'QUALIFICATION_DIGEST_MISMATCH', path: 'evidenceDigest', message: 'qualification evidence does not match its immutable digest' });
  }
  return issues;
}

export function gestureQualificationEvidenceReferenceV1(evidence: GestureQualificationEvidenceV1): ImmutableReferenceV1 {
  if (!isSha256DigestV1(evidence.evidenceDigest)) {
    throw new GestureModelUpdateError([{ code: 'QUALIFICATION_DIGEST_MISMATCH', path: 'evidenceDigest', message: 'qualification reference requires a SHA-256 digest' }]);
  }
  return deepFreezeLearning({
    schemaVersion: '1' as const,
    id: `gesture-qualification:${evidence.evidenceId}`,
    version: evidence.evidenceVersion,
    digest: { algorithm: 'SHA256' as const, value: evidence.evidenceDigest.value },
  });
}

export function buildGesturePromotionReviewV1(content: GesturePromotionReviewContentV1): GesturePromotionReviewV1 {
  const closed: GesturePromotionReviewContentV1 = {
    ...content,
    schemaVersion: GESTURE_MODEL_REVIEW_SCHEMA_VERSION,
    policyVersion: GESTURE_MODEL_REVIEW_POLICY_VERSION,
    reviewerAuthority: cloneImmutableReferenceV1(content.reviewerAuthority),
    modelArtifact: cloneImmutableReferenceV1(content.modelArtifact),
    qualificationEvidence: cloneImmutableReferenceV1(content.qualificationEvidence),
    rollbackFromModel: cloneNullableReference(content.rollbackFromModel),
  };
  const candidate: GesturePromotionReviewV1 = {
    ...closed,
    reviewDigest: { algorithm: 'SHA256', value: canonicalSha256Hex(closed) },
  };
  const issues = validateGesturePromotionReviewV1(candidate);
  if (issues.length > 0) throw new GestureModelUpdateError(issues);
  return deepFreezeLearning(candidate);
}

export function validateGesturePromotionReviewV1(review: GesturePromotionReviewV1): readonly GestureModelUpdateIssueV1[] {
  const issues: GestureModelUpdateIssueV1[] = [];
  const expectedKeys = [
    'schemaVersion', 'policyVersion', 'reviewId', 'reviewVersion', 'reviewedAt', 'disposition',
    'reviewerAuthority', 'modelArtifact', 'qualificationEvidence', 'rollbackFromModel', 'reviewDigest',
  ];
  if (
    !review || !exactObjectKeys(review, expectedKeys) || review.schemaVersion !== GESTURE_MODEL_REVIEW_SCHEMA_VERSION ||
    review.policyVersion !== GESTURE_MODEL_REVIEW_POLICY_VERSION || !LEARNING_SAFE_ID.test(review.reviewId ?? '') ||
    !LEARNING_STABLE_VERSION.test(review.reviewVersion ?? '') || !isLearningUtcTimestamp(review.reviewedAt) ||
    !['REJECT', 'APPROVE_SHADOW', 'APPROVE_CANARY', 'APPROVE_PRODUCTION', 'APPROVE_ROLLBACK'].includes(review.disposition) ||
    !isImmutableReferenceV1(review.reviewerAuthority) || !isImmutableReferenceV1(review.modelArtifact) ||
    !isImmutableReferenceV1(review.qualificationEvidence) ||
    (review.rollbackFromModel !== null && !isImmutableReferenceV1(review.rollbackFromModel))
  ) {
    issues.push({ code: 'INVALID_OPERATOR_REVIEW', path: 'review', message: 'operator review violates the closed PT8 human-review contract' });
  }
  const { reviewDigest: _digest, ...body } = review ?? {} as GesturePromotionReviewV1;
  if (!isSha256DigestV1(review?.reviewDigest) || canonicalSha256Hex(body) !== review.reviewDigest.value) {
    issues.push({ code: 'REVIEW_DIGEST_MISMATCH', path: 'reviewDigest', message: 'operator review does not match its immutable digest' });
  }
  return issues;
}

export function gesturePromotionReviewReferenceV1(review: GesturePromotionReviewV1): ImmutableReferenceV1 {
  const issues = validateGesturePromotionReviewV1(review);
  if (issues.length > 0) throw new GestureModelUpdateError(issues);
  return deepFreezeLearning({
    schemaVersion: '1' as const,
    id: `gesture-review:${review.reviewId}`,
    version: review.reviewVersion,
    digest: { algorithm: 'SHA256' as const, value: review.reviewDigest.value },
  });
}

function expectedDisposition(stage: ModelDeploymentStage): GesturePromotionDisposition {
  if (stage === 'SHADOW') return 'APPROVE_SHADOW';
  if (stage === 'CANARY') return 'APPROVE_CANARY';
  if (stage === 'PRODUCTION') return 'APPROVE_PRODUCTION';
  return 'APPROVE_ROLLBACK';
}

function qualificationSupportsStage(stage: ModelDeploymentStage, evidence: GestureQualificationEvidenceV1): boolean {
  if (stage === 'SHADOW') return ['OFFLINE', 'SHADOW', 'CANARY'].includes(evidence.stage);
  if (stage === 'CANARY') return ['SHADOW', 'CANARY'].includes(evidence.stage);
  if (stage === 'PRODUCTION') return evidence.stage === 'CANARY';
  return true;
}

export class GestureModelUpdateLoopV1 {
  constructor(private readonly registry: RuntimeModelRegistryV1) {}

  async executeTraining(
    executor: GestureTrainingExecutorV1,
    input: ExecuteGestureTrainingInputV1,
  ): Promise<ExecuteGestureTrainingOutputV1> {
    const snapshotIssues = validateGestureTrainingSnapshotV1(input.snapshot);
    const manifestIssues = validateReproducibleTrainingJobManifestV1(input.manifest);
    if (snapshotIssues.length > 0 || manifestIssues.length > 0 || input.manifest.outputKind !== 'GESTURE_MODEL') {
      throw new GestureModelUpdateError([{ code: 'INVALID_TRAINING_INPUT', path: 'training', message: 'PT8 requires a valid PT6 snapshot and PT7 GESTURE_MODEL manifest' }]);
    }
    if (
      input.manifest.dataset.kind !== 'GESTURE_L2_SNAPSHOT' || input.manifest.dataset.dataset.id !== input.snapshot.snapshotId ||
      input.manifest.dataset.dataset.version !== input.snapshot.snapshotVersion ||
      input.manifest.dataset.dataset.digest.value !== input.snapshot.snapshotDigest.value
    ) {
      throw new GestureModelUpdateError([{ code: 'TRAINING_LINEAGE_MISMATCH', path: 'manifest.dataset', message: 'manifest must bind the exact supplied frozen PT6 snapshot' }]);
    }

    const result = await executor.execute(input.manifest, input.snapshot);
    const receiptIssues = validateTrainingJobReceiptV1(result.receipt, input.manifest);
    if (receiptIssues.length > 0 || result.receipt.status !== 'SUCCEEDED' || !result.receipt.outputModel || !result.receipt.evaluationReport) {
      throw new GestureModelUpdateError([{ code: 'TRAINING_LINEAGE_MISMATCH', path: 'receipt', message: 'executor must return a successful exact-manifest PT7 receipt with immutable outputs' }]);
    }
    const validationIssues = validateGestureEvaluationReportV1(result.validationReport, input.snapshot);
    const testIssues = validateGestureEvaluationReportV1(result.testReport, input.snapshot);
    if (
      validationIssues.length > 0 || testIssues.length > 0 || result.validationReport.split !== 'validation' || result.testReport.split !== 'test' ||
      !sameImmutableReferenceV1(result.receipt.outputModel, result.validationReport.modelArtifact) ||
      !sameImmutableReferenceV1(result.receipt.outputModel, result.testReport.modelArtifact) ||
      !sameImmutableReferenceV1(result.receipt.evaluationReport, reportReference(result.testReport))
    ) {
      throw new GestureModelUpdateError([{ code: 'EVALUATION_BINDING_MISMATCH', path: 'evaluation', message: 'training output must bind validation/test reports for the exact output model and snapshot' }]);
    }

    const model = this.registry.registerModel({
      ...input.modelRegistration,
      kind: 'GESTURE_MODEL',
      targetComponent: 'perceptionGestureTreatment',
      modelArtifact: result.receipt.outputModel,
    }, input.manifest, result.receipt);
    return deepFreezeLearning({ model, ...result });
  }

  async applyPromotion(input: ApplyGesturePromotionInputV1): Promise<SignedModelDeploymentManifestV1> {
    const model = this.registry.model(input.modelRegistryEntry);
    const runtime = this.registry.runtime(input.runtimeRegistryEntry);
    if (!model || !runtime) throw new GestureModelUpdateError([{ code: 'UNKNOWN_MODEL_OR_RUNTIME', path: 'promotion', message: 'promotion references an unregistered model or runtime' }]);
    this.assertAdaptiveRuntime(runtime);
    this.assertQualificationAndReview(input.stage, model, input.qualification, input.validationReport, input.testReport, input.review, null);
    const previousDeployment = input.stage === 'SHADOW' ? null : this.registry.latestDeployment(input.modelRegistryEntry);
    if (input.stage !== 'SHADOW' && !previousDeployment) {
      throw new GestureModelUpdateError([{ code: 'REVIEW_STAGE_MISMATCH', path: 'promotion', message: `${input.stage} requires the exact prior deployment` }]);
    }
    const manifest = await signModelDeploymentManifestV1(this.deploymentContent(
      input.stage, model, runtime, input.review, input.manifestId, input.manifestVersion,
      input.createdAt, input.rolloutPercent, input.signingKeyId, previousDeployment, null,
    ), input.privateKey);
    await this.registry.applyDeploymentManifest(manifest, { keyId: input.signingKeyId, publicKey: input.publicKey });
    return manifest;
  }

  async applyRollback(input: ApplyGestureRollbackInputV1): Promise<SignedModelDeploymentManifestV1> {
    const target = this.registry.model(input.targetModelRegistryEntry);
    const runtime = this.registry.runtime(input.runtimeRegistryEntry);
    const current = this.registry.currentProduction();
    if (!target || !runtime || !current) throw new GestureModelUpdateError([{ code: 'UNKNOWN_MODEL_OR_RUNTIME', path: 'rollback', message: 'rollback requires registered target/runtime and active production model' }]);
    this.assertAdaptiveRuntime(runtime);
    const currentReference = modelRegistryEntryReferenceV1(current);
    const currentDeployment = this.registry.latestDeployment(currentReference);
    if (!currentDeployment) throw new GestureModelUpdateError([{ code: 'REVIEW_STAGE_MISMATCH', path: 'rollback', message: 'active production model has no exact deployment lineage' }]);
    this.assertQualificationAndReview('ROLLBACK', target, input.qualification, input.validationReport, input.testReport, input.review, current.modelArtifact);
    const manifest = await signModelDeploymentManifestV1(this.deploymentContent(
      'ROLLBACK', target, runtime, input.review, input.manifestId, input.manifestVersion,
      input.createdAt, 100, input.signingKeyId, currentDeployment, current.modelArtifact,
    ), input.privateKey);
    await this.registry.applyDeploymentManifest(manifest, { keyId: input.signingKeyId, publicKey: input.publicKey });
    return manifest;
  }

  private assertAdaptiveRuntime(runtime: RuntimeRegistryEntryV1): void {
    if (runtime.mode !== 'PRODUCT' || runtime.treatmentDisposition.perceptionGestureTreatment !== 'ADAPTIVE_ALLOWED') {
      throw new GestureModelUpdateError([{
        code: 'RUNTIME_ADAPTATION_FORBIDDEN',
        path: 'runtime.treatmentDisposition.perceptionGestureTreatment',
        message: 'gesture model rollout is allowed only in Product Mode with explicit ADAPTIVE_ALLOWED gesture treatment; Research/frozen treatments remain immutable',
      }]);
    }
  }

  private assertQualificationAndReview(
    stage: ModelDeploymentStage,
    model: OperationalModelRegistryEntryV1,
    qualification: GestureQualificationEvidenceV1,
    validationReport: GestureEvaluationReportV1,
    testReport: GestureEvaluationReportV1,
    review: GesturePromotionReviewV1,
    rollbackFromModel: ImmutableReferenceV1 | null,
  ): void {
    const qualificationIssues = validateGestureQualificationEvidenceV1(qualification, validationReport, testReport);
    if (qualificationIssues.length > 0) throw new GestureModelUpdateError(qualificationIssues);
    const reviewIssues = validateGesturePromotionReviewV1(review);
    if (reviewIssues.length > 0) throw new GestureModelUpdateError(reviewIssues);
    if (!qualificationSupportsStage(stage, qualification)) {
      throw new GestureModelUpdateError([{ code: 'REVIEW_STAGE_MISMATCH', path: 'qualification.stage', message: `${stage} lacks the required preceding qualification stage` }]);
    }
    const qualificationReference = gestureQualificationEvidenceReferenceV1(qualification);
    if (
      review.disposition !== expectedDisposition(stage) ||
      !sameImmutableReferenceV1(review.modelArtifact, model.modelArtifact) ||
      !sameImmutableReferenceV1(review.qualificationEvidence, qualificationReference) ||
      (stage === 'ROLLBACK'
        ? !rollbackFromModel || !review.rollbackFromModel || !sameImmutableReferenceV1(review.rollbackFromModel, rollbackFromModel)
        : review.rollbackFromModel !== null)
    ) {
      throw new GestureModelUpdateError([{ code: 'REVIEW_STAGE_MISMATCH', path: 'review', message: 'human review must explicitly approve this exact model, qualification artifact and deployment stage' }]);
    }
  }

  private deploymentContent(
    stage: ModelDeploymentStage,
    model: OperationalModelRegistryEntryV1,
    runtime: RuntimeRegistryEntryV1,
    review: GesturePromotionReviewV1,
    manifestId: string,
    manifestVersion: string,
    createdAt: string,
    rolloutPercent: number,
    signingKeyId: string,
    previousDeployment: ImmutableReferenceV1 | null,
    rollbackFromModel: ImmutableReferenceV1 | null,
  ): ModelDeploymentManifestContentV1 {
    return {
      schemaVersion: '1',
      policyVersion: 'signed-staged-model-deployment-v1',
      manifestId,
      manifestVersion,
      createdAt,
      stage,
      signingKeyId,
      modelArtifact: model.modelArtifact,
      modelRegistryEntry: modelRegistryEntryReferenceV1(model),
      runtimeRegistryEntry: runtimeRegistryEntryReferenceV1(runtime),
      trainingReceipt: model.trainingReceipt,
      evaluationReport: model.evaluationReport,
      operatorReview: gesturePromotionReviewReferenceV1(review),
      rolloutPercent,
      previousDeployment,
      rollbackFromModel,
    };
  }
}

import { GESTURE_CLASSES, type GestureClass } from '../../modules/gesture-intelligence/src/contracts.ts';
import type { ImmutableReferenceV1, Sha256DigestV1 } from '../governance/GovernedEventContracts.ts';
import { canonicalSha256Hex } from '../security/CryptoHash.ts';
import {
  validateGestureTrainingSnapshotV1,
  type GestureLearningSampleRefV1,
  type GestureTrainingSnapshotV1,
} from '../vr/input/GestureLearningContracts.ts';

export const GESTURE_EVALUATION_REPORT_SCHEMA_VERSION = '1' as const;
export const GESTURE_EVALUATION_POLICY_VERSION = 'gesture-heldout-report-v1' as const;
export const GESTURE_EVALUATION_ABSTAIN = 'ABSTAIN' as const;

export type GestureEvaluationSplit = 'validation' | 'test';
export type GestureEvaluationPrediction = GestureClass | typeof GESTURE_EVALUATION_ABSTAIN;

export interface GestureEvaluationObservationV1 {
  readonly recordId: string;
  readonly profilePseudonymId: string;
  readonly actualGesture: GestureClass;
  readonly predictedGesture: GestureClass | null;
}

export interface GestureEvaluationConfusionRowV1 {
  readonly actualGesture: GestureClass;
  readonly support: number;
  readonly predictions: Readonly<Record<GestureEvaluationPrediction, number>>;
}

export interface GestureEvaluationReportContentV1 {
  readonly schemaVersion: typeof GESTURE_EVALUATION_REPORT_SCHEMA_VERSION;
  readonly policyVersion: typeof GESTURE_EVALUATION_POLICY_VERSION;
  readonly reportId: string;
  readonly reportVersion: string;
  readonly createdAt: string;
  readonly snapshot: Readonly<{
    snapshotId: string;
    snapshotVersion: string;
    snapshotDigest: Sha256DigestV1;
  }>;
  readonly modelArtifact: ImmutableReferenceV1;
  readonly evaluatorArtifact: ImmutableReferenceV1;
  readonly split: GestureEvaluationSplit;
  /** Digest of exact profile + record membership. IDs are not duplicated into the report. */
  readonly splitMembershipDigest: Sha256DigestV1;
  readonly profileCount: number;
  readonly sampleCount: number;
  readonly correctCount: number;
  readonly incorrectCount: number;
  readonly abstentionCount: number;
  /** Correct / all held-out samples. Abstentions therefore cannot inflate accuracy. */
  readonly accuracy: number;
  /** Non-abstained / all held-out samples. */
  readonly coverage: number;
  /** Correct / non-abstained samples, null when coverage is zero. */
  readonly coveredAccuracy: number | null;
  readonly confusion: readonly GestureEvaluationConfusionRowV1[];
}

export interface GestureEvaluationReportV1 extends GestureEvaluationReportContentV1 {
  readonly reportDigest: Sha256DigestV1;
}

export interface GestureEvaluationReportBuildOptionsV1 {
  readonly reportId: string;
  readonly reportVersion: string;
  readonly createdAt: string;
  readonly modelArtifact: ImmutableReferenceV1;
  readonly evaluatorArtifact: ImmutableReferenceV1;
  readonly split: GestureEvaluationSplit;
}

export type GestureEvaluationIssueCode =
  | 'INVALID_REPORT_METADATA'
  | 'INVALID_SNAPSHOT'
  | 'TRAIN_SPLIT_FORBIDDEN'
  | 'INVALID_ARTIFACT_REFERENCE'
  | 'DUPLICATE_OBSERVATION'
  | 'MISSING_OBSERVATION'
  | 'EXTRA_OBSERVATION'
  | 'OBSERVATION_BINDING_MISMATCH'
  | 'INVALID_CONFUSION_MATRIX'
  | 'COUNT_MISMATCH'
  | 'METRIC_MISMATCH'
  | 'SPLIT_MEMBERSHIP_MISMATCH'
  | 'REPORT_DIGEST_MISMATCH';

export interface GestureEvaluationIssueV1 {
  readonly code: GestureEvaluationIssueCode;
  readonly path: string;
  readonly message: string;
}

export class GestureEvaluationReportError extends Error {
  readonly issues: readonly GestureEvaluationIssueV1[];

  constructor(issues: readonly GestureEvaluationIssueV1[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
    this.name = 'GestureEvaluationReportError';
    this.issues = Object.freeze([...issues]);
  }
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:+-]{0,159}$/;
const STABLE_VERSION = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const EPSILON = 1e-12;
const GESTURE_SET = new Set<string>(GESTURE_CLASSES);
const PREDICTIONS = Object.freeze([...GESTURE_CLASSES, GESTURE_EVALUATION_ABSTAIN] as const);

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function validUtcTimestamp(value: unknown): value is string {
  return typeof value === 'string' && UTC_TIMESTAMP.test(value) && Number.isFinite(Date.parse(value));
}

function validDigest(value: unknown): value is Sha256DigestV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.algorithm === 'SHA256' && typeof candidate.value === 'string' && SHA256_HEX.test(candidate.value);
}

function validReference(value: unknown): value is ImmutableReferenceV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.schemaVersion === '1' &&
    typeof candidate.id === 'string' && SAFE_ID.test(candidate.id) &&
    typeof candidate.version === 'string' && STABLE_VERSION.test(candidate.version) &&
    validDigest(candidate.digest);
}

function cloneReference(value: ImmutableReferenceV1): ImmutableReferenceV1 {
  return {
    schemaVersion: '1',
    id: value.id,
    version: value.version,
    digest: { algorithm: 'SHA256', value: value.digest.value },
  };
}

function membershipDigest(snapshot: GestureTrainingSnapshotV1, split: GestureEvaluationSplit): Sha256DigestV1 {
  const selected = snapshot.splits[split];
  return {
    algorithm: 'SHA256',
    value: canonicalSha256Hex({
      schemaVersion: '1',
      split,
      profilePseudonymIds: [...selected.profilePseudonymIds].sort(),
      recordIds: selected.samples.map((sample) => sample.recordId).sort(),
    }),
  };
}

function predictionKey(value: GestureClass | null): GestureEvaluationPrediction {
  return value ?? GESTURE_EVALUATION_ABSTAIN;
}

function emptyPredictionCounts(): Record<GestureEvaluationPrediction, number> {
  return Object.fromEntries(PREDICTIONS.map((prediction) => [prediction, 0])) as Record<GestureEvaluationPrediction, number>;
}

function buildConfusion(
  samples: readonly GestureLearningSampleRefV1[],
  observationsByRecord: ReadonlyMap<string, GestureEvaluationObservationV1>,
): readonly GestureEvaluationConfusionRowV1[] {
  const rows = new Map<GestureClass, Record<GestureEvaluationPrediction, number>>(
    GESTURE_CLASSES.map((gesture) => [gesture, emptyPredictionCounts()])
  );
  for (const sample of samples) {
    const observation = observationsByRecord.get(sample.recordId)!;
    rows.get(sample.label.assignedGesture)![predictionKey(observation.predictedGesture)] += 1;
  }
  return GESTURE_CLASSES.map((gesture) => {
    const predictions = rows.get(gesture)!;
    return {
      actualGesture: gesture,
      support: Object.values(predictions).reduce((sum, value) => sum + value, 0),
      predictions,
    };
  });
}

function countFromConfusion(confusion: readonly GestureEvaluationConfusionRowV1[]) {
  let correct = 0;
  let incorrect = 0;
  let abstention = 0;
  let total = 0;
  for (const row of confusion) {
    for (const prediction of PREDICTIONS) {
      const count = row.predictions[prediction] ?? 0;
      total += count;
      if (prediction === GESTURE_EVALUATION_ABSTAIN) abstention += count;
      else if (prediction === row.actualGesture) correct += count;
      else incorrect += count;
    }
  }
  return { correct, incorrect, abstention, total };
}

function metrics(correct: number, abstention: number, total: number) {
  const covered = total - abstention;
  return {
    accuracy: total === 0 ? 0 : correct / total,
    coverage: total === 0 ? 0 : covered / total,
    coveredAccuracy: covered === 0 ? null : correct / covered,
  };
}

function sameNumber(left: number | null, right: number | null): boolean {
  if (left === null || right === null) return left === right;
  return Math.abs(left - right) <= EPSILON;
}

function validateConfusionShape(confusion: readonly GestureEvaluationConfusionRowV1[] | undefined): GestureEvaluationIssueV1[] {
  const issues: GestureEvaluationIssueV1[] = [];
  if (!Array.isArray(confusion) || confusion.length !== GESTURE_CLASSES.length) {
    return [{ code: 'INVALID_CONFUSION_MATRIX', path: 'confusion', message: 'must contain one row for every declared gesture class' }];
  }
  const seen = new Set<string>();
  for (let index = 0; index < confusion.length; index += 1) {
    const row = confusion[index];
    if (!row || !GESTURE_SET.has(row.actualGesture) || seen.has(row.actualGesture)) {
      issues.push({ code: 'INVALID_CONFUSION_MATRIX', path: `confusion[${index}].actualGesture`, message: 'row identity must be a unique declared gesture class' });
      continue;
    }
    seen.add(row.actualGesture);
    const keys = Object.keys(row.predictions ?? {}).sort();
    const expected = [...PREDICTIONS].sort();
    if (keys.length !== expected.length || keys.some((entry, keyIndex) => entry !== expected[keyIndex])) {
      issues.push({ code: 'INVALID_CONFUSION_MATRIX', path: `confusion[${index}].predictions`, message: 'prediction counts must cover every gesture class plus ABSTAIN exactly once' });
      continue;
    }
    const values = PREDICTIONS.map((prediction) => row.predictions[prediction]);
    if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
      issues.push({ code: 'INVALID_CONFUSION_MATRIX', path: `confusion[${index}].predictions`, message: 'all confusion counts must be non-negative safe integers' });
      continue;
    }
    const support = values.reduce((sum, value) => sum + value, 0);
    if (!Number.isSafeInteger(row.support) || row.support !== support) {
      issues.push({ code: 'INVALID_CONFUSION_MATRIX', path: `confusion[${index}].support`, message: 'support must equal the row prediction total' });
    }
  }
  return issues;
}

/**
 * Build a held-out evaluation artifact from an immutable PT6 snapshot.
 *
 * The train split is intentionally not accepted. Every held-out sample must
 * have exactly one observation bound to the same purpose-scoped profile and
 * frozen human label. Abstention is explicit and counts against all-sample
 * accuracy while coverage is reported separately.
 */
export function buildGestureEvaluationReportV1(
  snapshot: GestureTrainingSnapshotV1,
  observations: readonly GestureEvaluationObservationV1[],
  options: GestureEvaluationReportBuildOptionsV1,
): GestureEvaluationReportV1 {
  const issues: GestureEvaluationIssueV1[] = [];
  if (validateGestureTrainingSnapshotV1(snapshot).length > 0) {
    issues.push({ code: 'INVALID_SNAPSHOT', path: 'snapshot', message: 'evaluation requires a valid immutable PT6 training snapshot' });
  }
  if (
    !SAFE_ID.test(options.reportId) ||
    !STABLE_VERSION.test(options.reportVersion) ||
    !validUtcTimestamp(options.createdAt) ||
    (options.split !== 'validation' && options.split !== 'test')
  ) {
    issues.push({ code: 'INVALID_REPORT_METADATA', path: 'options', message: 'report identity, version, timestamp and held-out split are invalid' });
  }
  if (!validReference(options.modelArtifact) || !validReference(options.evaluatorArtifact)) {
    issues.push({ code: 'INVALID_ARTIFACT_REFERENCE', path: 'options', message: 'model and evaluator must be immutable versioned artifacts' });
  }
  if (issues.length > 0) throw new GestureEvaluationReportError(issues);

  const split = snapshot.splits[options.split];
  const expected = new Map(split.samples.map((sample) => [sample.recordId, sample] as const));
  const observationsByRecord = new Map<string, GestureEvaluationObservationV1>();

  for (let index = 0; index < observations.length; index += 1) {
    const observation = observations[index];
    if (observationsByRecord.has(observation.recordId)) {
      issues.push({ code: 'DUPLICATE_OBSERVATION', path: `observations[${index}].recordId`, message: 'each held-out record must be evaluated exactly once' });
      continue;
    }
    observationsByRecord.set(observation.recordId, observation);
    const sample = expected.get(observation.recordId);
    if (!sample) {
      issues.push({ code: 'EXTRA_OBSERVATION', path: `observations[${index}].recordId`, message: 'observation does not belong to the selected held-out split' });
      continue;
    }
    if (
      observation.profilePseudonymId !== sample.profilePseudonymId ||
      observation.actualGesture !== sample.label.assignedGesture ||
      (observation.predictedGesture !== null && !GESTURE_SET.has(observation.predictedGesture))
    ) {
      issues.push({ code: 'OBSERVATION_BINDING_MISMATCH', path: `observations[${index}]`, message: 'observation identity/label must match the immutable snapshot and prediction must be declared or abstain' });
    }
  }
  for (const sample of split.samples) {
    if (!observationsByRecord.has(sample.recordId)) {
      issues.push({ code: 'MISSING_OBSERVATION', path: `observations`, message: `missing held-out result for ${sample.recordId}` });
    }
  }
  if (issues.length > 0) throw new GestureEvaluationReportError(issues);

  const confusion = buildConfusion(split.samples, observationsByRecord);
  const counts = countFromConfusion(confusion);
  const derived = metrics(counts.correct, counts.abstention, counts.total);
  const content: GestureEvaluationReportContentV1 = {
    schemaVersion: GESTURE_EVALUATION_REPORT_SCHEMA_VERSION,
    policyVersion: GESTURE_EVALUATION_POLICY_VERSION,
    reportId: options.reportId,
    reportVersion: options.reportVersion,
    createdAt: options.createdAt,
    snapshot: {
      snapshotId: snapshot.snapshotId,
      snapshotVersion: snapshot.snapshotVersion,
      snapshotDigest: { algorithm: 'SHA256', value: snapshot.snapshotDigest.value },
    },
    modelArtifact: cloneReference(options.modelArtifact),
    evaluatorArtifact: cloneReference(options.evaluatorArtifact),
    split: options.split,
    splitMembershipDigest: membershipDigest(snapshot, options.split),
    profileCount: split.profilePseudonymIds.length,
    sampleCount: counts.total,
    correctCount: counts.correct,
    incorrectCount: counts.incorrect,
    abstentionCount: counts.abstention,
    accuracy: derived.accuracy,
    coverage: derived.coverage,
    coveredAccuracy: derived.coveredAccuracy,
    confusion,
  };

  return deepFreeze({
    ...content,
    reportDigest: { algorithm: 'SHA256', value: canonicalSha256Hex(content) },
  });
}

export function validateGestureEvaluationReportV1(
  report: GestureEvaluationReportV1,
  snapshot?: GestureTrainingSnapshotV1,
): readonly GestureEvaluationIssueV1[] {
  const issues: GestureEvaluationIssueV1[] = [];
  if (
    report?.schemaVersion !== GESTURE_EVALUATION_REPORT_SCHEMA_VERSION ||
    report?.policyVersion !== GESTURE_EVALUATION_POLICY_VERSION ||
    !SAFE_ID.test(report?.reportId ?? '') ||
    !STABLE_VERSION.test(report?.reportVersion ?? '') ||
    !validUtcTimestamp(report?.createdAt) ||
    (report?.split !== 'validation' && report?.split !== 'test')
  ) {
    issues.push({ code: 'INVALID_REPORT_METADATA', path: 'report', message: 'report must use the frozen PT6D schema/policy and a held-out split' });
  }
  if (!validReference(report?.modelArtifact) || !validReference(report?.evaluatorArtifact)) {
    issues.push({ code: 'INVALID_ARTIFACT_REFERENCE', path: 'report', message: 'model/evaluator references are invalid' });
  }
  if (!validDigest(report?.snapshot?.snapshotDigest) || !validDigest(report?.splitMembershipDigest)) {
    issues.push({ code: 'INVALID_REPORT_METADATA', path: 'report', message: 'snapshot and split membership digests must be SHA-256' });
  }
  issues.push(...validateConfusionShape(report?.confusion));

  if (issues.every((issue) => issue.code !== 'INVALID_CONFUSION_MATRIX')) {
    const counts = countFromConfusion(report.confusion);
    if (
      report.sampleCount !== counts.total ||
      report.correctCount !== counts.correct ||
      report.incorrectCount !== counts.incorrect ||
      report.abstentionCount !== counts.abstention ||
      report.sampleCount !== report.correctCount + report.incorrectCount + report.abstentionCount
    ) {
      issues.push({ code: 'COUNT_MISMATCH', path: 'report', message: 'summary counts must equal the confusion matrix and total held-out sample count' });
    }
    const derived = metrics(counts.correct, counts.abstention, counts.total);
    if (
      !sameNumber(report.accuracy, derived.accuracy) ||
      !sameNumber(report.coverage, derived.coverage) ||
      !sameNumber(report.coveredAccuracy, derived.coveredAccuracy)
    ) {
      issues.push({ code: 'METRIC_MISMATCH', path: 'report', message: 'accuracy/coverage metrics must be deterministically derived from counts' });
    }
  }

  if (snapshot) {
    const snapshotIssues = validateGestureTrainingSnapshotV1(snapshot);
    if (snapshotIssues.length > 0) {
      issues.push({ code: 'INVALID_SNAPSHOT', path: 'snapshot', message: 'supplied snapshot is invalid' });
    } else if (
      report.snapshot.snapshotId !== snapshot.snapshotId ||
      report.snapshot.snapshotVersion !== snapshot.snapshotVersion ||
      report.snapshot.snapshotDigest.value !== snapshot.snapshotDigest.value
    ) {
      issues.push({ code: 'INVALID_SNAPSHOT', path: 'snapshot', message: 'report snapshot identity does not match supplied immutable snapshot' });
    } else {
      const selected = snapshot.splits[report.split];
      const expectedMembership = membershipDigest(snapshot, report.split);
      if (
        report.profileCount !== selected.profilePseudonymIds.length ||
        report.sampleCount !== selected.samples.length ||
        report.splitMembershipDigest.value !== expectedMembership.value
      ) {
        issues.push({ code: 'SPLIT_MEMBERSHIP_MISMATCH', path: 'splitMembershipDigest', message: 'report does not bind the exact selected held-out membership' });
      }
    }
  }

  if (!validDigest(report?.reportDigest)) {
    issues.push({ code: 'REPORT_DIGEST_MISMATCH', path: 'reportDigest', message: 'report digest must be SHA-256' });
  } else {
    const { reportDigest: _digest, ...content } = report;
    if (canonicalSha256Hex(content) !== report.reportDigest.value) {
      issues.push({ code: 'REPORT_DIGEST_MISMATCH', path: 'reportDigest.value', message: 'report content does not match its immutable digest' });
    }
  }

  return issues;
}

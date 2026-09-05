import { describe, expect, it } from 'vitest';

import { GESTURE_CLASSES, type GestureClass } from '../modules/gesture-intelligence/src/contracts.ts';
import { GOVERNED_PURPOSES, type ImmutableReferenceV1 } from '../src/governance/GovernedEventContracts.ts';
import {
  GestureEvaluationReportError,
  buildGestureEvaluationReportV1,
  validateGestureEvaluationReportV1,
  type GestureEvaluationObservationV1,
  type GestureEvaluationReportV1,
} from '../src/learning/GestureEvaluationReport.ts';
import { canonicalSha256Hex, sha256Hex } from '../src/security/CryptoHash.ts';
import {
  buildGestureTrainingSnapshotV1,
  type GestureLearningSampleRefV1,
} from '../src/vr/input/GestureLearningContracts.ts';

const CREATED_AT = '2026-09-05T07:15:00.000Z';

function digest(value: string) {
  return { algorithm: 'SHA256' as const, value: sha256Hex(value) };
}

function reference(id: string, version = '1.0.0'): ImmutableReferenceV1 {
  return {
    schemaVersion: '1',
    id,
    version,
    digest: digest(`${id}:${version}`),
  };
}

const FEATURE_SCHEMA = reference('gesture-derived-feature-schema');
const MODEL_ARTIFACT = reference('gesture-model-fixture', '0.1.0');
const EVALUATOR_ARTIFACT = reference('gesture-evaluator-fixture', '1.0.0');

function sample(profile: string, index: number, gesture: GestureClass): GestureLearningSampleRefV1 {
  return {
    schemaVersion: '1',
    recordId: `record-${profile}-${index}`,
    purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
    profilePseudonymId: profile,
    featureSchema: FEATURE_SCHEMA,
    contentDigest: digest(`content-${profile}-${index}`),
    consent: {
      schemaVersion: '1',
      purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
      receipt: { id: `receipt-${profile}`, revision: '1', digest: digest(`receipt-${profile}`) },
      policy: reference('derived-gesture-policy'),
    },
    label: {
      schemaVersion: '1',
      rulesVersion: '1.0.0',
      source: 'EXPLICIT_CONFIRMATION',
      predictedGesture: gesture,
      assignedGesture: gesture,
      evidenceId: `evidence-${profile}-${index}`,
      recordedAt: CREATED_AT,
    },
  };
}

function snapshot() {
  const samples = Array.from({ length: 8 }, (_, profileIndex) => {
    const profile = `evaluation-profile-${profileIndex + 1}`;
    return [
      sample(profile, profileIndex * 2, GESTURE_CLASSES[profileIndex % GESTURE_CLASSES.length]),
      sample(profile, profileIndex * 2 + 1, GESTURE_CLASSES[(profileIndex + 1) % GESTURE_CLASSES.length]),
    ];
  }).flat();
  return buildGestureTrainingSnapshotV1(samples, {
    snapshotId: 'gesture-evaluation-snapshot',
    snapshotVersion: '1.0.0',
    createdAt: CREATED_AT,
    splitSeed: 'pt6d-evaluation-split-seed',
    validationFraction: 0.25,
    testFraction: 0.25,
  });
}

function observationsForValidation() {
  const value = snapshot();
  return value.splits.validation.samples.map((row, index): GestureEvaluationObservationV1 => ({
    recordId: row.recordId,
    profilePseudonymId: row.profilePseudonymId,
    actualGesture: row.label.assignedGesture,
    predictedGesture: index === 0
      ? null
      : index === 1
        ? GESTURE_CLASSES[(GESTURE_CLASSES.indexOf(row.label.assignedGesture) + 1) % GESTURE_CLASSES.length]
        : row.label.assignedGesture,
  }));
}

function build(observations = observationsForValidation()) {
  const value = snapshot();
  return {
    snapshot: value,
    report: buildGestureEvaluationReportV1(value, observations, {
      reportId: 'gesture-evaluation-report-fixture',
      reportVersion: '1.0.0',
      createdAt: CREATED_AT,
      modelArtifact: MODEL_ARTIFACT,
      evaluatorArtifact: EVALUATOR_ARTIFACT,
      split: 'validation',
    }),
  };
}

describe('PT6D held-out gesture evaluation report contract', () => {
  it('binds exactly one result per held-out sample and reports abstention separately from covered accuracy', () => {
    const { snapshot: value, report } = build();
    const selected = value.splits.validation.samples.length;

    expect(report.sampleCount).toBe(selected);
    expect(report.abstentionCount).toBe(1);
    expect(report.incorrectCount).toBe(1);
    expect(report.correctCount).toBe(selected - 2);
    expect(report.accuracy).toBe((selected - 2) / selected);
    expect(report.coverage).toBe((selected - 1) / selected);
    expect(report.coveredAccuracy).toBe((selected - 2) / (selected - 1));
    expect(validateGestureEvaluationReportV1(report, value)).toEqual([]);
    expect(Object.isFrozen(report)).toBe(true);
  });

  it('is deterministic across observation order and never embeds profile identifiers in the summary contract', () => {
    const value = snapshot();
    const observations = observationsForValidation();
    const forward = buildGestureEvaluationReportV1(value, observations, {
      reportId: 'gesture-evaluation-order',
      reportVersion: '1.0.0',
      createdAt: CREATED_AT,
      modelArtifact: MODEL_ARTIFACT,
      evaluatorArtifact: EVALUATOR_ARTIFACT,
      split: 'validation',
    });
    const reverse = buildGestureEvaluationReportV1(value, [...observations].reverse(), {
      reportId: 'gesture-evaluation-order',
      reportVersion: '1.0.0',
      createdAt: CREATED_AT,
      modelArtifact: MODEL_ARTIFACT,
      evaluatorArtifact: EVALUATOR_ARTIFACT,
      split: 'validation',
    });

    expect(forward).toEqual(reverse);
    expect(JSON.stringify(forward)).not.toContain('evaluation-profile-');
    expect(forward.splitMembershipDigest.value).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses duplicate, missing, extra and relabelled held-out observations', () => {
    const value = snapshot();
    const observations = observationsForValidation();

    expect(() => buildGestureEvaluationReportV1(value, [...observations, observations[0]], {
      reportId: 'duplicate-report',
      reportVersion: '1.0.0',
      createdAt: CREATED_AT,
      modelArtifact: MODEL_ARTIFACT,
      evaluatorArtifact: EVALUATOR_ARTIFACT,
      split: 'validation',
    })).toThrow(GestureEvaluationReportError);

    expect(() => buildGestureEvaluationReportV1(value, observations.slice(1), {
      reportId: 'missing-report',
      reportVersion: '1.0.0',
      createdAt: CREATED_AT,
      modelArtifact: MODEL_ARTIFACT,
      evaluatorArtifact: EVALUATOR_ARTIFACT,
      split: 'validation',
    })).toThrow(GestureEvaluationReportError);

    const extra = { ...observations[0], recordId: 'record-not-in-validation-split' };
    expect(() => buildGestureEvaluationReportV1(value, [extra, ...observations.slice(1)], {
      reportId: 'extra-report',
      reportVersion: '1.0.0',
      createdAt: CREATED_AT,
      modelArtifact: MODEL_ARTIFACT,
      evaluatorArtifact: EVALUATOR_ARTIFACT,
      split: 'validation',
    })).toThrow(GestureEvaluationReportError);

    const wrongLabel = {
      ...observations[0],
      actualGesture: GESTURE_CLASSES[(GESTURE_CLASSES.indexOf(observations[0].actualGesture) + 1) % GESTURE_CLASSES.length],
    };
    expect(() => buildGestureEvaluationReportV1(value, [wrongLabel, ...observations.slice(1)], {
      reportId: 'relabelled-report',
      reportVersion: '1.0.0',
      createdAt: CREATED_AT,
      modelArtifact: MODEL_ARTIFACT,
      evaluatorArtifact: EVALUATOR_ARTIFACT,
      split: 'validation',
    })).toThrow(GestureEvaluationReportError);
  });

  it('detects re-digested metric forgery and split-membership substitution', () => {
    const { snapshot: value, report } = build();
    const forged = JSON.parse(JSON.stringify(report)) as GestureEvaluationReportV1 & Record<string, unknown>;
    (forged as { correctCount: number }).correctCount += 1;
    const { reportDigest: _oldMetricDigest, ...metricContent } = forged;
    (forged as { reportDigest: { algorithm: 'SHA256'; value: string } }).reportDigest = {
      algorithm: 'SHA256',
      value: canonicalSha256Hex(metricContent),
    };
    const metricIssues = validateGestureEvaluationReportV1(forged, value);
    expect(metricIssues.some((issue) => issue.code === 'REPORT_DIGEST_MISMATCH')).toBe(false);
    expect(metricIssues.some((issue) => issue.code === 'COUNT_MISMATCH')).toBe(true);

    const substituted = JSON.parse(JSON.stringify(report)) as GestureEvaluationReportV1 & Record<string, unknown>;
    (substituted as { splitMembershipDigest: { algorithm: 'SHA256'; value: string } }).splitMembershipDigest = digest('other-heldout-membership');
    const { reportDigest: _oldMembershipDigest, ...membershipContent } = substituted;
    (substituted as { reportDigest: { algorithm: 'SHA256'; value: string } }).reportDigest = {
      algorithm: 'SHA256',
      value: canonicalSha256Hex(membershipContent),
    };
    const membershipIssues = validateGestureEvaluationReportV1(substituted, value);
    expect(membershipIssues.some((issue) => issue.code === 'REPORT_DIGEST_MISMATCH')).toBe(false);
    expect(membershipIssues.some((issue) => issue.code === 'SPLIT_MEMBERSHIP_MISMATCH')).toBe(true);
  });
});

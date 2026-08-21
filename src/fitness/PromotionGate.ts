import type { FitnessModelArtifact } from './FitnessModelRegistry.ts';
import { GROUP_BALANCED_PAIRWISE_METRIC } from './GroupBalancedEvaluation.ts';

export interface FitnessModelPromotionPolicy {
  minimumHoldoutJudgements: number;
  minimumHoldoutGroups: number;
  minimumAbsoluteImprovement: number;
  requiredMetricName?: string;
}

export type FitnessModelPromotionRejectionReason =
  | 'UNSUPPORTED_MODEL_KIND'
  | 'METRIC_MISMATCH'
  | 'INSUFFICIENT_HOLDOUT_JUDGEMENTS'
  | 'INSUFFICIENT_HOLDOUT_GROUPS'
  | 'NON_FINITE_METRIC'
  | 'CANDIDATE_DOES_NOT_BEAT_BOOTSTRAP'
  | 'IMPROVEMENT_BELOW_THRESHOLD';

export interface FitnessModelPromotionAssessment {
  eligible: boolean;
  absoluteImprovement: number;
  reasons: readonly FitnessModelPromotionRejectionReason[];
}

function assertPolicy(policy: FitnessModelPromotionPolicy): void {
  if (!Number.isSafeInteger(policy.minimumHoldoutJudgements) || policy.minimumHoldoutJudgements < 1) {
    throw new TypeError('minimumHoldoutJudgements must be a positive safe integer');
  }
  if (!Number.isSafeInteger(policy.minimumHoldoutGroups) || policy.minimumHoldoutGroups < 1) {
    throw new TypeError('minimumHoldoutGroups must be a positive safe integer');
  }
  if (!Number.isFinite(policy.minimumAbsoluteImprovement) || policy.minimumAbsoluteImprovement < 0) {
    throw new TypeError('minimumAbsoluteImprovement must be finite and non-negative');
  }
}

/**
 * Pure eligibility check for learned model promotion.
 *
 * Passing this gate does not activate a model. Registry promotion remains an
 * explicit separate operation so study freezes, operator review, and rollback
 * policy can decide when an eligible artifact becomes live.
 *
 * The default metric is group-balanced pairwise accuracy so each independent
 * dataset+researcher holdout group contributes equally rather than allowing a
 * prolific group to dominate the promotion decision.
 */
export function assessFitnessModelPromotion(
  artifact: FitnessModelArtifact,
  policy: FitnessModelPromotionPolicy,
): FitnessModelPromotionAssessment {
  assertPolicy(policy);
  const reasons: FitnessModelPromotionRejectionReason[] = [];
  const evaluation = artifact.evaluation;
  const requiredMetric = policy.requiredMetricName ?? GROUP_BALANCED_PAIRWISE_METRIC;

  if (artifact.modelKind !== 'pairwise-linear' && artifact.modelKind !== 'ranking-linear') {
    reasons.push('UNSUPPORTED_MODEL_KIND');
  }
  if (evaluation.metricName !== requiredMetric) reasons.push('METRIC_MISMATCH');
  if (evaluation.holdoutJudgementCount < policy.minimumHoldoutJudgements) {
    reasons.push('INSUFFICIENT_HOLDOUT_JUDGEMENTS');
  }
  if (evaluation.holdoutGroupCount < policy.minimumHoldoutGroups) {
    reasons.push('INSUFFICIENT_HOLDOUT_GROUPS');
  }
  if (!Number.isFinite(evaluation.bootstrapMetric) || !Number.isFinite(evaluation.candidateMetric)) {
    reasons.push('NON_FINITE_METRIC');
  }

  const improvement = evaluation.candidateMetric - evaluation.bootstrapMetric;
  if (Number.isFinite(improvement)) {
    if (improvement <= 0) reasons.push('CANDIDATE_DOES_NOT_BEAT_BOOTSTRAP');
    else if (improvement < policy.minimumAbsoluteImprovement) reasons.push('IMPROVEMENT_BELOW_THRESHOLD');
  }

  return {
    eligible: reasons.length === 0,
    absoluteImprovement: improvement,
    reasons,
  };
}

import type { FitnessModelArtifact } from './FitnessModelRegistry.ts';
import { GROUP_BALANCED_PAIRWISE_METRIC } from './GroupBalancedEvaluation.ts';

export interface FitnessModelPromotionPolicy {
  minimumHoldoutJudgements: number;
  minimumHoldoutGroups: number;
  minimumAbsoluteImprovement: number;
  requiredMetricName?: string;
  /** Maximum one-sided exact sign-test p-value for candidate wins across independent groups. */
  maximumGroupWinPValue?: number;
}

export type FitnessModelPromotionRejectionReason =
  | 'UNSUPPORTED_MODEL_KIND'
  | 'METRIC_MISMATCH'
  | 'INSUFFICIENT_HOLDOUT_JUDGEMENTS'
  | 'INSUFFICIENT_HOLDOUT_GROUPS'
  | 'NON_FINITE_METRIC'
  | 'CANDIDATE_DOES_NOT_BEAT_BOOTSTRAP'
  | 'IMPROVEMENT_BELOW_THRESHOLD'
  | 'MISSING_GROUP_WIN_EVIDENCE'
  | 'GROUP_WIN_EVIDENCE_NOT_SIGNIFICANT';

export interface FitnessModelPromotionAssessment {
  eligible: boolean;
  absoluteImprovement: number;
  reasons: readonly FitnessModelPromotionRejectionReason[];
}

function assertPolicy(policy: FitnessModelPromotionPolicy): void {
  if (!Number.isSafeInteger(policy.minimumHoldoutJudgements) || policy.minimumHoldoutJudgements < 1) throw new TypeError('minimumHoldoutJudgements must be a positive safe integer');
  if (!Number.isSafeInteger(policy.minimumHoldoutGroups) || policy.minimumHoldoutGroups < 1) throw new TypeError('minimumHoldoutGroups must be a positive safe integer');
  if (!Number.isFinite(policy.minimumAbsoluteImprovement) || policy.minimumAbsoluteImprovement < 0) throw new TypeError('minimumAbsoluteImprovement must be finite and non-negative');
  const maximumPValue = policy.maximumGroupWinPValue ?? 0.05;
  if (!Number.isFinite(maximumPValue) || maximumPValue <= 0 || maximumPValue > 1) throw new TypeError('maximumGroupWinPValue must be within (0, 1]');
}

function hasCompleteGroupWinEvidence(evaluation: FitnessModelArtifact['evaluation']): boolean {
  const candidateWins = evaluation.candidateGroupWins;
  const bootstrapWins = evaluation.bootstrapGroupWins;
  const ties = evaluation.tiedGroups;
  const pValue = evaluation.oneSidedGroupWinPValue;
  return (
    typeof candidateWins === 'number' && Number.isSafeInteger(candidateWins) && candidateWins >= 0 &&
    typeof bootstrapWins === 'number' && Number.isSafeInteger(bootstrapWins) && bootstrapWins >= 0 &&
    typeof ties === 'number' && Number.isSafeInteger(ties) && ties >= 0 &&
    candidateWins + bootstrapWins + ties === evaluation.holdoutGroupCount &&
    typeof pValue === 'number' && Number.isFinite(pValue) && pValue >= 0 && pValue <= 1
  );
}

/**
 * Pure eligibility check for learned model promotion. Passing this gate never
 * activates a model. By default promotion requires both a group-balanced mean
 * improvement and evidence that candidate wins are distributed across
 * independent holdout groups rather than concentrated in a few groups.
 */
export function assessFitnessModelPromotion(
  artifact: FitnessModelArtifact,
  policy: FitnessModelPromotionPolicy,
): FitnessModelPromotionAssessment {
  assertPolicy(policy);
  const reasons: FitnessModelPromotionRejectionReason[] = [];
  const evaluation = artifact.evaluation;
  const requiredMetric = policy.requiredMetricName ?? GROUP_BALANCED_PAIRWISE_METRIC;
  const maximumPValue = policy.maximumGroupWinPValue ?? 0.05;

  if (artifact.modelKind !== 'pairwise-linear' && artifact.modelKind !== 'ranking-linear') reasons.push('UNSUPPORTED_MODEL_KIND');
  if (evaluation.metricName !== requiredMetric) reasons.push('METRIC_MISMATCH');
  if (evaluation.holdoutJudgementCount < policy.minimumHoldoutJudgements) reasons.push('INSUFFICIENT_HOLDOUT_JUDGEMENTS');
  if (evaluation.holdoutGroupCount < policy.minimumHoldoutGroups) reasons.push('INSUFFICIENT_HOLDOUT_GROUPS');
  if (!Number.isFinite(evaluation.bootstrapMetric) || !Number.isFinite(evaluation.candidateMetric)) reasons.push('NON_FINITE_METRIC');

  const improvement = evaluation.candidateMetric - evaluation.bootstrapMetric;
  if (Number.isFinite(improvement)) {
    if (improvement <= 0) reasons.push('CANDIDATE_DOES_NOT_BEAT_BOOTSTRAP');
    else if (improvement < policy.minimumAbsoluteImprovement) reasons.push('IMPROVEMENT_BELOW_THRESHOLD');
  }

  if (!hasCompleteGroupWinEvidence(evaluation)) {
    reasons.push('MISSING_GROUP_WIN_EVIDENCE');
  } else if ((evaluation.oneSidedGroupWinPValue as number) > maximumPValue) {
    reasons.push('GROUP_WIN_EVIDENCE_NOT_SIGNIFICANT');
  }

  return { eligible: reasons.length === 0, absoluteImprovement: improvement, reasons };
}

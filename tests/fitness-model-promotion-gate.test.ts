import { describe, expect, it } from 'vitest';
import {
  assessFitnessModelPromotion,
  GROUP_BALANCED_PAIRWISE_METRIC,
  oneSidedGroupWinSignTest,
  type FitnessModelArtifact,
} from '../src/fitness/index.ts';

function artifact(
  candidateMetric: number,
  bootstrapMetric = 0.6,
  holdoutJudgementCount = 40,
  holdoutGroupCount = 12,
  candidateGroupWins = Math.max(0, holdoutGroupCount - 2),
  bootstrapGroupWins = Math.min(2, holdoutGroupCount),
): FitnessModelArtifact {
  const tiedGroups = holdoutGroupCount - candidateGroupWins - bootstrapGroupWins;
  return {
    schemaVersion: '1.0.0',
    modelId: 'moneta-pairwise-linear',
    modelVersion: 'v1',
    modelKind: 'pairwise-linear',
    createdAt: 1,
    trainingDatasetHash: 'dataset',
    curationPolicyHash: 'policy',
    featureSchemaVersion: '1.0.0',
    parameters: { weights: [1] },
    evaluation: {
      bootstrapMetric,
      candidateMetric,
      metricName: GROUP_BALANCED_PAIRWISE_METRIC,
      holdoutJudgementCount,
      holdoutGroupCount,
      candidateGroupWins,
      bootstrapGroupWins,
      tiedGroups,
      oneSidedGroupWinPValue: oneSidedGroupWinSignTest(candidateGroupWins, bootstrapGroupWins),
    },
  };
}

const policy = {
  minimumHoldoutJudgements: 30,
  minimumHoldoutGroups: 10,
  minimumAbsoluteImprovement: 0.05,
};

describe('Fitness model promotion eligibility', () => {
  it('accepts only a group-balanced improvement distributed across independent holdout groups', () => {
    const result = assessFitnessModelPromotion(artifact(0.7), policy);
    expect(result.eligible).toBe(true);
    expect(result.absoluteImprovement).toBeCloseTo(0.1);
    expect(result.reasons).toEqual([]);
  });

  it('rejects a candidate that does not beat bootstrap', () => {
    const result = assessFitnessModelPromotion(artifact(0.55), policy);
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain('CANDIDATE_DOES_NOT_BEAT_BOOTSTRAP');
  });

  it('rejects statistically thin holdout evidence', () => {
    const result = assessFitnessModelPromotion(artifact(0.8, 0.6, 10, 3, 3, 0), policy);
    expect(result.reasons).toContain('INSUFFICIENT_HOLDOUT_JUDGEMENTS');
    expect(result.reasons).toContain('INSUFFICIENT_HOLDOUT_GROUPS');
  });

  it('rejects an improvement smaller than the declared threshold', () => {
    const result = assessFitnessModelPromotion(artifact(0.63), policy);
    expect(result.reasons).toContain('IMPROVEMENT_BELOW_THRESHOLD');
  });

  it('rejects a large mean improvement that is not distributed across enough groups', () => {
    const concentrated = artifact(0.8, 0.6, 40, 12, 7, 5);
    const result = assessFitnessModelPromotion(concentrated, policy);
    expect(result.absoluteImprovement).toBeCloseTo(0.2);
    expect(result.reasons).toContain('GROUP_WIN_EVIDENCE_NOT_SIGNIFICANT');
  });

  it('fails closed when an artifact has no group-win evidence', () => {
    const missing = artifact(0.8);
    delete missing.evaluation.candidateGroupWins;
    delete missing.evaluation.bootstrapGroupWins;
    delete missing.evaluation.tiedGroups;
    delete missing.evaluation.oneSidedGroupWinPValue;
    expect(assessFitnessModelPromotion(missing, policy).reasons).toContain('MISSING_GROUP_WIN_EVIDENCE');
  });

  it('rejects judgement-weighted pairwise accuracy unless explicitly requested', () => {
    const legacy = artifact(0.8);
    legacy.evaluation.metricName = 'pairwise-accuracy';
    expect(assessFitnessModelPromotion(legacy, policy).reasons).toContain('METRIC_MISMATCH');

    expect(
      assessFitnessModelPromotion(legacy, {
        ...policy,
        requiredMetricName: 'pairwise-accuracy',
      }).eligible,
    ).toBe(true);
  });
});

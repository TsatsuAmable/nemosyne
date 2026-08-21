import { describe, expect, it } from 'vitest';
import { assessFitnessModelPromotion, type FitnessModelArtifact } from '../src/fitness/index.ts';

function artifact(candidateMetric: number, bootstrapMetric = 0.6, holdoutJudgementCount = 40, holdoutGroupCount = 12): FitnessModelArtifact {
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
      metricName: 'pairwise-accuracy',
      holdoutJudgementCount,
      holdoutGroupCount,
    },
  };
}

const policy = {
  minimumHoldoutJudgements: 30,
  minimumHoldoutGroups: 10,
  minimumAbsoluteImprovement: 0.05,
};

describe('Fitness model promotion eligibility', () => {
  it('accepts a learned artifact only when it beats bootstrap by the declared margin', () => {
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
    const result = assessFitnessModelPromotion(artifact(0.8, 0.6, 10, 3), policy);
    expect(result.reasons).toContain('INSUFFICIENT_HOLDOUT_JUDGEMENTS');
    expect(result.reasons).toContain('INSUFFICIENT_HOLDOUT_GROUPS');
  });

  it('rejects an improvement smaller than the declared threshold', () => {
    const result = assessFitnessModelPromotion(artifact(0.63), policy);
    expect(result.reasons).toContain('IMPROVEMENT_BELOW_THRESHOLD');
  });
});

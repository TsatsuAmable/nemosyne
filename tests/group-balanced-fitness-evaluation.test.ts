import { describe, expect, it } from 'vitest';
import {
  evaluateGroupBalancedPairwiseWeights,
  GROUP_BALANCED_PAIRWISE_METRIC,
  withGroupBalancedHoldoutEvaluation,
  type FitnessModelArtifact,
  type PairwiseTrainingExample,
} from '../src/fitness/index.ts';

function example(
  judgementId: string,
  partitionGroup: string,
  featureDelta: readonly number[],
  bootstrapCorrect: boolean,
): PairwiseTrainingExample {
  return {
    judgementId,
    partition: 'holdout',
    partitionGroup,
    datasetFingerprint: partitionGroup.split('::')[0] ?? partitionGroup,
    preferredGraphId: `${judgementId}-preferred`,
    alternativeGraphId: `${judgementId}-alternative`,
    featureDelta,
    bootstrapCorrect,
  };
}

function artifact(): FitnessModelArtifact {
  return {
    schemaVersion: '1.0.0',
    modelId: 'moneta-pairwise-linear',
    modelVersion: 'learned-balanced-v1',
    modelKind: 'pairwise-linear',
    createdAt: 1,
    trainingDatasetHash: 'train',
    curationPolicyHash: 'policy',
    featureSchemaVersion: '1.0.0',
    parameters: { weights: [1] },
    evaluation: {
      bootstrapMetric: 0,
      candidateMetric: 0,
      metricName: 'pairwise-accuracy',
      holdoutJudgementCount: 1,
      holdoutGroupCount: 1,
    },
  };
}

describe('group-balanced pairwise holdout evaluation', () => {
  it('prevents one prolific independent group from dominating the headline metric', () => {
    const examples: PairwiseTrainingExample[] = [];
    for (let index = 0; index < 100; index++) {
      examples.push(example(`large-${index}`, 'dataset-a::researcher-a', [1], false));
    }
    examples.push(example('small-1', 'dataset-b::researcher-b', [-1], true));

    const result = evaluateGroupBalancedPairwiseWeights(examples, [1]);

    // Judgement-weighted candidate accuracy would be 100/101 ≈ 0.9901.
    // Equal group weighting correctly reports one perfect and one failed group.
    expect(result.candidateAccuracy).toBe(0.5);
    expect(result.bootstrapAccuracy).toBe(0.5);
    expect(result.judgementCount).toBe(101);
    expect(result.groupCount).toBe(2);
    expect(result.groupAccuracies).toEqual([
      {
        partitionGroup: 'dataset-a::researcher-a',
        judgementCount: 100,
        candidateAccuracy: 1,
        bootstrapAccuracy: 0,
      },
      {
        partitionGroup: 'dataset-b::researcher-b',
        judgementCount: 1,
        candidateAccuracy: 0,
        bootstrapAccuracy: 1,
      },
    ]);
  });

  it('creates a distinct promotion-ready artifact without mutating training output', () => {
    const trained = artifact();
    const evaluated = withGroupBalancedHoldoutEvaluation(trained, [
      example('a', 'dataset-a::researcher-a', [1], false),
      example('b', 'dataset-b::researcher-b', [1], true),
    ]);

    expect(trained.evaluation.metricName).toBe('pairwise-accuracy');
    expect(evaluated.evaluation.metricName).toBe(GROUP_BALANCED_PAIRWISE_METRIC);
    expect(evaluated.evaluation.candidateMetric).toBe(1);
    expect(evaluated.evaluation.bootstrapMetric).toBe(0.5);
    expect(evaluated.evaluation.holdoutJudgementCount).toBe(2);
    expect(evaluated.evaluation.holdoutGroupCount).toBe(2);
    expect(evaluated.notes).toMatch(/independent partition group contributes equal weight/i);
  });

  it('fails closed on feature-dimension mismatch', () => {
    expect(() => evaluateGroupBalancedPairwiseWeights([
      example('bad', 'dataset-a::researcher-a', [1, 2], false),
    ], [1])).toThrow(/feature dimension mismatch/i);
  });
});

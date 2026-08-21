import type { JudgementPartition } from '../judgement/JudgementDatasetBuilder.ts';
import type { FitnessModelArtifact } from './FitnessModelRegistry.ts';
import type { PairwiseTrainingExample } from './PairwiseLearning.ts';

export const GROUP_BALANCED_PAIRWISE_METRIC = 'group-balanced-pairwise-accuracy' as const;

export interface GroupBalancedPairwiseEvaluation {
  candidateAccuracy: number;
  bootstrapAccuracy: number;
  judgementCount: number;
  groupCount: number;
  groupAccuracies: readonly {
    partitionGroup: string;
    judgementCount: number;
    candidateAccuracy: number;
    bootstrapAccuracy: number;
  }[];
}

function dot(weights: readonly number[], features: readonly number[]): number {
  if (weights.length !== features.length) {
    throw new Error(
      `FitnessModel feature dimension mismatch: ${weights.length} weights for ${features.length} features`,
    );
  }
  let sum = 0;
  for (let index = 0; index < weights.length; index++) sum += weights[index] * features[index];
  return sum;
}

function artifactWeights(artifact: FitnessModelArtifact): readonly number[] {
  const value = artifact.parameters.weights;
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => !Number.isFinite(entry))) {
    throw new TypeError('FitnessModel artifact requires a finite non-empty weights vector for pairwise evaluation');
  }
  return value as readonly number[];
}

/**
 * Evaluate each independent partition group first, then average group accuracy
 * with equal weight. This prevents a researcher/dataset group with many more
 * judgements from dominating the promotion metric.
 */
export function evaluateGroupBalancedPairwiseWeights(
  examples: readonly PairwiseTrainingExample[],
  weights: readonly number[],
  partition: JudgementPartition = 'holdout',
): GroupBalancedPairwiseEvaluation {
  const selected = examples.filter((example) => example.partition === partition);
  if (selected.length === 0) {
    throw new Error(`No ${partition} pairwise examples available for group-balanced evaluation`);
  }

  const groups = new Map<
    string,
    { judgementCount: number; candidateCorrect: number; bootstrapCorrect: number }
  >();
  for (const example of selected) {
    if (!example.partitionGroup.trim()) throw new Error('Pairwise evaluation example has an empty partition group');
    const group = groups.get(example.partitionGroup) ?? {
      judgementCount: 0,
      candidateCorrect: 0,
      bootstrapCorrect: 0,
    };
    group.judgementCount++;
    if (dot(weights, example.featureDelta) > 0) group.candidateCorrect++;
    if (example.bootstrapCorrect) group.bootstrapCorrect++;
    groups.set(example.partitionGroup, group);
  }

  const groupAccuracies = [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([partitionGroup, group]) => ({
      partitionGroup,
      judgementCount: group.judgementCount,
      candidateAccuracy: group.candidateCorrect / group.judgementCount,
      bootstrapAccuracy: group.bootstrapCorrect / group.judgementCount,
    }));

  const candidateAccuracy =
    groupAccuracies.reduce((sum, group) => sum + group.candidateAccuracy, 0) / groupAccuracies.length;
  const bootstrapAccuracy =
    groupAccuracies.reduce((sum, group) => sum + group.bootstrapAccuracy, 0) / groupAccuracies.length;

  return {
    candidateAccuracy,
    bootstrapAccuracy,
    judgementCount: selected.length,
    groupCount: groupAccuracies.length,
    groupAccuracies,
  };
}

/**
 * Produce a promotion-ready artifact whose headline holdout metric is balanced
 * over independent dataset+researcher partition groups. The input artifact is
 * not mutated; the returned artifact hashes independently when registered.
 */
export function withGroupBalancedHoldoutEvaluation(
  artifact: FitnessModelArtifact,
  examples: readonly PairwiseTrainingExample[],
): FitnessModelArtifact {
  const evaluation = evaluateGroupBalancedPairwiseWeights(
    examples,
    artifactWeights(artifact),
    'holdout',
  );
  return {
    ...structuredClone(artifact),
    evaluation: {
      bootstrapMetric: evaluation.bootstrapAccuracy,
      candidateMetric: evaluation.candidateAccuracy,
      metricName: GROUP_BALANCED_PAIRWISE_METRIC,
      holdoutJudgementCount: evaluation.judgementCount,
      holdoutGroupCount: evaluation.groupCount,
    },
    notes: [
      artifact.notes,
      `Promotion evaluation: ${GROUP_BALANCED_PAIRWISE_METRIC}; each independent partition group contributes equal weight.`,
    ]
      .filter(Boolean)
      .join(' '),
  };
}

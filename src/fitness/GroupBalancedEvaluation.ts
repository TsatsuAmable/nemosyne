import type { JudgementPartition } from '../judgement/JudgementDatasetBuilder.ts';
import type { FitnessModelArtifact } from './FitnessModelRegistry.ts';
import type { PairwiseTrainingExample } from './PairwiseLearning.ts';

export const GROUP_BALANCED_PAIRWISE_METRIC = 'group-balanced-pairwise-accuracy' as const;

export interface GroupBalancedPairwiseEvaluation {
  candidateAccuracy: number;
  bootstrapAccuracy: number;
  judgementCount: number;
  groupCount: number;
  candidateGroupWins: number;
  bootstrapGroupWins: number;
  tiedGroups: number;
  oneSidedGroupWinPValue: number;
  /**
   * Smallest group-balanced candidate-minus-bootstrap improvement after removing
   * exactly one independent holdout group. Null when fewer than two groups exist.
   * This is a deterministic robustness bound, not a confidence interval.
   */
  leaveOneGroupOutImprovementFloor: number | null;
  groupAccuracies: readonly {
    partitionGroup: string;
    judgementCount: number;
    candidateAccuracy: number;
    bootstrapAccuracy: number;
  }[];
}

function dot(weights: readonly number[], features: readonly number[]): number {
  if (weights.length !== features.length) {
    throw new Error(`FitnessModel feature dimension mismatch: ${weights.length} weights for ${features.length} features`);
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

/** Exact one-sided binomial sign-test tail for candidate wins among decisive groups. */
export function oneSidedGroupWinSignTest(candidateWins: number, bootstrapWins: number): number {
  if (!Number.isSafeInteger(candidateWins) || candidateWins < 0) throw new TypeError('candidateWins must be a non-negative safe integer');
  if (!Number.isSafeInteger(bootstrapWins) || bootstrapWins < 0) throw new TypeError('bootstrapWins must be a non-negative safe integer');
  const decisive = candidateWins + bootstrapWins;
  if (decisive === 0) return 1;
  // Recurrence from P(X=0)=2^-n. Holdout group counts are intentionally bounded
  // by evidence curation in practice; this remains numerically stable well past
  // the group counts used by promotion policy.
  let probability = Math.pow(0.5, decisive);
  let tail = candidateWins === 0 ? probability : 0;
  for (let wins = 1; wins <= decisive; wins++) {
    probability *= (decisive - wins + 1) / wins;
    if (wins >= candidateWins) tail += probability;
  }
  return Math.min(1, Math.max(0, tail));
}

function leaveOneGroupOutImprovementFloor(
  groups: readonly { candidateAccuracy: number; bootstrapAccuracy: number }[],
): number | null {
  if (groups.length < 2) return null;
  const improvements = groups.map((group) => group.candidateAccuracy - group.bootstrapAccuracy);
  const total = improvements.reduce((sum, improvement) => sum + improvement, 0);
  let floor = Number.POSITIVE_INFINITY;
  for (const improvement of improvements) {
    const leaveOneOutMean = (total - improvement) / (improvements.length - 1);
    floor = Math.min(floor, leaveOneOutMean);
  }
  return floor;
}

export function evaluateGroupBalancedPairwiseWeights(
  examples: readonly PairwiseTrainingExample[],
  weights: readonly number[],
  partition: JudgementPartition = 'holdout',
): GroupBalancedPairwiseEvaluation {
  const selected = examples.filter((example) => example.partition === partition);
  if (selected.length === 0) throw new Error(`No ${partition} pairwise examples available for group-balanced evaluation`);

  const groups = new Map<string, { judgementCount: number; candidateCorrect: number; bootstrapCorrect: number }>();
  for (const example of selected) {
    if (!example.partitionGroup.trim()) throw new Error('Pairwise evaluation example has an empty partition group');
    const group = groups.get(example.partitionGroup) ?? { judgementCount: 0, candidateCorrect: 0, bootstrapCorrect: 0 };
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

  const candidateAccuracy = groupAccuracies.reduce((sum, group) => sum + group.candidateAccuracy, 0) / groupAccuracies.length;
  const bootstrapAccuracy = groupAccuracies.reduce((sum, group) => sum + group.bootstrapAccuracy, 0) / groupAccuracies.length;
  let candidateGroupWins = 0;
  let bootstrapGroupWins = 0;
  let tiedGroups = 0;
  for (const group of groupAccuracies) {
    if (group.candidateAccuracy > group.bootstrapAccuracy) candidateGroupWins++;
    else if (group.bootstrapAccuracy > group.candidateAccuracy) bootstrapGroupWins++;
    else tiedGroups++;
  }

  return {
    candidateAccuracy,
    bootstrapAccuracy,
    judgementCount: selected.length,
    groupCount: groupAccuracies.length,
    candidateGroupWins,
    bootstrapGroupWins,
    tiedGroups,
    oneSidedGroupWinPValue: oneSidedGroupWinSignTest(candidateGroupWins, bootstrapGroupWins),
    leaveOneGroupOutImprovementFloor: leaveOneGroupOutImprovementFloor(groupAccuracies),
    groupAccuracies,
  };
}

/** Produce a promotion-ready artifact with equal group weighting and robustness evidence. */
export function withGroupBalancedHoldoutEvaluation(
  artifact: FitnessModelArtifact,
  examples: readonly PairwiseTrainingExample[],
): FitnessModelArtifact {
  const evaluation = evaluateGroupBalancedPairwiseWeights(examples, artifactWeights(artifact), 'holdout');
  return {
    ...structuredClone(artifact),
    evaluation: {
      bootstrapMetric: evaluation.bootstrapAccuracy,
      candidateMetric: evaluation.candidateAccuracy,
      metricName: GROUP_BALANCED_PAIRWISE_METRIC,
      holdoutJudgementCount: evaluation.judgementCount,
      holdoutGroupCount: evaluation.groupCount,
      candidateGroupWins: evaluation.candidateGroupWins,
      bootstrapGroupWins: evaluation.bootstrapGroupWins,
      tiedGroups: evaluation.tiedGroups,
      oneSidedGroupWinPValue: evaluation.oneSidedGroupWinPValue,
      ...(evaluation.leaveOneGroupOutImprovementFloor === null
        ? {}
        : { leaveOneGroupOutImprovementFloor: evaluation.leaveOneGroupOutImprovementFloor }),
    },
    notes: [
      artifact.notes,
      `Promotion evaluation: ${GROUP_BALANCED_PAIRWISE_METRIC}; each independent partition group contributes equal weight, group wins are tested with a one-sided exact sign test, and the effect is stress-tested by a deterministic leave-one-group-out improvement floor.`,
    ].filter(Boolean).join(' '),
  };
}

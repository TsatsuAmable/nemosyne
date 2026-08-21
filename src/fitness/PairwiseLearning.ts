import type { CuratedJudgementDataset, JudgementPartition } from '../judgement/JudgementDatasetBuilder.ts';
import type { PairwisePreferenceJudgement } from '../judgement/RepresentationJudgement.ts';
import {
  FITNESS_MODEL_ARTIFACT_SCHEMA_VERSION,
  type FitnessModelArtifact,
} from './FitnessModelRegistry.ts';

export const PAIRWISE_FEATURE_SNAPSHOT_SCHEMA_VERSION = '1.0.0' as const;
export const PAIRWISE_FEATURE_SCHEMA_VERSION = '1.0.0' as const;

export interface PairwiseCandidateFeatureSnapshot {
  schemaVersion: typeof PAIRWISE_FEATURE_SNAPSHOT_SCHEMA_VERSION;
  featureSchemaVersion: typeof PAIRWISE_FEATURE_SCHEMA_VERSION;
  graphId: string;
  datasetFingerprint: string;
  fitnessModelVersion: string;
  features: readonly number[];
  bootstrapUtility: number;
}

export interface PairwiseTrainingExample {
  judgementId: string;
  partition: JudgementPartition;
  partitionGroup: string;
  datasetFingerprint: string;
  preferredGraphId: string;
  alternativeGraphId: string;
  featureDelta: readonly number[];
  bootstrapCorrect: boolean;
}

export interface PairwiseMaterializationIssue {
  judgementId: string;
  reason:
    | 'UNSUPPORTED_JUDGEMENT_KIND'
    | 'MISSING_PREFERRED_SNAPSHOT'
    | 'MISSING_ALTERNATIVE_SNAPSHOT'
    | 'SNAPSHOT_PROVENANCE_MISMATCH'
    | 'FEATURE_SCHEMA_MISMATCH'
    | 'FEATURE_DIMENSION_MISMATCH'
    | 'NON_FINITE_FEATURE';
  detail: string;
}

export interface MaterializedPairwiseDataset {
  examples: readonly PairwiseTrainingExample[];
  issues: readonly PairwiseMaterializationIssue[];
  featureCount: number;
}

export interface PairwiseLearnerOptions {
  learningRate?: number;
  epochs?: number;
  l2?: number;
  modelId?: string;
  modelVersion: string;
  createdAt: number;
  trainingDatasetHash: string;
  curationPolicyHash: string;
}

export interface PairwiseEvaluation {
  candidateAccuracy: number;
  bootstrapAccuracy: number;
  judgementCount: number;
  groupCount: number;
}

function snapshotKey(datasetFingerprint: string, graphId: string): string {
  return `${datasetFingerprint}\u0000${graphId}`;
}

function assertSnapshot(snapshot: PairwiseCandidateFeatureSnapshot): void {
  if (snapshot.schemaVersion !== PAIRWISE_FEATURE_SNAPSHOT_SCHEMA_VERSION) {
    throw new TypeError(`Unsupported pairwise feature snapshot schema: ${snapshot.schemaVersion}`);
  }
  if (snapshot.featureSchemaVersion !== PAIRWISE_FEATURE_SCHEMA_VERSION) {
    throw new TypeError(`Unsupported pairwise feature schema: ${snapshot.featureSchemaVersion}`);
  }
  if (!snapshot.graphId.trim() || !snapshot.datasetFingerprint.trim() || !snapshot.fitnessModelVersion.trim()) {
    throw new TypeError('Pairwise feature snapshot provenance fields must be non-empty');
  }
  if (snapshot.features.length === 0 || snapshot.features.some((value) => !Number.isFinite(value))) {
    throw new TypeError('Pairwise feature snapshot must contain finite features');
  }
  if (!Number.isFinite(snapshot.bootstrapUtility)) {
    throw new TypeError('bootstrapUtility must be finite');
  }
}

export function materializePairwiseDataset(
  curated: CuratedJudgementDataset,
  snapshots: readonly PairwiseCandidateFeatureSnapshot[],
): MaterializedPairwiseDataset {
  const byKey = new Map<string, PairwiseCandidateFeatureSnapshot>();
  let featureCount = 0;
  for (const snapshot of snapshots) {
    assertSnapshot(snapshot);
    if (featureCount === 0) featureCount = snapshot.features.length;
    if (snapshot.features.length !== featureCount) {
      throw new TypeError('Pairwise feature snapshots must share one feature dimension');
    }
    const key = snapshotKey(snapshot.datasetFingerprint, snapshot.graphId);
    if (byKey.has(key)) throw new Error(`Duplicate pairwise feature snapshot: ${key}`);
    byKey.set(key, structuredClone(snapshot));
  }

  const examples: PairwiseTrainingExample[] = [];
  const issues: PairwiseMaterializationIssue[] = [];

  for (const record of curated.included) {
    const judgement = record.judgement;
    if (judgement.kind !== 'PAIRWISE_PREFERENCE') {
      issues.push({
        judgementId: judgement.judgementId,
        reason: 'UNSUPPORTED_JUDGEMENT_KIND',
        detail: `pairwise learner does not consume ${judgement.kind}`,
      });
      continue;
    }

    const pairwise = judgement as PairwisePreferenceJudgement;
    const preferred = byKey.get(snapshotKey(pairwise.provenance.datasetFingerprint, pairwise.preferredGraphId));
    const alternative = byKey.get(snapshotKey(pairwise.provenance.datasetFingerprint, pairwise.alternativeGraphId));
    if (!preferred) {
      issues.push({ judgementId: pairwise.judgementId, reason: 'MISSING_PREFERRED_SNAPSHOT', detail: pairwise.preferredGraphId });
      continue;
    }
    if (!alternative) {
      issues.push({ judgementId: pairwise.judgementId, reason: 'MISSING_ALTERNATIVE_SNAPSHOT', detail: pairwise.alternativeGraphId });
      continue;
    }
    if (
      preferred.fitnessModelVersion !== pairwise.provenance.fitnessModelVersion ||
      alternative.fitnessModelVersion !== pairwise.provenance.fitnessModelVersion
    ) {
      issues.push({
        judgementId: pairwise.judgementId,
        reason: 'SNAPSHOT_PROVENANCE_MISMATCH',
        detail: 'feature snapshot FitnessModel version does not match judgement provenance',
      });
      continue;
    }
    if (preferred.featureSchemaVersion !== alternative.featureSchemaVersion) {
      issues.push({ judgementId: pairwise.judgementId, reason: 'FEATURE_SCHEMA_MISMATCH', detail: 'preferred/alternative feature schemas differ' });
      continue;
    }
    if (preferred.features.length !== alternative.features.length) {
      issues.push({ judgementId: pairwise.judgementId, reason: 'FEATURE_DIMENSION_MISMATCH', detail: 'preferred/alternative feature dimensions differ' });
      continue;
    }

    const featureDelta = preferred.features.map((value, index) => value - alternative.features[index]);
    if (featureDelta.some((value) => !Number.isFinite(value))) {
      issues.push({ judgementId: pairwise.judgementId, reason: 'NON_FINITE_FEATURE', detail: 'feature delta contains non-finite values' });
      continue;
    }
    examples.push({
      judgementId: pairwise.judgementId,
      partition: record.partition,
      partitionGroup: record.partitionGroup,
      datasetFingerprint: pairwise.provenance.datasetFingerprint,
      preferredGraphId: pairwise.preferredGraphId,
      alternativeGraphId: pairwise.alternativeGraphId,
      featureDelta,
      bootstrapCorrect: preferred.bootstrapUtility > alternative.bootstrapUtility,
    });
  }

  return { examples, issues, featureCount };
}

function sigmoid(value: number): number {
  if (value >= 0) {
    const z = Math.exp(-value);
    return 1 / (1 + z);
  }
  const z = Math.exp(value);
  return z / (1 + z);
}

function dot(weights: readonly number[], features: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) sum += weights[i] * features[i];
  return sum;
}

export function evaluatePairwiseWeights(
  examples: readonly PairwiseTrainingExample[],
  weights: readonly number[],
  partition: JudgementPartition = 'holdout',
): PairwiseEvaluation {
  const selected = examples.filter((example) => example.partition === partition);
  if (selected.length === 0) throw new Error(`No ${partition} pairwise examples available for evaluation`);
  let candidateCorrect = 0;
  let bootstrapCorrect = 0;
  const groups = new Set<string>();
  for (const example of selected) {
    if (dot(weights, example.featureDelta) > 0) candidateCorrect++;
    if (example.bootstrapCorrect) bootstrapCorrect++;
    groups.add(example.partitionGroup);
  }
  return {
    candidateAccuracy: candidateCorrect / selected.length,
    bootstrapAccuracy: bootstrapCorrect / selected.length,
    judgementCount: selected.length,
    groupCount: groups.size,
  };
}

export function trainPairwiseLinearModel(
  dataset: MaterializedPairwiseDataset,
  options: PairwiseLearnerOptions,
): FitnessModelArtifact {
  const train = dataset.examples.filter((example) => example.partition === 'train');
  if (train.length === 0) throw new Error('No train pairwise examples available');
  if (dataset.featureCount < 1) throw new Error('Pairwise feature dimension must be positive');

  const learningRate = options.learningRate ?? 0.1;
  const epochs = options.epochs ?? 200;
  const l2 = options.l2 ?? 0.001;
  if (!Number.isFinite(learningRate) || learningRate <= 0) throw new TypeError('learningRate must be positive and finite');
  if (!Number.isSafeInteger(epochs) || epochs < 1) throw new TypeError('epochs must be a positive safe integer');
  if (!Number.isFinite(l2) || l2 < 0) throw new TypeError('l2 must be finite and non-negative');

  const weights = new Array<number>(dataset.featureCount).fill(0);
  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradient = new Array<number>(dataset.featureCount).fill(0);
    for (const example of train) {
      const probability = sigmoid(dot(weights, example.featureDelta));
      const residual = probability - 1;
      for (let i = 0; i < gradient.length; i++) gradient[i] += residual * example.featureDelta[i];
    }
    for (let i = 0; i < weights.length; i++) {
      const meanGradient = gradient[i] / train.length + l2 * weights[i];
      weights[i] -= learningRate * meanGradient;
    }
  }

  const evaluation = evaluatePairwiseWeights(dataset.examples, weights, 'holdout');
  return {
    schemaVersion: FITNESS_MODEL_ARTIFACT_SCHEMA_VERSION,
    modelId: options.modelId ?? 'moneta-pairwise-linear',
    modelVersion: options.modelVersion,
    modelKind: 'pairwise-linear',
    createdAt: options.createdAt,
    trainingDatasetHash: options.trainingDatasetHash,
    curationPolicyHash: options.curationPolicyHash,
    featureSchemaVersion: PAIRWISE_FEATURE_SCHEMA_VERSION,
    parameters: {
      weights: [...weights],
      learningRate,
      epochs,
      l2,
    },
    evaluation: {
      bootstrapMetric: evaluation.bootstrapAccuracy,
      candidateMetric: evaluation.candidateAccuracy,
      metricName: 'pairwise-accuracy',
      holdoutJudgementCount: evaluation.judgementCount,
      holdoutGroupCount: evaluation.groupCount,
    },
    notes: 'Offline deterministic baseline. Registration does not imply promotion.',
  };
}

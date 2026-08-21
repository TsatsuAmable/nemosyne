import { describe, expect, it } from 'vitest';
import type { CuratedJudgementDataset } from '../src/judgement/JudgementDatasetBuilder.ts';
import type { PairwisePreferenceJudgement } from '../src/judgement/RepresentationJudgement.ts';
import {
  materializePairwiseDataset,
  trainPairwiseLinearModel,
  type PairwiseCandidateFeatureSnapshot,
} from '../src/fitness/PairwiseLearning.ts';

function judgement(id: string, preferredGraphId: string, alternativeGraphId: string): PairwisePreferenceJudgement {
  return {
    schemaVersion: '1.0.0',
    judgementId: id,
    investigationId: 'inv-1',
    researcherId: 'researcher-1',
    sequence: Number(id.replace(/\D/g, '')) || 0,
    recordedAt: 1,
    kind: 'PAIRWISE_PREFERENCE',
    preferredGraphId,
    alternativeGraphId,
    provenance: {
      datasetFingerprint: 'dataset-1',
      kernelVersion: 'kernel-1',
      monetaVersion: 'moneta-1',
      fitnessModelVersion: 'bootstrap-1',
      ontologyVersion: 'ontology-1',
      nilVersion: 'nil-1',
      representationGraphId: preferredGraphId,
    },
  };
}

function curated(): CuratedJudgementDataset {
  const train = judgement('j1', 'graph-a', 'graph-b');
  const holdout = judgement('j2', 'graph-c', 'graph-d');
  return {
    schemaVersion: '1.0.0',
    policy: {
      partitionSeed: 'seed',
      trainFraction: 0.7,
      validationFraction: 0.1,
    },
    included: [
      {
        judgement: train,
        datasetGroup: 'dataset-1',
        researcherGroup: 'researcher-1',
        partitionGroup: 'dataset-1::researcher-1::train',
        partition: 'train',
      },
      {
        judgement: holdout,
        datasetGroup: 'dataset-1',
        researcherGroup: 'researcher-2',
        partitionGroup: 'dataset-1::researcher-2::holdout',
        partition: 'holdout',
      },
    ],
    excluded: [],
  };
}

function snapshot(graphId: string, features: readonly number[], bootstrapUtility: number): PairwiseCandidateFeatureSnapshot {
  return {
    schemaVersion: '1.0.0',
    featureSchemaVersion: '1.0.0',
    graphId,
    datasetFingerprint: 'dataset-1',
    fitnessModelVersion: 'bootstrap-1',
    features,
    bootstrapUtility,
  };
}

describe('Wave 4 offline pairwise learning', () => {
  it('materializes judged graph pairs only when frozen feature snapshots match provenance', () => {
    const result = materializePairwiseDataset(curated(), [
      snapshot('graph-a', [1, 0], 0.4),
      snapshot('graph-b', [0, 1], 0.6),
      snapshot('graph-c', [1, 0], 0.4),
      snapshot('graph-d', [0, 1], 0.6),
    ]);

    expect(result.issues).toEqual([]);
    expect(result.examples).toHaveLength(2);
    expect(result.examples[0].featureDelta).toEqual([1, -1]);
    expect(result.examples[0].bootstrapCorrect).toBe(false);
  });

  it('fails the affected judgement closed when snapshot provenance does not match', () => {
    const bad = { ...snapshot('graph-a', [1, 0], 0.4), fitnessModelVersion: 'other-model' };
    const result = materializePairwiseDataset(curated(), [
      bad,
      snapshot('graph-b', [0, 1], 0.6),
      snapshot('graph-c', [1, 0], 0.4),
      snapshot('graph-d', [0, 1], 0.6),
    ]);

    expect(result.examples).toHaveLength(1);
    expect(result.issues[0]?.reason).toBe('SNAPSHOT_PROVENANCE_MISMATCH');
  });

  it('trains deterministically and evaluates against bootstrap only on holdout evidence', () => {
    const materialized = materializePairwiseDataset(curated(), [
      snapshot('graph-a', [1, 0], 0.4),
      snapshot('graph-b', [0, 1], 0.6),
      snapshot('graph-c', [1, 0], 0.4),
      snapshot('graph-d', [0, 1], 0.6),
    ]);

    const options = {
      modelVersion: 'pairwise-1',
      createdAt: 10,
      trainingDatasetHash: 'dataset-hash',
      curationPolicyHash: 'policy-hash',
      epochs: 100,
      learningRate: 0.1,
    } as const;
    const first = trainPairwiseLinearModel(materialized, options);
    const second = trainPairwiseLinearModel(materialized, options);

    expect(first.parameters.weights).toEqual(second.parameters.weights);
    expect(first.evaluation.holdoutJudgementCount).toBe(1);
    expect(first.evaluation.candidateMetric).toBe(1);
    expect(first.evaluation.bootstrapMetric).toBe(0);
  });
});

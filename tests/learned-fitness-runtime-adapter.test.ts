import { describe, expect, it } from 'vitest';
import {
  FITNESS_MODEL_ARTIFACT_SCHEMA_VERSION,
  FitnessModelRegistry,
  GROUP_BALANCED_PAIRWISE_METRIC,
  rankWithActiveLearnedFitnessModel,
  rankWithPinnedLearnedFitnessModel,
  type FitnessModelArtifact,
} from '../src/fitness/index.ts';
import type { CandidateScore } from '../src/moneta/representation/RepresentationDecision.ts';
import { MONETA_PAIRWISE_FEATURE_DIMENSIONS } from '../src/fitness/MonetaFeatureSnapshot.ts';

function candidate(id: 'POINT_SET' | 'DENSITY_FIELD', raw: readonly number[], score: number): CandidateScore {
  return {
    family: id === 'POINT_SET' ? 'POINT' : 'DISTRIBUTION',
    candidateId: id,
    layout: 'GRID_3D',
    score,
    components: MONETA_PAIRWISE_FEATURE_DIMENSIONS.map((component, index) => ({
      component,
      weight: 1 / 6,
      rawScore: raw[index],
      weightedScore: raw[index] / 6,
      reason: component,
    })),
    preserves: [],
    loses: [],
  };
}

function artifact(): FitnessModelArtifact {
  return {
    schemaVersion: FITNESS_MODEL_ARTIFACT_SCHEMA_VERSION,
    modelId: 'moneta-pairwise-linear',
    modelVersion: 'learned-v1',
    modelKind: 'pairwise-linear',
    createdAt: 1,
    trainingDatasetHash: 'train',
    curationPolicyHash: 'policy',
    featureSchemaVersion: '1.0.0',
    parameters: { weights: [1, 0, 0, 0, 0, 0] },
    evaluation: {
      bootstrapMetric: 0.6,
      candidateMetric: 0.8,
      metricName: GROUP_BALANCED_PAIRWISE_METRIC,
      holdoutJudgementCount: 40,
      holdoutGroupCount: 12,
    },
  };
}

const policy = {
  minimumHoldoutJudgements: 30,
  minimumHoldoutGroups: 10,
  minimumAbsoluteImprovement: 0.05,
};

describe('learned fitness runtime adapter', () => {
  it('re-ranks feasible candidates using only an active promotion-eligible artifact', () => {
    const registry = new FitnessModelRegistry();
    const registered = registry.register(artifact());
    registry.promote(registered.artifactHash, 2);

    const result = rankWithActiveLearnedFitnessModel(registry, [
      candidate('POINT_SET', [0.2, 0.9, 0.9, 0.9, 0.9, 0.9], 0.9),
      candidate('DENSITY_FIELD', [0.8, 0.1, 0.1, 0.1, 0.1, 0.1], 0.5),
    ], policy);

    expect(result.rankedCandidates[0].candidateId).toBe('DENSITY_FIELD');
    expect(result.modelVersion).toBe('learned-v1');
    expect(result.artifactHash).toBe(registered.artifactHash);
  });

  it('fails closed when no learned artifact is active', () => {
    expect(() => rankWithActiveLearnedFitnessModel(new FitnessModelRegistry(), [], policy))
      .toThrow(/No active learned FitnessModel artifact/);
  });

  it('refuses an active artifact that does not pass promotion policy', () => {
    const registry = new FitnessModelRegistry();
    const weak = artifact();
    weak.evaluation.candidateMetric = 0.61;
    const registered = registry.register(weak);
    registry.promote(registered.artifactHash, 2);
    expect(() => rankWithActiveLearnedFitnessModel(registry, [candidate('POINT_SET', [1, 1, 1, 1, 1, 1], 1)], policy))
      .toThrow(/not promotion-eligible/);
  });

  it('allows pinned execution only when the active registry artifact matches exactly', () => {
    const registry = new FitnessModelRegistry();
    const registered = registry.register(artifact());
    registry.promote(registered.artifactHash, 2);
    const result = rankWithPinnedLearnedFitnessModel(
      registry,
      [candidate('POINT_SET', [1, 0, 0, 0, 0, 0], 0.5)],
      policy,
      registered.artifactHash,
    );
    expect(result.artifactHash).toBe(registered.artifactHash);
  });

  it('rejects pinned execution after registry activation drifts to another artifact', () => {
    const registry = new FitnessModelRegistry();
    const first = registry.register(artifact());
    registry.promote(first.artifactHash, 2);

    const secondArtifact = artifact();
    secondArtifact.modelVersion = 'learned-v2';
    secondArtifact.parameters = { weights: [0, 1, 0, 0, 0, 0] };
    const second = registry.register(secondArtifact);
    registry.promote(second.artifactHash, 3);

    expect(() => rankWithPinnedLearnedFitnessModel(
      registry,
      [candidate('POINT_SET', [1, 0, 0, 0, 0, 0], 0.5)],
      policy,
      first.artifactHash,
    )).toThrow(/does not match pinned runtime artifact/i);
  });
});

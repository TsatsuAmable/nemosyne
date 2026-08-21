import { describe, expect, it } from 'vitest';
import {
  FitnessModelRegistry,
  hashFitnessModelArtifact,
  type FitnessModelArtifact,
} from '../src/fitness/index.ts';

function artifact(version: string, candidateMetric = 0.7): FitnessModelArtifact {
  return {
    schemaVersion: '1.0.0',
    modelId: 'moneta-pairwise',
    modelVersion: version,
    modelKind: 'pairwise-linear',
    createdAt: 1,
    trainingDatasetHash: `dataset-${version}`,
    curationPolicyHash: 'policy-1',
    featureSchemaVersion: 'features-1',
    parameters: { weights: [0.2, 0.8], intercept: 0 },
    evaluation: {
      bootstrapMetric: 0.55,
      candidateMetric,
      metricName: 'pairwise-accuracy',
      holdoutJudgementCount: 20,
      holdoutGroupCount: 8,
    },
  };
}

describe('Wave 4 fitness model registry', () => {
  it('hashes artifact content deterministically regardless of object key order', () => {
    const value = artifact('v1');
    const reordered = { ...value, parameters: { intercept: 0, weights: [0.2, 0.8] } };
    expect(hashFitnessModelArtifact(value)).toBe(hashFitnessModelArtifact(reordered));
  });

  it('separates registration from activation and supports explicit rollback', () => {
    const registry = new FitnessModelRegistry();
    const v1 = registry.register(artifact('v1'));
    const v2 = registry.register(artifact('v2', 0.75));
    expect(registry.active).toBeNull();

    registry.promote(v1.artifactHash, 10);
    registry.promote(v2.artifactHash, 20);
    registry.rollback(v1.artifactHash, 30);

    expect(registry.activeArtifactHash).toBe(v1.artifactHash);
    expect(registry.history().map((entry) => entry.reason)).toEqual(['INITIAL', 'PROMOTE', 'ROLLBACK']);
  });

  it('rejects semantic version collisions with different content', () => {
    const registry = new FitnessModelRegistry();
    registry.register(artifact('v1', 0.7));
    expect(() => registry.register(artifact('v1', 0.8))).toThrow(/different content/i);
  });

  it('restores atomically and rejects artifact hash tampering', () => {
    const registry = new FitnessModelRegistry();
    const model = registry.register(artifact('v1'));
    registry.promote(model.artifactHash, 10);
    const snapshot = registry.toJSON();

    const corrupted = structuredClone(snapshot);
    corrupted.artifacts[0].artifactHash = 'fnv1a-deadbeef';

    const target = new FitnessModelRegistry();
    expect(() => target.restore(corrupted)).toThrow(/hash mismatch/i);
    expect(target.toJSON().artifacts).toHaveLength(0);

    target.restore(snapshot);
    expect(target.activeArtifactHash).toBe(model.artifactHash);
  });
});

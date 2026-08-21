import { describe, expect, it } from 'vitest';
import {
  FITNESS_MODEL_ARTIFACT_SCHEMA_VERSION,
  FitnessModelRegistry,
  GROUP_BALANCED_PAIRWISE_METRIC,
  type FitnessModelArtifact,
} from '../src/fitness/index.ts';
import { RepresentationState } from '../src/atlas/domain/RepresentationState.ts';
import {
  applyPinnedLearnedFitnessRuntime,
  LEARNED_MONETA_RUNTIME_VERSION,
} from '../src/moneta/representation/LearnedMonetaRuntime.ts';
import { MonetaHypothesisEngine } from '../src/moneta/representation/MonetaHypothesisEngine.ts';
import { minimalDatasetSignature } from '../src/moneta/representation/DatasetSignature.ts';
import { createDefaultRequirements } from '../src/moneta/representation/RepresentationRequirements.ts';

const policy = {
  minimumHoldoutJudgements: 30,
  minimumHoldoutGroups: 10,
  minimumAbsoluteImprovement: 0.05,
};

function artifact(modelVersion = 'learned-v1'): FitnessModelArtifact {
  return {
    schemaVersion: FITNESS_MODEL_ARTIFACT_SCHEMA_VERSION,
    modelId: 'moneta-pairwise-linear',
    modelVersion,
    modelKind: 'pairwise-linear',
    createdAt: 1,
    trainingDatasetHash: 'train-v1',
    curationPolicyHash: 'policy-v1',
    featureSchemaVersion: '1.0.0',
    parameters: { weights: [1, 0, 0, 0, 0, 0] },
    evaluation: {
      bootstrapMetric: 0.6,
      candidateMetric: 0.8,
      metricName: GROUP_BALANCED_PAIRWISE_METRIC,
      holdoutJudgementCount: 40,
      holdoutGroupCount: 12,
      candidateGroupWins: 10,
      bootstrapGroupWins: 2,
      tiedGroups: 0,
      oneSidedGroupWinPValue: 0.019287109375,
    },
  };
}

function bootstrapDecision() {
  const signature = minimalDatasetSignature(1_000, 4, 0, 0, 'learned-runtime-opt-in', 0);
  signature.clusterStructure.densityVariation = 0.6;
  return new MonetaHypothesisEngine().arbitrate(
    signature,
    createDefaultRequirements('explore', 'MEDIUM'),
  );
}

function activeRegistry(modelVersion = 'learned-v1') {
  const registry = new FitnessModelRegistry();
  const registered = registry.register(artifact(modelVersion));
  registry.promote(registered.artifactHash, 2);
  return { registry, registered };
}

describe('pinned learned Moneta runtime composition', () => {
  it('keeps bootstrap as the RepresentationState default', () => {
    const state = new RepresentationState();
    expect(state.getFitnessRuntimeIdentity()).toEqual({
      mode: 'bootstrap',
      fitnessModelVersion: 'bootstrap-fitness-v1',
      artifactHash: null,
    });
  });

  it('records exact learned model and artifact provenance when explicitly enabled', () => {
    const base = bootstrapDecision();
    const { registry, registered } = activeRegistry();
    const decision = applyPinnedLearnedFitnessRuntime(base, {
      registry,
      policy,
      artifactHash: registered.artifactHash,
      modelVersion: 'learned-v1',
    });
    expect(decision.fitnessModelVersion).toBe('learned-v1');
    expect(decision.fitnessModelArtifactHash).toBe(registered.artifactHash);
    expect(decision.provenance.fitnessModelVersion).toBe('learned-v1');
    expect(decision.provenance.fitnessModelArtifactHash).toBe(registered.artifactHash);
    expect(decision.provenance.version).toBe(LEARNED_MONETA_RUNTIME_VERSION);
    expect(decision.weightSensitivity).toBeUndefined();
    expect(decision.evidence).toContainEqual(expect.objectContaining({
      fact: `Fitness artifact: ${registered.artifactHash}`,
      source: 'moneta-learned-runtime',
    }));
  });

  it('re-ranks only bootstrap-feasible candidates and never resurrects a hard rejection', () => {
    const base = bootstrapDecision();
    const { registry, registered } = activeRegistry();
    const disqualifiedBefore = new Set(base.rankedCandidates?.filter((candidate) => candidate.disqualified).map((candidate) => `${candidate.candidateId}:${candidate.layout}`));
    const decision = applyPinnedLearnedFitnessRuntime(base, {
      registry,
      policy,
      artifactHash: registered.artifactHash,
      modelVersion: 'learned-v1',
    });
    const disqualifiedAfter = new Set(decision.rankedCandidates?.filter((candidate) => candidate.disqualified).map((candidate) => `${candidate.candidateId}:${candidate.layout}`));
    expect(disqualifiedAfter).toEqual(disqualifiedBefore);
    expect(decision.rankedCandidates?.[0].disqualified).not.toBe(true);
  });

  it('fails closed when the registry-active artifact drifts after configuration', () => {
    const base = bootstrapDecision();
    const { registry, registered: first } = activeRegistry('learned-v1');
    const second = registry.register(artifact('learned-v2'));
    registry.promote(second.artifactHash, 3);
    expect(() => applyPinnedLearnedFitnessRuntime(base, {
      registry,
      policy,
      artifactHash: first.artifactHash,
      modelVersion: 'learned-v1',
    })).toThrow(/does not match pinned runtime artifact/i);
  });

  it('fails closed when the pinned model version does not match the exact artifact', () => {
    const base = bootstrapDecision();
    const { registry, registered } = activeRegistry('learned-v1');
    expect(() => applyPinnedLearnedFitnessRuntime(base, {
      registry,
      policy,
      artifactHash: registered.artifactHash,
      modelVersion: 'learned-v2',
    })).toThrow(/version mismatch/i);
  });

  it('fails closed when an active artifact no longer satisfies the promotion policy', () => {
    const base = bootstrapDecision();
    const registry = new FitnessModelRegistry();
    const weak = artifact();
    weak.evaluation.candidateMetric = 0.61;
    const registered = registry.register(weak);
    registry.promote(registered.artifactHash, 2);
    expect(() => applyPinnedLearnedFitnessRuntime(base, {
      registry,
      policy,
      artifactHash: registered.artifactHash,
      modelVersion: 'learned-v1',
    })).toThrow(/not promotion-eligible/i);
  });
});

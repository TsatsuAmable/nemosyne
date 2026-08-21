import type { CandidateScore } from '../moneta/representation/RepresentationDecision.ts';
import type { FitnessModelArtifact, FitnessModelRegistry } from './FitnessModelRegistry.ts';
import {
  assessFitnessModelPromotion,
  type FitnessModelPromotionPolicy,
} from './PromotionGate.ts';
import {
  MONETA_PAIRWISE_FEATURE_DIMENSIONS,
} from './MonetaFeatureSnapshot.ts';
import { PAIRWISE_FEATURE_SCHEMA_VERSION } from './PairwiseLearning.ts';

export interface LearnedFitnessRuntimeSelection {
  artifactHash: string;
  modelVersion: string;
  rankedCandidates: readonly CandidateScore[];
}

function weightsFromArtifact(artifact: FitnessModelArtifact): readonly number[] {
  if (artifact.featureSchemaVersion !== PAIRWISE_FEATURE_SCHEMA_VERSION) {
    throw new Error(`Unsupported learned feature schema: ${artifact.featureSchemaVersion}`);
  }
  const weights = artifact.parameters.weights;
  if (!Array.isArray(weights) || weights.length !== MONETA_PAIRWISE_FEATURE_DIMENSIONS.length) {
    throw new Error('Learned FitnessModel weights do not match the canonical Moneta feature dimension');
  }
  if (weights.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error('Learned FitnessModel weights must be finite numbers');
  }
  return weights as readonly number[];
}

function rawFeatures(candidate: CandidateScore): readonly number[] {
  const byName = new Map(candidate.components.map((component) => [component.component, component.rawScore]));
  return MONETA_PAIRWISE_FEATURE_DIMENSIONS.map((dimension) => {
    const value = byName.get(dimension);
    if (value === undefined || !Number.isFinite(value)) {
      throw new Error(`Candidate ${candidate.candidateId} is missing canonical feature ${dimension}`);
    }
    return value;
  });
}

function dot(weights: readonly number[], features: readonly number[]): number {
  return weights.reduce((sum, weight, index) => sum + weight * features[index], 0);
}

function rankActive(
  registry: FitnessModelRegistry,
  candidates: readonly CandidateScore[],
  policy: FitnessModelPromotionPolicy,
  expectedArtifactHash?: string,
): LearnedFitnessRuntimeSelection {
  const active = registry.active;
  if (!active) throw new Error('No active learned FitnessModel artifact');

  if (expectedArtifactHash !== undefined) {
    const expected = expectedArtifactHash.trim();
    if (!expected) throw new TypeError('Expected learned FitnessModel artifact hash must be non-empty');
    if (active.artifactHash !== expected) {
      throw new Error(
        `Active FitnessModel artifact does not match pinned runtime artifact: expected ${expected}, received ${active.artifactHash}`,
      );
    }
  }

  const assessment = assessFitnessModelPromotion(active.artifact, policy);
  if (!assessment.eligible) {
    throw new Error(`Active FitnessModel is not promotion-eligible: ${assessment.reasons.join(',')}`);
  }

  const weights = weightsFromArtifact(active.artifact);
  const ranked = candidates.map((candidate) => {
    if (candidate.disqualified) return structuredClone(candidate);
    const score = dot(weights, rawFeatures(candidate));
    return {
      ...structuredClone(candidate),
      score,
    };
  });

  ranked.sort((a, b) => {
    if (a.disqualified !== b.disqualified) return a.disqualified ? 1 : -1;
    if (b.score !== a.score) return b.score - a.score;
    const idOrder = a.candidateId.localeCompare(b.candidateId);
    return idOrder !== 0 ? idOrder : a.layout.localeCompare(b.layout);
  });

  return {
    artifactHash: active.artifactHash,
    modelVersion: active.artifact.modelVersion,
    rankedCandidates: ranked,
  };
}

/**
 * Opt-in learned post-bootstrap re-ranker using whichever artifact is currently
 * active in the registry. Operator-controlled code may use this path, but
 * reproducible study/session execution should prefer the pinned variant below.
 */
export function rankWithActiveLearnedFitnessModel(
  registry: FitnessModelRegistry,
  candidates: readonly CandidateScore[],
  policy: FitnessModelPromotionPolicy,
): LearnedFitnessRuntimeSelection {
  return rankActive(registry, candidates, policy);
}

/**
 * Re-ranks only when the registry-active artifact is exactly the artifact pinned
 * by runtime/study provenance. A registry promotion or rollback therefore
 * cannot silently change an already-pinned execution context.
 */
export function rankWithPinnedLearnedFitnessModel(
  registry: FitnessModelRegistry,
  candidates: readonly CandidateScore[],
  policy: FitnessModelPromotionPolicy,
  expectedArtifactHash: string,
): LearnedFitnessRuntimeSelection {
  return rankActive(registry, candidates, policy, expectedArtifactHash);
}

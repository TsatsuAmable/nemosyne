import type { VRBehavior, VRGeometry, VRInteraction, VRLayout } from '../types.ts';
import type { SpatialStrategy } from '../SpatialStrategy.ts';
import {
  rankWithPinnedLearnedFitnessModel,
} from '../../fitness/LearnedFitnessRuntimeAdapter.ts';
import type { FitnessModelRegistry } from '../../fitness/FitnessModelRegistry.ts';
import type { FitnessModelPromotionPolicy } from '../../fitness/PromotionGate.ts';
import { canonicalJsonStringify } from '../../investigation/InvestigationDigest.ts';
import { fnv1aHex } from '../../atlas/DatasetSpace.ts';
import { assessRepresentationDecision } from './DecisionPolicy.ts';
import {
  MONETA_REPRESENTATION_CANDIDATES,
} from './RepresentationCandidate.ts';
import { NoFeasibleRepresentationError } from './NoFeasibleRepresentationError.ts';
import type {
  CandidateScore,
  DecisionEmbodiment,
  RejectedAlternative,
  RepresentationDecision,
} from './RepresentationDecision.ts';

export const LEARNED_MONETA_RUNTIME_VERSION = '2.2.0-v3-learned-opt-in' as const;

export interface PinnedLearnedMonetaRuntimeConfig {
  registry: FitnessModelRegistry;
  policy: FitnessModelPromotionPolicy;
  artifactHash: string;
  modelVersion: string;
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${label} must be non-empty`);
  return normalized;
}

function geometryForLayout(layout: VRLayout): VRGeometry {
  switch (layout) {
    case 'GEO_SURFACE':
      return 'GEO_COLUMN';
    case 'TIME_RIBBON':
      return 'BEAM';
    case 'SPECTRAL_VOLUME':
      return 'SPECTRAL_BAR';
    case 'RADIAL_ORBITAL':
      return 'CONICAL_TREE';
    case 'FORCE_DIRECTED_3D':
      return 'ICOSA_NODE';
    default:
      return 'CUBE_MATRIX';
  }
}

function behaviorForLayout(layout: VRLayout): VRBehavior {
  if (layout === 'TIME_RIBBON') return 'PULSE_QUANTITATIVE';
  if (layout === 'RADIAL_ORBITAL') return 'ORBITAL_SPIN';
  return 'STATIC';
}

function interactionForLayout(layout: VRLayout): VRInteraction {
  if (layout === 'TIME_RIBBON') return 'HARVEST_STREAM';
  if (layout === 'FORCE_DIRECTED_3D') return 'TRAVERSE_EDGE';
  if (layout === 'RADIAL_ORBITAL') return 'DRILL_DOWN';
  return 'INSPECT_CELL';
}

function buildSpatialStrategy(
  winner: CandidateScore,
  candidates: readonly CandidateScore[],
  datasetFingerprint: string,
  requirementsHash: string,
  modelVersion: string,
  modelArtifactHash: string,
): SpatialStrategy {
  const geometry = geometryForLayout(winner.layout);
  const behavior = behaviorForLayout(winner.layout);
  const interaction = interactionForLayout(winner.layout);
  const positionSemantics =
    winner.layout === 'GEO_SURFACE'
      ? 'SEMANTIC'
      : winner.layout === 'FORCE_DIRECTED_3D' || winner.layout === 'RADIAL_ORBITAL'
        ? 'STRUCTURAL'
        : 'ALGORITHMIC_LAYOUT';
  const detailLens =
    winner.layout === 'TIME_RIBBON'
      ? 'TIME_DIAL'
      : winner.candidateId === 'CLUSTER_REGIONS'
        ? 'CLUSTER_ZONE'
        : winner.candidateId === 'DISTRIBUTION_FIELD'
          ? 'OUTLIER_HALO'
          : 'INSPECTOR_SLATE';

  return {
    id: `strat:${winner.candidateId}_${requirementsHash.slice(0, 8)}`,
    worldType: winner.layout === 'RADIAL_ORBITAL' ? 'FOCUSED_CHAMBER' : 'ANALYST_COCKPIT',
    macroLayout: { layout: winner.layout, parameters: {}, positionSemantics },
    datumEncoding: { geometry, mappings: {}, behavior },
    interactionStrategy: { primaryInteraction: interaction, supportedGestures: [], detailLens },
    score: winner.score,
    rationale: `Selected ${winner.candidateId} from pinned learned FitnessModel ${modelVersion}.`,
    rejectionLog: candidates
      .filter((candidate) => candidate !== winner)
      .map((candidate) => ({
        strategyId: candidate.candidateId,
        layout: candidate.layout,
        geometry: geometryForLayout(candidate.layout),
        score: candidate.score,
        reason: candidate.disqualificationReason ?? `Ranked below ${winner.candidateId}`,
      })),
    provenance: {
      generatedAt: 0,
      engine: 'MonetaHypothesisEngine',
      version: LEARNED_MONETA_RUNTIME_VERSION,
      datasetFingerprint,
      requirementsHash,
      fitnessModelVersion: modelVersion,
      fitnessModelArtifactHash: modelArtifactHash,
    },
  };
}

function rejectedAlternatives(
  winner: CandidateScore,
  rankedCandidates: readonly CandidateScore[],
): RejectedAlternative[] {
  const seenFamilies = new Set<string>([winner.family]);
  const rejected: RejectedAlternative[] = [];
  for (const candidate of rankedCandidates) {
    if (seenFamilies.has(candidate.family)) continue;
    seenFamilies.add(candidate.family);
    rejected.push({
      family: candidate.family,
      score: candidate.score,
      reason:
        candidate.disqualificationReason ??
        `Lower learned utility (${candidate.score.toFixed(3)})`,
      hardPassed: !candidate.disqualified,
    });
  }
  return rejected;
}

/**
 * Apply a pinned learned model only after bootstrap Moneta has generated
 * candidates, enforced hard constraints and computed canonical raw fitness
 * features. There is deliberately no fallback: any registry, promotion,
 * artifact-hash or model-version mismatch fails closed.
 */
export function applyPinnedLearnedFitnessRuntime(
  bootstrapDecision: RepresentationDecision,
  config: PinnedLearnedMonetaRuntimeConfig,
): RepresentationDecision {
  const expectedArtifactHash = nonEmpty(config.artifactHash, 'Pinned learned artifact hash');
  const expectedModelVersion = nonEmpty(config.modelVersion, 'Pinned learned model version');
  const candidates = bootstrapDecision.rankedCandidates;
  if (!candidates || candidates.length === 0) {
    throw new Error('Bootstrap RepresentationDecision has no candidates to re-rank');
  }

  const learned = rankWithPinnedLearnedFitnessModel(
    config.registry,
    candidates,
    config.policy,
    expectedArtifactHash,
  );
  if (learned.modelVersion !== expectedModelVersion) {
    throw new Error(
      `Pinned FitnessModel version mismatch: expected ${expectedModelVersion}, received ${learned.modelVersion}`,
    );
  }

  const rankedCandidates = learned.rankedCandidates.map((candidate) => structuredClone(candidate));
  const assessment = assessRepresentationDecision(rankedCandidates);
  const winner = assessment.winner;
  const requirementsHash = bootstrapDecision.provenance.requirementsHash;
  const datasetFingerprint = bootstrapDecision.provenance.datasetFingerprint;

  if (!winner) {
    throw new NoFeasibleRepresentationError(
      bootstrapDecision.rulesEvaluated ?? [],
      rankedCandidates,
      {
        datasetFingerprint,
        kernelVersion:
          bootstrapDecision.kernelVersion ?? bootstrapDecision.datasetSignature.provenance.kernelVersion,
        evidenceIds: [],
        requirementsHash,
        fitnessModelVersion: learned.modelVersion,
        fitnessModelArtifactHash: learned.artifactHash,
        sourceDecisionId: bootstrapDecision.id,
        sourceDecisionEvidenceHash: fnv1aHex(canonicalJsonStringify(bootstrapDecision.evidence)),
      },
    );
  }

  const definition = MONETA_REPRESENTATION_CANDIDATES[winner.candidateId];
  if (!requirementsHash?.trim()) {
    throw new Error('Bootstrap RepresentationDecision is missing requirements provenance');
  }
  const embodiment: DecisionEmbodiment = {
    primaryLayout: winner.layout,
    primaryGeometry: geometryForLayout(winner.layout),
    primaryBehavior: behaviorForLayout(winner.layout),
    primaryInteraction: interactionForLayout(winner.layout),
    spatialStrategy: buildSpatialStrategy(
      winner,
      rankedCandidates,
      datasetFingerprint,
      requirementsHash,
      learned.modelVersion,
      learned.artifactHash,
    ),
  };

  const evidence = bootstrapDecision.evidence
    .filter((item) => item.source !== 'moneta-config' && item.source !== 'moneta-sensitivity')
    .map((item) => structuredClone(item));
  evidence.push(
    {
      fact: `Fitness model: ${learned.modelVersion}`,
      weight: 0,
      supports: true,
      source: 'moneta-learned-runtime',
    },
    {
      fact: `Fitness artifact: ${learned.artifactHash}`,
      weight: 0,
      supports: true,
      source: 'moneta-learned-runtime',
    },
  );

  return {
    ...structuredClone(bootstrapDecision),
    id: `decision_${winner.candidateId}_${datasetFingerprint.slice(0, 8)}`,
    chosenCandidateId: winner.candidateId,
    chosenFamily: winner.family,
    chosenLayout: winner.layout,
    explanation:
      `${assessment.status}: pinned learned FitnessModel ${learned.modelVersion} ` +
      `(${learned.artifactHash}) ranks ${definition.name} (${winner.layout}) at utility ` +
      `${winner.score.toFixed(3)}. ${assessment.rationale}`,
    rankedCandidates,
    preserves: definition.preserves,
    loses: definition.loses,
    representationFamily: winner.family,
    utilityScore: winner.score,
    decisionStatus: assessment.status,
    runnerUp: assessment.runnerUp,
    decisionMargin: assessment.margin,
    decisionRationale: assessment.rationale,
    fitnessModelVersion: learned.modelVersion,
    fitnessModelArtifactHash: learned.artifactHash,
    weightSensitivity: undefined,
    embodiment,
    evidence,
    rejectedAlternatives: rejectedAlternatives(winner, rankedCandidates),
    provenance: {
      ...bootstrapDecision.provenance,
      version: LEARNED_MONETA_RUNTIME_VERSION,
      fitnessModelVersion: learned.modelVersion,
      fitnessModelArtifactHash: learned.artifactHash,
    },
  };
}

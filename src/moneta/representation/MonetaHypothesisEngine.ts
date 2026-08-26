/**
 * MonetaHypothesisEngine — V3 bootstrap representation hypothesis solver.
 *
 * Stage 1: hard feasibility filtering.
 * Stage 2: explicit, versioned bootstrap fitness evaluation.
 * Stage 3: decision policy that may abstain or expose ambiguity.
 * Stage 4: deterministic local weight-sensitivity analysis.
 *
 * The bootstrap model is an engineering prior. Its utility score is not a
 * calibrated probability and must not be presented as confidence.
 */

import type { VRLayout, VRGeometry, VRBehavior, VRInteraction } from '../types.ts';
import type { DatasetSignature } from './DatasetSignature.ts';
import type {
  RepresentationDecision,
  CandidateScore,
  HardConstraintTrace,
  ScoreComponent,
  DecisionEvidenceItem,
  RejectedAlternative,
  DecisionEmbodiment,
  DecisionProvenance,
} from './RepresentationDecision.ts';
import {
  ALL_REPRESENTATION_FAMILIES,
  FAMILY_TO_LAYOUTS,
  FAMILY_TO_CANDIDATE_IDS,
  type RepresentationFamily,
} from './RepresentationFamily.ts';
import {
  MONETA_REPRESENTATION_CANDIDATES,
  type SemanticRepresentationId,
} from './RepresentationCandidate.ts';
import {
  createDefaultRequirements,
  type RepresentationRequirements,
  type AnalyticalIntent,
} from './RepresentationRequirements.ts';
import type { SpatialStrategy } from '../SpatialStrategy.ts';
import type { MonetaFacts } from '../types.ts';
import type { Facts } from '../../data/types.ts';
import { buildDatasetSignature } from './SignatureBuilder.ts';
import { NoFeasibleRepresentationError } from './NoFeasibleRepresentationError.ts';
import { canonicalJsonStringify } from '../../investigation/InvestigationDigest.ts';
import { fnv1aHex } from '../../atlas/DatasetSpace.ts';
import type { PerceptualFitnessEvidence } from '../evidence/PerceptualFitnessEvidence.ts';
import {
  BootstrapFitnessModel,
  type BootstrapFitnessWeights,
} from './FitnessModel.ts';
import { assessRepresentationDecision } from './DecisionPolicy.ts';
import { analyzeWinnerSensitivity } from './SensitivityAnalysis.ts';

/**
 * Backward-compatible weight envelope. New code should prefer
 * BootstrapFitnessWeights from FitnessModel.ts.
 */
export interface HypothesisWeights {
  w_struct: number;
  w_task: number;
  w_scale: number;
  w_loss: number;
  w_density: number;
  w_prior: number;
  w_perceptual?: number;
}

export const DEFAULT_HYPOTHESIS_WEIGHTS: HypothesisWeights = {
  w_struct: 0.30,
  w_task: 0.25,
  w_scale: 0.15,
  w_loss: 0.15,
  w_density: 0.05,
  w_prior: 0.05,
  w_perceptual: 0.05,
};

function toBootstrapWeights(weights: HypothesisWeights): BootstrapFitnessWeights {
  return {
    structure: weights.w_struct,
    task: weights.w_task,
    scale: weights.w_scale,
    informationPreservation: weights.w_loss,
    densityHandling: weights.w_density,
    configuredPrior: weights.w_prior,
    perceptualFitness: weights.w_perceptual ?? 0.05,
  };
}

function candidateKey(candidate: Pick<CandidateScore, 'candidateId' | 'layout'>): string {
  return `${candidate.candidateId}:${candidate.layout}`;
}

function geometryForLayout(layout: VRLayout, candidateId?: SemanticRepresentationId): VRGeometry {
  if (candidateId === 'AGGREGATE_VOLUME') return 'AGGREGATE_BARS';
  if (candidateId === 'CLUSTER_REGIONS') return 'CLUSTER_VOLUME';
  if (candidateId === 'DENSITY_FIELD' || candidateId === 'DISTRIBUTION_FIELD') return 'DENSITY_FIELD';
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

export class MonetaHypothesisEngine {
  readonly version = '2.1.0-v3-bootstrap';
  readonly fitnessModel: BootstrapFitnessModel;
  private readonly fitnessModelArtifactHash: string | null;

  constructor(
    modelOrWeights?: BootstrapFitnessModel | Partial<HypothesisWeights> | Partial<BootstrapFitnessWeights>,
    fitnessModelArtifactHash: string | null = null
  ) {
    if (modelOrWeights instanceof BootstrapFitnessModel) {
      this.fitnessModel = modelOrWeights;
    } else if (
      modelOrWeights &&
      ('w_struct' in modelOrWeights ||
        'w_task' in modelOrWeights ||
        'w_scale' in modelOrWeights ||
        'w_loss' in modelOrWeights)
    ) {
      const merged = { ...DEFAULT_HYPOTHESIS_WEIGHTS, ...modelOrWeights };
      this.fitnessModel = new BootstrapFitnessModel(toBootstrapWeights(merged));
    } else if (modelOrWeights) {
      this.fitnessModel = new BootstrapFitnessModel(
        modelOrWeights as Partial<BootstrapFitnessWeights>
      );
    } else {
      this.fitnessModel = new BootstrapFitnessModel();
    }
    this.fitnessModelArtifactHash = fitnessModelArtifactHash;
  }

  static reason(
    facts: MonetaFacts,
    _kernelFacts?: Facts | null,
    requirements?: RepresentationRequirements,
    options: {
      datasetFingerprint?: string;
      spectralFacts?: import('./DatasetSignature.ts').SpectralFacts | null;
      signature?: DatasetSignature;
      perceptualEvidence?: PerceptualFitnessEvidence | Map<string, PerceptualFitnessEvidence> | Record<string, PerceptualFitnessEvidence>;
    } = {}
  ): RepresentationDecision {
    const signature =
      options.signature ??
      buildDatasetSignature(
        facts,
        _kernelFacts,
        options.datasetFingerprint ?? 'unknown',
        '0.1.0',
        options.spectralFacts,
        0
      );

    return new MonetaHypothesisEngine().arbitrate(signature, requirements, undefined, facts, options.perceptualEvidence);
  }

  public static arbitrate(
    signature: DatasetSignature,
    requirements?: RepresentationRequirements,
    facts?: MonetaFacts,
    perceptualEvidence?: PerceptualFitnessEvidence | Map<string, PerceptualFitnessEvidence> | Record<string, PerceptualFitnessEvidence>
  ): RepresentationDecision {
    return new MonetaHypothesisEngine().arbitrate(signature, requirements, undefined, facts, perceptualEvidence);
  }

  public arbitrate(
    signature: DatasetSignature,
    requirements?: RepresentationRequirements,
    intent?: AnalyticalIntent,
    _fallbackFacts?: MonetaFacts,
    perceptualEvidence?: PerceptualFitnessEvidence | Map<string, PerceptualFitnessEvidence> | Record<string, PerceptualFitnessEvidence>
  ): RepresentationDecision {
    const reqs =
      requirements ??
      createDefaultRequirements(
        intent?.task ?? 'explore',
        this.inferScale(signature.cardinality.rowCount)
      );
    const hardTraces: HardConstraintTrace[] = [];
    const scoredCandidates: CandidateScore[] = [];

    // Normalize perceptual evidence into a lookup map
    const perceptualMap = new Map<string, PerceptualFitnessEvidence>();
    if (perceptualEvidence) {
      if (perceptualEvidence instanceof Map) {
        for (const [k, v] of perceptualEvidence.entries()) {
          perceptualMap.set(k, v);
        }
      } else if (
        'candidateId' in perceptualEvidence &&
        typeof (perceptualEvidence as PerceptualFitnessEvidence).candidateId === 'string'
      ) {
        const ev = perceptualEvidence as PerceptualFitnessEvidence;
        perceptualMap.set(ev.candidateId, ev);
      } else {
        for (const [k, v] of Object.entries(perceptualEvidence)) {
          perceptualMap.set(k, v as PerceptualFitnessEvidence);
        }
      }
    }

    for (const item of this.generateCandidates()) {
      const candidate = MONETA_REPRESENTATION_CANDIDATES[item.candidateId];
      const candidateEvidence = perceptualMap.get(item.candidateId);
      const check = this.checkHardConstraints(signature, reqs, candidate, item.layout, candidateEvidence);

      hardTraces.push({
        ruleName: `${item.candidateId}_on_${item.layout}`,
        passed: check.passed,
        reason: check.reason,
      });

      if (!check.passed) {
        scoredCandidates.push({
          family: item.family,
          candidateId: item.candidateId,
          layout: item.layout,
          score: 0,
          components: [],
          disqualified: true,
          disqualificationReason: check.reason,
          preserves: candidate.preserves,
          loses: candidate.loses,
        });
        continue;
      }

      scoredCandidates.push(
        this.scoreCandidateWithModel(
          this.fitnessModel,
          signature,
          reqs,
          candidate,
          item.family,
          item.layout,
          candidateEvidence
        )
      );
    }

    this.sortCandidates(scoredCandidates);

    const assessment = assessRepresentationDecision(scoredCandidates);
    const winner = assessment.winner;
    if (!winner) {
      throw new NoFeasibleRepresentationError(hardTraces, scoredCandidates);
    }

    const weightSensitivity = analyzeWinnerSensitivity(
      candidateKey(winner),
      this.fitnessModel.weights,
      (weights) => this.rankWinnerUnderWeights(signature, reqs, scoredCandidates, weights),
      0.1
    );

    const candidateDef = MONETA_REPRESENTATION_CANDIDATES[winner.candidateId];
    const explanation =
      `${assessment.status}: Moneta ranks ${candidateDef.name} (${winner.layout}) ` +
      `at utility ${winner.score.toFixed(3)}. ${assessment.rationale} ` +
      `Under ±10% single-weight perturbations, the winner changes in ` +
      `${(weightSensitivity.winnerChangeRate * 100).toFixed(1)}% of scenarios. ` +
      `Preserves: [${candidateDef.preserves.join(', ')}]. ` +
      `Declared losses: [${candidateDef.loses.join(', ')}].`;

    const primaryGeometry = geometryForLayout(winner.layout, winner.candidateId);
    const primaryBehavior: VRBehavior =
      winner.layout === 'TIME_RIBBON'
        ? 'PULSE_QUANTITATIVE'
        : winner.layout === 'RADIAL_ORBITAL'
          ? 'ORBITAL_SPIN'
          : 'STATIC';
    const primaryInteraction: VRInteraction =
      winner.layout === 'TIME_RIBBON'
        ? 'HARVEST_STREAM'
        : winner.layout === 'FORCE_DIRECTED_3D'
          ? 'TRAVERSE_EDGE'
          : winner.layout === 'RADIAL_ORBITAL'
            ? 'DRILL_DOWN'
            : 'INSPECT_CELL';

    const requirementsHash = fnv1aHex(canonicalJsonStringify(reqs));
    const spatialStrategy = this.buildSpatialStrategy(
      winner,
      primaryGeometry,
      primaryBehavior,
      primaryInteraction,
      signature.provenance.datasetFingerprint,
      requirementsHash,
      scoredCandidates
    );

    const embodiment: DecisionEmbodiment = {
      primaryLayout: winner.layout,
      primaryGeometry,
      primaryBehavior,
      primaryInteraction,
      spatialStrategy,
    };

    const evidence: DecisionEvidenceItem[] = [
      {
        fact: `Topology: ${signature.topologicalStructure.topology}`,
        weight: 0.4,
        supports: true,
        source: 'kernel',
      },
      {
        fact: `Dimensionality: ${signature.schema.numericCount} numeric, ${signature.schema.categoricalCount} categorical`,
        weight: 0.3,
        supports: true,
        source: 'kernel',
      },
      {
        fact: `Fitness model: ${this.fitnessModel.version}`,
        weight: 0,
        supports: true,
        source: 'moneta-config',
      },
      {
        fact: `Weight sensitivity: ${(weightSensitivity.winnerChangeRate * 100).toFixed(1)}% winner changes across ${weightSensitivity.scenarioCount} scenarios`,
        weight: 0,
        supports: true,
        source: 'moneta-sensitivity',
      },
    ];

    if (signature.spectralStructure?.hasPeriodicity) {
      evidence.push({
        fact: 'spectral periodicity detected in signal',
        weight: 0.5,
        supports: true,
        source: 'kernel',
      });
    }

    const winnerPerceptual = perceptualMap.get(winner.candidateId);
    if (winnerPerceptual) {
      evidence.push({
        fact: `Perceptual fitness: ${winnerPerceptual.source} (occlusion resistance ${winnerPerceptual.priors.occlusionResistance.toFixed(2)})`,
        weight: this.fitnessModel.weights.perceptualFitness,
        supports: true,
        source: winnerPerceptual.source === 'measured' ? 'measured' : 'prior',
      });
    } else {
      evidence.push({
        fact: `Perceptual fitness: prior (occlusion resistance ${candidateDef.interactionCharacteristics.occlusionResistance.toFixed(2)}, cognitive load ${candidateDef.interactionCharacteristics.cognitiveLoad.toFixed(2)})`,
        weight: this.fitnessModel.weights.perceptualFitness,
        supports: true,
        source: 'prior',
      });
    }

    const seenFamilies = new Set<string>([winner.family]);
    const rejectedAlternatives: RejectedAlternative[] = [];
    for (const candidate of scoredCandidates) {
      if (!seenFamilies.has(candidate.family)) {
        seenFamilies.add(candidate.family);
        rejectedAlternatives.push({
          family: candidate.family,
          score: candidate.score,
          reason:
            candidate.disqualificationReason ??
            `Lower bootstrap utility (${candidate.score.toFixed(3)})`,
          hardPassed: !candidate.disqualified,
        });
      }
    }

    const now = 0;
    const provenance: DecisionProvenance = {
      generatedAt: now,
      engine: 'MonetaHypothesisEngine',
      version: '2.1.0-v3-bootstrap',
      datasetFingerprint: signature.provenance.datasetFingerprint,
      requirementsHash,
      fitnessModelVersion: this.fitnessModel.version,
      fitnessModelArtifactHash: this.fitnessModelArtifactHash,
      perceptualModelVersion: 'perceptual-fitness-v1',
      perceptualDeviceClass: winnerPerceptual?.measured?.deviceClass ?? 'desktop',
    };

    return {
      id: `decision_${winner.candidateId}_${signature.provenance.datasetFingerprint.slice(0, 8)}`,
      chosenCandidateId: winner.candidateId,
      chosenFamily: winner.family,
      chosenLayout: winner.layout,
      explanation,
      rulesEvaluated: hardTraces,
      rankedCandidates: scoredCandidates,
      preserves: candidateDef.preserves,
      loses: candidateDef.loses,
      datasetFingerprint: signature.provenance.datasetFingerprint,
      kernelVersion: signature.provenance.kernelVersion,
      decisionTimestamp: now,
      representationFamily: winner.family,
      utilityScore: winner.score,
      decisionStatus: assessment.status,
      runnerUp: assessment.runnerUp,
      decisionMargin: assessment.margin,
      decisionRationale: assessment.rationale,
      fitnessModelVersion: this.fitnessModel.version,
      perceptualModelVersion: 'perceptual-fitness-v1',
      weightSensitivity,
      embodiment,
      evidence,
      rejectedAlternatives,
      provenance,
      datasetSignature: signature,
    };
  }

  private generateCandidates(): Array<{
    family: RepresentationFamily;
    candidateId: SemanticRepresentationId;
    layout: VRLayout;
  }> {
    const results: Array<{
      family: RepresentationFamily;
      candidateId: SemanticRepresentationId;
      layout: VRLayout;
    }> = [];
    for (const family of ALL_REPRESENTATION_FAMILIES) {
      for (const layout of FAMILY_TO_LAYOUTS[family]) {
        for (const candidateId of FAMILY_TO_CANDIDATE_IDS[family]) {
          results.push({ family, candidateId, layout });
        }
      }
    }
    return results;
  }

  private inferScale(rowCount: number): 'SMALL' | 'MEDIUM' | 'LARGE' | 'MASSIVE' {
    if (rowCount <= 100) return 'SMALL';
    if (rowCount <= 2000) return 'MEDIUM';
    if (rowCount <= 50_000) return 'LARGE';
    return 'MASSIVE';
  }

  private sortCandidates(candidates: CandidateScore[]): void {
    candidates.sort((a, b) => {
      const scoreDelta = b.score - a.score;
      if (scoreDelta !== 0) return scoreDelta;
      return candidateKey(a).localeCompare(candidateKey(b));
    });
  }

  private rankWinnerUnderWeights(
    signature: DatasetSignature,
    reqs: RepresentationRequirements,
    baselineCandidates: CandidateScore[],
    weights: BootstrapFitnessWeights
  ): string | null {
    const model = new BootstrapFitnessModel(weights);
    const rescored = baselineCandidates
      .filter((candidate) => !candidate.disqualified)
      .map((candidate) =>
        this.scoreCandidateWithModel(
          model,
          signature,
          reqs,
          MONETA_REPRESENTATION_CANDIDATES[candidate.candidateId],
          candidate.family,
          candidate.layout
        )
      );
    this.sortCandidates(rescored);
    return rescored[0] ? candidateKey(rescored[0]) : null;
  }

  private checkHardConstraints(
    signature: DatasetSignature,
    reqs: RepresentationRequirements,
    candidate: import('./RepresentationCandidate.ts').RepresentationCandidate,
    layout: VRLayout,
    candidateEvidence?: PerceptualFitnessEvidence
  ): { passed: boolean; reason: string } {
    const top = signature.topologicalStructure.topology;
    const rowCount = signature.cardinality.rowCount;
    const hardware = reqs.hardwareConstraints;

    if (hardware.maxElements !== undefined && rowCount > hardware.maxElements) {
      return {
        passed: false,
        reason: `Dataset has ${rowCount} rows but hardware allows at most ${hardware.maxElements} elements`,
      };
    }

    if (reqs.maxOcclusionTolerance !== undefined && candidateEvidence?.source === 'measured' && candidateEvidence.measured) {
      if (candidateEvidence.measured.hiddenMarkFraction > reqs.maxOcclusionTolerance) {
        return {
          passed: false,
          reason: `Candidate hidden mark fraction ${candidateEvidence.measured.hiddenMarkFraction.toFixed(2)} exceeds maximum occlusion tolerance ${reqs.maxOcclusionTolerance.toFixed(2)}`,
        };
      }
    }

    const hasCriticalGoal = (information: import('./RepresentationCandidate.ts').InformationType) =>
      reqs.preservationGoals.some(
        (goal) => goal.information === information && goal.priority === 'CRITICAL'
      );
    const requiresStructure = (
      structure: import('./RepresentationRequirements.ts').StructureRequirementType
    ) =>
      reqs.requiredStructures.some(
        (requirement) => requirement.type === structure && requirement.importance >= 0.5
      );

    for (const goal of reqs.preservationGoals) {
      if (goal.priority === 'CRITICAL' && candidate.loses.includes(goal.information)) {
        return {
          passed: false,
          reason: `Candidate loses critical information: ${goal.information}`,
        };
      }
    }

    if (
      candidate.loses.includes('individual-observation-identity') &&
      !reqs.acceptableLoss.allowIdentityLoss &&
      (hasCriticalGoal('individual-observation-identity') ||
        requiresStructure('observation-identity'))
    ) {
      return { passed: false, reason: 'Identity loss is not acceptable for this request' };
    }
    if (
      candidate.loses.includes('exact-metric-values') &&
      !reqs.acceptableLoss.allowExactMetricLoss &&
      hasCriticalGoal('exact-metric-values')
    ) {
      return { passed: false, reason: 'Exact metric loss is not acceptable for this request' };
    }
    if (
      candidate.loses.includes('cluster-separation') &&
      !reqs.acceptableLoss.allowClusterLoss &&
      (hasCriticalGoal('cluster-separation') || requiresStructure('cluster-separation'))
    ) {
      return {
        passed: false,
        reason: 'Cluster separation loss is not acceptable for this request',
      };
    }

    if (
      layout === 'FORCE_DIRECTED_3D' &&
      top !== 'GRAPH' &&
      signature.cardinality.edgeCount === 0 &&
      candidate.id !== 'RELATIONSHIP_GRAPH' &&
      candidate.id !== 'CLUSTER_REGIONS'
    ) {
      return {
        passed: false,
        reason: 'ForceDirected requires graph topology or cluster relationships',
      };
    }
    if (
      layout === 'RADIAL_ORBITAL' &&
      top !== 'HIERARCHY' &&
      signature.cardinality.depth <= 1 &&
      candidate.id !== 'HIERARCHICAL_SPACE'
    ) {
      return { passed: false, reason: 'RadialOrbital requires hierarchical structure' };
    }
    if (layout === 'GEO_SURFACE' && !signature.spatialStructure.isGeospatial && top !== 'GEO') {
      return { passed: false, reason: 'GeoSurface requires geospatial coordinates' };
    }
    if (
      layout === 'TIME_RIBBON' &&
      !signature.temporalStructure.isTimeSeries &&
      top !== 'TIME_SERIES'
    ) {
      return { passed: false, reason: 'TimeRibbon requires temporal time-series structure' };
    }
    if (layout === 'VECTOR_STREAMLINE' && top !== 'VECTOR_FIELD') {
      return { passed: false, reason: 'VectorStreamline layout requires vector field topology' };
    }
    if (layout === 'SPECTRAL_VOLUME' && !signature.spectralStructure?.hasPeriodicity) {
      return {
        passed: false,
        reason: 'SpectralVolume layout requires detectable harmonic frequency structure',
      };
    }

    for (const constraint of candidate.constraints) {
      if (
        constraint.requiresTemporal &&
        !signature.temporalStructure.isTimeSeries &&
        top !== 'TIME_SERIES'
      ) {
        return { passed: false, reason: constraint.description };
      }
      if (constraint.requiresGraph && signature.cardinality.edgeCount === 0 && top !== 'GRAPH') {
        return { passed: false, reason: constraint.description };
      }
      if (
        constraint.requiresHierarchy &&
        top !== 'HIERARCHY' &&
        signature.cardinality.depth <= 1
      ) {
        return { passed: false, reason: constraint.description };
      }
      if (
        constraint.requiresGeospatial &&
        !signature.spatialStructure.isGeospatial &&
        top !== 'GEO'
      ) {
        return { passed: false, reason: constraint.description };
      }
      if (constraint.minDimensions && signature.schema.numericCount < constraint.minDimensions) {
        return {
          passed: false,
          reason: `Requires at least ${constraint.minDimensions} numeric dimensions`,
        };
      }
      if (constraint.maxDimensions && signature.schema.numericCount > constraint.maxDimensions) {
        return {
          passed: false,
          reason: `Supports at most ${constraint.maxDimensions} numeric dimensions`,
        };
      }
    }

    if (rowCount < candidate.scaleCharacteristics.minN) {
      return {
        passed: false,
        reason: `Candidate requires at least ${candidate.scaleCharacteristics.minN} rows, received ${rowCount}`,
      };
    }
    if (rowCount > candidate.scaleCharacteristics.maxN) {
      return {
        passed: false,
        reason: `Candidate supports at most ${candidate.scaleCharacteristics.maxN} rows, received ${rowCount}`,
      };
    }

    return { passed: true, reason: 'All hard constraints satisfied' };
  }

  private buildSpatialStrategy(
    winner: CandidateScore,
    geometry: VRGeometry,
    behavior: VRBehavior,
    interaction: VRInteraction,
    datasetFingerprint: string,
    requirementsHash: string,
    candidates: CandidateScore[]
  ): SpatialStrategy {
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
      rationale: `Selected ${winner.candidateId} from ${this.fitnessModel.version} ranking.`,
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
        version: '2.1.0-v3-bootstrap',
        datasetFingerprint,
        requirementsHash,
        fitnessModelVersion: this.fitnessModel.version,
      },
    };
  }

  private scoreCandidateWithModel(
    model: BootstrapFitnessModel,
    signature: DatasetSignature,
    reqs: RepresentationRequirements,
    candidate: import('./RepresentationCandidate.ts').RepresentationCandidate,
    family: RepresentationFamily,
    layout: VRLayout,
    candidateEvidence?: PerceptualFitnessEvidence
  ): CandidateScore {
    const evaluation = model.evaluate(signature, reqs, candidate, family, candidateEvidence);
    const components: ScoreComponent[] = evaluation.components.map((component) => ({
      component: component.dimension,
      weight: component.weight,
      rawScore: component.rawScore,
      weightedScore: component.weightedScore,
      reason: component.rationale,
    }));

    return {
      family,
      candidateId: candidate.id,
      layout,
      score: evaluation.utilityScore,
      components,
      preserves: candidate.preserves,
      loses: candidate.loses,
    };
  }
}

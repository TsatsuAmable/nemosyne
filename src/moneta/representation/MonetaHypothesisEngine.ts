/**
 * MonetaHypothesisEngine — 2-Stage Dataset-Centric Analytical Representation Solver.
 *
 * Stage 1: Hard Constraint Filtering (dimensionality, topology, scale).
 * Stage 2: Information-Preservation Scoring & Evidence-Informed Ranking.
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
import { ConstraintArbiter } from '../ConstraintArbiter.ts';
import type { MonetaFacts } from '../types.ts';
import type { Facts } from '../../data/types.ts';
import { buildDatasetSignature } from './SignatureBuilder.ts';

export interface HypothesisWeights {
  w_struct: number;
  w_task: number;
  w_scale: number;
  w_loss: number;
  w_density: number;
  w_prior: number;
}

export const DEFAULT_HYPOTHESIS_WEIGHTS: HypothesisWeights = {
  w_struct: 0.35,
  w_task: 0.25,
  w_scale: 0.15,
  w_loss: 0.15,
  w_density: 0.05,
  w_prior: 0.05,
};

export class MonetaHypothesisEngine {
  private weights: HypothesisWeights;

  constructor(weights: Partial<HypothesisWeights> = {}) {
    this.weights = { ...DEFAULT_HYPOTHESIS_WEIGHTS, ...weights };
  }

  static reason(
    facts: MonetaFacts,
    _kernelFacts?: Facts | null,
    requirements?: RepresentationRequirements,
    options: {
      datasetFingerprint?: string;
      spectralFacts?: import('./DatasetSignature.ts').SpectralFacts | null;
      signature?: DatasetSignature;
    } = {}
  ): RepresentationDecision {
    const signature =
      options.signature ??
      buildDatasetSignature(
        facts,
        _kernelFacts,
        options.datasetFingerprint ?? 'unknown',
        '0.1.0',
        options.spectralFacts
      );

    const engine = new MonetaHypothesisEngine();
    return engine.arbitrate(signature, requirements, undefined, facts);
  }

  public arbitrate(
    signature: DatasetSignature,
    requirements?: RepresentationRequirements,
    intent?: AnalyticalIntent,
    fallbackFacts?: MonetaFacts
  ): RepresentationDecision {
    const reqs = requirements ?? createDefaultRequirements(intent?.task ?? 'explore', this.inferScale(signature.cardinality.rowCount));
    const allCandidates = this.generateCandidates();

    // Stage 1: Hard Constraints
    const hardTraces: HardConstraintTrace[] = [];
    const scoredCandidates: CandidateScore[] = [];

    for (const item of allCandidates) {
      const candidate = MONETA_REPRESENTATION_CANDIDATES[item.candidateId];
      const check = this.checkHardConstraints(signature, reqs, candidate, item.layout);

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

      // Stage 2: Information-Preservation Scoring
      const scoreResult = this.scoreCandidate(signature, reqs, candidate, item.family, item.layout);
      scoredCandidates.push(scoreResult);
    }

    // Rank candidates
    scoredCandidates.sort((a, b) => (b.score || 0) - (a.score || 0));

    const winner = scoredCandidates.find((c) => !c.disqualified) ?? scoredCandidates[0];
    const candidateDef = MONETA_REPRESENTATION_CANDIDATES[winner.candidateId];

    const explanation = `Moneta selected ${candidateDef.name} (${winner.layout}) with score ${winner.score.toFixed(3)}. Preserves: [${candidateDef.preserves.join(', ')}]. Loss budget respected.`;

    const factsToUse: MonetaFacts = fallbackFacts ?? {
      topology: signature.topologicalStructure.topology,
      rowCount: signature.cardinality.rowCount,
      nodeCount: signature.cardinality.rowCount,
      edgeCount: signature.cardinality.edgeCount,
      depth: signature.cardinality.depth,
      numericColumns: signature.schema.numericCount,
      categoricalColumns: signature.schema.categoricalCount,
      temporalColumns: signature.schema.temporalCount,
      hasTimeSeries: signature.temporalStructure.isTimeSeries,
      hasContinuousValues: signature.schema.numericCount > 0,
      density: signature.cardinality.edgeCount / Math.max(1, signature.cardinality.rowCount),
      estimatedDensity: signature.cardinality.rowCount / 64,
      outlierCount: signature.distribution.anomalyCount,
      cardinalityOfColor: 0,
      hasHighCardinality: false,
      isLargeDataset: signature.cardinality.rowCount > 500,
      clusterCount: signature.clusterStructure.estimatedCount,
      columnStats: {},
      correlationMatrix: {},
      categoryDistribution: {},
      trendDirection: signature.temporalStructure.trendDirection,
      seasonalityHint: signature.temporalStructure.hasSeasonality,
      hasOutliers: signature.distribution.hasOutliers,
      hasHighVariance: signature.distribution.highVariance,
      numericSkew: signature.distribution.maxSkewness,
      topCategory: null,
    };

    const spatialStrategy: SpatialStrategy = ConstraintArbiter.arbitrate(factsToUse, reqs, {
      datasetFingerprint: signature.provenance.datasetFingerprint,
    });

    const primaryGeometry: VRGeometry =
      winner.layout === 'GEO_SURFACE'
        ? 'GEO_COLUMN'
        : winner.layout === 'TIME_RIBBON'
        ? 'BEAM'
        : winner.layout === 'SPECTRAL_VOLUME'
        ? 'SPECTRAL_BAR'
        : winner.layout === 'RADIAL_ORBITAL'
        ? 'CONICAL_TREE'
        : winner.layout === 'FORCE_DIRECTED_3D'
        ? 'ICOSA_NODE'
        : 'CUBE_MATRIX';

    const primaryBehavior: VRBehavior =
      winner.layout === 'TIME_RIBBON' ? 'PULSE_QUANTITATIVE' : winner.layout === 'RADIAL_ORBITAL' ? 'ORBITAL_SPIN' : 'STATIC';

    const primaryInteraction: VRInteraction =
      winner.layout === 'TIME_RIBBON'
        ? 'HARVEST_STREAM'
        : winner.layout === 'FORCE_DIRECTED_3D'
        ? 'TRAVERSE_EDGE'
        : winner.layout === 'RADIAL_ORBITAL'
        ? 'DRILL_DOWN'
        : 'INSPECT_CELL';

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
    ];

    if (signature.spectralStructure?.hasPeriodicity) {
      evidence.push({
        fact: 'spectral periodicity detected in signal',
        weight: 0.5,
        supports: true,
        source: 'kernel',
      });
    }

    const seenFamilies = new Set<string>([winner.family]);
    const rejectedAlternatives: RejectedAlternative[] = [];
    for (const c of scoredCandidates) {
      if (!seenFamilies.has(c.family)) {
        seenFamilies.add(c.family);
        rejectedAlternatives.push({
          family: c.family,
          score: c.score,
          reason: c.disqualificationReason ?? `Suboptimal information utility score (${c.score.toFixed(3)})`,
          hardPassed: !c.disqualified,
        });
      }
    }

    const now = Date.now();
    const provenance: DecisionProvenance = {
      generatedAt: now,
      engine: 'MonetaHypothesisEngine',
      version: '1.0.0',
      datasetFingerprint: signature.provenance.datasetFingerprint,
    };

    return {
      id: `decision_${winner.candidateId}_${signature.provenance.datasetFingerprint.slice(0, 8)}`,
      chosenCandidateId: winner.candidateId,
      chosenFamily: winner.family,
      chosenLayout: winner.layout,
      confidenceScore: Math.min(1.0, Math.max(0.1, winner.score)),
      explanation,
      rulesEvaluated: hardTraces,
      rankedCandidates: scoredCandidates,
      preserves: candidateDef.preserves,
      loses: candidateDef.loses,
      datasetFingerprint: signature.provenance.datasetFingerprint,
      kernelVersion: signature.provenance.kernelVersion,
      decisionTimestamp: now,

      // Compatibility
      representationFamily: winner.family,
      confidence: Math.min(1.0, Math.max(0.1, winner.score)),
      utilityScore: winner.score,
      embodiment,
      evidence,
      rejectedAlternatives,
      provenance,
      datasetSignature: signature,
    };
  }

  private generateCandidates(): Array<{ family: RepresentationFamily; candidateId: SemanticRepresentationId; layout: VRLayout }> {
    const results: Array<{ family: RepresentationFamily; candidateId: SemanticRepresentationId; layout: VRLayout }> = [];
    for (const family of ALL_REPRESENTATION_FAMILIES) {
      const layouts = FAMILY_TO_LAYOUTS[family];
      const candidateIds = FAMILY_TO_CANDIDATE_IDS[family];
      for (const layout of layouts) {
        for (const candidateId of candidateIds) {
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

  private checkHardConstraints(
    signature: DatasetSignature,
    _reqs: RepresentationRequirements,
    candidate: import('./RepresentationCandidate.ts').RepresentationCandidate,
    layout: VRLayout
  ): { passed: boolean; reason: string } {
    const top = signature.topologicalStructure.topology;

    if (layout === 'FORCE_DIRECTED_3D' && top !== 'GRAPH' && signature.cardinality.edgeCount === 0 && candidate.id !== 'RELATIONSHIP_GRAPH' && candidate.id !== 'CLUSTER_REGIONS') {
      return { passed: false, reason: 'ForceDirected requires graph topology or cluster relationships' };
    }
    if (layout === 'RADIAL_ORBITAL' && top !== 'HIERARCHY' && signature.cardinality.depth <= 1 && candidate.id !== 'HIERARCHICAL_SPACE') {
      return { passed: false, reason: 'RadialOrbital requires hierarchical structure' };
    }
    if (layout === 'GEO_SURFACE' && !signature.spatialStructure.isGeospatial && top !== 'GEO') {
      return { passed: false, reason: 'GeoSurface requires geospatial coordinates' };
    }
    if (layout === 'TIME_RIBBON' && !signature.temporalStructure.isTimeSeries && top !== 'TIME_SERIES') {
      return { passed: false, reason: 'TimeRibbon requires temporal time-series structure' };
    }
    if (layout === 'VECTOR_STREAMLINE' && top !== 'VECTOR_FIELD') {
      return { passed: false, reason: 'VectorStreamline layout requires vector field topology' };
    }
    if (layout === 'SPECTRAL_VOLUME' && !signature.spectralStructure?.hasPeriodicity) {
      return { passed: false, reason: 'SpectralVolume layout requires detectable harmonic frequency structure (no spectral structure present)' };
    }

    for (const c of candidate.constraints) {
      if (c.requiresTemporal && !signature.temporalStructure.isTimeSeries && top !== 'TIME_SERIES') {
        return { passed: false, reason: c.description };
      }
      if (c.requiresGraph && signature.cardinality.edgeCount === 0 && top !== 'GRAPH') {
        return { passed: false, reason: c.description };
      }
      if (c.requiresGeospatial && !signature.spatialStructure.isGeospatial && top !== 'GEO') {
        return { passed: false, reason: c.description };
      }
      if (c.minDimensions && signature.schema.numericCount < c.minDimensions) {
        return { passed: false, reason: `Requires at least ${c.minDimensions} numeric dimensions` };
      }
    }

    return { passed: true, reason: 'All hard constraints satisfied' };
  }

  private scoreCandidate(
    signature: DatasetSignature,
    reqs: RepresentationRequirements,
    candidate: import('./RepresentationCandidate.ts').RepresentationCandidate,
    family: RepresentationFamily,
    layout: VRLayout
  ): CandidateScore {
    const components: ScoreComponent[] = [];
    const top = signature.topologicalStructure.topology;

    let structScore = 0.4;
    if (family === 'GRAPH' && (signature.cardinality.edgeCount > 0 || top === 'GRAPH')) structScore = 0.98;
    else if (family === 'HIERARCHICAL' && (top === 'HIERARCHY' || signature.cardinality.depth > 1)) structScore = 0.98;
    else if (family === 'TEMPORAL' && (signature.temporalStructure.isTimeSeries || top === 'TIME_SERIES')) structScore = 0.95;
    else if (family === 'FIELD' && (signature.spatialStructure.isGeospatial || top === 'VECTOR_FIELD' || top === 'GEO')) structScore = 0.96;
    else if (family === 'FREQUENCY' && signature.spectralStructure?.hasPeriodicity) structScore = 0.99;
    else if (family === 'CLUSTER' && (signature.clusterStructure.hasClusters || signature.clusterStructure.estimatedCount > 1 || reqs.task === 'compare-clusters')) structScore = 0.92;
    else if (family === 'DISTRIBUTION' && (signature.distribution.highVariance || signature.distribution.hasOutliers || signature.distribution.anomalyCount > 0 || signature.cardinality.rowCount > 300 || reqs.task === 'identify-outliers' || reqs.task === 'distribution-analysis')) structScore = 0.90;
    else if (family === 'POINT') structScore = (top === 'TABULAR' && signature.clusterStructure.estimatedCount <= 1 && !signature.distribution.hasOutliers && !signature.temporalStructure.isTimeSeries) ? 0.85 : 0.40;

    components.push({
      component: 'structure_match',
      weight: this.weights.w_struct,
      rawScore: structScore,
      weightedScore: structScore * this.weights.w_struct,
      reason: `Matches dataset structure (${top})`,
    });

    let taskScore = 0.5;
    for (const req of reqs.requiredStructures) {
      if (req.type === 'cluster-separation' && candidate.preserves.includes('cluster-separation')) taskScore += 0.25 * req.importance;
      if (req.type === 'temporal-order' && candidate.preserves.includes('chronological-order')) taskScore += 0.3 * req.importance;
      if (req.type === 'hierarchy' && candidate.preserves.includes('hierarchical-parent-child')) taskScore += 0.3 * req.importance;
      if (req.type === 'anomaly-visibility' && candidate.preserves.includes('outlier-boundary-visibility')) taskScore += 0.25 * req.importance;
      if (req.type === 'observation-identity' && candidate.preserves.includes('individual-observation-identity')) taskScore += 0.25 * req.importance;
    }
    taskScore = Math.min(1.0, taskScore);

    components.push({
      component: 'task_alignment',
      weight: this.weights.w_task,
      rawScore: taskScore,
      weightedScore: taskScore * this.weights.w_task,
      reason: `Aligned with task: ${reqs.task}`,
    });

    const N = signature.cardinality.rowCount;
    let scaleScore = candidate.scaleCharacteristics.scalabilityRating;
    if (N >= candidate.scaleCharacteristics.optimalN[0] && N <= candidate.scaleCharacteristics.optimalN[1]) {
      scaleScore = 1.0;
    } else if (N > candidate.scaleCharacteristics.maxN) {
      scaleScore = 0.2;
    }

    components.push({
      component: 'scale_suitability',
      weight: this.weights.w_scale,
      rawScore: scaleScore,
      weightedScore: scaleScore * this.weights.w_scale,
      reason: `Dataset size N=${N} evaluated against candidate optimal range`,
    });

    let lossPenalty = 0.0;
    for (const goal of reqs.preservationGoals) {
      if (goal.priority === 'CRITICAL' && candidate.loses.includes(goal.information)) {
        lossPenalty += 0.4;
      } else if (goal.priority === 'DESIRED' && candidate.loses.includes(goal.information)) {
        lossPenalty += 0.2;
      }
    }
    const lossScore = Math.max(0.0, 1.0 - lossPenalty);

    components.push({
      component: 'information_preservation',
      weight: this.weights.w_loss,
      rawScore: lossScore,
      weightedScore: lossScore * this.weights.w_loss,
      reason: `Preserves critical task information`,
    });

    let priorScore = 0.5;
    if (signature.preferredFamilies?.includes(family)) {
      priorScore = 1.0;
    }

    components.push({
      component: 'empirical_prior',
      weight: this.weights.w_prior,
      rawScore: priorScore,
      weightedScore: priorScore * this.weights.w_prior,
      reason: 'User preference and empirical utility prior',
    });

    const totalScore = components.reduce((sum, c) => sum + c.weightedScore, 0);

    return {
      family,
      candidateId: candidate.id,
      layout,
      score: totalScore,
      components,
      preserves: candidate.preserves,
      loses: candidate.loses,
    };
  }
}

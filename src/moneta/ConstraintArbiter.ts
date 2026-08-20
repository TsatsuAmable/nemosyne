/**
 * ConstraintArbiter — Pure, deterministic representation arbiter for Moneta.
 */

import {
  type RepresentationRequirements,
} from './representation/RepresentationRequirements.ts';
import type { SpatialStrategy, StrategyRejectionEntry, WorldType } from './SpatialStrategy.ts';
import type { MonetaFacts, VRLayout, VRGeometry, VRBehavior, VRInteraction } from './types.ts';
import type { EncodingMapping } from '../data/types.ts';
import { fnv1aHex } from '../atlas/DatasetSpace.ts';

export interface ArbiterOptions {
  datasetFingerprint?: string;
  engineVersion?: string;
  now?: number;
}

interface CandidateEvaluation {
  id: string;
  worldType: WorldType;
  layout: VRLayout;
  geometry: VRGeometry;
  behavior: VRBehavior;
  interaction: VRInteraction;
  score: number;
  hardPassed: boolean;
  rejectionReason?: string;
  rationale: string;
}

export class ConstraintArbiter {
  private static readonly VERSION = '1.0.0';

  static arbitrate(
    facts: MonetaFacts,
    requirementsInput: RepresentationRequirements,
    options: ArbiterOptions = {}
  ): SpatialStrategy {
    const requirements = requirementsInput;
    const now = options.now ?? Date.now();
    const datasetFingerprint = options.datasetFingerprint ?? 'unknown-fp';
    const requirementsHash = fnv1aHex(JSON.stringify(requirements));

    const candidates: CandidateEvaluation[] = [
      ConstraintArbiter._evaluateTemporalRibbon(facts, requirements),
      ConstraintArbiter._evaluateHierarchicalRadial(facts, requirements),
      ConstraintArbiter._evaluateForceDirectedGraph(facts, requirements),
      ConstraintArbiter._evaluateGeoSurface(facts, requirements),
      ConstraintArbiter._evaluateGridMatrix(facts, requirements),
      ConstraintArbiter._evaluateInstancedClusterCloud(facts, requirements),
    ];

    candidates.sort((a, b) => {
      if (a.hardPassed !== b.hardPassed) {
        return a.hardPassed ? -1 : 1;
      }
      return b.score - a.score;
    });

    const winner = candidates[0];
    const rejectionLog: StrategyRejectionEntry[] = candidates.slice(1).map((c) => ({
      strategyId: c.id,
      layout: c.layout,
      geometry: c.geometry,
      score: c.score,
      reason: c.rejectionReason ?? `Suboptimal utility score (${c.score.toFixed(3)} vs winner ${winner.score.toFixed(3)})`,
    }));

    const positionSemantics =
      winner.layout === 'GEO_SURFACE'
        ? 'SEMANTIC'
        : winner.layout === 'FORCE_DIRECTED_3D' || winner.layout === 'RADIAL_ORBITAL'
        ? 'STRUCTURAL'
        : 'ALGORITHMIC_LAYOUT';

    const detailLens =
      requirements.task === 'temporal-trend'
        ? 'TIME_DIAL'
        : requirements.task === 'identify-outliers'
        ? 'OUTLIER_HALO'
        : requirements.task === 'compare-clusters'
        ? 'CLUSTER_ZONE'
        : 'INSPECTOR_SLATE';

    const mappings: EncodingMapping = {
      color: facts.categoricalColumns > 0 ? 'category' : undefined,
      size: facts.numericColumns > 0 ? 'metric_x' : undefined,
      pulse: facts.numericColumns > 1 ? 'metric_y' : undefined,
      time: facts.temporalColumns > 0 ? 'timestamp' : undefined,
    };

    return {
      id: `strat:${winner.id}_${requirementsHash.slice(0, 8)}`,
      worldType: winner.worldType,
      macroLayout: {
        layout: winner.layout,
        parameters: {
          spacing: 1.2,
          radius: 3.5,
        },
        positionSemantics,
      },
      datumEncoding: {
        geometry: winner.geometry,
        mappings,
        behavior: winner.behavior,
      },
      interactionStrategy: {
        primaryInteraction: winner.interaction,
        supportedGestures: ['pinch-select', 'ray-inspect', 'wrist-menu-toggle'],
        detailLens,
      },
      score: winner.score,
      confidence: Math.min(1.0, winner.score / 100),
      rationale: winner.rationale,
      rejectionLog,
      provenance: {
        generatedAt: now,
        engine: 'MonetaConstraintArbiter',
        version: ConstraintArbiter.VERSION,
        datasetFingerprint,
        requirementsHash,
      },
    };
  }

  private static _evaluateTemporalRibbon(
    facts: MonetaFacts,
    req: RepresentationRequirements
  ): CandidateEvaluation {
    const isTemporal = facts.topology === 'TIME_SERIES' || facts.hasTimeSeries;
    let score = 0;
    if (isTemporal) score += 60;
    if (req.task === 'temporal-trend') score += 30;
    if (facts.seasonalityHint) score += 10;

    return {
      id: 'temporal_ribbon_pulse',
      worldType: 'ANALYST_COCKPIT',
      layout: 'TIME_RIBBON',
      geometry: 'BEAM',
      behavior: 'PULSE_QUANTITATIVE',
      interaction: req.task === 'temporal-trend' ? 'CHRONO_DIAL' : 'HARVEST_STREAM',
      score,
      hardPassed: isTemporal || req.task === 'temporal-trend',
      rejectionReason: !isTemporal ? 'Dataset lacks temporal columns and timestamp ordering' : undefined,
      rationale: 'Time ribbon layout preserving chronological trajectories and seasonality trends.',
    };
  }

  private static _evaluateHierarchicalRadial(
    facts: MonetaFacts,
    req: RepresentationRequirements
  ): CandidateEvaluation {
    const isHierarchy = facts.topology === 'HIERARCHY';
    let score = 0;
    if (isHierarchy) score += 60;
    if (facts.depth > 2) score += 20;
    if (req.task === 'trace-lineage') score += 25;

    return {
      id: 'hierarchical_radial_orbital',
      worldType: 'FOCUSED_CHAMBER',
      layout: 'RADIAL_ORBITAL',
      geometry: 'CONICAL_TREE',
      behavior: 'ORBITAL_SPIN',
      interaction: 'DRILL_DOWN',
      score,
      hardPassed: isHierarchy,
      rejectionReason: !isHierarchy ? 'Dataset lacks hierarchical tree relationships' : undefined,
      rationale: 'Concentric radial orbital space structuring parent-child lineage depth.',
    };
  }

  private static _evaluateForceDirectedGraph(
    facts: MonetaFacts,
    req: RepresentationRequirements
  ): CandidateEvaluation {
    const isGraph = facts.topology === 'GRAPH' || facts.edgeCount > 0;
    let score = 0;
    if (isGraph) score += 60;
    if (facts.density > 0.05) score += 20;
    if (req.task === 'explore') score += 15;

    return {
      id: 'force_directed_network',
      worldType: 'MEMORY_PALACE',
      layout: 'FORCE_DIRECTED_3D',
      geometry: 'ICOSA_NODE',
      behavior: 'STATIC',
      interaction: 'TRAVERSE_EDGE',
      score,
      hardPassed: isGraph,
      rejectionReason: !isGraph ? 'Dataset lacks relational graph edges' : undefined,
      rationale: 'Force-directed spring relaxation exposing relational topological connectivity.',
    };
  }

  private static _evaluateGeoSurface(
    facts: MonetaFacts,
    _req: RepresentationRequirements
  ): CandidateEvaluation {
    const isGeo = facts.topology === 'GEO';
    let score = 0;
    if (isGeo) score += 70;

    return {
      id: 'geo_surface_columns',
      worldType: 'MEMORY_PALACE',
      layout: 'GEO_SURFACE',
      geometry: 'GEO_COLUMN',
      behavior: 'STATIC',
      interaction: 'INSPECT_CELL',
      score,
      hardPassed: isGeo,
      rejectionReason: !isGeo ? 'Dataset lacks spatial coordinates / geospatial coordinates' : undefined,
      rationale: 'Geographic coordinate projection mapping terrain coordinates.',
    };
  }

  private static _evaluateGridMatrix(
    facts: MonetaFacts,
    _req: RepresentationRequirements
  ): CandidateEvaluation {
    const isTabular = facts.topology === 'TABULAR';
    let score = 30;
    if (isTabular) score += 30;
    if (!facts.isLargeDataset) score += 15;

    return {
      id: 'grid_matrix_cubes',
      worldType: 'ANALYST_COCKPIT',
      layout: 'GRID_3D',
      geometry: 'CUBE_MATRIX',
      behavior: 'STATIC',
      interaction: 'INSPECT_CELL',
      score,
      hardPassed: !facts.isLargeDataset,
      rejectionReason: facts.isLargeDataset ? 'Grid matrix cube geometry exceeds memory budget for large datasets' : undefined,
      rationale: 'Uniform Cartesian grid for structured multi-dimensional tabular inspection.',
    };
  }

  private static _evaluateInstancedClusterCloud(
    facts: MonetaFacts,
    req: RepresentationRequirements
  ): CandidateEvaluation {
    let score = 40;
    if (facts.isLargeDataset) score += 40;
    if (req.task === 'compare-clusters' || req.task === 'identify-outliers') score += 20;

    return {
      id: 'instanced_cluster_cloud',
      worldType: 'ANALYST_COCKPIT',
      layout: 'GRID_3D',
      geometry: 'INSTANCED_POINT_CLOUD',
      behavior: 'STATIC',
      interaction: 'CLUSTER_PROBE',
      score,
      hardPassed: true,
      rationale: 'High-performance GPU instanced point cloud preserving discrete observation clusters at scale.',
    };
  }
}

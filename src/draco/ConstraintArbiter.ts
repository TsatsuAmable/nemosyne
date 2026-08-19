/**
 * ConstraintArbiter — Pure, deterministic representation arbiter for Draco.
 *
 * Evaluates candidate visual and spatial strategies against extracted dataset facts
 * and formal RepresentationRequirements. Produces an optimal, explainable SpatialStrategy
 * with a machine-readable rejection log.
 */

import * as v from 'valibot';
import {
  RepresentationRequirementsSchema,
  type RepresentationRequirements,
} from './RepresentationRequirements.ts';
import type { SpatialStrategy, StrategyRejectionEntry, WorldType } from './SpatialStrategy.ts';
import type { DracoFacts, VRLayout, VRGeometry, VRBehavior, VRInteraction } from './types.ts';
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

  /**
   * Pure deterministic arbitration function.
   * (DracoFacts, RepresentationRequirements) -> SpatialStrategy
   */
  static arbitrate(
    facts: DracoFacts,
    requirementsInput: RepresentationRequirements,
    options: ArbiterOptions = {}
  ): SpatialStrategy {
    // 1. Validate requirements schema
    const requirements = v.parse(RepresentationRequirementsSchema, requirementsInput);
    const now = options.now ?? Date.now();
    const datasetFingerprint = options.datasetFingerprint ?? 'unknown-fp';
    const requirementsHash = fnv1aHex(JSON.stringify(requirements));

    // 2. Enumerate standard candidate strategy templates
    const candidates: CandidateEvaluation[] = [
      ConstraintArbiter._evaluateTemporalRibbon(facts, requirements),
      ConstraintArbiter._evaluateHierarchicalRadial(facts, requirements),
      ConstraintArbiter._evaluateForceDirectedGraph(facts, requirements),
      ConstraintArbiter._evaluateGeoSurface(facts, requirements),
      ConstraintArbiter._evaluateGridMatrix(facts, requirements),
      ConstraintArbiter._evaluateInstancedClusterCloud(facts, requirements),
    ];

    // 3. Sort candidates: hardPassed first, then descending by score
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

    // Derive position semantics
    const positionSemantics =
      winner.layout === 'GEO_SURFACE'
        ? 'SEMANTIC'
        : winner.layout === 'FORCE_DIRECTED_3D' || winner.layout === 'RADIAL_ORBITAL'
        ? 'STRUCTURAL'
        : 'ALGORITHMIC_LAYOUT';

    // Derive detail lens
    const detailLens =
      requirements.task === 'temporal-trend'
        ? 'TIME_DIAL'
        : requirements.task === 'identify-outliers'
        ? 'OUTLIER_HALO'
        : requirements.task === 'compare-clusters'
        ? 'CLUSTER_ZONE'
        : 'INSPECTOR_SLATE';

    const defaultMappings: EncodingMapping = {
      color: requirements.secondaryMeasures?.[0],
      size: requirements.secondaryMeasures?.[1],
      time: requirements.task === 'temporal-trend' ? requirements.primaryDimensions[0] : undefined,
      label: requirements.primaryDimensions[0],
    };

    return {
      id: `strat:${winner.id}:${requirementsHash.slice(0, 8)}`,
      worldType: requirements.preferredWorldType ?? winner.worldType,
      macroLayout: {
        layout: winner.layout,
        parameters: {
          density: facts.density,
          nodeCount: facts.nodeCount,
          dimensionCount: requirements.primaryDimensions.length,
        },
        positionSemantics,
      },
      datumEncoding: {
        geometry: winner.geometry,
        mappings: defaultMappings,
        behavior: winner.behavior,
      },
      interactionStrategy: {
        primaryInteraction: winner.interaction,
        supportedGestures: ['pinchTogether', 'pinchApart', 'rotateCW', 'rotateCCW', 'sliceUp'],
        detailLens,
      },
      score: winner.score,
      confidence: winner.score >= 0.8 ? 0.95 : winner.score >= 0.6 ? 0.8 : 0.6,
      rationale: winner.rationale,
      rejectionLog,
      provenance: {
        generatedAt: now,
        engine: 'ConstraintArbiter',
        version: options.engineVersion ?? ConstraintArbiter.VERSION,
        datasetFingerprint,
        requirementsHash,
      },
    };
  }

  private static _evaluateTemporalRibbon(facts: DracoFacts, req: RepresentationRequirements): CandidateEvaluation {
    const isTemporal = facts.hasTimeSeries || req.task === 'temporal-trend' || req.preservationGoal === 'temporal-ordering';
    if (!isTemporal) {
      return {
        id: 'temporal-ribbon',
        worldType: 'MEMORY_PALACE',
        layout: 'TIME_RIBBON',
        geometry: 'FLOW_RAY',
        behavior: 'WAVE_OSCILLATION',
        interaction: 'CHRONO_DIAL',
        score: 0.2,
        hardPassed: false,
        rejectionReason: 'Dataset lacks temporal columns and task does not require temporal ordering',
        rationale: 'Time Ribbon layout requires temporal series progression.',
      };
    }

    const score = req.task === 'temporal-trend' ? 0.95 : 0.85;
    return {
      id: 'temporal-ribbon',
      worldType: 'MEMORY_PALACE',
      layout: 'TIME_RIBBON',
      geometry: facts.nodeCount > 5000 ? 'INSTANCED_POINT_CLOUD' : 'FLOW_RAY',
      behavior: 'WAVE_OSCILLATION',
      interaction: 'CHRONO_DIAL',
      score,
      hardPassed: true,
      rationale: 'Time ribbon layout optimally preserves chronological sequence along the central palace corridor.',
    };
  }

  private static _evaluateHierarchicalRadial(facts: DracoFacts, req: RepresentationRequirements): CandidateEvaluation {
    const isHierarchy = facts.topology === 'HIERARCHY' || facts.depth > 1 || req.preservationGoal === 'hierarchy-depth';
    if (!isHierarchy) {
      return {
        id: 'hierarchical-radial',
        worldType: 'MEMORY_PALACE',
        layout: 'RADIAL_ORBITAL',
        geometry: 'CONICAL_TREE',
        behavior: 'ORBITAL_SPIN',
        interaction: 'DRILL_DOWN',
        score: 0.25,
        hardPassed: false,
        rejectionReason: 'Dataset topology is not hierarchical (depth <= 1)',
        rationale: 'Radial orbital layout requires parent-child tree hierarchy.',
      };
    }

    const score = req.task === 'trace-lineage' ? 0.92 : 0.82;
    return {
      id: 'hierarchical-radial',
      worldType: 'MEMORY_PALACE',
      layout: 'RADIAL_ORBITAL',
      geometry: 'CONICAL_TREE',
      behavior: 'ORBITAL_SPIN',
      interaction: 'DRILL_DOWN',
      score,
      hardPassed: true,
      rationale: 'Conical radial tree layout naturally visualizes branch lineages and hierarchical depth.',
    };
  }

  private static _evaluateForceDirectedGraph(facts: DracoFacts, req: RepresentationRequirements): CandidateEvaluation {
    const isGraphOrClustered = facts.topology === 'GRAPH' || facts.edgeCount > 0 || req.task === 'compare-clusters';
    if (facts.nodeCount > 20000 && !req.hardwareConstraints?.preferInstanced) {
      return {
        id: 'force-directed-graph',
        worldType: 'ANALYST_COCKPIT',
        layout: 'FORCE_DIRECTED_3D',
        geometry: 'ICOSA_NODE',
        behavior: 'PULSE_QUANTITATIVE',
        interaction: 'TRAVERSE_EDGE',
        score: 0.35,
        hardPassed: false,
        rejectionReason: 'Node count exceeds non-instanced force graph frame budget',
        rationale: 'Large node counts require instanced GPU layouts.',
      };
    }

    const score = isGraphOrClustered ? (req.task === 'compare-clusters' ? 0.88 : 0.9) : 0.65;
    return {
      id: 'force-directed-graph',
      worldType: 'ANALYST_COCKPIT',
      layout: 'FORCE_DIRECTED_3D',
      geometry: facts.nodeCount > 5000 ? 'INSTANCED_POINT_CLOUD' : 'ICOSA_NODE',
      behavior: 'PULSE_QUANTITATIVE',
      interaction: 'TRAVERSE_EDGE',
      score,
      hardPassed: true,
      rationale: '3D force-directed layout clusters highly connected topological neighborhoods in perceptual space.',
    };
  }

  private static _evaluateGeoSurface(facts: DracoFacts, req: RepresentationRequirements): CandidateEvaluation {
    const isGeospatial = facts.topology === 'GEO' || req.task === 'spatial-proximity';
    if (!isGeospatial) {
      return {
        id: 'geo-surface',
        worldType: 'MEMORY_PALACE',
        layout: 'GEO_SURFACE',
        geometry: 'GEO_COLUMN',
        behavior: 'STATIC',
        interaction: 'INSPECT_CELL',
        score: 0.15,
        hardPassed: false,
        rejectionReason: 'Dataset lacks spatial coordinates (latitude/longitude)',
        rationale: 'Geospatial surface requires spatial coordinates.',
      };
    }

    return {
      id: 'geo-surface',
      worldType: 'MEMORY_PALACE',
      layout: 'GEO_SURFACE',
      geometry: 'GEO_COLUMN',
      behavior: 'STATIC',
      interaction: 'INSPECT_CELL',
      score: 0.94,
      hardPassed: true,
      rationale: 'Geospatial projection anchors data points to semantic terrain landmarks.',
    };
  }

  private static _evaluateGridMatrix(facts: DracoFacts, req: RepresentationRequirements): CandidateEvaluation {
    if (facts.nodeCount > 5000) {
      return {
        id: 'grid-matrix',
        worldType: 'ANALYST_COCKPIT',
        layout: 'GRID_3D',
        geometry: 'CUBE_MATRIX',
        behavior: 'STATIC',
        interaction: 'INSPECT_CELL',
        score: 0.4,
        hardPassed: false,
        rejectionReason: 'Dense tabular grid exceeds legible cell matrix capacity for >5,000 rows',
        rationale: 'Cube matrix grid is suboptimal for large scale distributions.',
      };
    }

    const score = req.task === 'identify-outliers' ? 0.75 : 0.7;
    return {
      id: 'grid-matrix',
      worldType: 'ANALYST_COCKPIT',
      layout: 'GRID_3D',
      geometry: 'CUBE_MATRIX',
      behavior: 'STATIC',
      interaction: 'INSPECT_CELL',
      score,
      hardPassed: true,
      rationale: 'Orthogonal 3D matrix provides uniform spatial indexing for structured tabular discovery.',
    };
  }

  private static _evaluateInstancedClusterCloud(_facts: DracoFacts, req: RepresentationRequirements): CandidateEvaluation {
    // Default high-performance cloud for large or general exploratory datasets
    const score =
      req.task === 'explore' || req.task === 'compare-clusters' || req.task === 'identify-outliers'
        ? 0.86
        : 0.72;

    return {
      id: 'instanced-cluster-cloud',
      worldType: 'MEMORY_PALACE',
      layout: 'FORCE_DIRECTED_3D',
      geometry: 'INSTANCED_POINT_CLOUD',
      behavior: 'PULSE_QUANTITATIVE',
      interaction: 'CLUSTER_PROBE',
      score,
      hardPassed: true,
      rationale: 'GPU instanced point cloud guarantees 90 FPS rendering on Quest 3S with cluster probe interaction.',
    };
  }
}

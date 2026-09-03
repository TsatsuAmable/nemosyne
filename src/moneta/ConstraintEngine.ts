/**
 * Moneta Constraint Engine.
 *
 * Symbolic, explainable recommender that evaluates layout/geometry/behavior/interaction
 * specifications from authoritative data facts and user-tunable soft weights.
 *
 * Analytical authority boundary: this module never derives facts from raw rows.
 * Raw-row callers must supply a FactProvider backed by the governed evidence
 * path, or provide already-computed MonetaFacts directly.
 */

import type {
  MonetaDataInput,
  MonetaFacts,
  MonetaSpec,
  FactProvider,
  HardConstraint,
  SoftConstraint,
  SolverResult,
  VRLayout,
  VRGeometry,
  VRBehavior,
  VRInteraction,
} from './types.ts';

import { TopologyTypes, type TopologyType } from '../types/topology.ts';
export { TopologyTypes, type TopologyType };

export const VRChannels = {
  LAYOUT: [
    'GRID_3D',
    'FORCE_DIRECTED_3D',
    'RADIAL_ORBITAL',
    'VECTOR_STREAMLINE',
    'TIME_RIBBON',
    'GEO_SURFACE',
    'SPECTRAL_VOLUME',
  ] as VRLayout[],
  GEOMETRY: [
    'CUBE_MATRIX',
    'ICOSA_NODE',
    'CONICAL_TREE',
    'FLOW_RAY',
    'GEO_COLUMN',
    'CLUSTER_VOLUME',
    'INSTANCED_POINT_CLOUD',
    'AGGREGATE_BARS',
    'ORB',
    'COLUMN',
    'BEAM',
    'SPECTRAL_BAR',
    'SPECTRAL_SURFACE',
  ] as VRGeometry[],
  BEHAVIOR: ['PULSE_QUANTITATIVE', 'ORBITAL_SPIN', 'WAVE_OSCILLATION', 'STATIC'] as VRBehavior[],
  INTERACTION: [
    'INSPECT_CELL',
    'TRAVERSE_EDGE',
    'DRILL_DOWN',
    'HARVEST_STREAM',
    'CLUSTER_PROBE',
    'FILTER_BRUSH',
    'RESONANCE_PULSE',
    'FORK_PLANE',
    'CHRONO_DIAL',
    'CONSTELLATION',
    'BEACON',
    'ALEPH',
    'FREQUENCY_PROBE',
  ] as VRInteraction[],
};

export interface NoFeasibleConstraintResult {
  readonly kind: 'NIL';
  readonly reason: 'NO_FEASIBLE_CANDIDATE';
  readonly spec: null;
  readonly facts: MonetaFacts;
  readonly cost: null;
}

export type ConstraintSolveResult = SolverResult | NoFeasibleConstraintResult;

export function isNoFeasibleConstraintResult(
  result: ConstraintSolveResult
): result is NoFeasibleConstraintResult {
  return 'kind' in result && result.kind === 'NIL';
}

export interface ConstraintEngineOptions {
  largeRowThreshold?: number;
  highCardinalityThreshold?: number;
  outlierIqrMultiplier?: number;
  factProvider?: FactProvider | null;
}

export class ConstraintEngine {
  largeRowThreshold: number;
  highCardinalityThreshold: number;
  outlierIqrMultiplier: number;
  hardConstraints: HardConstraint[];
  softConstraints: SoftConstraint[];
  factProvider: FactProvider | null;

  constructor({
    largeRowThreshold = 500,
    highCardinalityThreshold = 12,
    outlierIqrMultiplier = 1.5,
    factProvider = null,
  }: ConstraintEngineOptions = {}) {
    this.largeRowThreshold = largeRowThreshold;
    this.highCardinalityThreshold = highCardinalityThreshold;
    this.outlierIqrMultiplier = outlierIqrMultiplier;
    this.factProvider = factProvider;
    this.hardConstraints = [];
    this.softConstraints = [];
    this.registerDefaultRules();
  }

  registerDefaultRules(): void {
    // Hard constraints eliminate invalid physical/spatial bindings.
    this.hardConstraints.push((facts, spec) => {
      if (facts.topology === TopologyTypes.GRAPH && spec.layout === 'GRID_3D') return false;
      return true;
    });
    this.hardConstraints.push((facts, spec) => {
      if (facts.topology === TopologyTypes.HIERARCHY && spec.layout === 'VECTOR_STREAMLINE')
        return false;
      return true;
    });
    this.hardConstraints.push((facts, spec) => {
      if (facts.topology === TopologyTypes.VECTOR_FIELD && spec.layout !== 'VECTOR_STREAMLINE')
        return false;
      return true;
    });
    this.hardConstraints.push((facts, spec) => {
      if (facts.topology === TopologyTypes.TIME_SERIES && spec.layout !== 'TIME_RIBBON')
        return false;
      return true;
    });
    this.hardConstraints.push((facts, spec) => {
      if (facts.topology === TopologyTypes.GEO && spec.layout !== 'GEO_SURFACE') return false;
      return true;
    });
    this.hardConstraints.push((facts, spec) => {
      if (facts.isLargeDataset) {
        const scalableGeometries: VRGeometry[] = [
          'CLUSTER_VOLUME',
          'INSTANCED_POINT_CLOUD',
          'AGGREGATE_BARS',
        ];
        if (!scalableGeometries.includes(spec.geometry)) return false;
      }
      return true;
    });

    // Soft constraints express weighted preferences.
    this.softConstraints.push({
      name: 'prefer_pulse_for_timeseries',
      weight: 10,
      eval: (facts, spec) =>
        facts.hasTimeSeries && spec.behavior !== 'PULSE_QUANTITATIVE' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_radial_for_deep_hierarchy',
      weight: 15,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.HIERARCHY &&
        facts.depth > 2 &&
        spec.layout !== 'RADIAL_ORBITAL'
          ? 1
          : 0,
    });
    this.softConstraints.push({
      name: 'prefer_grid_for_tabular',
      weight: 8,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.TABULAR && spec.layout !== 'GRID_3D' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'match_interaction_to_topology',
      weight: 12,
      eval: (facts, spec) => {
        if (facts.topology === TopologyTypes.HIERARCHY && spec.interaction !== 'DRILL_DOWN')
          return 1;
        if (facts.topology === TopologyTypes.GRAPH && spec.interaction !== 'TRAVERSE_EDGE')
          return 1;
        if (
          (facts.topology === TopologyTypes.TABULAR || facts.topology === TopologyTypes.GEO) &&
          spec.interaction !== 'INSPECT_CELL'
        )
          return 1;
        if (
          (facts.topology === TopologyTypes.VECTOR_FIELD ||
            facts.topology === TopologyTypes.TIME_SERIES) &&
          spec.interaction !== 'HARVEST_STREAM'
        )
          return 1;
        return 0;
      },
    });
    this.softConstraints.push({
      name: 'prefer_force_directed_for_graphs',
      weight: 14,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.GRAPH && spec.layout !== 'FORCE_DIRECTED_3D' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_streamline_for_vectors',
      weight: 14,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.VECTOR_FIELD && spec.layout !== 'VECTOR_STREAMLINE'
          ? 1
          : 0,
    });
    this.softConstraints.push({
      name: 'prefer_geo_surface_for_geo',
      weight: 14,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.GEO && spec.layout !== 'GEO_SURFACE' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_icosa_node_for_graphs',
      weight: 12,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.GRAPH && spec.geometry !== 'ICOSA_NODE' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_conical_tree_for_hierarchy',
      weight: 12,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.HIERARCHY && spec.geometry !== 'CONICAL_TREE' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_flow_ray_for_vectors',
      weight: 12,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.VECTOR_FIELD && spec.geometry !== 'FLOW_RAY' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_cube_matrix_for_tabular',
      weight: 11,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.TABULAR &&
        !facts.isLargeDataset &&
        !facts.hasOutliers &&
        spec.geometry !== 'CUBE_MATRIX'
          ? 1
          : 0,
    });
    this.softConstraints.push({
      name: 'prefer_orb_for_outliers',
      weight: 20,
      eval: (facts, spec) => (facts.hasOutliers && spec.geometry !== 'ORB' ? 1 : 0),
    });
    this.softConstraints.push({
      name: 'prefer_geo_column_geometry',
      weight: 14,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.GEO && spec.geometry !== 'GEO_COLUMN' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_motion_for_continuous_data',
      weight: 6,
      eval: (facts, spec) => (facts.hasContinuousValues && spec.behavior === 'STATIC' ? 1 : 0),
    });

    // Scale-aware soft constraints.
    this.softConstraints.push({
      name: 'prefer_instanced_for_large_tabular',
      weight: 25,
      eval: (facts, spec) => {
        if (!facts.isLargeDataset || facts.topology !== TopologyTypes.TABULAR) return 0;
        return spec.geometry !== 'INSTANCED_POINT_CLOUD' ? 1 : 0;
      },
    });
    this.softConstraints.push({
      name: 'prefer_aggregate_for_large_geo_or_time',
      weight: 25,
      eval: (facts, spec) => {
        if (!facts.isLargeDataset) return 0;
        if (facts.topology !== TopologyTypes.GEO && facts.topology !== TopologyTypes.TIME_SERIES)
          return 0;
        return spec.geometry !== 'AGGREGATE_BARS' ? 1 : 0;
      },
    });
    this.softConstraints.push({
      name: 'prefer_cluster_volume_for_high_cardinality',
      weight: 15,
      eval: (facts, spec) => {
        if (!facts.hasHighCardinality) return 0;
        return spec.geometry !== 'CLUSTER_VOLUME' ? 1 : 0;
      },
    });
    this.softConstraints.push({
      name: 'prefer_cluster_probe_for_large_datasets',
      weight: 25,
      eval: (facts, spec) => {
        if (!facts.isLargeDataset) return 0;
        return spec.interaction !== 'CLUSTER_PROBE' ? 1 : 0;
      },
    });
    this.softConstraints.push({
      name: 'prefer_spectral_volume_for_frequency',
      weight: 20,
      eval: (facts, spec) => {
        if (
          facts.seasonalityHint &&
          spec.layout !== 'SPECTRAL_VOLUME' &&
          spec.layout !== 'TIME_RIBBON'
        ) {
          return 1;
        }
        return 0;
      },
    });
    this.softConstraints.push({
      name: 'prefer_beam_for_correlations',
      weight: 12,
      eval: (facts, spec) =>
        (Object.keys(facts.correlationMatrix || {}).length > 0 ||
          (facts as unknown as { hasCorrelation?: boolean }).hasCorrelation) &&
        spec.geometry !== 'BEAM'
          ? 1
          : 0,
    });

    // Metaphor interaction soft constraints (default weight 0; activated via weight tuning).
    this.softConstraints.push({
      name: 'prefer_resonance_for_graphs',
      weight: 0,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.GRAPH && spec.interaction !== 'RESONANCE_PULSE' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_fork_for_tabular',
      weight: 0,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.TABULAR && spec.interaction !== 'FORK_PLANE' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_fork_plane_for_tabular',
      weight: 0,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.TABULAR && spec.interaction !== 'FORK_PLANE' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_chrono_for_time',
      weight: 0,
      eval: (facts, spec) =>
        facts.hasTimeSeries && spec.interaction !== 'CHRONO_DIAL' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_constellation_for_hierarchy',
      weight: 0,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.HIERARCHY && spec.interaction !== 'CONSTELLATION' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_beacon_for_geo',
      weight: 0,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.GEO && spec.interaction !== 'BEACON' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_aleph_for_vectors',
      weight: 0,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.VECTOR_FIELD && spec.interaction !== 'ALEPH' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_frequency_probe_for_spectral',
      weight: 0,
      eval: (facts, spec) =>
        facts.seasonalityHint && spec.interaction !== 'FREQUENCY_PROBE' ? 1 : 0,
    });
  }

  adjustWeight(name: string, delta: number): void {
    const current = this.getWeight(name) ?? 0;
    this.setWeight(name, Math.max(0, current + delta));
  }

  evaluateCandidate(
    arg1: MonetaFacts | MonetaSpec,
    arg2?: MonetaSpec | MonetaFacts
  ): {
    isValid: boolean;
    valid: boolean;
    cost: number;
    softConstraintViolations: string[];
    violations: string[];
  } {
    let facts: MonetaFacts;
    let spec: MonetaSpec;
    if (arg1 && 'layout' in (arg1 as Record<string, unknown>)) {
      spec = arg1 as MonetaSpec;
      facts = (arg2 as MonetaFacts) ?? ({} as MonetaFacts);
    } else {
      facts = (arg1 as MonetaFacts) ?? ({} as MonetaFacts);
      spec = (arg2 as MonetaSpec) ?? ({} as MonetaSpec);
    }

    const valid = this.hardConstraints.every((fn) => fn(facts, spec));
    let cost = 0;
    const violations: string[] = [];
    for (const soft of this.softConstraints) {
      const penalty = soft.eval(facts, spec);
      if (penalty > 0) {
        cost += penalty * soft.weight;
        violations.push(soft.name);
      }
    }
    return {
      isValid: valid,
      valid,
      cost,
      softConstraintViolations: violations,
      violations,
    };
  }

  setWeight(name: string, weight: number): void {
    const constraint = this.softConstraints.find((c) => c.name === name);
    if (constraint) {
      constraint.weight = Math.max(0, weight);
    }
  }

  getWeight(name: string): number | undefined {
    return this.softConstraints.find((c) => c.name === name)?.weight;
  }

  /**
   * Compatibility seam for callers that still hold MonetaDataInput. This method
   * is evidence-only: it delegates to the injected authoritative FactProvider
   * and never inspects rows, columns, edges or encodings in JavaScript.
   */
  extractFacts(input: MonetaDataInput): MonetaFacts {
    const facts = this.factProvider?.facts(input) ?? null;
    if (!facts) {
      throw new Error(
        'ConstraintEngine.extractFacts: authoritative facts unavailable; raw-row analytical fallback is forbidden'
      );
    }
    return facts;
  }

  solve(input: MonetaDataInput | MonetaFacts): ConstraintSolveResult {
    const facts: MonetaFacts =
      'rowCount' in input ? (input as MonetaFacts) : this.extractFacts(input as MonetaDataInput);

    let bestSpec: MonetaSpec | null = null;
    let minCost = Infinity;

    for (const layout of VRChannels.LAYOUT) {
      for (const geometry of VRChannels.GEOMETRY) {
        for (const behavior of VRChannels.BEHAVIOR) {
          for (const interaction of VRChannels.INTERACTION) {
            const spec: MonetaSpec = { layout, geometry, behavior, interaction };

            const satisfiesHard = this.hardConstraints.every((fn) => fn(facts, spec));
            if (!satisfiesHard) continue;

            let cost = 0;
            for (const soft of this.softConstraints) {
              const penalty = soft.eval(facts, spec);
              cost += penalty * soft.weight;
            }

            if (cost < minCost) {
              minCost = cost;
              bestSpec = spec;
            }
          }
        }
      }
    }

    if (!bestSpec) {
      return {
        kind: 'NIL',
        reason: 'NO_FEASIBLE_CANDIDATE',
        spec: null,
        facts,
        cost: null,
      };
    }

    return {
      spec: bestSpec,
      facts,
      cost: minCost,
    };
  }
}

/**
 * Draco-style constraint engine.
 * Symbolic, explainable recommender that picks a layout/geometry/behavior/interaction
 * specification from data facts and user-tunable soft weights.
 */

import type {
  DracoDataInput,
  DracoFacts,
  DracoSpec,
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
  ] as VRInteraction[],
};

export interface ConstraintEngineOptions {
  largeRowThreshold?: number;
  highCardinalityThreshold?: number;
  outlierIqrMultiplier?: number;
  /** Wave 5: facts provider used when `solve` is called without explicit facts. */
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
        const scalableGeometries: VRGeometry[] = ['CLUSTER_VOLUME', 'INSTANCED_POINT_CLOUD', 'AGGREGATE_BARS'];
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
        facts.topology === TopologyTypes.TABULAR && !facts.isLargeDataset && spec.geometry !== 'CUBE_MATRIX' ? 1 : 0,
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

    // Scale-aware soft constraints (Phase 7).
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
      weight: 18,
      eval: (facts, spec) => {
        if (!facts.hasHighCardinality) return 0;
        return spec.geometry !== 'CLUSTER_VOLUME' ? 1 : 0;
      },
    });
    this.softConstraints.push({
      name: 'prefer_cluster_probe_for_large_datasets',
      weight: 16,
      eval: (facts, spec) => {
        if (!facts.isLargeDataset) return 0;
        return spec.interaction !== 'CLUSTER_PROBE' ? 1 : 0;
      },
    });

    // Phase 7 interaction metaphors.
    this.softConstraints.push({
      name: 'prefer_resonance_for_graphs',
      weight: 8,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.GRAPH && spec.interaction !== 'RESONANCE_PULSE' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_constellation_for_graphs',
      weight: 6,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.GRAPH && spec.interaction !== 'CONSTELLATION' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_aleph_for_dense_graphs',
      weight: 7,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.GRAPH &&
        facts.density > 0.5 &&
        spec.interaction !== 'ALEPH'
          ? 1
          : 0,
    });
    this.softConstraints.push({
      name: 'prefer_chrono_dial_for_timeseries',
      weight: 8,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.TIME_SERIES && spec.interaction !== 'CHRONO_DIAL' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_fork_plane_for_tabular',
      weight: 8,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.TABULAR && spec.interaction !== 'FORK_PLANE' ? 1 : 0,
    });
    this.softConstraints.push({
      name: 'prefer_beacon_for_geo',
      weight: 8,
      eval: (facts, spec) =>
        facts.topology === TopologyTypes.GEO && spec.interaction !== 'BEACON' ? 1 : 0,
    });

    // Phase 8 statistical soft constraints.
    this.softConstraints.push({
      name: 'prefer_orb_for_outliers',
      weight: 12,
      eval: (facts, spec) => {
        if (!facts.hasOutliers) return 0;
        return spec.geometry !== 'ORB' ? 1 : 0;
      },
    });
    this.softConstraints.push({
      name: 'prefer_column_for_high_variance',
      weight: 10,
      eval: (facts, spec) => {
        if (!facts.hasHighVariance || facts.topology !== TopologyTypes.TABULAR) return 0;
        return spec.geometry !== 'COLUMN' ? 1 : 0;
      },
    });
    this.softConstraints.push({
      name: 'prefer_beam_for_correlations',
      weight: 9,
      eval: (facts, spec) => {
        const matrix = facts.correlationMatrix || {};
        const names = Object.keys(matrix);
        if (names.length < 2) return 0;
        let hasStrongCorrelation = false;
        for (let i = 0; i < names.length && !hasStrongCorrelation; i++) {
          for (let j = i + 1; j < names.length && !hasStrongCorrelation; j++) {
            if (Math.abs(matrix[names[i]][names[j]]) > 0.7) hasStrongCorrelation = true;
          }
        }
        if (!hasStrongCorrelation) return 0;
        return spec.geometry !== 'BEAM' ? 1 : 0;
      },
    });
    this.softConstraints.push({
      name: 'prefer_chrono_dial_for_trends',
      weight: 11,
      eval: (facts, spec) => {
        if (facts.trendDirection === 'flat' || facts.topology !== TopologyTypes.TIME_SERIES)
          return 0;
        return spec.interaction !== 'CHRONO_DIAL' ? 1 : 0;
      },
    });
    this.softConstraints.push({
      name: 'prefer_wave_for_seasonality',
      weight: 8,
      eval: (facts, spec) => {
        if (!facts.seasonalityHint) return 0;
        return spec.behavior !== 'WAVE_OSCILLATION' ? 1 : 0;
      },
    });

    // Phase 8 chart-plane attachment rule.
    this.softConstraints.push({
      name: 'attach_chart_plane_for_rich_numeric_or_time',
      weight: 3,
      eval: (facts, spec) => {
        const richData = facts.numericColumns > 1 || facts.hasTimeSeries;
        if (!richData) return 0;
        return spec.interaction === 'INSPECT_CELL' ? 0 : 1;
      },
    });
  }

  setWeight(ruleName: string, weight: number): void {
    const sc = this.softConstraints.find((c) => c.name === ruleName);
    if (sc) sc.weight = Math.max(0, Math.min(100, weight));
  }

  adjustWeight(ruleName: string, delta: number): void {
    const sc = this.softConstraints.find((c) => c.name === ruleName);
    if (sc) this.setWeight(ruleName, sc.weight + delta);
  }

  /**
   * Solve the constraint set for the given data input. Wave 5: Draco performs
   * NO dataset-derived statistical computation; facts must be supplied either
   * as an explicit argument or via the configured {@link FactProvider} (e.g.
   * AtlasCore). Throws if no facts are available.
   */
  solve(dataInput: DracoDataInput, facts?: DracoFacts): SolverResult {
    const resolvedFacts = facts ?? this.factProvider?.facts(dataInput) ?? null;
    if (!resolvedFacts) {
      throw new Error('ConstraintEngine: no facts provided (supply facts or a FactProvider)');
    }
    const candidates: DracoSpec[] = [];
    for (const layout of VRChannels.LAYOUT) {
      for (const geometry of VRChannels.GEOMETRY) {
        for (const behavior of VRChannels.BEHAVIOR) {
          for (const interaction of VRChannels.INTERACTION) {
            candidates.push({ layout, geometry, behavior, interaction });
          }
        }
      }
    }

    const valid = candidates.filter((spec) => this.hardConstraints.every((hc) => hc(resolvedFacts, spec)));

    if (valid.length === 0) {
      throw new Error('ConstraintEngine: unsatisfiable constraint set for input facts');
    }

    let bestSpec: DracoSpec | null = null;
    let minCost = Infinity;
    for (const spec of valid) {
      let cost = 0;
      for (const sc of this.softConstraints) {
        cost += sc.eval(resolvedFacts, spec) * sc.weight;
      }
      if (cost < minCost) {
        minCost = cost;
        bestSpec = spec;
      }
    }

    return { facts: resolvedFacts, spec: bestSpec!, cost: minCost };
  }

  /**
   * Evaluate a specific candidate specification against a set of facts and return cost + validity.
   */
  evaluateCandidate(spec: DracoSpec, facts: DracoFacts): { isValid: boolean; cost: number; softConstraintViolations: string[] } {
    const isValid = this.hardConstraints.every((hc) => hc(facts, spec));
    let cost = 0;
    const softConstraintViolations: string[] = [];

    for (const sc of this.softConstraints) {
      const penalty = sc.eval(facts, spec);
      if (penalty > 0) {
        cost += penalty * sc.weight;
        softConstraintViolations.push(sc.name);
      }
    }

    return { isValid, cost, softConstraintViolations };
  }
}

/**
 * Shared TypeScript types for the Draco constraint engine and artefact
 * synthesis layer.
 */

import type { Vector3, Group, Mesh, Line } from 'three';
import type { Dataset, DatasetEdge } from '../data/Dataset.ts';
import type { EncodingMapping, TopologyType } from '../data/types.ts';

export type TopologyTypeValue = TopologyType;

/** Available layout channels produced by the constraint solver. */
export type VRLayout =
  | 'GRID_3D'
  | 'FORCE_DIRECTED_3D'
  | 'RADIAL_ORBITAL'
  | 'VECTOR_STREAMLINE'
  | 'TIME_RIBBON'
  | 'GEO_SURFACE';

/** Available geometry channels produced by the constraint solver. */
export type VRGeometry =
  | 'CUBE_MATRIX'
  | 'ICOSA_NODE'
  | 'CONICAL_TREE'
  | 'FLOW_RAY'
  | 'GEO_COLUMN'
  | 'CLUSTER_VOLUME'
  | 'INSTANCED_POINT_CLOUD'
  | 'AGGREGATE_BARS'
  | 'ORB'
  | 'COLUMN'
  | 'BEAM';

/** Available behavior channels produced by the constraint solver. */
export type VRBehavior = 'PULSE_QUANTITATIVE' | 'ORBITAL_SPIN' | 'WAVE_OSCILLATION' | 'STATIC';

/** Available interaction channels produced by the constraint solver. */
export type VRInteraction =
  | 'INSPECT_CELL'
  | 'TRAVERSE_EDGE'
  | 'DRILL_DOWN'
  | 'HARVEST_STREAM'
  | 'CLUSTER_PROBE'
  | 'FILTER_BRUSH'
  | 'RESONANCE_PULSE'
  | 'FORK_PLANE'
  | 'CHRONO_DIAL'
  | 'CONSTELLATION'
  | 'BEACON'
  | 'ALEPH';

/** A full Draco specification (layout/geometry/behavior/interaction). */
export interface DracoSpec {
  layout: VRLayout;
  geometry: VRGeometry;
  behavior: VRBehavior;
  interaction: VRInteraction;
}

/** Numeric summary statistics produced by the constraint engine. */
export interface NumericStats {
  mean: number;
  median: number;
  stdDev: number;
  skew: number;
  kurtosis: number;
  min: number;
  max: number;
}

/** A single category bucket for categorical distribution facts. */
export interface CategoryBucket {
  value: unknown;
  count: number;
  fraction: number;
}

/** Categorical distribution summary produced by the constraint engine. */
export interface CategoricalDistribution {
  topCategories: CategoryBucket[];
  entropy: number;
}

/** Direction of a simple temporal trend heuristic. */
export type TrendDirection = 'flat' | 'up' | 'down';

/** Facts extracted from a data input by the constraint engine. */
export interface DracoFacts {
  topology: TopologyTypeValue;
  rowCount: number;
  nodeCount: number;
  edgeCount: number;
  depth: number;
  numericColumns: number;
  categoricalColumns: number;
  temporalColumns: number;
  hasTimeSeries: boolean;
  hasContinuousValues: boolean;
  density: number;
  estimatedDensity: number;
  outlierCount: number;
  cardinalityOfColor: number;
  hasHighCardinality: boolean;
  isLargeDataset: boolean;
  clusterCount: number;
  columnStats: Record<string, NumericStats>;
  correlationMatrix: Record<string, Record<string, number>>;
  categoryDistribution: Record<string, CategoricalDistribution>;
  trendDirection: TrendDirection;
  seasonalityHint: boolean;
  hasOutliers: boolean;
  hasHighVariance: boolean;
  numericSkew: number;
  topCategory: unknown;
}

/** Hard constraint: returns false when a spec is invalid for the given facts. */
export type HardConstraint = (facts: DracoFacts, spec: DracoSpec) => boolean;

/** Soft constraint: returns a penalty (0 = satisfied) weighted by its weight. */
export interface SoftConstraint {
  name: string;
  weight: number;
  eval: (facts: DracoFacts, spec: DracoSpec) => number;
}

/** Result of running the constraint solver on a data input. */
export interface SolverResult {
  facts: DracoFacts;
  spec: DracoSpec;
  cost: number;
}

/** Loose data input accepted by the Draco solver and translator. */
export interface DracoDataInput {
  dataset?: Dataset;
  rows?: Record<string, unknown>[];
  edges?: DatasetEdge[];
  nodes?: Record<string, unknown>[];
  topology?: TopologyTypeValue;
  encodings?: EncodingMapping;
  maxDepth?: number;
  isTimeSeries?: boolean;
}

/** Base layout entry returned by every 3D layout generator. */
export interface LayoutEntry<T = Record<string, unknown>> {
  position: Vector3;
  row: T;
  index: number;
}

/** Grid layout options. */
export interface GridLayoutOptions {
  spacing?: number;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  yOffset?: number;
}

/** Force-directed layout options. */
export interface ForceDirectedOptions {
  edges?: DatasetEdge[];
  iterations?: number;
  repulsion?: number;
  attraction?: number;
  damping?: number;
  radius?: number;
  yOffset?: number;
  seed?: number;
}

/** Radial tree layout options. */
export interface RadialTreeOptions {
  levelKey?: string;
  parentKey?: string;
  ringSpacing?: number;
  yStep?: number;
  yOffset?: number;
}

/** Time-series ribbon layout options. */
export interface TimeSeriesRibbonOptions {
  timeKey?: string;
  valueKey?: string;
  seriesKey?: string;
  xScale?: number;
  yScale?: number;
  zSpacing?: number;
  yOffset?: number;
}

/** Streamline layout options. */
export interface StreamlineOptions {
  count?: number;
  steps?: number;
  stepSize?: number;
  bounds?: { x: [number, number]; y: [number, number]; z: [number, number] };
  seed?: number;
}

/** Geospatial surface layout options. */
export interface GeoSurfaceOptions {
  lonKey?: string;
  latKey?: string;
  valueKey?: string;
  roomWidth?: number;
  roomDepth?: number;
  heightScale?: number;
  yOffset?: number;
}

/** Radial tree layout entry, includes the ring level and optional parent. */
export interface RadialEntry<T = Record<string, unknown>> extends LayoutEntry<T> {
  level: number;
  parentIndex?: number;
}

/** Time-series ribbon layout entry, includes series metadata. */
export interface TimeSeriesEntry<T = Record<string, unknown>> extends LayoutEntry<T> {
  seriesId: string | number;
  seriesIndex: number;
  pointIndex: number;
}

/** Streamline layout entry, includes the generated curve points. */
export interface StreamlineEntry<T = Record<string, unknown>> extends LayoutEntry<T> {
  points: Vector3[];
}

/** Geospatial layout entry, includes lon/lat/value. */
export interface GeoEntry<T = Record<string, unknown>> extends LayoutEntry<T> {
  lon: number;
  lat: number;
  value: number;
}

/** Artefact interaction callbacks exposed by the translator. */
export interface InteractionCallbacks {
  type: VRInteraction;
  onHover: (mesh: Mesh) => void;
  onUnhover: (mesh: Mesh) => void;
  onSelect: (mesh: Mesh) => void;
}

/** Three.js artefact produced by the VR topology translator. */
export interface Artifact {
  group: Group;
  nodeMeshes: Mesh[];
  edgeMeshes: Line[];
  interactions: InteractionCallbacks;
  update: (delta: number, time: number) => void;
  spec: DracoSpec;
  chartPlane?: unknown;
}

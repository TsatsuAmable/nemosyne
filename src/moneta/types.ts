/**
 * Moneta / Representation Subsystem — Core Types
 *
 * Evolved from Draco into Moneta: the explainable analytical representation solver.
 */

import type { TopologyTypeValue, TopologyType } from '../types/topology.ts';
export type { TopologyTypeValue, TopologyType };

export type VRLayout =
  | 'GRID_3D'
  | 'FORCE_DIRECTED_3D'
  | 'RADIAL_ORBITAL'
  | 'VECTOR_STREAMLINE'
  | 'TIME_RIBBON'
  | 'GEO_SURFACE'
  | 'SPECTRAL_VOLUME';

export type VRGeometry =
  | 'CUBE_MATRIX'
  | 'ICOSA_NODE'
  | 'CONICAL_TREE'
  | 'FLOW_RAY'
  | 'GEO_COLUMN'
  | 'CLUSTER_VOLUME'
  | 'INSTANCED_POINT_CLOUD'
  | 'AGGREGATE_BARS'
  | 'DENSITY_FIELD'
  | 'ORB'
  | 'COLUMN'
  | 'BEAM'
  | 'SPECTRAL_BAR'
  | 'SPECTRAL_SURFACE';

export type VRBehavior =
  | 'PULSE_QUANTITATIVE'
  | 'ORBITAL_SPIN'
  | 'WAVE_OSCILLATION'
  | 'STATIC';

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
  | 'ALEPH'
  | 'FREQUENCY_PROBE';

export interface MonetaSpec {
  layout: VRLayout;
  geometry: VRGeometry;
  behavior: VRBehavior;
  interaction: VRInteraction;
}

export type DracoSpec = MonetaSpec;

export interface NumericStats {
  mean: number;
  median: number;
  stdDev: number;
  skew: number;
  kurtosis: number;
  min: number;
  max: number;
}

export interface CategoryBucket {
  value: unknown;
  count: number;
  fraction: number;
}

export interface CategoricalDistribution {
  topCategories: CategoryBucket[];
  entropy: number;
}

export type TrendDirection = 'flat' | 'up' | 'down';

export interface MonetaFacts {
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
  [key: string]: unknown;
}

export type DracoFacts = MonetaFacts;

export type HardConstraint = (facts: MonetaFacts, spec: MonetaSpec) => boolean;

export interface SoftConstraint {
  name: string;
  weight: number;
  eval: (facts: MonetaFacts, spec: MonetaSpec) => number;
}

export interface SolverResult {
  spec: MonetaSpec;
  facts: MonetaFacts;
  cost: number;
}

export interface MonetaDataInput {
  topology?: TopologyTypeValue;
  dataset?: import('../data/Dataset.ts').Dataset;
  rows?: Record<string, unknown>[];
  edges?: import('../data/Dataset.ts').DatasetEdge[];
  encodings?: import('../data/SampleDatasets.ts').EncodingMapping;
  [key: string]: unknown;
}

export type DracoDataInput = MonetaDataInput;

export interface FactProvider {
  facts(input: MonetaDataInput): MonetaFacts | null;
}

export interface InteractionCallbacks {
  type?: VRInteraction;
  onHover?: (mesh: import('three').Mesh) => void;
  onUnhover?: (mesh: import('three').Mesh) => void;
  onSelect?: (mesh: import('three').Mesh) => void;
  onClick?: (row: Record<string, unknown>, index: number) => void;
  [key: string]: unknown;
}

export interface Artifact {
  group: import('three').Group;
  nodeMeshes: import('three').Mesh[];
  edgeMeshes: import('three').Line[];
  behaviors: Array<(delta: number, time: number) => void>;
  interactions?: InteractionCallbacks;
  chartPlane?: import('./types.ts').IChartPlane;
  instancedCloud?: import('./types.ts').IInstancedPointCloud;
  update?: (delta: number, time: number) => void;
  spec?: MonetaSpec;
}

export interface LayoutEntry<T = Record<string, unknown>> {
  position: import('three').Vector3;
  row: T;
  index: number;
}

export interface TimeSeriesEntry<T = Record<string, unknown>> extends LayoutEntry<T> {
  seriesId: string | number;
  timestamp: number;
  value: number;
  pointIndex?: number;
  seriesIndex?: number;
}

export interface RadialEntry<T = Record<string, unknown>> extends LayoutEntry<T> {
  level: number;
  parentIndex?: number;
}

export interface StreamlineEntry<T = Record<string, unknown>> extends LayoutEntry<T> {
  streamlineId: number;
  step: number;
  vector: import('three').Vector3;
  points?: import('three').Vector3[];
}

export interface GeoEntry<T = Record<string, unknown>> extends LayoutEntry<T> {
  lat: number;
  lon: number;
  value: number;
}

export type {
  GridLayoutOptions,
  TimeSeriesRibbonOptions,
  StreamlineOptions,
  GeoSurfaceOptions,
  SpectralVolumeOptions,
  RadialTreeOptions,
  ForceDirectedOptions,
} from './layouts/index.ts';

export interface IChartPlane {
  mesh: import('three').Mesh;
  group?: import('three').Group;
  setDataset?(dataset: import('../data/Dataset.ts').Dataset): void;
  updateData?(points: { x: number; y: number; z: number; color?: number | string }[]): void;
  destroy?(): void;
}

export interface ChartPlaneFactory {
  (facts: MonetaFacts, dataset: import('../data/Dataset.ts').Dataset, options?: Record<string, unknown>): IChartPlane;
}

export interface IInstancedPointCloud {
  mesh: import('three').InstancedMesh;
  setPoints(
    items: {
      position: number[] | import('three').Vector3;
      scale?: number;
      color?: number | string;
      data?: unknown;
    }[]
  ): void;
}

export interface InstancedPointCloudFactory {
  (count: number, geometry?: import('three').BufferGeometry): IInstancedPointCloud;
}

export interface MetaphorActionHandlers {
  applyResonancePulse?: (group: import('three').Group, source: import('three').Mesh, partners: import('three').Mesh[]) => void;
  applyForkPlane?: (group: import('three').Group, mesh: import('three').Mesh) => void;
  applyChronoDial?: (group: import('three').Group, mesh: import('three').Mesh) => void;
  applyConstellation?: (group: import('three').Group, mesh: import('three').Mesh, neighbors: import('three').Mesh[]) => void;
  applyBeacon?: (group: import('three').Group, mesh: import('three').Mesh) => void;
  applyAleph?: (group: import('three').Group, mesh: import('three').Mesh, others: import('three').Mesh[]) => void;
  onHighlightNeighbors?: (nodeIndex: number) => void;
  onFilterRange?: (range: [number, number], dimension: string) => void;
  onSelectCluster?: (clusterId: number) => void;
  onDrillDownHierarchy?: (nodeIndex: number) => void;
  onScrubTimeline?: (timestamp: number) => void;
}

export interface VRTranslatorOptions {
  colorblindMode?: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | string;
  pointCloudFactory?: InstancedPointCloudFactory;
  chartPlaneFactory?: ChartPlaneFactory;
  metaphorActions?: MetaphorActionHandlers;
}

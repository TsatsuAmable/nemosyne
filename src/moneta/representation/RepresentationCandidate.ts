/**
 * Moneta Semantic Representation Candidates & Information-Loss Ontology
 *
 * Section 20-22: Semantic representation strategies declare what dataset structure
 * they support, what information they preserve, and what information they compress/lose.
 */

export type SemanticRepresentationId =
  | 'POINT_SET'
  | 'DENSITY_FIELD'
  | 'DISTRIBUTION_FIELD'
  | 'CLUSTER_REGIONS'
  | 'AGGREGATE_VOLUME'
  | 'TEMPORAL_TRAJECTORY'
  | 'HIERARCHICAL_SPACE'
  | 'RELATIONSHIP_GRAPH'
  | 'MATRIX_FIELD'
  | 'MANIFOLD_EMBEDDING'
  | 'SPATIAL_REGION'
  | 'MULTISCALE_FIELD';

export type StructureCapability =
  | 'discrete-observations'
  | 'continuous-density'
  | 'binned-empirical-mass'
  | 'univariate-distribution'
  | 'multivariate-correlation'
  | 'cluster-partition'
  | 'relational-topology'
  | 'tree-hierarchy'
  | 'temporal-sequence'
  | 'periodic-spectrum'
  | 'spatial-coordinates'
  | 'anomaly-isolation'
  | 'aggregate-metrics';

export type InformationType =
  | 'individual-observation-identity'
  | 'exact-metric-values'
  | 'population-density-distribution'
  | 'empirical-bivariate-bin-mass'
  | 'empirical-distribution-shape'
  | 'outlier-boundary-visibility'
  | 'cluster-separation'
  | 'relational-edge-connectivity'
  | 'hierarchical-parent-child'
  | 'chronological-order'
  | 'harmonic-frequency-structure'
  | 'geographic-spatial-adjacency'
  | 'aggregate-group-magnitude';

export interface ScaleCharacteristics {
  minN: number;
  maxN: number;
  optimalN: [number, number];
  scalabilityRating: number; // 0.0 to 1.0 (1.0 = highly scalable)
}

export interface InteractionCharacteristics {
  supportedInteractions: string[];
  occlusionResistance: number; // 0.0 to 1.0
  cognitiveLoad: number; // 0.0 to 1.0 (lower is lighter)
}

export interface CandidateConstraint {
  description: string;
  minDimensions?: number;
  maxDimensions?: number;
  requiresTemporal?: boolean;
  requiresGraph?: boolean;
  requiresHierarchy?: boolean;
  requiresGeospatial?: boolean;
}

export interface RepresentationCandidate {
  id: SemanticRepresentationId;
  name: string;
  description: string;
  supports: StructureCapability[];
  preserves: InformationType[];
  loses: InformationType[];
  scaleCharacteristics: ScaleCharacteristics;
  interactionCharacteristics: InteractionCharacteristics;
  constraints: CandidateConstraint[];
}

export const MONETA_REPRESENTATION_CANDIDATES: Record<SemanticRepresentationId, RepresentationCandidate> = {
  POINT_SET: {
    id: 'POINT_SET',
    name: 'Discrete Point Set',
    description: 'Direct 3D spatial mapping of discrete observation records',
    supports: ['discrete-observations', 'multivariate-correlation'],
    preserves: [
      'individual-observation-identity',
      'exact-metric-values',
      'outlier-boundary-visibility',
    ],
    loses: ['population-density-distribution'],
    scaleCharacteristics: {
      minN: 1,
      maxN: 2000,
      optimalN: [10, 500],
      scalabilityRating: 0.4,
    },
    interactionCharacteristics: {
      supportedInteractions: ['INSPECT_CELL', 'FILTER_BRUSH', 'FORK_PLANE'],
      occlusionResistance: 0.3,
      cognitiveLoad: 0.6,
    },
    constraints: [{ description: 'Requires at least 2 numeric dimensions for spatial positioning', minDimensions: 2 }],
  },

  DENSITY_FIELD: {
    id: 'DENSITY_FIELD',
    name: 'Binned Density Field',
    description: 'Bounded bivariate equal-width count grid preserving empirical mass per bin for two explicit numeric measures',
    supports: ['binned-empirical-mass', 'discrete-observations'],
    preserves: ['empirical-bivariate-bin-mass'],
    loses: [
      'individual-observation-identity',
      'exact-metric-values',
      'population-density-distribution',
      'empirical-distribution-shape',
      'outlier-boundary-visibility',
    ],
    scaleCharacteristics: {
      minN: 100,
      maxN: 500_000,
      optimalN: [1000, 50_000],
      scalabilityRating: 0.9,
    },
    interactionCharacteristics: {
      supportedInteractions: ['CLUSTER_PROBE', 'FILTER_BRUSH', 'ALEPH'],
      occlusionResistance: 0.85,
      cognitiveLoad: 0.4,
    },
    constraints: [{ description: 'Requires at least 2 numeric dimensions', minDimensions: 2 }],
  },

  DISTRIBUTION_FIELD: {
    id: 'DISTRIBUTION_FIELD',
    name: 'Empirical Univariate Distribution',
    description: 'Bounded empirical histogram, ECDF, and quantile summary for one explicit numeric measure',
    supports: ['univariate-distribution', 'anomaly-isolation'],
    preserves: ['empirical-distribution-shape'],
    loses: [
      'individual-observation-identity',
      'exact-metric-values',
      'population-density-distribution',
      'outlier-boundary-visibility',
    ],
    scaleCharacteristics: {
      minN: 50,
      maxN: 500_000,
      optimalN: [100, 10_000],
      scalabilityRating: 0.85,
    },
    interactionCharacteristics: {
      supportedInteractions: ['INSPECT_CELL', 'FILTER_BRUSH', 'CHRONO_DIAL'],
      occlusionResistance: 0.75,
      cognitiveLoad: 0.45,
    },
    constraints: [{ description: 'Requires at least 1 numeric dimension', minDimensions: 1 }],
  },

  CLUSTER_REGIONS: {
    id: 'CLUSTER_REGIONS',
    name: 'Partitioned Cluster Regions',
    description: 'Spatial zones bounding segmented clusters with centroid and boundary markers',
    supports: ['cluster-partition', 'discrete-observations', 'aggregate-metrics'],
    preserves: [
      'cluster-separation',
      'aggregate-group-magnitude',
      'outlier-boundary-visibility',
    ],
    loses: ['exact-metric-values'],
    scaleCharacteristics: {
      minN: 20,
      maxN: 100_000,
      optimalN: [50, 5000],
      scalabilityRating: 0.8,
    },
    interactionCharacteristics: {
      supportedInteractions: ['CLUSTER_PROBE', 'INSPECT_CELL', 'BEACON'],
      occlusionResistance: 0.8,
      cognitiveLoad: 0.5,
    },
    constraints: [{ description: 'Requires discrete cluster structure or multi-modal density' }],
  },

  AGGREGATE_VOLUME: {
    id: 'AGGREGATE_VOLUME',
    name: 'Aggregated Metric Volume',
    description: 'Binned volumetric blocks representing aggregated summary measures',
    supports: ['aggregate-metrics', 'discrete-observations'],
    preserves: ['aggregate-group-magnitude'],
    loses: [
      'individual-observation-identity',
      'exact-metric-values',
      'outlier-boundary-visibility',
    ],
    scaleCharacteristics: {
      minN: 100,
      maxN: 50_000_000,
      optimalN: [1000, 1_000_000],
      scalabilityRating: 0.98,
    },
    interactionCharacteristics: {
      supportedInteractions: ['INSPECT_CELL', 'DRILL_DOWN', 'FILTER_BRUSH'],
      occlusionResistance: 0.9,
      cognitiveLoad: 0.35,
    },
    constraints: [{ description: 'Requires at least 1 aggregate metric' }],
  },

  TEMPORAL_TRAJECTORY: {
    id: 'TEMPORAL_TRAJECTORY',
    name: 'Chronological Temporal Trajectory',
    description: 'Ordered path trajectory along chronological time axis preserving time dynamics',
    supports: ['temporal-sequence', 'periodic-spectrum', 'discrete-observations'],
    preserves: [
      'chronological-order',
      'exact-metric-values',
      'harmonic-frequency-structure',
    ],
    loses: ['cluster-separation'],
    scaleCharacteristics: {
      minN: 5,
      maxN: 100_000,
      optimalN: [20, 2000],
      scalabilityRating: 0.75,
    },
    interactionCharacteristics: {
      supportedInteractions: ['HARVEST_STREAM', 'CHRONO_DIAL', 'INSPECT_CELL'],
      occlusionResistance: 0.65,
      cognitiveLoad: 0.5,
    },
    constraints: [{ description: 'Requires temporal timestamps or ordered sequences', requiresTemporal: true }],
  },

  HIERARCHICAL_SPACE: {
    id: 'HIERARCHICAL_SPACE',
    name: 'Nested Hierarchical Space',
    description: 'Concentric radial orbital levels encoding tree/hierarchy depth',
    supports: ['tree-hierarchy', 'discrete-observations', 'aggregate-metrics'],
    preserves: [
      'hierarchical-parent-child',
      'aggregate-group-magnitude',
      'individual-observation-identity',
    ],
    loses: ['exact-metric-values'],
    scaleCharacteristics: {
      minN: 5,
      maxN: 10_000,
      optimalN: [10, 1000],
      scalabilityRating: 0.7,
    },
    interactionCharacteristics: {
      supportedInteractions: ['DRILL_DOWN', 'INSPECT_CELL', 'CONSTELLATION'],
      occlusionResistance: 0.7,
      cognitiveLoad: 0.55,
    },
    constraints: [{ description: 'Requires hierarchy structure or depth > 1', requiresHierarchy: true }],
  },

  RELATIONSHIP_GRAPH: {
    id: 'RELATIONSHIP_GRAPH',
    name: 'Topological Relationship Graph',
    description: 'Force-directed network relaxation exposing relational edge topology',
    supports: ['relational-topology', 'discrete-observations'],
    preserves: [
      'relational-edge-connectivity',
      'individual-observation-identity',
      'cluster-separation',
    ],
    loses: ['exact-metric-values'],
    scaleCharacteristics: {
      minN: 5,
      maxN: 5000,
      optimalN: [20, 800],
      scalabilityRating: 0.5,
    },
    interactionCharacteristics: {
      supportedInteractions: ['TRAVERSE_EDGE', 'INSPECT_CELL', 'RESONANCE_PULSE'],
      occlusionResistance: 0.45,
      cognitiveLoad: 0.7,
    },
    constraints: [{ description: 'Requires relational graph edges', requiresGraph: true }],
  },

  MATRIX_FIELD: {
    id: 'MATRIX_FIELD',
    name: 'Regular 3D Matrix Grid',
    description: 'Uniform Cartesian grid for structured multi-dimensional indexing',
    supports: ['discrete-observations', 'multivariate-correlation'],
    preserves: [
      'individual-observation-identity',
      'exact-metric-values',
    ],
    loses: ['cluster-separation'],
    scaleCharacteristics: {
      minN: 1,
      maxN: 10_000,
      optimalN: [10, 1000],
      scalabilityRating: 0.65,
    },
    interactionCharacteristics: {
      supportedInteractions: ['INSPECT_CELL', 'FILTER_BRUSH'],
      occlusionResistance: 0.5,
      cognitiveLoad: 0.4,
    },
    constraints: [{ description: 'Requires structured tabular indexing' }],
  },

  MANIFOLD_EMBEDDING: {
    id: 'MANIFOLD_EMBEDDING',
    name: 'Topological Manifold Embedding',
    description: 'Dimensionality-reduced manifold coordinates preserving neighbourhood topology',
    supports: ['multivariate-correlation', 'continuous-density', 'discrete-observations'],
    preserves: [
      'cluster-separation',
      'population-density-distribution',
    ],
    loses: ['exact-metric-values'],
    scaleCharacteristics: {
      minN: 50,
      maxN: 50_000,
      optimalN: [100, 5000],
      scalabilityRating: 0.75,
    },
    interactionCharacteristics: {
      supportedInteractions: ['CLUSTER_PROBE', 'FILTER_BRUSH', 'FORK_PLANE'],
      occlusionResistance: 0.7,
      cognitiveLoad: 0.6,
    },
    constraints: [{ description: 'Requires high-dimensional numerical feature space', minDimensions: 3 }],
  },

  SPATIAL_REGION: {
    id: 'SPATIAL_REGION',
    name: 'Geospatial Coordinate Surface',
    description: 'Geographic projection mapping latitude, longitude, and elevation terrain',
    supports: ['spatial-coordinates', 'discrete-observations'],
    preserves: [
      'geographic-spatial-adjacency',
      'exact-metric-values',
      'individual-observation-identity',
    ],
    loses: ['cluster-separation'],
    scaleCharacteristics: {
      minN: 1,
      maxN: 100_000,
      optimalN: [10, 5000],
      scalabilityRating: 0.8,
    },
    interactionCharacteristics: {
      supportedInteractions: ['INSPECT_CELL', 'BEACON', 'FILTER_BRUSH'],
      occlusionResistance: 0.8,
      cognitiveLoad: 0.4,
    },
    constraints: [{ description: 'Requires geospatial latitude and longitude coordinates', requiresGeospatial: true }],
  },

  MULTISCALE_FIELD: {
    id: 'MULTISCALE_FIELD',
    name: 'Multiscale Frequency & Wavelet Field',
    description: 'Decomposed multiscale representation exposing localized frequency and harmonic structures',
    supports: ['periodic-spectrum', 'temporal-sequence', 'continuous-density'],
    preserves: [
      'harmonic-frequency-structure',
      'population-density-distribution',
    ],
    loses: ['individual-observation-identity'],
    scaleCharacteristics: {
      minN: 64,
      maxN: 1_000_000,
      optimalN: [256, 65536],
      scalabilityRating: 0.85,
    },
    interactionCharacteristics: {
      supportedInteractions: ['FREQUENCY_PROBE', 'CHRONO_DIAL', 'FILTER_BRUSH'],
      occlusionResistance: 0.75,
      cognitiveLoad: 0.55,
    },
    constraints: [{ description: 'Requires spectral periodicity or multiscale signals' }],
  },
};

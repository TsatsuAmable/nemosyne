/**
 * Semantic vs. Structural vs. Layout Position Discipline.
 *
 * Enforces scientific visualization rigor by categorizing what spatial coordinates represent:
 * - SEMANTIC: Coordinates encode direct data variables (e.g. lat/lon, time, revenue). Proximity implies metric similarity.
 * - STRUCTURAL: Coordinates reveal topological neighborhoods / community structures (e.g. TDA graph, MDS). Proximity implies graph/manifold adjacency.
 * - LAYOUT: Coordinates are algorithmic spatial packing (e.g. force-directed relaxation, radial tree). Physical proximity does NOT guarantee feature similarity.
 *
 * Prevents misleading perceptual inference across VR analytical representations.
 */

export type PositionNature = 'SEMANTIC' | 'STRUCTURAL' | 'LAYOUT';

export interface PositionEncodingContract {
  nature: PositionNature;
  sourceAlgorithmOrDimension: string;
  isMetricSimilarityGuaranteed: boolean;
  interpretiveGuidance: string;
}

export const REPRESENTATION_POSITION_NATURE: Record<string, PositionEncodingContract> = {
  grid: {
    nature: 'LAYOUT',
    sourceAlgorithmOrDimension: 'GridMatrixLayout',
    isMetricSimilarityGuaranteed: false,
    interpretiveGuidance: 'Order is categorical/index-based; spatial distance does not encode metric similarity.',
  },
  force_directed: {
    nature: 'LAYOUT',
    sourceAlgorithmOrDimension: 'FruchtermanReingold',
    isMetricSimilarityGuaranteed: false,
    interpretiveGuidance: 'Proximity reflects topological graph connectivity; physical distance is algorithmic relaxation, not data feature similarity.',
  },
  time_ribbon: {
    nature: 'SEMANTIC',
    sourceAlgorithmOrDimension: 'TemporalAxis',
    isMetricSimilarityGuaranteed: true,
    interpretiveGuidance: 'X/Z coordinates encode strict temporal progression and metric value.',
  },
  geo_surface: {
    nature: 'SEMANTIC',
    sourceAlgorithmOrDimension: 'SpatialLatLonElevation',
    isMetricSimilarityGuaranteed: true,
    interpretiveGuidance: 'Positions represent physical geospatial coordinates and elevation metrics.',
  },
  tda_mapper: {
    nature: 'STRUCTURAL',
    sourceAlgorithmOrDimension: 'SimplicialComplexMapper',
    isMetricSimilarityGuaranteed: false,
    interpretiveGuidance: 'Nodes represent high-dimensional manifold point clusters; edges represent shared point membership.',
  },
  mds_embedding: {
    nature: 'STRUCTURAL',
    sourceAlgorithmOrDimension: 'MultidimensionalScaling',
    isMetricSimilarityGuaranteed: true,
    interpretiveGuidance: 'Pairwise distances preserve high-dimensional metric dissimilarities up to stress error.',
  },
};

export class PositionSemanticClassifier {
  getContract(representationType: string): PositionEncodingContract {
    return (
      REPRESENTATION_POSITION_NATURE[representationType] ?? {
        nature: 'LAYOUT',
        sourceAlgorithmOrDimension: 'Unknown',
        isMetricSimilarityGuaranteed: false,
        interpretiveGuidance: 'Spatial positions should be interpreted cautiously.',
      }
    );
  }

  isMetricSimilarityValid(representationType: string): boolean {
    return this.getContract(representationType).isMetricSimilarityGuaranteed;
  }
}

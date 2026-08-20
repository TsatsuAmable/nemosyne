/**
 * Moneta Representation Families Ontology
 *
 * Maps high-level representation families to VRLayouts and semantic categories.
 */

import type { VRLayout } from '../types.ts';
import type { SemanticRepresentationId } from './RepresentationCandidate.ts';

export type RepresentationFamily =
  | 'POINT'
  | 'DISTRIBUTION'
  | 'CLUSTER'
  | 'GRAPH'
  | 'FIELD'
  | 'TOPOLOGY'
  | 'TEMPORAL'
  | 'HIERARCHICAL'
  | 'FREQUENCY';

export const ALL_REPRESENTATION_FAMILIES: readonly RepresentationFamily[] = [
  'POINT',
  'DISTRIBUTION',
  'CLUSTER',
  'GRAPH',
  'FIELD',
  'TOPOLOGY',
  'TEMPORAL',
  'HIERARCHICAL',
  'FREQUENCY',
] as const;

export const LAYOUT_TO_FAMILY: Record<VRLayout, RepresentationFamily> = {
  GRID_3D: 'POINT',
  FORCE_DIRECTED_3D: 'GRAPH',
  RADIAL_ORBITAL: 'HIERARCHICAL',
  VECTOR_STREAMLINE: 'FIELD',
  TIME_RIBBON: 'TEMPORAL',
  GEO_SURFACE: 'FIELD',
  SPECTRAL_VOLUME: 'FREQUENCY',
};

export const FAMILY_TO_LAYOUTS: Record<RepresentationFamily, VRLayout[]> = {
  POINT: ['GRID_3D'],
  DISTRIBUTION: ['GRID_3D'],
  CLUSTER: ['GRID_3D', 'FORCE_DIRECTED_3D'],
  GRAPH: ['FORCE_DIRECTED_3D'],
  FIELD: ['VECTOR_STREAMLINE', 'GEO_SURFACE'],
  TOPOLOGY: ['FORCE_DIRECTED_3D', 'GRID_3D'],
  TEMPORAL: ['TIME_RIBBON'],
  HIERARCHICAL: ['RADIAL_ORBITAL'],
  FREQUENCY: ['SPECTRAL_VOLUME', 'TIME_RIBBON'],
};

export const FAMILY_TO_CANDIDATE_IDS: Record<RepresentationFamily, SemanticRepresentationId[]> = {
  POINT: ['POINT_SET', 'MATRIX_FIELD'],
  DISTRIBUTION: ['DISTRIBUTION_FIELD', 'DENSITY_FIELD'],
  CLUSTER: ['CLUSTER_REGIONS', 'DENSITY_FIELD'],
  GRAPH: ['RELATIONSHIP_GRAPH'],
  FIELD: ['SPATIAL_REGION'],
  TOPOLOGY: ['MANIFOLD_EMBEDDING', 'RELATIONSHIP_GRAPH'],
  TEMPORAL: ['TEMPORAL_TRAJECTORY'],
  HIERARCHICAL: ['HIERARCHICAL_SPACE'],
  FREQUENCY: ['MULTISCALE_FIELD', 'TEMPORAL_TRAJECTORY'],
};

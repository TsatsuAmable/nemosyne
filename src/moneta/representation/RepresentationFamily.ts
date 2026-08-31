/**
 * Moneta Representation Families Ontology
 *
 * Representation families are reasoning categories. Layouts are compatible
 * presentation strategies. A family-to-layout relationship does NOT define the
 * analytical object, semantic payload, or renderer authority for a candidate.
 * Those semantics are owned by the SemanticRepresentationId and, for governed
 * dataset-level representations, the Rust/WASM semantic embodiment payload.
 */

import type { VRLayout } from '../types.ts';
import type { SemanticRepresentationId } from './RepresentationCandidate.ts';

export type RepresentationFamily =
  | 'POINT'
  | 'DISTRIBUTION'
  | 'CLUSTER'
  | 'AGGREGATE'
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
  'AGGREGATE',
  'GRAPH',
  'FIELD',
  'TOPOLOGY',
  'TEMPORAL',
  'HIERARCHICAL',
  'FREQUENCY',
] as const;

/**
 * Canonical many-to-many compatibility relation used by Moneta search.
 *
 * A shared layout is not a shared representation. For example,
 * DISTRIBUTION -> GRID_3D means GRID_3D is a permissible macro-layout for a
 * distribution candidate; it does not mean a distribution is a point grid.
 * Candidate-specific geometry/payload dispatch remains authoritative.
 */
export const FAMILY_TO_COMPATIBLE_LAYOUTS: Record<RepresentationFamily, VRLayout[]> = {
  POINT: ['GRID_3D'],
  DISTRIBUTION: ['GRID_3D'],
  CLUSTER: ['GRID_3D', 'FORCE_DIRECTED_3D'],
  AGGREGATE: ['GRID_3D'],
  GRAPH: ['FORCE_DIRECTED_3D'],
  FIELD: ['VECTOR_STREAMLINE', 'GEO_SURFACE'],
  TOPOLOGY: ['FORCE_DIRECTED_3D', 'GRID_3D'],
  TEMPORAL: ['TIME_RIBBON'],
  HIERARCHICAL: ['RADIAL_ORBITAL'],
  FREQUENCY: ['SPECTRAL_VOLUME', 'TIME_RIBBON'],
};

/**
 * Full reverse compatibility relation. Unlike the legacy LAYOUT_TO_FAMILY map,
 * this is a true reverse of FAMILY_TO_COMPATIBLE_LAYOUTS and therefore retains
 * every family that may use a shared macro-layout.
 */
export const LAYOUT_TO_COMPATIBLE_FAMILIES: Record<VRLayout, RepresentationFamily[]> = {
  GRID_3D: ['POINT', 'DISTRIBUTION', 'CLUSTER', 'AGGREGATE', 'TOPOLOGY'],
  FORCE_DIRECTED_3D: ['CLUSTER', 'GRAPH', 'TOPOLOGY'],
  RADIAL_ORBITAL: ['HIERARCHICAL'],
  VECTOR_STREAMLINE: ['FIELD'],
  TIME_RIBBON: ['TEMPORAL', 'FREQUENCY'],
  GEO_SURFACE: ['FIELD'],
  SPECTRAL_VOLUME: ['FREQUENCY'],
};

/**
 * A deterministic primary reasoning family retained for legacy diagnostics and
 * callers that need one label per layout. This is intentionally NOT an inverse
 * semantic mapping: shared layouts have additional compatible families in
 * LAYOUT_TO_COMPATIBLE_FAMILIES.
 */
export const LAYOUT_PRIMARY_REASONING_FAMILY: Record<VRLayout, RepresentationFamily> = {
  GRID_3D: 'POINT',
  FORCE_DIRECTED_3D: 'GRAPH',
  RADIAL_ORBITAL: 'HIERARCHICAL',
  VECTOR_STREAMLINE: 'FIELD',
  TIME_RIBBON: 'TEMPORAL',
  GEO_SURFACE: 'FIELD',
  SPECTRAL_VOLUME: 'FREQUENCY',
};

/**
 * @deprecated Ambiguous legacy name. Use FAMILY_TO_COMPATIBLE_LAYOUTS.
 * This map describes macro-layout compatibility only and is not semantic
 * embodiment authority.
 */
export const FAMILY_TO_LAYOUTS = FAMILY_TO_COMPATIBLE_LAYOUTS;

/**
 * @deprecated Ambiguous legacy name. Use LAYOUT_TO_COMPATIBLE_FAMILIES for the
 * many-to-many relation, or LAYOUT_PRIMARY_REASONING_FAMILY when one legacy
 * representative label is explicitly required.
 */
export const LAYOUT_TO_FAMILY = LAYOUT_PRIMARY_REASONING_FAMILY;

export function isLayoutCompatibleWithFamily(
  family: RepresentationFamily,
  layout: VRLayout
): boolean {
  return FAMILY_TO_COMPATIBLE_LAYOUTS[family].includes(layout);
}

/**
 * Candidate IDs considered under each reasoning family. This membership is
 * rank-effective; it must not be confused with payload-kind or renderer
 * dispatch. A candidate may participate in more than one reasoning family.
 */
export const FAMILY_TO_CANDIDATE_IDS: Record<RepresentationFamily, SemanticRepresentationId[]> = {
  POINT: ['POINT_SET', 'MATRIX_FIELD'],
  DISTRIBUTION: ['DISTRIBUTION_FIELD', 'DENSITY_FIELD'],
  CLUSTER: ['CLUSTER_REGIONS', 'DENSITY_FIELD'],
  AGGREGATE: ['AGGREGATE_VOLUME'],
  GRAPH: ['RELATIONSHIP_GRAPH'],
  FIELD: ['SPATIAL_REGION'],
  TOPOLOGY: ['MANIFOLD_EMBEDDING', 'RELATIONSHIP_GRAPH'],
  TEMPORAL: ['TEMPORAL_TRAJECTORY'],
  HIERARCHICAL: ['HIERARCHICAL_SPACE'],
  FREQUENCY: ['MULTISCALE_FIELD', 'TEMPORAL_TRAJECTORY'],
};

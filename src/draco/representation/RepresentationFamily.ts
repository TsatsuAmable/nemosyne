/**
 * RepresentationFamily — Formal taxonomy of visual/spatial representation families.
 *
 * Represents the fundamental conceptual mode of data representation, distinct from
 * concrete 3D layouts or rendering primitives.
 */

import type { VRLayout } from '../types.ts';

/**
 * The 9 fundamental representation families in Nemosyne.
 */
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

/**
 * Mapping from concrete VRLayout to its governing RepresentationFamily.
 */
export const LAYOUT_TO_FAMILY: Record<VRLayout, RepresentationFamily> = {
  GRID_3D: 'POINT',
  FORCE_DIRECTED_3D: 'GRAPH',
  RADIAL_ORBITAL: 'HIERARCHICAL',
  VECTOR_STREAMLINE: 'FIELD',
  TIME_RIBBON: 'TEMPORAL',
  GEO_SURFACE: 'POINT',
  SPECTRAL_VOLUME: 'FREQUENCY',
};

/**
 * Mapping from RepresentationFamily to compatible candidate VRLayouts.
 */
export const FAMILY_TO_LAYOUTS: Record<RepresentationFamily, VRLayout[]> = {
  POINT: ['GRID_3D', 'GEO_SURFACE'],
  DISTRIBUTION: ['GRID_3D'],
  CLUSTER: ['GRID_3D', 'FORCE_DIRECTED_3D'],
  GRAPH: ['FORCE_DIRECTED_3D'],
  FIELD: ['VECTOR_STREAMLINE'],
  TOPOLOGY: ['FORCE_DIRECTED_3D'],
  TEMPORAL: ['TIME_RIBBON'],
  HIERARCHICAL: ['RADIAL_ORBITAL'],
  FREQUENCY: ['SPECTRAL_VOLUME'],
};

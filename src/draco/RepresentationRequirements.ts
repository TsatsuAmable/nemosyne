/**
 * RepresentationRequirements — Formal analytical intent and constraint schema for Draco.
 *
 * Defines the goals, priorities, preservation requirements, and device constraints
 * that guide the ConstraintArbiter in selecting an optimal SpatialStrategy.
 */

import * as v from 'valibot';

/**
 * Valibot Schema for RepresentationRequirements.
 */
export const RepresentationRequirementsSchema = v.object({
  /** High-level analytical task. */
  task: v.picklist([
    'explore',
    'identify-outliers',
    'compare-clusters',
    'trace-lineage',
    'temporal-trend',
    'spatial-proximity',
  ]),
  /** Dimensions or column names prioritizing spatial layout assignment. */
  primaryDimensions: v.array(v.string()),
  /** Secondary measures for color, size, pulse encodings. */
  secondaryMeasures: v.optional(v.array(v.string()), []),
  /** Perceptual/analytical invariant to preserve in 3D projection. */
  preservationGoal: v.optional(
    v.picklist([
      'cluster-separation',
      'temporal-ordering',
      'hierarchy-depth',
      'topology-connectivity',
      'density-gradient',
    ]),
    'cluster-separation'
  ),
  /** Hardware envelope constraints. */
  hardwareConstraints: v.optional(
    v.object({
      maxNodes: v.optional(v.number(), 50000),
      preferInstanced: v.optional(v.boolean(), true),
      deviceTier: v.optional(v.picklist(['quest3', 'desktop', 'mobile']), 'quest3'),
    }),
    { maxNodes: 50000, preferInstanced: true, deviceTier: 'quest3' }
  ),
  /** Target presentation modality. */
  presentationMode: v.optional(v.picklist(['immersive-vr', 'desktop-2d']), 'immersive-vr'),
  /** Optional preferred world type. */
  preferredWorldType: v.optional(
    v.picklist(['MEMORY_PALACE', 'ANALYST_COCKPIT', 'FOCUSED_CHAMBER', 'MINI_OVERVIEW'])
  ),
});

export type RepresentationRequirements = v.InferOutput<typeof RepresentationRequirementsSchema>;

export function createDefaultRequirements(
  task: RepresentationRequirements['task'] = 'explore',
  primaryDimensions: string[] = []
): RepresentationRequirements {
  return {
    task,
    primaryDimensions,
    secondaryMeasures: [],
    preservationGoal: 'cluster-separation',
    hardwareConstraints: {
      maxNodes: 50000,
      preferInstanced: true,
      deviceTier: 'quest3',
    },
    presentationMode: 'immersive-vr',
  };
}

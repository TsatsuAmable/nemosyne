import type { AnalyticalTask, RepresentationRequirements } from './RepresentationRequirements.ts';

/**
 * Semantic scale is independent from scene-graph depth or level of detail.
 *
 * This vocabulary follows the structure-first overview -> bounded detail
 * progression used by Nemosyne. It does not imply that TypeScript computed or
 * verified the scientific meaning named by a semantic object.
 */
export const SEMANTIC_ABSTRACTION_LEVELS = [
  'DATASET',
  'REGION',
  'SUBSTRUCTURE',
  'OBSERVATION_SET',
  'OBSERVATION',
] as const;

export type SemanticAbstractionLevel = (typeof SEMANTIC_ABSTRACTION_LEVELS)[number];

const TASK_ABSTRACTION_LEVEL: Readonly<Record<AnalyticalTask, SemanticAbstractionLevel>> = {
  overview: 'DATASET',
  'distribution-analysis': 'SUBSTRUCTURE',
  'cluster-comparison': 'REGION',
  'relationship-discovery': 'SUBSTRUCTURE',
  'anomaly-detection': 'SUBSTRUCTURE',
  'temporal-analysis': 'OBSERVATION_SET',
  'spatial-analysis': 'REGION',
  'hierarchical-exploration': 'SUBSTRUCTURE',
  'individual-inspection': 'OBSERVATION',
  'group-comparison': 'REGION',
  'pattern-discovery': 'SUBSTRUCTURE',
  'trace-lineage': 'OBSERVATION_SET',
  explore: 'DATASET',
  'temporal-trend': 'OBSERVATION_SET',
  'compare-clusters': 'REGION',
  'identify-outliers': 'OBSERVATION_SET',
  'spatial-proximity': 'REGION',
};

/** Maps an explicit investigator task to presentation scope; it performs no analysis. */
export function abstractionLevelForRequirements(
  requirements: Pick<RepresentationRequirements, 'task'>
): SemanticAbstractionLevel {
  return TASK_ABSTRACTION_LEVEL[requirements.task];
}

export function isObservationAbstractionLevel(level: SemanticAbstractionLevel): boolean {
  return level === 'OBSERVATION_SET' || level === 'OBSERVATION';
}

export type ObservationPresentationAuthority =
  | 'EXPLICIT_OBSERVATION_INTENT'
  | 'SEMANTIC_DETAIL';

/**
 * Moneta Analytical Intent and Representation Requirements
 *
 * Section 17-19: Formalizes the analytical task independently from geometry,
 * declaring required structures, information preservation goals, acceptable loss budget,
 * scale, and hardware constraints.
 */

import * as v from 'valibot';
import type { InformationType } from './RepresentationCandidate.ts';

export type AnalyticalTask =
  | 'overview'
  | 'distribution-analysis'
  | 'cluster-comparison'
  | 'relationship-discovery'
  | 'anomaly-detection'
  | 'temporal-analysis'
  | 'spatial-analysis'
  | 'hierarchical-exploration'
  | 'individual-inspection'
  | 'group-comparison'
  | 'pattern-discovery'
  | 'trace-lineage'
  | 'explore'
  | 'temporal-trend'
  | 'compare-clusters'
  | 'identify-outliers'
  | 'spatial-proximity';

export type StructureRequirementType =
  | 'distribution'
  | 'cluster-separation'
  | 'density'
  | 'temporal-order'
  | 'periodicity'
  | 'manifold'
  | 'hierarchy'
  | 'connectivity'
  | 'anomaly-visibility'
  | 'observation-identity'
  | 'group-comparison';

export interface StructureRequirement {
  type: StructureRequirementType;
  importance: number; // 0.0 to 1.0
}

export type ObservationLevel = 'individual' | 'group' | 'population' | 'structural';

export interface AnalyticalIntent {
  task: AnalyticalTask;
  targetStructures: StructureRequirement[];
  comparisonNeeds?: string[];
  observationLevel?: ObservationLevel;
}

export interface PreservationGoal {
  information: InformationType;
  priority: 'CRITICAL' | 'DESIRED' | 'OPTIONAL';
}

export interface InformationLossBudget {
  allowIdentityLoss: boolean;
  allowExactMetricLoss: boolean;
  allowClusterLoss: boolean;
  maxOcclusionTolerance: number;
}

export interface HardwareConstraint {
  maxVertices?: number;
  maxDrawCalls?: number;
  targetFrameRate?: number;
  lowPowerMode?: boolean;
  deviceTier?: 'quest2' | 'quest3' | 'questpro' | 'desktop' | string;
  targetFps?: number;
  maxElements?: number;
  preferInstanced?: boolean;
}

export interface DimensionalityRequirement {
  preferredSpatialAxes: number;
  focusDimensions: string[];
}

export interface ProgressiveDisclosureRequirement {
  enabled: boolean;
  levels: Array<{
    level: number;
    distanceThreshold: number;
    reveals: string[];
  }>;
}

export interface RepresentationRequirements {
  task: AnalyticalTask;
  primaryDimensions?: string[];
  preservationGoal?: string;
  requiredStructures: StructureRequirement[];
  preservationGoals: PreservationGoal[];
  acceptableLoss: InformationLossBudget;
  scale: 'SMALL' | 'MEDIUM' | 'LARGE' | 'MASSIVE';
  hardwareConstraints: HardwareConstraint & HardwareConstraint[];
  dimensionalityRequirements?: DimensionalityRequirement;
  progressiveDisclosure?: ProgressiveDisclosureRequirement;
  maxOcclusionTolerance: number;
  interactionBudget: 'LOW' | 'MEDIUM' | 'HIGH';
}

export const AnalyticalTaskSchema = v.picklist([
  'overview',
  'distribution-analysis',
  'cluster-comparison',
  'relationship-discovery',
  'anomaly-detection',
  'temporal-analysis',
  'spatial-analysis',
  'hierarchical-exploration',
  'individual-inspection',
  'group-comparison',
  'pattern-discovery',
  'trace-lineage',
  'explore',
  'temporal-trend',
  'compare-clusters',
  'identify-outliers',
  'spatial-proximity',
]);

export const PreservationGoalSchema = v.picklist([
  'cluster-separation',
  'temporal-ordering',
  'hierarchy-depth',
  'density-gradient',
  'outlier-isolation',
]);

export const HardwareEnvelopeSchema = v.object({
  deviceTier: v.optional(v.picklist(['quest2', 'quest3', 'questpro', 'desktop'])),
  targetFps: v.optional(v.number()),
  maxElements: v.optional(v.number()),
  preferInstanced: v.optional(v.boolean()),
});

export const RepresentationRequirementsSchema = v.object({
  task: AnalyticalTaskSchema,
  primaryDimensions: v.optional(v.array(v.string())),
  preservationGoal: v.optional(v.string()),
  scale: v.optional(v.picklist(['SMALL', 'MEDIUM', 'LARGE', 'MASSIVE'])),
  maxOcclusionTolerance: v.optional(v.number()),
  interactionBudget: v.optional(v.picklist(['LOW', 'MEDIUM', 'HIGH'])),
});

export function createDefaultIntent(task: AnalyticalTask = 'explore'): AnalyticalIntent {
  const targetStructures: StructureRequirement[] = [];
  let observationLevel: ObservationLevel = 'population';

  switch (task) {
    case 'identify-outliers':
    case 'anomaly-detection':
      targetStructures.push({ type: 'anomaly-visibility', importance: 0.95 });
      targetStructures.push({ type: 'distribution', importance: 0.7 });
      observationLevel = 'individual';
      break;

    case 'compare-clusters':
    case 'cluster-comparison':
      targetStructures.push({ type: 'cluster-separation', importance: 0.9 });
      targetStructures.push({ type: 'group-comparison', importance: 0.85 });
      observationLevel = 'group';
      break;

    case 'temporal-trend':
    case 'temporal-analysis':
      targetStructures.push({ type: 'temporal-order', importance: 0.9 });
      targetStructures.push({ type: 'periodicity', importance: 0.75 });
      observationLevel = 'population';
      break;

    case 'trace-lineage':
    case 'hierarchical-exploration':
      targetStructures.push({ type: 'hierarchy', importance: 0.95 });
      observationLevel = 'structural';
      break;

    case 'relationship-discovery':
      targetStructures.push({ type: 'connectivity', importance: 0.9 });
      observationLevel = 'structural';
      break;

    case 'individual-inspection':
      targetStructures.push({ type: 'observation-identity', importance: 1.0 });
      observationLevel = 'individual';
      break;

    case 'distribution-analysis':
      targetStructures.push({ type: 'distribution', importance: 0.9 });
      targetStructures.push({ type: 'density', importance: 0.8 });
      observationLevel = 'population';
      break;

    case 'spatial-proximity':
    case 'spatial-analysis':
      targetStructures.push({ type: 'density', importance: 0.9 });
      observationLevel = 'population';
      break;

    case 'overview':
    case 'explore':
    default:
      targetStructures.push({ type: 'distribution', importance: 0.5 });
      targetStructures.push({ type: 'density', importance: 0.5 });
      observationLevel = 'population';
      break;
  }

  return {
    task,
    targetStructures,
    observationLevel,
  };
}

export function createDefaultRequirements(
  task: AnalyticalTask = 'explore',
  scaleOrDims: 'SMALL' | 'MEDIUM' | 'LARGE' | 'MASSIVE' | string[] = 'MEDIUM'
): RepresentationRequirements {
  const scale = Array.isArray(scaleOrDims) ? 'MEDIUM' : scaleOrDims;
  const primaryDimensions = Array.isArray(scaleOrDims) ? scaleOrDims : undefined;
  const intent = createDefaultIntent(task);

  const preservationGoals: PreservationGoal[] = [
    { information: 'population-density-distribution', priority: 'DESIRED' },
  ];

  if (intent.observationLevel === 'individual') {
    preservationGoals.unshift({ information: 'individual-observation-identity', priority: 'CRITICAL' });
    preservationGoals.push({ information: 'exact-metric-values', priority: 'CRITICAL' });
  } else if (intent.observationLevel === 'group') {
    preservationGoals.unshift({ information: 'cluster-separation', priority: 'CRITICAL' });
    preservationGoals.push({ information: 'aggregate-group-magnitude', priority: 'DESIRED' });
  }

  const defaultHw: HardwareConstraint = {
    maxVertices: scale === 'MASSIVE' ? 500_000 : 100_000,
    maxDrawCalls: 120,
    targetFrameRate: 72,
    deviceTier: 'quest3',
    targetFps: 72,
    maxElements: 100_000,
    preferInstanced: true,
  };

  const hwArray = [defaultHw] as unknown as HardwareConstraint & HardwareConstraint[];
  Object.assign(hwArray, defaultHw);

  return {
    task,
    primaryDimensions,
    preservationGoal:
      task === 'compare-clusters'
        ? 'cluster-separation'
        : task === 'temporal-trend'
        ? 'temporal-ordering'
        : task === 'trace-lineage'
        ? 'hierarchy-depth'
        : task === 'spatial-proximity'
        ? 'density-gradient'
        : 'cluster-separation',
    requiredStructures: intent.targetStructures,
    preservationGoals,
    acceptableLoss: {
      allowIdentityLoss: intent.observationLevel !== 'individual' && scale !== 'SMALL',
      allowExactMetricLoss: scale === 'LARGE' || scale === 'MASSIVE',
      allowClusterLoss: false,
      maxOcclusionTolerance: scale === 'LARGE' ? 0.7 : 0.3,
    },
    scale,
    hardwareConstraints: hwArray,
    maxOcclusionTolerance: scale === 'LARGE' ? 0.7 : 0.3,
    interactionBudget: 'MEDIUM',
  };
}

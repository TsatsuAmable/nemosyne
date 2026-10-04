/**
 * RepresentationObjectiveModel — 7-dimensional representation objective evaluation for FM7.
 *
 * Evaluates candidate RepresentationGraph instances across:
 * 1. taskRelevance [0, 1]: Intent alignment, variable coverage, epistemic purpose
 * 2. informationPreservation [0, 1]: Retention of salient dimensions and structure
 * 3. perceptualRecoverability [0, 1]: Visual channel distinctiveness and encoding clarity
 * 4. interactionCost [0, 1]: Navigation/inspection ease (1 = minimal effort, 0 = high burden)
 * 5. resourceCost [0, 1]: Hardware efficiency (1 = lightweight, 0 = resource heavy)
 * 6. stability [0, 1]: Robustness against data perturbation and noise
 * 7. explicitLoss [0, 1]: Information retention (1 = no loss, 0 = heavy loss)
 */

import type { RepresentationGraph } from '../representation/RepresentationGraph.ts';
import type { DatasetSignature } from '../representation/DatasetSignature.ts';

export interface RepresentationObjectiveVectorV1 {
  taskRelevance: number;
  informationPreservation: number;
  perceptualRecoverability: number;
  interactionCost: number;
  resourceCost: number;
  stability: number;
  explicitLoss: number;
}

export type ObjectivePreference =
  | 'BALANCED'
  | 'SIMPLER'
  | 'SHOW_MORE_UNCERTAINTY'
  | 'PRESERVE_TEMPORAL_STRUCTURE'
  | 'HIGH_FIDELITY';

export interface ObjectiveWeightsV1 {
  taskRelevance: number;
  informationPreservation: number;
  perceptualRecoverability: number;
  interactionCost: number;
  resourceCost: number;
  stability: number;
  explicitLoss: number;
}

export const PREFERENCE_WEIGHT_PROFILES: Record<ObjectivePreference, ObjectiveWeightsV1> = {
  BALANCED: {
    taskRelevance: 0.20,
    informationPreservation: 0.20,
    perceptualRecoverability: 0.15,
    interactionCost: 0.15,
    resourceCost: 0.10,
    stability: 0.10,
    explicitLoss: 0.10,
  },
  SIMPLER: {
    taskRelevance: 0.15,
    informationPreservation: 0.10,
    perceptualRecoverability: 0.20,
    interactionCost: 0.25,
    resourceCost: 0.20,
    stability: 0.05,
    explicitLoss: 0.05,
  },
  SHOW_MORE_UNCERTAINTY: {
    taskRelevance: 0.20,
    informationPreservation: 0.25,
    perceptualRecoverability: 0.15,
    interactionCost: 0.10,
    resourceCost: 0.05,
    stability: 0.10,
    explicitLoss: 0.15,
  },
  PRESERVE_TEMPORAL_STRUCTURE: {
    taskRelevance: 0.25,
    informationPreservation: 0.25,
    perceptualRecoverability: 0.15,
    interactionCost: 0.10,
    resourceCost: 0.05,
    stability: 0.10,
    explicitLoss: 0.10,
  },
  HIGH_FIDELITY: {
    taskRelevance: 0.20,
    informationPreservation: 0.30,
    perceptualRecoverability: 0.15,
    interactionCost: 0.05,
    resourceCost: 0.05,
    stability: 0.10,
    explicitLoss: 0.15,
  },
};

/**
 * Checks whether objective vector A Pareto-dominates objective vector B.
 * A dominates B if A is at least as good in all dimensions, and strictly better in at least one.
 */
export function paretoDominates(
  a: RepresentationObjectiveVectorV1,
  b: RepresentationObjectiveVectorV1,
  tolerance = 1e-4
): boolean {
  let strictlyBetter = false;

  const dims: (keyof RepresentationObjectiveVectorV1)[] = [
    'taskRelevance',
    'informationPreservation',
    'perceptualRecoverability',
    'interactionCost',
    'resourceCost',
    'stability',
    'explicitLoss',
  ];

  for (const dim of dims) {
    if (a[dim] < b[dim] - tolerance) {
      return false; // A is worse in this dimension
    }
    if (a[dim] > b[dim] + tolerance) {
      strictlyBetter = true;
    }
  }

  return strictlyBetter;
}

/**
 * Computes scalar weighted score under a given preference profile.
 */
export function computeWeightedUtility(
  vector: RepresentationObjectiveVectorV1,
  preference: ObjectivePreference = 'BALANCED'
): number {
  const weights = PREFERENCE_WEIGHT_PROFILES[preference];
  return (
    vector.taskRelevance * weights.taskRelevance +
    vector.informationPreservation * weights.informationPreservation +
    vector.perceptualRecoverability * weights.perceptualRecoverability +
    vector.interactionCost * weights.interactionCost +
    vector.resourceCost * weights.resourceCost +
    vector.stability * weights.stability +
    vector.explicitLoss * weights.explicitLoss
  );
}

/**
 * Evaluates the 7-dimensional objective vector for a candidate graph against dataset signature and intent.
 */
export function evaluateRepresentationObjectives(
  graph: RepresentationGraph,
  signature: DatasetSignature,
  context?: {
    task?: string;
    variablesOfInterest?: readonly string[];
    epistemicPurpose?: string;
  }
): RepresentationObjectiveVectorV1 {
  const primitiveCount = graph.primitives.length;
  const edgeCount = graph.edges.length;

  // 1. Task relevance: matches variables of interest and active intent task
  let taskRelevance = 0.5;
  if (context?.variablesOfInterest && context.variablesOfInterest.length > 0) {
    const mappedVars = new Set([
      ...Object.keys(graph.semanticMappings),
      ...graph.primitives.flatMap((p) => p.semanticInputs),
    ]);
    let matched = 0;
    for (const v of context.variablesOfInterest) {
      if (mappedVars.has(v)) matched++;
    }
    taskRelevance = Math.min(1.0, 0.4 + 0.6 * (matched / context.variablesOfInterest.length));
  } else if (context?.task) {
    taskRelevance = 0.75;
  }

  // 2. Information preservation: reward multi-primitive coverage of complex structures
  let informationPreservation = 0.5;
  const kinds = new Set(graph.primitives.map((p) => p.kind));
  if ((signature.schema.temporalCount ?? 0) > 0 && kinds.has('TEMPORAL')) {
    informationPreservation += 0.2;
  }
  const hasClusters =
    signature.clusterStructure?.hasClusters === true ||
    (signature.clusterStructure?.estimatedCount ?? 0) > 1;
  if (hasClusters && (kinds.has('CLUSTER') || kinds.has('MANIFOLD'))) {
    informationPreservation += 0.2;
  }
  if (signature.cardinality.rowCount > 500 && (kinds.has('DENSITY') || kinds.has('AGGREGATION'))) {
    informationPreservation += 0.15;
  }
  informationPreservation = Math.min(1.0, Math.max(0.1, informationPreservation));

  // 3. Perceptual recoverability: channel distinctiveness without visual conflict
  // Too many overlapping primitives degrades recoverability
  let perceptualRecoverability = 1.0;
  if (primitiveCount > 4) {
    perceptualRecoverability -= (primitiveCount - 4) * 0.1;
  }
  // Check for overlay congestion
  const overlayCount = graph.edges.filter((e) => e.relation === 'OVERLAY').length;
  if (overlayCount > 2) {
    perceptualRecoverability -= (overlayCount - 2) * 0.15;
  }
  perceptualRecoverability = Math.max(0.1, Math.min(1.0, perceptualRecoverability));

  // 4. Interaction cost: 1 = easy/minimal friction, 0 = high friction
  // More composition edges increases cognitive navigation cost
  let interactionCost = 1.0 - (edgeCount * 0.05 + primitiveCount * 0.08);
  interactionCost = Math.max(0.1, Math.min(1.0, interactionCost));

  // 5. Resource cost: 1 = lightweight, 0 = heavy
  // Complexity vs device envelope
  let resourceCost = 1.0 - (primitiveCount * 0.08 + edgeCount * 0.03);
  resourceCost = Math.max(0.1, Math.min(1.0, resourceCost));

  // 6. Stability: baseline stability from data characteristics
  let stability = 0.8;
  if (kinds.has('DENSITY') && signature.cardinality.rowCount < 20) {
    stability = 0.3; // density unstable on tiny N
  } else if (kinds.has('CLUSTER') && !hasClusters) {
    stability = 0.4;
  }

  // 7. Explicit loss: 1 = no loss, 0 = heavy loss
  // If primitives include AGGREGATION or FILTER, information is explicitly condensed
  let explicitLoss = 0.9;
  if (kinds.has('AGGREGATION')) {
    explicitLoss -= 0.25;
  }
  if (kinds.has('FILTER')) {
    explicitLoss -= 0.15;
  }
  explicitLoss = Math.max(0.1, Math.min(1.0, explicitLoss));

  return {
    taskRelevance,
    informationPreservation,
    perceptualRecoverability,
    interactionCost,
    resourceCost,
    stability,
    explicitLoss,
  };
}

/**
 * Explains objective trade-offs in human-readable terms for TechnoCore inspection.
 */
export function explainObjectiveTradeoffs(
  vector: RepresentationObjectiveVectorV1,
  preference: ObjectivePreference = 'BALANCED'
): string {
  const lines: string[] = [
    `Evaluation under [${preference}] profile:`,
    `- Task Relevance: ${(vector.taskRelevance * 100).toFixed(1)}%`,
    `- Info Preservation: ${(vector.informationPreservation * 100).toFixed(1)}%`,
    `- Perceptual Recoverability: ${(vector.perceptualRecoverability * 100).toFixed(1)}%`,
    `- Interaction Simplicity: ${(vector.interactionCost * 100).toFixed(1)}%`,
    `- Resource Efficiency: ${(vector.resourceCost * 100).toFixed(1)}%`,
    `- Empirical Stability: ${(vector.stability * 100).toFixed(1)}%`,
    `- Completeness (vs Loss): ${(vector.explicitLoss * 100).toFixed(1)}%`,
  ];

  if (vector.interactionCost < 0.5) {
    lines.push('Trade-off note: Higher compositional depth incurs additional interaction friction.');
  }
  if (vector.explicitLoss < 0.6) {
    lines.push('Trade-off note: Aggregation or filtering reduces raw element completeness to preserve perceptual clarity.');
  }
  if (vector.resourceCost < 0.5) {
    lines.push('Trade-off note: Multi-channel embodiment demands significant rendering budget on constrained XR hardware.');
  }

  return lines.join('\n');
}

/**
 * DeterministicReferenceComposer — Non-stochastic baseline composer for FM7.
 *
 * Constructs the canonical reference RepresentationGraph directly from dataset
 * signatures, semantic snapshot characteristics, and committed investigation context.
 * Serves as the reproducible benchmark against which synthesized candidates are compared.
 */

import type { DatasetSignature } from '../representation/DatasetSignature.ts';
import type {
  RepresentationGraph,
  RepresentationPrimitive,
  RepresentationCompositionEdge,
} from '../representation/RepresentationGraph.ts';
import { RepresentationGraphGrammar } from './RepresentationGraphGrammar.ts';
import type { CommittedInvestigationContextV2 } from '../../atlas/domain/CommittedInvestigationContext.ts';

export class DeterministicReferenceComposer {
  /**
   * Generates the canonical reference RepresentationGraph for a given signature and context.
   */
  public static composeReferenceGraph(
    signature: DatasetSignature,
    context?: CommittedInvestigationContextV2
  ): RepresentationGraph {
    const datasetFingerprint = signature.provenance.datasetFingerprint;
    const graphId = `ref-graph-${datasetFingerprint.slice(0, 8)}`;
    const base = RepresentationGraphGrammar.createEmptyGraph(graphId, datasetFingerprint, 'moneta');

    const primitives: RepresentationPrimitive[] = [];
    const edges: RepresentationCompositionEdge[] = [];
    const semanticMappings: Record<string, string> = {};

    const hasClusters =
      signature.clusterStructure?.hasClusters === true ||
      (signature.clusterStructure?.estimatedCount ?? 0) > 1;

    // 1. Primary spatial primitive based on dataset modality
    if ((signature.schema.temporalCount ?? 0) > 0) {
      primitives.push({
        id: 'prim-temporal-flow',
        kind: 'TEMPORAL',
        semanticInputs: ['time', 'primary_metric'],
        visualEncoding: { axis: 'x', progression: 'linear' },
        interactionAffordances: ['scrub', 'slice', 'window'],
        analyticalDependencies: ['temporal_order'],
        parameters: { stepSize: 1.0 },
        limitations: ['monotonic_time_assumed'],
      });
      semanticMappings['time_series'] = 'prim-temporal-flow';
    } else if (hasClusters) {
      primitives.push({
        id: 'prim-point-cloud',
        kind: 'POINT_IDENTITY',
        semanticInputs: ['dim1', 'dim2', 'dim3'],
        visualEncoding: { position: 'xyz', shape: 'sphere' },
        interactionAffordances: ['select', 'hover', 'brush'],
        analyticalDependencies: ['spatial_coordinates'],
        parameters: { pointSize: 0.05 },
        limitations: [],
      });
      semanticMappings['scatter_positions'] = 'prim-point-cloud';

      primitives.push({
        id: 'prim-cluster-partitions',
        kind: 'CLUSTER',
        semanticInputs: ['cluster_id'],
        visualEncoding: { color: 'categorical_palette', boundary: 'convex_hull' },
        interactionAffordances: ['isolate', 'aggregate'],
        analyticalDependencies: ['cluster_labels'],
        parameters: { opacity: 0.3 },
        limitations: [],
      });
      semanticMappings['cluster_assignments'] = 'prim-cluster-partitions';

      edges.push({
        from: 'prim-point-cloud',
        to: 'prim-cluster-partitions',
        relation: 'CONTAINS',
      });
    } else {
      primitives.push({
        id: 'prim-point-cloud',
        kind: 'POINT_IDENTITY',
        semanticInputs: ['dim1', 'dim2', 'dim3'],
        visualEncoding: { position: 'xyz', shape: 'sphere' },
        interactionAffordances: ['select', 'hover', 'brush'],
        analyticalDependencies: ['spatial_coordinates'],
        parameters: { pointSize: 0.05 },
        limitations: [],
      });
      semanticMappings['scatter_positions'] = 'prim-point-cloud';
    }

    // 2. High density secondary phenomenon
    if (signature.cardinality.rowCount > 1000) {
      primitives.push({
        id: 'prim-density-field',
        kind: 'DENSITY',
        semanticInputs: ['spatial_coordinates'],
        visualEncoding: { field: 'volumetric_fog', density: 'iso_surface' },
        interactionAffordances: ['threshold_adjust', 'iso_level'],
        analyticalDependencies: ['kde_estimate'],
        parameters: { bandwidth: 0.5 },
        limitations: ['smoothing_loss'],
      });
      semanticMappings['density_distribution'] = 'prim-density-field';

      edges.push({
        from: 'prim-density-field',
        to: 'prim-point-cloud',
        relation: 'OVERLAY',
      });
    }

    // 3. Variables of interest alignment from context
    if (context?.intent?.variablesOfInterest && primitives.length > 0) {
      for (const varName of context.intent.variablesOfInterest) {
        semanticMappings[varName] = primitives[0].id;
      }
    }

    return {
      ...base,
      primitives,
      edges,
      semanticMappings,
      constraints: ['evidence_protocol_v1', 'bounded_frame_budget'],
    };
  }
}

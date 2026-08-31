import { DATASET_EVIDENCE_SCHEMA_VERSION } from '../../data/evidence/DatasetEvidence.ts';
import {
  MONETA_REPRESENTATION_CANDIDATES,
  type SemanticRepresentationId,
} from './RepresentationCandidate.ts';
import type { RepresentationDecision } from './RepresentationDecision.ts';
import {
  REPRESENTATION_GRAPH_SCHEMA_VERSION,
  assertRepresentationGraph,
  type RepresentationGraph,
  type RepresentationPrimitive,
  type RepresentationPrimitiveKind,
} from './RepresentationGraph.ts';

export const BOOTSTRAP_REPRESENTATION_ONTOLOGY_VERSION = 'bootstrap-ontology-v2' as const;

const CANDIDATE_TO_PRIMITIVE: Record<SemanticRepresentationId, RepresentationPrimitiveKind> = {
  POINT_SET: 'POINT_IDENTITY',
  DENSITY_FIELD: 'DENSITY',
  DISTRIBUTION_FIELD: 'DISTRIBUTION',
  CLUSTER_REGIONS: 'CLUSTER',
  AGGREGATE_VOLUME: 'AGGREGATION',
  TEMPORAL_TRAJECTORY: 'TRAJECTORY',
  HIERARCHICAL_SPACE: 'HIERARCHY',
  RELATIONSHIP_GRAPH: 'GRAPH',
  MATRIX_FIELD: 'MATRIX',
  MANIFOLD_EMBEDDING: 'MANIFOLD',
  SPATIAL_REGION: 'FIELD',
  MULTISCALE_FIELD: 'FIELD',
};

function candidateId(decision: RepresentationDecision): SemanticRepresentationId {
  const explicit = decision.chosenCandidateId;
  if (explicit) return explicit;

  const ranked = decision.rankedCandidates?.find((candidate) => !candidate.disqualified);
  if (ranked) return ranked.candidateId;

  throw new Error('Cannot compile RepresentationGraph: RepresentationDecision has no chosen candidate');
}

function primaryPrimitive(
  decision: RepresentationDecision,
  id: SemanticRepresentationId,
): RepresentationPrimitive {
  const candidate = MONETA_REPRESENTATION_CANDIDATES[id];
  const layout = decision.chosenLayout ?? decision.embodiment.primaryLayout;

  return {
    id: `primary:${id.toLowerCase()}`,
    kind: CANDIDATE_TO_PRIMITIVE[id],
    semanticInputs: candidate.supports,
    visualEncoding: {
      candidateId: id,
      family: decision.chosenFamily ?? decision.representationFamily,
      layout,
      geometry: decision.embodiment.primaryGeometry,
      behavior: decision.embodiment.primaryBehavior,
      interaction: decision.embodiment.primaryInteraction,
    },
    interactionAffordances: candidate.interactionCharacteristics.supportedInteractions,
    analyticalDependencies: candidate.supports.map((capability) => `capability:${capability}`),
    parameters: {
      minN: candidate.scaleCharacteristics.minN,
      maxN: candidate.scaleCharacteristics.maxN,
      scalabilityRating: candidate.scaleCharacteristics.scalabilityRating,
      utilityScore: decision.utilityScore,
    },
    limitations: [
      ...candidate.loses.map((loss) => `information-loss:${loss}`),
      ...candidate.constraints.map((constraint) => constraint.description),
    ],
  };
}

/**
 * Compatibility compiler from the current single-winner Moneta decision into
 * the V3 RepresentationGraph boundary.
 *
 * This is deliberately labelled `compatibility-adapter`: it creates a graph
 * representation of today's decision without claiming Moneta is already doing
 * open-ended compositional search.
 */
export function representationDecisionToGraph(
  decision: RepresentationDecision,
): RepresentationGraph {
  const chosenCandidateId = candidateId(decision);
  const primary = primaryPrimitive(decision, chosenCandidateId);
  const primitives: RepresentationPrimitive[] = [primary];
  const edges: RepresentationGraph['edges'] extends readonly (infer T)[] ? T[] : never = [];

  if (decision.progressiveDisclosurePolicy) {
    const detail: RepresentationPrimitive = {
      id: 'detail:progressive-disclosure',
      kind: 'DETAIL_EXPANSION',
      semanticInputs: ['researcher-detail-request'],
      visualEncoding: { mode: 'progressive-disclosure' },
      interactionAffordances: ['EXPAND_DETAIL', 'COLLAPSE'],
      analyticalDependencies: [],
      parameters: {},
      limitations: [],
    };
    primitives.push(detail);
    edges.push({ from: detail.id, to: primary.id, relation: 'DETAIL_OF' });
  }

  const semanticMappings: Record<string, string> = {};
  for (const capability of MONETA_REPRESENTATION_CANDIDATES[chosenCandidateId].supports) {
    semanticMappings[capability] = primary.id;
  }

  const graph: RepresentationGraph = {
    schemaVersion: REPRESENTATION_GRAPH_SCHEMA_VERSION,
    graphId:
      decision.id ??
      `compat:${decision.provenance.datasetFingerprint}:${chosenCandidateId}:${decision.fitnessModelVersion ?? decision.provenance.fitnessModelVersion ?? 'unknown'}`,
    primitives,
    edges,
    semanticMappings,
    layoutPolicy: decision.chosenLayout ?? decision.embodiment.primaryLayout,
    scalePolicy: decision.scalePolicy ? 'moneta-explicit-scale-policy' : 'candidate-default-scale',
    interactionPolicy: 'candidate-supported-interactions',
    detailPolicy: decision.progressiveDisclosurePolicy ? 'progressive-disclosure' : 'direct-detail',
    constraints: MONETA_REPRESENTATION_CANDIDATES[chosenCandidateId].constraints.map(
      (constraint) => constraint.description,
    ),
    provenance: {
      ontologyVersion: BOOTSTRAP_REPRESENTATION_ONTOLOGY_VERSION,
      fitnessModelVersion:
        decision.fitnessModelVersion ?? decision.provenance.fitnessModelVersion ?? decision.provenance.version,
      datasetFingerprint: decision.provenance.datasetFingerprint,
      evidenceSchemaVersion: DATASET_EVIDENCE_SCHEMA_VERSION,
      generatedBy: 'compatibility-adapter',
    },
  };

  assertRepresentationGraph(graph);
  return graph;
}

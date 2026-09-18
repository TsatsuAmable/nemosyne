import type { InformationType } from './RepresentationCandidate.ts';
import type { SemanticAbstractionLevel } from './SemanticAbstraction.ts';

export const SEMANTIC_EMBODIMENT_GRAPH_SCHEMA_VERSION = 1 as const;

export type SemanticEmbodimentKind =
  | 'DATASET'
  | 'POPULATION'
  | 'DISTRIBUTION'
  | 'DENSITY'
  | 'CLUSTER'
  | 'RELATIONSHIP'
  | 'TEMPORAL'
  | 'TOPOLOGY'
  | 'UNCERTAINTY'
  | 'SUBSET'
  | 'OBSERVATION';

export interface SemanticEmbodimentNodeV1 {
  id: string;
  kind: SemanticEmbodimentKind;
  abstractionLevel: SemanticAbstractionLevel;
  parentId?: string;
  childIds: readonly string[];
  refinementTargetIds: readonly string[];
  preserves: readonly InformationType[];
  loses: readonly InformationType[];
  evidenceRefs: readonly string[];
  presentationHints?: Readonly<Record<string, string | number | boolean>>;
}

export interface SemanticEmbodimentGraphV1 {
  schemaVersion: typeof SEMANTIC_EMBODIMENT_GRAPH_SCHEMA_VERSION;
  graphId: string;
  datasetFingerprint: string;
  decisionId: string;
  provenanceRef: string;
  rootNodeIds: readonly string[];
  nodes: readonly SemanticEmbodimentNodeV1[];
}

export interface SemanticEmbodimentGraphValidation {
  ok: boolean;
  errors: readonly string[];
}

export function validateSemanticEmbodimentGraphV1(
  graph: SemanticEmbodimentGraphV1
): SemanticEmbodimentGraphValidation {
  const errors: string[] = [];
  if (graph.schemaVersion !== 1) errors.push('UNSUPPORTED_SCHEMA_VERSION');
  for (const [name, value] of [['graphId', graph.graphId], ['datasetFingerprint', graph.datasetFingerprint], ['decisionId', graph.decisionId], ['provenanceRef', graph.provenanceRef]] as const) {
    if (!value.trim()) errors.push(`MISSING_${name.toUpperCase()}`);
  }
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (!node.id.trim()) errors.push('MISSING_NODE_ID');
    else if (ids.has(node.id)) errors.push(`DUPLICATE_NODE_ID:${node.id}`);
    ids.add(node.id);
    if (node.preserves.some((v) => node.loses.includes(v))) errors.push(`CONTRADICTORY_INFORMATION_CONTRACT:${node.id}`);
    if (node.presentationHints && Object.keys(node.presentationHints).length > 16) errors.push(`PRESENTATION_HINT_BOUND_EXCEEDED:${node.id}`);
    if (node.evidenceRefs.length > 64) errors.push(`EVIDENCE_REF_BOUND_EXCEEDED:${node.id}`);
  }
  const refs = (node: SemanticEmbodimentNodeV1) => [
    ...(node.parentId ? [node.parentId] : []),
    ...node.childIds,
    ...node.refinementTargetIds,
  ];
  for (const root of graph.rootNodeIds) if (!ids.has(root)) errors.push(`DANGLING_ROOT:${root}`);
  for (const node of graph.nodes) for (const ref of refs(node)) if (!ids.has(ref)) errors.push(`DANGLING_NODE_REF:${node.id}->${ref}`);
  for (const node of graph.nodes) {
    for (const child of node.childIds) {
      const target = graph.nodes.find((candidate) => candidate.id === child);
      if (target && target.parentId !== node.id) errors.push(`ASYMMETRIC_PARENT_CHILD:${node.id}->${child}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

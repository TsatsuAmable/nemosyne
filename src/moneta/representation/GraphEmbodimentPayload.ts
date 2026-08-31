import type {
  AnalyticalMethodV1,
  ApproximationV1,
  InformationContractV1,
  ResourceEnvelopeV1,
  SemanticPayloadProvenanceV1,
  SemanticRefusalV1,
} from './SemanticEmbodimentPayload.ts';
import type { SourceGraphDirectionality, SourceRelationshipGraphAuthority } from './RelationshipGraphAuthority.ts';
import { SOURCE_RELATIONSHIP_GRAPH_V1_LIMITS } from './RelationshipGraphAuthority.ts';

export const MAX_RELATIONSHIP_GRAPH_NODES_V1 = SOURCE_RELATIONSHIP_GRAPH_V1_LIMITS.maxNodes;
export const MAX_RELATIONSHIP_GRAPH_EDGES_V1 = SOURCE_RELATIONSHIP_GRAPH_V1_LIMITS.maxEdges;
export const MAX_RELATIONSHIP_GRAPH_PAYLOAD_BYTES_V1 =
  SOURCE_RELATIONSHIP_GRAPH_V1_LIMITS.maxPayloadBytes;

/**
 * R2E resident source-graph request contract. The production path transports
 * only the strict B1 graph authority and decision provenance; the resident
 * Rust/WASM authority owns endpoint resolution, topology retention, semantic
 * identity minting and all resource bounds. TypeScript performs no graph work.
 */
export interface GraphEmbodimentRequestV1 {
  schemaVersion: 1;
  candidateId: 'RELATIONSHIP_GRAPH';
  graphAuthority: SourceRelationshipGraphAuthority;
  decisionId?: string;
  decisionModelVersion?: string;
  decisionModelArtifactHash?: string;
}

export interface GraphObservationCountsV1 {
  sourceNodeCount: number;
  sourceEdgeCount: number;
  retainedNodeCount: number;
  retainedEdgeCount: number;
  refusedEdgeCount: number;
}

export interface GraphNodeV1 {
  semanticId: string;
  sourceRowId: string;
}

/**
 * Edges reference nodes by index into the payload's canonical node list
 * (durable row IDs ascending), which is stable under row-preserving source
 * reorders. `weight` is absent when the source edge declared none.
 */
export interface GraphEdgeV1 {
  semanticId: string;
  sourceNodeIndex: number;
  targetNodeIndex: number;
  weight?: number;
}

export interface RelationshipGraphPayloadV1 {
  directionality: SourceGraphDirectionality;
  counts: GraphObservationCountsV1;
  nodes: GraphNodeV1[];
  edges: GraphEdgeV1[];
}

export type GraphEmbodimentResultV1 =
  | {
      status: 'READY';
      payload: { kind: 'RELATIONSHIP_GRAPH'; data: RelationshipGraphPayloadV1 };
    }
  | { status: 'REFUSED'; refusal: SemanticRefusalV1 };

export interface GraphEmbodimentEnvelopeV1 {
  schemaVersion: 1;
  datasetFingerprint: string;
  candidateId: 'RELATIONSHIP_GRAPH';
  representationFamily: 'GRAPH';
  analyticalMethod: AnalyticalMethodV1;
  approximation: ApproximationV1;
  informationContract: InformationContractV1;
  resource: ResourceEnvelopeV1;
  provenance: SemanticPayloadProvenanceV1;
  result: GraphEmbodimentResultV1;
}
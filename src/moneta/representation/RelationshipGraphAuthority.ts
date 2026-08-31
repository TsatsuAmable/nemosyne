/**
 * P1-R2E / Stream B source-authoritative Relationship Graph V1 contract.
 *
 * This file freezes the authority/resource vocabulary before B2 adds a resident
 * Rust/WASM payload builder. It deliberately does not derive graph topology,
 * perform layout, or make RELATIONSHIP_GRAPH production-capable by itself.
 *
 * Scientific boundary:
 * - graph edges come only from Dataset.edges;
 * - force layout, proximity, correlation, k-NN and visual grouping are never
 *   edge authority;
 * - all source rows are candidate graph nodes, including isolated nodes;
 * - numeric endpoints are zero-based source-row positions;
 * - string endpoints are durable source row IDs and must resolve exactly;
 * - unresolved endpoints fail closed in V1 rather than silently deleting edges;
 * - edge weight is the only V1 analytical edge attribute. Arbitrary source
 *   metadata may be retained for provenance later, but may not affect topology
 *   or analytical meaning without a separately governed contract.
 */

export const SOURCE_RELATIONSHIP_GRAPH_AUTHORITY_KIND = 'SOURCE_EDGES' as const;

export const SOURCE_RELATIONSHIP_GRAPH_V1_LIMITS = Object.freeze({
  maxNodes: 4096,
  maxEdges: 16384,
  maxPayloadBytes: 2 * 1024 * 1024,
});

export const SOURCE_RELATIONSHIP_GRAPH_V1_EDGE_ATTRIBUTES = Object.freeze(['weight'] as const);

export type SourceGraphDirectionality = 'DIRECTED' | 'UNDIRECTED';
export type SourceGraphMissingEndpointPolicy = 'REFUSE';
export type SourceGraphParallelEdgePolicy = 'PRESERVE';
export type SourceGraphSelfLoopPolicy = 'PRESERVE';

export interface SourceRelationshipGraphAuthority {
  kind: typeof SOURCE_RELATIONSHIP_GRAPH_AUTHORITY_KIND;
  directionality: SourceGraphDirectionality;
  nodeIdentity: 'DATASET_ROW';
  missingEndpointPolicy: SourceGraphMissingEndpointPolicy;
  parallelEdgePolicy: SourceGraphParallelEdgePolicy;
  selfLoopPolicy: SourceGraphSelfLoopPolicy;
}

export class SourceRelationshipGraphContractError extends Error {
  constructor(message: string) {
    super(`SourceRelationshipGraphAuthority: ${message}`);
    this.name = 'SourceRelationshipGraphContractError';
  }
}

export function createSourceRelationshipGraphAuthority(
  directionality: SourceGraphDirectionality
): SourceRelationshipGraphAuthority {
  return {
    kind: SOURCE_RELATIONSHIP_GRAPH_AUTHORITY_KIND,
    directionality,
    nodeIdentity: 'DATASET_ROW',
    missingEndpointPolicy: 'REFUSE',
    parallelEdgePolicy: 'PRESERVE',
    selfLoopPolicy: 'PRESERVE',
  };
}

export function validateSourceRelationshipGraphAuthority(
  input: unknown
): SourceRelationshipGraphAuthority {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new SourceRelationshipGraphContractError('authority must be an object');
  }

  const value = input as Record<string, unknown>;
  const allowedKeys = new Set([
    'kind',
    'directionality',
    'nodeIdentity',
    'missingEndpointPolicy',
    'parallelEdgePolicy',
    'selfLoopPolicy',
  ]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new SourceRelationshipGraphContractError(`unknown authority field ${key}`);
    }
  }

  if (value.kind !== SOURCE_RELATIONSHIP_GRAPH_AUTHORITY_KIND) {
    throw new SourceRelationshipGraphContractError('kind must be SOURCE_EDGES');
  }
  if (value.directionality !== 'DIRECTED' && value.directionality !== 'UNDIRECTED') {
    throw new SourceRelationshipGraphContractError(
      'directionality must be DIRECTED or UNDIRECTED'
    );
  }
  if (value.nodeIdentity !== 'DATASET_ROW') {
    throw new SourceRelationshipGraphContractError('nodeIdentity must be DATASET_ROW');
  }
  if (value.missingEndpointPolicy !== 'REFUSE') {
    throw new SourceRelationshipGraphContractError('missingEndpointPolicy must be REFUSE in V1');
  }
  if (value.parallelEdgePolicy !== 'PRESERVE') {
    throw new SourceRelationshipGraphContractError('parallelEdgePolicy must be PRESERVE in V1');
  }
  if (value.selfLoopPolicy !== 'PRESERVE') {
    throw new SourceRelationshipGraphContractError('selfLoopPolicy must be PRESERVE in V1');
  }

  return value as unknown as SourceRelationshipGraphAuthority;
}

export function validateSourceGraphEndpoint(endpoint: unknown): string | number {
  if (typeof endpoint === 'number') {
    if (!Number.isSafeInteger(endpoint) || endpoint < 0) {
      throw new SourceRelationshipGraphContractError(
        'numeric endpoints must be non-negative safe-integer source-row positions'
      );
    }
    return endpoint;
  }

  if (typeof endpoint === 'string') {
    if (endpoint.length === 0 || endpoint.trim() !== endpoint) {
      throw new SourceRelationshipGraphContractError(
        'string endpoints must be non-empty durable row IDs without surrounding whitespace'
      );
    }
    return endpoint;
  }

  throw new SourceRelationshipGraphContractError(
    'endpoints must be numeric row positions or durable string row IDs'
  );
}

export function assertSourceRelationshipGraphResourceEnvelope(
  nodeCount: number,
  edgeCount: number,
  payloadBytes?: number
): void {
  if (!Number.isSafeInteger(nodeCount) || nodeCount < 0) {
    throw new SourceRelationshipGraphContractError('nodeCount must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(edgeCount) || edgeCount < 0) {
    throw new SourceRelationshipGraphContractError('edgeCount must be a non-negative safe integer');
  }
  if (nodeCount > SOURCE_RELATIONSHIP_GRAPH_V1_LIMITS.maxNodes) {
    throw new SourceRelationshipGraphContractError(
      `node count ${nodeCount} exceeds V1 limit ${SOURCE_RELATIONSHIP_GRAPH_V1_LIMITS.maxNodes}`
    );
  }
  if (edgeCount > SOURCE_RELATIONSHIP_GRAPH_V1_LIMITS.maxEdges) {
    throw new SourceRelationshipGraphContractError(
      `edge count ${edgeCount} exceeds V1 limit ${SOURCE_RELATIONSHIP_GRAPH_V1_LIMITS.maxEdges}`
    );
  }
  if (payloadBytes !== undefined) {
    if (!Number.isSafeInteger(payloadBytes) || payloadBytes < 0) {
      throw new SourceRelationshipGraphContractError(
        'payloadBytes must be a non-negative safe integer when supplied'
      );
    }
    if (payloadBytes > SOURCE_RELATIONSHIP_GRAPH_V1_LIMITS.maxPayloadBytes) {
      throw new SourceRelationshipGraphContractError(
        `payload bytes ${payloadBytes} exceeds V1 limit ${SOURCE_RELATIONSHIP_GRAPH_V1_LIMITS.maxPayloadBytes}`
      );
    }
  }
}

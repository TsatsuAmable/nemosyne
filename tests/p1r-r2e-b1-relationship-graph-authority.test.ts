import { describe, expect, it } from 'vitest';
import {
  SOURCE_RELATIONSHIP_GRAPH_V1_EDGE_ATTRIBUTES,
  SOURCE_RELATIONSHIP_GRAPH_V1_LIMITS,
  assertSourceRelationshipGraphResourceEnvelope,
  createSourceRelationshipGraphAuthority,
  validateSourceGraphEndpoint,
  validateSourceRelationshipGraphAuthority,
} from '../src/moneta/representation/RelationshipGraphAuthority.ts';

describe('P1-R2E B1 source-authoritative relationship graph contract', () => {
  it('requires an explicit source-edge authority with declared directionality', () => {
    expect(validateSourceRelationshipGraphAuthority(
      createSourceRelationshipGraphAuthority('DIRECTED')
    )).toEqual({
      kind: 'SOURCE_EDGES',
      directionality: 'DIRECTED',
      nodeIdentity: 'DATASET_ROW',
      missingEndpointPolicy: 'REFUSE',
      parallelEdgePolicy: 'PRESERVE',
      selfLoopPolicy: 'PRESERVE',
    });

    expect(() => validateSourceRelationshipGraphAuthority({
      kind: 'SOURCE_EDGES',
      directionality: 'INFER',
      nodeIdentity: 'DATASET_ROW',
      missingEndpointPolicy: 'REFUSE',
      parallelEdgePolicy: 'PRESERVE',
      selfLoopPolicy: 'PRESERVE',
    })).toThrow(/directionality/i);
  });

  it('rejects policy widening that could silently change source topology', () => {
    expect(() => validateSourceRelationshipGraphAuthority({
      ...createSourceRelationshipGraphAuthority('UNDIRECTED'),
      missingEndpointPolicy: 'DROP',
    })).toThrow(/missingEndpointPolicy must be REFUSE/i);

    expect(() => validateSourceRelationshipGraphAuthority({
      ...createSourceRelationshipGraphAuthority('UNDIRECTED'),
      parallelEdgePolicy: 'COLLAPSE',
    })).toThrow(/parallelEdgePolicy must be PRESERVE/i);

    expect(() => validateSourceRelationshipGraphAuthority({
      ...createSourceRelationshipGraphAuthority('UNDIRECTED'),
      selfLoopPolicy: 'DROP',
    })).toThrow(/selfLoopPolicy must be PRESERVE/i);
  });

  it('defines numeric endpoints as source-row positions and strings as durable row IDs', () => {
    expect(validateSourceGraphEndpoint(0)).toBe(0);
    expect(validateSourceGraphEndpoint(42)).toBe(42);
    expect(validateSourceGraphEndpoint('row-7f')).toBe('row-7f');

    for (const invalid of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, '', ' padded ', null, {}]) {
      expect(() => validateSourceGraphEndpoint(invalid)).toThrow();
    }
  });

  it('freezes a bounded V1 node, edge and payload envelope', () => {
    expect(SOURCE_RELATIONSHIP_GRAPH_V1_LIMITS).toEqual({
      maxNodes: 4096,
      maxEdges: 16384,
      maxPayloadBytes: 2 * 1024 * 1024,
    });

    expect(() => assertSourceRelationshipGraphResourceEnvelope(4096, 16384, 2 * 1024 * 1024))
      .not.toThrow();
    expect(() => assertSourceRelationshipGraphResourceEnvelope(4097, 1)).toThrow(/node count/i);
    expect(() => assertSourceRelationshipGraphResourceEnvelope(1, 16385)).toThrow(/edge count/i);
    expect(() => assertSourceRelationshipGraphResourceEnvelope(1, 1, 2 * 1024 * 1024 + 1))
      .toThrow(/payload bytes/i);
  });

  it('allows only source weight as a V1 analytical edge attribute', () => {
    expect(SOURCE_RELATIONSHIP_GRAPH_V1_EDGE_ATTRIBUTES).toEqual(['weight']);
  });

  it('rejects unknown authority fields rather than accepting future semantics accidentally', () => {
    expect(() => validateSourceRelationshipGraphAuthority({
      ...createSourceRelationshipGraphAuthority('DIRECTED'),
      inferMissingEdges: true,
    })).toThrow(/unknown authority field inferMissingEdges/i);
  });
});

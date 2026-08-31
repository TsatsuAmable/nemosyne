import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import { buildGraphSemanticEmbodimentV1 } from '../src/wasm/runtime/SemanticEmbodimentBridge.ts';
import {
  MAX_RELATIONSHIP_GRAPH_EDGES_V1,
  MAX_RELATIONSHIP_GRAPH_NODES_V1,
  type GraphEmbodimentEnvelopeV1,
  type GraphEmbodimentRequestV1,
  type RelationshipGraphPayloadV1,
} from '../src/moneta/representation/GraphEmbodimentPayload.ts';
import { createSourceRelationshipGraphAuthority } from '../src/moneta/representation/RelationshipGraphAuthority.ts';
import { loadGraphSemanticEmbodiment } from '../src/app/dataset/SemanticEmbodimentLoader.ts';
import { Dataset } from '../src/data/Dataset.ts';
import type {
  AnalyticalDatasetRegistration,
  AnalyticalExecutionPort,
  AnalyticalExecutionRequest,
  AnalyticalExecutionResult,
} from '../src/atlas/ports/AnalyticalExecutionPort.ts';
import type { RepresentationDecision } from '../src/moneta/representation/RepresentationDecision.ts';
import type { SemanticEmbodimentAuthority } from '../src/app/dataset/SemanticEmbodimentLoader.ts';

const RAW_ROW_SENTINEL = 'B2_GRAPH_RAW_ROW_DECOY';

function request(directionality: 'DIRECTED' | 'UNDIRECTED' = 'DIRECTED'): GraphEmbodimentRequestV1 {
  return {
    schemaVersion: 1,
    candidateId: 'RELATIONSHIP_GRAPH',
    graphAuthority: createSourceRelationshipGraphAuthority(directionality),
    decisionId: 'decision-graph-b2-wasm',
    decisionModelVersion: 'bootstrap-fitness-v5',
  };
}

function payload(envelope: GraphEmbodimentEnvelopeV1 | null): RelationshipGraphPayloadV1 {
  if (envelope?.result.status !== 'READY') {
    throw new Error(
      `expected READY graph payload, got ${envelope?.result.status ?? 'null envelope'}`
    );
  }
  if (envelope.result.payload.kind !== 'RELATIONSHIP_GRAPH') {
    throw new Error('expected RELATIONSHIP_GRAPH payload');
  }
  return envelope.result.payload.data;
}

function graphDataset(
  name: string,
  rowIds: string[],
  edges: Array<{ source: string | number; target: string | number; weight?: number }>
): number {
  return bridge.loadDatasetJson({
    name,
    columns: [
      { name: 'identity', type: 'CATEGORICAL' },
      { name: 'x', type: 'NUMERIC' },
    ],
    rows: rowIds.map((_rowId, index) => ({
      identity: RAW_ROW_SENTINEL,
      x: index,
    })),
    rowIds,
    edges,
  });
}

const originalSelf = globalThis.self;

interface TestWorkerScope {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
}

let workerScope: TestWorkerScope | null = null;

describe('P1-R2E B2 resident Rust/WASM source-relationship-graph payload', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) throw new Error('R2E B2 requires the real WASM runtime');

    // Install the real analytical Worker handler once against a stubbed
    // `self`; the module registers its handler at import time, so every
    // worker-path test must share this single scope.
    const scope: TestWorkerScope = { onmessage: null, postMessage: vi.fn() };
    vi.stubGlobal('self', scope);
    try {
      await import('../src/atlas/ports/analytical.worker.ts');
      if (!scope.onmessage) {
        throw new Error('analytical Worker did not install its message handler');
      }
      workerScope = scope;
    } finally {
      vi.stubGlobal('self', originalSelf);
    }
  });

  function workerHandler(): (event: MessageEvent) => void {
    if (!workerScope?.onmessage) throw new Error('analytical Worker handler unavailable');
    return workerScope.onmessage;
  }

  it('pins the resident-authority source structure and strict TS transport wiring', () => {
    const rust = readFileSync('wasm/src/moneta/graph_embodiment.rs', 'utf8');
    const bridgeSource = readFileSync('src/wasm/runtime/SemanticEmbodimentBridge.ts', 'utf8');
    const worker = readFileSync('src/atlas/ports/analytical.worker.ts', 'utf8');
    expect(rust).toContain('data::with_dataset');
    expect(rust).toContain('deny_unknown_fields');
    expect(rust).toContain('semantic_node_id');
    expect(rust).toContain('semantic_edge_id');
    expect(rust).toContain('MAX_RELATIONSHIP_GRAPH_PAYLOAD_BYTES_V1');
    expect(bridgeSource).toContain('moneta_build_graph_embodiment_v1');
    expect(worker).toContain("req.params.candidateId === 'RELATIONSHIP_GRAPH'");
    expect(worker).toContain('buildGraphSemanticEmbodimentV1(');
  });

  it('preserves source topology exactly with deterministic semantic identity', () => {
    const handle = graphDataset(
      'b2-graph-reference',
      ['r0', 'r1', 'r2', 'r3', 'r4'],
      [
        { source: 0, target: 1, weight: 1 },
        { source: 'r1', target: 'r2' },
        { source: 0, target: 1, weight: 1 },
        { source: 0, target: 1, weight: 2.5 },
        { source: 3, target: 3 },
      ]
    );
    expect(handle).toBeGreaterThan(0);
    try {
      const envelope = buildGraphSemanticEmbodimentV1(handle, request());
      expect(envelope?.datasetFingerprint).toBe(bridge.datasetFingerprint(handle));
      expect(envelope?.candidateId).toBe('RELATIONSHIP_GRAPH');
      expect(envelope?.representationFamily).toBe('GRAPH');
      expect(envelope?.analyticalMethod).toEqual({
        name: 'source-relationship-graph',
        version: 'source-relationship-graph-v1',
        parameters: {
          authorityKind: 'SOURCE_EDGES',
          nodeIdentity: 'DATASET_ROW',
          missingEndpointPolicy: 'REFUSE',
          parallelEdgePolicy: 'PRESERVE',
          selfLoopPolicy: 'PRESERVE',
          directionality: 'DIRECTED',
          endpointVocabulary: 'numeric-row-position-or-durable-row-id',
          edgeAttributes: ['weight'],
          missingWeightPolicy: 'absent',
          nonFiniteWeightPolicy: 'refuse-payload',
          maxNodes: MAX_RELATIONSHIP_GRAPH_NODES_V1,
          maxEdges: MAX_RELATIONSHIP_GRAPH_EDGES_V1,
          maxPayloadBytes: 2 * 1024 * 1024,
        },
      });
      expect(envelope?.provenance.algorithmVersion).toBe('source-graph-topology-v1');
      expect(envelope?.approximation.mode).toBe('EXACT');
      expect(envelope?.resource).toEqual({
        sourceRowCount: 5,
        elementCount: 5,
        maxElementCount: MAX_RELATIONSHIP_GRAPH_EDGES_V1,
      });

      const graph = payload(envelope);
      expect(graph.directionality).toBe('DIRECTED');
      expect(graph.counts).toEqual({
        sourceNodeCount: 5,
        sourceEdgeCount: 5,
        retainedNodeCount: 5,
        retainedEdgeCount: 5,
        refusedEdgeCount: 0,
      });
      // every row, including the isolated r4, is retained as exactly one node
      expect(graph.nodes.map((node) => node.sourceRowId)).toEqual(['r0', 'r1', 'r2', 'r3', 'r4']);
      expect(new Set(graph.nodes.map((node) => node.semanticId)).size).toBe(5);
      expect(graph.nodes.every((node) => node.semanticId.startsWith('graph-node:'))).toBe(true);

      // deterministic (endpoints, weight, position) order with exact multiplicity
      expect(graph.edges.map((edge) => [
        edge.sourceNodeIndex,
        edge.targetNodeIndex,
        edge.weight ?? null,
      ])).toEqual([
        [0, 1, 1],
        [0, 1, 1],
        [0, 1, 2.5],
        [1, 2, null],
        [3, 3, null],
      ]);
      expect(new Set(graph.edges.map((edge) => edge.semanticId)).size).toBe(5);
      expect(graph.edges.every((edge) => edge.semanticId.startsWith('graph-edge:'))).toBe(true);

      // no raw source row payload crosses out of the kernel
      const serialized = JSON.stringify(envelope);
      expect(serialized).not.toContain(RAW_ROW_SENTINEL);
      expect(serialized).not.toContain('"rows"');
      // a second build from the same resident handle is byte-identical
      expect(buildGraphSemanticEmbodimentV1(handle, request())).toEqual(envelope);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('keeps semantic identity independent of source row order and declared edge order', () => {
    const forward = graphDataset('b2-graph-order-one', ['a', 'b', 'c', 'd'], [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'a' },
    ]);
    const reversed = graphDataset('b2-graph-order-two', ['d', 'c', 'b', 'a'], [
      { source: 'c', target: 'a' },
      { source: 'b', target: 'c' },
      { source: 'a', target: 'b' },
    ]);
    try {
      const forwardEnvelope = buildGraphSemanticEmbodimentV1(forward, request());
      const reverseEnvelope = buildGraphSemanticEmbodimentV1(reversed, request());
      expect(forwardEnvelope?.datasetFingerprint).not.toBe(reverseEnvelope?.datasetFingerprint);
      expect(payload(forwardEnvelope)).toEqual(payload(reverseEnvelope));
    } finally {
      bridge.destroyDataset(forward);
      bridge.destroyDataset(reversed);
    }
  });

  it('canonicalizes undirected endpoints without collapsing parallel multiplicity', () => {
    const handle = graphDataset('b2-graph-undirected', ['a', 'b', 'c'], [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'a' },
      { source: 'b', target: 'c' },
    ]);
    try {
      const graph = payload(buildGraphSemanticEmbodimentV1(handle, request('UNDIRECTED')));
      expect(graph.directionality).toBe('UNDIRECTED');
      expect(graph.edges).toHaveLength(3);
      expect(
        graph.edges.every((edge) => edge.sourceNodeIndex <= edge.targetNodeIndex)
      ).toBe(true);
      const pair = graph.edges.filter(
        (edge) => edge.sourceNodeIndex === 0 && edge.targetNodeIndex === 1
      );
      expect(pair).toHaveLength(2);
      expect(pair[0].semanticId).not.toBe(pair[1].semanticId);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('refuses unresolved endpoints, missing edges and envelope overruns fail-closed', () => {
    const unresolved = graphDataset('b2-graph-unresolved', ['a', 'b'], [
      { source: 0, target: 1 },
      { source: 0, target: 1 },
      { source: 'a', target: 'missing-row' },
    ]);
    try {
      const envelope = buildGraphSemanticEmbodimentV1(unresolved, request());
      expect(envelope?.result.status).toBe('REFUSED');
      if (envelope?.result.status === 'REFUSED') {
        // estimate reports the source edge count (3), not the failing edge's
        // position (2); the failing edge is named in the message instead
        expect(envelope.result.refusal).toMatchObject({
          code: 'MISSING_EVIDENCE',
          estimatedElements: 3,
        });
        expect(envelope.result.refusal.message).toContain('durable row ID');
      }
      // REFUSE policy rejects the whole payload: nothing partial is emitted
      expect(envelope?.resource.elementCount).toBe(0);
    } finally {
      bridge.destroyDataset(unresolved);
    }

    // Out-of-range numeric endpoints fail even earlier: the resident dataset
    // constructor validates row positions eagerly, so no handle exists for the
    // builder to inspect. The string-endpoint case above exercises the
    // builder-level REFUSE policy; this one pins the registration boundary.
    const numericMiss = graphDataset('b2-graph-numeric-miss', ['a', 'b'], [
      { source: 0, target: 99 },
    ]);
    expect(numericMiss).toBe(0);

    const noEdges = graphDataset('b2-graph-no-edges', ['a', 'b'], []);
    try {
      const envelope = buildGraphSemanticEmbodimentV1(noEdges, request());
      expect(envelope?.result.status).toBe('REFUSED');
      if (envelope?.result.status === 'REFUSED') {
        expect(envelope.result.refusal.code).toBe('MISSING_EVIDENCE');
        expect(envelope.result.refusal.message).toContain('source-provided edge');
      }
    } finally {
      bridge.destroyDataset(noEdges);
    }

    const overNodes = graphDataset(
      'b2-graph-over-nodes',
      Array.from({ length: MAX_RELATIONSHIP_GRAPH_NODES_V1 + 1 }, (_, index) => `n${index}`),
      [{ source: 0, target: 1 }]
    );
    try {
      const envelope = buildGraphSemanticEmbodimentV1(overNodes, request());
      expect(envelope?.result.status).toBe('REFUSED');
      if (envelope?.result.status === 'REFUSED') {
        expect(envelope.result.refusal).toMatchObject({
          code: 'RESOURCE_LIMIT',
          estimatedElements: MAX_RELATIONSHIP_GRAPH_NODES_V1 + 1,
        });
      }
    } finally {
      bridge.destroyDataset(overNodes);
    }
  });

  it('binds source topology through the real analytical Worker and resident Rust path', async () => {
    const scope = workerScope;
    if (!scope) throw new Error('analytical Worker scope unavailable');
    const handler = workerHandler();
    vi.stubGlobal('self', scope);
    scope.postMessage.mockClear();
    try {
      const data = new Dataset(
        'b2-worker-graph',
        [
          { name: 'identity', type: 'CATEGORICAL' },
          { name: 'x', type: 'NUMERIC' },
        ],
        [
          { identity: 'alpha', x: 0 },
          { identity: 'beta', x: 1 },
          { identity: 'gamma', x: 2 },
          { identity: 'delta', x: 3 },
        ],
        [
          { source: 0, target: 1, weight: 0.5 },
          { source: 'row-beta', target: 'row-gamma' },
          { source: 2, target: 2 },
        ],
        ['row-alpha', 'row-beta', 'row-gamma', 'row-delta']
      );

      const registration: AnalyticalDatasetRegistration = {
        registrationId: 'b2-register-1',
        dataset: { fingerprint: data.fingerprint, version: 1 },
        generation: 1,
        payload: { type: 'json', data: data.toJSON(), name: data.name },
      };
      await handler(
        new MessageEvent('message', { data: { type: 'REGISTER', registration } })
      );
      expect(scope.postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          type: 'REGISTERED',
          datasetFingerprint: data.fingerprint,
        })
      );

      scope.postMessage.mockClear();
      const workerRequest: AnalyticalExecutionRequest = {
        requestId: 'b2-graph-worker-1',
        operation: 'semanticEmbodiment',
        dataset: { fingerprint: data.fingerprint, version: 1 },
        generation: 1,
        params: request() as unknown as Record<string, unknown>,
      };
      await handler(new MessageEvent('message', { data: { type: 'EXECUTE', request: workerRequest } }));

      expect(scope.postMessage).toHaveBeenCalledTimes(1);
      const posted = scope.postMessage.mock.calls[0][0] as {
        type: string;
        result: AnalyticalExecutionResult<GraphEmbodimentEnvelopeV1>;
      };
      expect(posted.type).toBe('RESULT');
      expect(posted.result.error).toBeUndefined();
      expect(posted.result.datasetFingerprint).toBe(data.fingerprint);
      expect(posted.result.value?.datasetFingerprint).toBe(data.fingerprint);

      const graph = payload(posted.result.value);
      // Nodes are ordered by durable row ID ascending (byte order), which is
      // stable under row-preserving source reorders — not by source position.
      expect(graph.nodes.map((node) => node.sourceRowId)).toEqual([
        'row-alpha',
        'row-beta',
        'row-delta',
        'row-gamma',
      ]);
      // Source edges: (alpha->beta, w0.5), (row-beta->row-gamma), (gamma->gamma);
      // each resolves to its canonical index in the durable-ID node list.
      expect(graph.edges.map((edge) => [
        edge.sourceNodeIndex,
        edge.targetNodeIndex,
        edge.weight ?? null,
      ])).toEqual([
        [0, 1, 0.5],
        [1, 3, null],
        [3, 3, null],
      ]);
      expect(graph.counts.retainedEdgeCount).toBe(3);
      // the execution request carried authority + provenance only
      expect(JSON.stringify(workerRequest.params)).not.toContain('rows');
      expect(JSON.stringify(workerRequest.params)).not.toContain('alpha');
    } finally {
      vi.stubGlobal('self', originalSelf);
    }
  });

  it('named falsifier: proximity, correlation and k-NN can never invent graph edges', async () => {
    const scope = workerScope;
    if (!scope) throw new Error('analytical Worker scope unavailable');
    const handler = workerHandler();
    vi.stubGlobal('self', scope);
    scope.postMessage.mockClear();
    try {
      // Rows are near-duplicate coordinates with a perfectly correlated pair
      // of numeric columns: any proximity/correlation/k-NN heuristic would
      // happily connect them. The source declares no edges, so the resident
      // authority must refuse rather than invent topology.
      const correlated = new Dataset(
        'b2-graph-no-source-edges',
        [
          { name: 'x', type: 'NUMERIC' },
          { name: 'xCopy', type: 'NUMERIC' },
        ],
        [
          { x: 0, xCopy: 0 },
          { x: 1, xCopy: 1 },
          { x: 2, xCopy: 2 },
          { x: 3, xCopy: 3 },
          { x: 4, xCopy: 4 },
        ]
      );
      const registration: AnalyticalDatasetRegistration = {
        registrationId: 'b2-register-falsifier',
        dataset: { fingerprint: correlated.fingerprint, version: 1 },
        generation: 1,
        payload: { type: 'json', data: correlated.toJSON(), name: correlated.name },
      };
      await handler(new MessageEvent('message', { data: { type: 'REGISTER', registration } }));

      scope.postMessage.mockClear();
      await handler(
        new MessageEvent('message', {
          data: {
            type: 'EXECUTE',
            request: {
              requestId: 'b2-graph-falsifier-1',
              operation: 'semanticEmbodiment',
              dataset: { fingerprint: correlated.fingerprint, version: 1 },
              generation: 1,
              params: request() as unknown as Record<string, unknown>,
            } satisfies AnalyticalExecutionRequest,
          },
        })
      );
      const posted = scope.postMessage.mock.calls[0][0] as {
        result: AnalyticalExecutionResult<GraphEmbodimentEnvelopeV1>;
      };
      expect(posted.result.error).toBeUndefined();
      const envelope = posted.result.value;
      expect(envelope?.result.status).toBe('REFUSED');
      if (envelope?.result.status === 'REFUSED') {
        expect(envelope.result.refusal.code).toBe('MISSING_EVIDENCE');
        expect(envelope.result.refusal.message).toContain('source-provided edge');
      }
      expect(envelope?.resource.elementCount).toBe(0);

      // And with source edges declared over the very same near-duplicate
      // coordinates, the payload carries exactly the source adjacency — no
      // proximity-invented extras appear.
      const withEdges = new Dataset(
        'b2-graph-explicit-edges',
        [
          { name: 'x', type: 'NUMERIC' },
          { name: 'xCopy', type: 'NUMERIC' },
        ],
        [
          { x: 0, xCopy: 0 },
          { x: 1, xCopy: 1 },
          { x: 2, xCopy: 2 },
          { x: 3, xCopy: 3 },
          { x: 4, xCopy: 4 },
        ],
        [{ source: 0, target: 1 }]
      );
      await handler(
        new MessageEvent('message', {
          data: {
            type: 'REGISTER',
            registration: {
              registrationId: 'b2-register-falsifier-edges',
              dataset: { fingerprint: withEdges.fingerprint, version: 1 },
              generation: 1,
              payload: { type: 'json', data: withEdges.toJSON(), name: withEdges.name },
            } satisfies AnalyticalDatasetRegistration,
          },
        })
      );
      scope.postMessage.mockClear();
      await handler(
        new MessageEvent('message', {
          data: {
            type: 'EXECUTE',
            request: {
              requestId: 'b2-graph-falsifier-2',
              operation: 'semanticEmbodiment',
              dataset: { fingerprint: withEdges.fingerprint, version: 1 },
              generation: 1,
              params: request() as unknown as Record<string, unknown>,
            } satisfies AnalyticalExecutionRequest,
          },
        })
      );
      const exact = scope.postMessage.mock.calls[0][0] as {
        result: AnalyticalExecutionResult<GraphEmbodimentEnvelopeV1>;
      };
      const graph = payload(exact.result.value);
      expect(graph.counts.retainedEdgeCount).toBe(1);
      expect(graph.edges).toHaveLength(1);
    } finally {
      vi.stubGlobal('self', originalSelf);
    }
  });

  it('fails closed on widened authority vocabulary across the Worker path', async () => {
    const scope = workerScope;
    if (!scope) throw new Error('analytical Worker scope unavailable');
    const handler = workerHandler();
    vi.stubGlobal('self', scope);
    scope.postMessage.mockClear();
    try {
      const data = new Dataset(
        'b2-graph-widened',
        [{ name: 'x', type: 'NUMERIC' }],
        [{ x: 0 }, { x: 1 }],
        [{ source: 0, target: 1 }]
      );
      await handler(
        new MessageEvent('message', {
          data: {
            type: 'REGISTER',
            registration: {
              registrationId: 'b2-register-widened',
              dataset: { fingerprint: data.fingerprint, version: 1 },
              generation: 1,
              payload: { type: 'json', data: data.toJSON(), name: data.name },
            } satisfies AnalyticalDatasetRegistration,
          },
        })
      );

      const widened = {
        ...request(),
        graphAuthority: {
          ...createSourceRelationshipGraphAuthority('DIRECTED'),
          inferMissingEdges: true,
        },
      };
      scope.postMessage.mockClear();
      await handler(
        new MessageEvent('message', {
          data: {
            type: 'EXECUTE',
            request: {
              requestId: 'b2-graph-widened-1',
              operation: 'semanticEmbodiment',
              dataset: { fingerprint: data.fingerprint, version: 1 },
              generation: 1,
              params: widened as unknown as Record<string, unknown>,
            } satisfies AnalyticalExecutionRequest,
          },
        })
      );
      const posted = scope.postMessage.mock.calls[0][0] as {
        result: AnalyticalExecutionResult<GraphEmbodimentEnvelopeV1>;
      };
      // The strict Rust mirror refuses to even parse a widened authority, so
      // the builder returns no envelope and the Worker fails closed.
      expect(posted.result.value).toBeNull();
      expect(posted.result.error).toContain('builder returned no envelope');
    } finally {
      vi.stubGlobal('self', originalSelf);
    }
  });

  it('routes production graph authority through the strict shared validator and fences', async () => {
    const data = new Dataset(
      'b2-graph-loader',
      [{ name: 'x', type: 'NUMERIC' }],
      [{ x: 0 }, { x: 1 }],
      [{ source: 0, target: 1 }]
    );
    const decision = {
      id: 'decision-graph-b2-loader',
      chosenCandidateId: 'RELATIONSHIP_GRAPH',
      decisionStatus: 'DECISIVE',
      provenance: { fitnessModelVersion: 'bootstrap-fitness-v5' },
    } as unknown as RepresentationDecision;

    const graphEnvelope = (fingerprint: string): GraphEmbodimentEnvelopeV1 => ({
      schemaVersion: 1,
      datasetFingerprint: fingerprint,
      candidateId: 'RELATIONSHIP_GRAPH',
      representationFamily: 'GRAPH',
      analyticalMethod: {
        name: 'source-relationship-graph',
        version: 'source-relationship-graph-v1',
        parameters: {},
      },
      approximation: { mode: 'EXACT', representedRowCount: 2 },
      informationContract: { preserves: [], loses: [] },
      resource: {
        sourceRowCount: 2,
        elementCount: 1,
        maxElementCount: MAX_RELATIONSHIP_GRAPH_EDGES_V1,
      },
      provenance: {
        kernelVersion: 'test',
        algorithmVersion: 'source-graph-topology-v1',
        decisionId: decision.id,
      },
      result: {
        status: 'READY',
        payload: {
          kind: 'RELATIONSHIP_GRAPH',
          data: {
            directionality: 'DIRECTED',
            counts: {
              sourceNodeCount: 2,
              sourceEdgeCount: 1,
              retainedNodeCount: 2,
              retainedEdgeCount: 1,
              refusedEdgeCount: 0,
            },
            nodes: [],
            edges: [],
          },
        },
      },
    });

    const execute = vi.fn(async (req: AnalyticalExecutionRequest) => ({
      requestId: req.requestId,
      generation: req.generation,
      datasetVersion: req.dataset.version,
      datasetFingerprint: req.dataset.fingerprint,
      value: graphEnvelope(req.dataset.fingerprint),
    }));
    const port: AnalyticalExecutionPort = {
      isAsync: true,
      supersede: vi.fn(),
      hasRegisteredDataset: vi.fn(() => true),
      execute: execute as unknown as AnalyticalExecutionPort['execute'],
    };
    const authority: SemanticEmbodimentAuthority = {
      executionPort: port,
      generation: 4,
      datasetVersion: 9,
      datasetFingerprint: data.fingerprint,
    };

    const loaded = await loadGraphSemanticEmbodiment(
      authority,
      data,
      decision,
      createSourceRelationshipGraphAuthority('DIRECTED')
    );
    expect(loaded?.result.status).toBe('READY');
    const transportRequest = execute.mock.calls[0][0];
    expect(transportRequest.operation).toBe('semanticEmbodiment');
    expect(transportRequest.params).toMatchObject({
      schemaVersion: 1,
      candidateId: 'RELATIONSHIP_GRAPH',
      graphAuthority: {
        kind: 'SOURCE_EDGES',
        directionality: 'DIRECTED',
        nodeIdentity: 'DATASET_ROW',
        missingEndpointPolicy: 'REFUSE',
        parallelEdgePolicy: 'PRESERVE',
        selfLoopPolicy: 'PRESERVE',
      },
      decisionId: decision.id,
    });
    expect(JSON.stringify(transportRequest.params)).not.toContain('rows');

    // a widened authority never reaches the transport: the loader fails closed
    execute.mockClear();
    const widenedAuthority = {
      ...createSourceRelationshipGraphAuthority('DIRECTED'),
      inferMissingEdges: true,
    } as unknown as ReturnType<typeof createSourceRelationshipGraphAuthority>;
    const widened = await loadGraphSemanticEmbodiment(
      authority,
      data,
      decision,
      widenedAuthority
    );
    expect(widened).toBeNull();
    expect(execute).not.toHaveBeenCalled();

    // stale execution metadata fails closed: a superseded version fence drops
    // the envelope silently rather than binding it to the current dataset
    execute.mockImplementationOnce(
      async (req: AnalyticalExecutionRequest) => ({
        requestId: req.requestId,
        generation: req.generation,
        datasetVersion: req.dataset.version + 1,
        datasetFingerprint: req.dataset.fingerprint,
        value: graphEnvelope(req.dataset.fingerprint),
      })
    );
    expect(
      await loadGraphSemanticEmbodiment(
        authority,
        data,
        decision,
        createSourceRelationshipGraphAuthority('DIRECTED')
      )
    ).toBeNull();

    // a non-finite source edge weight never reaches the transport: JSON
    // serialization would demote it to absent, so the loader refuses first
    execute.mockClear();
    const nonFinite = new Dataset(
      'b2-graph-loader-non-finite',
      [{ name: 'x', type: 'NUMERIC' }],
      [{ x: 0 }, { x: 1 }],
      [{ source: 0, target: 1, weight: Number.NaN }]
    );
    expect(
      await loadGraphSemanticEmbodiment(
        authority,
        nonFinite,
        decision,
        createSourceRelationshipGraphAuthority('DIRECTED')
      )
    ).toBeNull();
    expect(execute).not.toHaveBeenCalled();
  });
});
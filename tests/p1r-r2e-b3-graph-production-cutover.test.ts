import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import type {
  AnalyticalExecutionPort,
  AnalyticalExecutionRequest,
} from '../src/atlas/ports/AnalyticalExecutionPort.ts';
import { buildGraphSemanticEmbodimentV1 } from '../src/wasm/runtime/SemanticEmbodimentBridge.ts';
import { querySemanticDetailV1 } from '../src/wasm/runtime/SemanticEmbodimentBridge.ts';
import { computeForceDirectedEdges3d } from '../src/wasm/LayoutAuthorityBridge.ts';
import {
  LoadDatasetUseCase,
  type DatasetLoadAuthority,
} from '../src/app/dataset/LoadDatasetUseCase.ts';
import { loadGraphSemanticEmbodiment } from '../src/app/dataset/SemanticEmbodimentLoader.ts';
import { Dataset } from '../src/data/Dataset.ts';
import {
  GRAPH_EDGE_SURFACE_NAME,
  GRAPH_NODE_SURFACE_NAME,
  GRAPH_PRESENTATION_LAYOUT_SEED_V1,
  buildGraphSemanticTopology,
} from '../src/moneta/embodiment/GraphSemanticEmbodiment.ts';
import { SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME } from '../src/moneta/embodiment/SemanticEmbodimentStatus.ts';
import { MonetaTopologyNode } from '../src/moneta/MonetaTopologyNode.ts';
import type {
  GraphEmbodimentEnvelopeV1,
  GraphEmbodimentRequestV1,
  RelationshipGraphPayloadV1,
} from '../src/moneta/representation/GraphEmbodimentPayload.ts';
import { MonetaHypothesisEngine } from '../src/moneta/representation/MonetaHypothesisEngine.ts';
import type { RepresentationDecision } from '../src/moneta/representation/RepresentationDecision.ts';
import {
  createDefaultRequirements,
  type RepresentationRequirements,
} from '../src/moneta/representation/RepresentationRequirements.ts';
import { buildDatasetSignature } from '../src/moneta/representation/SignatureBuilder.ts';
import { createSourceRelationshipGraphAuthority } from '../src/moneta/representation/RelationshipGraphAuthority.ts';
import type { SemanticDetailRequestV1 } from '../src/moneta/representation/SemanticDrillDown.ts';
import type { FactProvider, MonetaDataInput, MonetaFacts, SolverResult } from '../src/moneta/types.ts';
import { VRTopologyTranslator } from '../src/moneta/VRTopologyTranslator.ts';
import { disposeObject } from '../src/utils/Dispose.ts';

const RAW_ROW_BAIT = 'B3_GRAPH_RAW_ROW_BAIT';

const ROW_IDS = ['row-alpha', 'row-beta', 'row-gamma'] as const;

/**
 * Rows carry colliding `id`/`name` bait so any rowId heuristic (id, name,
 * label, _index) would misbind endpoints: row 0's `id` names row 2's durable
 * row ID and vice versa. Only durable row IDs may bind endpoints.
 */
function baitRows(): Record<string, unknown>[] {
  return [
    { id: 'row-gamma', name: 'row-beta', label: 'bait-0', value: 3, notes: RAW_ROW_BAIT },
    { id: 'row-alpha', name: 'row-gamma', label: 'bait-1', value: 5, notes: RAW_ROW_BAIT },
    { id: 'row-beta', name: 'row-alpha', label: 'bait-2', value: 7, notes: RAW_ROW_BAIT },
  ];
}

function sourceEdges(): Array<{ source: string | number; target: string | number; weight?: number }> {
  return [
    { source: 'row-alpha', target: 'row-beta', weight: 0.5 },
    { source: 1, target: 2 },
    { source: 'row-gamma', target: 'row-gamma' },
    { source: 'row-alpha', target: 'row-beta', weight: 0.5 },
    // Positional form of row-alpha -> row-beta: same topology as edge 0 but
    // declared numerically, so eviction of row 0 must record its loss.
    { source: 0, target: 1 },
  ];
}

function graphDataset(name = 'r2e-b3-graph'): Dataset {
  return new Dataset(
    name,
    [
      { name: 'id', type: 'CATEGORICAL' },
      { name: 'name', type: 'CATEGORICAL' },
      { name: 'label', type: 'CATEGORICAL' },
      { name: 'value', type: 'NUMERIC' },
      { name: 'notes', type: 'CATEGORICAL' },
    ],
    baitRows(),
    sourceEdges(),
    [...ROW_IDS]
  );
}

function decision(id = 'decision-graph-b3'): RepresentationDecision {
  return {
    id,
    chosenCandidateId: 'RELATIONSHIP_GRAPH',
    decisionStatus: 'DECISIVE',
    provenance: { fitnessModelVersion: 'bootstrap-fitness-v5' },
    embodiment: {
      primaryLayout: 'FORCE_DIRECTED_3D',
      primaryGeometry: 'ICOSA_NODE',
      primaryBehavior: 'STATIC',
      primaryInteraction: 'INSPECT_CELL',
    },
  } as unknown as RepresentationDecision;
}

function graphRequest(decisionId = 'decision-graph-b3'): GraphEmbodimentRequestV1 {
  return {
    schemaVersion: 1,
    candidateId: 'RELATIONSHIP_GRAPH',
    graphAuthority: createSourceRelationshipGraphAuthority('DIRECTED'),
    decisionId,
    decisionModelVersion: 'bootstrap-fitness-v5',
  };
}

function payloadOf(envelope: GraphEmbodimentEnvelopeV1): RelationshipGraphPayloadV1 {
  if (envelope.result.status !== 'READY' || envelope.result.payload.kind !== 'RELATIONSHIP_GRAPH') {
    throw new Error('expected READY RELATIONSHIP_GRAPH payload');
  }
  return envelope.result.payload.data;
}

function realEnvelope(dataset: Dataset): GraphEmbodimentEnvelopeV1 {
  const handle = bridge.loadDatasetJson({
    name: dataset.name,
    columns: dataset.columns.map((column) => ({ name: column.name, type: column.type })),
    rows: dataset.toJSON().rows,
    rowIds: dataset.rowIds,
    edges: dataset.edges,
  });
  const envelope = buildGraphSemanticEmbodimentV1(handle, graphRequest());
  if (!envelope) throw new Error('real graph embodiment unavailable');
  return envelope;
}

function facts(): MonetaFacts {
  return {
    topology: 'GRAPH',
    rowCount: 3,
    nodeCount: 3,
    edgeCount: 4,
    depth: 0,
    numericColumns: 2,
    categoricalColumns: 2,
    temporalColumns: 0,
    hasTimeSeries: false,
    hasContinuousValues: true,
    density: 0,
    estimatedDensity: 0,
    outlierCount: 0,
    cardinalityOfColor: 2,
    hasHighCardinality: false,
    isLargeDataset: false,
    clusterCount: 0,
    columnStats: {},
    correlationMatrix: {},
    categoryDistribution: {},
    trendDirection: 'flat',
    seasonalityHint: false,
    hasOutliers: false,
    hasHighVariance: false,
    numericSkew: 0,
    topCategory: null,
  };
}

function solverResult(): SolverResult {
  return {
    facts: facts(),
    spec: {
      layout: 'FORCE_DIRECTED_3D',
      geometry: 'ICOSA_NODE',
      behavior: 'STATIC',
      interaction: 'INSPECT_CELL',
    },
    cost: 0,
  };
}

function governedInput(
  dataset: Dataset,
  semantic?: GraphEmbodimentEnvelopeV1 | null
): MonetaDataInput {
  return {
    topology: 'GRAPH',
    dataset,
    semanticEmbodiment: semantic,
    semanticEmbodimentCandidateId: 'RELATIONSHIP_GRAPH',
  } as unknown as MonetaDataInput;
}

function portFor(value: GraphEmbodimentEnvelopeV1) {
  const registerDataset = vi.fn(async () => undefined);
  const hasRegisteredDataset = vi.fn(() => true);
  const execute = vi.fn(async (request: AnalyticalExecutionRequest) => ({
    requestId: request.requestId,
    generation: request.generation,
    datasetVersion: request.dataset.version,
    datasetFingerprint: request.dataset.fingerprint,
    value,
  }));
  const port: AnalyticalExecutionPort = {
    isAsync: true,
    supersede: vi.fn(),
    hasRegisteredDataset,
    registerDataset,
    execute: execute as unknown as AnalyticalExecutionPort['execute'],
  };
  return {
    port,
    execute,
    registerDataset,
  };
}

function sourceGraphRequirements(): RepresentationRequirements {
  const requirements = createDefaultRequirements('relationship-discovery', 'MEDIUM');
  requirements.graphAuthority = createSourceRelationshipGraphAuthority('DIRECTED');
  return requirements;
}

describe('P1-R2E B3 relationship-graph production cutover', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) throw new Error('R2E B3 requires the real WASM runtime');
  });

  it('transports only the strict B1 graph authority through the production load path', async () => {
    const data = graphDataset();
    const chosen = decision();
    const expected = realEnvelope(data);
    const { port, execute, registerDataset } = portFor(expected);
    const authority = {
      setOriginalDataset: vi.fn(),
      setCurrentDataset: vi.fn(),
      dataset: data,
      isReady: vi.fn(() => true),
      inferEncodings: vi.fn(() => ({ color: 'id', size: 'value' })),
      arbitrateRepresentation: vi.fn(() => chosen),
      computeDatasetSignature: vi.fn(() => ({})),
      executionPort: port,
      generation: 4,
      datasetVersion: 9,
      datasetFingerprint: data.fingerprint,
    } as unknown as DatasetLoadAuthority;

    const result = new LoadDatasetUseCase(authority).execute(
      { name: 'B3 graph', topology: 'GRAPH', dataset: data },
      { preserveAnalyticalState: true, requirements: sourceGraphRequirements() }
    );
    const semanticInput = result.dataInput as MonetaDataInput & {
      semanticEmbodimentPromise?: Promise<GraphEmbodimentEnvelopeV1 | null>;
      semanticEmbodimentCandidateId?: 'RELATIONSHIP_GRAPH';
    };

    expect(semanticInput.semanticEmbodimentCandidateId).toBe('RELATIONSHIP_GRAPH');
    expect(await semanticInput.semanticEmbodimentPromise).toEqual(expected);
    expect(registerDataset).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(1);
    const request = execute.mock.calls[0][0];
    expect(request.operation).toBe('semanticEmbodiment');
    expect(request.params).toMatchObject({
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
      decisionId: chosen.id,
    });
    expect(JSON.stringify(request.params)).not.toContain('rows');
    expect(JSON.stringify(request.params)).not.toContain(RAW_ROW_BAIT);
  });

  it('leaves RELATIONSHIP_GRAPH ungoverned without explicit authority and fails closed on eviction evidence', async () => {
    const data = graphDataset();
    const chosen = decision();
    const { port, execute } = portFor(realEnvelope(data));
    const authority = {
      setOriginalDataset: vi.fn(),
      setCurrentDataset: vi.fn(),
      dataset: data,
      isReady: vi.fn(() => true),
      inferEncodings: vi.fn(() => ({})),
      arbitrateRepresentation: vi.fn(() => chosen),
      computeDatasetSignature: vi.fn(() => ({})),
      executionPort: port,
      generation: 4,
      datasetVersion: 9,
      datasetFingerprint: data.fingerprint,
    } as unknown as DatasetLoadAuthority;

    const requirements = sourceGraphRequirements();
    delete requirements.graphAuthority;
    const result = new LoadDatasetUseCase(authority).execute(
      { name: 'B3 ungoverned', topology: 'GRAPH', dataset: data },
      { preserveAnalyticalState: true, requirements }
    );
    const semanticInput = result.dataInput as MonetaDataInput & {
      semanticEmbodimentPromise?: Promise<unknown>;
      semanticEmbodimentCandidateId?: 'RELATIONSHIP_GRAPH';
    };
    expect(semanticInput.semanticEmbodimentCandidateId).toBeUndefined();
    expect(semanticInput.semanticEmbodimentPromise).toBeUndefined();
    expect(execute).not.toHaveBeenCalled();

    // A dataset whose rolling eviction silently dropped positional source
    // edges must never be presented as a truthful governed graph.
    const evicted = graphDataset('r2e-b3-evicted');
    evicted.updateRows([{ id: 'x', name: 'y', label: 'z', value: 9 }], 'append', 3);
    expect((evicted.evictedEdgeCount ?? 0) > 0).toBe(true);
    expect(
      await loadGraphSemanticEmbodiment(
        {
          executionPort: port,
          generation: 4,
          datasetVersion: 9,
          datasetFingerprint: evicted.fingerprint,
        },
        evicted,
        chosen,
        createSourceRelationshipGraphAuthority('DIRECTED')
      )
    ).toBeNull();
  });

  it('renders only payload topology with row-free interaction proxies bound to semantic IDs', () => {
    const data = graphDataset();
    const envelope = realEnvelope(data);
    const payload = payloadOf(envelope);
    expect(payload.nodes.map((node) => node.sourceRowId)).toEqual([
      'row-alpha',
      'row-beta',
      'row-gamma',
    ]);

    const chartPlaneFactory = vi.fn();
    const artifact = VRTopologyTranslator.synthesizeArtifact(
      solverResult(),
      governedInput(data, envelope),
      { chartPlaneFactory }
    );
    try {
      expect(artifact.group.userData.semanticEmbodimentStatus).toBe('READY');
      expect(chartPlaneFactory).not.toHaveBeenCalled();

      const nodeProxies = artifact.nodeMeshes.filter(
        (mesh) => mesh.userData.semanticRole === 'node'
      );
      const edgeProxies = artifact.nodeMeshes.filter(
        (mesh) => mesh.userData.semanticRole === 'edge'
      );
      expect(nodeProxies.map((mesh) => mesh.name)).toEqual(
        payload.nodes.map((node) => node.semanticId)
      );
      expect(edgeProxies.map((mesh) => mesh.name)).toEqual(
        payload.edges.map((edge) => edge.semanticId)
      );
      expect(nodeProxies).toHaveLength(payload.nodes.length);
      expect(edgeProxies).toHaveLength(payload.edges.length);

      // Selection identity triple: semanticId + datasetFingerprint + decisionId.
      for (const proxy of artifact.nodeMeshes) {
        expect(proxy.userData.semanticId).toBe(proxy.name);
        expect(proxy.userData.datasetFingerprint).toBe(envelope.datasetFingerprint);
        expect(proxy.userData.provenance.decisionId).toBe('decision-graph-b3');
        expect(proxy.userData.supportBoundaryClaim).toBe(false);
      }

      // Self-loop and duplicate parallel edges are retained, never normalized.
      expect(payload.edges).toHaveLength(sourceEdges().length);
      const adjacency = payload.edges.map((edge) => [
        payload.nodes[edge.sourceNodeIndex].sourceRowId,
        payload.nodes[edge.targetNodeIndex].sourceRowId,
      ]);
      expect(adjacency).toEqual([
        ['row-alpha', 'row-beta'],
        ['row-alpha', 'row-beta'],
        ['row-alpha', 'row-beta'],
        ['row-beta', 'row-gamma'],
        ['row-gamma', 'row-gamma'],
      ]);
      for (const [index, proxy] of edgeProxies.entries()) {
        expect(proxy.userData.sourceNodeSemanticId).toBe(
          payload.nodes[payload.edges[index].sourceNodeIndex].semanticId
        );
        expect(proxy.userData.targetNodeSemanticId).toBe(
          payload.nodes[payload.edges[index].targetNodeIndex].semanticId
        );
      }

      // Edge segments are drawn 1:1 in payload order.
      const segments = artifact.group.getObjectByName(GRAPH_EDGE_SURFACE_NAME) as THREE.LineSegments;
      expect(segments.geometry.getAttribute('position').count).toBe(payload.edges.length * 2);
      expect(artifact.group.getObjectByName(GRAPH_NODE_SURFACE_NAME)).toBeInstanceOf(
        THREE.InstancedMesh
      );
      expect(artifact.group.userData.graphRenderSurface).toMatchObject({
        semanticNodeCount: 3,
        semanticEdgeCount: sourceEdges().length,
        candidateLocalDrawCalls: 2,
      });

      // No raw source row payload may leak into any graph proxy.
      const serialized = JSON.stringify(artifact.nodeMeshes.map((mesh) => mesh.userData));
      expect(serialized).not.toContain(RAW_ROW_BAIT);
      expect(serialized).not.toContain('"bait-0"');
    } finally {
      disposeObject(artifact.group);
    }
  });

  it('renders no topology for pending, refused, invalid and stale-fingerprint envelopes', () => {
    const data = graphDataset();
    const chartPlaneFactory = vi.fn();

    const pending = VRTopologyTranslator.synthesizeArtifact(
      solverResult(),
      governedInput(data, null),
      { chartPlaneFactory }
    );
    expect(pending.nodeMeshes).toHaveLength(0);
    expect(pending.group.userData.semanticEmbodimentStatus).toBe('PENDING');

    const real = realEnvelope(data);
    const refused: GraphEmbodimentEnvelopeV1 = {
      ...real,
      result: {
        status: 'REFUSED',
        refusal: { code: 'MISSING_EVIDENCE', message: 'source endpoints refused' },
      },
    };
    const refusedArtifact = VRTopologyTranslator.synthesizeArtifact(
      solverResult(),
      governedInput(data, refused),
      { chartPlaneFactory }
    );
    expect(refusedArtifact.nodeMeshes).toHaveLength(0);
    expect(refusedArtifact.group.userData.semanticEmbodimentStatus).toBe('REFUSED');
    expect(refusedArtifact.group.userData.semanticEmbodimentRefusal).toMatchObject({
      code: 'MISSING_EVIDENCE',
    });

    // Tampered counts and out-of-bounds endpoints are refused, not repaired.
    const tampered = structuredClone(real);
    payloadOf(tampered).counts.retainedEdgeCount = 99;
    const tamperedArtifact = VRTopologyTranslator.synthesizeArtifact(
      solverResult(),
      governedInput(data, tampered),
      { chartPlaneFactory }
    );
    expect(tamperedArtifact.nodeMeshes).toHaveLength(0);
    expect(tamperedArtifact.group.userData.semanticEmbodimentStatus).toBe('INVALID');

    const outOfBounds = structuredClone(real);
    payloadOf(outOfBounds).edges[0].sourceNodeIndex = 42;
    const outOfBoundsArtifact = VRTopologyTranslator.synthesizeArtifact(
      solverResult(),
      governedInput(data, outOfBounds),
      { chartPlaneFactory }
    );
    expect(outOfBoundsArtifact.nodeMeshes).toHaveLength(0);
    expect(outOfBoundsArtifact.group.userData.semanticEmbodimentStatus).toBe('INVALID');

    // A payload minted for a different dataset is stale and renders nothing.
    const other = realEnvelope(graphDataset('r2e-b3-other'));
    const stale = VRTopologyTranslator.synthesizeArtifact(
      solverResult(),
      governedInput(data, other),
      { chartPlaneFactory }
    );
    expect(stale.nodeMeshes).toHaveLength(0);
    expect(stale.group.userData.semanticEmbodimentStatus).toBe('INVALID');

    for (const artifact of [pending, refusedArtifact, tamperedArtifact, outOfBoundsArtifact, stale]) {
      expect(artifact.group.getObjectByName(GRAPH_NODE_SURFACE_NAME)).toBeUndefined();
      expect(artifact.group.getObjectByName(GRAPH_EDGE_SURFACE_NAME)).toBeUndefined();
      disposeObject(artifact.group);
    }
    expect(chartPlaneFactory).not.toHaveBeenCalled();
  });

  it('keeps the ungoverned FORCE_DIRECTED_3D raw path intact', () => {
    const data = graphDataset('r2e-b3-ungoverned');
    const input = {
      topology: 'GRAPH',
      dataset: data,
    } as MonetaDataInput;
    const artifact = VRTopologyTranslator.synthesizeArtifact(solverResult(), input);
    try {
      expect(artifact.nodeMeshes).toHaveLength(data.rows.length);
      // The raw path still draws heuristic row.id/name-matched edges.
      expect(artifact.edgeMeshes.length).toBeGreaterThan(0);
      expect(artifact.group.userData.semanticEmbodimentStatus).toBeUndefined();
      expect(
        artifact.group.getObjectByName(SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME)
      ).toBeUndefined();
    } finally {
      disposeObject(artifact.group);
    }
  });

  it('invalidates the governed payload and records eviction evidence on source mutation', () => {
    const data = graphDataset('r2e-b3-append');
    const real = realEnvelope(data);
    const refused: GraphEmbodimentEnvelopeV1 = {
      ...real,
      result: {
        status: 'REFUSED',
        refusal: { code: 'MISSING_EVIDENCE', message: 'refused-before-mutation' },
      },
    };
    const scene = new THREE.Scene();
    const input = governedInput(data, refused);
    const factProvider = { facts: () => facts() } as FactProvider;
    const node = new MonetaTopologyNode(scene, input, [0, 0, 0], {}, factProvider, false, decision());
    try {
      expect(node.group?.userData.semanticEmbodimentStatus).toBe('REFUSED');

      node.appendRows(
        [{ id: 'new', name: 'new', label: 'new', value: 11 }],
        { mode: 'append', limit: 3 }
      );

      // The superseded payload is gone: the re-synthesis renders the pending
      // state instead of reusing the stale graph as current truth.
      expect((input as { semanticEmbodiment?: unknown }).semanticEmbodiment).toBeUndefined();
      expect(node.group?.userData.semanticEmbodimentStatus).toBe('PENDING');
      expect(node.artifact?.nodeMeshes).toHaveLength(0);

      // Eviction that dropped positional source edges is recorded, not silent.
      expect((data.evictedEdgeCount ?? 0) > 0).toBe(true);
    } finally {
      if (node.group) disposeObject(node.group);
    }
  });

  it('proves layout seeds move marks but never topology or semantic identity', () => {
    const data = graphDataset();
    const envelope = realEnvelope(data);
    const payload = payloadOf(envelope);
    const indexedEdges = payload.edges.map((edge) => ({
      source: edge.sourceNodeIndex,
      target: edge.targetNodeIndex,
      weight: edge.weight ?? 1,
    }));

    const seedOne = computeForceDirectedEdges3d(
      payload.nodes.length,
      indexedEdges,
      120, 120, 0.02, 0.08, 4, 1.2,
      GRAPH_PRESENTATION_LAYOUT_SEED_V1
    );
    const seedSeven = computeForceDirectedEdges3d(
      payload.nodes.length,
      indexedEdges,
      120, 120, 0.02, 0.08, 4, 1.2,
      7
    );
    expect(seedOne).not.toBeNull();
    expect(seedSeven).not.toBeNull();
    expect(Array.from(seedOne!)).not.toEqual(Array.from(seedSeven!));

    // The adapter renders identical identity and adjacency from the same
    // payload regardless of what any layout change does to positions.
    const first = VRTopologyTranslator.synthesizeArtifact(
      solverResult(),
      governedInput(data, envelope)
    );
    const second = VRTopologyTranslator.synthesizeArtifact(
      solverResult(),
      governedInput(data, structuredClone(envelope))
    );
    try {
      expect(first.nodeMeshes.map((mesh) => mesh.name)).toEqual(
        second.nodeMeshes.map((mesh) => mesh.name)
      );
      const adjacencyOf = (artifact: ReturnType<typeof VRTopologyTranslator.synthesizeArtifact>) =>
        artifact.nodeMeshes
          .filter((mesh) => mesh.userData.semanticRole === 'edge')
          .map((mesh) => [
            mesh.userData.sourceNodeSemanticId,
            mesh.userData.targetNodeSemanticId,
          ]);
      expect(adjacencyOf(first)).toEqual(adjacencyOf(second));
      expect(adjacencyOf(first)).toEqual(
        payload.edges.map((edge) => [
          payload.nodes[edge.sourceNodeIndex].semanticId,
          payload.nodes[edge.targetNodeIndex].semanticId,
        ])
      );
    } finally {
      disposeObject(first.group);
      disposeObject(second.group);
    }
  });

  it('falsifies rowId heuristics: only durable row IDs bind governed endpoints', () => {
    const data = graphDataset();
    const envelope = realEnvelope(data);
    const payload = payloadOf(envelope);

    // Every node binds to the declared durable row ID, in canonical order —
    // never to the colliding row.id/name bait.
    expect(payload.nodes.map((node) => node.sourceRowId)).toEqual([...ROW_IDS]);
    const baitIds = new Set(data.rows.map((row) => String(row.id)));
    expect(baitIds.has('row-alpha')).toBe(true);
    for (const node of payload.nodes) {
      expect(baitIds.has(node.sourceRowId)).toBe(true);
    }

    // Endpoints resolve exactly as declared: strings by durable row ID,
    // numerics by source-row position, duplicates and self-loops retained.
    const resolveEndpoint = (endpoint: string | number): string =>
      typeof endpoint === 'number' ? ROW_IDS[endpoint] : endpoint;
    const expectedAdjacency = sourceEdges()
      .map((edge) => `${resolveEndpoint(edge.source)}\x00${resolveEndpoint(edge.target)}`)
      .sort();
    const renderedAdjacency = payload.edges
      .map((edge) =>
        `${payload.nodes[edge.sourceNodeIndex].sourceRowId}\x00${payload.nodes[edge.targetNodeIndex].sourceRowId}`
      )
      .sort();
    expect(renderedAdjacency).toEqual(expectedAdjacency);

    // Exact duplicate parallel edges keep distinct semantic IDs (occurrence
    // counter) instead of collapsing.
    const parallel = payload.edges.filter(
      (edge) =>
        edge.weight === 0.5 &&
        payload.nodes[edge.sourceNodeIndex].sourceRowId === 'row-alpha' &&
        payload.nodes[edge.targetNodeIndex].sourceRowId === 'row-beta'
    );
    expect(parallel).toHaveLength(2);
    expect(new Set(parallel.map((edge) => edge.semanticId)).size).toBe(2);

    // The rendered presentation exposes exactly the payload identity — the
    // bait never creates, drops or reinterprets a node or edge.
    const artifact = VRTopologyTranslator.synthesizeArtifact(
      solverResult(),
      governedInput(data, envelope)
    );
    try {
      expect(artifact.nodeMeshes).toHaveLength(payload.nodes.length + payload.edges.length);
    } finally {
      disposeObject(artifact.group);
    }
  });

  it('binds graph drill-down membership to payload-justified rows only', () => {
    const data = graphDataset();
    const handle = bridge.loadDatasetJson({
      name: data.name,
      columns: data.columns.map((column) => ({ name: column.name, type: column.type })),
      rows: data.toJSON().rows,
      rowIds: data.rowIds,
      edges: data.edges,
    });
    const envelope = buildGraphSemanticEmbodimentV1(handle, graphRequest());
    if (!envelope) throw new Error('graph embodiment unavailable');
    const payload = payloadOf(envelope);
    const rowIdOf = (nodeIndex: number) => payload.nodes[nodeIndex].sourceRowId;

    const detailRequest = (semanticObjectId: string): SemanticDetailRequestV1 => ({
      schemaVersion: 1,
      target: {
        datasetFingerprint: envelope.datasetFingerprint,
        decisionId: 'decision-graph-b3',
        representationFamily: 'GRAPH',
        semanticObjectId,
      },
      limit: 256,
      offset: 0,
      investigationContext: 'r2e-b3: bounded graph membership',
    });

    // Node target: exactly the one source row minting that node.
    const nodeDetail = querySemanticDetailV1(handle, detailRequest(payload.nodes[0].semanticId), {}, 1);
    expect(nodeDetail?.result.status).toBe('READY');
    if (nodeDetail?.result.status === 'READY') {
      expect(nodeDetail.result.observationIds).toEqual(['row-alpha']);
    }

    // Edge target: exactly its two endpoint rows.
    const spanningEdge = payload.edges.find(
      (edge) => edge.sourceNodeIndex !== edge.targetNodeIndex
    );
    if (!spanningEdge) throw new Error('expected a non-self-loop edge');
    const edgeDetail = querySemanticDetailV1(handle, detailRequest(spanningEdge.semanticId), {}, 1);
    expect(edgeDetail?.result.status).toBe('READY');
    if (edgeDetail?.result.status === 'READY') {
      expect(edgeDetail.result.observationIds).toEqual([
        rowIdOf(spanningEdge.sourceNodeIndex),
        rowIdOf(spanningEdge.targetNodeIndex),
      ]);
    }

    // Self-loop edge target: the single endpoint row, never invented twice.
    const selfLoop = payload.edges.find(
      (edge) => edge.sourceNodeIndex === edge.targetNodeIndex
    );
    if (!selfLoop) throw new Error('expected a retained self-loop edge');
    const selfLoopDetail = querySemanticDetailV1(handle, detailRequest(selfLoop.semanticId), {}, 1);
    expect(selfLoopDetail?.result.status).toBe('READY');
    if (selfLoopDetail?.result.status === 'READY') {
      expect(selfLoopDetail.result.observationIds).toEqual(['row-gamma']);
    }

    // Unknown or malformed targets refuse fail-closed.
    const unknown = querySemanticDetailV1(handle, detailRequest('graph-node:unknown'), {}, 1);
    expect(unknown?.result.status).toBe('REFUSED');
    const malformed = querySemanticDetailV1(handle, detailRequest('cluster-region:bogus'), {}, 1);
    expect(malformed?.result.status).toBe('REFUSED');
  });

  it('extends source binding through signature, arbitration and the resident payload', () => {
    const data = graphDataset('r2e-b3-arbitration');
    const signature = buildDatasetSignature(data, null, data.fingerprint);
    expect(signature.topologicalStructure.topology).toBe('GRAPH');
    expect(signature.cardinality.edgeCount).toBe(sourceEdges().length);

    const arbitrated = MonetaHypothesisEngine.arbitrate(signature, sourceGraphRequirements());
    const graphCandidates = (arbitrated.rankedCandidates ?? []).filter(
      (candidate) => candidate.candidateId === 'RELATIONSHIP_GRAPH'
    );
    expect(graphCandidates.length).toBeGreaterThan(0);
    expect(graphCandidates.some((candidate) => !candidate.disqualified)).toBe(true);

    // The same source rows/edges, registered with the resident kernel after
    // arbitration, still bind endpoints to the declared durable row IDs.
    const envelope = realEnvelope(data);
    const payload = payloadOf(envelope);
    expect(payload.nodes.map((node) => node.sourceRowId)).toEqual([...ROW_IDS]);
    expect(payload.counts).toMatchObject({
      sourceNodeCount: 3,
      sourceEdgeCount: sourceEdges().length,
      retainedNodeCount: 3,
      retainedEdgeCount: sourceEdges().length,
      refusedEdgeCount: 0,
    });
  });

  it('mechanically fences the semantic intercept before any row or edge read', () => {
    const worker = readFileSync('src/atlas/ports/analytical.worker.ts', 'utf8');
    const loader = readFileSync('src/app/dataset/LoadDatasetUseCase.ts', 'utf8');
    const semanticLoader = readFileSync('src/app/dataset/SemanticEmbodimentLoader.ts', 'utf8');
    const translator = readFileSync('src/moneta/VRTopologyTranslator.ts', 'utf8');
    const adapter = readFileSync('src/moneta/embodiment/GraphSemanticEmbodiment.ts', 'utf8');
    const node = readFileSync('src/moneta/MonetaTopologyNode.ts', 'utf8');

    expect(worker).toContain("req.params.candidateId === 'RELATIONSHIP_GRAPH'");
    expect(worker).toContain('buildGraphSemanticEmbodimentV1(');
    expect(loader).toContain("semanticEmbodimentCandidateId = 'RELATIONSHIP_GRAPH'");
    expect(loader).toContain('activeRequirements.graphAuthority');
    expect(semanticLoader).toContain('validateSourceRelationshipGraphAuthority(graphAuthority)');
    expect(semanticLoader).toContain('dataset.evictedEdgeCount');
    expect(translator).toContain("semanticEmbodimentCandidateId === 'RELATIONSHIP_GRAPH'");
    expect(translator).toContain('buildGraphSemanticTopology(');
    expect(translator).toContain('layouts.buildForceDirected(');
    expect(translator.indexOf('buildGraphSemanticTopology(')).toBeLessThan(
      translator.indexOf('rows = dataset?.rows')
    );
    expect(translator.indexOf('buildGraphSemanticTopology(')).toBeLessThan(
      translator.indexOf('layouts.buildForceDirected(')
    );
    expect(translator).toContain('!usesGraphSemanticEmbodiment &&');
    // The marker is set for every governed RELATIONSHIP_GRAPH decision, so no
    // raw row/edge read can serve the governed branch. (The pre-branch
    // `let edges = dataInput.edges ?? []` initializer still executes first;
    // the governed branch overwrites it with `edges = []` and must never
    // consume it — the adapter-level `dataset.edges` ban below is the fence.)
    expect(node).toContain("semanticEmbodimentCandidateId === 'RELATIONSHIP_GRAPH'");
    // The adapter never reads rows for topology and claims no support boundary.
    expect(adapter).not.toContain('dataset.rows');
    expect(adapter).not.toContain('dataInput.rows');
    expect(adapter).not.toContain('dataset.edges');
    expect(adapter).toContain('supportBoundaryClaim: false');
    expect(adapter).toContain('GRAPH_PRESENTATION_LAYOUT_SEED_V1');
  });

  it('renders envelope-shaped refusals and identity mismatches as status planes only', () => {
    const group = new THREE.Group();
    const data = graphDataset();
    const real = realEnvelope(data);

    // Missing envelope: pending plane only.
    buildGraphSemanticTopology(group, [], [], null, data);
    expect(group.userData.semanticEmbodimentStatus).toBe('PENDING');
    expect(group.children).toHaveLength(1);

    const fresh = new THREE.Group();
    const wrongFamily = {
      ...structuredClone(real),
      representationFamily: 'CLUSTER',
    } as unknown as GraphEmbodimentEnvelopeV1;
    buildGraphSemanticTopology(fresh, [], [], wrongFamily, data);
    expect(fresh.userData.semanticEmbodimentStatus).toBe('INVALID');
    expect(fresh.children).toHaveLength(1);

    const noDataset = new THREE.Group();
    buildGraphSemanticTopology(noDataset, [], [], structuredClone(real), undefined);
    expect(noDataset.userData.semanticEmbodimentStatus).toBe('INVALID');

    // Malformed-but-truthy transport values (an unresolved promise, a torn
    // payload) fail closed to INVALID rather than crashing the synthesis.
    const promiseLeak = new THREE.Group();
    buildGraphSemanticTopology(
      promiseLeak,
      [],
      [],
      Promise.resolve(real) as unknown as GraphEmbodimentEnvelopeV1,
      data
    );
    expect(promiseLeak.userData.semanticEmbodimentStatus).toBe('INVALID');

    const badSchema = new THREE.Group();
    buildGraphSemanticTopology(
      badSchema,
      [],
      [],
      { ...structuredClone(real), schemaVersion: 2 } as unknown as GraphEmbodimentEnvelopeV1,
      data
    );
    expect(badSchema.userData.semanticEmbodimentStatus).toBe('INVALID');

    disposeObject(group);
    disposeObject(fresh);
    disposeObject(noDataset);
    disposeObject(promiseLeak);
    disposeObject(badSchema);
  });
});
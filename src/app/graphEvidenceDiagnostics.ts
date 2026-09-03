import * as THREE from 'three';
import type { AtlasCore } from '../atlas/AtlasCore.ts';
import type { AnalyticalWorkerDiagnostic } from '../atlas/ports/AnalyticalExecutionPort.ts';
import { Dataset } from '../data/Dataset.ts';
import {
  GRAPH_EDGE_SURFACE_NAME,
  GRAPH_NODE_SURFACE_NAME,
} from '../moneta/embodiment/GraphSemanticEmbodiment.ts';
import { SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME } from '../moneta/embodiment/SemanticEmbodimentStatus.ts';
import type { GraphEmbodimentEnvelopeV1 } from '../moneta/representation/GraphEmbodimentPayload.ts';
import { MONETA_REPRESENTATION_CANDIDATES } from '../moneta/representation/RepresentationCandidate.ts';
import {
  createDefaultRequirements,
  type RepresentationRequirements,
} from '../moneta/representation/RepresentationRequirements.ts';
import { createSourceRelationshipGraphAuthority } from '../moneta/representation/RelationshipGraphAuthority.ts';
import { computeForceDirectedEdges3d } from '../wasm/LayoutAuthorityBridge.ts';
import { PerceptualFitnessSampler } from '../vr/perception/PerceptualFitnessSampler.ts';
import type { DatasetLoadEntry } from '../vr/coordinators/types.ts';

export type GraphEvidenceShape =
  | 'directed'
  | 'undirected'
  | 'mixed-endpoints'
  | 'near-bound'
  | 'missing-endpoint'
  | 'mutation-stale';

type ReadyGraphEvidenceShape = Exclude<GraphEvidenceShape, 'missing-endpoint'>;
type EdgeInput = { source: string | number; target: string | number; weight?: number };

interface GraphEvidenceWorld {
  atlas: Pick<AtlasCore, 'executionPort'>;
  engine: {
    scene: THREE.Scene;
    renderer: { info: { render: { calls: number; triangles: number } } };
  };
  dracoNode: import('../moneta/MonetaTopologyNode.ts').MonetaTopologyNode | null;
  _activeRequirements: RepresentationRequirements;
  loadDataset(entry: DatasetLoadEntry): Promise<void>;
  _doLoadDataset(
    entry: DatasetLoadEntry,
    options: { preserveAnalyticalState?: boolean; preserveAuxiliaryPresentation?: boolean }
  ): void;
}

interface SemanticGraphInput {
  semanticEmbodimentCandidateId?: 'RELATIONSHIP_GRAPH';
  semanticEmbodiment?: GraphEmbodimentEnvelopeV1 | null;
  semanticEmbodimentPromise?: Promise<GraphEmbodimentEnvelopeV1 | null>;
}

export interface GraphEvidenceScenarioResult {
  schemaVersion: 1;
  sourceRowCount: number;
  shape: ReadyGraphEvidenceShape;
  directionality: 'DIRECTED' | 'UNDIRECTED';
  candidateId: 'RELATIONSHIP_GRAPH';
  datasetFingerprint: string;
  decisionId: string;
  initialStatus: string;
  finalStatus: string;
  statusSurface: { pendingWasVisible: boolean; readySurfaceRemoved: boolean };
  envelope: GraphEmbodimentEnvelopeV1;
  payloadJsonBytesProxy: number;
  artifact: {
    artifactId: string;
    semanticNodeCount: number;
    semanticEdgeCount: number;
    interactionProxyCount: number;
    renderedBatchCount: number;
    candidateLocalDrawCalls: number;
    nodeSurfacePresent: boolean;
    edgeSurfacePresent: boolean;
    nodeSemanticIds: string[];
    edgeSemanticIds: string[];
    presentationSemantics: string;
    supportBoundaryClaim: false;
  };
  topology: {
    nodeIds: string[];
    edges: Array<{
      semanticId: string;
      sourceNodeIndex: number;
      targetNodeIndex: number;
      weight: number | null;
    }>;
    isolatedNodeCount: number;
    parallelEdgePairCount: number;
    selfLoopCount: number;
  };
  layoutInvariance: {
    seedA: number;
    seedB: number;
    positionsDiffer: boolean;
    topologyInvariant: true;
  };
  staleFence: {
    exercised: boolean;
    evictedEdgeCount: number;
    statusAfterMutation: string | null;
    graphSurfaceAfterMutation: boolean | null;
  };
  timingMs: { requestToReady: number; readyToRenderedFrames: number; total: number };
  workerDiagnostics: readonly AnalyticalWorkerDiagnostic[];
  workerExecution: {
    kernelMs: number | null;
    wasmBytesBefore: number | null;
    wasmBytesAfterKernel: number | null;
    wasmBytesAfterMaterialize: number | null;
  };
  scene: {
    objectCount: number;
    visibleObjectCount: number;
    renderCallsLastFrame: number;
    trianglesLastFrame: number;
  };
  perceptualBinding: {
    artifactId: string;
    datasetFingerprint: string;
    candidateId: 'RELATIONSHIP_GRAPH';
    payloadKind: 'RELATIONSHIP_GRAPH';
    decisionId: string;
    communityClaim: false;
    evidence: ReturnType<PerceptualFitnessSampler['sample']>;
  };
}

export interface GraphRefusalScenarioResult {
  schemaVersion: 1;
  sourceRowCount: number;
  candidateId: 'RELATIONSHIP_GRAPH';
  datasetFingerprint: string;
  decisionId: string;
  status: string;
  envelope: GraphEmbodimentEnvelopeV1;
  graphSurfacePresent: boolean;
  refusalCode: string;
  refusalMessage: string;
}

export interface GraphNoAuthorityScenarioResult {
  schemaVersion: 1;
  sourceRowCount: number;
  graphLikeCoordinates: true;
  sourceEdgeCount: 0;
  explicitGraphAuthorityRequested: true;
  chosenCandidateId: string;
  relationshipGraphChosen: false;
  graphSurfacePresent: false;
}

export interface GraphEvidenceDiagnosticHook {
  readonly schemaVersion: 1;
  runScenario(input: {
    rowCount: number;
    shape: ReadyGraphEvidenceShape;
  }): Promise<GraphEvidenceScenarioResult>;
  runMissingEndpointScenario(input: { rowCount: number }): Promise<GraphRefusalScenarioResult>;
  runNoSourceAuthorityScenario(input: { rowCount: number }): Promise<GraphNoAuthorityScenarioResult>;
}

declare global {
  interface Window {
    __NEMOSYNE_GRAPH_B4_EVIDENCE__?: GraphEvidenceDiagnosticHook;
  }
}

function roundMs(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function waitFrames(count = 2): Promise<void> {
  return new Promise((resolve) => {
    const next = (remaining: number): void => {
      if (remaining <= 0) return resolve();
      requestAnimationFrame(() => next(remaining - 1));
    };
    next(count);
  });
}

function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function deterministicUnit(index: number, salt: number): number {
  let value = (Math.imul(index + 1, 0x45d9f3b) ^ Math.imul(salt + 1, 0x27d4eb2d)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000;
}

function sourceEdges(rowCount: number, shape: GraphEvidenceShape): EdgeInput[] {
  const isolated = Math.max(1, Math.floor(rowCount / 16));
  const usable = Math.max(2, rowCount - isolated);
  const edgeCount = shape === 'near-bound' ? Math.min(10_000, usable * 3) : Math.min(512, usable * 2);
  const edges: EdgeInput[] = [];
  for (let index = 0; index < edgeCount; index += 1) {
    const source = index % usable;
    const target = (index * 7 + 3) % usable;
    const weight = index % 5 === 0 ? 0.5 + (index % 11) : undefined;
    if (shape === 'mixed-endpoints' && index % 2 === 1) {
      edges.push({ source: `graph-b4-row-${source}`, target: `graph-b4-row-${target}`, weight });
    } else {
      edges.push({ source, target, weight });
    }
  }
  edges.push({ source: 0, target: 1, weight: 2 });
  edges.push({ source: 0, target: 1, weight: 2 });
  edges.push({ source: 2, target: 2 });
  if (shape === 'missing-endpoint') {
    edges.push({ source: 'graph-b4-row-0', target: 'missing-source-row-id' });
  }
  return edges;
}

function makeGraphDataset(rowCount: number, shape: GraphEvidenceShape): Dataset {
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const angle = (index / Math.max(1, rowCount)) * Math.PI * 2;
    return {
      x: Math.cos(angle) * 10 + (deterministicUnit(index, 11) - 0.5) * 0.1,
      y: Math.sin(angle) * 10 + (deterministicUnit(index, 17) - 0.5) * 0.1,
      correlationBait: index,
      correlationBaitCopy: index,
      decoyGroup: `g${index % 7}`,
    };
  });
  const rowIds = Array.from({ length: rowCount }, (_, index) => `graph-b4-row-${index}`);
  return new Dataset(
    `p1r-graph-b4-${shape}-${rowCount}`,
    [
      { name: 'x', type: 'NUMERIC' },
      { name: 'y', type: 'NUMERIC' },
      { name: 'correlationBait', type: 'NUMERIC' },
      { name: 'correlationBaitCopy', type: 'NUMERIC' },
      { name: 'decoyGroup', type: 'CATEGORICAL' },
    ],
    rows,
    sourceEdges(rowCount, shape),
    rowIds
  );
}

function makeNoSourceDataset(rowCount: number): Dataset {
  const rows = Array.from({ length: rowCount }, (_, index) => ({
    x: index * 0.001,
    y: index * 0.001,
    correlationBait: index,
    correlationBaitCopy: index,
  }));
  return new Dataset(
    `p1r-graph-b4-no-source-${rowCount}`,
    [
      { name: 'x', type: 'NUMERIC' },
      { name: 'y', type: 'NUMERIC' },
      { name: 'correlationBait', type: 'NUMERIC' },
      { name: 'correlationBaitCopy', type: 'NUMERIC' },
    ],
    rows,
    [],
    Array.from({ length: rowCount }, (_, index) => `graph-b4-no-source-row-${index}`)
  );
}

function requirements(directionality: 'DIRECTED' | 'UNDIRECTED'): RepresentationRequirements {
  const result = createDefaultRequirements('relationship-discovery', ['x', 'y']);
  result.graphAuthority = createSourceRelationshipGraphAuthority(directionality);
  result.requiredStructures = [{ type: 'connectivity', importance: 1 }];
  result.preservationGoals = [
    { information: 'relational-edge-connectivity', priority: 'CRITICAL' },
    { information: 'individual-observation-identity', priority: 'CRITICAL' },
  ];
  result.acceptableLoss.allowIdentityLoss = false;
  result.acceptableLoss.allowExactMetricLoss = true;
  result.acceptableLoss.allowClusterLoss = true;
  return result;
}

function entry(dataset: Dataset, key: string): DatasetLoadEntry {
  return {
    key,
    name: dataset.name,
    label: key,
    topology: 'TABULAR',
    dataset,
    encodings: { color: 'decoyGroup', size: 'correlationBait' },
  };
}

async function settleInitialLoad(world: GraphEvidenceWorld, loadEntry: DatasetLoadEntry): Promise<void> {
  await world.loadDataset(loadEntry);
  const promise = (world.dracoNode?.dataInput as SemanticGraphInput | undefined)
    ?.semanticEmbodimentPromise;
  if (promise) await promise;
  await Promise.resolve();
}

function sceneSnapshot(world: GraphEvidenceWorld): GraphEvidenceScenarioResult['scene'] {
  let objectCount = 0;
  let visibleObjectCount = 0;
  world.engine.scene.traverse((object) => {
    objectCount += 1;
    if (object.visible) visibleObjectCount += 1;
  });
  return {
    objectCount,
    visibleObjectCount,
    renderCallsLastFrame: world.engine.renderer.info.render.calls,
    trianglesLastFrame: world.engine.renderer.info.render.triangles,
  };
}

function workerExecutionObservation(
  diagnostics: readonly AnalyticalWorkerDiagnostic[]
): GraphEvidenceScenarioResult['workerExecution'] {
  const sample = [...diagnostics].reverse().find(
    (entry) =>
      entry.phase === 'execution' &&
      entry.operation === 'semanticEmbodiment' &&
      entry.operationName === 'RELATIONSHIP_GRAPH'
  );
  return {
    kernelMs: sample?.timingMs.kernel ?? null,
    wasmBytesBefore: sample?.wasmBytes.before ?? null,
    wasmBytesAfterKernel: sample?.wasmBytes.afterKernel ?? null,
    wasmBytesAfterMaterialize: sample?.wasmBytes.afterMaterialize ?? null,
  };
}

function positionsDiffer(left: Float32Array | null, right: Float32Array | null): boolean {
  if (!left || !right || left.length !== right.length) return false;
  return left.some((value, index) => Math.abs(value - right[index]) > 1e-6);
}

function topologySummary(envelope: GraphEmbodimentEnvelopeV1): GraphEvidenceScenarioResult['topology'] {
  if (envelope.result.status !== 'READY') throw new Error('Graph B4 topology summary requires READY.');
  const payload = envelope.result.payload.data;
  const degree = new Array<number>(payload.nodes.length).fill(0);
  const multiplicity = new Map<string, number>();
  let selfLoopCount = 0;
  for (const edge of payload.edges) {
    degree[edge.sourceNodeIndex] += 1;
    degree[edge.targetNodeIndex] += 1;
    if (edge.sourceNodeIndex === edge.targetNodeIndex) selfLoopCount += 1;
    const key = `${edge.sourceNodeIndex}:${edge.targetNodeIndex}:${edge.weight ?? 'absent'}`;
    multiplicity.set(key, (multiplicity.get(key) ?? 0) + 1);
  }
  return {
    nodeIds: payload.nodes.map((node) => node.semanticId),
    edges: payload.edges.map((edge) => ({
      semanticId: edge.semanticId,
      sourceNodeIndex: edge.sourceNodeIndex,
      targetNodeIndex: edge.targetNodeIndex,
      weight: edge.weight ?? null,
    })),
    isolatedNodeCount: degree.filter((value) => value === 0).length,
    parallelEdgePairCount: [...multiplicity.values()].reduce(
      (total, count) => total + Math.max(0, count - 1),
      0
    ),
    selfLoopCount,
  };
}

export async function runGraphEvidenceScenario(
  world: GraphEvidenceWorld,
  input: { rowCount: number; shape: ReadyGraphEvidenceShape }
): Promise<GraphEvidenceScenarioResult> {
  if (!Number.isSafeInteger(input.rowCount) || input.rowCount < 16 || input.rowCount > 4096) {
    throw new Error('Graph B4 rowCount must be a safe integer in 16..4096.');
  }
  const port = world.atlas.executionPort;
  if (!port?.isAsync || !port.drainDiagnostics) {
    throw new Error('Graph B4 requires the real asynchronous analytical Worker port.');
  }
  const directionality = input.shape === 'undirected' ? 'UNDIRECTED' : 'DIRECTED';
  const dataset = makeGraphDataset(input.rowCount, input.shape);
  const loadEntry = entry(dataset, `p1r-graph-b4-${input.shape}-${input.rowCount}`);

  port.drainDiagnostics();
  await settleInitialLoad(world, loadEntry);
  port.drainDiagnostics();
  world._activeRequirements = requirements(directionality);
  const startedAt = performance.now();
  world._doLoadDataset(loadEntry, {
    preserveAnalyticalState: true,
    preserveAuxiliaryPresentation: true,
  });

  const node = world.dracoNode;
  if (!node || node.representationDecision?.chosenCandidateId !== 'RELATIONSHIP_GRAPH') {
    throw new Error(
      `Graph B4 expected RELATIONSHIP_GRAPH, received ${node?.representationDecision?.chosenCandidateId ?? 'none'}.`
    );
  }
  const decisionId = node.representationDecision.id;
  if (!decisionId) throw new Error('Graph B4 representation decision has no stable identity.');

  const initialStatus = String(node.group?.userData.semanticEmbodimentStatus ?? 'MISSING');
  const pendingWasVisible = Boolean(
    node.group?.getObjectByName(SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME)?.visible
  );
  const semanticInput = node.dataInput as SemanticGraphInput;
  if (
    semanticInput.semanticEmbodimentCandidateId !== 'RELATIONSHIP_GRAPH' ||
    !semanticInput.semanticEmbodimentPromise
  ) {
    throw new Error('Graph B4 node did not retain the governed graph request.');
  }
  const envelope = await semanticInput.semanticEmbodimentPromise;
  if (!envelope || envelope.result.status !== 'READY') {
    throw new Error(`Graph B4 did not become READY (${envelope?.result.status ?? 'null'}).`);
  }
  await Promise.resolve();
  const readyAt = performance.now();
  await waitFrames(2);
  const renderedAt = performance.now();

  const group = node.group;
  const artifact = node.artifact;
  if (!group || !artifact || semanticInput.semanticEmbodiment !== envelope) {
    throw new Error('Graph B4 did not adopt the exact resolved graph artifact.');
  }
  const metadata = group.userData.semanticEmbodiment as {
    artifactId?: unknown;
    datasetFingerprint?: unknown;
    candidateId?: unknown;
    payloadKind?: unknown;
    provenance?: { decisionId?: unknown };
    presentationSemantics?: unknown;
    supportBoundaryClaim?: unknown;
  } | undefined;
  const renderSurface = group.userData.graphRenderSurface as {
    semanticNodeCount?: unknown;
    semanticEdgeCount?: unknown;
    interactionProxyCount?: unknown;
    renderedBatchCount?: unknown;
    candidateLocalDrawCalls?: unknown;
  } | undefined;
  const artifactId = String(metadata?.artifactId ?? '');
  if (
    !artifactId ||
    metadata?.datasetFingerprint !== envelope.datasetFingerprint ||
    metadata?.candidateId !== 'RELATIONSHIP_GRAPH' ||
    metadata?.payloadKind !== 'RELATIONSHIP_GRAPH' ||
    metadata?.provenance?.decisionId !== decisionId ||
    envelope.provenance.decisionId !== decisionId ||
    envelope.result.payload.kind !== 'RELATIONSHIP_GRAPH'
  ) {
    throw new Error('Graph B4 payload, decision and artifact identity diverged.');
  }
  const payload = envelope.result.payload.data;
  if (
    renderSurface?.semanticNodeCount !== payload.nodes.length ||
    renderSurface?.semanticEdgeCount !== payload.edges.length ||
    renderSurface?.interactionProxyCount !== payload.nodes.length + payload.edges.length ||
    renderSurface?.renderedBatchCount !== 2 ||
    renderSurface?.candidateLocalDrawCalls !== 2 ||
    metadata?.presentationSemantics !== 'force-directed-positioning-over-payload-topology' ||
    metadata?.supportBoundaryClaim !== false
  ) {
    throw new Error('Graph B4 presentation accounting or semantic boundary is invalid.');
  }

  const nodeSemanticIds = artifact.nodeMeshes
    .filter((mesh) => mesh.userData.semanticRole === 'node')
    .map((mesh) => String(mesh.userData.semanticId ?? ''));
  const edgeSemanticIds = artifact.nodeMeshes
    .filter((mesh) => mesh.userData.semanticRole === 'edge')
    .map((mesh) => String(mesh.userData.semanticId ?? ''));
  const topology = topologySummary(envelope);
  if (
    nodeSemanticIds.join('\0') !== topology.nodeIds.join('\0') ||
    edgeSemanticIds.join('\0') !== topology.edges.map((edge) => edge.semanticId).join('\0')
  ) {
    throw new Error('Graph B4 rendered interaction identity differs from the Rust payload.');
  }

  const indexedEdges = payload.edges.map((edge) => ({
    source: edge.sourceNodeIndex,
    target: edge.targetNodeIndex,
    weight: edge.weight ?? 1,
  }));
  const seedA = 1;
  const seedB = 7;
  const layoutA = computeForceDirectedEdges3d(payload.nodes.length, indexedEdges, 120, 120, 0.02, 0.08, 4, 1.2, seedA);
  const layoutB = computeForceDirectedEdges3d(payload.nodes.length, indexedEdges, 120, 120, 0.02, 0.08, 4, 1.2, seedB);

  group.updateMatrixWorld(true);
  const evidence = new PerceptualFitnessSampler().sample(
    {
      candidate: MONETA_REPRESENTATION_CANDIDATES.RELATIONSHIP_GRAPH,
      datasetFingerprint: envelope.datasetFingerprint,
      markPositions: artifact.nodeMeshes.map((mesh) => mesh.getWorldPosition(new THREE.Vector3())),
      deviceClass: 'desktop',
    },
    { position: new THREE.Vector3(0, 1.4, 0), gazeDirection: new THREE.Vector3(0, 0, -1) }
  );
  if (
    evidence.candidateId !== envelope.candidateId ||
    evidence.datasetFingerprint !== envelope.datasetFingerprint
  ) {
    throw new Error('Graph B4 perceptual evidence is not bound to the graph artifact.');
  }

  const workerDiagnostics = port.drainDiagnostics();
  const staleFence = {
    exercised: input.shape === 'mutation-stale',
    evictedEdgeCount: 0,
    statusAfterMutation: null as string | null,
    graphSurfaceAfterMutation: null as boolean | null,
  };
  if (input.shape === 'mutation-stale') {
    const appendCount = Math.max(4, Math.floor(input.rowCount / 8));
    node.appendRows(
      Array.from({ length: appendCount }, (_, index) => ({
        x: 100 + index,
        y: 100 + index,
        correlationBait: 100_000 + index,
        correlationBaitCopy: 100_000 + index,
        decoyGroup: 'mutated',
      })),
      { mode: 'append', limit: input.rowCount }
    );
    await Promise.resolve();
    await waitFrames(2);
    staleFence.evictedEdgeCount = dataset.evictedEdgeCount ?? 0;
    staleFence.statusAfterMutation = String(node.group?.userData.semanticEmbodimentStatus ?? 'MISSING');
    staleFence.graphSurfaceAfterMutation = Boolean(
      node.group?.getObjectByName(GRAPH_NODE_SURFACE_NAME) ||
        node.group?.getObjectByName(GRAPH_EDGE_SURFACE_NAME)
    );
  }

  return {
    schemaVersion: 1,
    sourceRowCount: input.rowCount,
    shape: input.shape,
    directionality,
    candidateId: 'RELATIONSHIP_GRAPH',
    datasetFingerprint: envelope.datasetFingerprint,
    decisionId,
    initialStatus,
    finalStatus: String(node.group?.userData.semanticEmbodimentStatus ?? 'MISSING'),
    statusSurface: {
      pendingWasVisible,
      readySurfaceRemoved: !group.getObjectByName(SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME),
    },
    envelope,
    payloadJsonBytesProxy: jsonBytes(envelope),
    artifact: {
      artifactId,
      semanticNodeCount: Number(renderSurface.semanticNodeCount),
      semanticEdgeCount: Number(renderSurface.semanticEdgeCount),
      interactionProxyCount: Number(renderSurface.interactionProxyCount),
      renderedBatchCount: Number(renderSurface.renderedBatchCount),
      candidateLocalDrawCalls: Number(renderSurface.candidateLocalDrawCalls),
      nodeSurfacePresent: Boolean(group.getObjectByName(GRAPH_NODE_SURFACE_NAME)),
      edgeSurfacePresent: Boolean(group.getObjectByName(GRAPH_EDGE_SURFACE_NAME)),
      nodeSemanticIds,
      edgeSemanticIds,
      presentationSemantics: String(metadata.presentationSemantics),
      supportBoundaryClaim: false,
    },
    topology,
    layoutInvariance: {
      seedA,
      seedB,
      positionsDiffer: positionsDiffer(layoutA, layoutB),
      topologyInvariant: true,
    },
    staleFence,
    timingMs: {
      requestToReady: roundMs(readyAt - startedAt),
      readyToRenderedFrames: roundMs(renderedAt - readyAt),
      total: roundMs(renderedAt - startedAt),
    },
    workerDiagnostics,
    workerExecution: workerExecutionObservation(workerDiagnostics),
    scene: sceneSnapshot(world),
    perceptualBinding: {
      artifactId,
      datasetFingerprint: envelope.datasetFingerprint,
      candidateId: 'RELATIONSHIP_GRAPH',
      payloadKind: 'RELATIONSHIP_GRAPH',
      decisionId,
      communityClaim: false,
      evidence,
    },
  };
}

export async function runGraphMissingEndpointScenario(
  world: GraphEvidenceWorld,
  input: { rowCount: number }
): Promise<GraphRefusalScenarioResult> {
  if (!Number.isSafeInteger(input.rowCount) || input.rowCount < 16 || input.rowCount > 4096) {
    throw new Error('Graph B4 refusal rowCount must be a safe integer in 16..4096.');
  }
  const dataset = makeGraphDataset(input.rowCount, 'missing-endpoint');
  const loadEntry = entry(dataset, `p1r-graph-b4-missing-endpoint-${input.rowCount}`);
  await settleInitialLoad(world, loadEntry);
  world._activeRequirements = requirements('DIRECTED');
  world._doLoadDataset(loadEntry, {
    preserveAnalyticalState: true,
    preserveAuxiliaryPresentation: true,
  });
  const node = world.dracoNode;
  if (!node || node.representationDecision?.chosenCandidateId !== 'RELATIONSHIP_GRAPH') {
    throw new Error('Graph B4 missing-endpoint fixture did not reach graph authority.');
  }
  const decisionId = node.representationDecision.id;
  if (!decisionId) throw new Error('Graph B4 refusal decision has no stable identity.');
  const state = node.dataInput as SemanticGraphInput;
  if (!state.semanticEmbodimentPromise) throw new Error('Graph B4 refusal promise is missing.');
  const envelope = await state.semanticEmbodimentPromise;
  await Promise.resolve();
  await waitFrames(2);
  if (!envelope || envelope.result.status !== 'REFUSED') {
    throw new Error(`Graph B4 missing endpoint was not refused (${envelope?.result.status ?? 'null'}).`);
  }
  return {
    schemaVersion: 1,
    sourceRowCount: input.rowCount,
    candidateId: 'RELATIONSHIP_GRAPH',
    datasetFingerprint: envelope.datasetFingerprint,
    decisionId,
    status: String(node.group?.userData.semanticEmbodimentStatus ?? 'MISSING'),
    envelope,
    graphSurfacePresent: Boolean(
      node.group?.getObjectByName(GRAPH_NODE_SURFACE_NAME) ||
        node.group?.getObjectByName(GRAPH_EDGE_SURFACE_NAME)
    ),
    refusalCode: envelope.result.refusal.code,
    refusalMessage: envelope.result.refusal.message,
  };
}

export async function runGraphNoSourceAuthorityScenario(
  world: GraphEvidenceWorld,
  input: { rowCount: number }
): Promise<GraphNoAuthorityScenarioResult> {
  if (!Number.isSafeInteger(input.rowCount) || input.rowCount < 16 || input.rowCount > 4096) {
    throw new Error('Graph B4 no-source rowCount must be a safe integer in 16..4096.');
  }
  const dataset = makeNoSourceDataset(input.rowCount);
  const loadEntry = entry(dataset, `p1r-graph-b4-no-source-${input.rowCount}`);
  await settleInitialLoad(world, loadEntry);
  world._activeRequirements = requirements('DIRECTED');
  world._doLoadDataset(loadEntry, {
    preserveAnalyticalState: true,
    preserveAuxiliaryPresentation: true,
  });
  const node = world.dracoNode;
  const chosenCandidateId = String(node?.representationDecision?.chosenCandidateId ?? 'none');
  const graphSurfacePresent = Boolean(
    node?.group?.getObjectByName(GRAPH_NODE_SURFACE_NAME) ||
      node?.group?.getObjectByName(GRAPH_EDGE_SURFACE_NAME)
  );
  if (chosenCandidateId === 'RELATIONSHIP_GRAPH' || graphSurfacePresent) {
    throw new Error('Graph B4 invented governed topology without source edges.');
  }
  return {
    schemaVersion: 1,
    sourceRowCount: input.rowCount,
    graphLikeCoordinates: true,
    sourceEdgeCount: 0,
    explicitGraphAuthorityRequested: true,
    chosenCandidateId,
    relationshipGraphChosen: false,
    graphSurfacePresent: false,
  };
}

export function installGraphEvidenceDiagnosticHook(world: GraphEvidenceWorld): () => void {
  const hook: GraphEvidenceDiagnosticHook = {
    schemaVersion: 1,
    runScenario: (input) => runGraphEvidenceScenario(world, input),
    runMissingEndpointScenario: (input) => runGraphMissingEndpointScenario(world, input),
    runNoSourceAuthorityScenario: (input) => runGraphNoSourceAuthorityScenario(world, input),
  };
  window.__NEMOSYNE_GRAPH_B4_EVIDENCE__ = hook;
  return () => {
    if (window.__NEMOSYNE_GRAPH_B4_EVIDENCE__ === hook) {
      delete window.__NEMOSYNE_GRAPH_B4_EVIDENCE__;
    }
  };
}

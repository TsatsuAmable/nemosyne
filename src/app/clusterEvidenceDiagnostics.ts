import * as THREE from 'three';
import type { AtlasCore } from '../atlas/AtlasCore.ts';
import type { AnalyticalWorkerDiagnostic } from '../atlas/ports/AnalyticalExecutionPort.ts';
import { Dataset } from '../data/Dataset.ts';
import {
  CLUSTER_BOUNDS_SURFACE_NAME,
  CLUSTER_CENTROID_SURFACE_NAME,
} from '../moneta/embodiment/ClusterSemanticEmbodiment.ts';
import { SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME } from '../moneta/embodiment/SemanticEmbodimentStatus.ts';
import { MONETA_REPRESENTATION_CANDIDATES } from '../moneta/representation/RepresentationCandidate.ts';
import type { ClusterEmbodimentEnvelopeV1 } from '../moneta/representation/ClusterEmbodimentPayload.ts';
import {
  createDefaultRequirements,
  type RepresentationRequirements,
} from '../moneta/representation/RepresentationRequirements.ts';
import { PerceptualFitnessSampler } from '../vr/perception/PerceptualFitnessSampler.ts';
import type { DatasetLoadEntry } from '../vr/coordinators/types.ts';

export type ClusterEvidenceShape =
  | 'balanced'
  | 'one-cluster'
  | 'near-bound'
  | 'overlap'
  | 'missing-labels'
  | 'invalid-coordinates'
  | 'imbalanced';

interface ClusterEvidenceWorld {
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

interface SemanticClusterInput {
  semanticEmbodimentCandidateId?: 'CLUSTER_REGIONS';
  semanticEmbodiment?: ClusterEmbodimentEnvelopeV1 | null;
  semanticEmbodimentPromise?: Promise<ClusterEmbodimentEnvelopeV1 | null>;
}

export interface ClusterEvidenceScenarioResult {
  schemaVersion: 1;
  sourceRowCount: number;
  shape: ClusterEvidenceShape;
  partitionField: 'cohort';
  coordinateFields: ['x', 'y'];
  candidateId: 'CLUSTER_REGIONS';
  datasetFingerprint: string;
  decisionId: string;
  initialStatus: string;
  finalStatus: string;
  statusSurface: {
    pendingWasVisible: boolean;
    readySurfaceRemoved: boolean;
  };
  envelope: ClusterEmbodimentEnvelopeV1;
  payloadJsonBytesProxy: number;
  artifact: {
    artifactId: string;
    semanticRegionCount: number;
    spatialRegionCount: number;
    unavailableSpatialRegionCount: number;
    interactionProxyCount: number;
    renderedBatchCount: number;
    candidateLocalDrawCalls: number;
    centroidSurfacePresent: boolean;
    boundsSurfacePresent: boolean;
    semanticIds: string[];
    representationKinds: string[];
    assignedCounts: number[];
    coordinateExcludedCounts: number[];
    presentationSemantics: string;
    supportBoundaryClaim: boolean;
  };
  timingMs: {
    initialLoad: number;
    requestToReady: number;
    readyToRenderedFrames: number;
    total: number;
  };
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
    candidateId: 'CLUSTER_REGIONS';
    payloadKind: 'CLUSTER_REGIONS';
    decisionId: string;
    evidence: ReturnType<PerceptualFitnessSampler['sample']>;
  };
}

function roundMs(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function deterministicUnit(index: number, salt: number): number {
  let value = (Math.imul(index + 1, 0x45d9f3b) ^ Math.imul(salt + 1, 0x27d4eb2d)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000;
}

function clusterCountForShape(shape: ClusterEvidenceShape): number {
  switch (shape) {
    case 'one-cluster':
      return 1;
    case 'near-bound':
      return 240;
    case 'overlap':
      return 4;
    default:
      return 8;
  }
}

function clusterIndexForRow(index: number, shape: ClusterEvidenceShape): number {
  const clusterCount = clusterCountForShape(shape);
  if (shape === 'one-cluster') return 0;
  if (shape === 'imbalanced') {
    return index % 10 === 0 ? 1 + (Math.floor(index / 10) % (clusterCount - 1)) : 0;
  }
  return index % clusterCount;
}

function coordinatesForRow(
  index: number,
  clusterIndex: number,
  shape: ClusterEvidenceShape
): { x: number; y: number } {
  const jitterX = deterministicUnit(index, 41) - 0.5;
  const jitterY = deterministicUnit(index, 53) - 0.5;
  if (shape === 'overlap') {
    return {
      x: 5 + clusterIndex * 0.04 + jitterX * 2.2,
      y: 5 - clusterIndex * 0.04 + jitterY * 2.2,
    };
  }
  if (shape === 'one-cluster') {
    return { x: 5 + jitterX * 3, y: 5 + jitterY * 3 };
  }
  if (shape === 'near-bound') {
    const col = clusterIndex % 20;
    const row = Math.floor(clusterIndex / 20);
    return { x: col * 0.5 + jitterX * 0.18, y: row * 0.5 + jitterY * 0.18 };
  }
  const col = clusterIndex % 4;
  const row = Math.floor(clusterIndex / 4);
  return { x: col * 3 + jitterX, y: row * 4 + jitterY };
}

function makeClusterDataset(rowCount: number, shape: ClusterEvidenceShape): Dataset {
  const rows = new Array<Record<string, unknown>>(rowCount);
  const rowIds = new Array<string>(rowCount);
  for (let index = 0; index < rowCount; index += 1) {
    const clusterIndex = clusterIndexForRow(index, shape);
    const point = coordinatesForRow(index, clusterIndex, shape);
    const missingPartition = shape === 'missing-labels' && index % 10 === 0;
    const invalidCoordinates = shape === 'invalid-coordinates' && clusterIndex === 7;
    rows[index] = {
      cohort: missingPartition ? null : `c${String(clusterIndex).padStart(3, '0')}`,
      decoy: `decoy-${index % 3}`,
      x: invalidCoordinates ? null : Math.round(point.x * 1000) / 1000,
      y: invalidCoordinates ? null : Math.round(point.y * 1000) / 1000,
      magnitude: Math.round(deterministicUnit(index, 71) * 10_000) / 100,
    };
    rowIds[index] = `p1r-cluster-c4-${shape}-${index}`;
  }
  return new Dataset(
    `p1r-cluster-c4-${shape}-${rowCount}`,
    [
      { name: 'cohort', type: 'CATEGORICAL' },
      { name: 'decoy', type: 'CATEGORICAL' },
      { name: 'x', type: 'NUMERIC' },
      { name: 'y', type: 'NUMERIC' },
      { name: 'magnitude', type: 'NUMERIC' },
    ],
    rows,
    undefined,
    rowIds
  );
}

function waitFrames(count = 2): Promise<void> {
  return new Promise((resolve) => {
    const next = (remaining: number): void => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => next(remaining - 1));
    };
    next(count);
  });
}

function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function sceneSnapshot(world: ClusterEvidenceWorld): ClusterEvidenceScenarioResult['scene'] {
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
): ClusterEvidenceScenarioResult['workerExecution'] {
  const sample = [...diagnostics]
    .reverse()
    .find(
      (entry) =>
        entry.phase === 'execution' &&
        entry.operation === 'semanticEmbodiment' &&
        entry.operationName === 'CLUSTER_REGIONS'
    );
  return {
    kernelMs: sample?.timingMs.kernel ?? null,
    wasmBytesBefore: sample?.wasmBytes.before ?? null,
    wasmBytesAfterKernel: sample?.wasmBytes.afterKernel ?? null,
    wasmBytesAfterMaterialize: sample?.wasmBytes.afterMaterialize ?? null,
  };
}

/**
 * R2D C4 synthetic evidence driver. It selects deterministic source-authoritative
 * partition fixtures and records the real production path. It does not infer,
 * repair or reinterpret cluster membership or spatial summaries.
 */
export async function runClusterEvidenceScenario(
  world: ClusterEvidenceWorld,
  input: { rowCount: number; shape: ClusterEvidenceShape }
): Promise<ClusterEvidenceScenarioResult> {
  if (!Number.isSafeInteger(input.rowCount) || input.rowCount < 256 || input.rowCount > 100_000) {
    throw new Error('Cluster C4 rowCount must be a safe integer in 256..100000.');
  }
  if (
    ![
      'balanced',
      'one-cluster',
      'near-bound',
      'overlap',
      'missing-labels',
      'invalid-coordinates',
      'imbalanced',
    ].includes(input.shape)
  ) {
    throw new Error(`Unsupported Cluster C4 shape: ${String(input.shape)}.`);
  }
  const port = world.atlas.executionPort;
  if (!port?.isAsync || !port.drainDiagnostics) {
    throw new Error('Cluster C4 requires the real asynchronous analytical Worker port.');
  }

  port.drainDiagnostics();
  const dataset = makeClusterDataset(input.rowCount, input.shape);
  const entry = {
    key: `p1r-cluster-c4-${input.shape}-${input.rowCount}`,
    name: dataset.name,
    label: `Source partition ${input.shape} - ${input.rowCount} rows`,
    topology: 'TABULAR' as const,
    dataset,
    // Deliberately point colour at a decoy categorical. Scientific cluster
    // authority must come only from requirements.clusterAuthority.field.
    encodings: { color: 'decoy', size: 'magnitude' },
  };

  const totalStartedAt = performance.now();
  const loadStartedAt = performance.now();
  await world.loadDataset(entry);
  const initialSemanticPromise = (
    world.dracoNode?.dataInput as SemanticClusterInput | undefined
  )?.semanticEmbodimentPromise;
  if (initialSemanticPromise) await initialSemanticPromise;
  await Promise.resolve();
  const initialLoadMs = performance.now() - loadStartedAt;
  port.drainDiagnostics();

  const requirements = createDefaultRequirements('cluster-comparison', ['x', 'y']);
  requirements.clusterAuthority = { kind: 'SOURCE_PARTITION', field: 'cohort' };
  requirements.requiredStructures = [
    { type: 'cluster-separation', importance: 1 },
    { type: 'group-comparison', importance: 1 },
  ];
  requirements.preservationGoals = [
    { information: 'cluster-separation', priority: 'CRITICAL' },
    { information: 'aggregate-group-magnitude', priority: 'DESIRED' },
  ];
  requirements.acceptableLoss.allowIdentityLoss = true;
  requirements.acceptableLoss.allowExactMetricLoss = true;
  requirements.acceptableLoss.allowClusterLoss = false;
  world._activeRequirements = requirements;

  const requestStartedAt = performance.now();
  world._doLoadDataset(entry, {
    preserveAnalyticalState: true,
    preserveAuxiliaryPresentation: true,
  });

  const node = world.dracoNode;
  if (!node || node.representationDecision?.chosenCandidateId !== 'CLUSTER_REGIONS') {
    throw new Error(
      `Cluster C4 expected CLUSTER_REGIONS, received ${node?.representationDecision?.chosenCandidateId ?? 'none'}.`
    );
  }
  if (node.representationDecision.embodiment.primaryGeometry !== 'CLUSTER_VOLUME') {
    throw new Error('Cluster C4 decision did not retain CLUSTER_VOLUME presentation geometry.');
  }

  const initialStatus = String(node.group?.userData.semanticEmbodimentStatus ?? 'MISSING');
  const pendingWasVisible = Boolean(
    node.group?.getObjectByName(SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME)?.visible
  );
  const semanticInput = node.dataInput as SemanticClusterInput;
  if (semanticInput.semanticEmbodimentCandidateId !== 'CLUSTER_REGIONS') {
    throw new Error('Cluster C4 node did not carry explicit CLUSTER_REGIONS semantic authority.');
  }
  const semanticPromise = semanticInput.semanticEmbodimentPromise;
  if (!semanticPromise) throw new Error('Cluster C4 semantic embodiment promise is missing.');
  const envelope = await semanticPromise;
  if (!envelope || envelope.result.status !== 'READY') {
    throw new Error(
      `Cluster C4 did not become READY (status=${envelope?.result.status ?? 'null'}).`
    );
  }
  await Promise.resolve();
  const readyAt = performance.now();
  await waitFrames(2);
  const renderedAt = performance.now();

  const artifact = node.artifact;
  const group = node.group;
  if (!artifact || !group) throw new Error('Cluster C4 ready artifact is missing.');
  if (semanticInput.semanticEmbodiment !== envelope) {
    throw new Error('Cluster C4 node did not adopt the exact resolved semantic envelope.');
  }
  if (envelope.result.payload.kind !== 'CLUSTER_REGIONS') {
    throw new Error('Cluster C4 received a non-cluster READY payload.');
  }

  const artifactMetadata = group.userData.semanticEmbodiment as
    | {
        artifactId?: unknown;
        datasetFingerprint?: unknown;
        candidateId?: unknown;
        payloadKind?: unknown;
        provenance?: { decisionId?: unknown };
        presentationSemantics?: unknown;
        supportBoundaryClaim?: unknown;
      }
    | undefined;
  const renderSurface = group.userData.clusterRenderSurface as
    | {
        semanticRegionCount?: unknown;
        spatialRegionCount?: unknown;
        unavailableSpatialRegionCount?: unknown;
        interactionProxyCount?: unknown;
        renderedBatchCount?: unknown;
        candidateLocalDrawCalls?: unknown;
      }
    | undefined;
  const artifactId = String(artifactMetadata?.artifactId ?? '');
  const decisionId = node.representationDecision.id;
  if (
    !decisionId ||
    !artifactId ||
    artifactMetadata?.datasetFingerprint !== envelope.datasetFingerprint ||
    artifactMetadata?.candidateId !== envelope.candidateId ||
    artifactMetadata?.payloadKind !== envelope.result.payload.kind ||
    artifactMetadata?.provenance?.decisionId !== decisionId ||
    envelope.provenance.decisionId !== decisionId
  ) {
    throw new Error('Cluster C4 payload, decision and artifact identity did not agree.');
  }

  const payload = envelope.result.payload.data;
  const spatialRegions = payload.regions.filter((region) => region.spatialSummary !== null);
  if (artifact.nodeMeshes.length !== spatialRegions.length) {
    throw new Error('Cluster C4 interaction proxy count does not equal spatially representable regions.');
  }
  if (
    renderSurface?.semanticRegionCount !== payload.regions.length ||
    renderSurface?.spatialRegionCount !== spatialRegions.length ||
    renderSurface?.interactionProxyCount !== artifact.nodeMeshes.length ||
    renderSurface?.renderedBatchCount !== 2 ||
    renderSurface?.candidateLocalDrawCalls !== 2
  ) {
    throw new Error('Cluster C4 render-surface accounting does not match the semantic payload.');
  }
  if (
    artifactMetadata?.presentationSemantics !==
      'centroid-and-descriptive-axis-aligned-min-max-bounds' ||
    artifactMetadata?.supportBoundaryClaim !== false
  ) {
    throw new Error('Cluster C4 presentation metadata overclaims analytical cluster boundaries.');
  }

  group.updateMatrixWorld(true);
  const markPositions = artifact.nodeMeshes.map((mesh) => mesh.getWorldPosition(new THREE.Vector3()));
  const perceptualEvidence = new PerceptualFitnessSampler().sample(
    {
      candidate: MONETA_REPRESENTATION_CANDIDATES.CLUSTER_REGIONS,
      datasetFingerprint: envelope.datasetFingerprint,
      markPositions,
      deviceClass: 'desktop',
    },
    {
      position: new THREE.Vector3(0, 1.4, 0),
      gazeDirection: new THREE.Vector3(0, 0, -1),
    }
  );
  if (
    perceptualEvidence.candidateId !== envelope.candidateId ||
    perceptualEvidence.datasetFingerprint !== envelope.datasetFingerprint
  ) {
    throw new Error('Cluster C4 perceptual evidence is not bound to the rendered cluster identity.');
  }

  const workerDiagnostics = port.drainDiagnostics();
  return {
    schemaVersion: 1,
    sourceRowCount: input.rowCount,
    shape: input.shape,
    partitionField: 'cohort',
    coordinateFields: ['x', 'y'],
    candidateId: 'CLUSTER_REGIONS',
    datasetFingerprint: envelope.datasetFingerprint,
    decisionId,
    initialStatus,
    finalStatus: String(group.userData.semanticEmbodimentStatus ?? 'MISSING'),
    statusSurface: {
      pendingWasVisible,
      readySurfaceRemoved: !group.getObjectByName(SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME),
    },
    envelope,
    payloadJsonBytesProxy: jsonBytes(envelope),
    artifact: {
      artifactId,
      semanticRegionCount: Number(renderSurface.semanticRegionCount),
      spatialRegionCount: Number(renderSurface.spatialRegionCount),
      unavailableSpatialRegionCount: Number(renderSurface.unavailableSpatialRegionCount),
      interactionProxyCount: artifact.nodeMeshes.length,
      renderedBatchCount: Number(renderSurface.renderedBatchCount),
      candidateLocalDrawCalls: Number(renderSurface.candidateLocalDrawCalls),
      centroidSurfacePresent: Boolean(group.getObjectByName(CLUSTER_CENTROID_SURFACE_NAME)),
      boundsSurfacePresent: Boolean(group.getObjectByName(CLUSTER_BOUNDS_SURFACE_NAME)),
      semanticIds: artifact.nodeMeshes.map((mesh) => String(mesh.userData.semanticId ?? '')),
      representationKinds: artifact.nodeMeshes.map((mesh) =>
        String(mesh.userData.representationKind ?? '')
      ),
      assignedCounts: payload.regions.map((region) => region.assignedCount),
      coordinateExcludedCounts: payload.regions.map((region) => region.coordinateExcludedCount),
      presentationSemantics: String(artifactMetadata.presentationSemantics),
      supportBoundaryClaim: false,
    },
    timingMs: {
      initialLoad: roundMs(initialLoadMs),
      requestToReady: roundMs(readyAt - requestStartedAt),
      readyToRenderedFrames: roundMs(renderedAt - readyAt),
      total: roundMs(renderedAt - totalStartedAt),
    },
    workerDiagnostics,
    workerExecution: workerExecutionObservation(workerDiagnostics),
    scene: sceneSnapshot(world),
    perceptualBinding: {
      artifactId,
      datasetFingerprint: envelope.datasetFingerprint,
      candidateId: 'CLUSTER_REGIONS',
      payloadKind: 'CLUSTER_REGIONS',
      decisionId,
      evidence: perceptualEvidence,
    },
  };
}

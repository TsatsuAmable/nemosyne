import * as THREE from 'three';
import type { AtlasCore } from '../atlas/AtlasCore.ts';
import type { AnalyticalWorkerDiagnostic } from '../atlas/ports/AnalyticalExecutionPort.ts';
import { Dataset } from '../data/Dataset.ts';
import { SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME } from '../moneta/embodiment/SemanticEmbodimentStatus.ts';
import { MONETA_REPRESENTATION_CANDIDATES } from '../moneta/representation/RepresentationCandidate.ts';
import { createDefaultRequirements } from '../moneta/representation/RepresentationRequirements.ts';
import type { RepresentationRequirements } from '../moneta/representation/RepresentationRequirements.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../moneta/representation/SemanticEmbodimentPayload.ts';
import { PerceptualFitnessSampler } from '../vr/perception/PerceptualFitnessSampler.ts';
import type { DatasetLoadEntry } from '../vr/coordinators/types.ts';

export type DensityEvidenceShape = 'multimodal' | 'sparse' | 'uniform' | 'constant';

interface DensityEvidenceWorld {
  atlas: Pick<AtlasCore, 'executionPort'>;
  engine: {
    scene: THREE.Scene;
    renderer: { info: { render: { calls: number; triangles: number } } };
  };
  dracoNode: import('../moneta/MonetaTopologyNode.ts').MonetaTopologyNode | null;
  _activeRequirements: RepresentationRequirements;
  loadDataset(entry: DatasetLoadEntry): void;
  _doLoadDataset(
    entry: DatasetLoadEntry,
    options: { preserveAnalyticalState?: boolean; preserveAuxiliaryPresentation?: boolean }
  ): void;
}

interface SemanticDensityInput {
  semanticEmbodiment?: SemanticEmbodimentEnvelopeV1 | null;
  semanticEmbodimentPromise?: Promise<SemanticEmbodimentEnvelopeV1 | null>;
}

export interface DensityEvidenceScenarioResult {
  schemaVersion: 1;
  sourceRowCount: number;
  shape: DensityEvidenceShape;
  measureFieldX: 'x';
  measureFieldY: 'y';
  candidateId: 'DENSITY_FIELD';
  datasetFingerprint: string;
  decisionId: string;
  initialStatus: string;
  finalStatus: string;
  statusSurface: {
    pendingWasVisible: boolean;
    readySurfaceRemoved: boolean;
  };
  envelope: SemanticEmbodimentEnvelopeV1;
  payloadJsonBytesProxy: number;
  artifact: {
    artifactId: string;
    analyticalMeshCount: number;
    occupiedCellCount: number;
    zeroCellCount: number;
    maxCellCount: number;
    semanticIds: string[];
    representationKinds: string[];
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
    candidateId: 'DENSITY_FIELD';
    payloadKind: 'BINNED_DENSITY';
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

function densityCoordinates(index: number, shape: DensityEvidenceShape): { x: number; y: number } {
  if (shape === 'constant') return { x: 5, y: 7 };
  if (shape === 'sparse') {
    const anchors = [
      [0.5, 0.5],
      [2.5, 7.5],
      [7.5, 2.5],
      [9.5, 9.5],
    ] as const;
    const anchor = anchors[index % anchors.length];
    return { x: anchor[0], y: anchor[1] };
  }
  if (shape === 'uniform') {
    return {
      x: deterministicUnit(index, 13) * 10,
      y: deterministicUnit(index, 29) * 10,
    };
  }

  const cluster = index % 3;
  const centerX = cluster === 0 ? 2 : cluster === 1 ? 5 : 8;
  const centerY = cluster === 0 ? 7.5 : cluster === 1 ? 2 : 7;
  return {
    x: Math.max(0, Math.min(10, centerX + (deterministicUnit(index, 41) - 0.5) * 1.8)),
    y: Math.max(0, Math.min(10, centerY + (deterministicUnit(index, 53) - 0.5) * 1.8)),
  };
}

function makeDensityDataset(rowCount: number, shape: DensityEvidenceShape): Dataset {
  const rows = new Array<Record<string, unknown>>(rowCount);
  const rowIds = new Array<string>(rowCount);
  for (let index = 0; index < rowCount; index++) {
    const point = densityCoordinates(index, shape);
    rows[index] = {
      cohort: `c${index % 8}`,
      x: Math.round(point.x * 1000) / 1000,
      y: Math.round(point.y * 1000) / 1000,
      distractor: Math.round(deterministicUnit(index, 71) * 10_000) / 100,
    };
    rowIds[index] = `p1r-density-m4-${shape}-${index}`;
  }
  return new Dataset(
    `p1r-density-m4-${shape}-${rowCount}`,
    [
      { name: 'cohort', type: 'CATEGORICAL' },
      { name: 'x', type: 'NUMERIC' },
      { name: 'y', type: 'NUMERIC' },
      { name: 'distractor', type: 'NUMERIC' },
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

function sceneSnapshot(world: DensityEvidenceWorld): DensityEvidenceScenarioResult['scene'] {
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
): DensityEvidenceScenarioResult['workerExecution'] {
  const sample = [...diagnostics]
    .reverse()
    .find(
      (entry) =>
        entry.phase === 'execution' &&
        entry.operation === 'semanticEmbodiment' &&
        entry.operationName === 'DENSITY_FIELD'
    );
  return {
    kernelMs: sample?.timingMs.kernel ?? null,
    wasmBytesBefore: sample?.wasmBytes.before ?? null,
    wasmBytesAfterKernel: sample?.wasmBytes.afterKernel ?? null,
    wasmBytesAfterMaterialize: sample?.wasmBytes.afterMaterialize ?? null,
  };
}

/**
 * R2C M4 synthetic evidence driver. It selects deterministic fixtures and
 * records production state; it does not compute, repair or reinterpret density.
 */
export async function runDensityEvidenceScenario(
  world: DensityEvidenceWorld,
  input: { rowCount: number; shape: DensityEvidenceShape }
): Promise<DensityEvidenceScenarioResult> {
  if (!Number.isSafeInteger(input.rowCount) || input.rowCount < 50 || input.rowCount > 100_000) {
    throw new Error('Density M4 rowCount must be a safe integer in 50..100000.');
  }
  if (!['multimodal', 'sparse', 'uniform', 'constant'].includes(input.shape)) {
    throw new Error(`Unsupported Density M4 shape: ${String(input.shape)}.`);
  }
  const port = world.atlas.executionPort;
  if (!port?.isAsync || !port.drainDiagnostics) {
    throw new Error('Density M4 requires the real asynchronous analytical Worker port.');
  }

  port.drainDiagnostics();
  const dataset = makeDensityDataset(input.rowCount, input.shape);
  const entry = {
    key: `p1r-density-m4-${input.shape}-${input.rowCount}`,
    name: dataset.name,
    label: `Binned density ${input.shape} - ${input.rowCount} rows`,
    topology: 'TABULAR' as const,
    dataset,
    encodings: { color: 'cohort', size: 'distractor' },
  };

  const totalStartedAt = performance.now();
  const loadStartedAt = performance.now();
  world.loadDataset(entry);
  const initialSemanticPromise = (
    world.dracoNode?.dataInput as SemanticDensityInput | undefined
  )?.semanticEmbodimentPromise;
  if (initialSemanticPromise) await initialSemanticPromise;
  await Promise.resolve();
  const initialLoadMs = performance.now() - loadStartedAt;
  port.drainDiagnostics();

  const requirements = createDefaultRequirements('spatial-analysis', ['x', 'y']);
  requirements.requiredStructures = [{ type: 'density', importance: 1 }];
  requirements.preservationGoals = [
    { information: 'empirical-bivariate-bin-mass', priority: 'CRITICAL' },
  ];
  requirements.acceptableLoss.allowIdentityLoss = true;
  requirements.acceptableLoss.allowExactMetricLoss = true;
  world._activeRequirements = requirements;

  const requestStartedAt = performance.now();
  world._doLoadDataset(entry, {
    preserveAnalyticalState: true,
    preserveAuxiliaryPresentation: true,
  });

  const node = world.dracoNode;
  if (!node || node.representationDecision?.chosenCandidateId !== 'DENSITY_FIELD') {
    throw new Error(
      `Density M4 expected DENSITY_FIELD, received ${node?.representationDecision?.chosenCandidateId ?? 'none'}.`
    );
  }
  if (node.representationDecision.embodiment.primaryGeometry !== 'DENSITY_FIELD') {
    throw new Error('Density M4 decision did not retain DENSITY_FIELD geometry.');
  }

  const initialStatus = String(node.group?.userData.semanticEmbodimentStatus ?? 'MISSING');
  const pendingWasVisible = Boolean(
    node.group?.getObjectByName(SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME)?.visible
  );
  const semanticInput = node.dataInput as SemanticDensityInput;
  const envelope = await semanticInput.semanticEmbodimentPromise;
  if (!envelope || envelope.result.status !== 'READY') {
    throw new Error(
      `Density M4 did not become READY (status=${envelope?.result.status ?? 'null'}).`
    );
  }
  await Promise.resolve();
  const readyAt = performance.now();
  await waitFrames(2);
  const renderedAt = performance.now();

  const artifact = node.artifact;
  const group = node.group;
  if (!artifact || !group) throw new Error('Density M4 ready artifact is missing.');
  if (semanticInput.semanticEmbodiment !== envelope) {
    throw new Error('Density M4 node did not adopt the exact resolved semantic envelope.');
  }
  if (envelope.result.payload.kind !== 'BINNED_DENSITY') {
    throw new Error('Density M4 received a non-density READY payload.');
  }

  const artifactMetadata = group.userData.semanticEmbodiment as
    | {
        artifactId?: unknown;
        datasetFingerprint?: unknown;
        candidateId?: unknown;
        payloadKind?: unknown;
        provenance?: { decisionId?: unknown };
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
    throw new Error('Density M4 payload, decision and artifact identity did not agree.');
  }

  const cells = envelope.result.payload.data.grid;
  const meshes = artifact.nodeMeshes;
  if (meshes.length !== envelope.resource.elementCount || meshes.length !== cells.length) {
    throw new Error('Density M4 rendered mesh count does not equal the Rust resource envelope.');
  }
  const occupiedCellCount = cells.filter((cell) => cell.count > 0).length;
  const zeroCellCount = cells.length - occupiedCellCount;
  const maxCellCount = Math.max(0, ...cells.map((cell) => cell.count));

  if (input.shape === 'constant') {
    const nonZeroCells = cells.filter((cell) => cell.count > 0);
    if (
      nonZeroCells.length !== 1 ||
      nonZeroCells[0].xIndex !== envelope.result.payload.data.binsX - 1 ||
      nonZeroCells[0].yIndex !== envelope.result.payload.data.binsY - 1 ||
      nonZeroCells[0].count !== input.rowCount
    ) {
      throw new Error('Density M4 constant-domain payload violated the governed final-bin policy.');
    }
  }

  group.updateMatrixWorld(true);
  const markPositions = meshes.map((mesh) => mesh.getWorldPosition(new THREE.Vector3()));
  const perceptualEvidence = new PerceptualFitnessSampler().sample(
    {
      candidate: MONETA_REPRESENTATION_CANDIDATES.DENSITY_FIELD,
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
    throw new Error('Density M4 perceptual evidence is not bound to the rendered density identity.');
  }

  const workerDiagnostics = port.drainDiagnostics();
  return {
    schemaVersion: 1,
    sourceRowCount: input.rowCount,
    shape: input.shape,
    measureFieldX: 'x',
    measureFieldY: 'y',
    candidateId: 'DENSITY_FIELD',
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
      analyticalMeshCount: meshes.length,
      occupiedCellCount,
      zeroCellCount,
      maxCellCount,
      semanticIds: meshes.map((mesh) => mesh.name),
      representationKinds: meshes.map((mesh) => String(mesh.userData.representationKind ?? '')),
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
      candidateId: 'DENSITY_FIELD',
      payloadKind: 'BINNED_DENSITY',
      decisionId,
      evidence: perceptualEvidence,
    },
  };
}

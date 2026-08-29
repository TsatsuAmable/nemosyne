import * as THREE from 'three';
import type { AtlasCore } from '../atlas/AtlasCore.ts';
import type { AnalyticalWorkerDiagnostic } from '../atlas/ports/AnalyticalExecutionPort.ts';
import { Dataset } from '../data/Dataset.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../moneta/representation/SemanticEmbodimentPayload.ts';
import { MONETA_REPRESENTATION_CANDIDATES } from '../moneta/representation/RepresentationCandidate.ts';
import { createDefaultRequirements } from '../moneta/representation/RepresentationRequirements.ts';
import { SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME } from '../moneta/embodiment/SemanticEmbodimentStatus.ts';
import type { RepresentationRequirements } from '../moneta/representation/RepresentationRequirements.ts';
import { PerceptualFitnessSampler } from '../vr/perception/PerceptualFitnessSampler.ts';
import type { DatasetLoadEntry } from '../vr/coordinators/types.ts';

interface DistributionEvidenceWorld {
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

interface SemanticDistributionInput {
  semanticEmbodiment?: SemanticEmbodimentEnvelopeV1 | null;
  semanticEmbodimentPromise?: Promise<SemanticEmbodimentEnvelopeV1 | null>;
}

export interface DistributionEvidenceScenarioResult {
  schemaVersion: 1;
  sourceRowCount: number;
  measureField: string;
  candidateId: 'DISTRIBUTION_FIELD';
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
    histogramMeshCount: number;
    ecdfMeshCount: number;
    quantileMeshCount: number;
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
  scene: {
    objectCount: number;
    visibleObjectCount: number;
    renderCallsLastFrame: number;
    trianglesLastFrame: number;
  };
  perceptualBinding: {
    artifactId: string;
    datasetFingerprint: string;
    candidateId: 'DISTRIBUTION_FIELD';
    payloadKind: 'EMPIRICAL_DISTRIBUTION';
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

function makeDistributionDataset(rowCount: number): Dataset {
  const rows = new Array<Record<string, unknown>>(rowCount);
  const rowIds = new Array<string>(rowCount);
  for (let index = 0; index < rowCount; index++) {
    const mixture = index % 5 === 0 ? 2.5 : index % 3 === 0 ? -1.25 : 0.4;
    rows[index] = {
      cohort: `c${index % 8}`,
      value:
        Math.round((mixture + deterministicUnit(index, 17) * 1.75 + (index % 97) / 250) * 1000) /
        1000,
      distractor: Math.round(deterministicUnit(index, 31) * 10_000) / 100,
    };
    rowIds[index] = `stream-m-m4-${index}`;
  }
  return new Dataset(
    `stream-m-m4-distribution-${rowCount}`,
    [
      { name: 'cohort', type: 'CATEGORICAL' },
      { name: 'value', type: 'NUMERIC' },
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

function sceneSnapshot(
  world: DistributionEvidenceWorld
): DistributionEvidenceScenarioResult['scene'] {
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

/**
 * M4 synthetic evidence driver. It selects inputs and records production state;
 * it never computes or repairs distribution statistics.
 */
export async function runDistributionEvidenceScenario(
  world: DistributionEvidenceWorld,
  input: { rowCount: number; measureField: string }
): Promise<DistributionEvidenceScenarioResult> {
  if (!Number.isSafeInteger(input.rowCount) || input.rowCount < 50 || input.rowCount > 100_000) {
    throw new Error('M4 rowCount must be a safe integer in 50..100000.');
  }
  if (input.measureField !== 'value') {
    throw new Error('M4 canonical scenario requires the explicit measureField "value".');
  }
  const port = world.atlas.executionPort;
  if (!port?.isAsync || !port.drainDiagnostics) {
    throw new Error('M4 requires the real asynchronous analytical Worker port.');
  }

  port.drainDiagnostics();
  const dataset = makeDistributionDataset(input.rowCount);
  const entry = {
    key: `stream-m-m4-${input.rowCount}`,
    name: dataset.name,
    label: `Empirical distribution — ${input.rowCount} rows`,
    topology: 'TABULAR' as const,
    dataset,
    encodings: { color: 'cohort', size: 'distractor' },
  };

  const totalStartedAt = performance.now();
  const loadStartedAt = performance.now();
  world.loadDataset(entry);
  const initialSemanticPromise = (
    world.dracoNode?.dataInput as SemanticDistributionInput | undefined
  )?.semanticEmbodimentPromise;
  if (initialSemanticPromise) await initialSemanticPromise;
  await Promise.resolve();
  const initialLoadMs = performance.now() - loadStartedAt;
  // The canonical measurement begins after the ordinary initial-load decision
  // settles, so its Worker timing cannot be confused with the explicit M4
  // distribution-intent execution below.
  port.drainDiagnostics();

  const requirements = createDefaultRequirements('distribution-analysis', [input.measureField]);
  requirements.requiredStructures = [{ type: 'distribution', importance: 1 }];
  requirements.acceptableLoss.allowIdentityLoss = true;
  requirements.acceptableLoss.allowExactMetricLoss = true;
  world._activeRequirements = requirements;

  const requestStartedAt = performance.now();
  world._doLoadDataset(entry, {
    preserveAnalyticalState: true,
    preserveAuxiliaryPresentation: true,
  });

  const node = world.dracoNode;
  if (!node || node.representationDecision?.chosenCandidateId !== 'DISTRIBUTION_FIELD') {
    throw new Error(
      `M4 expected DISTRIBUTION_FIELD, received ${node?.representationDecision?.chosenCandidateId ?? 'none'}.`
    );
  }
  if (node.representationDecision.embodiment.primaryGeometry !== 'DISTRIBUTION_FIELD') {
    throw new Error('M4 distribution decision did not retain DISTRIBUTION_FIELD geometry.');
  }

  const initialStatus = String(node.group?.userData.semanticEmbodimentStatus ?? 'MISSING');
  const pendingWasVisible = Boolean(
    node.group?.getObjectByName(SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME)?.visible
  );
  const semanticInput = node.dataInput as SemanticDistributionInput;
  const envelope = await semanticInput.semanticEmbodimentPromise;
  if (!envelope || envelope.result.status !== 'READY') {
    throw new Error(
      `M4 distribution did not become READY (status=${envelope?.result.status ?? 'null'}).`
    );
  }
  await Promise.resolve();
  const readyAt = performance.now();
  await waitFrames(2);
  const renderedAt = performance.now();

  const artifact = node.artifact;
  const group = node.group;
  if (!artifact || !group) throw new Error('M4 ready distribution artifact is missing.');
  const fullEnvelope = semanticInput.semanticEmbodiment;
  if (fullEnvelope !== envelope) {
    throw new Error('M4 node did not adopt the exact resolved semantic envelope.');
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
  if (!decisionId) throw new Error('M4 distribution decision has no stable identity.');
  if (
    !artifactId ||
    artifactMetadata?.datasetFingerprint !== envelope.datasetFingerprint ||
    artifactMetadata?.candidateId !== envelope.candidateId ||
    artifactMetadata?.payloadKind !== envelope.result.payload.kind ||
    artifactMetadata?.provenance?.decisionId !== decisionId ||
    envelope.provenance.decisionId !== decisionId
  ) {
    throw new Error('M4 payload, decision and artifact identity did not agree.');
  }

  const meshes = artifact.nodeMeshes;
  const countKind = (kind: string): number =>
    meshes.filter((mesh) => mesh.userData.distributionElementKind === kind).length;
  const histogramMeshCount = countKind('HISTOGRAM_BIN');
  const ecdfMeshCount = countKind('ECDF_KNOT');
  const quantileMeshCount = countKind('QUANTILE');
  if (
    meshes.length !== envelope.resource.elementCount ||
    meshes.length !== histogramMeshCount + ecdfMeshCount + quantileMeshCount
  ) {
    throw new Error('M4 rendered analytical mesh count does not equal the Rust resource envelope.');
  }

  group.updateMatrixWorld(true);
  const markPositions = meshes.map((mesh) => mesh.getWorldPosition(new THREE.Vector3()));
  const perceptualEvidence = new PerceptualFitnessSampler().sample(
    {
      candidate: MONETA_REPRESENTATION_CANDIDATES.DISTRIBUTION_FIELD,
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
    throw new Error('M4 perceptual evidence is not bound to the rendered distribution identity.');
  }

  return {
    schemaVersion: 1,
    sourceRowCount: input.rowCount,
    measureField: input.measureField,
    candidateId: 'DISTRIBUTION_FIELD',
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
      histogramMeshCount,
      ecdfMeshCount,
      quantileMeshCount,
      semanticIds: meshes.map((mesh) => mesh.name),
      representationKinds: meshes.map((mesh) => String(mesh.userData.representationKind ?? '')),
    },
    timingMs: {
      initialLoad: roundMs(initialLoadMs),
      requestToReady: roundMs(readyAt - requestStartedAt),
      readyToRenderedFrames: roundMs(renderedAt - readyAt),
      total: roundMs(renderedAt - totalStartedAt),
    },
    workerDiagnostics: port.drainDiagnostics(),
    scene: sceneSnapshot(world),
    perceptualBinding: {
      artifactId,
      datasetFingerprint: envelope.datasetFingerprint,
      candidateId: 'DISTRIBUTION_FIELD',
      payloadKind: 'EMPIRICAL_DISTRIBUTION',
      decisionId,
      evidence: perceptualEvidence,
    },
  };
}

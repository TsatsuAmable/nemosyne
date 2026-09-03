import type * as THREE from 'three';
import type { AtlasCore } from '../atlas/AtlasCore.ts';
import type { AnalyticalWorkerDiagnostic } from '../atlas/ports/AnalyticalExecutionPort.ts';
import { Dataset } from '../data/Dataset.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../moneta/representation/SemanticEmbodimentPayload.ts';
import type { RepresentationRequirements } from '../moneta/representation/RepresentationRequirements.ts';
import type { DatasetLoadEntry } from '../vr/coordinators/types.ts';

interface AggregateEvidenceWorld {
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

type SemanticAggregateInput = {
  semanticEmbodiment?: SemanticEmbodimentEnvelopeV1 | null;
  semanticEmbodimentPromise?: Promise<SemanticEmbodimentEnvelopeV1 | null>;
};

export interface AggregateEvidenceScenarioResult {
  schemaVersion: 1;
  sourceRowCount: number;
  groupCount: number;
  candidateId: 'AGGREGATE_VOLUME';
  representationFamily: 'AGGREGATE';
  datasetFingerprint: string;
  decisionId: string;
  envelope: SemanticEmbodimentEnvelopeV1;
  artifact: {
    nodeMeshCount: number;
    semanticIds: string[];
    representationKinds: string[];
  };
  workerDiagnostics: readonly AnalyticalWorkerDiagnostic[];
  semanticDetailExecutionsBeforeOpen: number;
  scene: {
    objectCount: number;
    visibleObjectCount: number;
    renderCallsLastFrame: number;
    trianglesLastFrame: number;
  };
}

function makeAggregateDataset(rowCount: number, groupCount: number): Dataset {
  const rows = new Array<Record<string, unknown>>(rowCount);
  const rowIds = new Array<string>(rowCount);
  for (let index = 0; index < rowCount; index++) {
    rows[index] = {
      group: `group-${index % groupCount}`,
      value: 1 + ((index * 37) % 1000) / 10,
      distractor: (index * 13) % 97,
    };
    rowIds[index] = `p1r-a5-aggregate-${index}`;
  }
  return new Dataset(
    `p1r-a5-aggregate-${rowCount}-${groupCount}`,
    [
      { name: 'group', type: 'CATEGORICAL' },
      { name: 'value', type: 'NUMERIC' },
      { name: 'distractor', type: 'NUMERIC' },
    ],
    rows,
    undefined,
    rowIds,
  );
}

function aggregateRequirements(): RepresentationRequirements {
  return {
    task: 'group-comparison',
    requiredStructures: [{ type: 'group-comparison', importance: 1 }],
    preservationGoals: [{ information: 'aggregate-group-magnitude', priority: 'CRITICAL' }],
    acceptableLoss: {
      allowIdentityLoss: true,
      allowExactMetricLoss: true,
      allowClusterLoss: true,
      maxFrustumExclusionTolerance: 0.7,
    },
    scale: 'LARGE',
    hardwareConstraints: {
      maxVertices: 100_000,
      maxDrawCalls: 120,
      targetFrameRate: 72,
      deviceTier: 'desktop',
      targetFps: 72,
      maxElements: 500_000,
      preferInstanced: true,
    },
    maxFrustumExclusionTolerance: 0.7,
    interactionBudget: 'MEDIUM',
  };
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

function sceneSnapshot(world: AggregateEvidenceWorld): AggregateEvidenceScenarioResult['scene'] {
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

export async function runAggregateEvidenceScenario(
  world: AggregateEvidenceWorld,
  input: { rowCount: number; groupCount: number },
): Promise<AggregateEvidenceScenarioResult> {
  if (!Number.isSafeInteger(input.rowCount) || input.rowCount < 100 || input.rowCount > 100_000) {
    throw new Error('A5 aggregate rowCount must be a safe integer in 100..100000.');
  }
  if (!Number.isSafeInteger(input.groupCount) || input.groupCount < 2 || input.groupCount > 256) {
    throw new Error('A5 aggregate groupCount must be a safe integer in 2..256.');
  }

  const port = world.atlas.executionPort;
  if (!port?.isAsync || !port.drainDiagnostics) {
    throw new Error('A5 aggregate evidence requires the real asynchronous analytical Worker port.');
  }

  port.drainDiagnostics();
  const dataset = makeAggregateDataset(input.rowCount, input.groupCount);
  const entry: DatasetLoadEntry = {
    key: dataset.name,
    name: dataset.name,
    label: `Aggregate evidence · ${input.rowCount} rows / ${input.groupCount} groups`,
    topology: 'TABULAR',
    dataset,
    encodings: { color: 'group', size: 'value' },
  };

  await world.loadDataset(entry);
  const initialPromise = (world.dracoNode?.dataInput as SemanticAggregateInput | undefined)
    ?.semanticEmbodimentPromise;
  if (initialPromise) await initialPromise;
  await Promise.resolve();
  port.drainDiagnostics();

  world._activeRequirements = aggregateRequirements();
  world._doLoadDataset(entry, {
    preserveAnalyticalState: true,
    preserveAuxiliaryPresentation: true,
  });

  const semanticPromise = (world.dracoNode?.dataInput as SemanticAggregateInput | undefined)
    ?.semanticEmbodimentPromise;
  if (!semanticPromise) throw new Error('A5 aggregate semantic request was not started.');
  const envelope = await semanticPromise;
  await waitFrames(2);

  const node = world.dracoNode;
  const decision = node?.representationDecision;
  if (!node || !decision || !envelope || envelope.result.status !== 'READY') {
    throw new Error('A5 aggregate scenario did not reach a READY production semantic embodiment.');
  }
  const decisionId = decision.id;
  if (
    typeof decisionId !== 'string' ||
    decisionId.length === 0 ||
    decision.chosenCandidateId !== 'AGGREGATE_VOLUME' ||
    envelope.candidateId !== 'AGGREGATE_VOLUME' ||
    envelope.representationFamily !== 'AGGREGATE' ||
    envelope.provenance.decisionId !== decisionId ||
    envelope.result.payload.kind !== 'AGGREGATE_VOLUME'
  ) {
    throw new Error('A5 aggregate decision/payload identity mismatch.');
  }

  const diagnostics = port.drainDiagnostics();
  const semanticDetailExecutionsBeforeOpen = diagnostics.filter(
    (entry) => entry.phase === 'execution' && entry.operation === 'semanticDetail',
  ).length;
  const meshes = node.artifact?.nodeMeshes ?? [];
  if (meshes.length === 0) throw new Error('A5 aggregate READY payload produced no semantic meshes.');

  return {
    schemaVersion: 1,
    sourceRowCount: input.rowCount,
    groupCount: envelope.result.payload.data.groups.length,
    candidateId: 'AGGREGATE_VOLUME',
    representationFamily: 'AGGREGATE',
    datasetFingerprint: envelope.datasetFingerprint,
    decisionId,
    envelope,
    artifact: {
      nodeMeshCount: meshes.length,
      semanticIds: meshes.map((mesh) => String(mesh.userData.semanticId ?? mesh.name)),
      representationKinds: meshes.map((mesh) => String(mesh.userData.representationKind ?? '')),
    },
    workerDiagnostics: diagnostics,
    semanticDetailExecutionsBeforeOpen,
    scene: sceneSnapshot(world),
  };
}

import { Dataset } from '../data/Dataset.ts';
import type {
  AnalyticalExecutionPort,
  AnalyticalExecutionRequest,
  AnalyticalExecutionResult,
  AnalyticalWorkerDiagnostic,
} from '../atlas/ports/AnalyticalExecutionPort.ts';
import type { World } from '../vr/World.ts';
import {
  runClusterEvidenceScenario,
  type ClusterEvidenceScenarioResult,
  type ClusterEvidenceShape,
} from './clusterEvidenceDiagnostics.ts';
import {
  runDensityEvidenceScenario,
  type DensityEvidenceScenarioResult,
  type DensityEvidenceShape,
} from './densityEvidenceDiagnostics.ts';
import {
  runDistributionEvidenceScenario,
  type DistributionEvidenceScenarioResult,
} from './distributionEvidenceDiagnostics.ts';

export type ResourceEnvelopeOperation = 'sort' | 'anomaly';
export type ResourceEnvelopeMaterialization = 'auto' | 'compact' | 'full';

export interface ResourceEnvelopeMemorySample {
  jsHeapUsedBytes: number | null;
  jsHeapTotalBytes: number | null;
  mainWasmBytes: number | null;
  mainHostBufferAllocations: number | null;
}

export interface ResourceEnvelopeScenarioResult {
  schemaVersion: 1;
  rowCount: number;
  operation: ResourceEnvelopeOperation;
  requestedMaterialization: ResourceEnvelopeMaterialization;
  expectedWorkerResultKind: 'row-view' | 'dataset';
  executionMode: 'worker';
  datasetVersionBefore: number;
  datasetVersionAfter: number;
  datasetFingerprintBefore: string;
  datasetFingerprintAfter: string;
  inputJsonBytesEstimate: number;
  outputJsonBytesEstimate: number;
  timingMs: {
    loadSync: number;
    loadToRenderedFrames: number;
    operationEndToEnd: number;
    operationToRenderedFrames: number;
    outputSizeEstimate: number;
  };
  memory: {
    beforeLoad: ResourceEnvelopeMemorySample;
    afterLoadSync: ResourceEnvelopeMemorySample;
    afterLoadFrames: ResourceEnvelopeMemorySample;
    afterOperation: ResourceEnvelopeMemorySample;
    afterOperationFrames: ResourceEnvelopeMemorySample;
  };
  workerDiagnostics: readonly AnalyticalWorkerDiagnostic[];
  scene: {
    objectCount: number;
    visibleObjectCount: number;
    renderedNodeMeshCount: number;
    renderCalls: number;
    triangles: number;
  };
}

export interface ResourceEnvelopeDiagnosticHook {
  readonly schemaVersion: 1;
  runScenario(input: {
    rowCount: number;
    operation: ResourceEnvelopeOperation;
    materialization?: ResourceEnvelopeMaterialization;
  }): Promise<ResourceEnvelopeScenarioResult>;
  runDistributionScenario(input: {
    rowCount: number;
    measureField: string;
  }): Promise<DistributionEvidenceScenarioResult>;
  runDensityScenario(input: {
    rowCount: number;
    shape: DensityEvidenceShape;
  }): Promise<DensityEvidenceScenarioResult>;
  runClusterScenario(input: {
    rowCount: number;
    shape: ClusterEvidenceShape;
  }): Promise<ClusterEvidenceScenarioResult>;
}

declare global {
  interface Window {
    __NEMOSYNE_RESOURCE_ENVELOPE__?: ResourceEnvelopeDiagnosticHook;
  }
}

type PerformanceWithMemory = Performance & {
  memory?: {
    usedJSHeapSize?: number;
    totalJSHeapSize?: number;
  };
};

type MutableExecutionPort = {
  execute(req: AnalyticalExecutionRequest): Promise<AnalyticalExecutionResult>;
};

const COLUMNS = [
  { name: 'group', type: 'CATEGORICAL' as const },
  { name: 'value', type: 'NUMERIC' as const },
  { name: 'signal', type: 'NUMERIC' as const },
  { name: 'trend', type: 'NUMERIC' as const },
  { name: 'weight', type: 'NUMERIC' as const },
];

function roundMs(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function deterministicUnit(index: number, salt: number): number {
  // Pure integer mixing rather than Math.random: repeated Q3B/Q3C runs receive
  // the same scientific payload byte-for-byte for a given row count.
  let x = (Math.imul(index + 1, 0x45d9f3b) ^ Math.imul(salt + 1, 0x27d4eb2d)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 0x1_0000_0000;
}

function makeDeterministicDataset(rowCount: number): Dataset {
  const count = Math.max(1, Math.floor(rowCount));
  const rows = new Array<Record<string, unknown>>(count);
  const rowIds = new Array<string>(count);
  for (let i = 0; i < count; i++) {
    const base = deterministicUnit(i, 17);
    const signal = deterministicUnit(i, 31);
    rows[i] = {
      group: `g${i % 16}`,
      value: Math.round((base * 2000 - 1000) * 1000) / 1000,
      signal: Math.round(signal * 100 * 1000) / 1000,
      trend: i % 4096,
      weight: 1 + (i % 23) / 10,
    };
    rowIds[i] = `q3b-row-${i}`;
  }
  return new Dataset(`q3b-tabular-${count}`, COLUMNS, rows, undefined, rowIds);
}

function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function captureMemory(world: World): ResourceEnvelopeMemorySample {
  const browserMemory = (performance as PerformanceWithMemory).memory;
  const runtime = world.analyticalRuntime.runtime;
  let mainWasmBytes: number | null = null;
  let mainHostBufferAllocations: number | null = null;
  try {
    mainWasmBytes = runtime?.memory().buffer.byteLength ?? null;
  } catch {
    mainWasmBytes = null;
  }
  try {
    mainHostBufferAllocations = runtime?.hostBufferAllocationCount() ?? null;
  } catch {
    mainHostBufferAllocations = null;
  }
  return {
    jsHeapUsedBytes:
      typeof browserMemory?.usedJSHeapSize === 'number' ? browserMemory.usedJSHeapSize : null,
    jsHeapTotalBytes:
      typeof browserMemory?.totalJSHeapSize === 'number' ? browserMemory.totalJSHeapSize : null,
    mainWasmBytes,
    mainHostBufferAllocations,
  };
}

function waitFrames(count = 2): Promise<void> {
  return new Promise((resolve) => {
    const next = (remaining: number) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => next(remaining - 1));
    };
    next(count);
  });
}

function sceneSnapshot(world: World): ResourceEnvelopeScenarioResult['scene'] {
  let objectCount = 0;
  let visibleObjectCount = 0;
  world.engine.scene.traverse((object) => {
    objectCount += 1;
    if (object.visible) visibleObjectCount += 1;
  });
  const render = world.engine.renderer.info.render;
  return {
    objectCount,
    visibleObjectCount,
    renderedNodeMeshCount: world.dracoNode?.artifact?.nodeMeshes?.length ?? 0,
    renderCalls: render.calls,
    triangles: render.triangles,
  };
}

function expectedResultKind(
  operation: ResourceEnvelopeOperation,
  materialization: ResourceEnvelopeMaterialization
): 'row-view' | 'dataset' {
  if (materialization === 'full') return 'dataset';
  if (operation === 'sort') return 'row-view';
  return 'dataset';
}

/**
 * Q3C-only evidence shim. Atlas remains the production orchestrator and still
 * owns Worker registration, exact-fingerprint fencing, result verification,
 * durable dataset adoption, history/provenance and rendering. This wrapper
 * changes only the materialisation hint on the single analytical Worker request
 * so the same Rust operation can be measured as compact versus full output.
 */
async function withMaterializationOverride<T>(
  port: AnalyticalExecutionPort,
  materialization: ResourceEnvelopeMaterialization,
  run: () => Promise<T>
): Promise<T> {
  if (materialization === 'auto') return run();

  const mutablePort = port as unknown as MutableExecutionPort;
  const originalExecute = mutablePort.execute;
  mutablePort.execute = (request) => {
    if (request.operation !== 'operation') {
      return originalExecute.call(port, request);
    }
    const params = { ...request.params };
    if (materialization === 'compact') {
      params.resultMode = 'row-view-if-lossless';
    } else {
      delete params.resultMode;
    }
    return originalExecute.call(port, { ...request, params });
  };

  try {
    return await run();
  } finally {
    mutablePort.execute = originalExecute;
  }
}

async function runScenario(
  world: World,
  input: {
    rowCount: number;
    operation: ResourceEnvelopeOperation;
    materialization?: ResourceEnvelopeMaterialization;
  }
): Promise<ResourceEnvelopeScenarioResult> {
  if (!Number.isSafeInteger(input.rowCount) || input.rowCount <= 0 || input.rowCount > 100_000) {
    throw new Error('Q3B/Q3C rowCount must be a positive safe integer <= 100000.');
  }
  if (input.operation !== 'sort' && input.operation !== 'anomaly') {
    throw new Error(`Unsupported Q3B/Q3C operation: ${String(input.operation)}`);
  }
  const requestedMaterialization = input.materialization ?? 'auto';
  if (!['auto', 'compact', 'full'].includes(requestedMaterialization)) {
    throw new Error(`Unsupported Q3C materialization: ${String(requestedMaterialization)}`);
  }

  const port = world.atlas.executionPort;
  if (!port?.isAsync || !port.drainDiagnostics) {
    throw new Error('Q3B/Q3C requires the real asynchronous analytical Worker port.');
  }

  // Clear only stale samples from the preceding scenario. Do not drain again
  // between load and operation: registration may complete during either phase,
  // and the evidence must retain that acknowledgement alongside execution.
  port.drainDiagnostics();
  const dataset = makeDeterministicDataset(input.rowCount);
  const inputJsonBytesEstimate = jsonBytes(dataset.toJSON());
  const beforeLoad = captureMemory(world);

  const loadStartedAt = performance.now();
  world.loadDataset({
    key: 'q3b-resource-envelope',
    name: dataset.name,
    label: `Q3 resource envelope ${input.rowCount} rows`,
    topology: 'TABULAR',
    dataset,
    encodings: { color: 'group', size: 'value' },
  });
  const loadFinishedAt = performance.now();
  const afterLoadSync = captureMemory(world);
  await waitFrames(2);
  const loadRenderedAt = performance.now();
  const afterLoadFrames = captureMemory(world);

  const datasetVersionBefore = world.atlas.datasetVersion;
  const datasetFingerprintBefore = world.atlas.datasetFingerprint ?? '';
  if (!datasetFingerprintBefore) {
    throw new Error('Q3B/Q3C source dataset has no authoritative fingerprint.');
  }

  const operationStartedAt = performance.now();
  await withMaterializationOverride(port, requestedMaterialization, () =>
    world.dataOperationController.applyAsync(input.operation)
  );
  const operationFinishedAt = performance.now();
  const afterOperation = captureMemory(world);
  const workerDiagnostics = port.drainDiagnostics();
  const datasetVersionAfter = world.atlas.datasetVersion;
  const datasetFingerprintAfter = world.atlas.datasetFingerprint ?? '';
  if (datasetVersionAfter !== datasetVersionBefore + 1) {
    throw new Error(
      `Q3B/Q3C ${input.operation} did not commit exactly one authoritative dataset version ` +
        `(before=${datasetVersionBefore}, after=${datasetVersionAfter}).`
    );
  }
  if (!datasetFingerprintAfter) {
    throw new Error('Q3B/Q3C result dataset has no authoritative fingerprint.');
  }

  await waitFrames(2);
  const operationRenderedAt = performance.now();
  const afterOperationFrames = captureMemory(world);

  const outputEstimateStartedAt = performance.now();
  const outputJsonBytesEstimate = jsonBytes(world.atlas.dataset.toJSON());
  const outputEstimateFinishedAt = performance.now();

  const expectedWorkerResultKind = expectedResultKind(input.operation, requestedMaterialization);
  const executionDiagnostic = [...workerDiagnostics]
    .reverse()
    .find((sample) => sample.phase === 'execution' && sample.operation === 'operation');
  if (!executionDiagnostic) {
    throw new Error(
      'Q3B/Q3C Worker execution diagnostic was not emitted by the instrumented build.'
    );
  }
  if (executionDiagnostic.resultKind !== expectedWorkerResultKind) {
    throw new Error(
      `Q3B/Q3C expected ${expectedWorkerResultKind} Worker result for ${input.operation} ` +
        `(${requestedMaterialization}), received ${executionDiagnostic.resultKind ?? 'none'}.`
    );
  }

  return {
    schemaVersion: 1,
    rowCount: input.rowCount,
    operation: input.operation,
    requestedMaterialization,
    expectedWorkerResultKind,
    executionMode: 'worker',
    datasetVersionBefore,
    datasetVersionAfter,
    datasetFingerprintBefore,
    datasetFingerprintAfter,
    inputJsonBytesEstimate,
    outputJsonBytesEstimate,
    timingMs: {
      loadSync: roundMs(loadFinishedAt - loadStartedAt),
      loadToRenderedFrames: roundMs(loadRenderedAt - loadStartedAt),
      operationEndToEnd: roundMs(operationFinishedAt - operationStartedAt),
      operationToRenderedFrames: roundMs(operationRenderedAt - operationStartedAt),
      outputSizeEstimate: roundMs(outputEstimateFinishedAt - outputEstimateStartedAt),
    },
    memory: {
      beforeLoad,
      afterLoadSync,
      afterLoadFrames,
      afterOperation,
      afterOperationFrames,
    },
    workerDiagnostics,
    scene: sceneSnapshot(world),
  };
}

/**
 * Install a synthetic-data-only resource-envelope driver in explicitly flagged
 * evidence builds. The driver invokes the real World -> Atlas -> module Worker
 * -> Rust/WASM -> durable state -> visual-transform path; it does not implement
 * analytical logic or expose user dataset contents.
 */
export function installResourceEnvelopeDiagnosticHook(world: World): () => void {
  const hook: ResourceEnvelopeDiagnosticHook = {
    schemaVersion: 1,
    runScenario: (input) => runScenario(world, input),
    runDistributionScenario: (input) => runDistributionEvidenceScenario(world, input),
    runDensityScenario: (input) => runDensityEvidenceScenario(world, input),
    runClusterScenario: (input) => runClusterEvidenceScenario(world, input),
  };
  window.__NEMOSYNE_RESOURCE_ENVELOPE__ = hook;
  return () => {
    if (window.__NEMOSYNE_RESOURCE_ENVELOPE__ === hook) {
      delete window.__NEMOSYNE_RESOURCE_ENVELOPE__;
    }
  };
}

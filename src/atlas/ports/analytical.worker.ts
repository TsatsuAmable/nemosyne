import type {
  AnalyticalDatasetRegistration,
  AnalyticalExecutionFence,
  AnalyticalExecutionRequest,
  AnalyticalExecutionResult,
  AnalyticalWorkerDiagnostic,
} from './AnalyticalExecutionPort.ts';
import * as bridge from '../../wasm/RuntimeBridge.ts';
import {
  buildAggregateSemanticEmbodimentV1,
  buildClusterSemanticEmbodimentV1,
  buildDensitySemanticEmbodimentV1,
  buildDistributionSemanticEmbodimentV1,
  buildGraphSemanticEmbodimentV1,
  querySemanticDetailV1,
} from '../../wasm/runtime/SemanticEmbodimentBridge.ts';
import type { SemanticDetailRequestV1 } from '../../moneta/representation/SemanticDrillDown.ts';
import type { ClusterEmbodimentRequestV1 } from '../../moneta/representation/ClusterEmbodimentPayload.ts';
import type { GraphEmbodimentRequestV1 } from '../../moneta/representation/GraphEmbodimentPayload.ts';
import type {
  AggregateEmbodimentRequestV1,
  DensityEmbodimentRequestV1,
  DistributionEmbodimentRequestV1,
} from '../../moneta/representation/SemanticEmbodimentPayload.ts';
import type { DatasetJSON, OperationSpec } from '../../data/types.ts';

const handleMap = new Map<string, number>();
const fence: { generation?: number; datasetVersion?: number; datasetFingerprint?: string } = {};
const resourceDiagnosticsEnabled = import.meta.env.VITE_NEMOSYNE_Q3B_RESOURCE_PROBE === '1';

function roundMs(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function wasmBytes(): number | null {
  if (!resourceDiagnosticsEnabled) return null;
  try {
    return bridge.memory().buffer.byteLength;
  } catch {
    return null;
  }
}

function hostBufferAllocations(): number | null {
  if (!resourceDiagnosticsEnabled) return null;
  try {
    return bridge.hostBufferAllocationCount();
  } catch {
    return null;
  }
}

function registrationShape(registration: AnalyticalDatasetRegistration): {
  rowCount?: number;
  columnCount?: number;
} {
  if (registration.payload.type !== 'json') return {};
  const json = registration.payload.data as DatasetJSON;
  return {
    rowCount: Array.isArray(json?.rows) ? json.rows.length : undefined,
    columnCount: Array.isArray(json?.columns) ? json.columns.length : undefined,
  };
}

function destroyHandle(handle: number): void {
  try {
    bridge.destroyDataset(handle);
  } catch {
    // best-effort worker-local cleanup
  }
}

function clearRegisteredHandles(retainFingerprint?: string): void {
  for (const [fingerprint, handle] of handleMap.entries()) {
    if (retainFingerprint && fingerprint === retainFingerprint) continue;
    destroyHandle(handle);
    handleMap.delete(fingerprint);
  }
}

function replaceRegisteredHandle(fingerprint: string, handle: number): void {
  for (const existing of handleMap.values()) {
    if (existing !== handle) destroyHandle(existing);
  }
  handleMap.clear();
  handleMap.set(fingerprint, handle);
}

function isSuperseded(
  generation: number,
  datasetVersion: number,
  datasetFingerprint: string
): boolean {
  return (
    (fence.generation !== undefined && generation < fence.generation) ||
    (fence.datasetVersion !== undefined && datasetVersion < fence.datasetVersion) ||
    (fence.datasetFingerprint !== undefined && datasetFingerprint !== fence.datasetFingerprint)
  );
}

function requireRegisteredHandle(
  req: AnalyticalExecutionRequest,
  handle: number | undefined
): number {
  if (!handle || handle === 0) {
    throw new Error(
      `Worker dataset ${req.dataset.fingerprint} is not registered; ` +
        'register the dataset in this worker generation before analytical execution.'
    );
  }
  return handle;
}

async function ensureBridgeReady(): Promise<void> {
  if (!bridge.isReady()) await bridge.initRuntime();
}

function loadRegistrationPayload(registration: AnalyticalDatasetRegistration): number {
  if (registration.payload.type === 'typed') {
    return bridge.loadTypedColumns(
      registration.payload.data as ArrayBuffer | Uint8Array,
      registration.payload.name
    );
  }
  return bridge.loadDatasetJson(registration.payload.data as DatasetJSON);
}

async function registerDataset(registration: AnalyticalDatasetRegistration): Promise<void> {
  if (
    isSuperseded(
      registration.generation,
      registration.dataset.version,
      registration.dataset.fingerprint
    )
  ) {
    throw new Error(
      `Worker dataset registration superseded for ${registration.dataset.fingerprint}`
    );
  }

  await ensureBridgeReady();
  const existing = handleMap.get(registration.dataset.fingerprint);
  if (existing && existing !== 0) {
    const fingerprint = bridge.datasetFingerprint(existing);
    if (fingerprint !== registration.dataset.fingerprint) {
      clearRegisteredHandles();
      throw new Error(
        `Worker cached dataset fingerprint mismatch: expected ${registration.dataset.fingerprint}, ` +
          `received ${fingerprint ?? 'null'}`
      );
    }
    return;
  }

  const handle = loadRegistrationPayload(registration);
  if (!handle || handle === 0) {
    throw new Error(`Worker kernel rejected dataset ${registration.dataset.fingerprint}`);
  }

  const registeredFingerprint = bridge.datasetFingerprint(handle);
  if (registeredFingerprint !== registration.dataset.fingerprint) {
    destroyHandle(handle);
    throw new Error(
      `Worker dataset fingerprint mismatch: expected ${registration.dataset.fingerprint}, ` +
        `received ${registeredFingerprint ?? 'null'}`
    );
  }

  replaceRegisteredHandle(registration.dataset.fingerprint, handle);
}

self.onmessage = async (ev: MessageEvent) => {
  const data = ev.data as {
    type: 'EXECUTE' | 'SUPERSEDE' | 'REGISTER';
    request?: AnalyticalExecutionRequest;
    registration?: AnalyticalDatasetRegistration;
    fence?: AnalyticalExecutionFence;
  };

  if (!data) return;

  if (data.type === 'SUPERSEDE' && data.fence) {
    const generationAdvanced =
      data.fence.generation !== undefined &&
      (fence.generation === undefined || data.fence.generation > fence.generation);
    const datasetAdvanced =
      data.fence.datasetVersion !== undefined &&
      (fence.datasetVersion === undefined || data.fence.datasetVersion > fence.datasetVersion);
    const fingerprintChanged =
      data.fence.datasetFingerprint !== undefined &&
      data.fence.datasetFingerprint !== fence.datasetFingerprint;

    if (data.fence.generation !== undefined) fence.generation = data.fence.generation;
    if (data.fence.datasetVersion !== undefined) fence.datasetVersion = data.fence.datasetVersion;
    if (data.fence.datasetFingerprint !== undefined) {
      fence.datasetFingerprint = data.fence.datasetFingerprint;
    }

    if (generationAdvanced) {
      clearRegisteredHandles();
    } else if (datasetAdvanced || fingerprintChanged) {
      clearRegisteredHandles(data.fence.datasetFingerprint);
    }
    return;
  }

  if (data.type === 'REGISTER' && data.registration) {
    const registration = data.registration;
    const startedAt = performance.now();
    const beforeWasm = wasmBytes();
    const beforeHostBuffers = hostBufferAllocations();
    let bridgeReadyMs = 0;
    try {
      await registerDataset(registration);
      bridgeReadyMs = performance.now() - startedAt;
      const afterWasm = wasmBytes();
      const diagnostic: AnalyticalWorkerDiagnostic | undefined = resourceDiagnosticsEnabled
        ? {
            schemaVersion: 1,
            phase: 'registration',
            id: registration.registrationId,
            ...registrationShape(registration),
            timingMs: {
              total: roundMs(performance.now() - startedAt),
              bridgeReady: roundMs(bridgeReadyMs),
            },
            wasmBytes: {
              before: beforeWasm,
              afterKernel: afterWasm,
              afterMaterialize: afterWasm,
            },
            hostBufferAllocations: {
              before: beforeHostBuffers,
              after: hostBufferAllocations(),
            },
          }
        : undefined;
      self.postMessage({
        type: 'REGISTERED',
        registrationId: registration.registrationId,
        generation: registration.generation,
        datasetVersion: registration.dataset.version,
        datasetFingerprint: registration.dataset.fingerprint,
        ...(diagnostic ? { diagnostic } : {}),
      });
    } catch (err: unknown) {
      const afterWasm = wasmBytes();
      const diagnostic: AnalyticalWorkerDiagnostic | undefined = resourceDiagnosticsEnabled
        ? {
            schemaVersion: 1,
            phase: 'registration',
            id: registration.registrationId,
            ...registrationShape(registration),
            timingMs: { total: roundMs(performance.now() - startedAt) },
            wasmBytes: {
              before: beforeWasm,
              afterKernel: afterWasm,
              afterMaterialize: afterWasm,
            },
            hostBufferAllocations: {
              before: beforeHostBuffers,
              after: hostBufferAllocations(),
            },
          }
        : undefined;
      self.postMessage({
        type: 'REGISTERED',
        registrationId: registration.registrationId,
        generation: registration.generation,
        datasetVersion: registration.dataset.version,
        datasetFingerprint: registration.dataset.fingerprint,
        error: err instanceof Error ? err.message : String(err),
        ...(diagnostic ? { diagnostic } : {}),
      });
    }
    return;
  }

  if (data.type === 'EXECUTE' && data.request) {
    const req = data.request;

    if (isSuperseded(req.generation, req.dataset.version, req.dataset.fingerprint)) {
      const supersededResult: AnalyticalExecutionResult = {
        requestId: req.requestId,
        generation: req.generation,
        datasetVersion: req.dataset.version,
        datasetFingerprint: req.dataset.fingerprint,
        value: null,
      };
      self.postMessage({ type: 'RESULT', result: supersededResult });
      return;
    }

    const startedAt = performance.now();
    const beforeWasm = wasmBytes();
    const beforeHostBuffers = hostBufferAllocations();
    let bridgeReadyMs = 0;
    let kernelMs = 0;
    let materializeMs = 0;
    let afterKernelWasm = beforeWasm;
    let afterMaterializeWasm = beforeWasm;
    let resultKind: AnalyticalWorkerDiagnostic['resultKind'] = 'none';
    let resultRowCount: number | undefined;
    let resultColumnCount: number | undefined;
    let operationName: string | undefined;

    const buildDiagnostic = (): AnalyticalWorkerDiagnostic | undefined =>
      resourceDiagnosticsEnabled
        ? {
            schemaVersion: 1,
            phase: 'execution',
            id: req.requestId,
            operation: req.operation,
            ...(operationName ? { operationName } : {}),
            resultKind,
            ...(resultRowCount !== undefined ? { rowCount: resultRowCount } : {}),
            ...(resultColumnCount !== undefined ? { columnCount: resultColumnCount } : {}),
            timingMs: {
              total: roundMs(performance.now() - startedAt),
              bridgeReady: roundMs(bridgeReadyMs),
              kernel: roundMs(kernelMs),
              materialize: roundMs(materializeMs),
            },
            wasmBytes: {
              before: beforeWasm,
              afterKernel: afterKernelWasm,
              afterMaterialize: afterMaterializeWasm,
            },
            hostBufferAllocations: {
              before: beforeHostBuffers,
              after: hostBufferAllocations(),
            },
          }
        : undefined;

    try {
      const bridgeStartedAt = performance.now();
      await ensureBridgeReady();
      bridgeReadyMs = performance.now() - bridgeStartedAt;

      let handle = handleMap.get(req.dataset.fingerprint);
      if (handle === undefined && req.datasetPayload) {
        const compatibilityRegistration: AnalyticalDatasetRegistration = {
          registrationId: `compat-${req.requestId}`,
          dataset: req.dataset,
          generation: req.generation,
          payload: req.datasetPayload,
        };
        await registerDataset(compatibilityRegistration);
        handle = handleMap.get(req.dataset.fingerprint);
      }

      const registeredHandle = requireRegisteredHandle(req, handle);
      let value: unknown = null;

      switch (req.operation) {
        case 'tda.persistence': {
          const kernelStartedAt = performance.now();
          value = bridge.computePersistenceIntervals(registeredHandle, req.params);
          kernelMs = performance.now() - kernelStartedAt;
          resultKind = 'scalar';
          break;
        }
        case 'tda.mapper': {
          const kernelStartedAt = performance.now();
          value = bridge.computeMapperGraph(registeredHandle, req.params);
          kernelMs = performance.now() - kernelStartedAt;
          resultKind = 'scalar';
          break;
        }
        case 'tda.betti0': {
          const kernelStartedAt = performance.now();
          value = bridge.computeBetti0Curve(registeredHandle, req.params);
          kernelMs = performance.now() - kernelStartedAt;
          resultKind = 'scalar';
          break;
        }
        case 'statistics': {
          const kernelStartedAt = performance.now();
          value = bridge.statistics(registeredHandle);
          kernelMs = performance.now() - kernelStartedAt;
          resultKind = 'scalar';
          break;
        }
        case 'spectralFacts': {
          const kernelStartedAt = performance.now();
          value = bridge.computeSpectralFacts(
            registeredHandle,
            req.params.timeColumn as string | undefined,
            req.params.valueColumn as string | undefined
          );
          kernelMs = performance.now() - kernelStartedAt;
          resultKind = 'scalar';
          break;
        }
        case 'semanticEmbodiment': {
          operationName = String(req.params.candidateId ?? 'UNKNOWN');
          const kernelStartedAt = performance.now();
          if (req.params.candidateId === 'AGGREGATE_VOLUME') {
            value = buildAggregateSemanticEmbodimentV1(
              registeredHandle,
              req.params as unknown as AggregateEmbodimentRequestV1
            );
          } else if (req.params.candidateId === 'DISTRIBUTION_FIELD') {
            value = buildDistributionSemanticEmbodimentV1(
              registeredHandle,
              req.params as unknown as DistributionEmbodimentRequestV1
            );
          } else if (req.params.candidateId === 'DENSITY_FIELD') {
            value = buildDensitySemanticEmbodimentV1(
              registeredHandle,
              req.params as unknown as DensityEmbodimentRequestV1
            );
          } else if (req.params.candidateId === 'CLUSTER_REGIONS') {
            value = buildClusterSemanticEmbodimentV1(
              registeredHandle,
              req.params as unknown as ClusterEmbodimentRequestV1
            );
          } else if (req.params.candidateId === 'RELATIONSHIP_GRAPH') {
            value = buildGraphSemanticEmbodimentV1(
              registeredHandle,
              req.params as unknown as GraphEmbodimentRequestV1
            );
          } else {
            throw new Error(`Unsupported semantic embodiment candidate: ${operationName}`);
          }
          kernelMs = performance.now() - kernelStartedAt;
          if (!value) {
            throw new Error(
              `Rust ${operationName} semantic embodiment builder returned no envelope`
            );
          }
          resultKind = 'scalar';
          break;
        }
        case 'semanticDetail': {
          const kernelStartedAt = performance.now();
          value = querySemanticDetailV1(
            registeredHandle,
            req.params.request as SemanticDetailRequestV1,
            req.params.embodimentRequest,
            req.generation
          );
          kernelMs = performance.now() - kernelStartedAt;
          if (!value) {
            throw new Error('Rust semantic detail query returned no envelope');
          }
          resultKind = 'scalar';
          break;
        }
        case 'operation': {
          if (!req.params.operation) {
            throw new Error('Worker operation request is missing params.operation');
          }
          const operation = req.params.operation as OperationSpec;
          operationName = operation.op;
          const kernelStartedAt = performance.now();
          const outHandle = bridge.runOperation(registeredHandle, operation);
          kernelMs = performance.now() - kernelStartedAt;
          afterKernelWasm = wasmBytes();
          if (outHandle === 0) {
            throw new Error('Worker kernel operation returned an invalid output handle');
          }

          let adopted = false;
          try {
            const outFingerprint = bridge.datasetFingerprint(outHandle);
            if (!outFingerprint) {
              throw new Error(
                'Worker kernel operation produced no authoritative output fingerprint'
              );
            }

            const materializeStartedAt = performance.now();
            const compactRequested = req.params.resultMode === 'row-view-if-lossless';
            const rowPreserving = ['filter', 'sort', 'slice'].includes(operation.op);
            const rowView =
              compactRequested && rowPreserving ? bridge.datasetRowView(outHandle) : null;

            if (
              rowView &&
              !rowView.edgesPresent &&
              rowView.rowIds.length === rowView.rowCount &&
              new Set(rowView.rowIds).size === rowView.rowIds.length
            ) {
              value = { kind: 'row-view', view: rowView, outputFingerprint: outFingerprint };
              resultKind = 'row-view';
              resultRowCount = rowView.rowCount;
              resultColumnCount = rowView.columnCount;
            } else {
              const outJson = bridge.getDatasetJson(outHandle);
              if (!outJson) {
                throw new Error('Worker kernel operation produced no dataset output');
              }
              value = { kind: 'dataset', dataset: outJson, outputFingerprint: outFingerprint };
              resultKind = 'dataset';
              resultRowCount = outJson.rows.length;
              resultColumnCount = outJson.columns.length;
            }
            materializeMs = performance.now() - materializeStartedAt;
            afterMaterializeWasm = wasmBytes();

            replaceRegisteredHandle(outFingerprint, outHandle);
            adopted = true;
          } finally {
            if (!adopted) destroyHandle(outHandle);
          }
          break;
        }
        default:
          throw new Error(`Unsupported analytical worker operation: ${req.operation}`);
      }

      if (afterKernelWasm === beforeWasm) afterKernelWasm = wasmBytes();
      if (afterMaterializeWasm === beforeWasm) afterMaterializeWasm = wasmBytes();

      const provenance = bridge.kernelProvenance ? bridge.kernelProvenance() : null;
      const result: AnalyticalExecutionResult = {
        requestId: req.requestId,
        generation: req.generation,
        datasetVersion: req.dataset.version,
        datasetFingerprint: req.dataset.fingerprint,
        value,
        provenance,
      };
      const diagnostic = buildDiagnostic();
      self.postMessage({ type: 'RESULT', result, ...(diagnostic ? { diagnostic } : {}) });
    } catch (err: unknown) {
      afterKernelWasm = wasmBytes();
      afterMaterializeWasm = afterKernelWasm;
      const diagnostic = buildDiagnostic();
      if (err instanceof bridge.UnsupportedAtScaleError) {
        const refusalResult: AnalyticalExecutionResult = {
          requestId: req.requestId,
          generation: req.generation,
          datasetVersion: req.dataset.version,
          datasetFingerprint: req.dataset.fingerprint,
          value: null,
          refusal: { preflight: err.preflight, provenance: err.provenance },
        };
        self.postMessage({
          type: 'RESULT',
          result: refusalResult,
          ...(diagnostic ? { diagnostic } : {}),
        });
        return;
      }
      const errorResult: AnalyticalExecutionResult = {
        requestId: req.requestId,
        generation: req.generation,
        datasetVersion: req.dataset.version,
        datasetFingerprint: req.dataset.fingerprint,
        value: null,
        error: err instanceof Error ? err.message : String(err),
      };
      self.postMessage({
        type: 'RESULT',
        result: errorResult,
        ...(diagnostic ? { diagnostic } : {}),
      });
    }
  }
};
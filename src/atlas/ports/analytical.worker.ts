import type {
  AnalyticalExecutionRequest,
  AnalyticalExecutionResult,
} from './AnalyticalExecutionPort.ts';
import * as bridge from '../../wasm/RuntimeBridge.ts';
import type { DatasetJSON, OperationSpec } from '../../data/types.ts';

const handleMap = new Map<string, number>();
const fence: { generation?: number; datasetVersion?: number } = {};

function requireRegisteredHandle(req: AnalyticalExecutionRequest, handle: number | undefined): number {
  if (!handle || handle === 0) {
    throw new Error(
      `Worker dataset ${req.dataset.fingerprint} is not registered; ` +
        'the request must include a datasetPayload on first use in this worker generation.'
    );
  }
  return handle;
}

self.onmessage = async (ev: MessageEvent) => {
  const data = ev.data as {
    type: 'EXECUTE' | 'SUPERSEDE';
    request?: AnalyticalExecutionRequest;
    fence?: { generation?: number; datasetVersion?: number };
  };

  if (!data) return;

  if (data.type === 'SUPERSEDE' && data.fence) {
    if (data.fence.generation !== undefined && (fence.generation === undefined || data.fence.generation > fence.generation)) {
      fence.generation = data.fence.generation;
      for (const h of handleMap.values()) {
        try {
          bridge.destroyDataset(h);
        } catch {
          // ignore cleanup failures
        }
      }
      handleMap.clear();
    }
    if (data.fence.datasetVersion !== undefined) fence.datasetVersion = data.fence.datasetVersion;
    return;
  }

  if (data.type === 'EXECUTE' && data.request) {
    const req = data.request;

    if (
      (fence.generation !== undefined && req.generation < fence.generation) ||
      (fence.datasetVersion !== undefined && req.dataset.version < fence.datasetVersion)
    ) {
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

    try {
      if (!bridge.isReady()) {
        await bridge.initRuntime();
      }

      let handle = handleMap.get(req.dataset.fingerprint);
      if (handle === undefined && req.datasetPayload) {
        if (req.datasetPayload.type === 'typed') {
          handle = bridge.loadTypedColumns(
            req.datasetPayload.data as ArrayBuffer | Uint8Array,
            req.datasetPayload.name
          );
        } else if (req.datasetPayload.type === 'json') {
          handle = bridge.loadDatasetJson(req.datasetPayload.data as DatasetJSON);
        }

        if (!handle || handle === 0) {
          throw new Error(`Worker kernel rejected dataset ${req.dataset.fingerprint}`);
        }

        const registeredFingerprint = bridge.datasetFingerprint(handle);
        if (registeredFingerprint !== req.dataset.fingerprint) {
          bridge.destroyDataset(handle);
          throw new Error(
            `Worker dataset fingerprint mismatch: expected ${req.dataset.fingerprint}, ` +
              `received ${registeredFingerprint ?? 'null'}`
          );
        }

        handleMap.set(req.dataset.fingerprint, handle);
      }

      const registeredHandle = requireRegisteredHandle(req, handle);
      let value: unknown = null;

      switch (req.operation) {
        case 'tda.persistence':
          value = bridge.computePersistenceIntervals(registeredHandle, req.params);
          break;
        case 'tda.mapper':
          value = bridge.computeMapperGraph(registeredHandle, req.params);
          break;
        case 'tda.betti0':
          value = bridge.computeBetti0Curve(registeredHandle, req.params);
          break;
        case 'statistics':
          value = bridge.statistics(registeredHandle);
          break;
        case 'spectralFacts':
          value = bridge.computeSpectralFacts(
            registeredHandle,
            req.params.timeColumn as string | undefined,
            req.params.valueColumn as string | undefined
          );
          break;
        case 'operation': {
          if (!req.params.operation) {
            throw new Error('Worker operation request is missing params.operation');
          }
          const outHandle = bridge.runOperation(
            registeredHandle,
            req.params.operation as OperationSpec
          );
          if (outHandle === 0) {
            throw new Error('Worker kernel operation returned an invalid output handle');
          }
          try {
            const outJson = bridge.getDatasetJson(outHandle);
            if (!outJson) {
              throw new Error('Worker kernel operation produced no dataset output');
            }
            const outFingerprint = bridge.datasetFingerprint(outHandle) ?? req.dataset.fingerprint;
            value = {
              dataset: outJson,
              outputFingerprint: outFingerprint,
            };
          } finally {
            bridge.destroyDataset(outHandle);
          }
          break;
        }
        default:
          throw new Error(`Unsupported analytical worker operation: ${req.operation}`);
      }

      const provenance = bridge.kernelProvenance ? bridge.kernelProvenance() : null;

      const result: AnalyticalExecutionResult = {
        requestId: req.requestId,
        generation: req.generation,
        datasetVersion: req.dataset.version,
        datasetFingerprint: req.dataset.fingerprint,
        value,
        provenance,
      };

      self.postMessage({ type: 'RESULT', result });
    } catch (err: unknown) {
      const errorResult: AnalyticalExecutionResult = {
        requestId: req.requestId,
        generation: req.generation,
        datasetVersion: req.dataset.version,
        datasetFingerprint: req.dataset.fingerprint,
        value: null,
        error: err instanceof Error ? err.message : String(err),
      };
      self.postMessage({ type: 'RESULT', result: errorResult });
    }
  }
};

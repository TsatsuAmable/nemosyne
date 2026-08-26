import type { AnalyticalExecutionRequest, AnalyticalExecutionResult } from './AnalyticalExecutionPort.ts';
import * as bridge from '../../wasm/RuntimeBridge.ts';
import type { DatasetJSON, OperationSpec } from '../../data/types.ts';

const handleMap = new Map<string, number>();
const fence: { generation?: number; datasetVersion?: number } = {};

self.onmessage = async (ev: MessageEvent) => {
  const data = ev.data as {
    type: 'EXECUTE' | 'SUPERSEDE';
    request?: AnalyticalExecutionRequest;
    fence?: { generation?: number; datasetVersion?: number };
  };

  if (!data) return;

  if (data.type === 'SUPERSEDE' && data.fence) {
    if (data.fence.generation !== undefined) fence.generation = data.fence.generation;
    if (data.fence.datasetVersion !== undefined) fence.datasetVersion = data.fence.datasetVersion;
    return;
  }

  if (data.type === 'EXECUTE' && data.request) {
    const req = data.request;

    // Check fence
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

      // Manage dataset handle in worker
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
        if (handle && handle !== 0) {
          handleMap.set(req.dataset.fingerprint, handle);
        }
      }

      let value: unknown = null;
      switch (req.operation) {
        case 'tda.persistence':
          if (handle) value = bridge.computePersistenceIntervals(handle, req.params);
          break;
        case 'tda.mapper':
          if (handle) value = bridge.computeMapperGraph(handle, req.params);
          break;
        case 'tda.betti0':
          if (handle) value = bridge.computeBetti0Curve(handle, req.params);
          break;
        case 'statistics':
          if (handle) value = bridge.statistics(handle);
          break;
        case 'spectralFacts':
          if (handle) {
            value = bridge.computeSpectralFacts(
              handle,
              req.params.timeColumn as string | undefined,
              req.params.valueColumn as string | undefined
            );
          }
          break;
        case 'operation':
          if (handle && req.params.operation) {
            const outHandle = bridge.runOperation(handle, req.params.operation as OperationSpec);
            if (outHandle !== 0) {
              const outJson = bridge.getDatasetJson(outHandle);
              bridge.destroyDataset(outHandle);
              value = outJson;
            }
          }
          break;
        default:
          break;
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

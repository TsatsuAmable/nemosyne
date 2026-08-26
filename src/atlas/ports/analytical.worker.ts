import type {
  AnalyticalDatasetRegistration,
  AnalyticalExecutionFence,
  AnalyticalExecutionRequest,
  AnalyticalExecutionResult,
} from './AnalyticalExecutionPort.ts';
import * as bridge from '../../wasm/RuntimeBridge.ts';
import type { DatasetJSON, OperationSpec } from '../../data/types.ts';

const handleMap = new Map<string, number>();
const fence: { generation?: number; datasetVersion?: number; datasetFingerprint?: string } = {};

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
): boolean {
  return (
    (fence.generation !== undefined && generation < fence.generation) ||
    (fence.datasetVersion !== undefined && datasetVersion < fence.datasetVersion)
  );
}

function requireRegisteredHandle(req: AnalyticalExecutionRequest, handle: number | undefined): number {
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
  if (isSuperseded(registration.generation, registration.dataset.version)) {
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

    if (data.fence.generation !== undefined) fence.generation = data.fence.generation;
    if (data.fence.datasetVersion !== undefined) fence.datasetVersion = data.fence.datasetVersion;
    if (data.fence.datasetFingerprint !== undefined) {
      fence.datasetFingerprint = data.fence.datasetFingerprint;
    }

    if (generationAdvanced) {
      clearRegisteredHandles();
    } else if (datasetAdvanced) {
      clearRegisteredHandles(data.fence.datasetFingerprint);
    }
    return;
  }

  if (data.type === 'REGISTER' && data.registration) {
    const registration = data.registration;
    try {
      await registerDataset(registration);
      self.postMessage({
        type: 'REGISTERED',
        registrationId: registration.registrationId,
        generation: registration.generation,
        datasetVersion: registration.dataset.version,
        datasetFingerprint: registration.dataset.fingerprint,
      });
    } catch (err: unknown) {
      self.postMessage({
        type: 'REGISTERED',
        registrationId: registration.registrationId,
        generation: registration.generation,
        datasetVersion: registration.dataset.version,
        datasetFingerprint: registration.dataset.fingerprint,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (data.type === 'EXECUTE' && data.request) {
    const req = data.request;

    if (isSuperseded(req.generation, req.dataset.version)) {
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
      await ensureBridgeReady();

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

          let adopted = false;
          try {
            const outJson = bridge.getDatasetJson(outHandle);
            if (!outJson) {
              throw new Error('Worker kernel operation produced no dataset output');
            }
            const outFingerprint = bridge.datasetFingerprint(outHandle);
            if (!outFingerprint) {
              throw new Error('Worker kernel operation produced no authoritative output fingerprint');
            }
            replaceRegisteredHandle(outFingerprint, outHandle);
            adopted = true;
            value = {
              dataset: outJson,
              outputFingerprint: outFingerprint,
            };
          } finally {
            if (!adopted) destroyHandle(outHandle);
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

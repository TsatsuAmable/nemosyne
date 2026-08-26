import type { AnalyticalKernelPort } from '../adapters/AnalyticalKernelPort.ts';
import type {
  AnalyticalExecutionPort,
  AnalyticalExecutionRequest,
  AnalyticalExecutionResult,
} from './AnalyticalExecutionPort.ts';
import type {
  DatasetJSON,
  OperationSpec,
} from '../../data/types.ts';

export class InlineAnalyticalPort implements AnalyticalExecutionPort {
  private readonly _kernel: AnalyticalKernelPort;
  private _fence: { generation?: number; datasetVersion?: number } = {};
  private _handleMap = new Map<string, number>();

  constructor(kernel: AnalyticalKernelPort) {
    this._kernel = kernel;
  }

  get isAsync(): boolean {
    return false;
  }

  supersede(fence: { generation?: number; datasetVersion?: number }): void {
    if (fence.generation !== undefined) this._fence.generation = fence.generation;
    if (fence.datasetVersion !== undefined) this._fence.datasetVersion = fence.datasetVersion;
  }

  async execute<T>(req: AnalyticalExecutionRequest): Promise<AnalyticalExecutionResult<T>> {
    // Check if request is stale before starting
    if (
      (this._fence.generation !== undefined && req.generation < this._fence.generation) ||
      (this._fence.datasetVersion !== undefined && req.dataset.version < this._fence.datasetVersion)
    ) {
      return {
        requestId: req.requestId,
        generation: req.generation,
        datasetVersion: req.dataset.version,
        datasetFingerprint: req.dataset.fingerprint,
        value: null,
      };
    }

    try {
      // Ensure dataset handle is available
      let handle = req.handle ?? this._handleMap.get(req.dataset.fingerprint);
      if (handle === undefined && req.datasetPayload) {
        if (req.datasetPayload.type === 'typed' && this._kernel.loadTypedColumns) {
          handle = this._kernel.loadTypedColumns(
            req.datasetPayload.data as ArrayBuffer | Uint8Array,
            req.datasetPayload.name
          );
        } else if (req.datasetPayload.type === 'json') {
          handle = this._kernel.loadDatasetJson(req.datasetPayload.data as DatasetJSON);
        }
        if (handle && handle !== 0) {
          this._handleMap.set(req.dataset.fingerprint, handle);
        }
      }

      let value: T | null = null;
      switch (req.operation) {
        case 'tda.persistence':
          if (handle && this._kernel.computePersistenceIntervals) {
            value = this._kernel.computePersistenceIntervals(handle, req.params) as T;
          }
          break;
        case 'tda.mapper':
          if (handle && this._kernel.computeMapperGraph) {
            value = this._kernel.computeMapperGraph(handle, req.params) as T;
          }
          break;
        case 'tda.betti0':
          if (handle && this._kernel.computeBetti0Curve) {
            value = this._kernel.computeBetti0Curve(handle, req.params) as T;
          }
          break;
        case 'statistics':
          if (handle) {
            value = this._kernel.statistics(handle) as T;
          }
          break;
        case 'spectralFacts':
          if (handle && this._kernel.computeSpectralFacts) {
            value = this._kernel.computeSpectralFacts(
              handle,
              req.params.timeColumn as string | undefined,
              req.params.valueColumn as string | undefined
            ) as T;
          }
          break;
        case 'operation':
          if (handle && req.params.operation) {
            const outHandle = this._kernel.runOperation(handle, req.params.operation as OperationSpec);
            if (outHandle !== 0) {
              const outJson = this._kernel.getDatasetJson(outHandle);
              this._kernel.destroyDataset(outHandle);
              value = outJson as T;
            }
          }
          break;
        default:
          break;
      }

      // Check fence again upon completion
      if (
        (this._fence.generation !== undefined && req.generation < this._fence.generation) ||
        (this._fence.datasetVersion !== undefined && req.dataset.version < this._fence.datasetVersion)
      ) {
        return {
          requestId: req.requestId,
          generation: req.generation,
          datasetVersion: req.dataset.version,
          datasetFingerprint: req.dataset.fingerprint,
          value: null,
        };
      }

      const provenance = this._kernel.kernelProvenance ? this._kernel.kernelProvenance() : null;

      return {
        requestId: req.requestId,
        generation: req.generation,
        datasetVersion: req.dataset.version,
        datasetFingerprint: req.dataset.fingerprint,
        value,
        provenance,
      };
    } catch (err: unknown) {
      return {
        requestId: req.requestId,
        generation: req.generation,
        datasetVersion: req.dataset.version,
        datasetFingerprint: req.dataset.fingerprint,
        value: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

import type { AnalyticalKernelPort } from '../adapters/AnalyticalKernelPort.ts';
import type {
  AnalyticalExecutionPort,
  AnalyticalExecutionRequest,
  AnalyticalExecutionResult,
  GovernedEvidenceCaptureRequest,
  GovernedEvidenceCaptureV1,
} from './AnalyticalExecutionPort.ts';
import type {
  DatasetJSON,
  OperationSpec,
} from '../../data/types.ts';
import type { SemanticDetailRequestV1 } from '../../moneta/representation/SemanticDrillDown.ts';
import { querySemanticDetailV1 } from '../../wasm/runtime/SemanticEmbodimentBridge.ts';

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

  private _isStale(generation: number, datasetVersion: number): boolean {
    return (
      (this._fence.generation !== undefined && generation < this._fence.generation) ||
      (this._fence.datasetVersion !== undefined && datasetVersion < this._fence.datasetVersion)
    );
  }

  /**
   * Issue #834: governed-evidence capture reads the RFC 0009 statistics
   * evidence receipt producer from *this port's* injected kernel instance —
   * never from an importable module-global bridge. A kernel that cannot attest
   * the producer, hold the dataset handle, or agree on dataset identity yields
   * null, which refuses governed export instead of degrading to un-governed
   * bytes. Envelope composition stays in the authority layer: this port returns
   * the producer's raw payload and the live identity it was read under.
   */
  async captureGovernedEvidenceReceipt(
    req: GovernedEvidenceCaptureRequest
  ): Promise<GovernedEvidenceCaptureV1 | null> {
    if (this._isStale(req.generation, req.dataset.version)) return null;

    const handle = req.handle ?? this._handleMap.get(req.dataset.fingerprint);
    if (!handle) return null;

    const produceReceiptBundle = this._kernel.statisticsEvidenceReceiptBundle;
    const readGovernedConsumers = this._kernel.statisticsGovernedConsumers;
    const readDatasetFingerprint = this._kernel.datasetFingerprint;
    const readKernelVersion = this._kernel.kernelVersion;
    if (
      typeof produceReceiptBundle !== 'function' ||
      typeof readGovernedConsumers !== 'function' ||
      typeof readDatasetFingerprint !== 'function' ||
      typeof readKernelVersion !== 'function'
    ) {
      return null;
    }

    const datasetFingerprint = readDatasetFingerprint.call(this._kernel, handle);
    const kernelVersion = readKernelVersion.call(this._kernel);
    if (!datasetFingerprint || !kernelVersion) return null;
    // The handle must still hold the identity the caller asked about; a
    // mismatch means this port's kernel state moved under the caller.
    if (datasetFingerprint !== req.dataset.fingerprint) return null;

    const rawBundle = produceReceiptBundle.call(this._kernel, handle);
    if (!rawBundle) return null;

    // RFC 0009 tranche 3 slice 2: the consumer attestation is part of the
    // same read — composition mints the persisted uses from it, so a kernel
    // runtime that cannot attest governed consumers refused the slice, rather
    // than exporting an envelope whose `uses` no kernel path authored.
    const governedConsumers = readGovernedConsumers.call(this._kernel, handle);
    if (!governedConsumers) return null;

    // Re-check after the producer call: a supersession that raced this capture
    // must not be reported as evidence for the current generation.
    if (this._isStale(req.generation, req.dataset.version)) return null;

    return {
      requestId: req.requestId,
      generation: req.generation,
      datasetVersion: req.dataset.version,
      datasetFingerprint,
      kernelVersion,
      rawBundle,
      governedConsumers,
    };
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
        case 'semanticDetail':
          if (handle) {
            value = querySemanticDetailV1(
              handle,
              req.params.request as SemanticDetailRequestV1,
              req.params.embodimentRequest,
              req.generation
            ) as T;
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

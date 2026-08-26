import type { DatasetEvidence } from '../../data/evidence/index.ts';
import type {
  BettiPoint,
  DatasetJSON,
  EncodingMapping,
  Facts,
  OperationSpec,
  PersistenceInterval,
  Provenance,
  SpectralFacts,
  TdaMapperGraph,
  TopologyType,
} from '../../data/types.ts';
import {
  KernelAbiError,
  KernelUnavailableError,
  UnsupportedAtScaleError,
  isKernelFatalError,
} from '../../wasm/RuntimeBridge.ts';
import { fnv1aHex } from '../DatasetSpace.ts';
import { datasetEvidenceFromKernelProfile } from '../MonetaEvidenceAuthority.ts';
import type { AnalyticalKernelPort } from './AnalyticalKernelPort.ts';

export interface ParsedKernelDataset {
  dataset: DatasetJSON;
  topology: TopologyType;
  encodings: Record<string, string>;
}

export interface KernelClusterResult {
  rows: Record<string, unknown>[];
  provenance: Provenance | null;
}

export class RustAnalyticalEvidenceAdapter {
  private _kernel: AnalyticalKernelPort | null;
  private readonly _onKernelFailure:
    ((error: KernelAbiError | KernelUnavailableError) => void) | null;
  /**
   * RF-030: invoked when a kernel-inline TDA resource refusal surfaces through a
   * sync `_call`. A refusal is NOT a kernel failure (the kernel is healthy; it
   * deliberately withheld an over-budget operation), so it must never reach
   * `_onKernelFailure` / `markKernelUnavailable`. The callback durably records
   * the refusal provenance; the typed error is then rethrown so VR/UI can react.
   */
  private readonly _onKernelRefusal: ((error: UnsupportedAtScaleError) => void) | null;

  constructor(
    kernel: AnalyticalKernelPort | null,
    onKernelFailure: ((error: KernelAbiError | KernelUnavailableError) => void) | null,
    onKernelRefusal: ((error: UnsupportedAtScaleError) => void) | null = null
  ) {
    this._kernel = kernel;
    this._onKernelFailure = onKernelFailure;
    this._onKernelRefusal = onKernelRefusal;
  }

  setKernel(kernel: AnalyticalKernelPort | null): void {
    this._kernel = kernel;
  }

  isReady(): boolean {
    return (
      this._kernel != null && (typeof this._kernel.isReady !== 'function' || this._kernel.isReady())
    );
  }

  kernelVersion(): string | null {
    try {
      return this._kernel?.kernelVersion?.() ?? null;
    } catch {
      return null;
    }
  }

  lastProvenance(): Provenance | null {
    try {
      return this._kernel?.kernelProvenance?.() ?? null;
    } catch {
      return null;
    }
  }

  destroyDataset(handle: number): void {
    if (handle !== 0) this._kernel?.destroyDataset(handle);
  }

  loadDataset(dataset: DatasetJSON): number {
    if (!this.isReady()) return 0;
    return this._call('loadDatasetJson', () => this._kernel!.loadDatasetJson(dataset));
  }

  supportsTypedColumnIngest(): boolean {
    return (
      this.isReady() &&
      (typeof this._kernel?.supportsTypedColumnIngest === 'function'
        ? this._kernel.supportsTypedColumnIngest()
        : typeof this._kernel?.loadTypedColumns === 'function')
    );
  }

  loadTypedColumns(payload: ArrayBuffer | Uint8Array, name?: string): number {
    if (!this.isReady()) return 0;
    if (typeof this._kernel?.loadTypedColumns !== 'function') return 0;
    return this._call('loadTypedColumns', () => this._kernel!.loadTypedColumns!(payload, name));
  }

  runOperation(handle: number, operation: OperationSpec, label: string): number {
    return this._call(label, () => this._kernel!.runOperation(handle, operation));
  }

  readDataset(handle: number): DatasetJSON | null {
    return this._call('getDatasetJson', () => this._kernel!.getDatasetJson(handle));
  }

  fingerprint(handle: number): string | null {
    try {
      return this._kernel?.datasetFingerprint?.(handle) ?? null;
    } catch {
      return null;
    }
  }

  outputFingerprint(handle: number, dataset: DatasetJSON): string {
    return this.fingerprint(handle) ?? fnv1aHex(dataset);
  }

  parseDataset(
    bytes: Uint8Array,
    ext: 'csv' | 'json',
    explicitTopology?: string | null
  ): ParsedKernelDataset {
    const kernel = this._kernel!;
    const handle = this._call('parseDataset', () =>
      ext === 'csv' ? kernel.loadCsv(bytes) : kernel.loadJson(bytes)
    );
    if (handle === 0) throw new Error('Kernel parser rejected the file');
    try {
      const dataset = this._call('getDatasetJson', () => kernel.getDatasetJson(handle));
      if (!dataset) throw new Error('Kernel parser produced no dataset');
      const topology =
        (explicitTopology as TopologyType | null) ??
        (this._call('inferTopology', () => kernel.inferTopology(handle)) as TopologyType | null) ??
        ('TABULAR' as TopologyType);
      const inferred = this._call('inferEncodings', () =>
        kernel.inferEncodings(handle, topology as string)
      );
      return {
        dataset,
        topology,
        encodings: (inferred ?? {}) as unknown as Record<string, string>,
      };
    } finally {
      kernel.destroyDataset(handle);
    }
  }

  loadSample(key: string): DatasetJSON | null {
    if (!this.isReady() || !key) return null;
    const kernel = this._kernel!;
    const handle = this._call('loadSample', () => kernel.loadSample(key));
    if (handle === 0) return null;
    try {
      return this._call('getDatasetJson', () => kernel.getDatasetJson(handle));
    } finally {
      kernel.destroyDataset(handle);
    }
  }

  /**
   * Handle-native TDA entry points.
   *
   * Atlas owns the durable current dataset handle. These methods deliberately
   * consume that capability directly so callers can avoid Dataset.toJSON() ->
   * loadDatasetJson() rematerialisation before an analytical operation.
   */
  computePersistenceIntervalsForHandle(
    handle: number,
    params: Record<string, unknown>
  ): PersistenceInterval[] | null {
    return this._withHandle(
      handle,
      'computePersistenceIntervals',
      (kernel, currentHandle) => kernel.computePersistenceIntervals?.(currentHandle, params) ?? null
    );
  }

  computeMapperGraphForHandle(
    handle: number,
    params: Record<string, unknown>
  ): TdaMapperGraph | null {
    return this._withHandle(
      handle,
      'computeMapperGraph',
      (kernel, currentHandle) => kernel.computeMapperGraph?.(currentHandle, params) ?? null
    );
  }

  computeBetti0CurveForHandle(
    handle: number,
    params: Record<string, unknown>
  ): BettiPoint[] | null {
    return this._withHandle(
      handle,
      'computeBetti0Curve',
      (kernel, currentHandle) => kernel.computeBetti0Curve?.(currentHandle, params) ?? null
    );
  }

  /**
   * Transitional DatasetJSON TDA wrappers retained for compatibility while
   * Atlas callers move to the durable handle-native seam above.
   */
  computePersistenceIntervals(
    dataset: DatasetJSON,
    params: Record<string, unknown>
  ): PersistenceInterval[] | null {
    return this._withDataset(
      dataset,
      'computePersistenceIntervals',
      (kernel, handle) => kernel.computePersistenceIntervals?.(handle, params) ?? null
    );
  }

  computeMapperGraph(dataset: DatasetJSON, params: Record<string, unknown>): TdaMapperGraph | null {
    return this._withDataset(
      dataset,
      'computeMapperGraph',
      (kernel, handle) => kernel.computeMapperGraph?.(handle, params) ?? null
    );
  }

  computeBetti0Curve(dataset: DatasetJSON, params: Record<string, unknown>): BettiPoint[] | null {
    return this._withDataset(
      dataset,
      'computeBetti0Curve',
      (kernel, handle) => kernel.computeBetti0Curve?.(handle, params) ?? null
    );
  }

  computeSpectralFacts(
    handle: number,
    timeColumn?: string,
    valueColumn?: string
  ): SpectralFacts | null {
    if (!this.isReady() || handle === 0) return null;
    return this._call(
      'computeSpectralFacts',
      () => this._kernel!.computeSpectralFacts?.(handle, timeColumn, valueColumn) ?? null
    );
  }

  statistics(handle: number): Facts | null {
    if (!this.isReady() || handle === 0) return null;
    try {
      return this._kernel!.statistics(handle);
    } catch (error) {
      this._notifyFailure('statistics', error);
      return null;
    }
  }

  datasetEvidence(handle: number): DatasetEvidence {
    const kernel = this._kernel!;
    if (typeof kernel.computeDatasetStructureProfile !== 'function') {
      throw new Error(
        '[AtlasCore] Rust DatasetStructureProfile ABI unavailable — refusing JS analytical fallback.'
      );
    }
    return datasetEvidenceFromKernelProfile(
      {
        computeDatasetStructureProfile: (currentHandle) =>
          kernel.computeDatasetStructureProfile!(currentHandle),
        datasetFingerprint: kernel.datasetFingerprint
          ? (currentHandle) => kernel.datasetFingerprint!(currentHandle)
          : undefined,
      },
      handle
    );
  }

  inferTopology(handle: number): string | null {
    if (!this.isReady() || handle === 0) return null;
    try {
      return this._kernel!.inferTopology(handle);
    } catch (error) {
      this._notifyFailure('inferTopology', error);
      return null;
    }
  }

  inferEncodings(handle: number, topology?: string): EncodingMapping | null {
    if (!this.isReady() || handle === 0) return null;
    try {
      return this._kernel!.inferEncodings(handle, topology);
    } catch (error) {
      this._notifyFailure('inferEncodings', error);
      return null;
    }
  }

  computeCluster(dataset: DatasetJSON, operation: OperationSpec): KernelClusterResult | null {
    if (!this.isReady()) return null;
    const kernel = this._kernel!;
    const inputHandle = this._call('loadDatasetJson', () => kernel.loadDatasetJson(dataset));
    if (inputHandle === 0) return null;
    let outputHandle = 0;
    try {
      outputHandle = this._call('runOperation', () => kernel.runOperation(inputHandle, operation));
      if (outputHandle === 0) return null;
      const result = this._call('getDatasetJson', () => kernel.getDatasetJson(outputHandle));
      if (!result) return null;
      return { rows: result.rows, provenance: this.lastProvenance() };
    } finally {
      if (outputHandle !== 0) kernel.destroyDataset(outputHandle);
      kernel.destroyDataset(inputHandle);
    }
  }

  fingerprintDataset(dataset: DatasetJSON): string | null {
    if (!this.isReady()) return null;
    const kernel = this._kernel!;
    const handle = this._call('loadDatasetJson', () => kernel.loadDatasetJson(dataset));
    if (handle === 0) return null;
    try {
      return this.fingerprint(handle);
    } finally {
      kernel.destroyDataset(handle);
    }
  }

  private _withHandle<T>(
    handle: number,
    operation: string,
    compute: (kernel: AnalyticalKernelPort, handle: number) => T | null
  ): T | null {
    if (!this.isReady() || handle === 0) return null;
    const result = this._call(operation, () => compute(this._kernel!, handle));
    this.lastProvenance();
    return result;
  }

  private _withDataset<T>(
    dataset: DatasetJSON,
    operation: string,
    compute: (kernel: AnalyticalKernelPort, handle: number) => T | null
  ): T | null {
    if (!this.isReady()) return null;
    const kernel = this._kernel!;
    const handle = this._call('loadDatasetJson', () => kernel.loadDatasetJson(dataset));
    if (handle === 0) return null;
    try {
      return this._withHandle(handle, operation, compute);
    } finally {
      kernel.destroyDataset(handle);
    }
  }

  private _call<T>(operation: string, call: () => T): T {
    try {
      return call();
    } catch (error) {
      // RF-030: a kernel-inline resource refusal is durable provenance, not a
      // kernel failure. Record it (best-effort) and rethrow the typed error
      // unchanged — never degrade it to KernelAbiError or mark the kernel
      // unavailable. This chokepoint covers every sync TDA wrapper.
      if (error instanceof UnsupportedAtScaleError) {
        try {
          this._onKernelRefusal?.(error);
        } catch {
          // Ledger recording must never mask the typed refusal.
        }
        throw error;
      }
      throw this._notifyFailure(operation, error);
    }
  }

  private _notifyFailure(
    operation: string,
    error: unknown
  ): KernelAbiError | KernelUnavailableError {
    const failure =
      error instanceof KernelUnavailableError || isKernelFatalError(error)
        ? error
        : new KernelAbiError(operation, error);
    this._onKernelFailure?.(failure);
    return failure;
  }
}

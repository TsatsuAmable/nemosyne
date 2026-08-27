/**
 * AnalyticalState — manages dataset lifecycle, versions, kernel handles, and DatasetSpace.
 */

import { Dataset } from '../../data/Dataset.ts';
import type { DatasetJSON } from '../../data/types.ts';
import { DatasetSpace, datasetContentHashHex } from '../DatasetSpace.ts';
import type { DatasetSpaceNormalization } from '../DatasetSpace.ts';

function emptyDataset(): Dataset {
  return new Dataset('empty', [], []);
}

export interface KernelCommitOptions {
  handle: number;
  dataset: Dataset;
  fingerprint?: string;
  provenance?: unknown;
  versionBump?: boolean;
}

export class AnalyticalState {
  private _original: Dataset | null = null;
  private _current: Dataset | null = null;
  private _datasetVersion = 0;
  private _currentHandle = 0;
  private _datasetSpace: DatasetSpace | null = null;
  private _datasetSpaceSource: Dataset | null = null;
  private _columnarFingerprint: string | null = null;

  get original(): Dataset { return this._original ?? emptyDataset(); }
  get originalNullable(): Dataset | null { return this._original; }
  get current(): Dataset { return this._current ?? emptyDataset(); }
  get currentNullable(): Dataset | null { return this._current; }
  get datasetVersion(): number { return this._datasetVersion; }
  get currentHandle(): number { return this._currentHandle; }
  get hasDataset(): boolean { return this._current !== null || this._currentHandle !== 0; }
  get isHandleOnly(): boolean { return this._current === null && this._currentHandle !== 0; }

  isCurrentHandleOnly(): boolean {
    return this._current === null && this._currentHandle !== 0;
  }

  private _sourceRef: WeakRef<Dataset> | null = null;

  /**
   * True when `dataset` is the exact instance a caller handed to
   * loadDataset/setCurrentDataset/advanceDataset. WeakRef: identity check
   * only — never retains the caller's copy and never serializes it.
   */
  matchesLoadedSource(dataset: Dataset): boolean {
    return this._sourceRef?.deref() === dataset;
  }

  loadDataset(dataset: Dataset, destroyer?: (handle: number) => void): void {
    this._sourceRef = dataset ? new WeakRef(dataset) : null;
    this._original = dataset?.clone?.() ?? emptyDataset();
    this._current = this._original.clone();
    this._datasetVersion += 1;
    this.invalidateHandle(destroyer);
    this._invalidateDatasetSpace();
  }

  commitKernelResult(options: KernelCommitOptions, destroyer?: (handle: number) => void): void {
    const { handle, dataset, fingerprint, versionBump = true } = options;
    this._sourceRef = null;
    const nextDataset = dataset?.clone?.() ?? emptyDataset();
    if (this._currentHandle !== 0 && this._currentHandle !== handle && destroyer) {
      try { destroyer(this._currentHandle); } catch { /* best-effort cleanup */ }
    }
    this._currentHandle = handle;
    this._current = nextDataset;
    if (versionBump) this._datasetVersion += 1;
    this._invalidateDatasetSpace();
    if (fingerprint) this.getDatasetSpace(() => fingerprint);
  }

  advanceDataset(dataset: Dataset, destroyer?: (handle: number) => void): void {
    this._sourceRef = dataset ? new WeakRef(dataset) : null;
    this._current = dataset?.clone?.() ?? emptyDataset();
    this._datasetVersion += 1;
    this.invalidateHandle(destroyer);
    this._invalidateDatasetSpace();
  }

  setCurrentDataset(dataset: Dataset, destroyer?: (handle: number) => void): void {
    this._sourceRef = dataset ? new WeakRef(dataset) : null;
    const next = dataset?.clone?.() ?? emptyDataset();
    const changed = this._datasetSpaceSource !== next;
    this._current = next;
    this.invalidateHandle(destroyer);
    if (changed) this._invalidateDatasetSpace();
  }

  restore(original: Dataset | null, current: Dataset | null, version: number, destroyer?: (handle: number) => void): void {
    this._sourceRef = null;
    this._original = original;
    this._current = current;
    this._datasetVersion = version;
    this.invalidateHandle(destroyer);
    this._invalidateDatasetSpace();
  }

  getDatasetSpace(
    fingerprintProvider?: () => string | null,
    rangesProvider?: () => Record<string, DatasetSpaceNormalization> | null,
  ): DatasetSpace | null {
    if (!this._current) return null;
    if (this._datasetSpace && this._datasetSpaceSource === this._current) return this._datasetSpace;
    const fingerprint = fingerprintProvider ? fingerprintProvider() : null;
    // A live authority provider was supplied. If it has no usable range
    // evidence, keep normalization unavailable instead of silently falling
    // back to a JavaScript O(N) scan. Genuine provider failures still propagate.
    // Direct/legacy construction without a provider retains the historical
    // row-scan compatibility behavior.
    const ranges = rangesProvider ? rangesProvider() ?? {} : null;
    // Calling the live fingerprint provider may allocate the Rust handle and
    // hydrate first-lineage row IDs onto `_current`. Only treat those IDs as
    // authoritative DatasetSpace datum IDs when the live authority path was
    // actually consulted; direct/legacy DatasetSpace construction keeps the
    // schema-v2 content-occurrence contract.
    const datumIds = fingerprintProvider && fingerprint ? this._current.rowIds ?? null : null;
    this._datasetSpace = new DatasetSpace(this._current, { fingerprint, ranges, datumIds });
    this._datasetSpaceSource = this._current;
    return this._datasetSpace;
  }

  getFingerprint(kernelFingerprintProvider?: () => string | null): string | null {
    if (kernelFingerprintProvider) {
      try {
        const fp = kernelFingerprintProvider();
        if (fp) return fp;
      } catch { /* fall back to canonical browser identity */ }
    }
    if (this._columnarFingerprint) return this._columnarFingerprint;
    // Fingerprint lookup must not instantiate DatasetSpace: doing so used to
    // trigger a clone, per-row datum hashing and numeric range scans simply to
    // answer an identity question. The canonical TS/Rust identity projection is
    // already governed by RF-048 and is the bounded compatibility fallback when
    // no live kernel fingerprint is available.
    return this._current ? datasetContentHashHex(this._current.toJSON()) : null;
  }

  /**
   * Ensure a kernel handle is allocated for the current dataset.
   *
   * Rust defines first-lineage IDs as `<canonical dataset fingerprint>:<row index>`.
   * The browser fallback computes the same scientific SHA-256 identity from the
   * exact JSON passed to Rust, excluding rowIds lineage metadata.
   */
  ensureHandle(loader: (json: DatasetJSON) => number): number {
    if (this._currentHandle !== 0) return this._currentHandle;
    if (!this._current) return 0;
    try {
      const json = this._current.toJSON();
      const needsIdentity = !this._current.rowIds;
      this._currentHandle = loader(json);
      if (this._currentHandle !== 0 && needsIdentity) {
        const prefix = datasetContentHashHex(json);
        this.adoptKernelRowIds(json.rows.map((_, index) => `${prefix}:${index}`));
      }
    } catch {
      this._currentHandle = 0;
    }
    return this._currentHandle;
  }

  adoptKernelRowIds(rowIds: string[]): boolean {
    if (!this._current || !this._current.adoptRowIds(rowIds)) return false;
    if (this._datasetVersion === 1 && this._original && this._original.rowCount === rowIds.length) {
      this._original.adoptRowIds(rowIds);
    }
    // A previously created legacy DatasetSpace cannot remain authoritative once
    // durable kernel lineage becomes available.
    this._invalidateDatasetSpace();
    return true;
  }

  invalidateHandle(destroyer?: (handle: number) => void): void {
    if (this._currentHandle !== 0 && destroyer) {
      try { destroyer(this._currentHandle); } catch { /* best-effort cleanup */ }
    }
    this._currentHandle = 0;
    this._columnarFingerprint = null;
    // Kernel replacement/recovery changes the source of authoritative metadata.
    // Force the next DatasetSpace request to rebind fingerprint/ranges/lineage.
    this._invalidateDatasetSpace();
  }

  adoptHandle(outHandle: number, destroyer?: (handle: number) => void): void {
    if (this._currentHandle !== 0 && this._currentHandle !== outHandle && destroyer) {
      try { destroyer(this._currentHandle); } catch { /* best-effort cleanup */ }
    }
    this._currentHandle = outHandle;
  }

  adoptColumnarHandle(
    handle: number,
    meta?: { fingerprint?: string; name?: string },
    destroyer?: (handle: number) => void
  ): void {
    this._sourceRef = null;
    this._original = null;
    this._current = null;
    if (this._currentHandle !== 0 && this._currentHandle !== handle && destroyer) {
      try { destroyer(this._currentHandle); } catch { /* best-effort cleanup */ }
    }
    this._currentHandle = handle;
    this._columnarFingerprint = meta?.fingerprint ?? null;
    this._datasetVersion += 1;
    this._invalidateDatasetSpace();
  }

  dispose(destroyer?: (handle: number) => void): void {
    this.invalidateHandle(destroyer);
    this._invalidateDatasetSpace();
    this._original = null;
    this._current = null;
  }

  private _invalidateDatasetSpace(): void {
    this._datasetSpace = null;
    this._datasetSpaceSource = null;
  }
}

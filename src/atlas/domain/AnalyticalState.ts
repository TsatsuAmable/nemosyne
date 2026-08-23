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

  get original(): Dataset { return this._original ?? emptyDataset(); }
  get originalNullable(): Dataset | null { return this._original; }
  get current(): Dataset { return this._current ?? emptyDataset(); }
  get currentNullable(): Dataset | null { return this._current; }
  get datasetVersion(): number { return this._datasetVersion; }
  get currentHandle(): number { return this._currentHandle; }
  get hasDataset(): boolean { return this._current !== null; }

  loadDataset(dataset: Dataset, destroyer?: (handle: number) => void): void {
    this._original = dataset?.clone?.() ?? emptyDataset();
    this._current = this._original.clone();
    this._datasetVersion += 1;
    this.invalidateHandle(destroyer);
    this._invalidateDatasetSpace();
  }

  commitKernelResult(options: KernelCommitOptions, destroyer?: (handle: number) => void): void {
    const { handle, dataset, fingerprint, versionBump = true } = options;
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
    this._current = dataset?.clone?.() ?? emptyDataset();
    this._datasetVersion += 1;
    this.invalidateHandle(destroyer);
    this._invalidateDatasetSpace();
  }

  setCurrentDataset(dataset: Dataset, destroyer?: (handle: number) => void): void {
    const next = dataset?.clone?.() ?? emptyDataset();
    const changed = this._datasetSpaceSource !== next;
    this._current = next;
    this.invalidateHandle(destroyer);
    if (changed) this._invalidateDatasetSpace();
  }

  restore(original: Dataset | null, current: Dataset | null, version: number, destroyer?: (handle: number) => void): void {
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
    const ranges = rangesProvider ? rangesProvider() : null;
    this._datasetSpace = new DatasetSpace(this._current, { fingerprint, ranges });
    this._datasetSpaceSource = this._current;
    return this._datasetSpace;
  }

  getFingerprint(kernelFingerprintProvider?: () => string | null): string | null {
    if (kernelFingerprintProvider) {
      try {
        const fp = kernelFingerprintProvider();
        if (fp) return fp;
      } catch { /* fall back to DatasetSpace fingerprint */ }
    }
    return this.getDatasetSpace()?.fingerprint ?? null;
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
    return true;
  }

  invalidateHandle(destroyer?: (handle: number) => void): void {
    if (this._currentHandle !== 0 && destroyer) {
      try { destroyer(this._currentHandle); } catch { /* best-effort cleanup */ }
    }
    this._currentHandle = 0;
  }

  adoptHandle(outHandle: number, destroyer?: (handle: number) => void): void {
    if (this._currentHandle !== 0 && this._currentHandle !== outHandle && destroyer) {
      try { destroyer(this._currentHandle); } catch { /* best-effort cleanup */ }
    }
    this._currentHandle = outHandle;
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
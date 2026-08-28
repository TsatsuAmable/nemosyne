import { Dataset } from './Dataset.ts';
import type { DatasetJSON } from './types.ts';

/**
 * Durable logical identity of one investigation dataset state.
 *
 * `datasetVersion` records investigation ordering; `datasetFingerprint` records
 * canonical scientific content identity. Neither field substitutes for the
 * other because equal content may legitimately occur at multiple versions.
 */
export interface DatasetVersionRef {
  datasetVersion: number;
  datasetFingerprint: string;
}

export interface DatasetVersionDescriptor {
  ref: DatasetVersionRef;
  name: string;
  rowCount: number;
  columnCount: number;
}

function versionKey(ref: DatasetVersionRef): string {
  return `${ref.datasetVersion}:${ref.datasetFingerprint}`;
}

/**
 * Runtime index over dataset snapshots already owned by authoritative durable
 * results. Registration stores the existing DatasetJSON reference and therefore
 * does not clone row data. Materialization always constructs a fresh Dataset so
 * callers cannot mutate the indexed historical snapshot.
 *
 * Logical version identity remains `{datasetVersion, datasetFingerprint}`. A
 * secondary fingerprint index exists only for content reuse after cursor moves:
 * current Atlas semantics can keep the numeric version while undo/seek restores
 * content from an older version. In that case the exact logical ref is new, but
 * the fingerprint still authoritatively identifies the already-indexed content.
 *
 * This is not a scientific or analytical authority. It never computes a missing
 * state, and it contains no Worker generation/handle identity.
 */
export class DatasetVersionStore {
  private readonly _snapshots = new Map<string, DatasetJSON>();
  private readonly _snapshotsByFingerprint = new Map<string, DatasetJSON>();

  register(ref: DatasetVersionRef, snapshot: DatasetJSON): void {
    if (!ref.datasetFingerprint) {
      throw new Error('[DatasetVersionStore] dataset fingerprint is required');
    }
    if (!Number.isSafeInteger(ref.datasetVersion) || ref.datasetVersion < 0) {
      throw new Error('[DatasetVersionStore] dataset version must be a non-negative safe integer');
    }
    this._snapshots.set(versionKey(ref), snapshot);
    // Equal canonical fingerprints are scientifically equal content. Preserve
    // the first indexed snapshot as the reusable content source while keeping
    // every logical version as its own exact-key entry.
    if (!this._snapshotsByFingerprint.has(ref.datasetFingerprint)) {
      this._snapshotsByFingerprint.set(ref.datasetFingerprint, snapshot);
    }
  }

  has(ref: DatasetVersionRef): boolean {
    return this._snapshots.has(versionKey(ref));
  }

  private _resolveSnapshot(ref: DatasetVersionRef): DatasetJSON | null {
    return (
      this._snapshots.get(versionKey(ref)) ??
      this._snapshotsByFingerprint.get(ref.datasetFingerprint) ??
      null
    );
  }

  describe(ref: DatasetVersionRef): DatasetVersionDescriptor | null {
    const snapshot = this._resolveSnapshot(ref);
    if (!snapshot) return null;
    return {
      ref: { ...ref },
      name: snapshot.name,
      rowCount: snapshot.rows.length,
      columnCount: snapshot.columns.length,
    };
  }

  materialize(ref: DatasetVersionRef): Dataset | null {
    const snapshot = this._resolveSnapshot(ref);
    return snapshot ? Dataset.fromJSON(snapshot) : null;
  }

  clear(): void {
    this._snapshots.clear();
    this._snapshotsByFingerprint.clear();
  }
}

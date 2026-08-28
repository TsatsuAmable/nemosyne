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

export interface DatasetRowViewDescriptor {
  name: string;
  columns: DatasetJSON['columns'];
  rowIds: string[];
}

export type DatasetVersionStorageKind = 'borrowed' | 'snapshot' | 'row-view';

type BorrowedEntry = {
  kind: 'borrowed';
  ref: DatasetVersionRef;
  dataset: Dataset;
};

type SnapshotEntry = {
  kind: 'snapshot';
  ref: DatasetVersionRef;
  snapshot: DatasetJSON;
};

type RowViewEntry = {
  kind: 'row-view';
  ref: DatasetVersionRef;
  sourceRef: DatasetVersionRef;
  baseRef: DatasetVersionRef;
  name: string;
  columns: DatasetJSON['columns'];
  rowIds: string[];
};

type DatasetVersionEntry = BorrowedEntry | SnapshotEntry | RowViewEntry;

function versionKey(ref: DatasetVersionRef): string {
  return `${ref.datasetVersion}:${ref.datasetFingerprint}`;
}

function assertRef(ref: DatasetVersionRef): void {
  if (!ref.datasetFingerprint) {
    throw new Error('[DatasetVersionStore] dataset fingerprint is required');
  }
  if (!Number.isSafeInteger(ref.datasetVersion) || ref.datasetVersion < 0) {
    throw new Error('[DatasetVersionStore] dataset version must be a non-negative safe integer');
  }
}

function cloneColumns(columns: DatasetJSON['columns']): DatasetJSON['columns'] {
  return columns.map((column) => ({ name: column.name, type: column.type }));
}

function cloneJson(snapshot: DatasetJSON): DatasetJSON {
  return {
    name: snapshot.name,
    columns: cloneColumns(snapshot.columns),
    rows: snapshot.rows.map((row) => ({ ...row })),
    edges: snapshot.edges?.map((edge) => ({ ...edge })),
    ...(snapshot.rowIds ? { rowIds: snapshot.rowIds.slice() } : {}),
  };
}

function validLineage(rowIds: readonly string[] | undefined, rowCount: number): rowIds is readonly string[] {
  return Boolean(
    rowIds &&
    rowIds.length === rowCount &&
    rowIds.every((id) => typeof id === 'string' && id.length > 0) &&
    new Set(rowIds).size === rowIds.length
  );
}

function columnsEqual(a: DatasetJSON['columns'], b: DatasetJSON['columns']): boolean {
  return a.length === b.length && a.every((column, index) =>
    column.name === b[index]?.name && column.type === b[index]?.type
  );
}

/**
 * Runtime index over dataset states already owned by the investigation.
 *
 * Full/derived results retain a DatasetJSON snapshot. The initial row-backed
 * baseline may be borrowed from AnalyticalState without cloning. A verified
 * RF-035B2 row-preserving result stores only durable output row IDs plus compact
 * metadata and resolves directly against the nearest full/borrowed base.
 *
 * This remains a persistence/orchestration index, not an analytical authority:
 * it never computes membership/order or transforms scientific values.
 */
export class DatasetVersionStore {
  private readonly _entries = new Map<string, DatasetVersionEntry>();
  private readonly _entriesByFingerprint = new Map<string, DatasetVersionEntry>();

  register(ref: DatasetVersionRef, snapshot: DatasetJSON): void {
    assertRef(ref);
    this._setEntry({ kind: 'snapshot', ref: { ...ref }, snapshot });
  }

  registerBorrowed(ref: DatasetVersionRef, dataset: Dataset): void {
    assertRef(ref);
    this._setEntry({ kind: 'borrowed', ref: { ...ref }, dataset });
  }

  registerRowView(
    ref: DatasetVersionRef,
    sourceRef: DatasetVersionRef,
    view: DatasetRowViewDescriptor,
  ): void {
    assertRef(ref);
    assertRef(sourceRef);
    const source = this._resolveEntry(sourceRef);
    if (!source) {
      throw new Error('[DatasetVersionStore] verified row-view source version is unavailable');
    }
    const sourceDescriptor = this._describeEntry(source, sourceRef);
    const sourceRowIds = this._rowIdsForEntry(source);
    if (!validLineage(sourceRowIds, sourceDescriptor.rowCount)) {
      throw new Error('[DatasetVersionStore] verified row-view source has no valid durable row lineage');
    }
    if (!validLineage(view.rowIds, view.rowIds.length)) {
      throw new Error('[DatasetVersionStore] verified row-view output row IDs must be unique and non-empty');
    }
    const allowed = new Set(sourceRowIds);
    if (view.rowIds.some((id) => !allowed.has(id))) {
      throw new Error('[DatasetVersionStore] verified row-view references a row outside its source lineage');
    }
    const sourceColumns = this._columnsForEntry(source);
    if (!columnsEqual(sourceColumns, view.columns)) {
      throw new Error('[DatasetVersionStore] verified row-view schema differs from its source version');
    }
    const baseRef = source.kind === 'row-view' ? source.baseRef : source.ref;
    this._setEntry({
      kind: 'row-view',
      ref: { ...ref },
      sourceRef: { ...sourceRef },
      baseRef: { ...baseRef },
      name: view.name,
      columns: cloneColumns(view.columns),
      rowIds: view.rowIds.slice(),
    });
  }

  storageKind(ref: DatasetVersionRef): DatasetVersionStorageKind | null {
    return this._resolveEntry(ref)?.kind ?? null;
  }

  has(ref: DatasetVersionRef): boolean {
    return this._entries.has(versionKey(ref));
  }

  describe(ref: DatasetVersionRef): DatasetVersionDescriptor | null {
    const entry = this._resolveEntry(ref);
    return entry ? this._describeEntry(entry, ref) : null;
  }

  materializeJSON(ref: DatasetVersionRef): DatasetJSON | null {
    const entry = this._resolveEntry(ref);
    if (!entry) return null;
    if (entry.kind === 'borrowed') return entry.dataset.toJSON();
    if (entry.kind === 'snapshot') return cloneJson(entry.snapshot);

    const base = this._resolveEntry(entry.baseRef);
    if (!base || base.kind === 'row-view') {
      throw new Error('[DatasetVersionStore] verified row-view base version is unavailable');
    }
    const baseJson = base.kind === 'borrowed' ? base.dataset.toJSON() : cloneJson(base.snapshot);
    if (!validLineage(baseJson.rowIds, baseJson.rows.length)) {
      throw new Error('[DatasetVersionStore] verified row-view base has no valid durable row lineage');
    }
    const byId = new Map<string, Record<string, unknown>>();
    for (let index = 0; index < baseJson.rowIds.length; index += 1) {
      byId.set(baseJson.rowIds[index], baseJson.rows[index]);
    }
    const rows = entry.rowIds.map((id) => {
      const row = byId.get(id);
      if (!row) {
        throw new Error(`[DatasetVersionStore] verified row-view base is missing row ${id}`);
      }
      return { ...row };
    });
    return {
      name: entry.name,
      columns: cloneColumns(entry.columns),
      rows,
      edges: undefined,
      rowIds: entry.rowIds.slice(),
    };
  }

  materialize(ref: DatasetVersionRef): Dataset | null {
    const snapshot = this.materializeJSON(ref);
    return snapshot ? Dataset.fromJSON(snapshot) : null;
  }

  clear(): void {
    this._entries.clear();
    this._entriesByFingerprint.clear();
  }

  private _setEntry(entry: DatasetVersionEntry): void {
    this._entries.set(versionKey(entry.ref), entry);
    if (!this._entriesByFingerprint.has(entry.ref.datasetFingerprint)) {
      this._entriesByFingerprint.set(entry.ref.datasetFingerprint, entry);
    }
  }

  private _resolveEntry(ref: DatasetVersionRef): DatasetVersionEntry | null {
    return (
      this._entries.get(versionKey(ref)) ??
      this._entriesByFingerprint.get(ref.datasetFingerprint) ??
      null
    );
  }

  private _rowIdsForEntry(entry: DatasetVersionEntry): readonly string[] | undefined {
    if (entry.kind === 'borrowed') return entry.dataset.rowIds;
    if (entry.kind === 'snapshot') return entry.snapshot.rowIds;
    return entry.rowIds;
  }

  private _columnsForEntry(entry: DatasetVersionEntry): DatasetJSON['columns'] {
    if (entry.kind === 'borrowed') return entry.dataset.columns;
    if (entry.kind === 'snapshot') return entry.snapshot.columns;
    return entry.columns;
  }

  private _describeEntry(entry: DatasetVersionEntry, requestedRef: DatasetVersionRef): DatasetVersionDescriptor {
    if (entry.kind === 'borrowed') {
      return {
        ref: { ...requestedRef },
        name: entry.dataset.name,
        rowCount: entry.dataset.rowCount,
        columnCount: entry.dataset.columnCount,
      };
    }
    if (entry.kind === 'snapshot') {
      return {
        ref: { ...requestedRef },
        name: entry.snapshot.name,
        rowCount: entry.snapshot.rows.length,
        columnCount: entry.snapshot.columns.length,
      };
    }
    return {
      ref: { ...requestedRef },
      name: entry.name,
      rowCount: entry.rowIds.length,
      columnCount: entry.columns.length,
    };
  }
}

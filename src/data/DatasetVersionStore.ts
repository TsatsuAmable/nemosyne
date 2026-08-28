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

export type DatasetVersionStorageKind = 'borrowed' | 'snapshot' | 'row-view';

type BorrowedEntry = {
  kind: 'borrowed';
  ref: DatasetVersionRef;
  name: string;
  columns: DatasetJSON['columns'];
  rowCount: number;
  rowIds?: string[];
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

function cloneValue(value: unknown, seen = new WeakMap<object, unknown>()): unknown {
  if (value === null || typeof value !== 'object') return value;
  const existing = seen.get(value as object);
  if (existing !== undefined) return existing;
  if (Array.isArray(value)) {
    const output: unknown[] = [];
    seen.set(value, output);
    for (const item of value) output.push(cloneValue(item, seen));
    return output;
  }
  const output: Record<string, unknown> = {};
  seen.set(value as object, output);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    output[key] = cloneValue((value as Record<string, unknown>)[key], seen);
  }
  return output;
}

function cloneRow(row: Record<string, unknown>): Record<string, unknown> {
  return cloneValue(row) as Record<string, unknown>;
}

function cloneColumns(columns: DatasetJSON['columns']): DatasetJSON['columns'] {
  return columns.map((column) => ({ name: column.name, type: column.type }));
}

function cloneJson(snapshot: DatasetJSON): DatasetJSON {
  return {
    name: snapshot.name,
    columns: cloneColumns(snapshot.columns),
    rows: snapshot.rows.map(cloneRow),
    edges: snapshot.edges?.map((edge) => cloneValue(edge) as NonNullable<DatasetJSON['edges']>[number]),
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

function valuesEqual(a: unknown, b: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  const mapped = seen.get(a as object);
  if (mapped) return mapped === b;
  seen.set(a as object, b as object);
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, index) => valuesEqual(value, b[index], seen));
  }
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord).sort();
  const bKeys = Object.keys(bRecord).sort();
  if (aKeys.length !== bKeys.length || aKeys.some((key, index) => key !== bKeys[index])) return false;
  return aKeys.every((key) => valuesEqual(aRecord[key], bRecord[key], seen));
}

/**
 * Runtime index over dataset states already owned by the investigation.
 *
 * Full/derived results retain one isolated DatasetJSON snapshot. The initial
 * row-backed baseline contributes only compact metadata + durable row lineage;
 * it is never used as mutable historical row-value backing. A verified RF-035B2
 * row-preserving result stores only output row IDs + compact metadata while a
 * per-lineage row cache captures each verified row value once from the transient
 * fingerprint-verified result. Chained/branched row views reuse those cached
 * values and therefore cannot be rewritten through stale Dataset references.
 *
 * This remains a persistence/orchestration index, not an analytical authority:
 * it never computes membership/order or transforms scientific values.
 */
export class DatasetVersionStore {
  private readonly _entries = new Map<string, DatasetVersionEntry>();
  private readonly _entriesByFingerprint = new Map<string, DatasetVersionEntry>();
  private readonly _rowValuesByBase = new Map<string, Map<string, Record<string, unknown>>>();

  register(ref: DatasetVersionRef, snapshot: DatasetJSON): void {
    assertRef(ref);
    this._setEntry({ kind: 'snapshot', ref: { ...ref }, snapshot: cloneJson(snapshot) });
  }

  registerBorrowed(ref: DatasetVersionRef, dataset: Dataset): void {
    assertRef(ref);
    this._setEntry({
      kind: 'borrowed',
      ref: { ...ref },
      name: dataset.name,
      columns: cloneColumns(dataset.columns),
      rowCount: dataset.rowCount,
      rowIds: dataset.rowIds?.slice(),
    });
  }

  registerRowView(
    ref: DatasetVersionRef,
    sourceRef: DatasetVersionRef,
    view: DatasetJSON,
  ): void {
    assertRef(ref);
    assertRef(sourceRef);
    if (view.edges && view.edges.length > 0) {
      throw new Error('[DatasetVersionStore] verified row-view output cannot carry edges');
    }
    if (!validLineage(view.rowIds, view.rows.length)) {
      throw new Error('[DatasetVersionStore] verified row-view output row IDs must align, be unique, and be non-empty');
    }

    const source = this._resolveEntry(sourceRef);
    if (!source) {
      throw new Error('[DatasetVersionStore] verified row-view source version is unavailable');
    }
    const sourceDescriptor = this._describeEntry(source, sourceRef);
    const sourceRowIds = this._rowIdsForEntry(source);
    if (!validLineage(sourceRowIds, sourceDescriptor.rowCount)) {
      throw new Error('[DatasetVersionStore] verified row-view source has no valid durable row lineage');
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
    const baseKey = versionKey(baseRef);
    let rowValues = this._rowValuesByBase.get(baseKey);
    if (!rowValues) {
      rowValues = new Map<string, Record<string, unknown>>();
      this._rowValuesByBase.set(baseKey, rowValues);
    }
    for (let index = 0; index < view.rowIds.length; index += 1) {
      const rowId = view.rowIds[index];
      const row = view.rows[index];
      const existing = rowValues.get(rowId);
      if (existing) {
        if (!valuesEqual(existing, row)) {
          throw new Error(`[DatasetVersionStore] verified row ${rowId} changed value within one row-preserving lineage`);
        }
        continue;
      }
      rowValues.set(rowId, cloneRow(row));
    }

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
    // Borrowed baselines are metadata/lineage only. EvidenceLedger's original-
    // dataset compatibility path owns explicit materialisation of that state.
    if (entry.kind === 'borrowed') return null;
    if (entry.kind === 'snapshot') return cloneJson(entry.snapshot);

    const rowValues = this._rowValuesByBase.get(versionKey(entry.baseRef));
    if (!rowValues) {
      throw new Error('[DatasetVersionStore] verified row-view row cache is unavailable');
    }
    const rows = entry.rowIds.map((id) => {
      const row = rowValues.get(id);
      if (!row) {
        throw new Error(`[DatasetVersionStore] verified row-view cache is missing row ${id}`);
      }
      return cloneRow(row);
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
    this._rowValuesByBase.clear();
  }

  private _setEntry(entry: DatasetVersionEntry): void {
    const key = versionKey(entry.ref);
    const previous = this._entries.get(key);
    this._entries.set(key, entry);
    const fingerprintEntry = this._entriesByFingerprint.get(entry.ref.datasetFingerprint);
    // Preserve the earliest content entry for fingerprint fallback, except when
    // this is a metadata refresh of that exact logical entry (for example after
    // Rust row IDs are hydrated). In that case the fallback must not remain
    // pinned to stale lineage metadata.
    if (!fingerprintEntry || fingerprintEntry === previous) {
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
    if (entry.kind === 'borrowed') return entry.rowIds;
    if (entry.kind === 'snapshot') return entry.snapshot.rowIds;
    return entry.rowIds;
  }

  private _columnsForEntry(entry: DatasetVersionEntry): DatasetJSON['columns'] {
    if (entry.kind === 'borrowed') return entry.columns;
    if (entry.kind === 'snapshot') return entry.snapshot.columns;
    return entry.columns;
  }

  private _describeEntry(entry: DatasetVersionEntry, requestedRef: DatasetVersionRef): DatasetVersionDescriptor {
    if (entry.kind === 'borrowed') {
      return {
        ref: { ...requestedRef },
        name: entry.name,
        rowCount: entry.rowCount,
        columnCount: entry.columns.length,
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

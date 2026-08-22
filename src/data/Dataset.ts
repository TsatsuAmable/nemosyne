/**
 * Lightweight in-memory dataset abstraction.
 * Supports typed columns, schema inference, and value extraction.
 */

import type { ColumnSchema, DatasetJSON } from './types.ts';
import { registerDurableRowId } from './RowIdentity.ts';

/**
 * Keys that are stripped from untrusted row objects as defense-in-depth
 * against per-object prototype pollution. `Object.keys` already skips
 * inherited properties, but we explicitly filter these names too so a
 * malicious row carrying an own `__proto__`/`constructor`/`prototype`
 * data property can never reach downstream code paths (e.g. `Object.assign`
 * or merge operations that invoke the `__proto__` setter).
 */
const DANGEROUS_ROW_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function hasDangerousOwnKey(row: Record<string, unknown>): boolean {
  return (
    Object.prototype.hasOwnProperty.call(row, '__proto__') ||
    Object.prototype.hasOwnProperty.call(row, 'constructor') ||
    Object.prototype.hasOwnProperty.call(row, 'prototype')
  );
}

/**
 * Always build a fresh plain object from a row's own enumerable keys, dropping
 * any `__proto__`/`constructor`/`prototype` entries. The result never aliases
 * the source and never carries a dangerous key. Used by `clone`/`fromJSON`
 * where a NEW object is semantically required.
 */
function cloneRow(row: Record<string, unknown>): Record<string, unknown> {
  if (!row || typeof row !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    if (DANGEROUS_ROW_KEYS.has(key)) continue;
    out[key] = row[key];
  }
  return out;
}

/**
 * Strip dangerous keys while PRESERVING reference identity for clean rows.
 * Clean rows are returned unchanged so renderer bookkeeping can reuse object
 * identity when no durable Rust row ID is present. Rows carrying dangerous
 * keys are rebuilt and sanitized.
 */
function sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
  if (!row || typeof row !== 'object') return {};
  if (!hasDangerousOwnKey(row)) return row;
  return cloneRow(row);
}

export const ColumnType = {
  NUMERIC: 'NUMERIC',
  CATEGORICAL: 'CATEGORICAL',
  TEMPORAL: 'TEMPORAL',
  TEXT: 'TEXT',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ColumnTypeKey = keyof typeof ColumnType;
export type ColumnTypeValue = (typeof ColumnType)[ColumnTypeKey];

export interface DatasetEdge {
  source: string | number;
  target: string | number;
  weight?: number;
  [key: string]: unknown;
}

export interface DatasetMeta {
  [key: string]: unknown;
}

export class Dataset {
  name: string;
  columns: ColumnSchema[];
  rows: Record<string, unknown>[];
  edges?: DatasetEdge[];
  /** Durable Rust-owned observation IDs aligned 1:1 with `rows`, when known. */
  rowIds?: string[];
  _meta?: DatasetMeta;

  constructor(
    name: string,
    columns: ColumnSchema[],
    rows: Record<string, unknown>[],
    edges?: DatasetEdge[],
    rowIds?: string[]
  ) {
    this.name = name;
    this.columns = columns;
    this.rows = rows.map(sanitizeRow);
    this.edges = edges;
    this._setRowIds(rowIds);
  }

  private _setRowIds(rowIds?: string[]): void {
    if (!rowIds || rowIds.length !== this.rows.length || rowIds.some((id) => !id)) {
      this.rowIds = undefined;
      return;
    }
    this.rowIds = rowIds.slice();
    for (let i = 0; i < this.rows.length; i++) {
      registerDurableRowId(this.rows[i], this.rowIds[i]);
    }
  }

  get rowCount(): number {
    return this.rows.length;
  }

  get columnCount(): number {
    return this.columns.length;
  }

  getColumn(name: string): ColumnSchema | undefined {
    return this.columns.find((c) => c.name === name);
  }

  getColumnValues(name: string): unknown[] {
    return this.rows.map((r) => r[name]);
  }

  get numericColumns(): ColumnSchema[] {
    return this.columns.filter((c) => c.type === ColumnType.NUMERIC);
  }

  get categoricalColumns(): ColumnSchema[] {
    return this.columns.filter((c) => c.type === ColumnType.CATEGORICAL);
  }

  get temporalColumns(): ColumnSchema[] {
    return this.columns.filter((c) => c.type === ColumnType.TEMPORAL);
  }

  get hasTemporal(): boolean {
    return this.temporalColumns.length > 0;
  }

  get hasNumeric(): boolean {
    return this.numericColumns.length > 0;
  }

  // Wave 5/6: min/max for visual channel scaling (VRTopologyTranslator, layouts,
  // DatasetSpace normalization). These are RENDERER consumers (governing rule:
  // embodiment logic stays in TS). The analytical source of min/max is kernel
  // `ColumnStats` via AtlasCore.facts(); DatasetSpace now reads ranges from the
  // kernel Facts, and this accessor remains only for renderer paths that do not
  // hold an AtlasCore reference.
  rangeOf(name: string): { min: number; max: number } {
    const values = this.getColumnValues(name).filter(
      (v): v is number => typeof v === 'number' && !Number.isNaN(v)
    );
    if (values.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...values), max: Math.max(...values) };
  }

  // Wave 5/6: cardinality for the color channel. The analytical source is kernel
  // `CategoricalStats.cardinality` via AtlasCore.facts(); the former analytical
  // consumer (ConstraintEngine.extractFacts) was deleted. This accessor now
  // serves only non-analytical callers (kept for completeness).
  cardinalityOf(name: string): number {
    return new Set(this.getColumnValues(name)).size;
  }

  // Wave 5: numeric hash used only as a renderer seed for SeededRandom
  // (VRTopologyTranslator/layouts). NOT an analytical fingerprint — the
  // canonical content fingerprint is kernel `dataset_fingerprint` /
  // DatasetSpace.fingerprint (FNV-1a). No analytical consumer remains.
  /** Stable hash for deterministic procedural generation. */
  get fingerprint(): number {
    let h = 0;
    const str = `${this.name}:${this.rowCount}:${this.columnCount}`;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  /**
   * Update rows for live/streaming data.
   * New JS rows do not yet have Rust lineage IDs, so any existing aligned ID
   * vector is invalidated rather than risk attaching an ID to the wrong row.
   */
  updateRows(newRows: Record<string, unknown>[], mode: 'append' | 'replace' = 'append', limit: number | null = null): this {
    const sanitized = newRows.map(sanitizeRow);
    if (mode === 'replace') {
      this.rows = sanitized;
    } else {
      this.rows.push(...sanitized);
    }
    if (limit != null && this.rows.length > limit) {
      this.rows = this.rows.slice(-limit);
    }
    this.rowIds = undefined;
    return this;
  }

  clone(): Dataset {
    return new Dataset(
      this.name,
      this.columns.slice(),
      this.rows.map(cloneRow),
      this.edges?.map((edge) => ({ ...edge })),
      this.rowIds?.slice()
    );
  }

  /**
   * Serialize the dataset to a plain JSON-compatible object.
   * `rowIds` is ABI metadata and deliberately remains outside each row object.
   */
  toJSON(): DatasetJSON {
    return {
      name: this.name,
      columns: this.columns.map((c) => ({ name: c.name, type: c.type })),
      rows: this.rows.map((r) => {
        const copy: Record<string, unknown> = {};
        for (const key of Object.keys(r)) {
          const v = r[key];
          copy[key] = v === undefined ? null : v;
        }
        return copy;
      }),
      rowIds: this.rowIds?.slice(),
      edges: this.edges ?? undefined,
    };
  }

  /** Reconstruct a Dataset from a plain JSON object. */
  static fromJSON(obj: DatasetJSON | unknown): Dataset {
    if (!obj || typeof obj !== 'object') {
      throw new Error('Dataset.fromJSON requires an object');
    }
    const typedObj = obj as DatasetJSON;
    const ds = new Dataset(
      typedObj.name || 'dataset',
      typedObj.columns?.map((c) => ({
        name: c.name,
        type: (typeof c.type === 'string' ? c.type.toUpperCase() : c.type) as ColumnTypeValue,
      })) || [],
      (typedObj.rows ?? []).map(cloneRow),
      typedObj.edges?.map((e) => ({ ...e })),
      typedObj.rowIds
    );
    return ds;
  }
}

/**
 * Lightweight in-memory dataset abstraction.
 * Supports typed columns, schema inference, and value extraction.
 */

import type { ColumnSchema, DatasetJSON } from './types.ts';

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
 * Data-operation visual transforms (`applyFilter`/`applySort`/cluster ops in
 * `src/vr/interactions/`) match meshes to dataset rows by reference equality
 * (`mesh.userData.row === dataset.rows[i]`). Cloning every row in the
 * constructor would break that contract, so only rows that actually carry a
 * dangerous own key are rebuilt; clean rows are returned unchanged. This
 * keeps the prototype-pollution defense intact (dangerous keys are still
 * stripped) without breaking row-reference identity across `Dataset`
 * boundaries (e.g. `filter(dataset)` -> `new Dataset(...)` -> `applyFilter`).
 * Non-object/null input collapses to `{}`.
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
  _meta?: DatasetMeta;

  constructor(
    name: string,
    columns: ColumnSchema[],
    rows: Record<string, unknown>[],
    edges?: DatasetEdge[]
  ) {
    this.name = name;
    this.columns = columns;
    // Sanitize every incoming row at the single chokepoint — this covers
    // parse/CSV/JSON/msgpack/fromJSON/clone/updateRows paths since they
    // all funnel through the constructor or call sanitizeRow directly.
    this.rows = rows.map(sanitizeRow);
    this.edges = edges;
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

  // TODO(Wave 5): delegate to kernel statistics metadata
  rangeOf(name: string): { min: number; max: number } {
    const values = this.getColumnValues(name).filter(
      (v): v is number => typeof v === 'number' && !Number.isNaN(v)
    );
    if (values.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...values), max: Math.max(...values) };
  }

  // TODO(Wave 5): delegate to kernel statistics metadata
  cardinalityOf(name: string): number {
    return new Set(this.getColumnValues(name)).size;
  }

  // TODO(Wave 5): delegate to kernel statistics metadata
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
   * @param newRows - rows to add or use as replacement
   * @param mode - 'append' or 'replace'
   * @param limit - optional max row count (sliding window)
   * @returns this
   */
  updateRows(newRows: Record<string, unknown>[], mode: 'append' | 'replace' = 'append', limit: number | null = null): this {
    // Sanitize incoming rows before they join the instance store. Live
    // stream rows are untrusted (e.g. WebSocket sensor data) and must not
    // carry dangerous keys into downstream consumers.
    const sanitized = newRows.map(sanitizeRow);
    if (mode === 'replace') {
      this.rows = sanitized;
    } else {
      this.rows.push(...sanitized);
    }
    if (limit != null && this.rows.length > limit) {
      this.rows = this.rows.slice(-limit);
    }
    return this;
  }

  clone(): Dataset {
    return new Dataset(
      this.name,
      this.columns.slice(),
      // Clone (not alias) rows into independent clean objects so mutations to
      // the clone never leak back into the source. Rows are already sanitized
      // on construction; cloneRow re-strips dangerous keys defensively.
      this.rows.map(cloneRow)
    );
  }

  /**
   * Serialize the dataset to a plain JSON-compatible object.
   * This is used for session persistence and import/export.
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
      edges: this.edges ?? undefined,
    };
  }

  /**
   * Reconstruct a Dataset from a plain JSON object.
   */
  static fromJSON(obj: DatasetJSON | unknown): Dataset {
    if (!obj || typeof obj !== 'object') {
      throw new Error('Dataset.fromJSON requires an object');
    }
    const typedObj = obj as DatasetJSON;
    // Build independent, sanitized row copies so the reconstructed dataset
    // never aliases the parsed payload and never carries dangerous keys. The
    // constructor's sanitizeRow is a no-op on these (already clean) objects,
    // preserving their identity for downstream row-reference matching.
    const ds = new Dataset(
      typedObj.name || 'dataset',
      typedObj.columns?.map((c) => ({ name: c.name, type: c.type })) || [],
      (typedObj.rows ?? []).map(cloneRow)
    );
    if (typedObj.edges) {
      ds.edges = typedObj.edges.map((e) => ({ ...e }));
    }
    return ds;
  }

}

/**
 * Lightweight in-memory dataset abstraction.
 * Supports typed columns, schema inference, and value extraction.
 */

import type { ColumnSchema, DatasetJSON } from './types.ts';
import { registerDurableRowId } from './RowIdentity.ts';

const DANGEROUS_ROW_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isJsonContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return true;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasDangerousKeyDeep(value: unknown, seen = new WeakSet<object>()): boolean {
  if (!isJsonContainer(value)) return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.some((item) => hasDangerousKeyDeep(item, seen));
  }

  for (const key of Object.keys(value)) {
    if (DANGEROUS_ROW_KEYS.has(key) || hasDangerousKeyDeep(value[key], seen)) return true;
  }
  return false;
}

function cloneSanitizedJsonValue(value: unknown, seen = new WeakMap<object, unknown>()): unknown {
  if (!isJsonContainer(value)) return value;
  const existing = seen.get(value);
  if (existing !== undefined) return existing;

  if (Array.isArray(value)) {
    const out: unknown[] = [];
    seen.set(value, out);
    for (const item of value) out.push(cloneSanitizedJsonValue(item, seen));
    return out;
  }

  const out: Record<string, unknown> = {};
  seen.set(value, out);
  for (const key of Object.keys(value)) {
    if (DANGEROUS_ROW_KEYS.has(key)) continue;
    out[key] = cloneSanitizedJsonValue(value[key], seen);
  }
  return out;
}

function cloneRow(row: Record<string, unknown>): Record<string, unknown> {
  if (!row || typeof row !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    if (DANGEROUS_ROW_KEYS.has(key)) continue;
    const value = row[key];
    out[key] = hasDangerousKeyDeep(value) ? cloneSanitizedJsonValue(value) : value;
  }
  return out;
}

function sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
  if (!row || typeof row !== 'object') return {};
  if (!hasDangerousKeyDeep(row)) return row;
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

  private _setRowIds(rowIds?: string[]): boolean {
    if (
      !rowIds ||
      rowIds.length !== this.rows.length ||
      rowIds.some((id) => typeof id !== 'string' || id.length === 0) ||
      new Set(rowIds).size !== rowIds.length
    ) {
      this.rowIds = undefined;
      return false;
    }
    this.rowIds = rowIds.slice();
    for (let i = 0; i < this.rows.length; i++) {
      registerDurableRowId(this.rows[i], this.rowIds[i]);
    }
    return true;
  }

  /**
   * Adopt a validated identity vector supplied by the authoritative Rust
   * dataset store. This is metadata hydration only: it does not alter row
   * values, schema, analytical fingerprints, or dataset version.
   */
  adoptRowIds(rowIds: string[]): boolean {
    return this._setRowIds(rowIds);
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

  rangeOf(name: string): { min: number; max: number } {
    const values = this.getColumnValues(name).filter(
      (v): v is number => typeof v === 'number' && !Number.isNaN(v)
    );
    if (values.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...values), max: Math.max(...values) };
  }

  cardinalityOf(name: string): number {
    return new Set(this.getColumnValues(name)).size;
  }

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
  updateRows(
    newRows: Record<string, unknown>[],
    mode: 'append' | 'replace' = 'append',
    limit: number | null = null
  ): this {
    const sanitized = newRows.map(sanitizeRow);
    if (mode === 'replace') this.rows = sanitized;
    else this.rows.push(...sanitized);
    if (limit != null && this.rows.length > limit) this.rows = this.rows.slice(-limit);
    this.rowIds = undefined;
    return this;
  }

  clone(): Dataset {
    return new Dataset(
      this.name,
      this.columns.slice(),
      this.rows.map(cloneRow),
      undefined,
      this.rowIds?.slice()
    );
  }

  toJSON(): DatasetJSON {
    const json: DatasetJSON = {
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
    if (this.rowIds) json.rowIds = this.rowIds.slice();
    return json;
  }

  static fromJSON(obj: DatasetJSON | unknown): Dataset {
    if (!obj || typeof obj !== 'object') throw new Error('Dataset.fromJSON requires an object');
    const typedObj = obj as DatasetJSON;
    return new Dataset(
      typedObj.name || 'dataset',
      typedObj.columns?.map((c) => ({
        name: c.name,
        type: (typeof c.type === 'string' ? c.type.toUpperCase() : c.type) as ColumnTypeValue,
      })) || [],
      (typedObj.rows ?? []).map(cloneRow),
      typedObj.edges?.map((e) => ({ ...e })),
      typedObj.rowIds
    );
  }
}

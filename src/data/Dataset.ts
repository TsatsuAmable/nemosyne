/**
 * Lightweight in-memory dataset abstraction.
 * Supports typed columns, schema inference, and value extraction.
 */

import type { ColumnSchema, DatasetJSON } from './types.ts';

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
    this.rows = rows;
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
   * @param newRows - rows to add or use as replacement
   * @param mode - 'append' or 'replace'
   * @param limit - optional max row count (sliding window)
   * @returns this
   */
  updateRows(newRows: Record<string, unknown>[], mode: 'append' | 'replace' = 'append', limit: number | null = null): this {
    if (mode === 'replace') {
      this.rows = newRows.slice();
    } else {
      this.rows.push(...newRows);
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
      this.rows.map((r) => ({ ...r }))
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
    const ds = new Dataset(
      typedObj.name || 'dataset',
      typedObj.columns?.map((c) => ({ name: c.name, type: c.type })) || [],
      typedObj.rows?.map((r) => ({ ...r })) || []
    );
    if (typedObj.edges) {
      ds.edges = typedObj.edges.map((e) => ({ ...e }));
    }
    return ds;
  }
}

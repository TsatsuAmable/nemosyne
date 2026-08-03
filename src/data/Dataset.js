/**
 * Lightweight in-memory dataset abstraction.
 * Supports typed columns, schema inference, and value extraction.
 */
export const ColumnType = {
  NUMERIC: 'NUMERIC',
  CATEGORICAL: 'CATEGORICAL',
  TEMPORAL: 'TEMPORAL',
  TEXT: 'TEXT',
  UNKNOWN: 'UNKNOWN',
};

export class Dataset {
  constructor(name, columns, rows) {
    this.name = name;
    this.columns = columns; // [{ name, type }]
    this.rows = rows; // array of objects
  }

  get rowCount() {
    return this.rows.length;
  }

  get columnCount() {
    return this.columns.length;
  }

  getColumn(name) {
    return this.columns.find((c) => c.name === name);
  }

  getColumnValues(name) {
    return this.rows.map((r) => r[name]);
  }

  get numericColumns() {
    return this.columns.filter((c) => c.type === ColumnType.NUMERIC);
  }

  get categoricalColumns() {
    return this.columns.filter((c) => c.type === ColumnType.CATEGORICAL);
  }

  get temporalColumns() {
    return this.columns.filter((c) => c.type === ColumnType.TEMPORAL);
  }

  get hasTemporal() {
    return this.temporalColumns.length > 0;
  }

  get hasNumeric() {
    return this.numericColumns.length > 0;
  }

  rangeOf(name) {
    const values = this.getColumnValues(name).filter(
      (v) => typeof v === 'number' && !Number.isNaN(v)
    );
    if (values.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...values), max: Math.max(...values) };
  }

  cardinalityOf(name) {
    return new Set(this.getColumnValues(name)).size;
  }

  /** Stable hash for deterministic procedural generation. */
  get fingerprint() {
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
   * @param {Array<Object>} newRows
   * @param {'append'|'replace'} mode
   * @param {number|null} limit  Optional max row count (sliding window).
   * @returns {Dataset} this
   */
  updateRows(newRows, mode = 'append', limit = null) {
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

  clone() {
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
  toJSON() {
    return {
      name: this.name,
      columns: this.columns.map((c) => ({ name: c.name, type: c.type })),
      rows: this.rows.map((r) => {
        const copy = {};
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
  static fromJSON(obj) {
    if (!obj || typeof obj !== 'object') {
      throw new Error('Dataset.fromJSON requires an object');
    }
    const ds = new Dataset(
      obj.name || 'dataset',
      obj.columns?.map((c) => ({ name: c.name, type: c.type })) || [],
      obj.rows?.map((r) => ({ ...r })) || []
    );
    if (obj.edges) {
      ds.edges = obj.edges.map((e) => ({ ...e }));
    }
    return ds;
  }
}

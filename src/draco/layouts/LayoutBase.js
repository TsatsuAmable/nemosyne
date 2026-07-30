/**
 * Shared helpers for 3D layout generators.
 *
 * All layout classes receive a dataset, encodings, and optional metadata,
 * and return an array of {
 *   position: THREE.Vector3,
 *   row,
 *   seriesId?,       // for time-series / grouped layouts
 *   parentIndex?,    // for hierarchical layouts
 * }.
 */

import * as THREE from 'three';
import { normalize } from '../../data/Encodings.js';

export class LayoutBase {
  static compute(rows = [], options = {}) {
    throw new Error('Layout subclasses must implement compute()');
  }

  /**
   * Extract a numeric value from a row, normalizing against the dataset range.
   * Returns a number in [0, 1] when the field is numeric.
   */
  static numericValue(row, dataset, field, fallback = 0) {
    if (!field || !dataset) return fallback;
    const col = dataset.getColumn(field);
    if (!col || col.type !== 'NUMERIC') return fallback;
    const range = dataset.rangeOf(field);
    const v = Number(row[field]);
    if (!Number.isFinite(v)) return fallback;
    return normalize(v, range.min, range.max);
  }

  /**
   * Return a stable row identifier usable for edge matching.
   */
  static rowId(row, idField = 'id') {
    return row[idField] ?? row.name ?? row.label ?? row._index;
  }
}

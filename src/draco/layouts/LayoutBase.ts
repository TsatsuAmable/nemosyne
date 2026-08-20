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

import type { Dataset } from '../../data/Dataset.ts';
import type { LayoutEntry } from '../types.ts';
import { normalize } from '../../data/Encodings.ts';

/**
 * P20 (No Silent Fallbacks): When the Rust/WASM layout kernel is unavailable,
 * each layout must explicitly log a degraded-state warning rather than silently
 * substituting a JS computation. This flag ensures the warning is emitted only
 * once per layout kind per session to avoid log flooding.
 */
const _warnedLayoutKinds = new Set<string>();

/**
 * Emit a one-time KernelUnavailable warning for the given layout kind. Callers
 * should invoke this at the point where the WASM path failed and the JS
 * fallback is about to execute.
 */
export function warnKernelLayoutUnavailable(kind: string): void {
  if (_warnedLayoutKinds.has(kind)) return;
  _warnedLayoutKinds.add(kind);
  console.warn(
    `[Nemosyne:P20] ${kind} layout: Rust/WASM kernel unavailable — using degraded JS spatial fallback. ` +
    'This is not a silent analytical substitute; the kernel remains the sole analytical authority.'
  );
}

export class LayoutBase {
  static compute<T = Record<string, unknown>>(
    _rows: T[] = [],
    _options: Record<string, unknown> = {}
  ): LayoutEntry<T>[] {
    throw new Error('Layout subclasses must implement compute()');
  }

  /**
   * Extract a numeric value from a row, normalizing against the dataset range.
   * Returns a number in [0, 1] when the field is numeric.
   */
  static numericValue(
    row: Record<string, unknown>,
    dataset: Dataset | null | undefined,
    field: string | undefined,
    fallback = 0
  ): number {
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
  static rowId(row: Record<string, unknown>, idField = 'id'): unknown {
    return row[idField] ?? row.name ?? row.label ?? row._index;
  }
}

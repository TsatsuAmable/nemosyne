/**
 * Shared helpers for 3D layout generators in Moneta.
 */

import type { Dataset } from '../../data/Dataset.ts';
import type { LayoutEntry } from '../types.ts';
import { normalize } from '../../data/Encodings.ts';

const _warnedLayoutKinds = new Set<string>();

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

  static rowId(row: Record<string, unknown>, idField = 'id'): unknown {
    return row[idField] ?? row.name ?? row.label ?? row._index;
  }
}

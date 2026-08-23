/**
 * Shared helpers for 3D layout generators in Moneta.
 */

import type { Dataset } from '../../data/Dataset.ts';
import type { LayoutEntry } from '../types.ts';
import { normalize } from '../../data/Encodings.ts';

export class KernelLayoutUnavailableError extends Error {
  readonly layoutKind: string;

  constructor(layoutKind: string, detail = 'Rust/WASM kernel returned no authoritative layout') {
    super(`[Nemosyne:Moneta] ${layoutKind}: ${detail}`);
    this.name = 'KernelLayoutUnavailableError';
    this.layoutKind = layoutKind;
  }
}

export function requireKernelLayoutPositions(
  kind: string,
  positions: Float32Array | null,
  expectedLength: number,
): Float32Array {
  if (!positions || positions.length !== expectedLength) {
    throw new KernelLayoutUnavailableError(
      kind,
      `expected ${expectedLength} coordinate values from Rust/WASM, received ${positions?.length ?? 0}`,
    );
  }
  return positions;
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

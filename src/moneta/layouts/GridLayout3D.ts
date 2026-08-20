import * as THREE from 'three';
import { LayoutBase, warnKernelLayoutUnavailable } from './LayoutBase.ts';
import type { LayoutEntry } from '../types.ts';
import { computeGrid3d } from '../../wasm/RuntimeBridge.ts';

export interface GridLayoutOptions {
  spacing?: number;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  yOffset?: number;
}

export class GridLayout3D extends LayoutBase {
  static compute<T = Record<string, unknown>>(
    rows: T[] = [],
    options: GridLayoutOptions = {}
  ): LayoutEntry<T>[] {
    const { spacing = 1.1, sortKey, sortDirection = 'asc', yOffset = 1.2 } = options;

    const ordered = rows.slice() as T[];
    if (sortKey) {
      ordered.sort((a, b) => {
        const av = (a as Record<string, unknown>)[sortKey] ?? 0;
        const bv = (b as Record<string, unknown>)[sortKey] ?? 0;
        if (typeof av === 'number' && typeof bv === 'number') {
          return sortDirection === 'asc' ? av - bv : bv - av;
        }
        return sortDirection === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    }

    const n = ordered.length || 1;
    const out: LayoutEntry<T>[] = [];

    const wasmPositions = computeGrid3d(n, spacing, yOffset);
    if (wasmPositions && wasmPositions.length === n * 3) {
      for (let i = 0; i < n; i++) {
        out.push({
          position: new THREE.Vector3(
            wasmPositions[i * 3 + 0],
            wasmPositions[i * 3 + 1],
            wasmPositions[i * 3 + 2]
          ),
          row: ordered[i],
          index: i,
        });
      }
      return out;
    }

    warnKernelLayoutUnavailable('GridLayout3D');
    const cols = Math.ceil(Math.cbrt(n));
    const layers = Math.ceil(n / (cols * cols));

    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols) % cols;
      const layer = Math.floor(i / (cols * cols));
      const x = (col - (cols - 1) / 2) * spacing;
      const y = (row - (cols - 1) / 2) * spacing + yOffset;
      const z = (layer - (layers - 1) / 2) * spacing;
      out.push({ position: new THREE.Vector3(x, y, z), row: ordered[i], index: i });
    }

    return out;
  }
}

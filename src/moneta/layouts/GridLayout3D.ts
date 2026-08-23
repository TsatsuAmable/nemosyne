import * as THREE from 'three';
import { LayoutBase, requireKernelLayoutPositions } from './LayoutBase.ts';
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

    if (ordered.length === 0) return [];
    const wasmPositions = requireKernelLayoutPositions(
      'GridLayout3D',
      computeGrid3d(ordered.length, spacing, yOffset),
      ordered.length * 3,
    );

    return ordered.map((row, i) => ({
      position: new THREE.Vector3(
        wasmPositions[i * 3],
        wasmPositions[i * 3 + 1],
        wasmPositions[i * 3 + 2],
      ),
      row,
      index: i,
    }));
  }
}

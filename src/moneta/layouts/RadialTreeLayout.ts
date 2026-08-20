import * as THREE from 'three';
import { LayoutBase, warnKernelLayoutUnavailable } from './LayoutBase.ts';
import type { RadialEntry } from '../types.ts';
import { computeRadialTree3d } from '../../wasm/RuntimeBridge.ts';

export interface RadialTreeOptions {
  radiusStep?: number;
  ringSpacing?: number;
  levelHeight?: number;
  yStep?: number;
  yOffset?: number;
  parentKey?: string;
  levelKey?: string;
}

export class RadialTreeLayout extends LayoutBase {
  static compute<T = Record<string, unknown>>(
    rows: T[] = [],
    options: RadialTreeOptions = {}
  ): RadialEntry<T>[] {
    const {
      radiusStep = options.ringSpacing ?? 1.8,
      levelHeight = options.yStep ?? 0.9,
      yOffset = 0.8,
      parentKey = 'parentId',
      levelKey = 'level',
    } = options;

    const n = rows.length || 1;
    const levelsList = rows.map((r) => {
      const l = (r as Record<string, unknown>)[levelKey];
      return typeof l === 'number' ? l : 0;
    });

    const levels: Map<number, number[]> = new Map();
    rows.forEach((r, i) => {
      const rawL = (r as Record<string, unknown>)[levelKey];
      const lvl = typeof rawL === 'number' ? rawL : 0;
      if (!levels.has(lvl)) levels.set(lvl, []);
      levels.get(lvl)!.push(i);
    });

    const wasmPositions = computeRadialTree3d(levelsList, radiusStep, levelHeight, yOffset);
    if (wasmPositions && wasmPositions.length === n * 3) {
      return rows.map((row, i) => {
        const r = row as Record<string, unknown>;
        const rawL = r[levelKey];
        const lvl = typeof rawL === 'number' ? rawL : 0;
        const parentId = r[parentKey];
        let pIdx =
          parentId !== undefined
            ? rows.findIndex((other) => this.rowId(other as Record<string, unknown>) === parentId)
            : -1;

        if (pIdx < 0 && lvl > 0 && levels.has(lvl - 1)) {
          const parentIndices = levels.get(lvl - 1)!;
          pIdx = parentIndices[0];
        }

        return {
          position: new THREE.Vector3(
            wasmPositions[i * 3 + 0],
            wasmPositions[i * 3 + 1],
            wasmPositions[i * 3 + 2]
          ),
          row,
          index: i,
          level: lvl,
          parentIndex: pIdx >= 0 ? pIdx : undefined,
        };
      });
    }

    warnKernelLayoutUnavailable('RadialTreeLayout');
    const out: RadialEntry<T>[] = new Array(n);

    for (const [lvl, indices] of levels.entries()) {
      const r = lvl * radiusStep;
      const count = indices.length;
      indices.forEach((idx, k) => {
        const theta = (2 * Math.PI * k) / count;
        const x = r * Math.cos(theta);
        const z = r * Math.sin(theta);
        const y = lvl * levelHeight + yOffset;

        const row = rows[idx];
        const parentId = (row as Record<string, unknown>)[parentKey];
        let pIdx =
          parentId !== undefined
            ? rows.findIndex((other) => this.rowId(other as Record<string, unknown>) === parentId)
            : -1;

        if (pIdx < 0 && lvl > 0 && levels.has(lvl - 1)) {
          const parentIndices = levels.get(lvl - 1)!;
          const pPos = Math.floor((k / count) * parentIndices.length);
          pIdx = parentIndices[pPos % parentIndices.length];
        }

        out[idx] = {
          position: new THREE.Vector3(x, y, z),
          row,
          index: idx,
          level: lvl,
          parentIndex: pIdx >= 0 ? pIdx : undefined,
        };
      });
    }

    return out;
  }
}

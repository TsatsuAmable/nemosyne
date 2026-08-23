import * as THREE from 'three';
import { LayoutBase, requireKernelLayoutPositions } from './LayoutBase.ts';
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
    if (rows.length === 0) return [];

    const {
      radiusStep = options.ringSpacing ?? 1.8,
      levelHeight = options.yStep ?? 0.9,
      yOffset = 0.8,
      parentKey = 'parentId',
      levelKey = 'level',
    } = options;

    const levelsList = rows.map((r) => {
      const l = (r as Record<string, unknown>)[levelKey];
      return typeof l === 'number' ? l : 0;
    });
    const levels = new Map<number, number[]>();
    rows.forEach((r, i) => {
      const raw = (r as Record<string, unknown>)[levelKey];
      const level = typeof raw === 'number' ? raw : 0;
      const bucket = levels.get(level) ?? [];
      bucket.push(i);
      levels.set(level, bucket);
    });

    const wasmPositions = requireKernelLayoutPositions(
      'RadialTreeLayout',
      computeRadialTree3d(levelsList, radiusStep, levelHeight, yOffset),
      rows.length * 3,
    );

    return rows.map((row, i) => {
      const rec = row as Record<string, unknown>;
      const rawLevel = rec[levelKey];
      const level = typeof rawLevel === 'number' ? rawLevel : 0;
      const parentId = rec[parentKey];
      let parentIndex = parentId !== undefined
        ? rows.findIndex((other) => this.rowId(other as Record<string, unknown>) === parentId)
        : -1;

      if (parentIndex < 0 && level > 0) {
        const candidates = levels.get(level - 1);
        if (candidates?.length) parentIndex = candidates[0];
      }

      return {
        position: new THREE.Vector3(
          wasmPositions[i * 3],
          wasmPositions[i * 3 + 1],
          wasmPositions[i * 3 + 2],
        ),
        row,
        index: i,
        level,
        parentIndex: parentIndex >= 0 ? parentIndex : undefined,
      };
    });
  }
}

import * as THREE from 'three';
import { LayoutBase } from './LayoutBase.ts';
import type { LayoutEntry, RadialEntry, RadialTreeOptions } from '../types.ts';
import { computeRadialTree3d } from '../../wasm/RuntimeBridge.ts';

/**
 * Place hierarchical rows on concentric rings by level. Parent-child edges
 * can be inferred from the optional parentKey field or from row order.
 */
export class RadialTreeLayout extends LayoutBase {
  static compute<T = Record<string, unknown>>(
    rows: T[] = [],
    options: RadialTreeOptions = {}
  ): LayoutEntry<T>[] {
    const {
      levelKey = 'level',
      parentKey,
      ringSpacing = 1.8,
      yStep = 0.8,
      yOffset = 1.2,
    } = options;

    const byLevel: Record<number, { row: T; index: number }[]> = {};
    const flatLevels: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lvl = Number((row as Record<string, unknown>)[levelKey] ?? 0);
      flatLevels.push(lvl);
      if (!byLevel[lvl]) byLevel[lvl] = [];
      byLevel[lvl].push({ row, index: i });
    }

    const levels = Object.keys(byLevel)
      .map(Number)
      .sort((a, b) => a - b);

    const out: RadialEntry<T>[] = [];
    const wasmPositions = computeRadialTree3d(flatLevels, ringSpacing, yStep, yOffset);

    for (const lvl of levels) {
      const ringRows = byLevel[lvl];
      const radius = lvl === 0 ? 0 : lvl * ringSpacing;
      const count = ringRows.length;
      const y = lvl * yStep + yOffset;

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const item = ringRows[i];
        const pos = wasmPositions && wasmPositions.length === rows.length * 3
          ? new THREE.Vector3(
              wasmPositions[item.index * 3 + 0],
              wasmPositions[item.index * 3 + 1],
              wasmPositions[item.index * 3 + 2]
            )
          : new THREE.Vector3(x, y, z);

        const entry: RadialEntry<T> = {
          position: pos,
          row: item.row,
          index: item.index,
          level: lvl,
        };

        if (parentKey) {
          const parentId = (item.row as Record<string, unknown>)[parentKey];
          if (parentId != null) {
            const parent = out.find(
              (p) => this.rowId(p.row as Record<string, unknown>) === parentId
            );
            if (parent) entry.parentIndex = parent.index;
          }
        } else if (lvl > 0) {
          const prev = out.filter((p) => p.level === lvl - 1);
          if (prev.length) {
            let best = prev[0];
            let bestDiff = Infinity;
            for (const p of prev) {
              const px = p.position.x;
              const pz = p.position.z;
              const pAngle = Math.atan2(pz, px);
              let diff = Math.abs(pAngle - angle);
              if (diff > Math.PI) diff = Math.PI * 2 - diff;
              if (diff < bestDiff) {
                bestDiff = diff;
                best = p;
              }
            }
            entry.parentIndex = best.index;
          }
        }

        out.push(entry);
      }
    }

    return out;
  }
}

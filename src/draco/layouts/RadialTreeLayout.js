import * as THREE from 'three';
import { LayoutBase } from './LayoutBase.js';

/**
 * Place hierarchical rows on concentric rings by level. Parent-child edges
 * can be inferred from the optional parentKey field or from row order.
 */
export class RadialTreeLayout extends LayoutBase {
  static compute(rows = [], options = {}) {
    const {
      levelKey = 'level',
      parentKey,
      ringSpacing = 1.8,
      yStep = 0.8,
      yOffset = 1.2,
    } = options;

    const byLevel = {};
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lvl = Number(row[levelKey] ?? 0);
      if (!byLevel[lvl]) byLevel[lvl] = [];
      byLevel[lvl].push({ row, index: i });
    }

    const levels = Object.keys(byLevel)
      .map(Number)
      .sort((a, b) => a - b);

    const out = [];
    const parents = [];

    for (const lvl of levels) {
      const ringRows = byLevel[lvl];
      // Level 0 sits at the center; deeper levels move outward.
      const radius = lvl === 0 ? 0 : lvl * ringSpacing;
      const count = ringRows.length;
      const y = lvl * yStep + yOffset;

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const item = ringRows[i];
        const entry = {
          position: new THREE.Vector3(x, y, z),
          row: item.row,
          index: item.index,
          level: lvl,
        };

        if (parentKey) {
          const parentId = item.row[parentKey];
          if (parentId != null) {
            const parent = out.find((p) => this.rowId(p.row) === parentId);
            if (parent) entry.parentIndex = parent.index;
          }
        } else if (lvl > 0) {
          // Fallback: assign to the previous ring node with the closest angle.
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

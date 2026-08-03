import * as THREE from 'three';
import { LayoutBase } from './LayoutBase.js';

/**
 * Pack rows into a 3D grid. Optional sortKey reorders rows before packing.
 */
export class GridLayout3D extends LayoutBase {
  static compute(rows = [], options = {}) {
    const { spacing = 1.1, sortKey, sortDirection = 'asc', yOffset = 1.2 } = options;

    const ordered = rows.slice();
    if (sortKey) {
      ordered.sort((a, b) => {
        const av = a[sortKey] ?? 0;
        const bv = b[sortKey] ?? 0;
        if (typeof av === 'number' && typeof bv === 'number') {
          return sortDirection === 'asc' ? av - bv : bv - av;
        }
        return sortDirection === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    }

    const n = ordered.length || 1;
    const cols = Math.ceil(Math.cbrt(n));
    const layers = Math.ceil(n / (cols * cols));
    const out = [];

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

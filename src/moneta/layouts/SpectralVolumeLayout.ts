import * as THREE from 'three';
import { LayoutBase } from './LayoutBase.ts';
import type { LayoutEntry } from '../types.ts';

export interface SpectralVolumeOptions {
  radialScale?: number;
  heightScale?: number;
  powerScale?: number;
  yOffset?: number;
  frequencyKey?: string;
  powerKey?: string;
  phaseKey?: string;
  timeKey?: string;
}

export class SpectralVolumeLayout extends LayoutBase {
  static compute<T = Record<string, unknown>>(
    rows: T[] = [],
    options: SpectralVolumeOptions = {}
  ): LayoutEntry<T>[] {
    const {
      radialScale = 3.0,
      heightScale = 2.0,
      powerScale,
      yOffset = 1.0,
      frequencyKey = 'frequency',
      powerKey = 'power',
      phaseKey = 'phase',
    } = options;
    const effectiveHeightScale = powerScale ?? heightScale;

    const n = rows.length || 1;
    const out: LayoutEntry<T>[] = [];

    for (let i = 0; i < n; i++) {
      const row = rows[i] as Record<string, unknown>;
      const freq = typeof row[frequencyKey] === 'number' ? (row[frequencyKey] as number) : (i + 1) / n;
      const power = typeof row[powerKey] === 'number' ? (row[powerKey] as number) : 1.0;
      const phase = typeof row[phaseKey] === 'number' ? (row[phaseKey] as number) : (2 * Math.PI * i) / n;

      const r = freq * radialScale;
      const x = r * Math.cos(phase);
      const z = r * Math.sin(phase);
      const y = power * effectiveHeightScale + yOffset;

      out.push({
        position: new THREE.Vector3(x, y, z),
        row: rows[i],
        index: i,
      });
    }

    return out;
  }
}

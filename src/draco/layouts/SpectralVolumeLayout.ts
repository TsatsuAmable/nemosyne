import * as THREE from 'three';
import { LayoutBase } from './LayoutBase.ts';
import type { LayoutEntry } from '../types.ts';

export interface SpectralVolumeOptions {
  frequencyKey?: string;
  powerKey?: string;
  timeKey?: string;
  freqSpacing?: number;
  powerScale?: number;
  timeSpacing?: number;
  yOffset?: number;
}

/**
 * Lay data points out in a 3D spectral volume:
 * - X-axis: frequency bins
 * - Y-axis: spectral power / amplitude
 * - Z-axis: temporal window / harmonics
 */
export class SpectralVolumeLayout extends LayoutBase {
  static compute<T = Record<string, unknown>>(
    rows: T[] = [],
    options: SpectralVolumeOptions = {}
  ): LayoutEntry<T>[] {
    const {
      frequencyKey = 'freq',
      powerKey = 'power',
      timeKey = 'time',
      freqSpacing = 0.5,
      powerScale = 2.0,
      timeSpacing = 0.8,
      yOffset = 1.2,
    } = options;

    if (!rows.length) return [];

    const n = rows.length;
    const out: LayoutEntry<T>[] = [];

    const cols = Math.ceil(Math.sqrt(n));
    const depth = Math.ceil(n / cols);

    for (let i = 0; i < n; i++) {
      const row = rows[i] as Record<string, unknown>;
      const freqVal = typeof row[frequencyKey] === 'number' ? (row[frequencyKey] as number) : (i % cols);
      const powerVal = typeof row[powerKey] === 'number' ? (row[powerKey] as number) : 1.0;
      const timeVal = typeof row[timeKey] === 'number' ? (row[timeKey] as number) : Math.floor(i / cols);

      const x = (freqVal - (cols - 1) / 2) * freqSpacing;
      const y = powerVal * powerScale + yOffset;
      const z = (timeVal - (depth - 1) / 2) * timeSpacing;

      out.push({
        position: new THREE.Vector3(x, y, z),
        row: rows[i],
        index: i,
      });
    }

    return out;
  }
}

import * as THREE from 'three';
import { LayoutBase, requireKernelLayoutPositions } from './LayoutBase.ts';
import type { LayoutEntry } from '../types.ts';
import { computeSpectralVolume3d } from '../../wasm/LayoutAuthorityBridge.ts';

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
    if (rows.length === 0) return [];

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
    const count = rows.length;

    const frequencies = rows.map((row, index) => {
      const value = (row as Record<string, unknown>)[frequencyKey];
      return typeof value === 'number' ? value : (index + 1) / count;
    });
    const powers = rows.map((row) => {
      const value = (row as Record<string, unknown>)[powerKey];
      return typeof value === 'number' ? value : 1.0;
    });
    const phases = rows.map((row, index) => {
      const value = (row as Record<string, unknown>)[phaseKey];
      return typeof value === 'number' ? value : (2 * Math.PI * index) / count;
    });

    const positions = requireKernelLayoutPositions(
      'SpectralVolumeLayout',
      computeSpectralVolume3d(
        frequencies,
        powers,
        phases,
        radialScale,
        effectiveHeightScale,
        yOffset,
      ),
      count * 3,
    );

    return rows.map((row, index) => ({
      position: new THREE.Vector3(
        positions[index * 3],
        positions[index * 3 + 1],
        positions[index * 3 + 2],
      ),
      row,
      index,
    }));
  }
}

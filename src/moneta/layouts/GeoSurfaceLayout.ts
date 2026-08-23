import * as THREE from 'three';
import { LayoutBase, requireKernelLayoutPositions } from './LayoutBase.ts';
import type { GeoEntry } from '../types.ts';
import { computeGeoSurface3d } from '../../wasm/RuntimeBridge.ts';

export interface GeoSurfaceOptions {
  latKey?: string;
  lonKey?: string;
  valueKey?: string;
  roomWidth?: number;
  roomDepth?: number;
  heightScale?: number;
  yOffset?: number;
}

export class GeoSurfaceLayout extends LayoutBase {
  static compute<T = Record<string, unknown>>(
    rows: T[] = [],
    options: GeoSurfaceOptions = {}
  ): GeoEntry<T>[] {
    if (rows.length === 0) return [];

    const {
      latKey = 'lat', lonKey = 'lon', valueKey = 'value',
      roomWidth = 6.0, roomDepth = 6.0, heightScale = 1.2, yOffset = 0.5,
    } = options;

    const lats = rows.map((r, i) => {
      const value = (r as Record<string, unknown>)[latKey];
      return typeof value === 'number' ? value : (i % 10) * 5;
    });
    const lons = rows.map((r, i) => {
      const value = (r as Record<string, unknown>)[lonKey];
      return typeof value === 'number' ? value : Math.floor(i / 10) * 5;
    });
    const values = rows.map((r) => {
      const value = (r as Record<string, unknown>)[valueKey];
      return typeof value === 'number' ? value : 0;
    });

    const wasmPositions = requireKernelLayoutPositions(
      'GeoSurfaceLayout',
      computeGeoSurface3d(lons, lats, values, roomWidth, roomDepth, heightScale, yOffset),
      rows.length * 3,
    );

    return rows.map((row, i) => ({
      position: new THREE.Vector3(
        wasmPositions[i * 3], wasmPositions[i * 3 + 1], wasmPositions[i * 3 + 2],
      ),
      row,
      index: i,
      lat: lats[i],
      lon: lons[i],
      value: values[i],
    }));
  }
}

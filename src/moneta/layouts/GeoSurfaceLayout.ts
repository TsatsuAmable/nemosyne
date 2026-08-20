import * as THREE from 'three';
import { LayoutBase, warnKernelLayoutUnavailable } from './LayoutBase.ts';
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
    const {
      latKey = 'lat',
      lonKey = 'lon',
      valueKey = 'value',
      roomWidth = 6.0,
      roomDepth = 6.0,
      heightScale = 1.2,
      yOffset = 0.5,
    } = options;

    const n = rows.length || 1;

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;

    const lats = new Float64Array(rows.length);
    const lons = new Float64Array(rows.length);
    const vals = new Float64Array(rows.length);

    rows.forEach((r, i) => {
      const rec = r as Record<string, unknown>;
      const lat = typeof rec[latKey] === 'number' ? (rec[latKey] as number) : (i % 10) * 5;
      const lon =
        typeof rec[lonKey] === 'number' ? (rec[lonKey] as number) : Math.floor(i / 10) * 5;
      const v = typeof rec[valueKey] === 'number' ? (rec[valueKey] as number) : 0;

      lats[i] = lat;
      lons[i] = lon;
      vals[i] = v;

      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    });

    const wasmPositions = computeGeoSurface3d(
      Array.from(lons),
      Array.from(lats),
      Array.from(vals),
      roomWidth,
      roomDepth,
      heightScale,
      yOffset
    );
    if (wasmPositions && wasmPositions.length === n * 3) {
      return rows.map((row, i) => {
        const rec = row as Record<string, unknown>;
        const lat = typeof rec[latKey] === 'number' ? (rec[latKey] as number) : 0;
        const lon = typeof rec[lonKey] === 'number' ? (rec[lonKey] as number) : 0;
        const v = typeof rec[valueKey] === 'number' ? (rec[valueKey] as number) : 0;

        return {
          position: new THREE.Vector3(
            wasmPositions[i * 3 + 0],
            wasmPositions[i * 3 + 1],
            wasmPositions[i * 3 + 2]
          ),
          row,
          index: i,
          lat,
          lon,
          value: v,
        };
      });
    }

    warnKernelLayoutUnavailable('GeoSurfaceLayout');
    const latSpan = maxLat - minLat || 1;
    const lonSpan = maxLon - minLon || 1;
    const vSpan = maxV - minV || 1;

    return rows.map((row, i) => {
      const rec = row as Record<string, unknown>;
      const lat = typeof rec[latKey] === 'number' ? (rec[latKey] as number) : 0;
      const lon = typeof rec[lonKey] === 'number' ? (rec[lonKey] as number) : 0;
      const v = typeof rec[valueKey] === 'number' ? (rec[valueKey] as number) : 0;

      const normLon = (lon - minLon) / lonSpan;
      const normLat = (lat - minLat) / latSpan;
      const normV = (v - minV) / vSpan;

      const x = (normLon - 0.5) * roomWidth;
      const z = (normLat - 0.5) * roomDepth;
      const y = normV * heightScale + yOffset;

      return {
        position: new THREE.Vector3(x, y, z),
        row,
        index: i,
        lat,
        lon,
        value: v,
      };
    });
  }
}

import * as THREE from 'three';
import { LayoutBase } from './LayoutBase.ts';
import type { GeoEntry, GeoSurfaceOptions, LayoutEntry } from '../types.ts';
import { computeGeoSurface3d } from '../../wasm/RuntimeBridge.ts';

/**
 * Map geospatial rows (lat/lon + numeric value) to room-scale positions.
 *
 * Defaults:
 *   x = longitude mapped to [-roomWidth/2, roomWidth/2]
 *   z = latitude mapped to [-roomDepth/2, roomDepth/2]
 *   y = value * heightScale + yOffset
 */
export class GeoSurfaceLayout extends LayoutBase {
  static compute<T = Record<string, unknown>>(
    rows: T[] = [],
    options: GeoSurfaceOptions = {}
  ): LayoutEntry<T>[] {
    const {
      lonKey = this._findField(rows, /lon|longitude|x/i),
      latKey = this._findField(rows, /lat|latitude|y/i),
      valueKey,
      roomWidth = 6,
      roomDepth = 3,
      heightScale = 0.05,
      yOffset = 0.5,
    } = options;

    const out: GeoEntry<T>[] = [];

    const longitudes = rows.map((r) => Number((r as Record<string, unknown>)[lonKey as string]));
    const latitudes = rows.map((r) => Number((r as Record<string, unknown>)[latKey as string]));
    const values = rows.map((r) => (valueKey ? Number((r as Record<string, unknown>)[valueKey]) || 0 : 0));

    const wasmPositions = computeGeoSurface3d(
      longitudes,
      latitudes,
      values,
      roomWidth,
      roomDepth,
      heightScale,
      yOffset
    );

    if (wasmPositions && wasmPositions.length === rows.length * 3) {
      for (let i = 0; i < rows.length; i++) {
        out.push({
          position: new THREE.Vector3(
            wasmPositions[i * 3 + 0],
            wasmPositions[i * 3 + 1],
            wasmPositions[i * 3 + 2]
          ),
          row: rows[i],
          index: i,
          lon: longitudes[i],
          lat: latitudes[i],
          value: values[i],
        });
      }
      return out;
    }

    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minVal = Infinity;
    let maxVal = -Infinity;
    for (const row of rows) {
      const lon = Number((row as Record<string, unknown>)[lonKey as string]);
      const lat = Number((row as Record<string, unknown>)[latKey as string]);
      const val = valueKey ? Number((row as Record<string, unknown>)[valueKey]) : NaN;
      if (Number.isFinite(lon)) {
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
      }
      if (Number.isFinite(lat)) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
      if (Number.isFinite(val)) {
        minVal = Math.min(minVal, val);
        maxVal = Math.max(maxVal, val);
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lon = Number((row as Record<string, unknown>)[lonKey as string]);
      const lat = Number((row as Record<string, unknown>)[latKey as string]);
      const value = valueKey ? Number((row as Record<string, unknown>)[valueKey]) || 0 : 0;

      let x = 0;
      let z = 0;
      if (Number.isFinite(lon) && minLon <= maxLon) {
        const nx = (lon - minLon) / (maxLon - minLon);
        x = (nx - 0.5) * roomWidth;
      }
      if (Number.isFinite(lat) && minLat <= maxLat) {
        const nz = (lat - minLat) / (maxLat - minLat);
        z = (nz - 0.5) * roomDepth;
      }

      const normalizedY =
        minVal < maxVal && Number.isFinite(value)
          ? ((value - minVal) / (maxVal - minVal)) * (heightScale * (maxVal - minVal))
          : value * heightScale;
      const y = yOffset + Math.max(0, normalizedY);

      out.push({
        position: new THREE.Vector3(x, y, z),
        row,
        index: i,
        lon,
        lat,
        value,
      });
    }

    return out;
  }

  static _findField<T>(rows: T[], pattern: RegExp): string | undefined {
    if (!rows.length) return undefined;
    const keys = Object.keys(rows[0] as Record<string, unknown>);
    return keys.find((k) => pattern.test(k));
  }
}

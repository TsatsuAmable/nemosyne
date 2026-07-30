import * as THREE from 'three';
import { LayoutBase } from './LayoutBase.js';

/**
 * Map geospatial rows (lat/lon + numeric value) to room-scale positions.
 *
 * Defaults:
 *   x = longitude mapped to [-roomWidth/2, roomWidth/2]
 *   z = latitude mapped to [-roomDepth/2, roomDepth/2]
 *   y = value * heightScale + yOffset
 */
export class GeoSurfaceLayout extends LayoutBase {
  static compute(rows = [], options = {}) {
    const {
      lonKey = this._findField(rows, /lon|longitude|x/i),
      latKey = this._findField(rows, /lat|latitude|y/i),
      valueKey,
      roomWidth = 6,
      roomDepth = 3,
      heightScale = 0.05,
      yOffset = 0.5,
    } = options;

    const out = [];

    // Discover lat/lon ranges to normalize.
    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const row of rows) {
      const lon = Number(row[lonKey]);
      const lat = Number(row[latKey]);
      if (Number.isFinite(lon)) {
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
      }
      if (Number.isFinite(lat)) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lon = Number(row[lonKey]);
      const lat = Number(row[latKey]);
      const value = valueKey ? Number(row[valueKey]) || 0 : 0;

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

      const y = yOffset + Math.max(0, value * heightScale);

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

  static _findField(rows, pattern) {
    if (!rows.length) return undefined;
    const keys = Object.keys(rows[0]);
    return keys.find((k) => pattern.test(k));
  }
}

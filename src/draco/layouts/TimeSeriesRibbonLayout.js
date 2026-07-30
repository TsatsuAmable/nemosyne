import * as THREE from 'three';
import { LayoutBase } from './LayoutBase.js';

/**
 * Lay time-series rows out as 3D ribbons. Each series (grouped by seriesKey)
 * becomes a separate ribbon offset in z.
 */
export class TimeSeriesRibbonLayout extends LayoutBase {
  static compute(rows = [], options = {}) {
    const {
      timeKey = 'time',
      valueKey = 'value',
      seriesKey = 'sensorId',
      xScale = 0.8,
      yScale = 0.2,
      zSpacing = 1.5,
      yOffset = 1.2,
    } = options;

    if (!rows.length) return [];

    // Group by series.
    const series = {};
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const id = row[seriesKey] ?? 'S';
      if (!series[id]) series[id] = [];
      series[id].push({ row, index: i });
    }

    const ids = Object.keys(series);
    const out = [];

    ids.forEach((id, sIdx) => {
      const sorted = series[id]
        .slice()
        .sort((a, b) => this._timeValue(a.row[timeKey]) - this._timeValue(b.row[timeKey]));

      const z = sIdx * zSpacing - ((ids.length - 1) * zSpacing) / 2;

      sorted.forEach((item, idx) => {
        const value = Number(item.row[valueKey]) || 0;
        const x = idx * xScale - ((sorted.length - 1) * xScale) / 2;
        const y = yOffset + value * yScale;
        out.push({
          position: new THREE.Vector3(x, y, z),
          row: item.row,
          index: item.index,
          seriesId: id,
          seriesIndex: sIdx,
          pointIndex: idx,
        });
      });
    });

    return out;
  }

  static _timeValue(t) {
    if (t == null) return 0;
    const n = Number(t);
    if (Number.isFinite(n)) return n;
    const d = new Date(t).getTime();
    return Number.isFinite(d) ? d : 0;
  }
}

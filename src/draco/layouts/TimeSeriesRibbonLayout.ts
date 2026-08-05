import * as THREE from 'three';
import { LayoutBase } from './LayoutBase.ts';
import type { LayoutEntry, TimeSeriesEntry, TimeSeriesRibbonOptions } from '../types.ts';

/**
 * Lay time-series rows out as 3D ribbons. Each series (grouped by seriesKey)
 * becomes a separate ribbon offset in z.
 */
export class TimeSeriesRibbonLayout extends LayoutBase {
  static compute<T = Record<string, unknown>>(
    rows: T[] = [],
    options: TimeSeriesRibbonOptions = {}
  ): LayoutEntry<T>[] {
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

    const series: Record<string | number, { row: T; index: number }[]> = {};
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const id = ((row as Record<string, unknown>)[seriesKey] as string | number) ?? 'S';
      if (!series[id]) series[id] = [];
      series[id].push({ row, index: i });
    }

    const ids = Object.keys(series);
    const out: TimeSeriesEntry<T>[] = [];

    ids.forEach((id, sIdx) => {
      const sorted = series[id]
        .slice()
        .sort(
          (a, b) =>
            this._timeValue((a.row as Record<string, unknown>)[timeKey]) -
            this._timeValue((b.row as Record<string, unknown>)[timeKey])
        );

      const z = sIdx * zSpacing - ((ids.length - 1) * zSpacing) / 2;

      sorted.forEach((item, idx) => {
        const value = Number((item.row as Record<string, unknown>)[valueKey]) || 0;
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

  static _timeValue(t: unknown): number {
    if (t == null) return 0;
    const n = Number(t);
    if (Number.isFinite(n)) return n;
    const d = new Date(t as string | number | Date).getTime();
    return Number.isFinite(d) ? d : 0;
  }
}

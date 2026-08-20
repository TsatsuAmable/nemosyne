import * as THREE from 'three';
import { LayoutBase, warnKernelLayoutUnavailable } from './LayoutBase.ts';
import type { TimeSeriesEntry } from '../types.ts';
import { computeTimeRibbon3d } from '../../wasm/RuntimeBridge.ts';

export interface TimeSeriesRibbonOptions {
  timeKey?: string;
  valueKey?: string;
  seriesKey?: string;
  xScale?: number;
  yScale?: number;
  zSpacing?: number;
  yOffset?: number;
}

export class TimeSeriesRibbonLayout extends LayoutBase {
  static compute<T = Record<string, unknown>>(
    rows: T[] = [],
    options: TimeSeriesRibbonOptions = {}
  ): TimeSeriesEntry<T>[] {
    if (!rows.length) return [];

    // Auto-detect keys if default is not in first row
    const first = rows[0] as Record<string, unknown>;
    const timeKey =
      options.timeKey ??
      ('time' in first ? 'time' : 'timestamp' in first ? 'timestamp' : 'date' in first ? 'date' : 'time');
    const valueKey =
      options.valueKey ??
      ('value' in first ? 'value' : 'val' in first ? 'val' : 'temperature' in first ? 'temperature' : 'value');
    const seriesKey =
      options.seriesKey ??
      ('sensorId' in first ? 'sensorId' : 'series' in first ? 'series' : 'seriesId' in first ? 'seriesId' : 'series');

    const {
      xScale = 0.08,
      yScale = 2.5,
      zSpacing = 1.2,
      yOffset = 0.4,
    } = options;

    const parseTime = (val: unknown, fallbackIdx: number): number => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const parsed = Date.parse(val);
        if (!isNaN(parsed)) return parsed;
      }
      return fallbackIdx;
    };

    // Group rows by series
    const seriesGroups = new Map<string, Array<{ row: T; origIndex: number; timeVal: number; numVal: number }>>();
    rows.forEach((r, i) => {
      const rec = r as Record<string, unknown>;
      const s = rec[seriesKey] !== undefined ? String(rec[seriesKey]) : 'default';
      const timeVal = parseTime(rec[timeKey], i);
      const numVal = typeof rec[valueKey] === 'number' ? (rec[valueKey] as number) : 0;

      if (!seriesGroups.has(s)) {
        seriesGroups.set(s, []);
      }
      seriesGroups.get(s)!.push({ row: r, origIndex: i, timeVal, numVal });
    });

    // Sort each group by time
    for (const group of seriesGroups.values()) {
      group.sort((a, b) => a.timeVal - b.timeVal);
    }

    const n = rows.length;
    const seriesArr = new Uint32Array(n);
    const timesArr = new Float64Array(n);
    const valuesArr = new Float64Array(n);

    let idx = 0;
    let sIdx = 0;
    for (const group of seriesGroups.values()) {
      for (const item of group) {
        seriesArr[idx] = sIdx;
        timesArr[idx] = item.timeVal;
        valuesArr[idx] = item.numVal;
        idx++;
      }
      sIdx++;
    }

    const wasmPositions = computeTimeRibbon3d(
      Array.from(seriesArr),
      Array.from(timesArr),
      Array.from(valuesArr),
      xScale,
      yScale,
      zSpacing,
      yOffset
    );

    if (wasmPositions && wasmPositions.length === n * 3) {
      const out: TimeSeriesEntry<T>[] = [];
      let globalIdx = 0;
      let seriesIndex = 0;

      for (const [seriesId, group] of seriesGroups.entries()) {
        group.forEach((item, pointIndex) => {
          out.push({
            position: new THREE.Vector3(
              wasmPositions[globalIdx * 3 + 0],
              wasmPositions[globalIdx * 3 + 1],
              wasmPositions[globalIdx * 3 + 2]
            ),
            row: item.row,
            index: item.origIndex,
            pointIndex,
            seriesIndex,
            seriesId,
            timestamp: item.timeVal,
            value: item.numVal,
          });
          globalIdx++;
        });
        seriesIndex++;
      }
      return out;
    }

    warnKernelLayoutUnavailable('TimeSeriesRibbonLayout');
    const out: TimeSeriesEntry<T>[] = [];
    let seriesIndex = 0;

    for (const [seriesId, group] of seriesGroups.entries()) {
      const minT = group[0]?.timeVal ?? 0;
      const maxT = group[group.length - 1]?.timeVal ?? minT;
      const tSpan = maxT - minT || 1;

      group.forEach((item, pointIndex) => {
        const normT = (item.timeVal - minT) / tSpan;
        const x = (normT - 0.5) * group.length * xScale;
        const y = item.numVal * yScale + yOffset;
        const z = (seriesIndex - (seriesGroups.size - 1) / 2) * zSpacing;

        out.push({
          position: new THREE.Vector3(x, y, z),
          row: item.row,
          index: item.origIndex,
          pointIndex,
          seriesIndex,
          seriesId,
          timestamp: item.timeVal,
          value: item.numVal,
        });
      });
      seriesIndex++;
    }

    return out;
  }
}

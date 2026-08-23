import * as THREE from 'three';
import { LayoutBase, requireKernelLayoutPositions } from './LayoutBase.ts';
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

    const first = rows[0] as Record<string, unknown>;
    const timeKey = options.timeKey ?? ('time' in first ? 'time' : 'timestamp' in first ? 'timestamp' : 'date' in first ? 'date' : 'time');
    const valueKey = options.valueKey ?? ('value' in first ? 'value' : 'val' in first ? 'val' : 'temperature' in first ? 'temperature' : 'value');
    const seriesKey = options.seriesKey ?? ('sensorId' in first ? 'sensorId' : 'series' in first ? 'series' : 'seriesId' in first ? 'seriesId' : 'series');
    const { xScale = 0.08, yScale = 2.5, zSpacing = 1.2, yOffset = 0.4 } = options;

    const parseTime = (value: unknown, fallbackIdx: number): number => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
      }
      return fallbackIdx;
    };

    const groups = new Map<string, Array<{ row: T; origIndex: number; timeVal: number; numVal: number }>>();
    rows.forEach((row, i) => {
      const rec = row as Record<string, unknown>;
      const seriesId = rec[seriesKey] !== undefined ? String(rec[seriesKey]) : 'default';
      const bucket = groups.get(seriesId) ?? [];
      bucket.push({
        row,
        origIndex: i,
        timeVal: parseTime(rec[timeKey], i),
        numVal: typeof rec[valueKey] === 'number' ? rec[valueKey] as number : 0,
      });
      groups.set(seriesId, bucket);
    });
    for (const group of groups.values()) group.sort((a, b) => a.timeVal - b.timeVal);

    const seriesIds: number[] = [];
    const timestamps: number[] = [];
    const values: number[] = [];
    let seriesIndex = 0;
    for (const group of groups.values()) {
      for (const item of group) {
        seriesIds.push(seriesIndex);
        timestamps.push(item.timeVal);
        values.push(item.numVal);
      }
      seriesIndex++;
    }

    const wasmPositions = requireKernelLayoutPositions(
      'TimeSeriesRibbonLayout',
      computeTimeRibbon3d(seriesIds, timestamps, values, xScale, yScale, zSpacing, yOffset),
      rows.length * 3,
    );

    const out: TimeSeriesEntry<T>[] = [];
    let globalIndex = 0;
    seriesIndex = 0;
    for (const [seriesId, group] of groups.entries()) {
      group.forEach((item, pointIndex) => {
        out.push({
          position: new THREE.Vector3(
            wasmPositions[globalIndex * 3],
            wasmPositions[globalIndex * 3 + 1],
            wasmPositions[globalIndex * 3 + 2],
          ),
          row: item.row,
          index: item.origIndex,
          pointIndex,
          seriesIndex,
          seriesId,
          timestamp: item.timeVal,
          value: item.numVal,
        });
        globalIndex++;
      });
      seriesIndex++;
    }
    return out;
  }
}

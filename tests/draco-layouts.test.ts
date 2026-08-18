// @ts-nocheck
// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import {
  GridLayout3D,
  ForceDirected3D,
  RadialTreeLayout,
  TimeSeriesRibbonLayout,
  StreamlineLayout,
  GeoSurfaceLayout,
} from '../src/draco/layouts/index.ts';

describe('Draco layout generators', () => {
  it('GridLayout3D packs rows into a cube', () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({ id: `r${i}`, value: i }));
    const layout = GridLayout3D.compute(rows, { spacing: 1 });

    expect(layout.length).toBe(8);
    for (const p of layout) {
      expect(p.position).toBeInstanceOf(THREE.Vector3);
    }
    // With 8 rows we get a 2x2x2 grid; extents should be -0.5..0.5 in each axis (plus yOffset).
    const xs = layout.map((p) => p.position.x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(-0.5, 5);
    expect(xs[xs.length - 1]).toBeCloseTo(0.5, 5);
  });

  it('GridLayout3D supports sorting by key', () => {
    const rows = [{ v: 30 }, { v: 10 }, { v: 20 }];
    const layout = GridLayout3D.compute(rows, { sortKey: 'v' });
    expect(layout[0].row.v).toBe(10);
    expect(layout[2].row.v).toBe(30);

    const desc = GridLayout3D.compute(rows, { sortKey: 'v', sortDirection: 'desc' });
    expect(desc[0].row.v).toBe(30);
    expect(desc[2].row.v).toBe(10);
  });

  it('ForceDirected3D returns a position per row', () => {
    const rows = [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }];
    const edges = [
      { source: 'A', target: 'B' },
      { source: 'B', target: 'C' },
      { source: 'C', target: 'D' },
    ];
    const layout = ForceDirected3D.compute(rows, { edges, iterations: 30 });

    expect(layout.length).toBe(4);
    for (const p of layout) {
      expect(Number.isFinite(p.position.x)).toBe(true);
    }
  });

  it('RadialTreeLayout places rows on rings by level', () => {
    const rows = [
      { name: 'root', level: 0 },
      { name: 'a', level: 1 },
      { name: 'b', level: 1 },
      { name: 'aa', level: 2 },
    ];
    const layout = RadialTreeLayout.compute(rows);

    expect(layout.length).toBe(4);
    const root = layout.find((p) => p.row.name === 'root');
    const level1 = layout.filter((p) => p.row.level === 1);
    const level2 = layout.find((p) => p.row.name === 'aa');

    expect(root.position.x).toBeCloseTo(0, 5);
    expect(root.position.z).toBeCloseTo(0, 5);
    for (const n of level1) {
      const horizontal = Math.sqrt(n.position.x ** 2 + n.position.z ** 2);
      expect(horizontal).toBeGreaterThan(1.5);
      expect(horizontal).toBeLessThan(2.1);
    }
    const level2Horizontal = Math.sqrt(level2.position.x ** 2 + level2.position.z ** 2);
    expect(level2Horizontal).toBeGreaterThan(3.5);
  });

  it('RadialTreeLayout links parentKey children to parents', () => {
    const rows = [
      { id: 1, level: 0 },
      { id: 2, level: 1, parentId: 1 },
      { id: 3, level: 1, parentId: 1 },
    ];
    const layout = RadialTreeLayout.compute(rows, { parentKey: 'parentId' });

    const child = layout.find((p) => p.row.id === 2);
    const root = layout.find((p) => p.row.id === 1);
    expect(child.parentIndex).toBe(root.index);
  });

  it('RadialTreeLayout falls back to nearest parent when no parentKey is given', () => {
    const rows = [
      { id: 1, level: 0 },
      { id: 2, level: 1 },
      { id: 3, level: 1 },
      { id: 4, level: 2 },
    ];
    const layout = RadialTreeLayout.compute(rows);

    const level2 = layout.find((p) => p.row.id === 4);
    expect(typeof level2.parentIndex).toBe('number');
    const parent = layout[level2.parentIndex];
    expect(parent.row.level).toBe(1);
  });

  it('RadialTreeLayout treats a missing levelKey as zero', () => {
    const rows = [{ id: 1 }, { id: 2 }];
    const layout = RadialTreeLayout.compute(rows);

    expect(layout.length).toBe(2);
    expect(layout.every((p) => p.position.x === 0 && p.position.z === 0)).toBe(true);
  });

  it('TimeSeriesRibbonLayout groups by series and sorts by time', () => {
    const rows = [
      { time: '2026-07-28T02:00:00', sensorId: 'S1', value: 3 },
      { time: '2026-07-28T00:00:00', sensorId: 'S1', value: 1 },
      { time: '2026-07-28T01:00:00', sensorId: 'S1', value: 2 },
      { time: '2026-07-28T00:00:00', sensorId: 'S2', value: 10 },
    ];
    const layout = TimeSeriesRibbonLayout.compute(rows);

    const s1 = layout
      .filter((p) => p.seriesId === 'S1')
      .sort((a, b) => a.pointIndex - b.pointIndex);
    expect(s1.length).toBe(3);
    expect(s1[0].row.value).toBe(1);
    expect(s1[1].row.value).toBe(2);
    expect(s1[2].row.value).toBe(3);
    expect(s1[0].position.x).toBeLessThan(s1[1].position.x);

    const s2 = layout.find((p) => p.seriesId === 'S2');
    expect(s2.position.z).not.toBeCloseTo(s1[0].position.z, 2);
  });

  it('StreamlineLayout emits paths', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: i }));
    const layout = StreamlineLayout.compute(rows, { count: 5, steps: 3 });

    expect(layout.length).toBe(5);
    for (const p of layout) {
      expect(Array.isArray(p.points)).toBe(true);
      expect(p.points.length).toBe(4); // start + 3 steps
    }
  });

  it('GeoSurfaceLayout maps lat/lon to room-scale x/z', () => {
    const rows = [
      { lon: -180, lat: -90, value: 0 },
      { lon: 180, lat: 90, value: 100 },
      { lon: 0, lat: 0, value: 50 },
    ];
    const layout = GeoSurfaceLayout.compute(rows, {
      valueKey: 'value',
      roomWidth: 6,
      roomDepth: 3,
    });

    const sw = layout.find((p) => p.lon === -180 && p.lat === -90);
    const ne = layout.find((p) => p.lon === 180 && p.lat === 90);
    const mid = layout.find((p) => p.lon === 0 && p.lat === 0);

    expect(sw.position.x).toBeCloseTo(-3, 5);
    expect(sw.position.z).toBeCloseTo(-1.5, 5);
    expect(ne.position.x).toBeCloseTo(3, 5);
    expect(ne.position.z).toBeCloseTo(1.5, 5);
    expect(mid.position.x).toBeCloseTo(0, 5);
    expect(mid.position.z).toBeCloseTo(0, 5);

    expect(ne.position.y).toBeGreaterThan(mid.position.y);
    expect(mid.position.y).toBeGreaterThan(sw.position.y);
  });
});

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { GridLayout3D } from '../src/draco/layouts/GridLayout3D.ts';
import { ForceDirected3D } from '../src/draco/layouts/ForceDirected3D.ts';
import { RadialTreeLayout } from '../src/draco/layouts/RadialTreeLayout.ts';
import { TimeSeriesRibbonLayout } from '../src/draco/layouts/TimeSeriesRibbonLayout.ts';
import { GeoSurfaceLayout } from '../src/draco/layouts/GeoSurfaceLayout.ts';
import { StreamlineLayout } from '../src/draco/layouts/StreamlineLayout.ts';
import type { StreamlineEntry } from '../src/draco/types.ts';

describe('Spatial Layout Engines', () => {
  it('computes 3D grid layout coordinates for 8 items', () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ id: i }));
    const result = GridLayout3D.compute(items, { spacing: 1.1, yOffset: 1.2 });

    expect(result).toHaveLength(8);
    expect(result[0].position).toBeInstanceOf(THREE.Vector3);
    expect(result[0].position.y).toBeCloseTo(0.65);
  });

  it('computes force-directed layout coordinates for graph nodes', () => {
    const nodes = Array.from({ length: 5 }, (_, i) => ({ id: `n${i}` }));
    const edges = [{ source: 'n0', target: 'n1', weight: 1 }];

    const result = ForceDirected3D.compute(nodes, {
      edges,
      iterations: 20,
      radius: 4,
      yOffset: 1.2,
    });

    expect(result).toHaveLength(5);
    expect(result[0].position.x).not.toBeNaN();
    expect(result[0].position.y).not.toBeNaN();
  });

  it('computes radial tree layout coordinates for hierarchy levels', () => {
    const nodes = [
      { id: 'root', level: 0 },
      { id: 'child1', level: 1, parent: 'root' },
      { id: 'child2', level: 1, parent: 'root' },
    ];

    const result = RadialTreeLayout.compute(nodes, {
      levelKey: 'level',
      parentKey: 'parent',
      ringSpacing: 1.8,
      yStep: 0.8,
      yOffset: 1.2,
    });

    expect(result).toHaveLength(3);
    expect(result[0].position.x).toBeCloseTo(0.0);
    expect(result[0].position.y).toBeCloseTo(1.2);
    expect(result[0].position.z).toBeCloseTo(0.0);
  });

  it('computes time series ribbon layout coordinates for multi-series rows', () => {
    const rows = [
      { sensor: 'A', time: 10, val: 5 },
      { sensor: 'A', time: 20, val: 15 },
      { sensor: 'B', time: 10, val: 8 },
      { sensor: 'B', time: 20, val: 18 },
    ];

    const result = TimeSeriesRibbonLayout.compute(rows, {
      seriesKey: 'sensor',
      timeKey: 'time',
      valueKey: 'val',
      zSpacing: 1.5,
      yOffset: 1.2,
    });

    expect(result).toHaveLength(4);
    expect(result[0].position).toBeInstanceOf(THREE.Vector3);
  });

  it('computes geo surface layout coordinates for lat/lon points', () => {
    const rows = [
      { lon: -122.4, lat: 37.7, val: 100 },
      { lon: -74.0, lat: 40.7, val: 200 },
    ];

    const result = GeoSurfaceLayout.compute(rows, {
      lonKey: 'lon',
      latKey: 'lat',
      valueKey: 'val',
      roomWidth: 6,
      roomDepth: 3,
      yOffset: 0.5,
    });

    expect(result).toHaveLength(2);
    expect(result[0].position).toBeInstanceOf(THREE.Vector3);
  });

  it('computes streamline layout coordinates for vector fields', () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = StreamlineLayout.compute(rows, {
      count: 3,
      steps: 4,
      stepSize: 1.5,
      seed: 42,
    });

    expect(result).toHaveLength(3);
    expect((result[0] as unknown as StreamlineEntry).points).toHaveLength(5);
    expect(result[0].position).toBeInstanceOf(THREE.Vector3);
  });
});

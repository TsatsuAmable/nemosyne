import { describe, it, expect } from 'vitest';
import { mapper, persistenceIntervals, betti0Curve } from '../src/analytics/TDAMapper.ts';

describe('TDAMapper', () => {
  const rows = [
    { id: 1, x: 0, y: 0 },
    { id: 2, x: 0.1, y: 0 },
    { id: 3, x: 10, y: 0 },
    { id: 4, x: 10.1, y: 0 },
    { id: 5, x: 5, y: 10 },
  ];
  const features = ['x', 'y'];
  const filter = (r: { x: number }) => r.x;

  it('mapper returns nodes and edges for separable clusters', () => {
    const graph = mapper(rows, features, filter, 3, 0.3, 'single');
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(Array.isArray(graph.edges)).toBe(true);
    for (const node of graph.nodes) {
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('rows');
      expect(node).toHaveProperty('center');
      expect(node).toHaveProperty('filterCenter');
    }
  });

  it('mapper returns empty graph for empty rows', () => {
    const graph = mapper([], features, filter);
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });

  it('persistenceIntervals returns intervals with birth values', () => {
    const intervals = persistenceIntervals(rows, filter, features, 2);
    expect(intervals.length).toBeGreaterThan(0);
    for (const interval of intervals) {
      expect(typeof interval.birth).toBe('number');
      expect(interval.death === null || typeof interval.death === 'number').toBe(true);
    }
  });

  it('persistenceIntervals handles empty rows', () => {
    expect(persistenceIntervals([], filter, features)).toEqual([]);
  });

  it('betti0Curve decreases from many components toward one', () => {
    const curve = betti0Curve(rows, features, 10, 15);
    expect(curve.length).toBe(10);
    expect(curve[0].betti0).toBe(rows.length);
    expect(curve[curve.length - 1].betti0).toBe(1);
    expect(curve[0].radius).toBe(0);
    expect(curve[curve.length - 1].radius).toBe(15);
  });

  it('betti0Curve returns empty array for empty rows', () => {
    expect(betti0Curve([], features)).toEqual([]);
  });
});

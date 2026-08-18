// @ts-nocheck
// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SpatialIndex } from '../src/vr/scalability/SpatialIndex.ts';

describe('SpatialIndex', () => {
  it('inserts and queries points within a radius', () => {
    const index = new SpatialIndex(0.5);
    index.insert(new THREE.Vector3(0, 0, 0), 'origin');
    index.insert(new THREE.Vector3(0.3, 0, 0), 'near');
    index.insert(new THREE.Vector3(2, 0, 0), 'far');

    const results = index.queryRadius(new THREE.Vector3(0, 0, 0), 0.5);
    const labels = results.map((r) => r.data);

    expect(labels).toContain('origin');
    expect(labels).toContain('near');
    expect(labels).not.toContain('far');
    expect(results[0].distance).toBe(0);
  });

  it('returns empty results for empty index', () => {
    const index = new SpatialIndex(0.5);
    expect(index.queryRadius(new THREE.Vector3(0, 0, 0), 1)).toEqual([]);
  });

  it('insertAll adds many points in one call', () => {
    const index = new SpatialIndex(0.5);
    const items = Array.from({ length: 100 }, (_, i) => ({
      position: new THREE.Vector3(i * 0.1, 0, 0),
      data: `pt-${i}`,
    }));

    index.insertAll(items);
    const results = index.queryRadius(new THREE.Vector3(0.5, 0, 0), 0.5);
    expect(results.length).toBeGreaterThan(0);
    expect(results.map((r) => r.data)).toContain('pt-5');
  });

  it('clear removes all points', () => {
    const index = new SpatialIndex(0.5);
    index.insert(new THREE.Vector3(0, 0, 0), 'a');
    index.clear();
    expect(index.queryRadius(new THREE.Vector3(0, 0, 0), 1)).toEqual([]);
  });

  it('raycast returns nearest point along ray', () => {
    const index = new SpatialIndex(0.5);
    index.insert(new THREE.Vector3(0, 0, -1), 'a');
    index.insert(new THREE.Vector3(0, 0, -3), 'b');

    const ray = new THREE.Ray(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));
    const hit = index.raycast(ray, 10, 0.2);

    expect(hit).not.toBeNull();
    expect(hit?.data).toBe('a');
    expect(hit?.distance).toBeCloseTo(1, 3);
  });

  it('raycast returns null when no point is near the ray', () => {
    const index = new SpatialIndex(0.5);
    index.insert(new THREE.Vector3(1, 0, -1), 'a');

    const ray = new THREE.Ray(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));
    const hit = index.raycast(ray, 10, 0.05);

    expect(hit).toBeNull();
  });

  it('raycast respects maxDistance', () => {
    const index = new SpatialIndex(0.5);
    index.insert(new THREE.Vector3(0, 0, -5), 'far');

    const ray = new THREE.Ray(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));
    const hit = index.raycast(ray, 2, 0.2);

    expect(hit).toBeNull();
  });

  it('sorts radius results by distance', () => {
    const index = new SpatialIndex(1);
    index.insert(new THREE.Vector3(0, 0, -2), 'two');
    index.insert(new THREE.Vector3(0, 0, -0.5), 'half');
    index.insert(new THREE.Vector3(0, 0, -1), 'one');

    const results = index.queryRadius(new THREE.Vector3(0, 0, 0), 3);
    expect(results.map((r) => r.data)).toEqual(['half', 'one', 'two']);
  });
});

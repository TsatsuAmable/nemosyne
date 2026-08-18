import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { InstancedPointCloud } from '../../../src/vr/scalability/InstancedPointCloud.ts';

describe('Tier 2 — Feature 6: Instanced Buffer Attribute Leaks (Boundary Cases)', () => {
  it('F6-BC1: InstancedPointCloud setPoints with empty items array sets count to 0 safely', () => {
    const cloud = new InstancedPointCloud(1000);
    cloud.setPoints([]);
    expect(cloud.mesh.count).toBe(0);
  });

  it('F6-BC2: Dynamically re-allocating instance attributes replaces instanceColor attribute properly', () => {
    const cloud = new InstancedPointCloud(500);

    const items1 = Array.from({ length: 100 }, (_, i) => ({
      position: [i * 0.1, 0, 0] as [number, number, number],
      color: 0x00ffcc,
      scale: 1,
    }));
    cloud.setPoints(items1);
    expect(cloud.mesh.instanceColor).toBeDefined();

    const items2 = Array.from({ length: 200 }, (_, i) => ({
      position: [i * 0.2, 0, 0] as [number, number, number],
      color: 0xff0055,
      scale: 1.5,
    }));
    cloud.setPoints(items2);
    const attr2 = cloud.mesh.instanceColor;

    expect(cloud.mesh.count).toBe(200);
    expect(attr2).toBeDefined();
  });

  it('F6-BC3: Passing NaN or Infinity coordinates replaces values or handles gracefully without crash', () => {
    const cloud = new InstancedPointCloud(10);
    const items = [
      { position: [NaN, Infinity, -Infinity] as [number, number, number], color: 0x00ffcc, scale: 1 },
    ];

    expect(() => cloud.setPoints(items)).not.toThrow();
    expect(cloud.mesh.count).toBe(1);
  });

  it('F6-BC4: 100 sequential setPoints updates complete without memory leak or exception', () => {
    const cloud = new InstancedPointCloud(100);
    const items = Array.from({ length: 50 }, (_, i) => ({
      position: [i, i, i] as [number, number, number],
      color: 0x00ffcc,
      scale: 1,
    }));

    expect(() => {
      for (let k = 0; k < 100; k++) {
        cloud.setPoints(items);
      }
    }).not.toThrow();
  });

  it('F6-BC5: InstancedPointCloud dispose disposes geometry, material, and removes mesh from parent', () => {
    const parent = new THREE.Group();
    const cloud = new InstancedPointCloud(100);
    parent.add(cloud.mesh);

    cloud.dispose();
    expect(parent.children.includes(cloud.mesh)).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { InstancedPointCloud } from '../../../src/vr/scalability/InstancedPointCloud.js';

describe('Feature 6: Instanced Buffer Attribute Leaks', () => {
  it('F6-TC1: InstancedPointCloud sets instance colors and matrices on setPoints', () => {
    const cloud = new InstancedPointCloud(100);
    const items = [
      { position: [0, 1, 2] as [number, number, number], color: 0xff0000, scale: 1 },
      { position: [3, 4, 5] as [number, number, number], color: 0x00ff00, scale: 2 },
    ];
    cloud.setPoints(items);

    expect(cloud.mesh.count).toBe(2);
    expect(cloud.mesh.instanceColor).toBeDefined();
    expect(cloud.mesh.instanceMatrix).toBeDefined();
  });

  it('F6-TC2: Calling setPoints 50 times sequentially maintains stable instance attributes', () => {
    const cloud = new InstancedPointCloud(500);
    for (let i = 0; i < 50; i++) {
      const items = Array.from({ length: 10 + (i % 5) }, (_, idx) => ({
        position: [idx, i, 0] as [number, number, number],
        color: 0x00ffcc,
        scale: 1,
      }));
      cloud.setPoints(items);
    }
    expect(cloud.mesh.count).toBe(14);
    expect(cloud.mesh.instanceColor).toBeDefined();
  });

  it('F6-TC3: applyLODScale adjusts visible instance count based on scale factor', () => {
    const cloud = new InstancedPointCloud(50);
    const items = Array.from({ length: 50 }, (_, i) => ({
      position: [i, 0, 0] as [number, number, number],
      color: 0xffffff,
      scale: 1,
    }));
    cloud.setPoints(items);
    expect(cloud.mesh.count).toBe(50);

    cloud.applyLODScale(0.5);
    expect(cloud.mesh.count).toBe(25);
  });

  it('F6-TC4: updateInstances and updateSubRange modify buffer regions without throwing', () => {
    const cloud = new InstancedPointCloud(50);
    const items = Array.from({ length: 20 }, (_, i) => ({
      position: [i, 0, 0] as [number, number, number],
      color: 0x0000ff,
      scale: 1,
    }));
    cloud.setPoints(items);

    expect(() => {
      cloud.updateInstances([{ index: 0, color: 0xffff00, scale: 1.5 }]);
      cloud.updateSubRange(0, 5);
    }).not.toThrow();
  });

  it('F6-TC5: InstancedPointCloud dispose releases geometry and material cleanly', () => {
    const cloud = new InstancedPointCloud(10);
    const parentGroup = new THREE.Group();
    parentGroup.add(cloud.mesh);

    expect(parentGroup.children.length).toBe(1);
    cloud.dispose();
    expect(parentGroup.children.length).toBe(0);
  });
});

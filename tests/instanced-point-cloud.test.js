// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { InstancedPointCloud } from '../src/vr/scalability/InstancedPointCloud.js';

describe('InstancedPointCloud', () => {
  it('creates an InstancedMesh with the given max count', () => {
    const cloud = new InstancedPointCloud(100);
    expect(cloud.mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(cloud.mesh.count).toBe(0);
    expect(cloud.maxCount).toBe(100);
  });

  it('sets instance matrices, colors, and scales from items', () => {
    const cloud = new InstancedPointCloud(10);
    cloud.setPoints([
      { position: [0, 0, -1], color: 0xff0000, scale: 1.5, data: { id: 'a' } },
      { position: [1, 0, -2], color: 0x00ff00, scale: 0.5, data: { id: 'b' } },
    ]);

    expect(cloud.mesh.count).toBe(2);
    expect(cloud.mesh.instanceColor).toBeTruthy();

    const matrix = new THREE.Matrix4();
    cloud.mesh.getMatrixAt(0, matrix);
    const position = new THREE.Vector3().setFromMatrixPosition(matrix);
    expect(position.z).toBeCloseTo(-1, 3);
  });

  it('caps the visible count to maxCount', () => {
    const cloud = new InstancedPointCloud(5);
    const items = Array.from({ length: 20 }, (_, i) => ({
      position: [0, 0, -i],
      color: 0xffffff,
      scale: 1,
      data: { id: i },
    }));
    cloud.setPoints(items);
    expect(cloud.mesh.count).toBe(5);
  });

  it('updates colors and scales of individual instances', () => {
    const cloud = new InstancedPointCloud(10);
    cloud.setPoints([
      { position: [0, 0, -1], color: 0xffffff, scale: 1, data: { id: 'a' } },
    ]);

    cloud.updateInstances([{ index: 0, color: 0x0000ff, scale: 2 }]);

    expect(cloud._colors[0]).toBe(0);
    expect(cloud._colors[1]).toBe(0);
    expect(cloud._colors[2]).toBe(1);
    expect(cloud._scales[0]).toBe(2);
    expect(cloud.mesh.instanceColor).toBeTruthy();
  });

  it('returns instance data on raycast intersection', () => {
    const cloud = new InstancedPointCloud(10, new THREE.SphereGeometry(0.1, 8, 8));
    cloud.setPoints([{ position: [0, 0, -1], color: 0xffffff, scale: 1, data: { id: 'hit' } }]);

    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));
    const hit = cloud.intersect(raycaster);

    expect(hit).not.toBeNull();
    expect(hit.data).toEqual({ id: 'hit' });
    expect(hit.index).toBe(0);
    expect(hit.distance).toBeGreaterThan(0);
  });

  it('returns null when the ray misses all instances', () => {
    const cloud = new InstancedPointCloud(10, new THREE.SphereGeometry(0.1, 8, 8));
    cloud.setPoints([{ position: [1, 0, -1], color: 0xffffff, scale: 1, data: {} }]);

    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));
    expect(cloud.intersect(raycaster)).toBeNull();
  });

  it('disposes geometry and material and removes mesh from parent', () => {
    const parent = new THREE.Group();
    const cloud = new InstancedPointCloud(10);
    parent.add(cloud.mesh);

    const geomSpy = vi.spyOn(cloud.geometry, 'dispose');
    const matSpy = vi.spyOn(cloud.material, 'dispose');

    cloud.dispose();

    expect(geomSpy).toHaveBeenCalled();
    expect(matSpy).toHaveBeenCalled();
    expect(cloud.mesh.parent).toBeNull();
  });
});

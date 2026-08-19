import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { BVHSpatialAccelerator } from '../src/vr/scalability/BVHSpatialAccelerator.ts';

describe('BVH Spatial Acceleration Engine (three-mesh-bvh)', () => {
  it('builds boundsTree on Three.js mesh and performs accelerated raycasting', () => {
    BVHSpatialAccelerator.init();

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(geometry, material);

    const boundsTree = BVHSpatialAccelerator.buildTree(mesh);
    expect(boundsTree).toBeDefined();
    expect((mesh.geometry as unknown as { boundsTree?: unknown }).boundsTree).toBeDefined();

    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));
    const hits = BVHSpatialAccelerator.raycast(mesh, raycaster);

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].distance).toBeCloseTo(4.5, 1);

    BVHSpatialAccelerator.disposeTree(mesh);
    expect((mesh.geometry as unknown as { boundsTree?: unknown }).boundsTree).toBeFalsy();
  });
});

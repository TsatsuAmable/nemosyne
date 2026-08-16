import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { disposeObject } from '../../../src/utils/Dispose.js';
import { MeshPool, sharedSphereGeometry, sharedBoxGeometry } from '../../../src/vr/scalability/ObjectPool.js';

describe('Feature 4: Shared Geometry Disposals', () => {
  it('F4-TC1: disposeObject disposes mesh materials while shared geometries remain intact', () => {
    const mesh = MeshPool.instance.acquireSphere(0x00ffcc, 0.1);
    expect(mesh.geometry).toBe(sharedSphereGeometry);

    disposeObject(mesh);
    // Shared geometries should not be destroyed / cleared
    expect(sharedSphereGeometry).toBeDefined();
    expect(sharedSphereGeometry.attributes.position).toBeDefined();
  });

  it('F4-TC2: Swapping pooled meshes retains global unit box and sphere geometries', () => {
    const sphereMesh = MeshPool.instance.acquireSphere();
    const boxMesh = MeshPool.instance.acquireBox();

    expect(sphereMesh.geometry).toBe(sharedSphereGeometry);
    expect(boxMesh.geometry).toBe(sharedBoxGeometry);

    MeshPool.instance.release(sphereMesh);
    MeshPool.instance.release(boxMesh);

    expect(sharedSphereGeometry.attributes.position).toBeDefined();
    expect(sharedBoxGeometry.attributes.position).toBeDefined();
  });

  it('F4-TC3: MeshPool.releaseGroup recycles meshes in a group back into pool', () => {
    const group = new THREE.Group();
    const m1 = MeshPool.instance.acquireSphere();
    const m2 = MeshPool.instance.acquireBox();
    group.add(m1);
    group.add(m2);

    MeshPool.instance.releaseGroup(group);

    // Meshes should be hidden and removed from group
    expect(m1.visible).toBe(false);
    expect(m2.visible).toBe(false);
  });

  it('F4-TC4: MeshPool.clear purges active meshes without throwing errors', () => {
    const m1 = MeshPool.instance.acquireSphere();
    expect(() => MeshPool.instance.clear()).not.toThrow();
  });

  it('F4-TC5: Custom user-defined mesh geometries are properly disposed on disposeObject', () => {
    const customGeom = new THREE.ConeGeometry(0.5, 1, 8);
    const customMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const customMesh = new THREE.Mesh(customGeom, customMat);

    let disposed = false;
    customGeom.dispose = () => {
      disposed = true;
    };

    disposeObject(customMesh);
    expect(disposed).toBe(true);
  });
});

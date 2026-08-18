// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { MeshPool, executeInTimeSlices } from '../src/utils/ObjectPool.ts';
import {
  sharedSphereGeometry,
  sharedBoxGeometry,
  sharedCylinderGeometry,
} from '../src/utils/ObjectPool.ts';
import { disposeObject } from '../src/utils/Dispose.ts';

describe('Object Pool & Time-Sliced Execution Subsystem', () => {
  it('acquires and recycles meshes cleanly without memory allocations', () => {
    const pool = MeshPool.instance;
    pool.clear();

    const mesh1 = pool.acquireSphere(0x00ffcc, 0.2);
    expect(mesh1).toBeDefined();
    expect(mesh1.visible).toBe(true);

    pool.release(mesh1);
    expect(mesh1.visible).toBe(false);

    // Re-acquiring should reuse the same mesh instance from pool
    const mesh2 = pool.acquireSphere(0xff0055, 0.2);
    expect(mesh2).toBe(mesh1);
  });

  it('recycles full THREE.Group object trees cleanly', () => {
    const pool = MeshPool.instance;
    pool.clear();

    const group = new THREE.Group();
    const childMesh = pool.acquireBox(0x00ccff, [0.1, 0.1, 0.1]);
    group.add(childMesh);

    expect(group.children.length).toBe(1);
    pool.releaseGroup(group);

    expect(childMesh.visible).toBe(false);

    // Re-acquiring box should reuse childMesh
    const reusedBox = pool.acquireBox(0x00ccff, [0.1, 0.1, 0.1]);
    expect(reusedBox).toBe(childMesh);
  });

  it('executes item batches smoothly in time slices', async () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const processed: number[] = [];

    await executeInTimeSlices(items, 3, (item) => {
      processed.push(item);
    });

    expect(processed).toEqual(items);
  });

  it('disposeObject never disposes shared geometries from ObjectPool', () => {
    // Spy on each shared geometry's dispose to prove it is NOT invoked.
    const sphereSpy = vi.fn();
    const boxSpy = vi.fn();
    const cylinderSpy = vi.fn();
    const origSphere = sharedSphereGeometry.dispose;
    const origBox = sharedBoxGeometry.dispose;
    const origCylinder = sharedCylinderGeometry.dispose;
    sharedSphereGeometry.dispose = sphereSpy;
    sharedBoxGeometry.dispose = boxSpy;
    sharedCylinderGeometry.dispose = cylinderSpy;

    try {
      const group = new THREE.Group();
      const sphereMesh = new THREE.Mesh(
        sharedSphereGeometry,
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      const boxMesh = new THREE.Mesh(
        sharedBoxGeometry,
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      const cylMesh = new THREE.Mesh(
        sharedCylinderGeometry,
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      group.add(sphereMesh, boxMesh, cylMesh);

      // A mesh with a non-shared geometry should still be disposed.
      const privateGeom = new THREE.BufferGeometry();
      const privateSpy = vi.fn();
      privateGeom.dispose = privateSpy;
      const privateMesh = new THREE.Mesh(
        privateGeom,
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      group.add(privateMesh);

      disposeObject(group);

      expect(sphereSpy).not.toHaveBeenCalled();
      expect(boxSpy).not.toHaveBeenCalled();
      expect(cylinderSpy).not.toHaveBeenCalled();
      expect(privateSpy).toHaveBeenCalled();
    } finally {
      sharedSphereGeometry.dispose = origSphere;
      sharedBoxGeometry.dispose = origBox;
      sharedCylinderGeometry.dispose = origCylinder;
    }
  });
});

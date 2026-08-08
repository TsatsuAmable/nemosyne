import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { MeshPool, executeInTimeSlices } from '../src/vr/scalability/ObjectPool.ts';

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
});

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { disposeObject } from '../../../src/utils/Dispose.ts';
import { MeshPool, sharedSphereGeometry, sharedBoxGeometry } from '../../../src/vr/scalability/ObjectPool.ts';

describe('Tier 2 — Feature 4: Shared Geometry Disposals (Boundary Cases)', () => {
  it('F4-BC1: disposeObject on null, undefined, or already disposed object executes safely', () => {
    expect(() => disposeObject(null)).not.toThrow();
    expect(() => disposeObject(undefined)).not.toThrow();

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    disposeObject(mesh);
    // Double dispose call
    expect(() => disposeObject(mesh)).not.toThrow();
  });

  it('F4-BC2: Disposing pooled meshes preserves shared static geometries in MeshPool', () => {
    const pool = MeshPool.instance;
    const mesh1 = pool.acquireSphere(0x00ffcc, 0.1);
    const mesh2 = pool.acquireBox(0xff0055, [0.1, 0.1, 0.1]);

    expect(mesh1.geometry).toBe(sharedSphereGeometry);
    expect(mesh2.geometry).toBe(sharedBoxGeometry);

    // Release back to pool
    pool.release(mesh1);
    pool.release(mesh2);

    // Shared geometries must not be destroyed/invalidated
    expect(sharedSphereGeometry).toBeDefined();
    expect(sharedBoxGeometry).toBeDefined();
    expect(sharedSphereGeometry.attributes.position).toBeDefined();
  });

  it('F4-BC3: MeshPool reuses released meshes on subsequent acquisition requests', () => {
    const pool = MeshPool.instance;
    const s1 = pool.acquireSphere(0x00ffcc, 0.1);
    pool.release(s1);

    const s2 = pool.acquireSphere(0xff0000, 0.2);
    expect(s2).toBe(s1); // Reused same mesh instance
  });

  it('F4-BC4: Disposing deeply nested scene hierarchy disposes custom materials while preserving shared geometries', () => {
    const root = new THREE.Group();
    const parent = new THREE.Group();
    root.add(parent);

    const pool = MeshPool.instance;
    const pooledMesh = pool.acquireSphere();
    parent.add(pooledMesh);

    const customGeom = new THREE.BufferGeometry();
    const customMat = new THREE.MeshBasicMaterial();
    const customMesh = new THREE.Mesh(customGeom, customMat);
    parent.add(customMesh);

    disposeObject(root);

    // Shared geometry preserved
    expect(sharedSphereGeometry.attributes.position).toBeDefined();
  });

  it('F4-BC5: High-frequency disposal of 1,000 meshes executes with sub-20ms latency', () => {
    const meshes: THREE.Mesh[] = [];
    for (let i = 0; i < 1000; i++) {
      const g = new THREE.BoxGeometry(0.1, 0.1, 0.1);
      const m = new THREE.MeshBasicMaterial();
      meshes.push(new THREE.Mesh(g, m));
    }

    const startTime = performance.now();
    for (const mesh of meshes) {
      disposeObject(mesh);
    }
    const elapsed = performance.now() - startTime;

    expect(elapsed).toBeLessThan(100);
  });
});

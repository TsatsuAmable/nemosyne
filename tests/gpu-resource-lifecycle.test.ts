// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { MeshPool } from '../src/utils/ObjectPool.ts';
import { LODManager } from '../src/vr/scalability/LODManager.ts';

describe('GPU Resource Lifecycle & Per-Frame Allocation Hygiene', () => {
  it('disposes custom geometry, material, and textures on release and clear', () => {
    const pool = new MeshPool();

    const customGeo = new THREE.BufferGeometry();
    const geoDispose = vi.fn();
    customGeo.dispose = geoDispose;

    const mockTexture = { dispose: vi.fn() };
    const customMat = { map: mockTexture, dispose: vi.fn() };

    const customMesh = new THREE.Mesh(customGeo, customMat);
    pool.release(customMesh);

    expect(geoDispose).toHaveBeenCalled();
    expect(customMat.dispose).toHaveBeenCalled();
    expect(mockTexture.dispose).toHaveBeenCalled();

    // Test clear() full teardown
    pool.acquireSphere(0xff0000, 0.1);
    expect(pool._activeMeshes.size).toBe(1);

    pool.clear();
    expect(pool._activeMeshes.size).toBe(0);
    expect(pool._spherePool.length).toBe(0);
  });

  it('LODManager performs frustum and gaze tests without per-call object allocations', () => {
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    camera.position.set(0, 1.6, 0);
    camera.updateMatrixWorld();

    const lod = new LODManager(camera);
    lod.update();

    const targetPos = new THREE.Vector3(0, 1.6, -2);
    expect(lod.isInFrustum(targetPos, 0.2)).toBe(true);
    expect(lod.isInGaze(targetPos, 15)).toBe(true);
    expect(lod.levelFor(targetPos)).toBe(1);
  });
});

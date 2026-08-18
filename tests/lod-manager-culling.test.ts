// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { LODManager } from '../src/vr/scalability/LODManager.ts';

describe('Sprint 14.1: Adaptive LOD & Frustum/Occlusion Culling Engine', () => {
  let lodManager: LODManager;
  let camera: THREE.PerspectiveCamera;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    camera.position.set(0, 1.6, 0);
    camera.lookAt(0, 1.6, -10);
    camera.updateMatrixWorld(true);

    lodManager = new LODManager(camera);
    lodManager.update();
  });

  it('computes levelFor based on camera distance', () => {
    const posClose = new THREE.Vector3(0, 1.6, -0.5);
    const posMedium = new THREE.Vector3(0, 1.6, -2.5);
    const posFar = new THREE.Vector3(0, 1.6, -10.0);

    expect(lodManager.levelFor(posClose)).toBe(0);
    expect(lodManager.levelFor(posMedium)).toBe(1);
    expect(lodManager.levelFor(posFar)).toBe(2);
  });

  it('evaluates isInFrustum for objects inside and outside viewing cone', () => {
    const insidePos = new THREE.Vector3(0, 1.6, -5);
    const behindPos = new THREE.Vector3(0, 1.6, 10);

    expect(lodManager.isInFrustum(insidePos)).toBe(true);
    expect(lodManager.isInFrustum(behindPos)).toBe(false);
  });

  it('computes screen space error metrics for scaling node resolution', () => {
    const posClose = new THREE.Vector3(0, 1.6, -1);
    const posFar = new THREE.Vector3(0, 1.6, -10);

    const sseClose = lodManager.computeScreenSpaceError(posClose, 0.2);
    const sseFar = lodManager.computeScreenSpaceError(posFar, 0.2);

    expect(sseClose).toBeGreaterThan(sseFar);
  });

  it('culls arrays of spatial positions into lod buckets and culled counts', () => {
    const positions = [
      new THREE.Vector3(0, 1.6, -0.5),  // LOD 0
      new THREE.Vector3(0, 1.6, -2.0),  // LOD 1
      new THREE.Vector3(0, 1.6, -15.0), // LOD 2
      new THREE.Vector3(0, 1.6, 20.0),  // Culled behind camera
    ];

    const result = lodManager.cullPositions(positions);
    expect(result.visibleCount).toBe(3);
    expect(result.culledCount).toBe(1);
    expect(result.lod0Count).toBe(1);
    expect(result.lod1Count).toBe(1);
    expect(result.lod2Count).toBe(1);
  });
});

// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { LODManager } from '../src/vr/scalability/LODManager.ts';

class FakeCamera {
  position: THREE.Vector3;
  direction: THREE.Vector3;

  constructor(position = new THREE.Vector3(), direction = new THREE.Vector3(0, 0, -1)) {
    this.position = position;
    this.direction = direction;
  }

  getWorldPosition(target: THREE.Vector3): THREE.Vector3 {
    return target.copy(this.position);
  }

  getWorldDirection(target: THREE.Vector3): THREE.Vector3 {
    return target.copy(this.direction);
  }
}

describe('LODManager', () => {
  let camera: FakeCamera;
  let lod: LODManager;

  beforeEach(() => {
    camera = new FakeCamera();
    lod = new LODManager(camera as unknown as THREE.Camera);
  });

  it('does nothing when camera is missing', () => {
    const empty = new LODManager(null);
    expect(() => empty.update()).not.toThrow();
  });

  it('computes distance-based LOD levels', () => {
    lod.update();
    const near = new THREE.Vector3(0, 0, -0.5);
    const mid = new THREE.Vector3(0, 0, -2);
    const far = new THREE.Vector3(0, 0, -10);

    expect(lod.levelFor(near)).toBe(0);
    expect(lod.levelFor(mid)).toBe(1);
    expect(lod.levelFor(far)).toBe(2);
  });

  it('identifies objects within gaze cone', () => {
    lod.update();
    const ahead = new THREE.Vector3(0, 0, -5);
    const offAxis = new THREE.Vector3(5, 0, -5);

    expect(lod.isInGaze(ahead, 15)).toBe(true);
    expect(lod.isInGaze(offAxis, 15)).toBe(false);
  });

  it('fades far objects', () => {
    lod.update();
    const near = new THREE.Vector3(0, 0, -2);
    const mid = new THREE.Vector3(0, 0, -5);
    const far = new THREE.Vector3(0, 0, -12);

    expect(lod.fadeFor(near)).toBe(1);
    expect(lod.fadeFor(mid)).toBeGreaterThan(0);
    expect(lod.fadeFor(mid)).toBeLessThan(1);
    expect(lod.fadeFor(far)).toBe(0);
  });

  it('shows labels up close or when gazed at', () => {
    lod.update();
    const close = new THREE.Vector3(0, 0, -0.5);
    const stared = new THREE.Vector3(0, 0, -5);
    const ignored = new THREE.Vector3(5, 0, -5);

    expect(lod.shouldShowLabel(close)).toBe(true);
    expect(lod.shouldShowLabel(stared)).toBe(true);
    expect(lod.shouldShowLabel(ignored)).toBe(false);
  });
});

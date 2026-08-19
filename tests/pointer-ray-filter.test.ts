/**
 * Tests for Gate 3 PointerRayFilter and adaptive aim-drift smoothing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { PointerRayFilter } from '../src/vr/input/PointerRayFilter.ts';
import { PointerRegistry } from '../src/vr/input/PointerRegistry.ts';
import type { EngineLike, PointerLike } from '../src/vr/coordinators/types.ts';

describe('PointerRayFilter (One-Euro Adaptive Smoothing)', () => {
  let filter: PointerRayFilter;

  beforeEach(() => {
    filter = new PointerRayFilter();
  });

  it('initializes with the first input ray without corruption', () => {
    const rawRay = new THREE.Ray(new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 0, -1));
    const smoothed = filter.filter(rawRay, 1000);

    expect(smoothed.origin.toArray()).toEqual([0, 1.5, 0]);
    expect(smoothed.direction.toArray()).toEqual([0, 0, -1]);
  });

  it('dampens low-velocity micro-jitter significantly (stationary aiming)', () => {
    const baseOrigin = new THREE.Vector3(0, 1.5, 0);
    const baseDir = new THREE.Vector3(0, 0, -1);

    // Initial frame
    filter.filter(new THREE.Ray(baseOrigin, baseDir), 1000);

    // Simulate 60 Hz high-frequency jitter around the stationary target
    let maxJitterFiltered = 0;
    for (let frame = 1; frame <= 30; frame++) {
      const time = 1000 + frame * 16.66;
      const noise = (Math.sin(frame * 1.5) * 0.04); // ±0.04 rad angular jitter
      const jitteredDir = new THREE.Vector3(noise, 0, -1).normalize();
      const rawRay = new THREE.Ray(baseOrigin, jitteredDir);

      const smoothed = filter.filter(rawRay, time);
      const deviation = Math.abs(smoothed.direction.x);
      if (deviation > maxJitterFiltered) {
        maxJitterFiltered = deviation;
      }
    }

    // Maximum filtered jitter should be far smaller than raw noise peak (0.04)
    expect(maxJitterFiltered).toBeLessThan(0.02);
  });

  it('adapts quickly to rapid sweeps (high velocity) with minimal lag', () => {
    const baseOrigin = new THREE.Vector3(0, 1.5, 0);
    filter.filter(new THREE.Ray(baseOrigin, new THREE.Vector3(0, 0, -1)), 1000);

    // Rapid saccade: jumps 45 degrees over 3 frames
    const fastDir = new THREE.Vector3(1, 0, -1).normalize();
    filter.filter(new THREE.Ray(baseOrigin, fastDir), 1016);
    filter.filter(new THREE.Ray(baseOrigin, fastDir), 1033);
    const smoothed3 = filter.filter(new THREE.Ray(baseOrigin, fastDir), 1050);

    // Filter should rapidly converge onto the new target
    expect(smoothed3.direction.x).toBeCloseTo(fastDir.x, 1);
  });
});

describe('PointerRegistry Filter Integration', () => {
  it('smooths best pointer ray when smoothingEnabled is true', () => {
    const mockEngine = {
      input: {
        raycaster: new THREE.Raycaster(),
        raycastPanels: () => null,
      },
    } as unknown as EngineLike;

    const registry = new PointerRegistry(mockEngine);

    const mockController: PointerLike = {
      handedness: 'right',
      getRay: (target) => target.set(new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 0, -1)),
    };
    registry.addController(mockController);

    const r1 = registry.getBestPointerRay(1000);
    expect(r1).not.toBeNull();
    expect(r1?.direction.z).toBeCloseTo(-1);

    // Can toggle smoothing
    registry.smoothingEnabled = false;
    const rRaw = registry.getBestPointerRay(1016);
    expect(rRaw).not.toBeNull();
  });
});

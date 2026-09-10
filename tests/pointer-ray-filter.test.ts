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
      const noise = Math.sin(frame * 1.5) * 0.04; // ±0.04 rad angular jitter
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

  it('filterInto preserves the pre-C2 smoothing trajectory while reusing its target', () => {
    const target = new THREE.Ray();
    const samples = [
      [1000, [0, 1.5, 0], [0, 0, -1]],
      [1016, [0.01, 1.5, 0], [0.02, 0, -1]],
      [1033, [0.02, 1.49, 0], [0.15, 0.01, -1]],
      [1050, [0.03, 1.49, 0], [0.35, 0.02, -1]],
    ] as const;
    const legacyExpected = [
      [
        [0, 1.5, 0],
        [0, 0, -1],
      ],
      [
        [0.0011656632696049921, 1.5, 0],
        [0.0028078256680052357, 0, -0.9999960580497396],
      ],
      [
        [0.00351928137169002, 1.4987503578513137, 0],
        [0.028243114800339045, 0.0017281084662529472, -0.9995995898896236],
      ],
      [
        [0.0069252812137684475, 1.4976248703644355, 0],
        [0.097768105977405, 0.005675726883407861, -0.9951930383488099],
      ],
    ] as const;

    samples.forEach(([time, origin, direction], index) => {
      const raw = new THREE.Ray(
        new THREE.Vector3(...origin),
        new THREE.Vector3(...direction).normalize()
      );
      const actual = filter.filterInto(raw, target, time);
      expect(actual).toBe(target);
      expect(actual.origin.toArray()).toEqual(
        expect.arrayContaining(legacyExpected[index][0].map((value) => expect.closeTo(value, 12)))
      );
      expect(actual.direction.toArray()).toEqual(
        expect.arrayContaining(legacyExpected[index][1].map((value) => expect.closeTo(value, 12)))
      );
    });
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

  it('matches array-like XR input sources without materialising helper arrays', () => {
    const registry = new PointerRegistry({} as EngineLike);
    const left = { handedness: 'left', getRay: (ray: THREE.Ray) => ray } as PointerLike;
    const right = { handedness: 'right', getRay: (ray: THREE.Ray) => ray } as PointerLike;
    registry.addController(left);
    registry.addController(right);

    const source0 = { handedness: 'left', hand: null } as unknown as XRInputSource;
    const source1 = { handedness: 'right', hand: null } as unknown as XRInputSource;
    const arrayLike = { 0: source0, 1: source1, length: 2 };

    expect(registry.findSourceForController(right, arrayLike)).toBe(source1);
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
    const durableFirst = r1?.clone();

    const r2 = registry.getBestPointerRay(1016);
    expect(r2).toBe(r1);
    expect(durableFirst?.direction.z).toBeCloseTo(-1);

    // Can toggle smoothing
    registry.smoothingEnabled = false;
    const rRaw = registry.getBestPointerRay(1016);
    expect(rRaw).not.toBeNull();
  });
});

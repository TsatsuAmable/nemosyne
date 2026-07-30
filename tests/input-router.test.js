import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { InputRouter } from '../src/vr/InputRouter.js';

class MockEngine {
  constructor() {
    this.renderer = {
      xr: {
        getSession: () => this.session,
      },
    };
    this.headWorldPos = new THREE.Vector3();
  }
}

class MockController {
  constructor(handedness) {
    this.handedness = handedness;
    this.rayLength = 4;
    this.rayVisible = false;
  }

  getRay(ray) {
    ray.origin.set(0, 0, 0);
    ray.direction.set(0, 0, -1);
    return ray;
  }

  setRayLength(length) {
    this.rayLength = length;
  }

  setRayVisible(visible) {
    this.rayVisible = visible;
  }
}

describe('InputRouter controller system toggle', () => {
  let router;
  let engine;
  let toggles;

  beforeEach(() => {
    engine = new MockEngine();
    router = new InputRouter(engine);
    toggles = 0;
    router.onSystemToggle = () => toggles++;
  });

  it('toggles the system action when both grips are pressed together', () => {
    const right = new MockController('right');
    const left = new MockController('left');
    router.addController(right);
    router.addController(left);

    engine.session = {
      inputSources: [
        { handedness: 'right', gamepad: { buttons: [{ pressed: false }, { pressed: true }] } },
        { handedness: 'left', gamepad: { buttons: [{ pressed: false }, { pressed: true }] } },
      ],
    };

    router.update(null, null, engine.session, 0);

    expect(toggles).toBe(1);
  });

  it('does not toggle again while both grips stay held', () => {
    const right = new MockController('right');
    const left = new MockController('left');
    router.addController(right);
    router.addController(left);

    engine.session = {
      inputSources: [
        { handedness: 'right', gamepad: { buttons: [{ pressed: false }, { pressed: true }] } },
        { handedness: 'left', gamepad: { buttons: [{ pressed: false }, { pressed: true }] } },
      ],
    };

    router.update(null, null, engine.session, 0);
    router.update(null, null, engine.session, 0.1);

    expect(toggles).toBe(1);
  });

  it('uses a single grip toggle as fallback when only one controller is present', () => {
    const right = new MockController('right');
    router.addController(right);

    engine.session = {
      inputSources: [
        { handedness: 'right', gamepad: { buttons: [{ pressed: false }, { pressed: true }] } },
      ],
    };

    router.update(null, null, engine.session, 0);

    expect(toggles).toBe(1);
  });

  it('does not toggle for a single grip when two controllers are tracked', () => {
    const right = new MockController('right');
    const left = new MockController('left');
    router.addController(right);
    router.addController(left);

    engine.session = {
      inputSources: [
        { handedness: 'right', gamepad: { buttons: [{ pressed: false }, { pressed: true }] } },
        { handedness: 'left', gamepad: { buttons: [{ pressed: false }, { pressed: false }] } },
      ],
    };

    router.update(null, null, engine.session, 0);

    expect(toggles).toBe(0);
  });
});

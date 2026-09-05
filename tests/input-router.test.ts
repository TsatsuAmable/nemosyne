// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { InputRouter } from '../src/vr/InputRouter.ts';

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

  it('falls back to index order for controllers without handedness', () => {
    const noHand = new MockController('none');
    router.addController(noHand);

    engine.session = {
      inputSources: [{ gamepad: { buttons: [{ pressed: false }, { pressed: true }] } }],
    };

    router.update(null, null, engine.session, 0);
    expect(toggles).toBe(1);
  });

  it('clears hover and resets ray length when no pointer is available', () => {
    const entry = { mesh: new THREE.Object3D(), onEnter: vi.fn(), onLeave: vi.fn() };
    router.addInteractable(entry.mesh, entry);
    router.hovered = entry;

    router.update(null, null, engine.session, 0);

    expect(router.hovered).toBeNull();
  });

  it('keeps scene raycast targets synchronized when the facade replaces interactables', () => {
    const mesh = new THREE.Object3D();
    const intersectObjects = vi.spyOn(router.raycaster, 'intersectObjects').mockReturnValue([]);

    router.interactables = [{ mesh }];
    router.registry.raycastScene();

    expect(intersectObjects).toHaveBeenCalledWith([mesh], true, expect.any(Array));
  });

  it('fires a global select callback', () => {
    const selectCb = vi.fn();
    router.onSelectCallback = selectCb;

    const controller = new MockController('right');
    router.addController(controller);
    engine.session = {
      inputSources: [
        { handedness: 'right', gamepad: { buttons: [{ pressed: false }, { pressed: false }] } },
      ],
    };

    router.update(null, null, engine.session, 0);
    engine.session.inputSources[0].gamepad.buttons[0].pressed = true;
    router.update(null, null, engine.session, 0.1);

    expect(selectCb).toHaveBeenCalled();
  });

  it('keeps dispatcher hadCallback truthful as the global callback is set and cleared', () => {
    const seen: boolean[] = [];
    router.dispatcher.onDispatch = (info: { hadCallback: boolean }) => {
      seen.push(info.hadCallback);
    };
    const pointer = {
      getRay: (ray: THREE.Ray) => {
        ray.origin.set(0, 1.6, 0);
        ray.direction.set(0, 0, -1);
        return ray;
      },
    };

    // No global callback installed (production default): misses must not
    // report callback-only.
    expect(router.onSelectCallback).toBeNull();
    router.dispatcher.triggerSelect(pointer as never);
    expect(seen).toEqual([false]);

    // Installing a real callback flips hadCallback to true...
    const selectCb = vi.fn();
    router.onSelectCallback = selectCb;
    router.dispatcher.triggerSelect(pointer as never);
    expect(seen).toEqual([false, true]);
    expect(selectCb).toHaveBeenCalledTimes(1);

    // ...and clearing it restores the falsy report (no stale closure).
    router.onSelectCallback = null;
    router.dispatcher.triggerSelect(pointer as never);
    expect(seen).toEqual([false, true, false]);
    expect(selectCb).toHaveBeenCalledTimes(1);
  });
});

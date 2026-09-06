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

describe('InputRouter event-path pinch tracing', () => {
  function makePinchHand(handedness: string, y: number) {
    return {
      handedness,
      pinched: false,
      rayOrigin: { y },
      isPinched(this: { pinched: boolean }) {
        return this.pinched;
      },
      getRay(ray: THREE.Ray) {
        ray.origin.set(0, y, 0);
        ray.direction.set(0, 0, -1);
        return ray;
      },
    };
  }

  function makeRouter() {
    const engine = new MockEngine();
    const router = new InputRouter(engine);
    const edges: Array<{ phase: string; gating: string }> = [];
    const dispatches: unknown[] = [];
    router.onHandPinchEdge = ((hand: unknown, phase: string, gating: string) => {
      edges.push({ phase, gating });
    }) as never;
    router.dispatcher.onDispatch = ((info: unknown) => {
      dispatches.push(info);
    }) as never;
    return { router, edges, dispatches };
  }

  it('traces event-path pinch starts and does not double-dispatch on the poll pass', () => {
    const { router, edges, dispatches } = makeRouter();
    const hand = makePinchHand('left', 1.2);
    router.addHand(hand as never);

    // Event wins the race (Quest Browser delivers the pinch callback).
    (hand as unknown as { onPinchStart: (p: unknown) => void }).onPinchStart(hand);
    expect(edges).toEqual([{ phase: 'start', gating: 'select' }]);
    expect(dispatches).toHaveLength(1);

    // The poll pass sees the same physical pinch via the shared flag.
    hand.pinched = true;
    router.update(null, null, { inputSources: [] } as never);
    expect(edges).toHaveLength(1);
    expect(dispatches).toHaveLength(1);
  });

  it('withholds event-path selection while suppression is latched from poll', () => {
    const { router, edges, dispatches } = makeRouter();
    // Low hands: a both-pinch here is a *valid* system attempt, so the poll
    // path suppresses per-hand selection (systemGestureZoneSuppressed false,
    // validPinchAttempt true). Zone suppression instead withholds only the
    // toggle while letting selection flow (pinned in system-gesture tests).
    const handA = makePinchHand('left', 1.2);
    const handB = makePinchHand('right', 1.1);
    router.addHand(handA as never);
    router.addHand(handB as never);
    const session = { inputSources: [] } as never;

    // Poll latches suppression and traces both starts.
    handA.pinched = true;
    handB.pinched = true;
    router.update(null, null, session);
    expect(edges).toEqual([
      { phase: 'start', gating: 'system-suppressed' },
      { phase: 'start', gating: 'system-suppressed' },
    ]);
    edges.length = 0;

    // Simulate the race the other way: poll missed handA, event fires first.
    router.pointers.lastHandPinched.set(handA as never, false);
    (handA as unknown as { onPinchStart: (p: unknown) => void }).onPinchStart(handA);
    expect(edges).toEqual([{ phase: 'start', gating: 'system-suppressed' }]);
    // No per-hand selection while suppressed — matches the poll path.
    expect(dispatches).toHaveLength(0);
  });

  it('event path toggles the wheel with wheel-toggle gating and no selection', () => {
    const { router, edges, dispatches } = makeRouter();
    const hand = makePinchHand('left', 1.2);
    const menu = { hand, toggle: vi.fn() };
    router.setHandWheelMenu(menu as never);
    router.addHand(hand as never);

    (hand as unknown as { onPinchStart: (p: unknown) => void }).onPinchStart(hand);
    expect(edges).toEqual([{ phase: 'start', gating: 'wheel-toggle' }]);
    expect(menu.toggle).toHaveBeenCalledOnce();
    expect(dispatches).toHaveLength(0);
  });

  it('clears cached suppression when the session drops, so the event path recovers', () => {
    const { router, edges, dispatches } = makeRouter();
    const handA = makePinchHand('left', 1.2);
    const handB = makePinchHand('right', 1.1);
    router.addHand(handA as never);
    router.addHand(handB as never);

    // Latch suppression with a valid both-pinch poll.
    handA.pinched = true;
    handB.pinched = true;
    router.update(null, null, { inputSources: [] } as never);
    expect(edges).toEqual([
      { phase: 'start', gating: 'system-suppressed' },
      { phase: 'start', gating: 'system-suppressed' },
    ]);
    edges.length = 0;

    // Session lost: the next poll clears the cache; a subsequent event-path
    // pinch classifies select again instead of a stale suppression.
    router.update(null, null, null);
    router.pointers.lastHandPinched.set(handA as never, false);
    (handA as unknown as { onPinchStart: (p: unknown) => void }).onPinchStart(handA);
    expect(edges).toEqual([{ phase: 'start', gating: 'select' }]);
    expect(dispatches).toHaveLength(1);
  });
});

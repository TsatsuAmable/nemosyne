import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { InputRouter } from '../src/vr/InputRouter.ts';
import {
  IWSDKXRInputProvider,
  type XRInputButtonState,
  type XRInputProvider,
} from '../src/vr/input/XRInputProvider.ts';
import type { PointerLike } from '../src/vr/coordinators/types.ts';

const unavailable = (): XRInputButtonState => ({
  available: false,
  pressed: false,
  down: false,
  up: false,
});

function makeGamepadButton(pressed = false): GamepadButton {
  return { pressed, touched: pressed, value: pressed ? 1 : 0 };
}

function makeSource(options: {
  handedness: XRHandedness;
  hand?: boolean;
  pressed?: boolean;
  profiles?: string[];
}): XRInputSource {
  const buttons = [makeGamepadButton(options.pressed)];
  const gamepad = {
    axes: [],
    buttons,
    connected: true,
    id: 'test-xr-gamepad',
    index: 0,
    mapping: 'xr-standard',
    timestamp: 0,
    vibrationActuator: null,
  } as unknown as Gamepad;

  return {
    handedness: options.handedness,
    targetRayMode: 'tracked-pointer',
    targetRaySpace: {} as XRSpace,
    gripSpace: {} as XRSpace,
    profiles: options.profiles ?? ['generic-trigger'],
    gamepad,
    ...(options.hand ? { hand: {} as XRHand } : {}),
  } as XRInputSource;
}

function makeSession(sources: XRInputSource[]): XRSession {
  return { inputSources: sources } as unknown as XRSession;
}

function makePointer(handedness: XRHandedness, y = 1.1): PointerLike & { pinched: boolean } {
  return {
    handedness,
    pinched: false,
    jointsValid: true,
    rayOrigin: new THREE.Vector3(0, y, 0),
    isPoseValid: () => true,
    isPinched() {
      return this.pinched;
    },
    getRay(target: THREE.Ray) {
      target.origin.set(0, y, 0);
      target.direction.set(0, 0, -1);
      return target;
    },
  } as PointerLike & { pinched: boolean };
}

class FakeProvider implements XRInputProvider {
  readonly select = new Map<XRInputSource, XRInputButtonState>();
  readonly squeeze = new Map<XRInputSource, XRInputButtonState>();
  updates = 0;

  update(): void {
    this.updates += 1;
  }

  getSelect(source: XRInputSource | null): XRInputButtonState {
    return (source && this.select.get(source)) ?? unavailable();
  }

  getSqueeze(source: XRInputSource | null): XRInputButtonState {
    return (source && this.squeeze.get(source)) ?? unavailable();
  }

  reset(): void {
    this.select.clear();
    this.squeeze.clear();
  }
}

function makeRouter(provider: XRInputProvider) {
  const engine = {
    renderer: { xr: { getSession: () => null } },
    camera: new THREE.PerspectiveCamera(),
  };
  return new InputRouter(engine as never, { xrInputProvider: provider });
}

describe('IWSDKXRInputProvider', () => {
  it('uses the standard input profile to expose one-frame select edges', () => {
    const provider = new IWSDKXRInputProvider();
    const source = makeSource({ handedness: 'right' });
    const session = makeSession([source]);
    const button = source.gamepad!.buttons[0] as GamepadButton & {
      pressed: boolean;
      touched: boolean;
      value: number;
    };

    provider.update(session);
    expect(provider.getSelect(source)).toMatchObject({
      available: true,
      pressed: false,
      down: false,
      up: false,
    });

    button.pressed = true;
    button.touched = true;
    button.value = 1;
    provider.update(session);
    expect(provider.getSelect(source)).toMatchObject({
      available: true,
      pressed: true,
      down: true,
      up: false,
    });

    provider.update(session);
    expect(provider.getSelect(source)).toMatchObject({
      available: true,
      pressed: true,
      down: false,
      up: false,
    });

    button.pressed = false;
    button.touched = false;
    button.value = 0;
    provider.update(session);
    expect(provider.getSelect(source)).toMatchObject({
      available: true,
      pressed: false,
      down: false,
      up: true,
    });

    provider.update(null);
    expect(provider.getSelect(source).available).toBe(false);
  });

  it('fails open to the legacy path when a source has no gamepad', () => {
    const provider = new IWSDKXRInputProvider();
    const source = {
      handedness: 'left',
      targetRayMode: 'tracked-pointer',
      targetRaySpace: {} as XRSpace,
      gripSpace: {} as XRSpace,
      profiles: ['generic-trigger'],
      gamepad: null,
      hand: {} as XRHand,
    } as XRInputSource;

    expect(() => provider.update(makeSession([source]))).not.toThrow();
    expect(provider.getSelect(source)).toEqual(unavailable());
  });
});

describe('InputRouter XR provider authority', () => {
  it('routes controller selection from provider edges instead of hard-coded button zero', () => {
    const provider = new FakeProvider();
    const router = makeRouter(provider);
    const controller = makePointer('right');
    const source = makeSource({ handedness: 'right', pressed: false });
    provider.select.set(source, { available: true, pressed: true, down: true, up: false });

    router.addController(controller);
    const press = vi.spyOn(router.machine, 'press').mockImplementation(() => {});

    router._pollSelection(makeSession([source]));

    expect(provider.updates).toBe(1);
    expect(press).toHaveBeenCalledOnce();
    expect(press).toHaveBeenCalledWith(controller);
    expect(router.pointers.controllerTriggerPressed.get(controller)).toBe(true);
  });

  it('uses the same provider snapshot for both-hand suppression and selection routing', () => {
    const provider = new FakeProvider();
    const router = makeRouter(provider);
    const left = makePointer('left', 1.1);
    const right = makePointer('right', 1.1);
    const leftSource = makeSource({ handedness: 'left', hand: true });
    const rightSource = makeSource({ handedness: 'right', hand: true });
    provider.select.set(leftSource, { available: true, pressed: true, down: true, up: false });
    provider.select.set(rightSource, { available: true, pressed: true, down: true, up: false });

    router.addHand(left);
    router.addHand(right);
    const edges: Array<{ hand: XRHandedness; phase: string; gating: string }> = [];
    router.onHandPinchEdge = (hand, phase, gating) => {
      edges.push({ hand: hand.handedness ?? 'none', phase, gating });
    };
    const press = vi.spyOn(router.machine, 'press').mockImplementation(() => {});

    // Local heuristic state deliberately disagrees. Provider state must govern
    // both the system detector and per-hand router for this frame.
    left.pinched = false;
    right.pinched = false;
    router._pollSelection(makeSession([leftSource, rightSource]));

    expect(provider.updates).toBe(1);
    expect(press).not.toHaveBeenCalled();
    expect(edges).toEqual([
      { hand: 'left', phase: 'start', gating: 'system-suppressed' },
      { hand: 'right', phase: 'start', gating: 'system-suppressed' },
    ]);
  });

  it('retains legacy hand selection when the provider cannot normalize the source', () => {
    const provider = new FakeProvider();
    const router = makeRouter(provider);
    const hand = makePointer('left', 1.1);
    hand.pinched = true;
    const source = makeSource({ handedness: 'left', hand: true });

    router.addHand(hand);
    const press = vi.spyOn(router.machine, 'press').mockImplementation(() => {});

    router._pollSelection(makeSession([source]));

    expect(press).toHaveBeenCalledOnce();
    expect(press).toHaveBeenCalledWith(hand);
  });
});

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { InputRouter } from '../src/vr/InputRouter.ts';

function makeEngine() {
  return {
    renderer: {
      xr: {
        getSession: () => ({
          inputSources: [],
        }),
        getFrame: () => null,
        getReferenceSpace: () => null,
      },
    },
  };
}

function makeMockHand({ pinched = false } = {}) {
  return {
    group: new THREE.Group(),
    ray: { visible: true },
    jointsValid: true,
    pinched,
    origin: new THREE.Vector3(),
    direction: new THREE.Vector3(0, 0, -1),
    getRay(target) {
      target.origin.copy(this.origin);
      target.direction.copy(this.direction);
      return target;
    },
    isPinched() {
      return this.pinched;
    },
    setRayLength() {},
    update() {},
  };
}

function makeMockMenu() {
  return {
    hand: null,
    visible: false,
    toggles: 0,
    selections: [],
    toggle() {
      this.visible = !this.visible;
      this.toggles++;
    },
    isVisible() {
      return this.visible;
    },
    handlePointerClick(raycaster) {
      if (!this.visible) return false;
      this.selections.push(raycaster);
      return true;
    },
  };
}

describe('InputRouter hand wheel integration', () => {
  let router;
  let engine;
  let menu;

  beforeEach(() => {
    engine = makeEngine();
    router = new InputRouter(engine);
    menu = makeMockMenu();
  });

  it('stores the hand wheel menu', () => {
    router.setHandWheelMenu(menu);
    expect(router.handWheelMenu).toBe(menu);
  });

  it('toggles the wheel when the menu hand pinches', () => {
    const hand = makeMockHand();
    menu.hand = hand;
    router.setHandWheelMenu(menu);
    router.addHand(hand);

    expect(menu.isVisible()).toBe(false);

    // Simulate a new pinch frame.
    hand.pinched = true;
    router.update(null, null, engine.renderer.xr.getSession());

    expect(menu.isVisible()).toBe(true);
    expect(menu.toggles).toBe(1);
  });

  it('does not route a normal selection through the menu hand', () => {
    const hand = makeMockHand();
    menu.hand = hand;
    router.setHandWheelMenu(menu);
    router.addHand(hand);

    const selectSpy = vi.fn();
    router.onSelectCallback = selectSpy;

    hand.pinched = true;
    router.update(null, null, engine.renderer.xr.getSession());

    expect(selectSpy).not.toHaveBeenCalled();
  });

  it('still routes selection through a non-menu hand', () => {
    const menuHand = makeMockHand();
    const selectHand = makeMockHand();
    menu.hand = menuHand;
    router.setHandWheelMenu(menu);
    router.addHand(menuHand);
    router.addHand(selectHand);

    const selectSpy = vi.fn();
    router.onSelectCallback = selectSpy;

    selectHand.pinched = true;
    router.update(null, null, engine.renderer.xr.getSession());

    expect(menu.toggles).toBe(0);
    expect(selectSpy).toHaveBeenCalled();
  });

  it('routes rays to the visible wheel as a HUD object', () => {
    const hand = makeMockHand();
    menu.hand = hand;
    router.setHandWheelMenu(menu);
    router.addHand(hand);
    router.addHudObject(menu);

    menu.visible = true;

    hand.pinched = false;
    hand.origin.set(0, 0, 0);
    hand.direction.set(0, 0, -1);

    // A non-menu hand pinch should hit the HUD object.
    const selectHand = makeMockHand();
    selectHand.pinched = true;
    selectHand.origin.set(0, 0, 0);
    selectHand.direction.set(0, 0, -1);
    router.addHand(selectHand);

    router.update(null, null, engine.renderer.xr.getSession());

    expect(menu.selections.length).toBe(1);
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { ControllerGestureMapper } from '../src/vr/interactions/ControllerGestureMapper.js';

class MockControllerPointer {
  constructor(handedness, x = 0, y = 0, z = 0) {
    this.handedness = handedness;
    this.position = new THREE.Vector3(x, y, z);
    this._quat = new THREE.Quaternion();
  }

  getRay(targetRay) {
    targetRay.origin.copy(this.position);
    targetRay.direction.set(0, 0, -1).applyQuaternion(this._quat);
    return targetRay;
  }

  setPosition(x, y, z) {
    this.position.set(x, y, z);
  }
}

function makeSession(controller) {
  return {
    inputSources: [
      {
        handedness: controller.handedness,
        gamepad: controller.gamepad,
      },
    ],
  };
}

describe('ControllerGestureMapper', () => {
  let mapper;
  let gestures;

  beforeEach(() => {
    gestures = [];
    mapper = new ControllerGestureMapper({
      onGesture: (name, ctx) => gestures.push({ name, ctx }),
      cooldown: 0,
      flickThreshold: 0.2,
    });
  });

  it('maps right A button to rotateCCW (undo)', () => {
    const right = new MockControllerPointer('right');
    right.gamepad = { buttons: [{ pressed: false }, { pressed: false }, { pressed: false }, { pressed: true }, { pressed: false }], axes: [0, 0, 0, 0] };

    mapper.update([right], makeSession(right), 0);

    expect(gestures.length).toBe(1);
    expect(gestures[0].name).toBe('rotateCCW');
  });

  it('maps right B button to rotateCW (redo)', () => {
    const right = new MockControllerPointer('right');
    right.gamepad = { buttons: [{ pressed: false }, { pressed: false }, { pressed: false }, { pressed: false }, { pressed: true }], axes: [0, 0, 0, 0] };

    mapper.update([right], makeSession(right), 0);

    expect(gestures.length).toBe(1);
    expect(gestures[0].name).toBe('rotateCW');
  });

  it('maps left Y button to okSign', () => {
    const left = new MockControllerPointer('left');
    left.gamepad = { buttons: [{ pressed: false }, { pressed: false }, { pressed: false }, { pressed: false }, { pressed: true }], axes: [0, 0, 0, 0] };

    mapper.update([left], makeSession(left), 0);

    expect(gestures.length).toBe(1);
    expect(gestures[0].name).toBe('okSign');
  });

  it('maps right thumbstick right flick to swipeRight', () => {
    const right = new MockControllerPointer('right');
    right.gamepad = { buttons: [{ pressed: false }, { pressed: false }], axes: [0, 0, 0, 0] };

    mapper.update([right], makeSession(right), 0);

    right.gamepad.axes = [0, 0, 0.8, 0];
    mapper.update([right], makeSession(right), 0.1);

    expect(gestures.length).toBe(1);
    expect(gestures[0].name).toBe('swipeRight');
  });

  it('maps both triggers moving together to pinchTogether', () => {
    const right = new MockControllerPointer('right', 0.2, 0, 0);
    const left = new MockControllerPointer('left', -0.2, 0, 0);
    right.gamepad = { buttons: [{ pressed: true }, { pressed: false }], axes: [0, 0, 0, 0] };
    left.gamepad = { buttons: [{ pressed: true }, { pressed: false }], axes: [0, 0, 0, 0] };

    const session = { inputSources: [
      { handedness: 'right', gamepad: right.gamepad },
      { handedness: 'left', gamepad: left.gamepad },
    ] };

    mapper.update([right, left], session, 0);
    right.setPosition(0.1, 0, 0);
    left.setPosition(-0.1, 0, 0);
    mapper.update([right, left], session, 0.1);

    expect(gestures.length).toBe(1);
    expect(gestures[0].name).toBe('pinchTogether');
  });
});

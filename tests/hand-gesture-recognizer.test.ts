// @ts-nocheck
// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { HandGestureRecognizer } from '../src/vr/interactions/HandGestureRecognizer.ts';

function makePose({
  position = new THREE.Vector3(),
  direction = new THREE.Vector3(0, 0, -1),
  pinched = false,
} = {}) {
  return {
    position: position.clone(),
    direction: direction.clone().normalize(),
    pinched,
    valid: true,
  };
}

function makeHand(poseOverrides = {}, index = 0, handedness = 'right') {
  const pose = makePose(poseOverrides);
  return {
    index,
    handedness: poseOverrides.handedness ?? handedness,
    rayOrigin: pose.position,
    rayDirection: pose.direction,
    isPinched: () => pose.pinched,
    getHandTransform(targetPos, targetQuat) {
      targetPos.copy(pose.position);
      targetQuat.setFromUnitVectors(new THREE.Vector3(0, 0, -1), pose.direction);
    },
    _pose: pose,
  };
}

function update(recognizer, time, leftOverrides = {}, rightOverrides = {}) {
  const left = makeHand(leftOverrides, 0, 'left');
  const right = makeHand(rightOverrides, 1, 'right');
  recognizer.setHands([left, right]);
  recognizer.update(0.1, time);
  return { left, right };
}

function moveSequence(recognizer, steps, dt = 0.2) {
  let time = 0;
  let detected = null;
  for (const step of steps) {
    time += dt;
    const onGesture = vi.fn((name) => {
      if (!detected) detected = name;
    });
    recognizer.onGesture = onGesture;
    update(recognizer, time, step.left, step.right);
  }
  return detected;
}

describe('HandGestureRecognizer', () => {
  it('detects both hands pinched simultaneously', () => {
    const recognizer = new HandGestureRecognizer({ cooldown: 0 });
    const gestures = [];
    recognizer.onGesture = (name) => gestures.push(name);

    update(recognizer, 0, { pinched: false }, { pinched: false });
    update(recognizer, 0.1, { pinched: true }, { pinched: true });

    expect(gestures).toContain('bothPinched');
  });

  it('detects pinch-together when both hands pinch and move closer', () => {
    const recognizer = new HandGestureRecognizer({ cooldown: 0, moveThreshold: 0.05 });
    const gestures = [];
    recognizer.onGesture = (name) => gestures.push(name);

    update(
      recognizer,
      0,
      { position: new THREE.Vector3(-0.3, 0, 0), pinched: true },
      { position: new THREE.Vector3(0.3, 0, 0), pinched: true }
    );
    update(
      recognizer,
      0.1,
      { position: new THREE.Vector3(-0.1, 0, 0), pinched: true },
      { position: new THREE.Vector3(0.1, 0, 0), pinched: true }
    );

    expect(gestures).toContain('pinchTogether');
  });

  it('detects pinch-apart when both hands pinch and move apart', () => {
    const recognizer = new HandGestureRecognizer({ cooldown: 0, moveThreshold: 0.05 });
    const gestures = [];
    recognizer.onGesture = (name) => gestures.push(name);

    update(
      recognizer,
      0,
      { position: new THREE.Vector3(-0.1, 0, 0), pinched: true },
      { position: new THREE.Vector3(0.1, 0, 0), pinched: true }
    );
    update(
      recognizer,
      0.1,
      { position: new THREE.Vector3(-0.3, 0, 0), pinched: true },
      { position: new THREE.Vector3(0.3, 0, 0), pinched: true }
    );

    expect(gestures).toContain('pinchApart');
  });

  it('detects dominant horizontal swipe right', () => {
    const recognizer = new HandGestureRecognizer({ cooldown: 0, moveThreshold: 0.05 });
    const gestures = [];
    recognizer.onGesture = (name) => gestures.push(name);

    update(
      recognizer,
      0,
      { position: new THREE.Vector3(-0.2, 0, -0.5), pinched: false, handedness: 'right' },
      { position: new THREE.Vector3(0, 0, -0.5), pinched: false, handedness: 'left' }
    );
    update(
      recognizer,
      0.1,
      { position: new THREE.Vector3(0.2, 0, -0.5), pinched: false, handedness: 'right' },
      { position: new THREE.Vector3(0, 0, -0.5), pinched: false, handedness: 'left' }
    );

    expect(gestures).toContain('swipeRight');
  });

  it('detects dominant horizontal swipe left', () => {
    const recognizer = new HandGestureRecognizer({ cooldown: 0, moveThreshold: 0.05 });
    const gestures = [];
    recognizer.onGesture = (name) => gestures.push(name);

    update(
      recognizer,
      0,
      { position: new THREE.Vector3(0.2, 0, -0.5), pinched: false, handedness: 'right' },
      { position: new THREE.Vector3(0, 0, -0.5), pinched: false, handedness: 'left' }
    );
    update(
      recognizer,
      0.1,
      { position: new THREE.Vector3(-0.2, 0, -0.5), pinched: false, handedness: 'right' },
      { position: new THREE.Vector3(0, 0, -0.5), pinched: false, handedness: 'left' }
    );

    expect(gestures).toContain('swipeLeft');
  });

  it('detects dominant vertical slice up', () => {
    const recognizer = new HandGestureRecognizer({ cooldown: 0, moveThreshold: 0.05 });
    const gestures = [];
    recognizer.onGesture = (name) => gestures.push(name);

    update(
      recognizer,
      0,
      { position: new THREE.Vector3(0, 0, -0.5), pinched: false, handedness: 'right' },
      { position: new THREE.Vector3(0, 0, -0.5), pinched: false, handedness: 'left' }
    );
    update(
      recognizer,
      0.1,
      { position: new THREE.Vector3(0, 0.2, -0.5), pinched: false, handedness: 'right' },
      { position: new THREE.Vector3(0, 0, -0.5), pinched: false, handedness: 'left' }
    );

    expect(gestures).toContain('sliceUp');
  });

  it('detects two-hand scoop up', () => {
    const recognizer = new HandGestureRecognizer({
      cooldown: 0,
      moveThreshold: 0.05,
      palmDotThreshold: 0.3,
    });
    const gestures = [];
    recognizer.onGesture = (name) => gestures.push(name);

    update(
      recognizer,
      0,
      {
        position: new THREE.Vector3(-0.2, 0, -0.4),
        direction: new THREE.Vector3(0, 1, 0),
        pinched: false,
      },
      {
        position: new THREE.Vector3(0.2, 0, -0.4),
        direction: new THREE.Vector3(0, 1, 0),
        pinched: false,
      }
    );
    update(
      recognizer,
      0.1,
      {
        position: new THREE.Vector3(-0.2, 0.2, -0.4),
        direction: new THREE.Vector3(0, 1, 0),
        pinched: false,
      },
      {
        position: new THREE.Vector3(0.2, 0.2, -0.4),
        direction: new THREE.Vector3(0, 1, 0),
        pinched: false,
      }
    );

    expect(gestures).toContain('scoopUp');
  });

  it('detects two-hand scoop down', () => {
    const recognizer = new HandGestureRecognizer({
      cooldown: 0,
      moveThreshold: 0.05,
      palmDotThreshold: 0.3,
    });
    const gestures = [];
    recognizer.onGesture = (name) => gestures.push(name);

    update(
      recognizer,
      0,
      {
        position: new THREE.Vector3(-0.2, 0.2, -0.4),
        direction: new THREE.Vector3(0, -1, 0),
        pinched: false,
      },
      {
        position: new THREE.Vector3(0.2, 0.2, -0.4),
        direction: new THREE.Vector3(0, -1, 0),
        pinched: false,
      }
    );
    update(
      recognizer,
      0.1,
      {
        position: new THREE.Vector3(-0.2, 0, -0.4),
        direction: new THREE.Vector3(0, -1, 0),
        pinched: false,
      },
      {
        position: new THREE.Vector3(0.2, 0, -0.4),
        direction: new THREE.Vector3(0, -1, 0),
        pinched: false,
      }
    );

    expect(gestures).toContain('scoopDown');
  });

  it('detects two-hand push forward', () => {
    const recognizer = new HandGestureRecognizer({
      cooldown: 0,
      moveThreshold: 0.05,
      palmDotThreshold: 0.3,
    });
    const gestures = [];
    recognizer.onGesture = (name) => gestures.push(name);

    update(
      recognizer,
      0,
      {
        position: new THREE.Vector3(-0.2, 0, -0.2),
        direction: new THREE.Vector3(0, 0, -1),
        pinched: false,
      },
      {
        position: new THREE.Vector3(0.2, 0, -0.2),
        direction: new THREE.Vector3(0, 0, -1),
        pinched: false,
      }
    );
    update(
      recognizer,
      0.1,
      {
        position: new THREE.Vector3(-0.2, 0, -0.4),
        direction: new THREE.Vector3(0, 0, -1),
        pinched: false,
      },
      {
        position: new THREE.Vector3(0.2, 0, -0.4),
        direction: new THREE.Vector3(0, 0, -1),
        pinched: false,
      }
    );

    expect(gestures).toContain('pushForward');
  });

  it('detects dominant OK sign while non-dominant hand is open', () => {
    const recognizer = new HandGestureRecognizer({ cooldown: 0 });
    const gestures = [];
    recognizer.onGesture = (name) => gestures.push(name);

    update(
      recognizer,
      0,
      { pinched: true, handedness: 'right' },
      { pinched: false, handedness: 'left' }
    );
    update(
      recognizer,
      0.1,
      { pinched: true, handedness: 'right' },
      { pinched: false, handedness: 'left' }
    );

    expect(gestures).toContain('okSign');
  });

  it('respects cooldown between gestures', () => {
    const recognizer = new HandGestureRecognizer({ cooldown: 0.5 });
    const gestures = [];
    recognizer.onGesture = (name) => gestures.push(name);

    // Initialize at t=0, then perform a valid gesture after the cooldown window.
    update(
      recognizer,
      0,
      { position: new THREE.Vector3(-0.3, 0, 0), pinched: true },
      { position: new THREE.Vector3(0.3, 0, 0), pinched: true }
    );
    update(
      recognizer,
      0.6,
      { position: new THREE.Vector3(-0.1, 0, 0), pinched: true },
      { position: new THREE.Vector3(0.1, 0, 0), pinched: true }
    );
    // Second motion occurs inside the cooldown window and must be ignored.
    update(
      recognizer,
      0.8,
      { position: new THREE.Vector3(-0.05, 0, 0), pinched: true },
      { position: new THREE.Vector3(0.05, 0, 0), pinched: true }
    );

    expect(gestures.filter((g) => g === 'pinchTogether').length).toBe(1);
  });

  it('does not fire when hands are missing or invalid', () => {
    const recognizer = new HandGestureRecognizer({ cooldown: 0 });
    recognizer.onGesture = vi.fn();
    recognizer.hands = [];
    recognizer.update(0.1, 0.1);
    expect(recognizer.onGesture).not.toHaveBeenCalled();
  });

  it('exposes lastGesture after recognition', () => {
    const recognizer = new HandGestureRecognizer({ cooldown: 0 });
    recognizer.onGesture = () => {};
    update(recognizer, 0, { pinched: false }, { pinched: false });
    update(recognizer, 0.1, { pinched: true }, { pinched: true });
    expect(recognizer.lastGesture).toBe('bothPinched');
  });
});

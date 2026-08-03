import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { ControllerPointer } from '../src/vr/Controllers.js';
import { HandPointer } from '../src/vr/Hands.js';

/**
 * Mock XR hand space with EventTarget semantics.
 */
function makeMockHandSpace({ hasJoints = true } = {}) {
  const listeners = {};
  const joints = hasJoints
    ? {
        'index-finger-tip': {},
        'thumb-tip': {},
        wrist: {},
      }
    : null;
  const space = {
    joints,
    addEventListener(name, fn) {
      listeners[name] = listeners[name] || [];
      listeners[name].push(fn);
    },
    removeEventListener(name, fn) {
      listeners[name] = (listeners[name] || []).filter((f) => f !== fn);
    },
    dispatchEvent(event) {
      (listeners[event.type] || []).forEach((fn) => fn(event));
    },
    add(obj) {
      this.children = this.children || [];
      this.children.push(obj);
    },
  };
  return space;
}

/**
 * Mock renderer with a hand accessor.
 */
function makeMockRenderer({ handSpace } = {}) {
  return {
    xr: {
      getController(index) {
        return new THREE.Group();
      },
      getHand(index) {
        return handSpace || makeMockHandSpace();
      },
    },
  };
}

/**
 * Mock XR frame that returns joint poses based on a transform map.
 * @param {Object} jointMap - name -> XRJointSpace instance mapping from the hand.
 * @param {Object} jointPositions - name -> {x,y,z} position mapping.
 */
function makeMockFrame(jointMap, jointPositions) {
  return {
    getJointPose(joint, _refSpace) {
      for (const [name, instance] of Object.entries(jointMap)) {
        if (joint === instance) {
          const pos = jointPositions[name];
          if (!pos) return null;
          return {
            transform: {
              position: new DOMPointReadOnly(pos.x, pos.y, pos.z),
            },
          };
        }
      }
      return null;
    },
  };
}

// Minimal DOMPointReadOnly mock for tests where the global is absent.
if (typeof DOMPointReadOnly === 'undefined') {
  globalThis.DOMPointReadOnly = class DOMPointReadOnly {
    constructor(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.w = 1;
    }
  };
}

describe('ControllerPointer', () => {
  it('returns a valid ray from the controller world pose', () => {
    const renderer = makeMockRenderer();
    const controller = new ControllerPointer(renderer, 0);

    // Place the controller group in world space.
    controller.group.position.set(1, 2, 3);
    controller.group.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    controller.group.updateMatrixWorld(true);

    const ray = controller.getRay(new THREE.Ray());

    expect(ray.origin.x).toBeCloseTo(1);
    expect(ray.origin.y).toBeCloseTo(2);
    expect(ray.origin.z).toBeCloseTo(3);
    expect(ray.direction.length()).toBeCloseTo(1);
  });

  it('sanitizes NaN/Infinity poses to safe defaults', () => {
    const renderer = makeMockRenderer();
    const controller = new ControllerPointer(renderer, 0);

    // Corrupt the world matrices with NaN values as Quest Browser can do
    // transiently before tracking lock.
    controller.group.position.set(NaN, NaN, NaN);
    controller.group.updateMatrixWorld(true);

    const ray = controller.getRay(new THREE.Ray());

    expect(Number.isFinite(ray.origin.x)).toBe(true);
    expect(Number.isFinite(ray.origin.y)).toBe(true);
    expect(Number.isFinite(ray.origin.z)).toBe(true);
    expect(Number.isFinite(ray.direction.x)).toBe(true);
  });

  it('captures handedness from the connected event', () => {
    const renderer = makeMockRenderer();
    const controller = new ControllerPointer(renderer, 0);
    expect(controller.handedness).toBe('none');

    controller.group.dispatchEvent({
      type: 'connected',
      data: { handedness: 'right' },
    });

    expect(controller.handedness).toBe('right');
  });
});

describe('HandPointer', () => {
  it('marks joints valid when valid XRJointSpace joints are connected', () => {
    // Simulate a runtime that exposes XRJointSpace globally.
    globalThis.XRJointSpace = class XRJointSpace {};
    const space = makeMockHandSpace();
    // Convert plain objects to XRJointSpace instances.
    for (const key of Object.keys(space.joints)) {
      space.joints[key] = new XRJointSpace();
    }

    const renderer = makeMockRenderer({ handSpace: space });
    const hand = new HandPointer(renderer, 0);

    expect(hand.jointsValid).toBe(true);

    delete globalThis.XRJointSpace;
  });

  it('keeps joints invalid when joints are missing', () => {
    const space = makeMockHandSpace({ hasJoints: false });
    const renderer = makeMockRenderer({ handSpace: space });
    const hand = new HandPointer(renderer, 0);

    expect(hand.jointsValid).toBe(false);
  });

  it('detects pinch when index tip and thumb are close', () => {
    globalThis.XRJointSpace = class XRJointSpace {};
    const space = makeMockHandSpace();
    const jointInstances = {};
    for (const key of Object.keys(space.joints)) {
      jointInstances[key] = new XRJointSpace();
      space.joints[key] = jointInstances[key];
    }

    const renderer = makeMockRenderer({ handSpace: space });
    const hand = new HandPointer(renderer, 0);

    const frame = makeMockFrame(jointInstances, {
      'index-finger-tip': { x: 0, y: 0, z: 0 },
      'thumb-tip': { x: 0.01, y: 0, z: 0 },
      wrist: { x: 0, y: -0.1, z: 0 },
    });

    hand.update(frame, {});
    expect(hand.isPinched()).toBe(true);
    expect(hand.pinchDistance).toBeLessThan(0.04);

    delete globalThis.XRJointSpace;
  });

  it('releases pinch when fingers move apart', () => {
    globalThis.XRJointSpace = class XRJointSpace {};
    const space = makeMockHandSpace();
    const jointInstances = {};
    for (const key of Object.keys(space.joints)) {
      jointInstances[key] = new XRJointSpace();
      space.joints[key] = jointInstances[key];
    }

    const renderer = makeMockRenderer({ handSpace: space });
    const hand = new HandPointer(renderer, 0);

    const closeFrame = makeMockFrame(jointInstances, {
      'index-finger-tip': { x: 0, y: 0, z: 0 },
      'thumb-tip': { x: 0.01, y: 0, z: 0 },
      wrist: { x: 0, y: -0.1, z: 0 },
    });
    hand.update(closeFrame, {});
    expect(hand.isPinched()).toBe(true);

    const farFrame = makeMockFrame(jointInstances, {
      'index-finger-tip': { x: 0, y: 0, z: 0 },
      'thumb-tip': { x: 0.2, y: 0, z: 0 },
      wrist: { x: 0, y: -0.1, z: 0 },
    });
    hand.update(farFrame, {});
    expect(hand.isPinched()).toBe(false);

    delete globalThis.XRJointSpace;
  });

  it('computes the pointing ray from the index metacarpal when available', () => {
    globalThis.XRJointSpace = class XRJointSpace {};
    const space = makeMockHandSpace();
    const jointInstances = {};
    for (const key of Object.keys(space.joints)) {
      jointInstances[key] = new XRJointSpace();
      space.joints[key] = jointInstances[key];
    }

    const renderer = makeMockRenderer({ handSpace: space });
    const hand = new HandPointer(renderer, 0);

    const frame = makeMockFrame(jointInstances, {
      'index-finger-tip': { x: 0, y: 0, z: 0 },
      'thumb-tip': { x: 0.2, y: 0, z: 0 },
      'index-finger-metacarpal': { x: 0, y: -0.03, z: 0.1 },
      wrist: { x: 0, y: -0.2, z: 0.2 },
    });

    hand.update(frame, {});

    const ray = hand.getRay(new THREE.Ray());
    expect(ray.origin.x).toBeCloseTo(0, 3);
    expect(ray.origin.y).toBeCloseTo(0, 3);
    expect(ray.origin.z).toBeCloseTo(0, 3);
    // Direction should point roughly forward (-Z) and slightly up, not strongly
    // influenced by the far-behind wrist position.
    expect(ray.direction.z).toBeLessThan(-0.5);

    delete globalThis.XRJointSpace;
  });

  it('isolates update errors and hides the ray', () => {
    globalThis.XRJointSpace = class XRJointSpace {};
    const space = makeMockHandSpace();
    for (const key of Object.keys(space.joints)) {
      space.joints[key] = new XRJointSpace();
    }

    const renderer = makeMockRenderer({ handSpace: space });
    const hand = new HandPointer(renderer, 0);
    hand.ray.visible = true;

    const badFrame = {
      getJointPose() {
        throw new Error('simulated joint pose error');
      },
    };

    expect(() => hand.update(badFrame, {})).not.toThrow();
    expect(hand.ray.visible).toBe(false);

    delete globalThis.XRJointSpace;
  });

  it('falls back to session.inputSources when no connected event fires', () => {
    globalThis.XRJointSpace = class XRJointSpace {};

    const indexTip = new XRJointSpace();
    const thumbTip = new XRJointSpace();
    const xrHandMap = new Map([
      ['index-finger-tip', indexTip],
      ['thumb-tip', thumbTip],
    ]);

    const space = makeMockHandSpace({ hasJoints: false });
    space.joints = null;

    const renderer = makeMockRenderer({ handSpace: space });
    const hand = new HandPointer(renderer, 0);

    const session = {
      inputSources: [{ handedness: 'right', hand: xrHandMap }],
    };

    const frame = {
      getJointPose(joint, _refSpace) {
        if (joint === indexTip) {
          return { transform: { position: new DOMPointReadOnly(0, 0, 0) } };
        }
        if (joint === thumbTip) {
          return { transform: { position: new DOMPointReadOnly(0.01, 0, 0) } };
        }
        return null;
      },
    };

    hand.update(frame, {}, session);

    expect(hand.jointsValid).toBe(true);
    expect(hand.isPinched()).toBe(true);
    expect(hand.handedness).toBe('right');

    delete globalThis.XRJointSpace;
  });

  it('extracts joints from a Map-like XRHand object on connected', () => {
    globalThis.XRJointSpace = class XRJointSpace {};

    const xrHandMap = new Map([
      ['index-finger-tip', new XRJointSpace()],
      ['thumb-tip', new XRJointSpace()],
      ['wrist', new XRJointSpace()],
    ]);

    const space = makeMockHandSpace({ hasJoints: false });
    space.joints = null;

    const renderer = makeMockRenderer({ handSpace: space });
    const hand = new HandPointer(renderer, 0);

    // Trigger a Quest-Browser-style connected event where hand is a Map.
    space.dispatchEvent({
      type: 'connected',
      data: { handedness: 'left', hand: xrHandMap },
    });

    expect(hand.jointsValid).toBe(true);
    expect(Object.keys(hand.joints)).toContain('index-finger-tip');
    expect(Object.keys(hand.joints)).toContain('thumb-tip');

    delete globalThis.XRJointSpace;
  });

  it('extracts joints from an iterable joint collection on connected', () => {
    globalThis.XRJointSpace = class XRJointSpace {};

    const jointEntries = [
      ['index-finger-tip', new XRJointSpace()],
      ['thumb-tip', new XRJointSpace()],
    ];
    const iterableHand = {
      entries() {
        return jointEntries[Symbol.iterator]();
      },
      get(name) {
        return jointEntries.find(([n]) => n === name)?.[1];
      },
    };

    const space = makeMockHandSpace({ hasJoints: false });
    const renderer = makeMockRenderer({ handSpace: space });
    const hand = new HandPointer(renderer, 0);

    space.dispatchEvent({
      type: 'connected',
      data: { handedness: 'right', hand: iterableHand },
    });

    expect(hand.jointsValid).toBe(true);
    expect(hand.joints['thumb-tip']).toBeInstanceOf(XRJointSpace);

    delete globalThis.XRJointSpace;
  });

  it('anchors the ray to a moving hand instead of the world origin', () => {
    globalThis.XRJointSpace = class XRJointSpace {};
    const space = makeMockHandSpace();
    const jointInstances = {};
    for (const key of Object.keys(space.joints)) {
      jointInstances[key] = new XRJointSpace();
      space.joints[key] = jointInstances[key];
    }

    const renderer = makeMockRenderer({ handSpace: space });
    const hand = new HandPointer(renderer, 0);

    const frameA = makeMockFrame(jointInstances, {
      'index-finger-tip': { x: 0.1, y: 0.2, z: -0.3 },
      'thumb-tip': { x: 0.12, y: 0.2, z: -0.3 },
      'index-finger-metacarpal': { x: 0.1, y: 0.17, z: -0.25 },
      wrist: { x: 0.1, y: 0.1, z: -0.2 },
    });
    hand.update(frameA, {});

    const rayA = hand.getRay(new THREE.Ray());
    expect(rayA.origin.x).toBeCloseTo(0.1, 3);
    expect(rayA.origin.y).toBeCloseTo(0.2, 3);

    const frameB = makeMockFrame(jointInstances, {
      'index-finger-tip': { x: 0.4, y: 0.6, z: -0.1 },
      'thumb-tip': { x: 0.42, y: 0.6, z: -0.1 },
      'index-finger-metacarpal': { x: 0.4, y: 0.57, z: -0.05 },
      wrist: { x: 0.4, y: 0.5, z: 0 },
    });
    hand.update(frameB, {});

    const rayB = hand.getRay(new THREE.Ray());
    expect(rayB.origin.x).toBeCloseTo(0.4, 3);
    expect(rayB.origin.y).toBeCloseTo(0.6, 3);

    delete globalThis.XRJointSpace;
  });

  it('keeps the ray at the last valid pose during a transient tracking-loss frame', () => {
    globalThis.XRJointSpace = class XRJointSpace {};
    const space = makeMockHandSpace();
    const jointInstances = {};
    for (const key of Object.keys(space.joints)) {
      jointInstances[key] = new XRJointSpace();
      space.joints[key] = jointInstances[key];
    }

    const renderer = makeMockRenderer({ handSpace: space });
    const hand = new HandPointer(renderer, 0);

    const goodFrame = makeMockFrame(jointInstances, {
      'index-finger-tip': { x: 0.2, y: 0.3, z: -0.4 },
      'thumb-tip': { x: 0.22, y: 0.3, z: -0.4 },
      'index-finger-metacarpal': { x: 0.2, y: 0.27, z: -0.35 },
      wrist: { x: 0.2, y: 0.2, z: -0.3 },
    });
    hand.update(goodFrame, {});
    expect(hand.isPoseValid()).toBe(true);

    const badFrame = { getJointPose: () => null };
    hand.update(badFrame, {});

    const ray = hand.getRay(new THREE.Ray());
    expect(ray.origin.x).toBeCloseTo(0.2, 3);
    expect(ray.origin.y).toBeCloseTo(0.3, 3);
    expect(ray.origin.z).toBeCloseTo(-0.4, 3);

    delete globalThis.XRJointSpace;
  });

  it('resets pinchDistance to Infinity when joints are invalid', () => {
    globalThis.XRJointSpace = class XRJointSpace {};
    const space = makeMockHandSpace();
    const jointInstances = {};
    for (const key of Object.keys(space.joints)) {
      jointInstances[key] = new XRJointSpace();
      space.joints[key] = jointInstances[key];
    }

    const renderer = makeMockRenderer({ handSpace: space });
    const hand = new HandPointer(renderer, 0);

    const frame = makeMockFrame(jointInstances, {
      'index-finger-tip': { x: 0, y: 0, z: 0 },
      'thumb-tip': { x: 0.01, y: 0, z: 0 },
      wrist: { x: 0, y: -0.1, z: 0 },
    });

    hand.update(frame, {});
    expect(hand.pinchDistance).toBeLessThan(0.04);

    // Simulate a disconnect/tracking-loss event.
    space.dispatchEvent({ type: 'disconnected' });
    expect(hand.jointsValid).toBe(false);

    hand.update(frame, {});
    expect(hand.pinchDistance).toBe(Infinity);

    delete globalThis.XRJointSpace;
  });

  it('dispatches pinchstart and pinchend events', () => {
    globalThis.XRJointSpace = class XRJointSpace {};
    const space = makeMockHandSpace();
    const jointInstances = {};
    for (const key of Object.keys(space.joints)) {
      jointInstances[key] = new XRJointSpace();
      space.joints[key] = jointInstances[key];
    }

    const renderer = makeMockRenderer({ handSpace: space });
    const hand = new HandPointer(renderer, 0);

    let started = false;
    let ended = false;
    hand.onPinchStart = () => (started = true);
    hand.onPinchEnd = () => (ended = true);

    const closeFrame = makeMockFrame(jointInstances, {
      'index-finger-tip': { x: 0, y: 0, z: 0 },
      'thumb-tip': { x: 0.01, y: 0, z: 0 },
      wrist: { x: 0, y: -0.1, z: 0 },
    });
    const farFrame = makeMockFrame(jointInstances, {
      'index-finger-tip': { x: 0, y: 0, z: 0 },
      'thumb-tip': { x: 0.2, y: 0, z: 0 },
      wrist: { x: 0, y: -0.1, z: 0 },
    });

    hand.update(closeFrame, {});
    expect(started).toBe(true);

    hand.update(farFrame, {});
    expect(ended).toBe(true);

    delete globalThis.XRJointSpace;
  });
});

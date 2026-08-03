/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HandGestureRecognizer } from '../src/vr/interactions/HandGestureRecognizer.js';
import * as THREE from 'three';

describe('HandGestureRecognizer intent inference', () => {
  let recognizer;
  let gestures;

  beforeEach(() => {
    gestures = [];
    recognizer = new HandGestureRecognizer({
      cooldown: 0,
      onGesture: (name, ctx) => gestures.push({ name, ctx }),
    });
  });

  function makeHand(position, direction, pinched) {
    return {
      position,
      getHandTransform: (pos, q) => {
        pos.copy(position);
        q.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction.clone().normalize());
      },
      isPinched: () => pinched,
      rayOrigin: position,
      rayDirection: direction,
    };
  }

  it('emits pauseResume after both hands pinched close together for the hold threshold', () => {
    const close = new THREE.Vector3(0, 0, 0);
    const handA = makeHand(close.clone(), new THREE.Vector3(0, 0, -1), true);
    const handB = makeHand(close.clone().add(new THREE.Vector3(0.05, 0, 0)), new THREE.Vector3(0, 0, -1), true);
    recognizer.setHands([handA, handB]);

    // First frame initializes state.
    recognizer.update(0.016, 0);
    // Hold still for the threshold duration.
    for (let t = 0; t <= 1.0; t += 0.016) {
      recognizer.update(0.016, t);
    }

    const pause = gestures.find((g) => g.name === 'pauseResume');
    expect(pause).toBeDefined();
    expect(pause.ctx.openHands).toBe(false);
  });

  it('reports openHands context for pushForward', () => {
    const handA = makeHand(new THREE.Vector3(-0.2, 1, -0.2), new THREE.Vector3(0, 0, -1), false);
    const handB = makeHand(new THREE.Vector3(0.2, 1, -0.2), new THREE.Vector3(0, 0, -1), false);
    recognizer.setHands([handA, handB]);
    recognizer.update(0.016, 0);

    // Move both hands forward.
    handA.position.z -= 0.15;
    handB.position.z -= 0.15;
    recognizer.update(0.016, 0.016);

    const push = gestures.find((g) => g.name === 'pushForward');
    expect(push).toBeDefined();
    expect(push.ctx.openHands).toBe(true);
  });

  it('does not emit pauseResume if hands are pinched but far apart', () => {
    const handA = makeHand(new THREE.Vector3(-0.5, 0, 0), new THREE.Vector3(0, 0, -1), true);
    const handB = makeHand(new THREE.Vector3(0.5, 0, 0), new THREE.Vector3(0, 0, -1), true);
    recognizer.setHands([handA, handB]);
    recognizer.update(0.016, 0);
    for (let t = 0; t <= 1.0; t += 0.016) {
      recognizer.update(0.016, t);
    }
    expect(gestures.some((g) => g.name === 'pauseResume')).toBe(false);
  });
});

describe('World intent inference integration', () => {
  let world;

  beforeEach(async () => {
    vi.resetModules();
    const { World } = await import('../src/vr/World.js');
    world = new World();
    await new Promise((r) => setTimeout(r, 50));
  });

  afterEach(() => {
    world?.engine?.desktop?.disable?.();
  });

  it('toggles input pause on _togglePauseInput', () => {
    expect(world._inputPaused).toBeFalsy();
    world._togglePauseInput();
    expect(world._inputPaused).toBe(true);
    world._togglePauseInput();
    expect(world._inputPaused).toBe(false);
  });

  it('ignores gestures while input is paused', () => {
    const logSpy = vi.spyOn(world.vrConsole, 'log').mockImplementation(() => {});
    world._inputPaused = true;
    world._onGesture('swipeRight', { openHands: true });
    expect(logSpy).toHaveBeenCalledWith('log', ['Input paused — gesture ignored']);
  });

  it('resets view on open-hand pushForward', () => {
    const teleportSpy = vi.spyOn(world.engine.locomotion, 'teleportToAnchor').mockReturnValue(true);
    world._onGesture('pushForward', { openHands: true });
    expect(teleportSpy).toHaveBeenCalledWith('overview');
  });

  it('resets data operation on pinched pushForward', () => {
    const resetSpy = vi.spyOn(world, 'resetDataOperation').mockImplementation(() => {});
    world._onGesture('pushForward', { openHands: false });
    expect(resetSpy).toHaveBeenCalled();
  });

  it('updates input context flags from hand proximity', () => {
    world._updateInputContext();
    expect(typeof world._handNearArtefact).toBe('boolean');
    expect(typeof world._handNearWheelMenu).toBe('boolean');
  });
});

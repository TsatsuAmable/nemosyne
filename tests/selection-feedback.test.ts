// @ts-nocheck
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { SelectionFeedback } from '../src/vr/audio/SelectionFeedback.ts';

function makeMockAudioContext() {
  const oscillators = [];
  const gains = [];
  return {
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createOscillator: vi.fn(() => {
      const osc = {
        type: 'sine',
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(osc);
      return osc;
    }),
    createGain: vi.fn(() => {
      const gain = {
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      };
      gains.push(gain);
      return gain;
    }),
    _oscillators: oscillators,
    _gains: gains,
  };
}

describe('SelectionFeedback', () => {
  let feedback;
  let mockCtx;

  beforeEach(() => {
    mockCtx = makeMockAudioContext();
    vi.stubGlobal('window', {
      AudioContext: vi.fn(function () {
        return mockCtx;
      }),
    });
    feedback = new SelectionFeedback({ volume: 0.2 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('initializes an AudioContext when available', () => {
    expect(feedback.audioContext).toBe(mockCtx);
  });

  it('plays a select tone with two oscillators', () => {
    vi.useFakeTimers();
    feedback.playSelect();
    expect(mockCtx._oscillators.length).toBe(1);
    vi.advanceTimersByTime(100);
    expect(mockCtx._oscillators.length).toBe(2);
  });

  it('plays a hover tone', () => {
    feedback.playHover();
    expect(mockCtx._oscillators.length).toBe(1);
  });

  it('flashes the pointer ray color', () => {
    const rayMat = new THREE.LineBasicMaterial({ color: 0xff00cc, opacity: 0.5 });
    const ray = new THREE.Line(new THREE.BufferGeometry(), rayMat);
    const pointer = { ray };

    feedback.flashPointer(pointer, 0x00ffcc, 50);
    expect(rayMat.color.getHex()).toBe(0x00ffcc);
    expect(rayMat.opacity).toBeGreaterThan(0.5);
  });

  it('spawns and removes a hit marker', async () => {
    const scene = new THREE.Scene();
    const pos = new THREE.Vector3(1, 2, 3);

    feedback.showHitMarker(scene, pos, 0xff0000, 10);
    expect(scene.children.length).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(scene.children.length).toBe(0);
  });

  it('does not crash when AudioContext is unavailable', () => {
    vi.stubGlobal('window', {});
    const fb = new SelectionFeedback();
    expect(fb.audioContext).toBeNull();
    expect(() => fb.playSelect()).not.toThrow();
  });

  it('defaults all feedback channels to enabled', () => {
    expect(feedback.audioEnabled).toBe(true);
    expect(feedback.hapticEnabled).toBe(true);
    expect(feedback.visualEnabled).toBe(true);
  });

  it('can disable and re-enable individual feedback channels', () => {
    feedback.setToggles({ audio: false, haptic: false, visual: false });
    expect(feedback.audioEnabled).toBe(false);
    expect(feedback.hapticEnabled).toBe(false);
    expect(feedback.visualEnabled).toBe(false);

    feedback.setToggles({ audio: true });
    expect(feedback.audioEnabled).toBe(true);
  });

  it('skips audio when audioEnabled is false', () => {
    feedback.setToggles({ audio: false });
    feedback.playHover();
    expect(mockCtx._oscillators.length).toBe(0);
  });

  it('skips visual flashes when visualEnabled is false', () => {
    feedback.setToggles({ visual: false });
    const rayMat = new THREE.LineBasicMaterial({ color: 0xff00cc, opacity: 0.5 });
    const ray = new THREE.Line(new THREE.BufferGeometry(), rayMat);

    feedback.flashPointer({ ray }, 0x00ffcc, 50);
    expect(rayMat.color.getHex()).toBe(0xff00cc);
    expect(rayMat.opacity).toBe(0.5);
  });

  it('plays a gesture-specific tone for each mapped gesture', () => {
    for (const gesture of [
      'bothPinched',
      'pinchTogether',
      'pinchApart',
      'swipeRight',
      'swipeLeft',
      'sliceUp',
      'sliceDown',
      'scoopUp',
      'pushForward',
      'rotateCW',
      'rotateCCW',
      'okSign',
    ]) {
      const before = mockCtx._oscillators.length;
      feedback.playGestureTone(gesture);
      expect(mockCtx._oscillators.length).toBeGreaterThan(before);
      // Reset oscillator list so each gesture is independently verified.
      mockCtx._oscillators.length = 0;
    }
  });

  it('plays a core tone for each lens mode', () => {
    for (const mode of ['off', 'statistical', 'anomaly']) {
      const before = mockCtx._oscillators.length;
      feedback.playCoreTone(mode);
      expect(mockCtx._oscillators.length).toBeGreaterThan(before);
      mockCtx._oscillators.length = 0;
    }
  });

  it('plays a portal tone for each zone and reset', () => {
    feedback.playPortalTone('DEEP_NET', 'anomaly');
    expect(mockCtx._oscillators.length).toBeGreaterThan(0);
    mockCtx._oscillators.length = 0;

    feedback.playPortalTone('LOCAL_MATRIX', 'reset');
    expect(mockCtx._oscillators.length).toBeGreaterThan(0);
  });

  it('pulses a haptic actuator when one is supplied', () => {
    feedback.setToggles({ haptic: true });
    const pulse = vi.fn().mockResolvedValue(undefined);
    const source = { gamepad: { hapticActuators: [{ pulse }] } };

    feedback.playHaptic(0.7, 60, source);
    expect(pulse).toHaveBeenCalledWith(0.7, 60);
  });

  it('does not pulse haptics when hapticEnabled is false', () => {
    feedback.setToggles({ haptic: false });
    const pulse = vi.fn().mockResolvedValue(undefined);
    const source = { gamepad: { hapticActuators: [{ pulse }] } };

    feedback.playHaptic(0.5, 40, source);
    expect(pulse).not.toHaveBeenCalled();
  });
});

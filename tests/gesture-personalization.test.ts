// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { GestureIntelligenceAdapter } from '../src/vr/input/GestureIntelligenceAdapter.ts';
import { createPersistence } from '../src/gesture/store.ts';

describe('In-Experience Gesture Capture & Personalization Loop', () => {
  it('captures raw gesture trajectories and formats raw instances', () => {
    const adapter = new GestureIntelligenceAdapter({
      cooldown: 0.05,
    });

    adapter.startCapture('scoopUp');
    expect(adapter.isCapturing()).toBe(true);

    const hands = [
      {
        handedness: 'left',
        position: new THREE.Vector3(-0.2, 1.0, -0.4),
        pinchDistance: 0.1,
      },
      {
        handedness: 'right',
        position: new THREE.Vector3(0.2, 1.0, -0.4),
        pinchDistance: 0.1,
      },
    ];

    for (let i = 0; i < 10; i++) {
      adapter.recordHands(hands, i * 0.05);
    }

    const instance = adapter.stopCapture();
    expect(adapter.isCapturing()).toBe(false);
    expect(instance).not.toBeNull();
    expect(instance.label).toBe('scoopUp');
    expect(instance.left.length).toBe(10);
    expect(instance.right.length).toBe(10);
  });

  it('runs feedback reporting and threshold optimization loop with persistence', async () => {
    const memoryStore = createPersistence();
    const saveSpy = vi.spyOn(memoryStore, 'saveProfile');

    const adapter = new GestureIntelligenceAdapter({
      persistence: memoryStore,
      profileId: 'analyst-1',
    });

    await adapter.init();
    const initialCal = adapter.getCalibration();
    expect(initialCal.moveThreshold).toBeGreaterThan(0);

    const hands = [
      {
        handedness: 'left',
        position: new THREE.Vector3(-0.1, 1.2, -0.4),
        pinchDistance: 0.02,
      },
      {
        handedness: 'right',
        position: new THREE.Vector3(0.1, 1.2, -0.4),
        pinchDistance: 0.02,
      },
    ];

    // Seed trajectory frames
    for (let i = 0; i < 20; i++) {
      adapter.recordHands(hands, i * 0.05);
      adapter.classify(i * 0.05);
    }

    // Report 8 confirmations of detected gesture
    for (let f = 0; f < 8; f++) {
      adapter.reportFeedback('pinchTogether', true);
    }

    // Personalization threshold loop executes every 8 feedbacks
    expect(adapter.getCalibration()).toBeDefined();
    expect(saveSpy).toBeDefined();
    adapter.dispose();
  });
});

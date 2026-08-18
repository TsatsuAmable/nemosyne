// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { GestureIntelligenceAdapter } from '../src/vr/input/GestureIntelligenceAdapter.ts';
import { WorldInputCoordinator } from '../src/vr/coordinators/WorldInputCoordinator.ts';
import { WorldEventBus, WorldTopics } from '../src/utils/EventBus.ts';

describe('Gesture Intelligence Host Integration & Dispatch', () => {
  it('instantiates GestureIntelligenceAdapter and records spatial hand samples', async () => {
    const onGesture = vi.fn();
    const adapter = new GestureIntelligenceAdapter({
      cooldown: 0.1,
      confidenceThreshold: 0.4,
      onGesture,
    });

    const status = await adapter.init();
    expect(status.init).toBe('ready');
    expect(status.supportedGestures).toContain('pinchTogether');
    expect(status.supportedGestures).toContain('scoopUp');

    const hands = [
      {
        handedness: 'left',
        position: new THREE.Vector3(-0.2, 1.2, -0.4),
        pinchDistance: 0.08,
      },
      {
        handedness: 'right',
        position: new THREE.Vector3(0.2, 1.2, -0.4),
        pinchDistance: 0.08,
      },
    ];

    for (let i = 0; i < 10; i++) {
      adapter.recordHands(hands, i * 0.05);
      const res = adapter.classify(i * 0.05);
      expect(res).toBeDefined();
      expect(res.provenance.source).toBe('heuristic');
      expect(res.provenance.sampleCount).toBeGreaterThanOrEqual(1);
    }

    adapter.dispose();
  });

  it('wires GestureIntelligenceAdapter cleanly into WorldInputCoordinator', () => {
    const eventBus = new WorldEventBus();
    const gestureSpy = vi.fn();
    eventBus.on(WorldTopics.GESTURE_RECOGNIZED, gestureSpy);

    const engineMock = {
      input: {
        hands: [
          {
            handedness: 'left',
            position: new THREE.Vector3(-0.15, 1.2, -0.4),
            pinchDistance: 0.02,
          },
          {
            handedness: 'right',
            position: new THREE.Vector3(0.15, 1.2, -0.4),
            pinchDistance: 0.02,
          },
        ],
      },
      addUpdatable: vi.fn(),
      removeUpdatable: vi.fn(),
    };

    const coordinator = new WorldInputCoordinator(engineMock, eventBus, {
      callbacks: {
        onFilterAction: vi.fn(),
      },
    });

    expect(coordinator.gestureAdapter).toBeDefined();
    expect(coordinator.gestureAdapter.engine).toBeDefined();

    // Tick coordinate updates
    coordinator.update(0.016, 0.1);
    expect(coordinator.gestureAdapter.lastProvenance).not.toBeNull();
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ContextualTaskSurface } from '../../src/vr/ui/ContextualTaskSurface.ts';
import { HandWheelMenu } from '../../src/vr/ui/HandWheelMenu.ts';
import { WorldInputCoordinator } from '../../src/vr/coordinators/WorldInputCoordinator.ts';
import { WorldEventBus } from '../../src/utils/EventBus.ts';
import type { PointerLike } from '../../src/vr/coordinators/types.ts';

class MockPointer implements PointerLike {
  index: number;
  handedness = 'right';
  jointsValid = false;
  rayVisible = true;
  rayLength = 4;
  position = new THREE.Vector3();
  direction = new THREE.Vector3(0, 0, -1);
  isNear = false;

  constructor(index: number) {
    this.index = index;
  }

  getRay(target: THREE.Ray): THREE.Ray {
    target.origin.copy(this.position);
    target.direction.copy(this.direction);
    return target;
  }

  setRayVisible(visible: boolean): void {
    this.rayVisible = visible;
  }

  setRayLength(length: number): void {
    this.rayLength = length;
  }
}

describe('P1-U4 Contextual Task Surface', () => {
  const mockEngine = {
    camera: new THREE.PerspectiveCamera(),
    scene: new THREE.Scene(),
    input: {
      feedback: {
        playSelect: vi.fn(),
        playHover: vi.fn(),
        playGestureTone: vi.fn(),
        playHaptic: vi.fn(),
      },
      pointers: [],
    },
    addUpdatable: vi.fn(),
    addHudObject: vi.fn(),
    removeUpdatable: vi.fn(),
    removeHudObject: vi.fn(),
  } as any;

  it('initializes and disables buttons when there is no active selection', () => {
    const surface = new ContextualTaskSurface(mockEngine);
    surface.showAtNode(null, null);

    const inspectBtn = (surface as any)._buttons.get('inspect');
    expect(inspectBtn.isDisabled).toBe(true);
    expect(inspectBtn.disabledReason).toBe('No active selection to inspect');

    const compareBtn = (surface as any)._buttons.get('compare');
    expect(compareBtn.isDisabled).toBe(true);
    expect(compareBtn.disabledReason).toBe('Select a second node to compare');
  });

  it('updates verb states dynamically based on topology', () => {
    const surface = new ContextualTaskSurface(mockEngine);

    // Tabular topology
    surface.showAtNode(new THREE.Object3D(), { id: 'node_1', topology: 'TABULAR' });

    const challengeBtn = (surface as any)._buttons.get('challenge');
    expect(challengeBtn.isDisabled).toBe(true);
    expect(challengeBtn.disabledReason).toBe('Challenge requires network/hierarchical model');

    // Graph topology
    surface.showAtNode(new THREE.Object3D(), { id: 'node_1', topology: 'GRAPH' });
    expect(challengeBtn.isDisabled).toBe(false);
  });
});

describe('HandWheelMenu Panel Parity', () => {
  const mockEngine = {
    camera: new THREE.PerspectiveCamera(),
    scene: new THREE.Scene(),
    input: {
      feedback: {
        playSelect: vi.fn(),
        playHover: vi.fn(),
      },
      pointers: {
        getBestPointerRay: () => new THREE.Ray(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)),
      },
    },
    addUpdatable: vi.fn(),
    addHudObject: vi.fn(),
  } as any;

  it('implements standard pointer event handlers', () => {
    const dominantHand = { handedness: 'right' } as any;
    const menu = new HandWheelMenu(mockEngine, dominantHand, {
      menu: [
        {
          id: 'TEST_CAT',
          label: 'Test Category',
          icon: '🔵',
          items: [{ id: 'test_action', label: 'Test Action', icon: '⚡', callback: vi.fn() }],
        },
      ],
    });
    menu.show();

    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1));
    const pointer = new MockPointer(0);

    // Down
    const downResult = menu.handlePointerDown(raycaster, pointer);
    expect(downResult).toBeDefined(); // Returns 'direct-touch' because category is hit

    // Move
    expect(() => menu.handlePointerMove(raycaster, pointer)).not.toThrow();

    // Up
    expect(() => menu.handlePointerUp(raycaster, pointer)).not.toThrow();
  });
});

describe('Gesture Suppression', () => {
  it('suppresses global gestures when direct touch or panel capture is active', () => {
    const eventBus = new WorldEventBus();
    const mockEngine = {
      camera: new THREE.PerspectiveCamera(),
      scene: new THREE.Scene(),
      input: {
        feedback: {
          playGestureTone: vi.fn(),
          playHaptic: vi.fn(),
        },
        pointers: [
          { isNear: true } // Pointer near active zone
        ],
        machine: {
          capturedPanel: null
        }
      },
      addUpdatable: vi.fn(),
      addHudObject: vi.fn(),
    } as any;

    const onApply = vi.fn();
    const onLog = vi.fn();

    const coordinator = new WorldInputCoordinator(mockEngine, eventBus, {
      callbacks: {
        onApplyOperation: onApply,
        onLog,
      },
    });

    // Send global gesture
    coordinator.onGesture('pinchTogether');

    // Should be suppressed and logged
    expect(onApply).not.toHaveBeenCalled();
    expect(onLog).toHaveBeenCalledWith("Gesture 'pinchTogether' suppressed: active direct interaction");
  });
});

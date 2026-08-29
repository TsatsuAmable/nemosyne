/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ContextualTaskSurface } from '../../src/vr/ui/ContextualTaskSurface.ts';
import { PanelBudgetController } from '../../src/vr/ui-system/PanelBudgetController.ts';
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

function createMockEngine() {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 3);
  return {
    camera,
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
}

describe('P1-U4 / P1-UV2 Contextual Task Surface', () => {
  it('initializes and exposes an explicit unavailable reason without a selection', () => {
    const surface = new ContextualTaskSurface(createMockEngine());
    surface.showAtNode(null, null);

    const inspectBtn = (surface as any)._buttons.get('inspect');
    expect(inspectBtn.isDisabled).toBe(true);
    expect(inspectBtn.disabledReason).toBe('Select an object');

    const compareBtn = (surface as any)._buttons.get('compare');
    expect(compareBtn.isDisabled).toBe(true);
    expect(compareBtn.disabledReason).toBe('Select an object');
  });

  it('updates verb states dynamically based on topology', () => {
    const surface = new ContextualTaskSurface(createMockEngine());

    surface.showAtNode(new THREE.Object3D(), { id: 'node_1', topology: 'TABULAR' });

    const challengeBtn = (surface as any)._buttons.get('challenge');
    expect(challengeBtn.isDisabled).toBe(true);
    expect(challengeBtn.disabledReason).toBe('Needs linked structure');

    surface.showAtNode(new THREE.Object3D(), { id: 'node_1', topology: 'GRAPH' });
    expect(challengeBtn.isDisabled).toBe(false);
    expect(challengeBtn.disabledReason).toBeUndefined();
  });

  it('converts the selected node world locus into analyst-anchor local space and follows motion', () => {
    const engine = createMockEngine();
    const root = new THREE.Scene();
    root.add(engine.camera);

    const analystAnchor = new THREE.Group();
    analystAnchor.position.set(5, 0.8, -1.5);
    root.add(analystAnchor);

    const node = new THREE.Object3D();
    node.position.set(-1.25, 1.1, -2.5);
    root.add(node);

    const surface = new ContextualTaskSurface(engine);
    analystAnchor.add(surface);
    root.updateMatrixWorld(true);

    surface.showAtNode(node, { id: 'node_1', topology: 'GRAPH' });
    root.updateMatrixWorld(true);

    const firstDistance = surface.getActiveNodeDistance();
    expect(firstDistance).not.toBeNull();
    expect(firstDistance!).toBeGreaterThan(0.15);
    expect(firstDistance!).toBeLessThan(0.35);

    const firstWorld = new THREE.Vector3();
    surface.getWorldPosition(firstWorld);
    node.position.x += 1;
    root.updateMatrixWorld(true);
    surface.update(1 / 60);
    root.updateMatrixWorld(true);

    const secondWorld = new THREE.Vector3();
    surface.getWorldPosition(secondWorld);
    const surfaceTravel = secondWorld.x - firstWorld.x;
    // The rail follows the 1 m node motion, but its small toward-camera offset
    // legitimately changes as the view vector changes. Assert physical tracking
    // rather than identical component displacement.
    expect(surfaceTravel).toBeGreaterThan(0.9);
    expect(surfaceTravel).toBeLessThan(1.1);
    expect(surface.getActiveNodeDistance()!).toBeLessThan(0.35);
  });

  it('uses the inspector budget slot and statefully replaces the previous context surface', () => {
    const engine = createMockEngine();
    const budget = new PanelBudgetController();
    engine.uiManager = { panelBudgetController: budget };

    const previous = new ContextualTaskSurface(engine);
    previous.budgetController = budget;
    previous.showAtNode(new THREE.Object3D(), { id: 'previous', topology: 'GRAPH' });
    const previousHide = vi.spyOn(previous, 'hide');

    const next = new ContextualTaskSurface(engine);
    next.showAtNode(new THREE.Object3D(), { id: 'next', topology: 'GRAPH' });

    expect(previousHide).toHaveBeenCalledTimes(1);
    expect(previous.visible).toBe(false);
    expect(budget.getRole(previous)).toBeNull();
    expect(budget.getRole(next)).toBe('inspector');
    expect(budget.activeBudgetCount).toBe(1);

    next.hide();
    expect(budget.getRole(next)).toBeNull();
    expect(budget.activeBudgetCount).toBe(0);
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

    const downResult = menu.handlePointerDown(raycaster, pointer);
    expect(downResult).toBeDefined();
    expect(() => menu.handlePointerMove(raycaster, pointer)).not.toThrow();
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
          { isNear: true }
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

    coordinator.onGesture('pinchTogether');

    expect(onApply).not.toHaveBeenCalled();
    expect(onLog).toHaveBeenCalledWith("Gesture 'pinchTogether' suppressed: active direct interaction");
  });
});

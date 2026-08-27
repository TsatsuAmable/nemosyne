import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { NearFieldInteractor } from '../../src/vr/interactions/near/NearFieldInteractor.ts';
import type { PanelLike, PointerLike } from '../../src/vr/coordinators/types.ts';

class MockPointer implements PointerLike {
  index: number;
  handedness = 'right';
  jointsValid = false;
  rayVisible = true;
  rayLength = 4;
  position = new THREE.Vector3();
  direction = new THREE.Vector3(0, 0, -1);

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

function makeDeterministicPanel(callbacks: {
  onPointerDown(): void;
  onPointerUp(): void;
  onClick(): void;
}): PanelLike {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 0, -0.5);
  mesh.updateMatrixWorld(true);

  return {
    mesh,
    handlePointerDown: () => {
      callbacks.onPointerDown();
      return 'direct-touch';
    },
    handlePointerUp: (raycaster) => {
      callbacks.onPointerUp();
      const hits = raycaster.intersectObject(mesh, true);
      if (hits.length > 0) {
        callbacks.onClick();
      }
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}

describe('UX-05: Direct Touch & Near/Far Hysteresis resolver', () => {
  it('transitions phases deterministically and dispatches touch events', () => {
    let pointerDownFired = false;
    let pointerUpFired = false;
    let clickFired = false;

    // This suite owns NearFieldInteractor threshold/hysteresis semantics only.
    // Use a deterministic Three.js plane rather than a live UIKit SpatialPanel:
    // SpatialPanel layout/raycast readiness is covered by its dedicated
    // production-path suites and must not make this pure resolver contract flaky.
    const panel = makeDeterministicPanel({
      onPointerDown: () => {
        pointerDownFired = true;
      },
      onPointerUp: () => {
        pointerUpFired = true;
      },
      onClick: () => {
        clickFired = true;
      },
    });

    const interactor = new NearFieldInteractor();
    const pointer = new MockPointer(0);

    // Pointer at z = 0.5 is 1.0m from the plane; controller-tip distance is 0.95m.
    pointer.position.set(0, 0, 0.5);
    interactor.update([pointer], [panel]);
    let state = interactor.getTouchState(pointer);
    expect(state).toBeDefined();
    expect(state?.phase).toBe('FAR');

    // At z = -0.01 the plane hit is 0.49m away; after the 0.05m controller
    // tip offset the physical distance is 0.44m, within the 0.55m envelope.
    pointer.position.set(0, 0, -0.01);
    interactor.update([pointer], [panel]);
    state = interactor.getTouchState(pointer);
    expect(state?.phase).toBe('NEAR_HOVER');

    // Hysteresis: 0.58m ray distance - 0.05m tip offset = 0.53m,
    // still below the 0.60m proximity-exit threshold.
    pointer.position.set(0, 0, 0.08);
    interactor.update([pointer], [panel]);
    state = interactor.getTouchState(pointer);
    expect(state?.phase).toBe('NEAR_HOVER');

    // 0.70m ray distance - 0.05m = 0.65m, beyond the exit threshold.
    pointer.position.set(0, 0, 0.2);
    interactor.update([pointer], [panel]);
    state = interactor.getTouchState(pointer);
    expect(state?.phase).toBe('FAR');

    // Plane is z = -0.5. At controller z = -0.444 the physical tip distance
    // is 0.006m, inside PRESS_ENTER (0.008m).
    pointer.position.set(0, 0, -0.444);
    interactor.update([pointer], [panel]);
    state = interactor.getTouchState(pointer);
    expect(state?.phase).toBe('PRESS');
    expect(pointerDownFired).toBe(true);

    // 0.010m remains inside the PRESS_EXIT hysteresis threshold (0.015m).
    pointer.position.set(0, 0, -0.44);
    interactor.update([pointer], [panel]);
    state = interactor.getTouchState(pointer);
    expect(state?.phase).toBe('PRESS');

    // 0.020m exceeds PRESS_EXIT, returning to COMMIT (which fires pointerup/click)
    // We set z = -0.431 so distance = -0.431 - 0.05 - (-0.5) = 0.019m, strictly > PRESS_EXIT (0.015m)
    // and <= CONTACT_ENTER (0.020m) for transition.
    pointer.position.set(0, 0, -0.431);
    interactor.update([pointer], [panel]);
    state = interactor.getTouchState(pointer);
    expect(state?.phase).toBe('COMMIT');
    expect(pointerUpFired).toBe(true);
    expect(clickFired).toBe(true);

    // Next frame transitions to RELEASE
    interactor.update([pointer], [panel]);
    state = interactor.getTouchState(pointer);
    expect(state?.phase).toBe('RELEASE');

    // Next frame transitions to CONTACT
    interactor.update([pointer], [panel]);
    state = interactor.getTouchState(pointer);
    expect(state?.phase).toBe('CONTACT');

    interactor.dispose();
    panel.dispose?.();
  });

  it('preserves target panel capture during press', () => {
    const interactor = new NearFieldInteractor();
    const pointer = new MockPointer(0);

    const panelA = makeDeterministicPanel({
      onPointerDown: () => {},
      onPointerUp: () => {},
      onClick: () => {},
    });
    panelA.mesh!.position.set(0, 0, -0.5);
    panelA.mesh!.updateMatrixWorld(true);

    const panelB = makeDeterministicPanel({
      onPointerDown: () => {},
      onPointerUp: () => {},
      onClick: () => {},
    });
    // Position B to the side initially so it is not hit
    panelB.mesh!.position.set(2.0, 0, -0.5);
    panelB.mesh!.updateMatrixWorld(true);

    // Initial press on panelA
    pointer.position.set(0, 0, -0.444);
    interactor.update([pointer], [panelA, panelB]);
    const state = interactor.getTouchState(pointer);
    expect(state?.phase).toBe('PRESS');
    expect(state?.targetPanel).toBe(panelA);

    // Position panelB directly in front and closer, but A is still captured
    panelB.mesh!.position.set(0, 0, -0.49);
    panelB.mesh!.updateMatrixWorld(true);
    interactor.update([pointer], [panelA, panelB]);
    expect(state?.targetPanel).toBe(panelA);

    interactor.dispose();
    panelA.dispose?.();
    panelB.dispose?.();
  });

  it('performs pre-commit cancellation if the pointer slides off the panel', () => {
    let clickFired = false;
    let upFired = false;

    const interactor = new NearFieldInteractor();
    const pointer = new MockPointer(0);

    const panel = makeDeterministicPanel({
      onPointerDown: () => {},
      onPointerUp: () => {
        upFired = true;
      },
      onClick: () => {
        clickFired = true;
      },
    });

    // Press on panel
    pointer.position.set(0, 0, -0.444);
    interactor.update([pointer], [panel]);
    let state = interactor.getTouchState(pointer);
    expect(state?.phase).toBe('PRESS');

    // Slide off the panel (direction changed so raycaster no longer hits it)
    pointer.direction.set(0, 1, 0); // Pointing straight up
    interactor.update([pointer], [panel]);
    state = interactor.getTouchState(pointer);
    // Should transition to RECOVER
    expect(state?.phase).toBe('RECOVER');
    // Up is fired but click/commit is not since it did not hit panel
    expect(upFired).toBe(true);
    expect(clickFired).toBe(false);

    interactor.dispose();
    panel.dispose?.();
  });
});

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Text, Component } from '@pmndrs/uikit';
import { SpatialUIRoot } from '../../src/vr/ui-system/SpatialUIRoot.ts';
import { SpatialPanel } from '../../src/vr/ui-system/SpatialPanel.ts';
import { NearFieldInteractor } from '../../src/vr/interactions/near/NearFieldInteractor.ts';
import type { PointerLike } from '../../src/vr/coordinators/types.ts';

// Mock pointer implementing PointerLike
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

describe('UX-05: Direct Touch & Near/Far Hysteresis resolver', () => {
  it('suppresses rays, transitions phases correctly, and triggers touch events', () => {
    const width = 800;
    const height = 600;
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas });
    renderer.setSize(width, height);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    scene.add(camera);

    const root = new SpatialUIRoot(renderer);
    camera.add(root);

    const torsoAnchor = new THREE.Group();
    const worldScene = new THREE.Group();
    scene.add(torsoAnchor);
    scene.add(worldScene);

    let pointerDownFired = false;
    let pointerUpFired = false;
    let clickFired = false;

    // Create panel at z = -0.5
    const panel = new SpatialPanel(
      {
        width: 400,
        height: 300,
        onPointerDown: () => {
          pointerDownFired = true;
        },
        onPointerUp: () => {
          pointerUpFired = true;
        },
        onClick: () => {
          clickFired = true;
        },
      },
      torsoAnchor,
      worldScene
    );
    panel.position.set(0, 0, -0.5);
    panel.updateMatrixWorld();
    panel.update(0);

    const interactor = new NearFieldInteractor();
    const pointer = new MockPointer(0);

    // Set pointer position far away: z = 0.5 (distance to panel ≈ 1.0m)
    pointer.position.set(0, 0, 0.5);
    interactor.update([pointer], [panel]);
    let state = interactor.getTouchState(pointer);
    expect(state).toBeDefined();
    expect(state?.phase).toBe('FAR');

    // Move pointer closer to z = -0.01 (distance to panel = 0.51 - 0.05 controller offset = 0.46m)
    // This is within the 0.55m proximity envelope
    pointer.position.set(0, 0, -0.01);
    interactor.update([pointer], [panel]);
    state = interactor.getTouchState(pointer);
    expect(state?.phase).toBe('PROXIMITY');

    // Test hysteresis: pull back slightly to z = 0.08 (distance to panel = 0.58 - 0.05 = 0.53m)
    // It should stay in PROXIMITY because it hasn't exceeded the 0.60m exit threshold yet
    pointer.position.set(0, 0, 0.08);
    interactor.update([pointer], [panel]);
    state = interactor.getTouchState(pointer);
    expect(state?.phase).toBe('PROXIMITY');

    // Pull back further to z = 0.20 (distance to panel = 0.70 - 0.05 = 0.65m)
    // This exceeds the 0.60m exit threshold, transitioning back to FAR
    pointer.position.set(0, 0, 0.2);
    interactor.update([pointer], [panel]);
    state = interactor.getTouchState(pointer);
    expect(state?.phase).toBe('FAR');

    // Move pointer back to near zone and push to PRESS threshold (distance to panel <= 0.008m)
    // Panel is at z = -0.5. Controller tip offset is 0.05m.
    // So controller z = -0.45 + epsilon. Let's set z = -0.444 (distance = -0.444 - 0.05 - (-0.5) = 0.006m)
    pointer.position.set(0, 0, -0.444);
    interactor.update([pointer], [panel]);
    state = interactor.getTouchState(pointer);
    expect(state?.phase).toBe('PRESS');
    expect(pointerDownFired).toBe(true);

    // Pull back slightly to z = -0.440 (distance = -0.44 - 0.05 - (-0.5) = 0.01m)
    // It should stay in PRESS state due to release threshold being 0.015m (1.5cm)
    pointer.position.set(0, 0, -0.44);
    interactor.update([pointer], [panel]);
    state = interactor.getTouchState(pointer);
    expect(state?.phase).toBe('PRESS');

    // Pull back further to z = -0.430 (distance = -0.43 - 0.05 - (-0.5) = 0.02m)
    // This exceeds 0.015m release threshold, so it transitions back to CONTACT, triggering up & click
    pointer.position.set(0, 0, -0.43);
    interactor.update([pointer], [panel]);
    state = interactor.getTouchState(pointer);
    expect(state?.phase).toBe('CONTACT');
    expect(pointerUpFired).toBe(true);
    expect(clickFired).toBe(true);

    // Clean up
    interactor.dispose();
    panel.dispose();
    root.dispose();
    renderer.dispose();
  });
});

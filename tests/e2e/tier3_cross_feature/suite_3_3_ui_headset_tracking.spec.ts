import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WorldSceneComposer } from '../../../src/vr/coordinators/WorldSceneComposer.ts';
import { MovablePanel } from '../../../src/vr/ui/MovablePanel.ts';

describe('Tier 3 — Suite 3.3: Spatial UI Ergonomics × Stable Body Frame (F9 × F10)', () => {
  it('INT-3.3.1: head lean does not move the body-locked panel cluster', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.7, 0);
    const cameraGroup = new THREE.Group();
    cameraGroup.add(camera);

    const mockEngine: any = {
      camera,
      cameraGroup,
      scene: new THREE.Scene(),
      addUpdatable: () => {},
    };

    const composer = new WorldSceneComposer(mockEngine);
    const panel = new MovablePanel(composer.analystAnchor, {
      title: 'HUD Panel',
      position: [0.6, 0.1, -1.2],
      parentGroup: composer.analystAnchor,
    });

    composer.update(0.016);
    panel.update(0.016);
    const anchorBefore = composer.analystAnchor.position.clone();
    const localPanelBefore = panel.mesh.position.clone();

    camera.position.set(0.5, 1.7, -0.4);
    composer.update(0.016);
    panel.update(0.016);

    expect(composer.analystAnchor.position.x).toBeCloseTo(anchorBefore.x, 6);
    expect(composer.analystAnchor.position.z).toBeCloseTo(anchorBefore.z, 6);
    expect(panel.mesh.position.distanceTo(localPanelBefore)).toBeLessThan(1e-9);
    expect(panel.mesh.parent).toBe(composer.analystAnchor);
  });

  it('INT-3.3.2: panel drag tracks the pointer directly and commits distance bounds on release', () => {
    const cameraGroup = new THREE.Group();
    const panel = new MovablePanel(cameraGroup, {
      title: 'DraggablePanel',
      position: [0, 0, -1.2],
      minDistance: 0.5,
      maxDistance: 2.0,
    });

    const pointer: any = {
      origin: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 0, -1),
      getRay(ray: THREE.Ray) {
        ray.origin.copy(this.origin);
        ray.direction.copy(this.direction).normalize();
        return ray;
      },
    };

    // Seed a direct grab without relying on title-bar ray geometry in this
    // cross-feature test.
    panel.drag.active = true;
    panel.drag.pointer = pointer;
    panel.drag.distance = 1.2;
    panel.drag.offset.set(0, 0, 0);
    panel.drag.lastTarget.set(0, 0, -1.2);

    pointer.origin.set(0.4, 0.1, -1.2);
    panel.handlePointerMove(new THREE.Raycaster(), pointer);
    expect(panel.mesh.position.x).toBeCloseTo(0.4, 5);
    expect(panel.mesh.position.z).toBeCloseTo(-2.4, 5);
    expect(panel.mesh.position.length()).toBeGreaterThan(2);

    panel.handlePointerUp(new THREE.Raycaster(), pointer);
    expect(panel.mesh.position.length()).toBeLessThanOrEqual(2 + 1e-6);
    expect(panel.drag.active).toBe(false);
  });
});

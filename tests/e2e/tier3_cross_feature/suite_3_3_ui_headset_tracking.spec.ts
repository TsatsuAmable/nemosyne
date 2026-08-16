import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WorldSceneComposer } from '../../../src/vr/coordinators/WorldSceneComposer.ts';
import { MovablePanel } from '../../../src/vr/ui/MovablePanel.ts';

describe('Tier 3 — Suite 3.3: Spatial UI Ergonomics × Damped Tracking (F9 × F10)', () => {
  it('INT-3.3.1: Analyst anchor follows camera yaw rotation and keeps attached MovablePanel HUD relative to torso', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.7, 0);
    camera.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4); // 45 deg yaw

    const cameraGroup = new THREE.Group();
    cameraGroup.add(camera);

    const mockEngine: any = {
      camera,
      cameraGroup,
      scene: new THREE.Scene(),
      addUpdatable: () => {},
    };

    const composer = new WorldSceneComposer(mockEngine);
    const panel = new MovablePanel(cameraGroup, {
      title: 'HUD Panel',
      position: [0, 1.5, -1.2],
      parentGroup: composer.analystAnchor,
    });

    composer.update(0.016);
    panel.update(0.016);

    // Damped torso yaw moves toward 45 deg over multiple frames.
    expect(composer.analystAnchor.rotation.y).toBeGreaterThan(0);
    expect(composer.analystAnchor.rotation.y).toBeLessThan(Math.PI / 4);
    for (let i = 0; i < 200; i++) composer.update(0.016);
    expect(composer.analystAnchor.rotation.y).toBeCloseTo(Math.PI / 4);
    // Panel remains parented to analyst anchor
    expect(panel.mesh.parent).toBe(composer.analystAnchor);
    expect(panel.mesh.visible).toBe(true);
  });

  it('INT-3.3.2: Panel pointer movement updates position smoothly while maintaining distance bounds', () => {
    const cameraGroup = new THREE.Group();
    const panel = new MovablePanel(cameraGroup, {
      title: 'DraggablePanel',
      position: [0, 1.5, -1.2],
      minDistance: 0.5,
      maxDistance: 2.0,
    });

    // Simulate pointer move dragging
    const mockPointer = {
      getRay: (ray: THREE.Ray) => {
        ray.origin.set(0, 1.5, 0);
        ray.direction.set(0, 0, -1).normalize();
        return ray;
      },
    };

    panel.drag.active = true;
    panel.drag.pointer = mockPointer as any;
    panel.drag.distance = 1.2;

    const raycaster = new THREE.Raycaster();
    raycaster.ray.origin.set(0, 1.5, 0);
    raycaster.ray.direction.set(0.1, 0, -0.9).normalize();

    panel.handlePointerMove(raycaster, mockPointer as any);
    panel.update(0.016);

    const dist = panel.mesh.position.length();
    expect(dist).toBeGreaterThanOrEqual(0.5);
    expect(dist).toBeLessThanOrEqual(2.0);
  });
});

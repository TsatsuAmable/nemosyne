/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WorldSceneComposer } from '../src/vr/coordinators/WorldSceneComposer.ts';

describe('Torso Anchor Tracking Subsystem', () => {
  it('updates analystAnchor to follow the headset torso position and yaw rotation', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(1.5, 1.75, -2.0); // Analyst standing at (1.5, 1.75, -2.0)
    camera.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4); // Y-axis 45 deg yaw

    const cameraGroup = new THREE.Group();
    cameraGroup.add(camera);

    const updatables: any[] = [];
    const mockEngine: any = {
      camera,
      cameraGroup,
      scene: new THREE.Scene(),
      addUpdatable(u: any) {
        updatables.push(u);
      },
    };

    const composer = new WorldSceneComposer(mockEngine);
    composer.update(0.016);

    // Torso position should match camera X, Z and sit ~0.25m below eye level (1.75 - 0.25 = 1.50)
    expect(composer.analystAnchor.position.x).toBeCloseTo(1.5);
    expect(composer.analystAnchor.position.y).toBeCloseTo(1.5);
    expect(composer.analystAnchor.position.z).toBeCloseTo(-2.0);

    // Torso rotation should match headset yaw
    expect(composer.analystAnchor.rotation.y).toBeCloseTo(Math.PI / 4);
  });
});

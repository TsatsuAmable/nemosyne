import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WorldSceneComposer } from '../../../src/vr/coordinators/WorldSceneComposer.ts';

describe('Tier 2 — Feature 9: Torso Anchor Rotation Damping (Boundary Cases)', () => {
  it('F9-BC1: 180-degree head snap tracks torso yaw cleanly', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.7, 0);
    // Instant 180 snap (PI rad)
    camera.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

    const cameraGroup = new THREE.Group();
    cameraGroup.add(camera);

    const mockEngine: any = {
      camera,
      cameraGroup,
      scene: new THREE.Scene(),
      addUpdatable: () => {},
    };

    const composer = new WorldSceneComposer(mockEngine);

    // Damped tracking: a single frame moves partway toward PI, then converges.
    composer.update(0.016);
    expect(Math.abs(composer.analystAnchor.rotation.y)).toBeLessThan(Math.PI);
    expect(Math.abs(composer.analystAnchor.rotation.y)).toBeGreaterThan(0);

    for (let i = 0; i < 200; i++) composer.update(0.016);
    expect(Math.abs(composer.analystAnchor.rotation.y)).toBeCloseTo(Math.PI, 2);
  });

  it('F9-BC2: Pitching head straight up (+90 deg) isolates Y-axis yaw without gimbal lock', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.7, 0);
    // Pitch up +90 deg around X-axis
    camera.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);

    const cameraGroup = new THREE.Group();
    cameraGroup.add(camera);

    const mockEngine: any = {
      camera,
      cameraGroup,
      scene: new THREE.Scene(),
      addUpdatable: () => {},
    };

    const composer = new WorldSceneComposer(mockEngine);
    composer.update(0.016);

    // X and Z rotation of analystAnchor stay 0
    expect(composer.analystAnchor.rotation.x).toBe(0);
    expect(composer.analystAnchor.rotation.z).toBe(0);
  });

  it('F9-BC3: Torso position follows camera X and Z while offsetting eye height to torso height', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(10.0, 2.0, -5.0);

    const cameraGroup = new THREE.Group();
    cameraGroup.add(camera);

    const mockEngine: any = {
      camera,
      cameraGroup,
      scene: new THREE.Scene(),
      addUpdatable: () => {},
    };

    const composer = new WorldSceneComposer(mockEngine);
    composer.update(0.016);

    expect(composer.analystAnchor.position.x).toBe(10.0);
    expect(composer.analystAnchor.position.z).toBe(-5.0);
    expect(composer.analystAnchor.position.y).toBeCloseTo(1.75, 2); // 2.0 - 0.25 = 1.75
  });

  it('F9-BC4: Camera eye level below 0.8m clamps torso height to minimum threshold (0.8m)', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0.5, 0); // Crouch / low head

    const cameraGroup = new THREE.Group();
    cameraGroup.add(camera);

    const mockEngine: any = {
      camera,
      cameraGroup,
      scene: new THREE.Scene(),
      addUpdatable: () => {},
    };

    const composer = new WorldSceneComposer(mockEngine);
    composer.update(0.016);

    expect(composer.analystAnchor.position.y).toBe(0.8);
  });

  it('F9-BC5: Rapid camera updates (100 ticks) maintain finite numeric transform bounds', () => {
    const camera = new THREE.PerspectiveCamera();
    const cameraGroup = new THREE.Group();
    cameraGroup.add(camera);

    const mockEngine: any = {
      camera,
      cameraGroup,
      scene: new THREE.Scene(),
      addUpdatable: () => {},
    };

    const composer = new WorldSceneComposer(mockEngine);

    for (let i = 0; i < 100; i++) {
      camera.position.set(Math.sin(i * 0.1), 1.7 + Math.cos(i * 0.1), -i * 0.05);
      camera.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.05);
      composer.update(0.016);
    }

    expect(Number.isNaN(composer.analystAnchor.position.x)).toBe(false);
    expect(Number.isNaN(composer.analystAnchor.rotation.y)).toBe(false);
  });
});

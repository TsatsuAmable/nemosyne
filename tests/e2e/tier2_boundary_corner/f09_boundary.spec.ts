import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WorldSceneComposer } from '../../../src/vr/coordinators/WorldSceneComposer.ts';

describe('Tier 2 — Feature 9: Stable Body Frame (Boundary Cases)', () => {
  function makeComposer() {
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
    return { camera, composer: new WorldSceneComposer(mockEngine) };
  }

  it('F9-BC1: 180-degree sustained turn takes the short path without overshoot', () => {
    const { camera, composer } = makeComposer();
    composer.update(1 / 72);
    camera.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

    for (let i = 0; i < 15; i++) composer.update(1 / 72);
    expect(Math.abs(composer.analystAnchor.rotation.y)).toBeLessThan(Math.PI);

    for (let i = 0; i < 220; i++) composer.update(1 / 72);
    expect(Math.abs(composer.analystAnchor.rotation.y)).toBeGreaterThan(2.8);
    expect(Math.abs(composer.analystAnchor.rotation.y)).toBeLessThanOrEqual(Math.PI);
  });

  it('F9-BC2: pitching head straight up isolates Y-axis body heading without gimbal lock', () => {
    const { camera, composer } = makeComposer();
    camera.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    composer.update(0.016);

    expect(composer.analystAnchor.rotation.x).toBe(0);
    expect(composer.analystAnchor.rotation.z).toBe(0);
    expect(Number.isFinite(composer.analystAnchor.rotation.y)).toBe(true);
  });

  it('F9-BC3: extreme physical X/Z head motion remains decoupled from rig-relative body position', () => {
    const { camera, composer } = makeComposer();
    composer.update(0.016);
    camera.position.set(10, 2, -5);
    composer.update(0.016);

    expect(composer.analystAnchor.position.x).toBeCloseTo(0, 6);
    expect(composer.analystAnchor.position.z).toBeCloseTo(0, 6);
    expect(composer.analystAnchor.position.y).toBeCloseTo(1.75, 2);
  });

  it('F9-BC4: viewer eye level below 0.8m clamps torso height to minimum threshold', () => {
    const { camera, composer } = makeComposer();
    camera.position.set(0, 0.5, 0);
    composer.update(0.016);

    expect(composer.analystAnchor.position.y).toBe(0.8);
  });

  it('F9-BC5: rapid noisy updates maintain finite numeric transform bounds', () => {
    const { camera, composer } = makeComposer();
    composer.update(1 / 72);

    for (let i = 0; i < 200; i++) {
      camera.position.set(Math.sin(i * 0.1), 1.7 + Math.cos(i * 0.1) * 0.1, -i * 0.05);
      camera.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(i * 0.07));
      composer.update(1 / 72);
    }

    expect(Number.isFinite(composer.analystAnchor.position.x)).toBe(true);
    expect(Number.isFinite(composer.analystAnchor.position.y)).toBe(true);
    expect(Number.isFinite(composer.analystAnchor.position.z)).toBe(true);
    expect(Number.isFinite(composer.analystAnchor.rotation.y)).toBe(true);
  });
});

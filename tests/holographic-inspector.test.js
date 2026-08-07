// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { HolographicInspector } from '../src/vr/artifacts/HolographicInspector.ts';

function makeEngine() {
  const cameraGroup = new THREE.Group();
  const camera = new THREE.PerspectiveCamera();
  cameraGroup.add(camera);
  const scene = new THREE.Scene();
  scene.add(cameraGroup);
  return {
    camera,
    cameraGroup,
    scene,
    input: { feedback: { playTone: vi.fn(), showHitMarker: vi.fn(), volume: 0.15 } },
  };
}

describe('HolographicInspector', () => {
  it('is hidden by default', () => {
    const engine = makeEngine();
    const inspector = new HolographicInspector(engine);
    expect(inspector.mesh.visible).toBe(false);
    expect(inspector.active).toBe(false);
  });

  it('showAtNode makes the mesh visible and renders data', () => {
    const engine = makeEngine();
    const inspector = new HolographicInspector(engine);
    const node = new THREE.Mesh();
    node.position.set(1, 2, -3);
    node.userData.row = { id: 42, category: 'A', value: 99.5 };
    inspector.showAtNode(node, node.userData.row, null, 'NODE');

    expect(inspector.mesh.visible).toBe(true);
    expect(inspector.active).toBe(true);
    expect(inspector.material.map.version).toBeGreaterThan(0);
  });

  it('hide dismisses the inspector', () => {
    const engine = makeEngine();
    const inspector = new HolographicInspector(engine);
    const node = new THREE.Mesh();
    node.userData.row = { id: 1 };
    inspector.showAtNode(node, node.userData.row, null, 'NODE');
    inspector.hide();
    expect(inspector.mesh.visible).toBe(false);
    expect(inspector.active).toBe(false);
  });

  it('follows a hand pointer over time', () => {
    const engine = makeEngine();
    const inspector = new HolographicInspector(engine);
    const node = new THREE.Mesh();
    node.userData.row = { id: 1 };

    const pointer = {
      getWorldPosition: (target) => target.set(0.1, 1.5, -0.5),
      getHandTransform: (pos, quat) => {
        pos.set(0.1, 1.5, -0.5);
        quat.setFromEuler(new THREE.Euler(0, 0, 0));
        return pos;
      },
      rayDirection: new THREE.Vector3(0, 0, -1),
    };

    inspector.showAtNode(node, node.userData.row, pointer, 'NODE');
    inspector.update(1 / 60, 0);

    // Should have moved toward the hand-offset target, not stayed at node.
    expect(inspector.mesh.position.length()).toBeGreaterThan(0.1);
  });

  it('dismisses on a flick gesture', () => {
    const engine = makeEngine();
    const inspector = new HolographicInspector(engine);
    const node = new THREE.Mesh();
    node.userData.row = { id: 1 };

    const dir = new THREE.Vector3(0, 0, -1);
    const pointer = {
      getWorldPosition: (target) => target.set(0, 1.5, -0.5),
      getHandTransform: (pos, quat) => {
        pos.set(0, 1.5, -0.5);
        quat.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
        return pos;
      },
      rayDirection: dir,
    };

    inspector.showAtNode(node, node.userData.row, pointer, 'NODE');
    inspector.currentHandDir.copy(dir);
    inspector.lastPointerDir.copy(dir);

    // Rapid downward change.
    dir.set(0, -0.9, -0.44).normalize();
    inspector.update(0.016, 0);

    expect(inspector.active).toBe(false);
  });

  it('dismisses after looking away for too long', () => {
    const engine = makeEngine();
    const inspector = new HolographicInspector(engine);
    const node = new THREE.Mesh();
    node.userData.row = { id: 1 };

    const pointer = {
      getWorldPosition: (target) => target.set(0, 1.5, -0.5),
      getHandTransform: (pos, quat) => {
        pos.set(0, 1.5, -0.5);
        quat.identity();
        return pos;
      },
      rayDirection: new THREE.Vector3(0, 0, -1),
    };

    inspector.showAtNode(node, node.userData.row, pointer, 'NODE');
    // Turn the camera away from the inspector.
    engine.camera.rotation.y = Math.PI;
    engine.camera.updateMatrixWorld();
    inspector.update(1.0, 0);
    expect(inspector.active).toBe(false);
  });
});

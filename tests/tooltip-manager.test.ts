// @ts-nocheck
// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { TooltipManager } from '../src/vr/ui/TooltipManager.ts';

function makeCamera(at = new THREE.Vector3(0, 1.6, 0), direction = new THREE.Vector3(0, 0, -1)): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera();
  camera.position.copy(at);
  camera.lookAt(at.clone().add(direction));
  camera.updateMatrixWorld();
  return camera;
}

describe('TooltipManager', () => {
  it('hides all tooltips by default', () => {
    const camera = makeCamera();
    const manager = new TooltipManager(camera);
    for (const entry of manager.pool) {
      expect(entry.mesh.visible).toBe(false);
      expect((entry.mesh.material as THREE.MeshBasicMaterial).opacity).toBe(0);
    }
  });

  it('shows a tooltip after gaze dwell on a target', () => {
    const camera = makeCamera(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 0, -1));
    const manager = new TooltipManager(camera, { dwellMs: 100 });
    const scene = new THREE.Scene();
    manager.mount(scene);

    // Place ~10 degrees off-center: inside the manager's 12-degree gaze cone
    // (so dwell accumulates) but outside LODManager's 8-degree label cone
    // (so the LOD shortcut does not fire).
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
    mesh.position.set(0.35, 1.6, -2);
    mesh.userData.row = { id: 1, category: 'A', value: 12.34 };
    scene.add(mesh);

    manager.setTargets([mesh]);
    manager.update(0.05); // 50 ms dwell
    expect(manager.pool.some((e) => e.active)).toBe(false);
    manager.update(0.1); // 100 ms total
    expect(manager.pool.some((e) => e.active)).toBe(true);
  });

  it('hides tooltips when gaze moves away', () => {
    const camera = makeCamera(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 0, -1));
    const manager = new TooltipManager(camera, { dwellMs: 50 });
    const scene = new THREE.Scene();
    manager.mount(scene);

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
    mesh.position.set(0, 1.6, -2);
    mesh.userData.row = { id: 1 };
    scene.add(mesh);

    manager.setTargets([mesh]);
    manager.update(0.1);
    expect(manager.pool.some((e) => e.active)).toBe(true);

    // Turn camera away.
    camera.lookAt(new THREE.Vector3(5, 1.6, 0));
    camera.updateMatrixWorld();
    manager.update(0.5);
    expect(manager.pool.some((e) => e.active)).toBe(false);
  });

  it('shows tooltips immediately for very close nodes via LODManager', () => {
    const camera = makeCamera(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 0, -1));
    const manager = new TooltipManager(camera, { dwellMs: 1000 });
    const scene = new THREE.Scene();
    manager.mount(scene);

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
    mesh.position.set(0, 1.6, -0.5); // within 1.2 m
    mesh.userData.row = { id: 1, value: 7 };
    scene.add(mesh);

    manager.setTargets([mesh]);
    manager.update(0.016);
    expect(manager.pool.some((e) => e.active)).toBe(true);
  });

  it('renders tooltip content from the target row', () => {
    const camera = makeCamera(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 0, -1));
    const manager = new TooltipManager(camera, { dwellMs: 50 });
    const scene = new THREE.Scene();
    manager.mount(scene);

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
    mesh.position.set(0, 1.6, -2);
    mesh.userData.row = { id: 7, category: 'B', value: 42.5 };
    scene.add(mesh);

    manager.setTargets([mesh]);
    manager.update(0.1);
    const active = manager.pool.find((e) => e.active);
    expect(active).toBeTruthy();
    expect(((active!.mesh.material as THREE.MeshBasicMaterial).map as THREE.CanvasTexture).version).toBeGreaterThan(0);
  });

  it('shows an immediate label when the pointer ray intersects a target', () => {
    const camera = makeCamera(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 0, -1));
    const manager = new TooltipManager(camera, { dwellMs: 1000 });
    const scene = new THREE.Scene();
    manager.mount(scene);

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5));
    mesh.position.set(0, 1.6, -2);
    mesh.userData.tooltipMeta = { title: 'Pointer Target', body: 'hit label' };
    scene.add(mesh);

    manager.registerTarget(mesh);

    // Build a raycaster that is guaranteed to intersect the box center.
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(0, 1.6, 0),
      new THREE.Vector3(0, 0, -1)
    );
    // Update world matrices so the intersection test sees the box position.
    scene.updateMatrixWorld(true);
    manager.setPointerRaycaster(raycaster);
    manager.update(0.016);

    expect(manager._pointerHitTooltip.mesh.visible).toBe(true);
    expect(manager._pointerHitTooltip.fade).toBeGreaterThan(0);
  });

  it('uses explicit tooltip metadata when provided', () => {
    const camera = makeCamera(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 0, -1));
    const manager = new TooltipManager(camera, { dwellMs: 50 });
    const scene = new THREE.Scene();
    manager.mount(scene);

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
    mesh.position.set(0, 1.6, -2);
    scene.add(mesh);

    manager.registerTarget(mesh, { title: 'Custom Title', body: 'Custom body' });
    manager.update(0.1);
    const active = manager.pool.find((e) => e.active);
    expect(active).toBeTruthy();
    expect(((active!.mesh.material as THREE.MeshBasicMaterial).map as THREE.CanvasTexture).version).toBeGreaterThan(0);
  });

  it('clears targets and hides tooltips on clear()', () => {
    const camera = makeCamera(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 0, -1));
    const manager = new TooltipManager(camera, { dwellMs: 50 });
    const scene = new THREE.Scene();
    manager.mount(scene);

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
    mesh.position.set(0, 1.6, -2);
    scene.add(mesh);

    manager.setTargets([mesh]);
    manager.update(0.1);
    expect(manager.pool.some((e) => e.active)).toBe(true);

    manager.clear();
    expect(manager.targets.length).toBe(0);
    expect(manager.pool.every((e) => !e.active)).toBe(true);
  });

  it('does not show tooltips when disabled', () => {
    const camera = makeCamera(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 0, -1));
    const manager = new TooltipManager(camera, { dwellMs: 50, enabled: false });
    const scene = new THREE.Scene();
    manager.mount(scene);

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
    mesh.position.set(0, 1.6, -2);
    mesh.userData.row = { id: 1, value: 7 };
    scene.add(mesh);

    manager.setTargets([mesh]);
    manager.update(0.1);
    expect(manager.pool.every((e) => !e.active)).toBe(true);
    expect(manager._pointerHitTooltip.fade).toBe(0);

    manager.setEnabled(true);
    manager.update(0.1);
    expect(manager.pool.some((e) => e.active)).toBe(true);
  });
});

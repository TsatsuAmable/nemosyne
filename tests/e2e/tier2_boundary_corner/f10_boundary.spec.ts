import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WorkspaceSurfaceManager } from '../../../src/vr/ui/WorkspaceSurfaceManager.ts';
import type { PanelLike } from '../../../src/vr/coordinators/types.ts';

// FM4-UI-CLEAN: the legacy canvas panel substrate (the former MovablePanel) was
// retired production-unreachable. The surviving product-visible boundary claims
// (extreme-depth clamping, minimize/toggle flags) are re-pinned on the live
// workspace lifecycle surfaces. Legacy internal mechanics (canvas material
// transparency, scrollbar offset bounds) died with the substrate.

function makeHarness() {
  const cameraGroup = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 2000);
  camera.position.set(0, 1.6, 0);
  cameraGroup.add(camera);
  const manager = new WorkspaceSurfaceManager(cameraGroup, camera);
  return { cameraGroup, camera, manager };
}

class DepthProbe implements PanelLike {
  mesh: THREE.Mesh;
  title = 'F10 BOUNDARY PROBE';
  isMinimized = false;
  constructor(position: [number, number, number]) {
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
    this.mesh.position.set(...position);
  }
  show(): void {
    this.isMinimized = false;
    this.mesh.visible = true;
  }
  hide(): void {
    this.isMinimized = true;
    this.mesh.visible = false;
  }
}

describe('Tier 2 — Feature 10: 3D UI Panel Z-Sorting & Distance Clamping (Boundary Cases)', () => {
  it('F10-BC2: Panel placed at extreme distance (z = -1000) is clamped to maxDistance', () => {
    const { camera, manager } = makeHarness();
    const panel = new DepthProbe([0, 1.6, -1000]);
    manager.registerPanel('f10-bc2', panel);
    camera.updateMatrixWorld(true);
    panel.mesh.updateMatrixWorld(true);

    manager.recenter('f10-bc2');

    const viewer = new THREE.Vector3();
    const surface = new THREE.Vector3();
    camera.getWorldPosition(viewer);
    panel.mesh.getWorldPosition(surface);
    expect(surface.distanceTo(viewer)).toBeLessThanOrEqual(2.01);
  });

  it('F10-BC3: Panel placed inside camera near plane (z = -0.01) is clamped to minDistance', () => {
    const { camera, manager } = makeHarness();
    const panel = new DepthProbe([0, 1.6, -0.01]);
    manager.registerPanel('f10-bc3', panel);
    camera.updateMatrixWorld(true);
    panel.mesh.updateMatrixWorld(true);

    manager.recenter('f10-bc3');

    const viewer = new THREE.Vector3();
    const surface = new THREE.Vector3();
    camera.getWorldPosition(viewer);
    panel.mesh.getWorldPosition(surface);
    expect(surface.distanceTo(viewer)).toBeGreaterThanOrEqual(0.35);
  });

  it('F10-BC5: Toggling panel visibility updates mesh.visible and isMinimized flags', () => {
    const { manager } = makeHarness();
    const panel = new DepthProbe([0, 1.5, -1]);
    manager.registerPanel('f10-bc5', panel);
    panel.mesh.visible = true;

    expect(panel.mesh.visible).toBe(true);
    expect(panel.isMinimized).toBe(false);

    expect(manager.toggle('f10-bc5')).toBe(false);
    expect(panel.mesh.visible).toBe(false);
    expect(panel.isMinimized).toBe(true);

    expect(manager.toggle('f10-bc5')).toBe(true);
    expect(panel.mesh.visible).toBe(true);
    expect(panel.isMinimized).toBe(false);
  });
});

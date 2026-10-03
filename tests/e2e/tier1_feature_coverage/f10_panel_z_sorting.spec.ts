import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SpatialPanel } from '../../../src/vr/ui-system/SpatialPanel.ts';
import { WorkspaceSurfaceManager } from '../../../src/vr/ui/WorkspaceSurfaceManager.ts';
import type { PanelLike } from '../../../src/vr/coordinators/types.ts';

// FM4-UI-CLEAN: the legacy canvas panel substrate (the former MovablePanel) was
// retired production-unreachable. This journey re-pins its surviving
// product-visible claims (z-sorting control, spatial-group hierarchy, depth
// clamping, minimize/restore) on the live SpatialPanel + workspace-lifecycle
// surfaces. Legacy internal mechanics (canvas material construction, scrollbar
// offsets) died with the substrate and are intentionally not re-hosted.

function makeHarness() {
  const cameraGroup = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 100);
  camera.position.set(0, 1.6, 0);
  cameraGroup.add(camera);
  const manager = new WorkspaceSurfaceManager(cameraGroup, camera);
  return { cameraGroup, camera, manager };
}

/** Minimal PanelLike probe: a mesh and a title are all registration needs. */
class DepthProbe implements PanelLike {
  mesh: THREE.Mesh;
  title = 'F10 DEPTH PROBE';
  constructor(position: [number, number, number]) {
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
    this.mesh.position.set(...position);
  }
}

/** Minimal panel reporting the production minimize flag around show/hide. */
class MinimizablePanel implements PanelLike {
  mesh: THREE.Mesh;
  title = 'F10 PANEL';
  isMinimized = false;
  constructor(parent: THREE.Group, position: [number, number, number]) {
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
    this.mesh.position.set(...position);
    parent.add(this.mesh);
  }
  show(): void {
    this.isMinimized = false;
  }
  hide(): void {
    this.isMinimized = true;
  }
}

describe('Feature 10: 3D UI Panel Z-Sorting & Depth Settings', () => {
  it('F10-TC2: Panel mesh renderOrder can be set to prioritize foreground rendering', () => {
    const panel = new SpatialPanel();
    panel.position.set(0, 1.5, -1);

    panel.mesh.renderOrder = 10;
    expect(panel.mesh.renderOrder).toBe(10);
  });

  it('F10-TC3: Overlapping panels maintain deterministic parent-child hierarchy in spatial group', () => {
    const group = new THREE.Group();
    const panel1 = new SpatialPanel();
    panel1.position.set(0, 1.5, -1.0);
    const panel2 = new SpatialPanel();
    panel2.position.set(0, 1.5, -1.2);

    group.add(panel1.mesh);
    group.add(panel2.mesh);

    expect(group.children).toContain(panel1.mesh);
    expect(group.children).toContain(panel2.mesh);
    expect(panel1.mesh.position.z).toBeGreaterThan(panel2.mesh.position.z);
  });

  it('F10-TC4: Panel distance clamping maintains valid depth range between minDistance and maxDistance', () => {
    const { camera, manager } = makeHarness();
    // A surface placed beyond the viewer depth envelope (12 m) must clamp back
    // into the live viewer-relative [0.35 m, 2.5 m] envelope.
    const panel = new DepthProbe([0, 1.6, -12.0]);
    manager.registerPanel('f10-tc4', panel);
    camera.updateMatrixWorld(true);
    panel.mesh.updateMatrixWorld(true);

    manager.recenter('f10-tc4');

    const viewer = new THREE.Vector3();
    const surface = new THREE.Vector3();
    camera.getWorldPosition(viewer);
    panel.mesh.getWorldPosition(surface);
    const distance = surface.distanceTo(viewer);
    expect(distance).toBeLessThanOrEqual(2.5);
    expect(distance).toBeGreaterThanOrEqual(0.35);
  });

  it('F10-TC5: Minimizing panel updates visibility state while preserving position', () => {
    const { cameraGroup, manager } = makeHarness();
    const panel = new MinimizablePanel(cameraGroup, [0, 1.5, -1]);
    manager.registerPanel('f10-tc5', panel);
    panel.mesh.visible = true;

    expect(manager.hide('f10-tc5')).toBe(true);
    expect(panel.mesh.visible).toBe(false);
    expect(panel.isMinimized).toBe(true);

    expect(manager.show('f10-tc5')).toBe(true);
    expect(panel.mesh.visible).toBe(true);
    expect(panel.isMinimized).toBe(false);
    expect(panel.mesh.position.toArray()).toEqual([0, 1.5, -1]);
  });
});
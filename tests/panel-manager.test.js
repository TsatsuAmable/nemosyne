// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { PanelManager } from '../src/vr/ui/PanelManager.js';
import { MovablePanel } from '../src/vr/ui/MovablePanel.js';

class TestPanel extends MovablePanel {
  constructor(cameraGroup, title, position) {
    super(cameraGroup, {
      title,
      width: 400,
      height: 300,
      position,
      worldSize: [0.5, 0.375],
      titleBarHeight: 40,
    });
  }
}

function makeRaycasterForPoint(point) {
  const origin = point.clone().add(new THREE.Vector3(0, 0.05, 0.1));
  const direction = point.clone().sub(origin).normalize();
  return new THREE.Raycaster(origin, direction);
}

describe('PanelManager', () => {
  let group;
  let manager;

  beforeEach(() => {
    group = new THREE.Group();
    manager = new PanelManager(group);
  });

  it('registers and unregisters panels', () => {
    const panel = new TestPanel(group, 'A', [0, 0, -1]);
    manager.register(panel);
    expect(manager.panels).toContain(panel);

    manager.unregister(panel);
    expect(manager.panels).not.toContain(panel);
  });

  it('toggles a single panel independently', () => {
    const a = new TestPanel(group, 'A', [0, 0, -1]);
    const b = new TestPanel(group, 'B', [0.5, 0, -1]);
    manager.register(a);
    manager.register(b);

    manager.togglePanel(a);
    expect(a.mesh.visible).toBe(false);
    expect(b.mesh.visible).toBe(true);

    manager.togglePanel(a);
    expect(a.mesh.visible).toBe(true);
    expect(b.mesh.visible).toBe(true);
  });

  it('shows and hides all panels at once', () => {
    const a = new TestPanel(group, 'A', [0, 0, -1]);
    const b = new TestPanel(group, 'B', [0.5, 0, -1]);
    manager.register(a);
    manager.register(b);

    manager.hideAll();
    expect(a.mesh.visible).toBe(false);
    expect(b.mesh.visible).toBe(false);

    manager.showAll();
    expect(a.mesh.visible).toBe(true);
    expect(b.mesh.visible).toBe(true);
  });

  it('toggles the launcher ring and lays out icons', () => {
    const a = new TestPanel(group, 'A', [0, 0, -1]);
    const b = new TestPanel(group, 'B', [0.5, 0, -1]);
    manager.register(a);
    manager.register(b);

    expect(manager.isLauncherVisible()).toBe(false);
    manager.toggleLauncher();
    expect(manager.isLauncherVisible()).toBe(true);
    expect(manager._launcherGroup.visible).toBe(true);
    expect(manager._launchers.length).toBe(2);

    manager.toggleLauncher();
    expect(manager.isLauncherVisible()).toBe(false);
  });

  it('activates a launcher icon to toggle its panel', () => {
    const a = new TestPanel(group, 'A', [0, 0, -1]);
    manager.register(a);
    manager.showLauncher();

    const launcher = manager._launchers[0].mesh;
    launcher.updateMatrixWorld(true);
    const point = new THREE.Vector3().setFromMatrixPosition(launcher.matrixWorld);
    const raycaster = makeRaycasterForPoint(point);

    expect(a.mesh.visible).toBe(true);
    manager.handleLauncherHit(raycaster);
    expect(a.mesh.visible).toBe(false);

    manager.handleLauncherHit(raycaster);
    expect(a.mesh.visible).toBe(true);
  });

  it('uses a higher default anchor so panels do not sit below eye level', () => {
    const anchor = manager.getAnchor();
    expect(anchor.y).toBeGreaterThanOrEqual(0);
  });

  it('ignores the panel defaultPosition and uses the anchor slot', () => {
    const panel = new TestPanel(group, 'A', [0, -2, -0.2]);
    manager.register(panel);
    manager.showPanel(panel);

    const anchor = manager.getAnchor();
    expect(panel.mesh.position.y).toBeGreaterThan(anchor.y - 0.5);
    expect(panel.mesh.position.distanceTo(anchor)).toBeGreaterThanOrEqual(0.45);
  });

  it('positions panels around a central anchor in an arc', () => {
    const a = new TestPanel(group, 'A', [0, 0, -1]);
    const b = new TestPanel(group, 'B', [0.5, 0, -1]);
    manager.register(a);
    manager.register(b);
    manager.showAll();

    const anchor = manager.getAnchor();
    const radius = 0.55;

    // Both panels should sit roughly the same comfortable distance from the anchor.
    const distA = a.mesh.position.distanceTo(anchor);
    const distB = b.mesh.position.distanceTo(anchor);
    expect(distA).toBeCloseTo(radius, 2);
    expect(distB).toBeCloseTo(radius, 2);

    // The two panels should be spread horizontally around the anchor.
    expect(a.mesh.position.x).not.toBeCloseTo(b.mesh.position.x, 2);
    expect(a.mesh.position.x).toBeLessThan(b.mesh.position.x);

    // Panels should face the viewer (camera group origin), not the anchor.
    const forwardA = new THREE.Vector3(0, 0, 1).applyQuaternion(a.mesh.quaternion);
    const toViewerA = new THREE.Vector3(0, 0, 0).sub(a.mesh.position).normalize();
    expect(forwardA.dot(toViewerA)).toBeGreaterThan(0.85);
  });

  it('snaps panels to a comfortable distance from the anchor', () => {
    const panel = new TestPanel(group, 'A', [0, 0, -0.2]);
    manager.register(panel);

    manager.showPanel(panel);

    // The panel should end up an arm-length away from the anchor.
    const anchor = manager.getAnchor();
    const dist = panel.mesh.position.distanceTo(anchor);
    expect(dist).toBeGreaterThanOrEqual(0.45);
    expect(dist).toBeLessThanOrEqual(1.4);

    // Drag offsets are clamped separately so they cannot push panels
    // arbitrarily far from their anchor slot.
    const farPanel = new TestPanel(group, 'B', [3, 3, -3]);
    manager.register(farPanel);
    manager.showPanel(farPanel);
    manager.applyDragDelta(farPanel, new THREE.Vector3(0, 0, -2));
    expect(farPanel.mesh.position.distanceTo(anchor)).toBeLessThanOrEqual(1.41);
  });

  it('remembers drag deltas and keeps them after a relayout', () => {
    const panel = new TestPanel(group, 'A', [0, 0, -1]);
    manager.register(panel);
    manager.showPanel(panel);

    const before = panel.mesh.position.clone();
    manager.applyDragDelta(panel, new THREE.Vector3(0.1, -0.05, 0.05));
    const after = panel.mesh.position.clone();

    expect(after.x - before.x).toBeCloseTo(0.1, 2);
    expect(after.y - before.y).toBeCloseTo(-0.05, 2);
  });

  it('recenter() resets drag offsets back to the anchor arc', () => {
    const a = new TestPanel(group, 'A', [0, 0, -1]);
    const b = new TestPanel(group, 'B', [0.5, 0, -1]);
    manager.register(a);
    manager.register(b);
    manager.showAll();

    const originalA = a.mesh.position.clone();
    manager.applyDragDelta(a, new THREE.Vector3(0.2, 0.1, -0.1));
    expect(a.mesh.position.distanceTo(originalA)).toBeGreaterThan(0.05);

    manager.recenter();
    expect(a.mesh.position.distanceTo(originalA)).toBeLessThan(0.01);
  });
});

describe('PanelManager free-floating mode', () => {
  it('keeps panels parented to the camera group', () => {
    const cameraGroup = new THREE.Group();
    const analystAnchor = new THREE.Group();
    cameraGroup.add(analystAnchor);

    const manager = new PanelManager(cameraGroup, {
      analystAnchor,
      freeFloating: true,
    });
    const panel = new TestPanel(cameraGroup, 'A', [0.2, 1.5, -1]);
    manager.register(panel);

    expect(panel.mesh.parent).toBe(cameraGroup);
    expect(manager._launcherGroup.parent).toBe(analystAnchor);
  });

  it('retains panel default positions', () => {
    const group = new THREE.Group();
    const manager = new PanelManager(group, { freeFloating: true });
    const panel = new TestPanel(group, 'A', [0.2, 1.5, -1]);
    manager.register(panel);
    manager.showPanel(panel);

    expect(panel.mesh.position.toArray()).toEqual([0.2, 1.5, -1]);
  });

  it('does not re-layout panels when showing them', () => {
    const group = new THREE.Group();
    const manager = new PanelManager(group, { freeFloating: true });
    const panel = new TestPanel(group, 'A', [0.2, 1.5, -1]);
    manager.register(panel);
    manager.showPanel(panel);

    const anchor = manager.getAnchor();
    // In anchored mode the panel would be pulled to the anchor; here it stays put.
    expect(panel.mesh.position.distanceTo(anchor)).toBeGreaterThan(1.0);
  });

  it('serializes and restores panel positions', () => {
    const group = new THREE.Group();
    const manager = new PanelManager(group, { freeFloating: true });
    const a = new TestPanel(group, 'A', [0, 0, -1]);
    const b = new TestPanel(group, 'B', [0.5, 0, -1]);
    manager.register(a);
    manager.register(b);
    manager.showPanel(a);
    manager.hidePanel(b);

    a.mesh.position.set(0.1, 1.2, -0.9);

    const snapshot = manager.getPanelPositions();
    expect(snapshot).toHaveLength(2);
    expect(snapshot.find((p) => p.title === 'A')).toEqual({
      title: 'A',
      position: [0.1, 1.2, -0.9],
      visible: true,
    });
    expect(snapshot.find((p) => p.title === 'B')).toMatchObject({
      title: 'B',
      visible: false,
    });

    const restored = new PanelManager(group, { freeFloating: true });
    restored.register(new TestPanel(group, 'A', [0, 0, -1]));
    restored.register(new TestPanel(group, 'B', [0, 0, -1]));
    restored.setPanelPositions(snapshot);

    const restoredA = restored.panels.find((p) => p.title === 'A');
    const restoredB = restored.panels.find((p) => p.title === 'B');
    expect(restoredA.mesh.position.toArray()).toEqual([0.1, 1.2, -0.9]);
    expect(restoredA.mesh.visible).toBe(true);
    expect(restoredB.mesh.visible).toBe(false);
  });

  it('recenters panels to their default positions', () => {
    const group = new THREE.Group();
    const manager = new PanelManager(group, { freeFloating: true });
    const panel = new TestPanel(group, 'A', [0.2, 1.5, -1]);
    manager.register(panel);
    manager.showPanel(panel);

    panel.mesh.position.set(1, 2, -3);
    manager.recenter();

    expect(panel.mesh.position.toArray()).toEqual([0.2, 1.5, -1]);
  });

  it('notifies onChange when a panel is toggled', () => {
    const group = new THREE.Group();
    const changes = [];
    const manager = new PanelManager(group, {
      freeFloating: true,
      onChange: () => changes.push('change'),
    });
    const panel = new TestPanel(group, 'A', [0, 0, -1]);
    panel.mesh.visible = false;
    manager.register(panel);

    manager.showPanel(panel);
    manager.hidePanel(panel);

    expect(changes).toEqual(['change', 'change']);
  });

  it('notifies onChange when a panel is minimized directly', () => {
    const group = new THREE.Group();
    const changes = [];
    const manager = new PanelManager(group, {
      freeFloating: true,
      onChange: () => changes.push('change'),
    });
    const panel = new TestPanel(group, 'A', [0, 0, -1]);
    manager.register(panel);
    manager.showPanel(panel);
    changes.length = 0;

    panel.hide();

    expect(panel.mesh.visible).toBe(false);
    expect(manager.getPanelPositions().find((p) => p.title === 'A').visible).toBe(false);
    expect(changes).toEqual(['change']);
  });
});

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PanelManager } from '../src/vr/ui/PanelManager.ts';
import { MovablePanel } from '../src/vr/ui/MovablePanel.ts';

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

describe('PanelManager anchor clustering', () => {
  it('uses a custom anchor position when provided', () => {
    const group = new THREE.Group();
    const manager = new PanelManager(group, {
      anchorX: 0.2,
      anchorY: -0.2,
      anchorZ: -1.2,
    });

    const anchor = manager.getAnchor();
    expect(anchor.x).toBe(0.2);
    expect(anchor.y).toBe(-0.2);
    expect(anchor.z).toBe(-1.2);

    const panel = new TestPanel(group, 'A', [0, 0, -1]);
    manager.register(panel);
    manager.showPanel(panel);

    // The panel should be clustered near the anchor, not at its default position.
    expect(panel.mesh.position.distanceTo(anchor)).toBeGreaterThanOrEqual(0.45);
    expect(panel.mesh.position.distanceTo(anchor)).toBeLessThanOrEqual(1.4);
  });

  it('arranges three panels in a left-to-right arc around the anchor', () => {
    const group = new THREE.Group();
    const manager = new PanelManager(group);
    const anchor = manager.getAnchor();

    const left = new TestPanel(group, 'Left', [0, 0, -1]);
    const center = new TestPanel(group, 'Center', [0, 0, -1]);
    const right = new TestPanel(group, 'Right', [0, 0, -1]);
    manager.register(left);
    manager.register(center);
    manager.register(right);
    manager.showAll();

    // Horizontal ordering: left panel should have the most negative x.
    expect(left.mesh.position.x).toBeLessThan(center.mesh.position.x);
    expect(center.mesh.position.x).toBeLessThan(right.mesh.position.x);

    // Center panel sits closest to the anchor's forward axis; left/right are farther out.
    const leftDist = left.mesh.position.distanceTo(anchor);
    const rightDist = right.mesh.position.distanceTo(anchor);
    const centerDist = center.mesh.position.distanceTo(anchor);
    expect(centerDist).toBeCloseTo(0.55, 2);
    expect(leftDist).toBeCloseTo(rightDist, 2);
  });

  it('recenter() restores all panels to their anchor arc after dragging', () => {
    const group = new THREE.Group();
    const manager = new PanelManager(group);
    const a = new TestPanel(group, 'A', [0, 0, -1]);
    const b = new TestPanel(group, 'B', [0, 0, -1]);
    manager.register(a);
    manager.register(b);
    manager.showAll();

    const originalA = a.mesh.position.clone();
    const originalB = b.mesh.position.clone();

    manager.applyDragDelta(a, new THREE.Vector3(0.3, 0.2, -0.2));
    manager.applyDragDelta(b, new THREE.Vector3(-0.2, 0.1, 0.1));

    expect(a.mesh.position.distanceTo(originalA)).toBeGreaterThan(0.1);
    expect(b.mesh.position.distanceTo(originalB)).toBeGreaterThan(0.1);

    manager.recenter();

    expect(a.mesh.position.distanceTo(originalA)).toBeLessThan(0.01);
    expect(b.mesh.position.distanceTo(originalB)).toBeLessThan(0.01);
  });

  it('hides and shows panels without losing their anchor slot', () => {
    const group = new THREE.Group();
    const manager = new PanelManager(group);
    const panel = new TestPanel(group, 'A', [0, 0, -1]);
    manager.register(panel);
    manager.showPanel(panel);

    const posBefore = panel.mesh.position.clone();
    manager.hidePanel(panel);
    expect(panel.mesh.visible).toBe(false);

    manager.showPanel(panel);
    expect(panel.mesh.position.distanceTo(posBefore)).toBeLessThan(0.01);
  });

  it('defaults the anchor to a comfortable ~0.55 m distance', () => {
    const group = new THREE.Group();
    const manager = new PanelManager(group);
    const anchor = manager.getAnchor();
    expect(anchor.z).toBe(-0.55);
  });

  it('parents the launcher group to a provided analyst anchor', () => {
    const cameraGroup = new THREE.Group();
    const analystAnchor = new THREE.Group();
    cameraGroup.add(analystAnchor);

    const manager = new PanelManager(cameraGroup, { analystAnchor });
    expect(manager._launcherGroup.parent).toBe(analystAnchor);
  });

  it('reparents registered panels to the analyst anchor', () => {
    const cameraGroup = new THREE.Group();
    const analystAnchor = new THREE.Group();
    cameraGroup.add(analystAnchor);

    const manager = new PanelManager(cameraGroup, { analystAnchor });
    const panel = new TestPanel(cameraGroup, 'A', [0, 0, -1]);
    manager.register(panel);

    expect(panel.mesh.parent).toBe(analystAnchor);
  });

  it('keeps panel layout relative to the analyst anchor origin', () => {
    const cameraGroup = new THREE.Group();
    const analystAnchor = new THREE.Group();
    analystAnchor.position.set(0.1, -0.1, 0.2);
    cameraGroup.add(analystAnchor);

    const manager = new PanelManager(cameraGroup, { analystAnchor });
    const panel = new TestPanel(cameraGroup, 'A', [0, 0, -1]);
    manager.register(panel);
    manager.showPanel(panel);

    const anchor = manager.getAnchor();
    const localDist = panel.mesh.position.distanceTo(anchor);
    expect(localDist).toBeGreaterThanOrEqual(0.45);
    expect(localDist).toBeLessThanOrEqual(1.4);
  });
});

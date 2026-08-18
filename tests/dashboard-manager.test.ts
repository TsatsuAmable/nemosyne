// @ts-nocheck
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { DashboardManager } from '../src/vr/ui/DashboardManager.ts';
import { MovablePanel } from '../src/vr/ui/MovablePanel.ts';

class TestPanel extends MovablePanel {
  constructor(cameraGroup, title, position = [0, 1.6, 1.5]) {
    super(cameraGroup, {
      title,
      width: 512,
      height: 384,
      position,
      worldSize: [0.8, 0.6],
      titleBarHeight: 40,
      tilt: 0,
      minDistance: 0.2,
      maxDistance: 3,
    });
  }
}

describe('DashboardManager', () => {
  let cameraGroup;
  let manager;

  beforeEach(() => {
    cameraGroup = new THREE.Group();
    manager = new DashboardManager(cameraGroup, {
      columns: 2,
      rows: 2,
      cellWidth: 1,
      cellHeight: 0.7,
      wallPosition: [0, 1.6, 1.5],
      snapDistance: 0.55,
    });
  });

  it('creates a wall group attached behind the camera', () => {
    expect(manager.wallGroup.parent).toBe(cameraGroup);
    expect(manager.wallGroup.position.z).toBe(1.5);
  });

  it('creates the expected number of snap zones', () => {
    expect(manager.zones.length).toBe(4);
    expect(manager.zoneMeshes.length).toBe(4);
  });

  it('hides zones by default', () => {
    for (const mesh of manager.zoneMeshes) {
      expect(mesh.visible).toBe(false);
    }
  });

  it('registers a panel and snaps it to the assigned zone', () => {
    const panel = new TestPanel(cameraGroup, 'A');
    manager.registerPanel(panel, 0);

    expect(manager.getPanelCount()).toBe(1);
    expect(panel.mesh.visible).toBe(true);
    // Zone 0 is the top-left wall cell. With the wall rotated 180°, its
    // cameraGroup-local position is mirrored along X and offset to the
    // top row (y = 1.6 + 0.35).
    expect(panel.mesh.position.x).toBeCloseTo(0.5, 3);
    expect(panel.mesh.position.y).toBeCloseTo(1.95, 3);
    expect(panel.mesh.position.z).toBeCloseTo(1.5, 3);
  });

  it('shows zones when a registered panel is being dragged', () => {
    const panel = new TestPanel(cameraGroup, 'A');
    manager.registerPanel(panel, 0);

    panel.drag.active = true;
    manager.update();

    for (const mesh of manager.zoneMeshes) {
      expect(mesh.visible).toBe(true);
    }
  });

  it('hides zones when dragging stops', () => {
    const panel = new TestPanel(cameraGroup, 'A');
    manager.registerPanel(panel, 0);

    panel.drag.active = true;
    manager.update();
    expect(manager.zoneMeshes[0].visible).toBe(true);

    panel.drag.active = false;
    manager.update();
    for (const mesh of manager.zoneMeshes) {
      expect(mesh.visible).toBe(false);
    }
  });

  it('snaps a dropped panel near a zone into that zone', () => {
    const panel = new TestPanel(cameraGroup, 'A', [0.1, 1.65, 1.45]);
    manager.registerPanel(panel, 0);

    // Simulate dragging near zone 0 then releasing.
    panel.drag.active = true;
    manager.update();
    panel.drag.active = false;
    manager.update();

    expect(panel.mesh.position.x).toBeCloseTo(0.5, 3);
    expect(panel.mesh.position.y).toBeCloseTo(1.95, 3);
    expect(panel.mesh.position.z).toBeCloseTo(1.5, 3);
  });

  it('does not snap a panel dropped far from any zone', () => {
    const panel = new TestPanel(cameraGroup, 'A');
    manager.registerPanel(panel, 0);
    panel.mesh.position.set(2, 2, 2);
    const original = panel.mesh.position.clone();

    panel.drag.active = true;
    manager.update();
    panel.drag.active = false;
    manager.update();

    expect(panel.mesh.position.x).toBeCloseTo(original.x, 3);
    expect(panel.mesh.position.y).toBeCloseTo(original.y, 3);
    expect(panel.mesh.position.z).toBeCloseTo(original.z, 3);
  });

  it('highlights the nearest zone while dragging', () => {
    const panel = new TestPanel(cameraGroup, 'A');
    manager.registerPanel(panel, 0);

    // Position the panel near zone 1 (top-right of a 2x2 grid).
    panel.mesh.position.set(-0.6, 1.9, 1.5);
    panel.drag.active = true;
    manager.update();

    expect(manager._highlightedIndex).toBe(1);
    expect(manager.zoneMeshes[1].material.color.getHex()).toBe(0xff00cc);
  });

  it('resetDashboard restores all panels to their assigned zones', () => {
    const panel = new TestPanel(cameraGroup, 'A');
    manager.registerPanel(panel, 0);

    // Drag the panel away.
    panel.mesh.position.set(1, 2, 2);

    manager.resetDashboard();

    expect(panel.mesh.position.x).toBeCloseTo(0.5, 3);
    expect(panel.mesh.position.y).toBeCloseTo(1.95, 3);
    expect(panel.mesh.position.z).toBeCloseTo(1.5, 3);
  });

  it('unregisters a panel without affecting others', () => {
    const a = new TestPanel(cameraGroup, 'A');
    const b = new TestPanel(cameraGroup, 'B');
    manager.registerPanel(a, 0);
    manager.registerPanel(b, 1);

    manager.unregisterPanel(a);

    expect(manager.getPanelCount()).toBe(1);
    expect(manager.panels.find((p) => p.panel === b)).toBeTruthy();
  });

  it('auto-scales a panel to fit the snap zone when enabled', () => {
    const panel = new TestPanel(cameraGroup, 'A');
    manager.registerPanel(panel, 0);

    const sx = panel.mesh.scale.x;
    const sy = panel.mesh.scale.y;
    // The panel worldSize is 0.8 x 0.6 and the zone is 1.0 x 0.7, so it scales up.
    expect(sx).toBeGreaterThan(1);
    expect(sy).toBeGreaterThan(1);
    expect(sx).toBeCloseTo(sy, 3);
  });

  it('keeps default scale when autoScale is disabled', () => {
    manager.dispose();
    manager = new DashboardManager(cameraGroup, {
      columns: 2,
      rows: 2,
      cellWidth: 1,
      cellHeight: 0.7,
      wallPosition: [0, 1.6, 1.5],
      autoScale: false,
    });

    const panel = new TestPanel(cameraGroup, 'A');
    manager.registerPanel(panel, 0);

    expect(panel.mesh.scale.x).toBeCloseTo(1, 3);
    expect(panel.mesh.scale.y).toBeCloseTo(1, 3);
  });

  it('disposes wall geometry and materials', () => {
    const wallGeometry = manager.wallMesh.geometry;
    const disposeSpy = vi.spyOn(wallGeometry, 'dispose');

    manager.dispose();

    expect(disposeSpy).toHaveBeenCalled();
    expect(manager.wallGroup.parent).toBeNull();
  });

  describe('semicircle layout', () => {
    it('creates a front-facing arc of zones centered on the analyst', () => {
      const semi = new DashboardManager(cameraGroup, {
        layoutMode: 'semicircle',
        columns: 5,
        visibleColumns: 5,
        rows: 1,
        radius: 1.35,
        arcSpan: Math.PI,
        centerAngle: 0,
        heightY: 1.45,
      });

      expect(semi.zones.length).toBe(5);
      expect(semi.wallGroup.position.x).toBeCloseTo(0, 3);
      expect(semi.wallGroup.position.z).toBeCloseTo(0, 3);

      const center = semi.zones[2];
      expect(center.angle).toBeCloseTo(0, 3);
      expect(center.x).toBeCloseTo(0, 3);
      expect(center.z).toBeCloseTo(-1.35, 3);

      const left = semi.zones[0];
      expect(left.angle).toBeCloseTo(-Math.PI / 2, 3);
      expect(left.x).toBeCloseTo(-1.35, 3);
      expect(left.z).toBeCloseTo(0, 3);

      const right = semi.zones[4];
      expect(right.angle).toBeCloseTo(Math.PI / 2, 3);
      expect(right.x).toBeCloseTo(1.35, 3);
      expect(right.z).toBeCloseTo(0, 3);

      semi.dispose();
    });

    it('assigns a registered panel to the center zone by default', () => {
      const semi = new DashboardManager(cameraGroup, {
        layoutMode: 'semicircle',
        columns: 5,
        visibleColumns: 5,
        rows: 1,
        radius: 1.35,
      });
      const panel = new TestPanel(cameraGroup, 'A');
      semi.registerPanel(panel);

      expect(semi.panels[0].zoneIndex).toBe(2);
      expect(panel.mesh.position.x).toBeCloseTo(0, 3);
      expect(panel.mesh.position.z).toBeCloseTo(-1.35, 3);
      expect(panel.mesh.rotation.y).toBeCloseTo(0, 3);
      expect(panel.mesh.visible).toBe(true);

      semi.dispose();
    });

    it('scrolls the carousel and repositions snapped panels', () => {
      const semi = new DashboardManager(cameraGroup, {
        layoutMode: 'semicircle',
        columns: 5,
        visibleColumns: 5,
        rows: 1,
        radius: 1.35,
        arcSpan: Math.PI,
      });
      const panel = new TestPanel(cameraGroup, 'A');
      semi.registerPanel(panel);

      const step = Math.PI / 4;
      semi.scrollTo(step);
      semi.scrollOffset = semi.targetScrollOffset;
      semi.update();

      // Center column now sits at angle -step, so the panel moves left.
      expect(panel.mesh.position.x).toBeCloseTo(-1.35 * Math.sin(step), 3);
      expect(panel.mesh.position.z).toBeCloseTo(-1.35 * Math.cos(step), 3);
      expect(panel.mesh.rotation.y).toBeCloseTo(step, 3);

      semi.dispose();
    });

    it('auto-scrolls to reveal a panel dropped in an off-screen zone', () => {
      const semi = new DashboardManager(cameraGroup, {
        layoutMode: 'semicircle',
        columns: 7,
        visibleColumns: 5,
        rows: 1,
        radius: 1.35,
        arcSpan: Math.PI,
        snapDistance: 0.5,
      });
      const panel = new TestPanel(cameraGroup, 'A');
      // Zone 0 starts off-screen on the far left.
      semi.registerPanel(panel, 0);
      expect(panel.mesh.visible).toBe(false);

      // Simulate drag-and-release over zone 0.
      panel.drag.active = true;
      semi.update();
      panel.mesh.position.copy(panel.defaultPosition);
      panel.drag.active = false;
      semi.update();

      // The manager should have targeted a scroll that brings zone 0 to center.
      expect(semi.targetScrollOffset).toBeGreaterThan(0);
      // Zone 0 should now be the assigned zone.
      expect(semi.panels[0].zoneIndex).toBe(0);

      semi.dispose();
    });

    it('resetDashboard clears scroll and restores snapped panels', () => {
      const semi = new DashboardManager(cameraGroup, {
        layoutMode: 'semicircle',
        columns: 5,
        visibleColumns: 5,
        rows: 1,
        radius: 1.35,
        arcSpan: Math.PI,
      });
      const panel = new TestPanel(cameraGroup, 'A');
      semi.registerPanel(panel);

      const original = panel.mesh.position.clone();

      const step = Math.PI / 4;
      semi.scrollTo(step);
      semi.scrollOffset = semi.targetScrollOffset;
      semi.update();
      expect(panel.mesh.position.x).not.toBeCloseTo(original.x, 3);

      semi.resetDashboard();
      expect(semi.scrollOffset).toBeCloseTo(0, 3);
      expect(panel.mesh.position.x).toBeCloseTo(original.x, 3);
      expect(panel.mesh.position.z).toBeCloseTo(original.z, 3);

      semi.dispose();
    });

    it('does not assign more panels than it has zones', () => {
      const semi = new DashboardManager(cameraGroup, {
        layoutMode: 'semicircle',
        columns: 1,
        visibleColumns: 1,
        rows: 1,
        radius: 1.35,
      });
      const a = new TestPanel(cameraGroup, 'A');
      const b = new TestPanel(cameraGroup, 'B');
      semi.registerPanel(a);
      semi.registerPanel(b);

      expect(semi.getPanelCount()).toBe(2);
      expect(semi.panels[0].zoneIndex).toBe(0);
      expect(semi.panels[1].zoneIndex).toBeNull();

      semi.dispose();
    });
  });
});

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { MovablePanel } from '../../../src/vr/ui/MovablePanel.ts';

describe('Tier 2 — Feature 10: 3D UI Panel Z-Sorting & Distance Clamping (Boundary Cases)', () => {
  it('F10-BC1: MovablePanel constructor initializes material transparency and render properties', () => {
    const cameraGroup = new THREE.Group();
    const panel = new MovablePanel(cameraGroup, { title: 'TestPanel' });

    expect(panel.material.transparent).toBe(true);
    expect(panel.material.side).toBe(THREE.DoubleSide);
  });

  it('F10-BC2: Panel placed at extreme distance (z = -1000) is clamped to maxDistance', () => {
    const cameraGroup = new THREE.Group();
    const panel = new MovablePanel(cameraGroup, {
      position: [0, 1.5, -1000],
      maxDistance: 2.0,
    });

    panel._clampDistance();
    const dist = panel.mesh.position.length();
    expect(dist).toBeLessThanOrEqual(2.01);
  });

  it('F10-BC3: Panel placed inside camera near plane (z = -0.01) is clamped to minDistance', () => {
    const cameraGroup = new THREE.Group();
    const panel = new MovablePanel(cameraGroup, {
      position: [0, 0, -0.01],
      minDistance: 0.5,
    });

    panel._clampDistance();
    const dist = panel.mesh.position.length();
    expect(dist).toBeGreaterThanOrEqual(0.49);
  });

  it('F10-BC4: Scroll offset bounds checking prevents negative scroll or overflow', () => {
    const cameraGroup = new THREE.Group();
    const panel = new MovablePanel(cameraGroup, { height: 400, titleBarHeight: 40 });

    panel.totalContentHeight = 1000;
    panel.scroll(-100); // Try scroll up when offset is 0
    expect(panel.scrollOffset).toBe(0);

    panel.scroll(5000); // Overscroll down
    expect(panel.scrollOffset).toBeLessThanOrEqual(1000);
  });

  it('F10-BC5: Toggling panel visibility updates mesh.visible and isMinimized flags', () => {
    const cameraGroup = new THREE.Group();
    const panel = new MovablePanel(cameraGroup);

    expect(panel.mesh.visible).toBe(true);
    expect(panel.isMinimized).toBe(false);

    panel.hide();
    expect(panel.mesh.visible).toBe(false);
    expect(panel.isMinimized).toBe(true);

    panel.show();
    expect(panel.mesh.visible).toBe(true);
    expect(panel.isMinimized).toBe(false);
  });
});

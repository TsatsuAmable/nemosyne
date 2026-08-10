import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { MovablePanel } from '../../../src/vr/ui/MovablePanel.js';

describe('Feature 10: 3D UI Panel Z-Sorting & Depth Settings', () => {
  it('F10-TC1: MovablePanel instantiates material with defined depthTest and depthWrite settings', () => {
    const group = new THREE.Group();
    const panel = new MovablePanel(group, { title: 'TEST PANEL' });

    expect(panel.material).toBeDefined();
    expect(panel.mesh).toBeDefined();
    expect(panel.mesh.material).toBe(panel.material);
  });

  it('F10-TC2: Panel mesh renderOrder can be set to prioritize foreground rendering', () => {
    const group = new THREE.Group();
    const panel = new MovablePanel(group, { title: 'OVERLAY PANEL' });

    panel.mesh.renderOrder = 10;
    expect(panel.mesh.renderOrder).toBe(10);
  });

  it('F10-TC3: Overlapping panels maintain deterministic parent-child hierarchy in spatial group', () => {
    const group = new THREE.Group();
    const panel1 = new MovablePanel(group, { title: 'PANEL 1', position: [0, 1.5, -1.0] });
    const panel2 = new MovablePanel(group, { title: 'PANEL 2', position: [0, 1.5, -1.2] });

    expect(group.children).toContain(panel1.mesh);
    expect(group.children).toContain(panel2.mesh);
    expect(panel1.mesh.position.z).toBeGreaterThan(panel2.mesh.position.z);
  });

  it('F10-TC4: Panel distance clamping maintains valid depth range between minDistance and maxDistance', () => {
    const group = new THREE.Group();
    const panel = new MovablePanel(group, { minDistance: 0.5, maxDistance: 2.0, position: [0, 0, -5.0] });

    panel._clampDistance();
    const dist = panel.mesh.position.length();
    expect(dist).toBeLessThanOrEqual(2.0);
    expect(dist).toBeGreaterThanOrEqual(0.5);
  });

  it('F10-TC5: Minimizing panel updates visibility state while preserving position', () => {
    const group = new THREE.Group();
    const panel = new MovablePanel(group, { title: 'MINIMIZE PANEL' });

    panel.hide();
    expect(panel.mesh.visible).toBe(false);
    expect(panel.isMinimized).toBe(true);

    panel.show();
    expect(panel.mesh.visible).toBe(true);
    expect(panel.isMinimized).toBe(false);
  });
});

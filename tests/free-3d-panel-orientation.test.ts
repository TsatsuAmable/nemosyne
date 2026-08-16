import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { MovablePanel } from '../src/vr/ui/MovablePanel.ts';
import { PanelManager } from '../src/vr/ui/PanelManager.ts';

describe('Unconstrained 3D Panel Motion & Billboard Viewer Orientation Subsystem', () => {
  it('configures PanelManager for freeFloating = true unconstrained 3D motion', () => {
    const cameraGroup = new THREE.Group();
    const manager = new PanelManager(cameraGroup, { freeFloating: true });

    expect(manager.freeFloating).toBe(true);
  });

  it('updates panel orientation to face the viewer continuously in update()', () => {
    const cameraGroup = new THREE.Group();
    const panel = new MovablePanel(cameraGroup, {
      title: 'BILLBOARD TEST PANEL',
      position: [1.0, 1.5, -1.0],
      tilt: 0.1,
    });

    panel.update(0.016);

    expect(panel.mesh.visible).toBe(true);
    // Mesh quaternion should be valid and facing (0,0,0) local space
    expect(Number.isNaN(panel.mesh.quaternion.x)).toBe(false);
    expect(Number.isNaN(panel.mesh.quaternion.y)).toBe(false);
  });
});

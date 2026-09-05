// @ts-nocheck
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { MovablePanel } from '../src/vr/ui/MovablePanel.ts';
import { PanelManager } from '../src/vr/ui/PanelManager.ts';
import { setBodyFrameViewerTargetLocal } from '../src/vr/spatial/BodyFrameState.ts';

describe('Free 3D Panel Motion & Body-Frame Orientation', () => {
  it('configures PanelManager for freeFloating = true unconstrained 3D motion', () => {
    const cameraGroup = new THREE.Group();
    const manager = new PanelManager(cameraGroup, { freeFloating: true });

    expect(manager.freeFloating).toBe(true);
  });

  it('orients in parent-local space and does not counter-rotate toward world origin', () => {
    const bodyFrame = new THREE.Group();
    bodyFrame.position.set(4, 1.2, -20);
    bodyFrame.rotation.y = 0.7;
    const panel = new MovablePanel(bodyFrame, {
      title: 'BODY FRAME PANEL',
      position: [1, 0.2, -1],
      tilt: 0.1,
    });

    panel.update(0.016);
    const initialYaw = panel.mesh.rotation.y;
    expect(initialYaw).toBeCloseTo(-Math.PI / 4, 5);

    // Moving/rotating the parent in world space must not change the panel's
    // local reading yaw. The old lookAt(0,0,0) failed this invariant.
    bodyFrame.position.set(-8, 2, 30);
    bodyFrame.rotation.y = -1.1;
    bodyFrame.updateMatrixWorld(true);
    panel.update(0.016);

    expect(panel.mesh.rotation.y).toBeCloseTo(initialYaw, 6);
    expect(panel.mesh.rotation.x).toBeCloseTo(-0.1, 6);
  });

  it('faces the body viewer target when the workspace itself is forward-offset', () => {
    const bodyFrame = new THREE.Group();
    setBodyFrameViewerTargetLocal(bodyFrame, new THREE.Vector3(0, 0, 1.2));
    const panel = new MovablePanel(bodyFrame, {
      title: 'OFFSET BODY FRAME PANEL',
      position: [1, 0.2, -1],
      tilt: 0.1,
    });

    panel.update(0.016);
    expect(panel.mesh.rotation.y).toBeCloseTo(Math.atan2(-1, 2.2), 6);
  });
});

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { MovablePanel } from '../src/vr/ui/MovablePanel.ts';
import { DashboardManager } from '../src/vr/ui/DashboardManager.ts';
import { HandWheelMenu } from '../src/vr/ui/HandWheelMenu.ts';

describe('Regression Protection: MatrixWorld Null Safety', () => {
  it('prevents MovablePanel._planeDragIntersection from crashing when parentGroup is null', () => {
    const parentGroup = new THREE.Group();
    const panel = new MovablePanel({ parentGroup });
    panel.parentGroup = null; // simulate unattached parentGroup
    expect(panel.parentGroup).toBeNull();

    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));
    const mockPointer = { handedness: 'left', raycaster } as any;
    expect(() => panel.handlePointerDown(raycaster, mockPointer)).not.toThrow();
  });

  it('prevents DashboardManager._panelCenterInWallLocal from crashing when panel.mesh is null or unattached', () => {
    const mgr = new DashboardManager({ columns: 3, rows: 2 });
    const mockPanelNoMesh = { title: 'No Mesh', mesh: null };
    expect(() => mgr.registerPanel(mockPanelNoMesh as any)).not.toThrow();
  });

  it('prevents HandWheelMenu._updatePointerAngle and _updateHover from crashing when camera or group is missing', () => {
    const engineMock = { camera: null, renderer: null };
    const coordinatorMock = {} as any;
    const menu = new HandWheelMenu(engineMock as any, coordinatorMock);
    expect(() => menu._updatePointerAngle()).not.toThrow();
    expect(() => menu._updateHover()).not.toThrow();
  });
});

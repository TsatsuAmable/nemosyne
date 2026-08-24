// @ts-nocheck
// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { MovablePanel } from '../src/vr/ui/MovablePanel.ts';
import { DashboardManager } from '../src/vr/ui/DashboardManager.ts';
import { HandWheelMenu } from '../src/vr/ui/HandWheelMenu.ts';

describe('Regression Protection: MatrixWorld Null Safety', () => {
  it('prevents MovablePanel._planeDragIntersection from crashing when parentGroup is null', () => {
    const cameraGroup = new THREE.Group();
    const panel = new MovablePanel(cameraGroup, { title: 'Test Panel' });
    panel.parentGroup = null;
    expect(panel.parentGroup).toBeNull();

    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));
    const mockPointer = { handedness: 'left', getRay: () => raycaster.ray } as any;
    expect(() => panel.handlePointerDown(raycaster, mockPointer)).not.toThrow();
  });

  it('prevents DashboardManager._panelCenterInWallLocal from crashing when panel.mesh is null or unattached', () => {
    const cameraGroup = new THREE.Group();
    const mgr = new DashboardManager(cameraGroup, { columns: 3, rows: 2 });
    const mockPanelNoMesh = { title: 'No Mesh', mesh: null };
    expect(() => mgr.registerPanel(mockPanelNoMesh as any)).not.toThrow();
  });

  it('skips HandWheel hover raycasting until both camera and group are available', () => {
    const engineMock = { camera: null, renderer: null };
    const coordinatorMock = {} as any;
    const menu = new HandWheelMenu(engineMock as any, coordinatorMock);
    const intersectObjects = vi.spyOn(menu._raycaster, 'intersectObjects');

    menu._updateHover();
    expect(intersectObjects).not.toHaveBeenCalled();

    engineMock.camera = new THREE.PerspectiveCamera();
    menu.group = null;
    menu._updateHover();
    expect(intersectObjects).not.toHaveBeenCalled();
  });
});

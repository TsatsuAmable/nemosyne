// @ts-nocheck
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SpatialPanel } from '../src/vr/ui-system/SpatialPanel.ts';
import { WorldSceneComposer } from '../src/vr/coordinators/WorldSceneComposer.ts';
import { getBodyFrameViewerTargetLocal } from '../src/vr/spatial/BodyFrameState.ts';

function makeComposer() {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.75, 0);
  const cameraGroup = new THREE.Group();
  cameraGroup.add(camera);
  const mockEngine: any = {
    camera,
    cameraGroup,
    scene: new THREE.Scene(),
    xrFrame: null,
    xrRefSpace: null,
    addUpdatable() {},
    removeUpdatable() {},
  };
  return { camera, cameraGroup, composer: new WorldSceneComposer(mockEngine) };
}

describe('Free 3D Panel Motion & Body-Frame Orientation', () => {
  it('keeps panel orientation in parent-local space under rig motion and does not counter-rotate toward world origin', () => {
    const { camera, composer } = makeComposer();
    composer.update(0.016);
    const panel = new SpatialPanel({}, composer.analystAnchor);
    panel.position.set(1, 0.2, -1);
    panel.rotation.order = 'YXZ';
    panel.rotation.set(-0.1, Math.PI / 4, 0);
    panel.updateMatrixWorld(true);
    const initialPosition = panel.position.clone();
    const initialYaw = panel.rotation.y;
    const initialPitch = panel.rotation.x;

    // Moving/rotating the locomotion rig and headset in world space must not
    // change the panel's anchor-local pose. The retired canvas substrate used
    // lookAt(0,0,0) and failed this invariant; the spatial substrate carries it
    // by parenting panels under the analyst anchor.
    camera.position.set(-8, 2, 30);
    camera.rotation.y = -1.1;
    camera.updateMatrixWorld(true);
    composer.update(0.016);
    panel.updateMatrixWorld(true);

    expect(panel.position.distanceTo(initialPosition)).toBeLessThan(1e-9);
    expect(panel.rotation.y).toBeCloseTo(initialYaw, 6);
    expect(panel.rotation.x).toBeCloseTo(initialPitch, 6);
    expect(panel.rotation.order).toBe('YXZ');
  });

  it('records the body viewer target in anchor-local coordinates when the workspace itself is forward-offset', () => {
    const { camera, composer } = makeComposer();
    composer.setPanelDistance(1.2);
    camera.rotation.y = Math.PI / 2;
    composer.update(0.016);

    const panel = new SpatialPanel({}, composer.analystAnchor);
    panel.position.set(1, 0.2, -1);
    panel.updateMatrixWorld(true);

    // The reading target is anchored-local (local +Z at the panel distance),
    // so a panel facing it computes its yaw from parent-local geometry only.
    const target = getBodyFrameViewerTargetLocal(composer.analystAnchor);
    expect(target.toArray()).toEqual([0, 0, 1.2]);

    // Camera/headset translation in world space must not drag the recorded
    // reading target or the panel's anchor-local placement.
    camera.position.set(4, 1.7, 9);
    camera.updateMatrixWorld(true);
    composer.update(0.016);
    panel.updateMatrixWorld(true);
    expect(panel.position.distanceTo(new THREE.Vector3(1, 0.2, -1))).toBeLessThan(1e-9);

    const dx = target.x - panel.position.x;
    const dz = target.z - panel.position.z;
    expect(Math.atan2(dx, dz)).toBeCloseTo(Math.atan2(-1, 2.2), 6);
  });
});
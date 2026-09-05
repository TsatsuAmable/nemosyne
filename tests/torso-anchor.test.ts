// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WorldSceneComposer } from '../src/vr/coordinators/WorldSceneComposer.ts';
import {
  beginBodyFramePanelDrag,
  endBodyFramePanelDrag,
  getBodyFrameViewerTargetLocal,
} from '../src/vr/spatial/BodyFrameState.ts';

function makeComposer() {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.75, 0);
  const cameraGroup = new THREE.Group();
  cameraGroup.add(camera);
  const updatables: any[] = [];
  const mockEngine: any = {
    camera,
    cameraGroup,
    scene: new THREE.Scene(),
    xrFrame: null,
    xrRefSpace: null,
    addUpdatable(u: any) {
      updatables.push(u);
    },
    removeUpdatable() {},
  };
  return { camera, cameraGroup, composer: new WorldSceneComposer(mockEngine) };
}

describe('Stable Body Frame Tracking Subsystem', () => {
  it('uses the locomotion rig as translation authority and ignores physical HMD X/Z lean', () => {
    const { camera, composer } = makeComposer();
    composer.update(0.016);
    const baseline = composer.analystAnchor.position.clone();

    camera.position.set(0.45, 1.75, -0.6);
    composer.update(0.016);

    expect(composer.analystAnchor.position.x).toBeCloseTo(baseline.x, 6);
    expect(composer.analystAnchor.position.z).toBeCloseTo(baseline.z, 6);
    expect(composer.analystAnchor.position.y).toBeCloseTo(1.5, 6);
  });

  it('keeps ordinary head scanning inside the yaw deadband from moving the workspace', () => {
    const { camera, composer } = makeComposer();
    composer.update(0.016);
    const baselineYaw = composer.analystAnchor.rotation.y;

    camera.rotation.set(0, THREE.MathUtils.degToRad(12), 0);
    for (let i = 0; i < 60; i++) composer.update(1 / 72);

    expect(composer.analystAnchor.rotation.y).toBeCloseTo(baselineYaw, 6);
  });

  it('does not accumulate opposing out-of-deadband gaze scans into a body turn', () => {
    const { camera, composer } = makeComposer();
    composer.update(1 / 72);
    let maxAbsYaw = 0;

    // Each excursion is outside the 18° entry band, but the direction flips
    // before the 0.2 s intent gate can be satisfied. Magnitude-only timing would
    // incorrectly accumulate these samples into a body-heading change.
    for (let i = 0; i < 30; i++) {
      camera.rotation.y = THREE.MathUtils.degToRad(i % 2 === 0 ? 20 : -20);
      composer.update(1 / 72);
      maxAbsYaw = Math.max(maxAbsYaw, Math.abs(composer.analystAnchor.rotation.y));
    }

    expect(maxAbsYaw).toBeLessThan(1e-6);
  });

  it('accepts a sustained heading change and damps it using elapsed time', () => {
    const { camera, composer } = makeComposer();
    composer.update(1 / 72);
    camera.rotation.set(0, Math.PI / 2, 0);

    // The sustained-turn gate prevents an immediate workspace chase.
    for (let i = 0; i < 10; i++) composer.update(1 / 72);
    expect(Math.abs(composer.analystAnchor.rotation.y)).toBeLessThan(0.01);

    for (let i = 0; i < 40; i++) composer.update(1 / 72);
    expect(composer.analystAnchor.rotation.y).toBeGreaterThan(0.5);
    expect(composer.analystAnchor.rotation.y).toBeLessThan(Math.PI / 2);
  });

  it('freezes the body-frame transform while a panel drag is active', () => {
    const { camera, composer } = makeComposer();
    composer.update(0.016);
    const frozenPosition = composer.analystAnchor.position.clone();
    const frozenYaw = composer.analystAnchor.rotation.y;

    beginBodyFramePanelDrag(composer.analystAnchor);
    camera.position.y = 2.1;
    camera.rotation.y = Math.PI / 2;
    for (let i = 0; i < 30; i++) composer.update(1 / 72);

    expect(composer.analystAnchor.position.distanceTo(frozenPosition)).toBeLessThan(1e-9);
    expect(composer.analystAnchor.rotation.y).toBeCloseTo(frozenYaw, 9);

    endBodyFramePanelDrag(composer.analystAnchor);
    composer.update(1 / 72);
    expect(composer.analystAnchor.position.y).toBeCloseTo(1.85, 6);
  });

  it('applies panel distance along body heading and publishes the body viewer target', () => {
    const { camera, composer } = makeComposer();
    camera.rotation.y = Math.PI / 2;
    composer.setPanelDistance(1.2);
    composer.update(1 / 72);

    expect(composer.analystAnchor.position.x).toBeCloseTo(-1.2, 5);
    expect(composer.analystAnchor.position.z).toBeCloseTo(0, 5);
    const target = getBodyFrameViewerTargetLocal(composer.analystAnchor);
    expect(target.toArray()).toEqual([0, 0, 1.2]);
  });

  it('prefers the current XRFrame viewer pose over stale camera state', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(9, 9, 9);
    camera.rotation.y = -1;
    const cameraGroup = new THREE.Group();
    cameraGroup.add(camera);
    const orientation = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      0.6
    );
    const mockEngine: any = {
      camera,
      cameraGroup,
      scene: new THREE.Scene(),
      addUpdatable() {},
      removeUpdatable() {},
      xrRefSpace: {},
      xrFrame: {
        getViewerPose: () => ({
          transform: {
            position: { x: 0.3, y: 1.8, z: -0.4 },
            orientation: {
              x: orientation.x,
              y: orientation.y,
              z: orientation.z,
              w: orientation.w,
            },
          },
        }),
      },
    };

    const composer = new WorldSceneComposer(mockEngine);
    composer.update(1 / 72);

    expect(composer.analystAnchor.position.y).toBeCloseTo(1.55, 6);
    expect(composer.analystAnchor.rotation.y).toBeCloseTo(0.6, 6);
  });
});

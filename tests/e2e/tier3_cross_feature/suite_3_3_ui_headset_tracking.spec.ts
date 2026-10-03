import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WorldSceneComposer } from '../../../src/vr/coordinators/WorldSceneComposer.ts';
import { SpatialPanel } from '../../../src/vr/ui-system/SpatialPanel.ts';
import type { Raycaster } from 'three';

// FM4-UI-CLEAN: re-pinned on the live SpatialPanel substrate. INT-3.3.2's
// original form seeded the retired canvas substrate's internal drag state
// (drag distance/offset + min/max release clamp). The live equivalent is the
// grab-rail drag path of SpatialPanel, which tracks the pointer through a
// drag plane and commits position bounds on release.

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

/** Stub raycaster serving a single fixed intersectObject hit to grab-rail probes. */
function grabRailRaycaster(hitPoint: THREE.Vector3): Raycaster {
  return {
    intersectObject(_object: THREE.Object3D, _recursive: boolean) {
      return [{ point: hitPoint.clone(), distance: 0, object: null }];
    },
  } as unknown as Raycaster;
}

describe('Tier 3 — Suite 3.3: Spatial UI Ergonomics × Stable Body Frame (F9 × F10)', () => {
  it('INT-3.3.1: head lean does not move the body-locked panel cluster', () => {
    const { camera, composer } = makeComposer();
    const panel = new SpatialPanel({}, composer.analystAnchor);
    panel.position.set(0.6, 0.1, -1.2);
    panel.updateMatrixWorld();

    composer.update(0.016);
    const anchorBefore = composer.analystAnchor.position.clone();
    const localPanelBefore = panel.position.clone();

    camera.position.set(0.5, 1.7, -0.4);
    camera.updateMatrixWorld(true);
    composer.update(0.016);
    panel.updateMatrixWorld();

    expect(composer.analystAnchor.position.x).toBeCloseTo(anchorBefore.x, 6);
    expect(composer.analystAnchor.position.z).toBeCloseTo(anchorBefore.z, 6);
    expect(panel.position.distanceTo(localPanelBefore)).toBeLessThan(1e-9);
    expect(panel.mesh.parent).toBe(composer.analystAnchor);
  });

  it('INT-3.3.2: panel drag tracks the pointer directly and commits distance bounds on release', () => {
    const torsoAnchor = new THREE.Group();
    const panel = new SpatialPanel({}, torsoAnchor);
    const grabRail = panel.getGrabRailMesh()!;
    expect(grabRail).toBeTruthy();

    // Grab the rail at 1.2 m in front of the torso: the grab anchors the panel
    // to the pointer at the grabbed depth.
    const grabRaycaster = grabRailRaycaster(new THREE.Vector3(0, 0.5, -1.2));
    expect(panel.handleGrabStart(grabRaycaster, 0)).toBe(true);
    expect(panel.isGrabbed).toBe(true);

    // A pointer that shifts right moves the panel along the drag plane.
    const moveRaycaster = new THREE.Raycaster(
      new THREE.Vector3(0.6, 0.9, 5),
      new THREE.Vector3(0, -0.3, -1)
    );
    expect(panel.handleGrabMove(moveRaycaster)).toBe(true);
    expect(panel.position.x).toBeGreaterThan(0);
    expect(panel.position.x).toBeLessThan(0.5);

    // Releasing a body-locked panel commits it into the layout envelope
    // (±1.5 x, [0.1, 1.0] y, [-2.0, -0.5] z) — the live bounds commit.
    expect(panel.handleGrabEnd()).toBe(true);
    expect(panel.isGrabbed).toBe(false);
    expect(Math.abs(panel.position.x)).toBeLessThanOrEqual(1.5 + 1e-6);
    expect(panel.position.y).toBeGreaterThanOrEqual(0.1 - 1e-6);
    expect(panel.position.y).toBeLessThanOrEqual(1.0 + 1e-6);
    expect(panel.position.z).toBeLessThanOrEqual(-0.5 + 1e-6);
    expect(panel.position.z).toBeGreaterThanOrEqual(-2.0 - 1e-6);
  });
});

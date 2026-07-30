import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { Locomotion } from '../src/vr/Locomotion.js';

function makeEngine() {
  const scene = new THREE.Scene();
  const cameraGroup = new THREE.Group();
  const camera = new THREE.PerspectiveCamera();
  cameraGroup.add(camera);
  return {
    scene,
    camera,
    cameraGroup,
    renderer: {
      xr: {
        getSession: vi.fn().mockReturnValue(null),
      },
    },
    input: {
      raycaster: new THREE.Raycaster(),
      hands: [],
    },
  };
}

describe('Locomotion', () => {
  let engine;
  let locomotion;

  beforeEach(() => {
    engine = makeEngine();
    locomotion = new Locomotion(engine);
  });

  afterEach(() => {
    locomotion.dispose();
  });

  it('adds, retrieves, and removes named anchors', () => {
    locomotion.addAnchor('overview', [0, 0, -6], 0, 'Overview');
    expect(locomotion.getAnchor('overview').position.z).toBe(-6);

    locomotion.removeAnchor('overview');
    expect(locomotion.getAnchor('overview')).toBeUndefined();
  });

  it('teleports the camera group to an anchor position and yaw', () => {
    locomotion.addAnchor('north', [-4, 0, -6], Math.PI / 4, 'North');
    const result = locomotion.teleportToAnchor('north');

    expect(result).toBe(true);
    expect(engine.cameraGroup.position.x).toBeCloseTo(-4, 3);
    expect(engine.cameraGroup.position.z).toBeCloseTo(-6, 3);
    expect(engine.cameraGroup.rotation.y).toBeCloseTo(Math.PI / 4, 3);
  });

  it('toggles teleport mode on and off', () => {
    expect(locomotion.teleportMode).toBe(false);
    locomotion.toggleTeleport();
    expect(locomotion.teleportMode).toBe(true);
    locomotion.toggleTeleport();
    expect(locomotion.teleportMode).toBe(false);
  });

  it('enabling teleport mode hides the preview when disabled', () => {
    locomotion.addAnchor('overview', [0, 0, -6], 0);
    locomotion.toggleTeleport();
    locomotion._startTeleportPreview();
    expect(locomotion._teleportArcMesh.visible).toBe(true);

    locomotion.setTeleportEnabled(false);
    expect(locomotion.teleportMode).toBe(false);
    expect(locomotion._teleportArcMesh.visible).toBe(false);
  });

  it('computes a parabolic arc with a valid landing target', () => {
    // The arc math uses a fixed upward launch and intersects the floor. With
    // an origin height of 1.6 m and a target only 4 m away, the parabola does
    // not reach the floor within the sampled time window, so the arc ends in
    // mid-air. Use a target 8 m away so the trajectory clearly intersects y=0.
    const origin = new THREE.Vector3(0, 1.6, 0);
    const target = new THREE.Vector3(0, 0, -8);
    locomotion._computeParabolicArc(origin, target);

    expect(locomotion.teleportValid).toBe(true);
    expect(locomotion.teleportTarget.z).toBeLessThan(-6);
    expect(locomotion.teleportTarget.y).toBeCloseTo(0, 2);
    expect(locomotion._teleportArcMesh.visible).toBe(false); // preview not started
  });

  it('marks a beyond-max target invalid but still lands the marker', () => {
    const origin = new THREE.Vector3(0, 1.6, 0);
    const far = -locomotion.teleportMaxDistance - 1;
    const target = new THREE.Vector3(0, 0, far);
    locomotion._computeParabolicArc(origin, target);

    expect(locomotion.teleportValid).toBe(false);
    expect(locomotion.teleportTarget.z).toBeCloseTo(-locomotion.teleportMaxDistance, 2);
  });

  it('rebuilds diegetic anchor discs when anchors change', () => {
    locomotion.addAnchor('overview', [0, 0, -6], 0);
    locomotion.addAnchor('detail', [0, 0, -3], 0);
    expect(locomotion._anchorMeshes.length).toBe(2);

    locomotion.removeAnchor('overview');
    expect(locomotion._anchorMeshes.length).toBe(1);
    expect(locomotion._anchorMeshes[0].userData.anchorName).toBe('detail');
  });

  it('warpTo offsets the camera group by eye height', () => {
    engine.camera.position.y = 1.6;
    locomotion._warpTo(new THREE.Vector3(2, 0, -5), Math.PI / 6);

    expect(engine.cameraGroup.position.x).toBeCloseTo(2, 3);
    expect(engine.cameraGroup.position.y).toBeCloseTo(1.6, 3);
    expect(engine.cameraGroup.position.z).toBeCloseTo(-5, 3);
    expect(engine.cameraGroup.rotation.y).toBeCloseTo(Math.PI / 6, 3);
  });

  it('does not throw when controller input sources are missing', () => {
    engine.renderer.xr.getSession.mockReturnValue(null);
    expect(() => locomotion.update(0.016, 0)).not.toThrow();
  });

  it('toggles flight mode on and off', () => {
    expect(locomotion.flightMode).toBe(false);
    locomotion.toggleFlight();
    expect(locomotion.flightMode).toBe(true);
    locomotion.toggleFlight();
    expect(locomotion.flightMode).toBe(false);
  });

  it('applies vertical movement in flight mode', () => {
    engine.camera.position.y = 1.6;
    locomotion.setFlightEnabled(true);
    const startY = engine.cameraGroup.position.y;

    locomotion._applyMovement(0, 0, 0.1, 1);
    expect(engine.cameraGroup.position.y).toBeGreaterThan(startY);
  });

  it('applies horizontal movement in flight mode', () => {
    locomotion.setFlightEnabled(true);
    engine.camera.position.y = 1.6;
    engine.camera.rotation.y = 0;

    const startZ = engine.cameraGroup.position.z;
    locomotion._applyMovement(0, 1, 0.1, 0);
    expect(Math.abs(engine.cameraGroup.position.z - startZ)).toBeGreaterThan(0.001);
  });

  it('disables teleport mode when flight mode is enabled', () => {
    locomotion.setTeleportEnabled(true);
    expect(locomotion.teleportMode).toBe(true);

    locomotion.setFlightEnabled(true);
    expect(locomotion.teleportMode).toBe(false);
    expect(locomotion.flightMode).toBe(true);
  });

  it('disables flight mode when teleport mode is enabled', () => {
    locomotion.setFlightEnabled(true);
    expect(locomotion.flightMode).toBe(true);

    locomotion.setTeleportEnabled(true);
    expect(locomotion.flightMode).toBe(false);
    expect(locomotion.teleportMode).toBe(true);
  });

  it('drops the camera group to the floor', () => {
    engine.camera.position.y = 1.6;
    engine.cameraGroup.position.y = 2.5;
    locomotion.dropToFloor();
    expect(engine.cameraGroup.position.y).toBeCloseTo(0, 3);
  });

  it('ascends and descends with gesture nudges', () => {
    engine.cameraGroup.position.y = 1.0;
    locomotion.ascend();
    expect(engine.cameraGroup.position.y).toBe(1.35);

    locomotion.descend();
    expect(engine.cameraGroup.position.y).toBe(1.0);
  });

  it('clamps descent to the floor', () => {
    engine.cameraGroup.position.y = 0.1;
    locomotion.descend();
    expect(engine.cameraGroup.position.y).toBeCloseTo(0, 3);
  });
});

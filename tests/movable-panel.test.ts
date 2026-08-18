// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { MovablePanel } from '../src/vr/ui/MovablePanel.ts';
import type { PointerLike } from '../src/vr/coordinators/types.ts';

/**
 * Create a raycaster that hits the panel mesh at the given UV coordinates.
 */
function makeRaycasterForUV(panel: MovablePanel, u: number, v: number): THREE.Raycaster {
  const geom = panel.mesh.geometry;
  const posAttr = geom.attributes.position;
  const topLeft = new THREE.Vector3().fromBufferAttribute(posAttr, 0);
  const topRight = new THREE.Vector3().fromBufferAttribute(posAttr, 1);
  const bottomLeft = new THREE.Vector3().fromBufferAttribute(posAttr, 2);
  const bottomRight = new THREE.Vector3().fromBufferAttribute(posAttr, 3);

  const localPoint = new THREE.Vector3()
    .addScaledVector(bottomLeft, (1 - u) * (1 - v))
    .addScaledVector(bottomRight, u * (1 - v))
    .addScaledVector(topLeft, (1 - u) * v)
    .addScaledVector(topRight, u * v);

  panel.mesh.updateMatrixWorld(true);
  const worldPoint = localPoint.applyMatrix4(panel.mesh.matrixWorld);

  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(
    panel.mesh.getWorldQuaternion(new THREE.Quaternion())
  );
  const origin = worldPoint.clone().add(normal.multiplyScalar(0.1));
  const direction = worldPoint.clone().sub(origin).normalize();
  return new THREE.Raycaster(origin, direction);
}

/**
 * Simple mock pointer whose ray can be set per test.
 */
type MockPointer = PointerLike & { _origin: THREE.Vector3; _direction: THREE.Vector3 };

function makeMockPointer({
  origin = new THREE.Vector3(0, 0, 0),
  direction = new THREE.Vector3(0, 0, -1),
}: { origin?: THREE.Vector3; direction?: THREE.Vector3 } = {}): MockPointer {
  return {
    ray: { visible: true },
    _origin: origin.clone(),
    _direction: direction.clone(),
    getRay(target: THREE.Ray) {
      target.origin.copy(this._origin);
      target.direction.copy(this._direction);
      return target;
    },
    setRayLength() {},
  } as MockPointer;
}

describe('MovablePanel', () => {
  let panel: MovablePanel;

  beforeEach(() => {
    const cameraGroup = new THREE.Group();
    panel = new MovablePanel(cameraGroup, {
      title: 'TEST PANEL',
      width: 800,
      height: 480,
      position: [0, 0, -1],
      worldSize: [1, 0.6],
      titleBarHeight: 44,
    });
  });

  it('is visible after construction', () => {
    expect(panel.mesh.visible).toBe(true);
    expect(panel.isMinimized).toBe(false);
  });

  it('hides when minimize button is clicked', () => {
    // Minimize button is at top-right of canvas (y near 0 in canvas coords).
    const raycaster = makeRaycasterForUV(panel, 0.97, 0.96);
    const pointer = makeMockPointer();
    const mode = panel.handlePointerDown(raycaster, pointer);

    expect(mode).toBe('minimize');
    expect(panel.mesh.visible).toBe(false);
    expect(panel.isMinimized).toBe(true);
  });

  it('starts drag when title bar is clicked', () => {
    const raycaster = makeRaycasterForUV(panel, 0.1, 0.95);
    const pointer = makeMockPointer();
    const mode = panel.handlePointerDown(raycaster, pointer);

    expect(mode).toBe('drag');
    expect(panel.drag.active).toBe(true);
    expect(panel.drag.pointer).toBe(pointer);
  });

  it('moves the panel while dragging', () => {
    const startPos = panel.mesh.position.clone();

    const pointer = makeMockPointer();
    // Start drag on title bar.
    panel.handlePointerDown(makeRaycasterForUV(panel, 0.1, 0.95), pointer);
    expect(panel.drag.active).toBe(true);

    // Move the *same* pointer slightly.
    pointer._origin.set(0.1, 0.05, 0);
    panel.handlePointerMove(makeRaycasterForUV(panel, 0.15, 0.95), pointer);

    expect(panel.mesh.position.distanceTo(startPos)).toBeGreaterThan(0.001);
  });

  it('applies a tilt so the panel does not feel flat', () => {
    expect(panel.mesh.rotation.x).not.toBe(0);
  });

  it('keeps distance within comfortable bounds when shown', () => {
    panel.mesh.position.set(0, 0, -0.2);
    panel.show();
    const dist = panel.mesh.position.length();
    expect(dist).toBeGreaterThanOrEqual(panel.minDistance);
    expect(dist).toBeLessThanOrEqual(panel.maxDistance);
  });

  it('drags at a fixed depth using a plane facing the viewer', () => {
    const pointer = makeMockPointer({
      origin: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 0, -1),
    });
    panel.handlePointerDown(makeRaycasterForUV(panel, 0.1, 0.95), pointer);
    const startDistance = panel.mesh.position.length();

    pointer._origin.set(0.05, 0.02, 0);
    pointer._direction.set(0, 0, -1);
    panel.handlePointerMove(makeRaycasterForUV(panel, 0.12, 0.95), pointer);

    // With a straight-ahead ray the panel stays at roughly the same distance.
    const endDistance = panel.mesh.position.length();
    expect(Math.abs(endDistance - startDistance)).toBeLessThan(0.15);
  });

  it('ends drag on pointer up', () => {
    const pointer = makeMockPointer();
    panel.handlePointerDown(makeRaycasterForUV(panel, 0.1, 0.95), pointer);
    expect(panel.drag.active).toBe(true);

    panel.handlePointerUp(makeRaycasterForUV(panel, 0.1, 0.95), pointer);
    expect(panel.drag.active).toBe(false);
    expect(panel.drag.pointer).toBeNull();
  });

  it('toggle restores a hidden panel', () => {
    panel.hide();
    expect(panel.mesh.visible).toBe(false);

    panel.toggle();
    expect(panel.mesh.visible).toBe(true);
    expect(panel.isMinimized).toBe(false);
  });

  it('returns null for clicks outside the mesh', () => {
    // Ray aimed far to the side.
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(10, 10, 0),
      new THREE.Vector3(0, 0, -1)
    );
    const mode = panel.handlePointerDown(raycaster, makeMockPointer());
    expect(mode).toBeNull();
  });

  it('resets to default position when shown after being hidden', () => {
    panel.mesh.position.set(5, 5, 5);
    panel.hide();
    panel.show();

    expect(panel.mesh.position.x).toBeCloseTo(panel.defaultPosition.x, 3);
    expect(panel.mesh.position.y).toBeCloseTo(panel.defaultPosition.y, 3);
    expect(panel.mesh.position.z).toBeCloseTo(panel.defaultPosition.z, 3);
  });

  it('clamps the panel within max distance on show', () => {
    panel.defaultPosition.set(0, 0, -3);
    panel.hide();
    panel.show();
    expect(panel.mesh.position.length()).toBeLessThanOrEqual(panel.maxDistance);
  });
});

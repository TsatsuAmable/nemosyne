// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { MovablePanel } from '../src/vr/ui/MovablePanel.ts';
import type { PointerLike } from '../src/vr/coordinators/types.ts';

/** Create a raycaster that hits the panel mesh at the given UV coordinates. */
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
      target.direction.copy(this._direction).normalize();
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

  it('moves the panel 1:1 with the free-floating grab ray instead of lerping', () => {
    const pointer = makeMockPointer();
    panel.handlePointerDown(makeRaycasterForUV(panel, 0.1, 0.95), pointer);
    const start = panel.mesh.position.clone();

    pointer._origin.set(0.2, 0.1, 0);
    panel.handlePointerMove(makeRaycasterForUV(panel, 0.1, 0.95), pointer);

    // The title-bar hit is intentionally off-centre; direct manipulation must
    // preserve that grab offset while following the pointer translation 1:1.
    expect(panel.mesh.position.x - start.x).toBeCloseTo(0.2, 2);
    expect(panel.mesh.position.y - start.y).toBeCloseTo(0.1, 2);
  });

  it('allows depth movement when the controller/hand ray origin moves in depth', () => {
    const pointer = makeMockPointer();
    panel.handlePointerDown(makeRaycasterForUV(panel, 0.1, 0.95), pointer);
    const startZ = panel.mesh.position.z;

    pointer._origin.set(0, 0, -0.35);
    panel.handlePointerMove(makeRaycasterForUV(panel, 0.1, 0.95), pointer);

    expect(panel.mesh.position.z).toBeLessThan(startZ - 0.2);
  });

  it('uses the visible panel world normal for the anchored drag plane', () => {
    panel.mesh.rotation.set(-0.2, 0.65, 0, 'YXZ');
    panel.mesh.updateMatrixWorld(true);
    const pointer = makeMockPointer();
    panel.handlePointerDown(makeRaycasterForUV(panel, 0.1, 0.95), pointer);

    const expected = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(panel.mesh.getWorldQuaternion(new THREE.Quaternion()))
      .normalize();
    expect(panel.drag.planeNormal?.angleTo(expected)).toBeLessThan(1e-6);
  });

  it('applies a tilt so the panel does not feel flat', () => {
    expect(panel.mesh.rotation.x).not.toBe(0);
  });

  it('restoring visibility preserves the user-authored position', () => {
    panel.mesh.position.set(0.7, 0.4, -1.4);
    panel.hide();
    panel.show();

    expect(panel.mesh.position.toArray()).toEqual([0.7, 0.4, -1.4]);
  });

  it('resetToDefaultPosition is the explicit reset-to-home operation', () => {
    panel.mesh.position.set(0.7, 0.4, -1.4);
    panel.resetToDefaultPosition();

    expect(panel.mesh.position.x).toBeCloseTo(panel.defaultPosition.x, 3);
    expect(panel.mesh.position.y).toBeCloseTo(panel.defaultPosition.y, 3);
    expect(panel.mesh.position.z).toBeCloseTo(panel.defaultPosition.z, 3);
  });

  it('does not clamp during manipulation but clamps once on release', () => {
    const pointer = makeMockPointer();
    panel.handlePointerDown(makeRaycasterForUV(panel, 0.1, 0.95), pointer);

    pointer._origin.set(0, 0, -2.5);
    panel.handlePointerMove(makeRaycasterForUV(panel, 0.1, 0.95), pointer);
    expect(panel.mesh.position.length()).toBeGreaterThan(panel.maxDistance);

    panel.handlePointerUp(makeRaycasterForUV(panel, 0.1, 0.95), pointer);
    expect(panel.mesh.position.length()).toBeLessThanOrEqual(panel.maxDistance + 1e-6);
  });

  it('commits the exact final pointer target on release', () => {
    const pointer = makeMockPointer();
    panel.handlePointerDown(makeRaycasterForUV(panel, 0.1, 0.95), pointer);
    const start = panel.mesh.position.clone();

    pointer._origin.set(0.3, 0.15, 0);
    panel.handlePointerUp(makeRaycasterForUV(panel, 0.1, 0.95), pointer);

    expect(panel.mesh.position.x - start.x).toBeCloseTo(0.3, 2);
    expect(panel.mesh.position.y - start.y).toBeCloseTo(0.15, 2);
    expect(panel.drag.active).toBe(false);
  });

  it('toggle restores a hidden panel without recentering it', () => {
    panel.mesh.position.set(0.4, 0.2, -1.3);
    panel.hide();
    panel.toggle();

    expect(panel.mesh.visible).toBe(true);
    expect(panel.isMinimized).toBe(false);
    expect(panel.mesh.position.toArray()).toEqual([0.4, 0.2, -1.3]);
  });

  it('returns null for clicks outside the mesh', () => {
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(10, 10, 0),
      new THREE.Vector3(0, 0, -1)
    );
    const mode = panel.handlePointerDown(raycaster, makeMockPointer());
    expect(mode).toBeNull();
  });
});

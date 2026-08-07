import * as THREE from 'three';
import type { PointerLike } from './coordinators/types.ts';

/**
 * Wraps WebXR controller spaces and renders a laser pointer ray.
 * Uses an onSelect callback instead of a custom event because three.js r168
 * rejects custom events with a read-only target property.
 */
export class ControllerPointer {
  index: number;
  space: THREE.Group;
  private _tempQuat: THREE.Quaternion;
  ray: THREE.Line;
  handedness: string;
  onSelect: ((pointer: PointerLike) => void) | null = null;

  constructor(renderer: THREE.WebGLRenderer, index: number) {
    this.index = index;
    this.space = renderer.xr.getController(index);
    this._tempQuat = new THREE.Quaternion();

    const rayGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const rayMat = new THREE.LineBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    this.ray = new THREE.Line(rayGeo, rayMat);
    this.ray.scale.z = 4;
    // Hidden by default; InputRouter shows it only when no hand is tracked.
    this.ray.visible = false;
    this.space.add(this.ray);

    this.handedness = 'none';
    // The controller space emits WebXR 'connected' and 'selectstart' events that
    // are not declared in the three.js Object3DEventMap, so treat it as a plain
    // DOM-style EventTarget for typing purposes.
    const eventTarget = this.space as unknown as EventTarget;
    eventTarget.addEventListener('connected', (evt: Event) => {
      const data = (evt as unknown as { data?: { handedness?: string } }).data;
      this.handedness = data?.handedness ?? 'none';
    });

    eventTarget.addEventListener('selectstart', () => {
      if (this.onSelect) this.onSelect(this);
    });
  }

  getRay(targetRay: THREE.Ray): THREE.Ray {
    this.space.getWorldPosition(targetRay.origin);
    this.space.getWorldQuaternion(this._tempQuat);
    targetRay.direction.set(0, 0, -1).applyQuaternion(this._tempQuat);

    // Guard against transient invalid poses (NaN/Infinity) before the
    // controller has a real tracking lock. Quest Browser can emit these early.
    if (!Number.isFinite(targetRay.origin.x)) targetRay.origin.set(0, 0, 0);
    if (!Number.isFinite(targetRay.direction.x)) targetRay.direction.set(0, 0, -1);
    return targetRay;
  }

  setRayLength(length: number): void {
    // Keep a minimum visible length so the pointer is always obvious,
    // but extend it when something is hit far away.
    this.ray.scale.z = Math.max(0.3, length);
  }

  setRayVisible(visible: boolean): void {
    this.ray.visible = visible;
  }

  get group(): THREE.Group {
    return this.space;
  }
}

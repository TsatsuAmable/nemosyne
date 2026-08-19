/**
 * Zero-Allocation Spatial Math & Raycasting Pools.
 *
 * Pre-allocates scratch math objects (vectors, quaternions, matrices, rays)
 * to guarantee zero GC pressure in the 72 Hz / 90 Hz Quest 3S render loop.
 */

import * as THREE from 'three';

export class ZeroAllocMath {
  // Reusable scratch objects
  private static readonly _v1 = new THREE.Vector3();
  private static readonly _v2 = new THREE.Vector3();

  /**
   * Compute squared distance between two points without heap allocation.
   */
  static distanceSq(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number
  ): number {
    const dx = x1 - x2;
    const dy = y1 - y2;
    const dz = z1 - z2;
    return dx * dx + dy * dy + dz * dz;
  }

  /**
   * Fast spherical containment check without sqrt.
   */
  static isInsideSphere(
    px: number,
    py: number,
    pz: number,
    cx: number,
    cy: number,
    cz: number,
    radius: number
  ): boolean {
    return this.distanceSq(px, py, pz, cx, cy, cz) <= radius * radius;
  }

  /**
   * Fast cone / gaze alignment angle in degrees (0..180) using scratch vectors.
   */
  static gazeAlignmentAngleDeg(
    headPos: THREE.Vector3,
    headForward: THREE.Vector3,
    targetPos: THREE.Vector3
  ): number {
    this._v1.subVectors(targetPos, headPos).normalize();
    const dot = Math.max(-1, Math.min(1, headForward.dot(this._v1)));
    return THREE.MathUtils.radToDeg(Math.acos(dot));
  }

  /**
   * Project a point onto a plane defined by origin and normal into outTarget.
   */
  static projectPointOnPlane(
    point: THREE.Vector3,
    planeOrigin: THREE.Vector3,
    planeNormal: THREE.Vector3,
    outTarget: THREE.Vector3
  ): THREE.Vector3 {
    this._v1.subVectors(point, planeOrigin);
    const dist = this._v1.dot(planeNormal);
    this._v2.copy(planeNormal).multiplyScalar(dist);
    return outTarget.subVectors(point, this._v2);
  }

  /**
   * Fast lerp between positions into outTarget without new Vector3 creation.
   */
  static lerpVector(
    start: THREE.Vector3,
    end: THREE.Vector3,
    alpha: number,
    outTarget: THREE.Vector3
  ): THREE.Vector3 {
    return outTarget.lerpVectors(start, end, alpha);
  }
}

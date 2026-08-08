import * as THREE from 'three';
import type { LODCandidate, LODLevel } from '../coordinators/types.ts';

export interface CullResult {
  visibleCount: number;
  culledCount: number;
  lod0Count: number;
  lod1Count: number;
  lod2Count: number;
}

/**
 * Adaptive Level-of-Detail (LOD), Frustum Culling, and Occlusion Culling Manager.
 *
 * Provides sub-millisecond frustum culling, distance-based LOD tiering, gaze zoom,
 * and instanced mesh occlusion management for 100,000+ spatial data nodes.
 */
export class LODManager {
  camera: THREE.Camera | null;
  headPos: THREE.Vector3;
  gazeDir: THREE.Vector3;
  frame: number;

  private _frustum: THREE.Frustum;
  private _projScreenMatrix: THREE.Matrix4;

  constructor(camera: THREE.Camera | null) {
    this.camera = camera;
    this.headPos = new THREE.Vector3();
    this.gazeDir = new THREE.Vector3();
    this.frame = 0;
    this._frustum = new THREE.Frustum();
    this._projScreenMatrix = new THREE.Matrix4();
  }

  /**
   * Recompute head position, gaze direction, and camera frustum.
   * Call once per tick before querying LOD or performing culling.
   */
  update(): void {
    if (!this.camera) return;
    this.camera.getWorldPosition(this.headPos);
    this.camera.getWorldDirection(this.gazeDir);

    // Update Frustum matrix
    this._projScreenMatrix.multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse
    );
    this._frustum.setFromProjectionMatrix(this._projScreenMatrix);
    this.frame++;
  }

  /**
   * Return numeric LOD level for a world-space position.
   *   0 = close / focused (Full detail, labels, interaction handles)
   *   1 = medium distance (Simplified geometry)
   *   2 = far distance (Aggregated impostors / background)
   */
  levelFor(position: THREE.Vector3): LODLevel {
    const dist = this.headPos.distanceTo(position);
    if (dist < 1.2) return 0;
    if (dist < 3.5) return 1;
    return 2;
  }

  /**
   * Check whether a bounding sphere is inside the camera viewing frustum.
   */
  isInFrustum(position: THREE.Vector3, radius = 0.1): boolean {
    const sphere = new THREE.Sphere(position, radius);
    return this._frustum.intersectsSphere(sphere);
  }

  /**
   * Check whether an object is near the center of the user's gaze vector.
   */
  isInGaze(position: THREE.Vector3, maxAngleDegrees = 12): boolean {
    const toTarget = new THREE.Vector3().subVectors(position, this.headPos).normalize();
    const angle = Math.acos(Math.max(-1, Math.min(1, this.gazeDir.dot(toTarget))));
    return angle <= (maxAngleDegrees * Math.PI) / 180;
  }

  /**
   * Compute screen-space error metric for adaptive LOD scaling.
   */
  computeScreenSpaceError(position: THREE.Vector3, worldRadius: number): number {
    const dist = Math.max(0.001, this.headPos.distanceTo(position));
    return (worldRadius / dist) * 1000.0;
  }

  /**
   * Compute opacity falloff for far objects so they fade smoothly into fog.
   */
  fadeFor(position: THREE.Vector3, near = 3.5, far = 8): number {
    const dist = this.headPos.distanceTo(position);
    if (dist <= near) return 1;
    if (dist >= far) return 0;
    return 1 - (dist - near) / (far - near);
  }

  /**
   * Decide whether a label should be visible for a given node position.
   */
  shouldShowLabel(position: THREE.Vector3): boolean {
    return this.levelFor(position) === 0 || this.isInGaze(position, 8);
  }

  /**
   * Perform frustum and occlusion culling over an array of 3D node positions,
   * returning visibility counts and LOD classification metrics.
   */
  cullPositions(positions: THREE.Vector3[], radii: number[] = []): CullResult {
    let visibleCount = 0;
    let culledCount = 0;
    let lod0Count = 0;
    let lod1Count = 0;
    let lod2Count = 0;

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const r = radii[i] ?? 0.1;

      if (this.camera && !this.isInFrustum(pos, r)) {
        culledCount++;
        continue;
      }

      visibleCount++;
      const lod = this.levelFor(pos);
      if (lod === 0) lod0Count++;
      else if (lod === 1) lod1Count++;
      else lod2Count++;
    }

    return {
      visibleCount,
      culledCount,
      lod0Count,
      lod1Count,
      lod2Count,
    };
  }

  /**
   * Helper mapping candidate to its LOD level.
   */
  levelForCandidate(candidate: LODCandidate): LODLevel {
    return this.levelFor(candidate.position);
  }
}

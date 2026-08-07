import * as THREE from 'three';
import type { LODCandidate, LODLevel } from '../coordinators/types.ts';

/**
 * Distance/semantic level-of-detail manager for VR data artefacts.
 *
 * As the user moves through the palace, distant data points should become
 * simpler or be replaced by aggregate proxies, while nearby points reveal
 * labels and detail. This manager computes LOD levels based on camera distance
 * and gaze, and provides helper predicates for artefact renderers.
 */
export class LODManager {
  camera: THREE.Camera | null;
  headPos: THREE.Vector3;
  gazeDir: THREE.Vector3;
  frame: number;

  constructor(camera: THREE.Camera | null) {
    this.camera = camera;
    this.headPos = new THREE.Vector3();
    this.gazeDir = new THREE.Vector3();
    this.frame = 0;
  }

  /**
   * Recompute head position and gaze direction from the camera.
   * Call once per tick before querying LOD.
   */
  update(): void {
    if (!this.camera) return;
    this.camera.getWorldPosition(this.headPos);
    this.camera.getWorldDirection(this.gazeDir);
    this.frame++;
  }

  /**
   * Return a numeric LOD level for a world-space position.
   *   0 = very close / focused: full detail, labels, interaction handles.
   *   1 = medium distance: simplified geometry, no labels.
   *   2 = far distance: aggregate / impostor / hidden.
   */
  levelFor(position: THREE.Vector3): LODLevel {
    const dist = this.headPos.distanceTo(position);
    if (dist < 1.2) return 0;
    if (dist < 3.5) return 1;
    return 2;
  }

  /**
   * Check whether an object is near the center of the user’s gaze.
   * Useful for semantic zoom: show labels only when looked at.
   */
  isInGaze(position: THREE.Vector3, maxAngleDegrees = 12): boolean {
    const toTarget = new THREE.Vector3().subVectors(position, this.headPos).normalize();
    const angle = Math.acos(Math.max(-1, Math.min(1, this.gazeDir.dot(toTarget))));
    return angle <= (maxAngleDegrees * Math.PI) / 180;
  }

  /**
   * Compute an opacity falloff for far objects so they fade into the fog.
   */
  fadeFor(position: THREE.Vector3, near = 3.5, far = 8): number {
    const dist = this.headPos.distanceTo(position);
    if (dist <= near) return 1;
    if (dist >= far) return 0;
    return 1 - (dist - near) / (far - near);
  }

  /**
   * Decide whether a label should be visible for a given node.
   * Labels are expensive; only show them up close or when gazed at.
   */
  shouldShowLabel(position: THREE.Vector3): boolean {
    return this.levelFor(position) === 0 || this.isInGaze(position, 8);
  }

  /**
   * Helper that maps a candidate to its LOD level. Mostly useful for tests
   * and callers that prefer a single object argument.
   */
  levelForCandidate(candidate: LODCandidate): LODLevel {
    return this.levelFor(candidate.position);
  }
}

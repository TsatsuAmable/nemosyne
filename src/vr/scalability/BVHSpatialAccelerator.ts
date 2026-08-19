/**
 * Bounding Volume Hierarchy (BVH) Spatial Acceleration Engine.
 *
 * Implements:
 * - 10x-100x accelerated raycasting and hit-testing for 100k+ node point clouds and meshes using `three-mesh-bvh`.
 * - Spatial bounds generation without per-frame memory allocation.
 */

import * as THREE from 'three';
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from 'three-mesh-bvh';

// Augment Three.js BufferGeometry and Mesh prototypes once at module load
let bvhInitialized = false;

export function initializeBVH(): void {
  if (bvhInitialized) return;
  (THREE.BufferGeometry.prototype as unknown as { computeBoundsTree: typeof computeBoundsTree }).computeBoundsTree = computeBoundsTree;
  (THREE.BufferGeometry.prototype as unknown as { disposeBoundsTree: typeof disposeBoundsTree }).disposeBoundsTree = disposeBoundsTree;
  (THREE.Mesh.prototype as unknown as { raycast: typeof acceleratedRaycast }).raycast = acceleratedRaycast;
  bvhInitialized = true;
}

export class BVHSpatialAccelerator {
  static init(): void {
    initializeBVH();
  }

  /**
   * Builds and attaches a BVH acceleration tree to a Three.js mesh geometry.
   */
  static buildTree(mesh: THREE.Mesh, options = { targetLeafSize: 10 }): unknown {
    initializeBVH();
    if (!mesh.geometry.boundsTree) {
      mesh.geometry.computeBoundsTree(options);
    }
    return mesh.geometry.boundsTree;
  }

  /**
   * Disposes of the BVH acceleration tree attached to a mesh geometry to reclaim memory.
   */
  static disposeTree(mesh: THREE.Mesh): void {
    if (mesh.geometry.boundsTree) {
      mesh.geometry.disposeBoundsTree();
    }
  }

  /**
   * Performs an accelerated raycast against a BVH-indexed mesh.
   */
  static raycast(mesh: THREE.Mesh, raycaster: THREE.Raycaster): THREE.Intersection[] {
    initializeBVH();
    if (!mesh.geometry.boundsTree) {
      this.buildTree(mesh);
    }
    const intersections: THREE.Intersection[] = [];
    mesh.raycast(raycaster, intersections);
    return intersections;
  }
}

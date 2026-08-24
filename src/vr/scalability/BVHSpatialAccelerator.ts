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
  ObjectBVH,
} from 'three-mesh-bvh';

let bvhInitialized = false;
export const MIN_GEOMETRY_BVH_PRIMITIVES = 128;
export const MIN_OBJECT_BVH_PRIMITIVES = 64;
export const MAX_EXPANDED_OBJECT_BVH_INSTANCES = 16_384;

export function initializeBVH(): void {
  if (bvhInitialized) return;
  (
    THREE.BufferGeometry.prototype as unknown as {
      computeBoundsTree: typeof computeBoundsTree;
    }
  ).computeBoundsTree = computeBoundsTree;
  (
    THREE.BufferGeometry.prototype as unknown as {
      disposeBoundsTree: typeof disposeBoundsTree;
    }
  ).disposeBoundsTree = disposeBoundsTree;
  (
    THREE.Mesh.prototype as unknown as {
      raycast: typeof acceleratedRaycast;
    }
  ).raycast = acceleratedRaycast;
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

  static geometryPrimitiveCount(geometry: THREE.BufferGeometry): number {
    const elementCount = geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0;
    return Math.floor(elementCount / 3);
  }

  static shouldBuildGeometryTree(mesh: THREE.Mesh): boolean {
    return this.geometryPrimitiveCount(mesh.geometry) >= MIN_GEOMETRY_BVH_PRIMITIVES;
  }

  static objectPrimitiveCount(objects: THREE.Object3D[]): number {
    const leaves = new Set<THREE.Object3D>();
    let count = 0;
    for (const root of objects) {
      root.traverse((object) => {
        const candidate = object as THREE.Object3D & {
          isMesh?: boolean;
          isLine?: boolean;
          isPoints?: boolean;
          isInstancedMesh?: boolean;
          isBatchedMesh?: boolean;
          count?: number;
          instanceCount?: number;
        };
        if (!candidate.isMesh && !candidate.isLine && !candidate.isPoints) return;
        if (leaves.has(object)) return;
        leaves.add(object);
        if (candidate.isInstancedMesh) {
          count += candidate.count ?? 0;
        } else if (candidate.isBatchedMesh) {
          count += candidate.instanceCount ?? 0;
        } else {
          count += 1;
        }
      });
    }
    return count;
  }

  static buildObjectTree(objects: THREE.Object3D[], includeInstances = true): ObjectBVH {
    initializeBVH();
    return new ObjectBVH(objects, { targetLeafSize: 1, includeInstances } as ConstructorParameters<
      typeof ObjectBVH
    >[1]);
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

import * as THREE from 'three';
import {
  sharedSphereGeometry,
  sharedBoxGeometry,
  sharedCylinderGeometry,
} from './ObjectPool.ts';

/**
 * Shared static geometries that must never be disposed by `disposeObject`,
 * because they are reused across the lifetime of the application (see
 * `src/utils/ObjectPool.ts`). Disposing them would corrupt every pooled mesh.
 */
const SHARED_GEOMETRIES = new WeakSet<THREE.BufferGeometry>([
  sharedSphereGeometry,
  sharedBoxGeometry,
  sharedCylinderGeometry,
]);

/** Recursively dispose of a Three.js object and its children. */
export function disposeObject(obj: THREE.Object3D | { dispose(): void } | null | undefined): void {
  if (!obj) return;

  const object3D = obj as THREE.Object3D;
  const meshLike = object3D as THREE.Mesh;

  if (meshLike.geometry && !SHARED_GEOMETRIES.has(meshLike.geometry)) {
    meshLike.geometry.dispose();
  }

  if (meshLike.material) {
    if (Array.isArray(meshLike.material)) {
      meshLike.material.forEach((m: THREE.Material) => disposeMaterial(m));
    } else {
      disposeMaterial(meshLike.material as THREE.Material);
    }
  }

  if ('dispose' in obj && typeof (obj as { dispose(): void }).dispose === 'function') {
    (obj as { dispose(): void }).dispose();
  }

  // Recurse.
  const children = object3D.children ? object3D.children.slice() : [];
  for (const child of children) {
    disposeObject(child);
  }

  if (object3D.parent) {
    object3D.parent.remove(object3D);
  }
}

function disposeMaterial(material: THREE.Material | null | undefined): void {
  if (!material) return;
  const record = material as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (value && (value as { isTexture?: boolean }).isTexture) {
      (value as THREE.Texture).dispose();
    }
  }
  material.dispose();
}

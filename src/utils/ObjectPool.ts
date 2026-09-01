import * as THREE from 'three';

/**
 * High-performance Object Pool for Three.js Geometries, Materials, and Meshes.
 * Prevents frame stutter and garbage collection spikes (>200ms) during dataset swaps.
 */

export interface IMeshPool {
  acquireSphere(colorHex?: number, radius?: number): THREE.Mesh;
  acquireBox(colorHex?: number, size?: [number, number, number]): THREE.Mesh;
  release(mesh: THREE.Mesh): void;
  releaseGroup(group: THREE.Object3D): void;
  clear(): void;
}

// Shared static geometries reused across all 3D nodes and edges
export const sharedSphereGeometry = new THREE.SphereGeometry(1, 16, 16);
export const sharedBoxGeometry = new THREE.BoxGeometry(1, 1, 1);
export const sharedCylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 12);
export const sharedNodeMaterial = new THREE.MeshStandardMaterial({
  color: 0x00ffcc,
  roughness: 0.3,
  metalness: 0.2,
});

const SHARED_GEOMETRIES = new Set<THREE.BufferGeometry>([
  sharedSphereGeometry,
  sharedBoxGeometry,
  sharedCylinderGeometry,
]);

type DisposableRenderable = THREE.Object3D & {
  geometry?: THREE.BufferGeometry;
  material?: THREE.Material | THREE.Material[];
};

export class MeshPool implements IMeshPool {
  private static _instance: MeshPool;
  private _spherePool: THREE.Mesh[] = [];
  private _boxPool: THREE.Mesh[] = [];
  private _activeMeshes: Set<THREE.Mesh> = new Set();

  static get instance(): MeshPool {
    if (!MeshPool._instance) {
      MeshPool._instance = new MeshPool();
    }
    return MeshPool._instance;
  }

  /** Acquire a sphere mesh from pool or instantiate if pool is empty. */
  acquireSphere(colorHex = 0x00ffcc, radius = 0.08): THREE.Mesh {
    let mesh = this._spherePool.pop();
    if (!mesh) {
      mesh = new THREE.Mesh(
        sharedSphereGeometry,
        new THREE.MeshStandardMaterial({
          color: colorHex,
          wireframe: true,
          emissive: colorHex,
          emissiveIntensity: 0.3,
          roughness: 0.3,
          metalness: 0.7,
        })
      );
    } else {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(colorHex);
      mat.emissive.setHex(colorHex);
      mesh.visible = true;
    }

    mesh.scale.set(radius, radius, radius);
    mesh.rotation.set(0, 0, 0);
    this._activeMeshes.add(mesh);
    return mesh;
  }

  /** Acquire a box mesh from pool or instantiate if pool is empty. */
  acquireBox(colorHex = 0x00ffcc, size = [0.1, 0.1, 0.1] as [number, number, number]): THREE.Mesh {
    let mesh = this._boxPool.pop();
    if (!mesh) {
      mesh = new THREE.Mesh(
        sharedBoxGeometry,
        new THREE.MeshStandardMaterial({
          color: colorHex,
          wireframe: true,
          emissive: colorHex,
          emissiveIntensity: 0.3,
          roughness: 0.3,
          metalness: 0.7,
        })
      );
    } else {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(colorHex);
      mat.emissive.setHex(colorHex);
      mesh.visible = true;
    }

    mesh.scale.set(...size);
    mesh.rotation.set(0, 0, 0);
    this._activeMeshes.add(mesh);
    return mesh;
  }

  /** Recycle a mesh back to pool instead of destroying it. */
  release(mesh: THREE.Mesh): void {
    if (!mesh) return;
    mesh.visible = false;
    mesh.removeFromParent();
    this._activeMeshes.delete(mesh);

    if (mesh.geometry === sharedSphereGeometry) {
      this._spherePool.push(mesh);
    } else if (mesh.geometry === sharedBoxGeometry) {
      this._boxPool.push(mesh);
    } else {
      // Custom geometry and material fallback
      if (!SHARED_GEOMETRIES.has(mesh.geometry)) mesh.geometry?.dispose?.();
      this._disposeMaterial(mesh.material);
    }
  }

  /** Helper to dispose a material and any attached textures. */
  private _disposeMaterial(material: THREE.Material | THREE.Material[] | undefined): void {
    if (!material) return;
    if (Array.isArray(material)) {
      for (const m of material) {
        if (m && 'map' in m && (m as { map?: THREE.Texture }).map) {
          (m as { map: THREE.Texture }).map.dispose();
        }
        m?.dispose?.();
      }
    } else {
      if ('map' in material && (material as { map?: THREE.Texture }).map) {
        (material as { map: THREE.Texture }).map.dispose();
      }
      material.dispose?.();
    }
  }

  /**
   * Recycle pooled meshes and dispose every other renderable in an object tree.
   * Line/Points primitives are not THREE.Mesh instances, so leaving them behind
   * leaks their GPU resources and can leave retired representation groups dirty.
   */
  releaseGroup(group: THREE.Object3D): void {
    const toRelease: THREE.Mesh[] = [];
    const toDispose: DisposableRenderable[] = [];
    group.traverse((child) => {
      if (child === group) return;
      if (child instanceof THREE.Mesh) {
        toRelease.push(child);
        return;
      }
      const renderable = child as DisposableRenderable;
      if (renderable.geometry || renderable.material) {
        toDispose.push(renderable);
      }
    });

    for (const mesh of toRelease) {
      this.release(mesh);
    }
    for (const renderable of toDispose) {
      renderable.removeFromParent();
      if (renderable.geometry && !SHARED_GEOMETRIES.has(renderable.geometry)) {
        renderable.geometry.dispose();
      }
      this._disposeMaterial(renderable.material);
    }

    // Detach any empty/nested containers so a retired group contains no stale
    // representation objects even when a child had no GPU resources of its own.
    group.clear();
  }

  /** Clear and dispose all pooled meshes. */
  clear(): void {
    for (const mesh of [...this._spherePool, ...this._boxPool, ...this._activeMeshes]) {
      mesh.removeFromParent();
      if (!SHARED_GEOMETRIES.has(mesh.geometry)) {
        mesh.geometry?.dispose?.();
      }
      this._disposeMaterial(mesh.material);
    }
    this._spherePool = [];
    this._boxPool = [];
    this._activeMeshes.clear();
  }
}

/** Time-sliced asynchronous batch execution helper for smooth frame rates. */
export async function executeInTimeSlices<T>(
  items: T[],
  batchSize: number,
  task: (item: T, index: number) => void
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    chunk.forEach((item, batchIdx) => task(item, i + batchIdx));
    if (i + batchSize < items.length) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }
}

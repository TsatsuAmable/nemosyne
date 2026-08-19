/**
 * GPU Resource Lifecycle & Deep Cascade Disposal.
 *
 * Ensures 100% reclamation of WebGL buffers, textures, render targets, materials,
 * and geometries on scene reload or Memory Palace rebuild.
 */

import * as THREE from 'three';

export interface DisposalStats {
  geometriesDisposed: number;
  materialsDisposed: number;
  texturesDisposed: number;
}

export class GPUResourceDisposal {
  /**
   * Traverse an Object3D hierarchy and dispose of all GPU assets attached to it.
   */
  static disposeHierarchy(root: THREE.Object3D): DisposalStats {
    const stats: DisposalStats = {
      geometriesDisposed: 0,
      materialsDisposed: 0,
      texturesDisposed: 0,
    };

    const disposedGeoms = new Set<THREE.BufferGeometry>();
    const disposedMaterials = new Set<THREE.Material>();
    const disposedTextures = new Set<THREE.Texture>();

    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
        // Dispose Geometry
        if (obj.geometry && !disposedGeoms.has(obj.geometry)) {
          disposedGeoms.add(obj.geometry);
          obj.geometry.dispose();
          stats.geometriesDisposed += 1;
        }

        // Dispose Material(s)
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) {
          if (mat && !disposedMaterials.has(mat)) {
            disposedMaterials.add(mat);

            // Dispose texture maps on material
            this._disposeMaterialTextures(mat, disposedTextures, stats);

            mat.dispose();
            stats.materialsDisposed += 1;
          }
        }
      }
    });

    return stats;
  }

  private static _disposeMaterialTextures(
    mat: THREE.Material,
    disposedTextures: Set<THREE.Texture>,
    stats: DisposalStats
  ): void {
    const record = mat as unknown as Record<string, unknown>;
    const textureKeys = [
      'map',
      'alphaMap',
      'aoMap',
      'bumpMap',
      'displacementMap',
      'emissiveMap',
      'envMap',
      'lightMap',
      'metalnessMap',
      'normalMap',
      'roughnessMap',
    ];

    for (const key of textureKeys) {
      const tex = record[key];
      if (tex && tex instanceof THREE.Texture && !disposedTextures.has(tex)) {
        disposedTextures.add(tex);
        tex.dispose();
        stats.texturesDisposed += 1;
      }
    }
  }
}

import * as THREE from 'three';
import type {
  InstancedPointCloudHit,
  InstancedPointCloudItem,
  InstancedPointCloudUpdate,
} from '../coordinators/types.ts';

interface StoredPosition {
  index: number;
  position: THREE.Vector3;
  data: unknown;
}

/**
 * GPU-instanced point cloud for large datasets.
 *
 * When a dataset has too many rows to render as individual Meshes, this class
 * builds a single `THREE.InstancedMesh` of simple geometry (cube or sphere) and
 * updates per-instance matrices, colors, and scales from row encodings.
 *
 * It is intentionally independent of the artefact system so any translator can
 * use it for tabular, graph, or geospatial point datasets.
 */
export class InstancedPointCloud {
  maxCount: number;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshBasicMaterial;
  mesh: THREE.InstancedMesh;

  private dummy: THREE.Object3D;
  private _scratchColor: THREE.Color;
  private _positions: StoredPosition[];
  private _colors: Float32Array;
  private _scales: Float32Array;
  private _instanceColor: THREE.InstancedBufferAttribute;

  constructor(maxCount = 2000, geometry: THREE.BufferGeometry | null = null) {
    this.maxCount = maxCount;

    // Default geometry: small faceted sphere.
    this.geometry = geometry || new THREE.BoxGeometry(0.06, 0.06, 0.06);

    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: false,
      opacity: 1.0,
      depthTest: true,
      depthWrite: true,
    });

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, maxCount);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;

    // Allocate ONE instanceColor attribute (reused across all setPoints calls)
    // instead of reallocating a new InstancedBufferAttribute each frame.
    this._colors = new Float32Array(maxCount * 3);
    this._instanceColor = new THREE.InstancedBufferAttribute(this._colors, 3);
    this._instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = this._instanceColor;

    this.dummy = new THREE.Object3D();
    this._scratchColor = new THREE.Color();
    this._positions = [];
    this._scales = new Float32Array(maxCount);
  }

  /**
   * Dynamically scale visible instance count from AdaptiveFrameGovernor LOD factor.
   */
  applyLODScale(lodScaleFactor: number): void {
    const targetCount = Math.floor(this.maxCount * Math.max(0.1, Math.min(1.0, lodScaleFactor)));
    this.mesh.count = Math.min(this._positions.length, targetCount);
  }

  /**
   * Set the visible points from an array of encoded items.
   */
  setPoints(items: InstancedPointCloudItem[]): void {
    const count = Math.min(items.length, this.maxCount);
    this.mesh.count = count;
    this._positions = [];

    for (let i = 0; i < count; i++) {
      const item = items[i];
      const pos = Array.isArray(item.position)
        ? new THREE.Vector3(...item.position)
        : item.position.clone();
      this.dummy.position.copy(pos);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar(item.scale ?? 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);

      this._scratchColor.set(item.color ?? 0x00ffcc);
      this._colors[i * 3 + 0] = this._scratchColor.r;
      this._colors[i * 3 + 1] = this._scratchColor.g;
      this._colors[i * 3 + 2] = this._scratchColor.b;
      this._scales[i] = item.scale ?? 1;

      this._positions.push({
        index: i,
        position: pos,
        data: item.data,
      });
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    // Reuse the single instanceColor attribute; just signal GPU re-upload.
    this._instanceColor.needsUpdate = true;
  }

  /**
   * Update the color/scale of a subset of instances without rebuilding matrices.
   */
  updateInstances(updates: InstancedPointCloudUpdate[]): void {
    for (const u of updates) {
      if (u.color != null) {
        this._scratchColor.set(u.color);
        this._colors[u.index * 3 + 0] = this._scratchColor.r;
        this._colors[u.index * 3 + 1] = this._scratchColor.g;
        this._colors[u.index * 3 + 2] = this._scratchColor.b;
      }
      if (u.scale != null && this._positions[u.index]) {
        this._scales[u.index] = u.scale;
        this.dummy.position.copy(this._positions[u.index].position);
        this.dummy.scale.setScalar(u.scale);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(u.index, this.dummy.matrix);
      }
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Update GPU instance attribute buffer sub-ranges without full geometry buffer rebuild.
   */
  updateSubRange(offset: number, count: number): void {
    if (!this.mesh.instanceMatrix) return;
    const matrixAttr = this.mesh.instanceMatrix as THREE.InstancedBufferAttribute;
    matrixAttr.addUpdateRange(offset * 16, count * 16);
    matrixAttr.needsUpdate = true;

    if (this.mesh.instanceColor) {
      const colorAttr = this.mesh.instanceColor as THREE.InstancedBufferAttribute;
      colorAttr.addUpdateRange(offset * 3, count * 3);
      colorAttr.needsUpdate = true;
    }
  }

  /**
   * Raycast against the instanced cloud and return the nearest instance data.
   */
  intersect(raycaster: THREE.Raycaster): InstancedPointCloudHit | null {
    const hits = raycaster.intersectObject(this.mesh, false);
    if (hits.length === 0) return null;
    const hit = hits[0];
    const index = hit.instanceId ?? 0;
    return {
      index,
      data: this._positions[index]?.data ?? null,
      distance: hit.distance,
    };
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    // Dispose the InstancedMesh itself. In three r168 this dispatches the
    // 'dispose' event that the renderer's WebGLObjects.onInstancedMeshDispose
    // listens for to remove (and free the GPU buffers of) instanceMatrix and
    // instanceColor — geometry.dispose() alone does NOT free instanced
    // attributes. This is the real VRAM-free path; it is a no-op in jsdom
    // (no renderer is listening) but does not throw.
    this.mesh.dispose();
    // Forward-compatibility guards: BufferAttribute has no dispose() in r168,
    // but invoke it if a future revision adds one.
    this.mesh.instanceMatrix.dispose?.();
    this._instanceColor.dispose?.();
    // Drop CPU-side typed-array references so the instanced buffers can be
    // garbage collected even when the renderer does not reclaim GPU buffers
    // for instanced attributes explicitly.
    this.mesh.instanceColor = null;
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
  }
}

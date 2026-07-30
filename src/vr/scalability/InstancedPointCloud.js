import * as THREE from 'three';

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
  constructor(maxCount = 2000, geometry = null) {
    this.maxCount = maxCount;

    // Default geometry: small faceted sphere.
    this.geometry = geometry || new THREE.BoxGeometry(0.06, 0.06, 0.06);

    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false,
    });

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, maxCount);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;

    this.dummy = new THREE.Object3D();
    this._positions = [];
    this._colors = new Float32Array(maxCount * 3);
    this._scales = new Float32Array(maxCount);
  }

  /**
   * Set the visible points from an array of encoded items.
   * @param {Array<{position: number[3], color: number, scale: number, data: any}>} items
   */
  setPoints(items) {
    const count = Math.min(items.length, this.maxCount);
    this.mesh.count = count;
    this._positions = [];

    for (let i = 0; i < count; i++) {
      const item = items[i];
      this.dummy.position.set(...item.position);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar(item.scale ?? 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);

      const c = new THREE.Color(item.color ?? 0x00ffcc);
      this._colors[i * 3 + 0] = c.r;
      this._colors[i * 3 + 1] = c.g;
      this._colors[i * 3 + 2] = c.b;
      this._scales[i] = item.scale ?? 1;

      this._positions.push({
        index: i,
        position: new THREE.Vector3(...item.position),
        data: item.data,
      });
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(this._colors, 3);
  }

  /**
   * Update the color/scale of a subset of instances without rebuilding matrices.
   * @param {Array<{index: number, color?: number, scale?: number}>} updates
   */
  updateInstances(updates) {
    for (const u of updates) {
      if (u.color != null) {
        const c = new THREE.Color(u.color);
        this._colors[u.index * 3 + 0] = c.r;
        this._colors[u.index * 3 + 1] = c.g;
        this._colors[u.index * 3 + 2] = c.b;
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
   * Raycast against the instanced cloud and return the nearest instance data.
   * @param {THREE.Raycaster} raycaster
   * @returns {{index: number, data: any, distance: number}|null}
   */
  intersect(raycaster) {
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

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
  }
}

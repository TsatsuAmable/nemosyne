import * as THREE from 'three';

/**
 * Transient, non-destructive preview of a data operation before it is applied.
 *
 * For each supported operation the manager creates lightweight world-space
 * indicators (sprites and lines) that show what will change: rows kept/removed
 * for filter and time-slice, new rank for sort, and outlier candidates for
 * anomaly. The preview never mutates the artefact meshes themselves; it only
 * adds temporary overlays that are cleared when the operation is committed or
 * cancelled.
 */
export class LivePreview {
  constructor(scene, camera, options = {}) {
    this.scene = scene;
    this.camera = camera;
    this.enabled = options.enabled ?? true;
    this.offset = options.offset ?? new THREE.Vector3(0, 0.75, 0);

    this._markers = [];
    this._tempPos = new THREE.Vector3();
    this._materialCache = new Map();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    for (const m of this._markers) {
      m.mesh.visible = enabled;
    }
  }

  clear() {
    for (const m of this._markers) {
      this.scene.remove(m.mesh);
      m.mesh.material.map?.dispose?.();
      m.mesh.material.dispose?.();
      if (m.line) {
        this.scene.remove(m.line);
        m.line.geometry.dispose?.();
        m.line.material.dispose?.();
      }
    }
    this._markers = [];
    for (const mat of this._materialCache.values()) {
      mat.map?.dispose?.();
      mat.dispose?.();
    }
    this._materialCache.clear();
  }

  /**
   * Show a preview for the named operation.
   * @param {string} operation
   * @param {import('../../data/Dataset.ts').Dataset} previewDataset
   * @param {import('../../data/Dataset.ts').Dataset} originalDataset
   * @param {{ nodeMeshes: THREE.Mesh[] }} artifact
   */
  preview(operation, previewDataset, originalDataset, artifact) {
    this.clear();
    if (!this.enabled || !artifact?.nodeMeshes?.length) return;

    switch (operation) {
      case 'filter':
      case 'timeSlice':
        this._previewKeepRemove(previewDataset, artifact, operation === 'timeSlice' ? '✂' : '✕');
        break;
      case 'sort':
        this._previewSort(previewDataset, artifact);
        break;
      case 'anomaly':
        this._previewAnomaly(previewDataset, artifact);
        break;
      default:
        break;
    }
  }

  _previewKeepRemove(previewDataset, artifact, removeIcon) {
    const kept = new Set(previewDataset.rows);
    for (const mesh of artifact.nodeMeshes) {
      const row = mesh.userData.row;
      // Operations may produce new row objects, so match by value identity.
      const isKept = this._rowInSet(row, kept);
      const icon = isKept ? '✓' : removeIcon;
      const color = isKept ? '#00ffcc' : '#ff3366';
      const marker = this._createSprite(icon, color);
      this._attachMarker(marker, mesh);
      marker.userData.isPreview = true;
    }
  }

  _previewSort(previewDataset, artifact) {
    const order = previewDataset.rows;
    const count = order.length;
    for (let i = 0; i < count; i++) {
      const row = order[i];
      const mesh = artifact.nodeMeshes.find((m) => this._rowsEqual(m.userData.row, row));
      if (!mesh) continue;
      const rank = i + 1;
      const marker = this._createSprite(String(rank), '#ffcc00');
      this._attachMarker(marker, mesh, new THREE.Vector3(0.35, 0.65, 0));
      marker.userData.isPreview = true;
    }
  }

  _previewAnomaly(previewDataset, artifact) {
    for (const mesh of artifact.nodeMeshes) {
      const previewRow = this._findPreviewRow(mesh.userData.row, previewDataset.rows);
      const isOutlier =
        previewRow?._anomaly || previewRow?.anomaly || previewRow?._outlier || previewRow?.outlier;
      if (!isOutlier) continue;
      const marker = this._createSprite('⚡', '#ff3366');
      this._attachMarker(marker, mesh, new THREE.Vector3(0, 0.9, 0));
      marker.userData.isPreview = true;
    }
  }

  _findPreviewRow(meshRow, previewRows) {
    return previewRows.find((r) => this._rowsEqual(r, meshRow));
  }

  _rowInSet(row, set) {
    for (const r of set) {
      if (this._rowsEqual(r, row)) return true;
    }
    return false;
  }

  _rowsEqual(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    // Compare non-internal keys; preview rows may have added _anomaly, _rank, etc.
    const keysA = Object.keys(a).filter((k) => !k.startsWith('_'));
    const keysB = Object.keys(b).filter((k) => !k.startsWith('_'));
    if (keysA.length !== keysB.length) return false;
    for (const k of keysA) {
      if (a[k] !== b[k]) return false;
      if (!keysB.includes(k)) return false;
    }
    return true;
  }

  _createSprite(text, color) {
    const key = `${text}|${color}`;
    if (this._materialCache.has(key)) {
      return new THREE.Sprite(this._materialCache.get(key));
    }

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d') || this._createMockContext();

    ctx.fillStyle = 'rgba(4, 12, 24, 0.85)';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 120, 120);

    ctx.font = '64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
      depthWrite: false,
    });
    this._materialCache.set(key, mat);
    return new THREE.Sprite(mat);
  }

  _attachMarker(sprite, anchorMesh, offset = null) {
    sprite.scale.set(0.3, 0.3, 1);
    this.scene.add(sprite);

    anchorMesh.getWorldPosition(this._tempPos);
    const off = offset || this.offset.clone();
    sprite.position.copy(this._tempPos).add(off);
    sprite.updateMatrixWorld();

    this._markers.push({ mesh: sprite, anchorMesh, offset: off.clone() });
  }

  /**
   * Keep preview markers anchored to their artefacts each frame so they remain
   * valid if the palace animates or the user moves around it.
   */
  update() {
    for (const marker of this._markers) {
      marker.anchorMesh.getWorldPosition(this._tempPos);
      marker.mesh.position.copy(this._tempPos).add(marker.offset);
      marker.mesh.updateMatrixWorld();
    }
  }

  _createMockContext() {
    const noOp = () => {};
    return {
      fillRect: noOp,
      strokeRect: noOp,
      fillText: noOp,
      measureText: () => ({ width: 0 }),
      set fillStyle(_) {},
      set strokeStyle(_) {},
      set lineWidth(_) {},
      set font(_) {},
      set textAlign(_) {},
      set textBaseline(_) {},
    };
  }
}

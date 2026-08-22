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

import * as THREE from 'three';
import type { Dataset } from '../../data/Dataset.ts';
import { rendererRowId } from '../../data/RowIdentity.ts';
import type { ArtifactRef } from '../coordinators/types.ts';

interface LivePreviewOptions {
  enabled?: boolean;
  offset?: THREE.Vector3;
}

interface PreviewMarker {
  mesh: THREE.Sprite;
  anchorMesh: THREE.Mesh;
  offset: THREE.Vector3;
}

export class LivePreview {
  scene: THREE.Scene;
  camera: THREE.Camera;
  enabled: boolean;
  offset: THREE.Vector3;

  private _markers: PreviewMarker[] = [];
  private _tempPos = new THREE.Vector3();
  private _materialCache = new Map<string, THREE.SpriteMaterial>();

  constructor(scene: THREE.Scene, camera: THREE.Camera, options: LivePreviewOptions = {}) {
    this.scene = scene;
    this.camera = camera;
    this.enabled = options.enabled ?? true;
    this.offset = options.offset ?? new THREE.Vector3(0, 0.75, 0);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    for (const m of this._markers) {
      m.mesh.visible = enabled;
    }
  }

  clear() {
    for (const m of this._markers) {
      this.scene.remove(m.mesh);
      const mat = m.mesh.material as THREE.SpriteMaterial;
      mat.map?.dispose();
      mat.dispose();
    }
    this._markers = [];
    for (const mat of this._materialCache.values()) {
      mat.map?.dispose();
      mat.dispose();
    }
    this._materialCache.clear();
  }

  /** Show a preview for the named operation. */
  preview(
    operation: string,
    previewDataset: Dataset,
    originalDataset: Dataset,
    artifact: ArtifactRef
  ) {
    this.clear();
    if (!this.enabled || !artifact.nodeMeshes.length) return;

    switch (operation) {
      case 'filter':
      case 'timeSlice':
        this._previewKeepRemove(
          previewDataset,
          artifact,
          operation === 'timeSlice' ? '✂' : '✕'
        );
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

    void originalDataset;
  }

  private _previewKeepRemove(previewDataset: Dataset, artifact: ArtifactRef, removeIcon: string) {
    const keptIds = new Set(previewDataset.rows.map(rendererRowId));
    for (const mesh of artifact.nodeMeshes) {
      const row = this._getRow(mesh);
      const isKept = keptIds.has(rendererRowId(row));
      const icon = isKept ? '✓' : removeIcon;
      const color = isKept ? '#00ffcc' : '#ff3366';
      const marker = this._createSprite(icon, color);
      this._attachMarker(marker, mesh);
      marker.userData.isPreview = true;
    }
  }

  private _previewSort(previewDataset: Dataset, artifact: ArtifactRef) {
    const meshesByRowId = new Map(
      artifact.nodeMeshes.map((mesh) => [rendererRowId(this._getRow(mesh)), mesh] as const)
    );
    for (let i = 0; i < previewDataset.rows.length; i++) {
      const row = previewDataset.rows[i];
      const mesh = meshesByRowId.get(rendererRowId(row));
      if (!mesh) continue;
      const rank = i + 1;
      const marker = this._createSprite(String(rank), '#ffcc00');
      this._attachMarker(marker, mesh, new THREE.Vector3(0.35, 0.65, 0));
      marker.userData.isPreview = true;
    }
  }

  private _previewAnomaly(previewDataset: Dataset, artifact: ArtifactRef) {
    const previewRowsById = new Map(
      previewDataset.rows.map((row) => [rendererRowId(row), row] as const)
    );
    for (const mesh of artifact.nodeMeshes) {
      const previewRow = previewRowsById.get(rendererRowId(this._getRow(mesh)));
      const isOutlier =
        previewRow?._anomaly || previewRow?.anomaly || previewRow?._outlier || previewRow?.outlier;
      if (!isOutlier) continue;
      const marker = this._createSprite('⚡', '#ff3366');
      this._attachMarker(marker, mesh, new THREE.Vector3(0, 0.9, 0));
      marker.userData.isPreview = true;
    }
  }

  private _getRow(mesh: THREE.Mesh): Record<string, unknown> {
    return (mesh.userData as { row?: Record<string, unknown> }).row ?? {};
  }

  private _createSprite(text: string, color: string): THREE.Sprite {
    const key = `${text}|${color}`;
    const cached = this._materialCache.get(key);
    if (cached) {
      return new THREE.Sprite(cached);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = (canvas.getContext('2d') || this._createMockContext()) as CanvasRenderingContext2D;

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

  private _attachMarker(
    sprite: THREE.Sprite,
    anchorMesh: THREE.Mesh,
    offset: THREE.Vector3 | null = null
  ) {
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

  private _createMockContext(): CanvasRenderingContext2D {
    const noOp = () => {};
    return {
      fillRect: noOp,
      strokeRect: noOp,
      fillText: noOp,
      measureText: () => ({ width: 0 }),
      set fillStyle(_: string) {},
      set strokeStyle(_: string) {},
      set lineWidth(_: number) {},
      set font(_: string) {},
      set textAlign(_: string) {},
      set textBaseline(_: string) {},
    } as unknown as CanvasRenderingContext2D;
  }
}

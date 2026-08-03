import * as THREE from 'three';

/**
 * World-space, in-place operation handles for common data-analysis actions.
 *
 * For TABULAR/HIERARCHY datasets, a small floating badge appears near the first
 * data artefact offering filter and sort. For TIME_SERIES, a scrub handle
 * appears at the ribbon midpoint for slicing. Handles fade in when gazed or
 * when a hand/controller is nearby, and are hidden in expert mode if desired.
 *
 * Handles are implemented as lightweight THREE.Sprite quads so they always
 * face the user, with simple hit testing via InputRouter interactables.
 */
export class InPlaceOperationHandles {
  constructor(scene, camera, options = {}) {
    this.scene = scene;
    this.camera = camera;
    this.onOperation = options.onOperation ?? (() => {});
    this.userMode = options.userMode ?? 'novice';
    this.enabled = options.enabled ?? true;
    this._handles = [];
    this._fadeState = new Map();

    this._tempPos = new THREE.Vector3();
    this._cameraPos = new THREE.Vector3();
    this._raycaster = new THREE.Raycaster();
    this._raycaster.camera = camera;

    this._spriteMaterialCache = new Map();
  }

  setUserMode(mode) {
    this.userMode = mode;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    for (const h of this._handles) {
      h.sprite.visible = enabled && this._fadeState.get(h) > 0.01;
    }
  }

  clear() {
    for (const h of this._handles) {
      this.scene.remove(h.sprite);
      h.sprite.material.map?.dispose();
      h.sprite.material.dispose();
    }
    this._handles = [];
    this._fadeState.clear();
    for (const mat of this._spriteMaterialCache.values()) mat.map?.dispose();
    this._spriteMaterialCache.clear();
  }

  build(dracoNode) {
    this.clear();
    if (!dracoNode?.artifact) return;

    const topology = dracoNode.dataInput?.topology;
    const meshes = dracoNode.artifact.nodeMeshes ?? [];
    if (meshes.length === 0) return;

    switch (topology) {
      case 'TABULAR':
      case 'HIERARCHY':
        this._addHandle(meshes[0], 'filter', '🔎');
        this._addHandle(meshes[Math.min(meshes.length - 1, 1)], 'sort', '📶');
        break;
      case 'TIME_SERIES':
        this._addHandle(meshes[Math.floor(meshes.length / 2)], 'timeSlice', '🕒');
        break;
      default:
        return;
    }
  }

  _addHandle(anchorMesh, operation, icon) {
    if (!anchorMesh) return;
    const mat = this._getSpriteMaterial(operation, icon);
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.25, 0.25, 1);
    sprite.visible = this.enabled;
    this.scene.add(sprite);

    const handle = {
      anchorMesh,
      operation,
      sprite,
      baseOffset: new THREE.Vector3(0, 0.55, 0),
      hover: false,
    };

    this._handles.push(handle);
    this._fadeState.set(handle, 0);
  }

  _getSpriteMaterial(operation, icon) {
    if (this._spriteMaterialCache.has(operation)) {
      return this._spriteMaterialCache.get(operation);
    }
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d') || this._createMockContext();

    ctx.fillStyle = 'rgba(4, 12, 24, 0.92)';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 120, 120);

    ctx.font = '64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, 64, 56);

    ctx.font = '16px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(operation, 64, 108);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    });
    this._spriteMaterialCache.set(operation, mat);
    return mat;
  }

  update(delta, time, pointerRay) {
    this.camera.getWorldPosition(this._cameraPos);

    for (const handle of this._handles) {
      if (!handle.anchorMesh.parent) continue;

      // Position the handle above/beside the anchor in world space.
      handle.anchorMesh.getWorldPosition(this._tempPos);
      this._tempPos.add(handle.baseOffset);
      handle.sprite.position.copy(this._tempPos);
      handle.sprite.updateMatrixWorld();

      // Compute desired opacity based on gaze/proximity.
      let targetOpacity = 0.35;
      if (this.userMode === 'expert') targetOpacity = 0;
      if (this._isPointerNear(handle, pointerRay)) targetOpacity = 0.95;
      else if (this._isHandNear(handle)) targetOpacity = 0.75;

      // Fade to target.
      let fade = this._fadeState.get(handle) ?? 0;
      const rate = 4 * delta;
      fade += (targetOpacity - fade) * Math.min(1, rate);
      this._fadeState.set(handle, fade);

      handle.sprite.material.opacity = Math.max(0, fade);
      handle.sprite.visible = this.enabled && fade > 0.01;
    }
  }

  _isPointerNear(handle, pointerRay) {
    if (!pointerRay) return false;
    this._raycaster.ray.copy(pointerRay);
    const hits = this._raycaster.intersectObject(handle.sprite, false);
    return hits.length > 0;
  }

  _isHandNear(handle) {
    // No direct hand position available here; rely on caller to tell us via
    // pointer proximity. The InputRouter hover path is authoritative.
    return false;
  }

  /** Fire the operation bound to a handle; called by InputRouter selection. */
  activate(operation) {
    this.onOperation(operation);
  }

  registerInteractables(router) {
    for (const handle of this._handles) {
      router.addInteractable(handle.sprite, {
        onEnter: () => {
          handle.hover = true;
          handle.baseOffset.y = 0.65;
        },
        onLeave: () => {
          handle.hover = false;
          handle.baseOffset.y = 0.55;
        },
        onSelect: () => this.activate(handle.operation),
      });
    }
  }

  unregisterInteractables(router) {
    for (const handle of this._handles) {
      router.removeInteractable(handle.sprite);
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
      createRadialGradient: () => ({ addColorStop: noOp }),
    };
  }
}

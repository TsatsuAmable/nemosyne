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

import * as THREE from 'three';

interface DracoNodeLike {
  artifact?: { nodeMeshes?: THREE.Mesh[] } | undefined;
  dataInput?: { topology?: string } | undefined;
}

interface StructureLike {
  id: string;
  kind: string;
  rowIndices: number[];
  evidence: { method: string; rank: number; score?: number };
}

interface StructureSetLike {
  id: string;
  structures: StructureLike[];
}

interface HandleCallbacks {
  onEnter?: () => void;
  onLeave?: () => void;
  onSelect?: () => void;
}

interface InputRouterLike {
  addInteractable: (object: THREE.Object3D, callbacks: HandleCallbacks) => void;
  removeInteractable: (object: THREE.Object3D) => void;
}

interface OperationHandle {
  anchorMesh: THREE.Mesh;
  operation: string;
  sprite: THREE.Sprite;
  baseOffset: THREE.Vector3;
  hover: boolean;
  structureId?: string;
}

interface InPlaceOptions {
  onOperation?: (operation: string) => void;
  onOperationHover?: (operation: string) => void;
  onOperationLeave?: (operation: string) => void;
  onStructureCommand?: (structureId: string, action: string) => void;
  userMode?: 'novice' | 'expert';
  enabled?: boolean;
}

export class InPlaceOperationHandles {
  scene: THREE.Scene;
  camera: THREE.Camera;
  onOperation: (operation: string) => void;
  onOperationHover: (operation: string) => void;
  onOperationLeave: (operation: string) => void;
  onStructureCommand: (structureId: string, action: string) => void;
  userMode: 'novice' | 'expert';
  enabled: boolean;

  private _handles: OperationHandle[] = [];
  private _fadeState = new Map<OperationHandle, number>();
  private _tempPos = new THREE.Vector3();
  private _cameraPos = new THREE.Vector3();
  private _raycaster = new THREE.Raycaster();
  private _spriteMaterialCache = new Map<string, THREE.SpriteMaterial>();

  constructor(scene: THREE.Scene, camera: THREE.Camera, options: InPlaceOptions = {}) {
    this.scene = scene;
    this.camera = camera;
    this.onOperation = options.onOperation ?? (() => {});
    this.onOperationHover = options.onOperationHover ?? (() => {});
    this.onOperationLeave = options.onOperationLeave ?? (() => {});
    this.onStructureCommand = options.onStructureCommand ?? (() => {});
    this.userMode = options.userMode ?? 'novice';
    this.enabled = options.enabled ?? true;
    this._raycaster.camera = camera;
  }

  setUserMode(mode: 'novice' | 'expert') {
    this.userMode = mode;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    for (const h of this._handles) {
      h.sprite.visible = enabled && (this._fadeState.get(h) ?? 0) > 0.01;
    }
  }

  clear() {
    for (const h of this._handles) {
      this.scene.remove(h.sprite);
      const mat = h.sprite.material as THREE.SpriteMaterial;
      mat.map?.dispose();
      mat.dispose();
    }
    this._handles = [];
    this._fadeState.clear();
    for (const mat of this._spriteMaterialCache.values()) {
      mat.map?.dispose();
      mat.dispose();
    }
    this._spriteMaterialCache.clear();
  }

  build(dracoNode: DracoNodeLike) {
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

  buildFromStructures(dracoNode: DracoNodeLike, structureSets: StructureSetLike[]) {
    this.clear();
    if (!dracoNode?.artifact) return;
    const meshes = dracoNode.artifact.nodeMeshes ?? [];
    if (meshes.length === 0) return;

    const iconForKind: Record<string, string> = {
      'cluster': '🔷',
      'persistent-component': '📡',
      'mapper-node': '🗺️',
    };
    const actionForKind: Record<string, string> = {
      'cluster': 'inspect-cluster',
      'persistent-component': 'inspect-boundary',
      'mapper-node': 'explore-region',
    };

    let added = 0;
    for (const set of structureSets) {
      for (const structure of set.structures) {
        if (added >= 6) break;
        const anchorIdx = structure.rowIndices[0] ?? 0;
        const anchorMesh = meshes[Math.min(anchorIdx, meshes.length - 1)];
        if (!anchorMesh) continue;
        const icon = iconForKind[structure.kind] ?? '📍';
        const action = actionForKind[structure.kind] ?? 'explore-region';
        this._addStructureHandle(anchorMesh, structure.id, action, icon);
        added++;
      }
      if (added >= 6) break;
    }
  }

  private _addStructureHandle(
    anchorMesh: THREE.Mesh,
    structureId: string,
    action: string,
    icon: string,
  ) {
    const mat = this._getSpriteMaterial(structureId, icon);
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.22, 0.22, 1);
    sprite.visible = this.enabled;
    this.scene.add(sprite);

    const handle: OperationHandle = {
      anchorMesh,
      operation: action,
      sprite,
      baseOffset: new THREE.Vector3(0, 0.45, 0),
      hover: false,
      structureId,
    };

    this._handles.push(handle);
    this._fadeState.set(handle, 0);
  }

  private _addHandle(anchorMesh: THREE.Mesh | undefined, operation: string, icon: string) {
    if (!anchorMesh) return;
    const mat = this._getSpriteMaterial(operation, icon);
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.25, 0.25, 1);
    sprite.visible = this.enabled;
    this.scene.add(sprite);

    const handle: OperationHandle = {
      anchorMesh,
      operation,
      sprite,
      baseOffset: new THREE.Vector3(0, 0.55, 0),
      hover: false,
    };

    this._handles.push(handle);
    this._fadeState.set(handle, 0);
  }

  private _getSpriteMaterial(operation: string, icon: string): THREE.SpriteMaterial {
    const cached = this._spriteMaterialCache.get(operation);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = (canvas.getContext('2d') || this._createMockContext()) as CanvasRenderingContext2D;

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

  update(delta: number, _time: number, pointerRay: THREE.Ray | undefined) {
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
      if (pointerRay && this._isPointerNear(handle, pointerRay)) targetOpacity = 0.95;
      else if (this._isHandNear(handle)) targetOpacity = 0.75;

      // Fade to target.
      let fade = this._fadeState.get(handle) ?? 0;
      const rate = 4 * delta;
      fade += (targetOpacity - fade) * Math.min(1, rate);
      this._fadeState.set(handle, fade);

      const mat = handle.sprite.material as THREE.SpriteMaterial;
      mat.opacity = Math.max(0, fade);
      handle.sprite.visible = this.enabled && fade > 0.01;
    }
  }

  private _isPointerNear(handle: OperationHandle, pointerRay: THREE.Ray): boolean {
    this._raycaster.ray.copy(pointerRay);
    if (this.camera) {
      this._raycaster.camera = this.camera;
    }
    const hits = this._raycaster.intersectObject(handle.sprite, false);
    return hits.length > 0;
  }

  private _isHandNear(_handle: OperationHandle): boolean {
    // No direct hand position available here; rely on caller to tell us via
    // pointer proximity. The InputRouter hover path is authoritative.
    return false;
  }

  /** Fire the operation bound to a handle; called by InputRouter selection. */
  activate(operation: string) {
    this.onOperation(operation);
  }

  registerInteractables(router: InputRouterLike) {
    for (const handle of this._handles) {
      router.addInteractable(handle.sprite, {
        onEnter: () => {
          handle.hover = true;
          handle.baseOffset.y = 0.65;
          if (handle.structureId) {
            this.onStructureCommand(handle.structureId, 'hover');
          } else {
            this.onOperationHover(handle.operation);
          }
        },
        onLeave: () => {
          handle.hover = false;
          handle.baseOffset.y = 0.55;
          if (!handle.structureId) {
            this.onOperationLeave(handle.operation);
          }
        },
        onSelect: () => {
          if (handle.structureId) {
            this.onStructureCommand(handle.structureId, handle.operation);
          } else {
            this.activate(handle.operation);
          }
        },
      });
    }
  }

  unregisterInteractables(router: InputRouterLike) {
    for (const handle of this._handles) {
      router.removeInteractable(handle.sprite);
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
      createRadialGradient: () => ({ addColorStop: noOp } as unknown as CanvasGradient),
    } as unknown as CanvasRenderingContext2D;
  }
}

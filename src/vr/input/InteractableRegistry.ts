/**
 * Owns the lists of scene interactables, HUD objects, and world-space panels,
 * and performs raycast/hover bookkeeping.
 *
 * Keeping this state separate from `InputRouter` makes the router a pure
 * coordinator and lets the registry be unit-tested in isolation.
 */

import * as THREE from 'three';
import type { ObjectBVH } from 'three-mesh-bvh';
import type { FeedbackLike, PanelLike } from '../coordinators/types.ts';
import {
  BVHSpatialAccelerator,
  MAX_EXPANDED_OBJECT_BVH_INSTANCES,
  MIN_OBJECT_BVH_PRIMITIVES,
} from '../scalability/BVHSpatialAccelerator.ts';

export interface InteractableEntry {
  mesh: THREE.Object3D;
  onEnter?(mesh: THREE.Object3D): void;
  onLeave?(mesh: THREE.Object3D): void;
  onSelect?(mesh: THREE.Object3D, data?: unknown): void;
  data?: unknown;
}

export interface HudObject {
  handlePointerClick?(raycaster: THREE.Raycaster): boolean | undefined;
}

export interface PanelHit {
  panel: PanelLike;
  distance: number;
}

export interface SceneHit {
  entry: InteractableEntry;
  distance: number;
}

export class InteractableRegistry {
  raycaster: THREE.Raycaster;

  private _interactables: InteractableEntry[] = [];
  private _interactableMeshes: THREE.Object3D[] = [];
  private _entryByRoot = new Map<THREE.Object3D, InteractableEntry>();
  private _entryGeometries = new Map<
    InteractableEntry,
    Array<{ geometry: THREE.BufferGeometry; mesh: THREE.Mesh }>
  >();
  private _geometryReferences = new Map<THREE.BufferGeometry, { count: number; owned: boolean }>();
  private _objectBvh: ObjectBVH | null = null;
  private _objectBvhDirty = true;
  private _indexedRoots: THREE.Object3D[] = [];
  private _fallbackRoots: THREE.Object3D[] = [];
  private _sceneIntersections: THREE.Intersection[] = [];
  hudObjects: HudObject[] = [];
  panels: PanelLike[] = [];

  hovered: InteractableEntry | null = null;
  suppressSceneSelection = false;
  engine?: {
    telemetry?: {
      recordDwell?(target: string, duration: number, completed: boolean): void;
    };
  };

  constructor() {
    this.raycaster = new THREE.Raycaster();
  }

  get interactables(): InteractableEntry[] {
    return this._interactables;
  }

  set interactables(value: InteractableEntry[]) {
    for (const entry of this._interactables) this._releaseSpatialAcceleration(entry);
    this._interactables = value;
    this._interactableMeshes = value.map((entry) => entry.mesh);
    this._entryByRoot.clear();
    for (const entry of value) {
      if (!this._entryByRoot.has(entry.mesh)) this._entryByRoot.set(entry.mesh, entry);
      this._retainSpatialAcceleration(entry);
    }
    this.invalidateSpatialAcceleration();
  }

  addInteractable(mesh: THREE.Object3D, handlers: Partial<InteractableEntry> = {}) {
    const entry = { mesh, ...handlers };
    this._interactables.push(entry);
    this._interactableMeshes.push(mesh);
    if (!this._entryByRoot.has(mesh)) this._entryByRoot.set(mesh, entry);
    this._retainSpatialAcceleration(entry);
    this.invalidateSpatialAcceleration();
  }

  removeInteractable(mesh: THREE.Object3D) {
    const idx = this._interactables.findIndex((i) => i.mesh === mesh);
    if (idx >= 0) {
      const removed = this._interactables[idx];
      this._interactables.splice(idx, 1);
      this._interactableMeshes.splice(idx, 1);
      this._releaseSpatialAcceleration(removed);
      const replacement = this._interactables.find((entry) => entry.mesh === mesh);
      if (replacement) this._entryByRoot.set(mesh, replacement);
      else this._entryByRoot.delete(mesh);
      this.invalidateSpatialAcceleration();
    }
  }

  addHudObject(obj: HudObject) {
    this.hudObjects.push(obj);
  }

  removeHudObject(obj: HudObject) {
    const index = this.hudObjects.indexOf(obj);
    if (index >= 0) this.hudObjects.splice(index, 1);
  }

  addPanel(panel: PanelLike) {
    this.panels.push(panel);
  }

  removePanel(panel: PanelLike) {
    const index = this.panels.indexOf(panel);
    if (index >= 0) this.panels.splice(index, 1);
  }

  clear() {
    this.clearHover();
    for (const entry of this._interactables) this._releaseSpatialAcceleration(entry);
    this._interactables = [];
    this._interactableMeshes = [];
    this._entryByRoot.clear();
    this._entryGeometries.clear();
    this._geometryReferences.clear();
    this.invalidateSpatialAcceleration();
    this.hudObjects = [];
    this.panels = [];
    this.suppressSceneSelection = false;
  }

  invalidateSpatialAcceleration(): void {
    this._objectBvh = null;
    this._objectBvhDirty = true;
  }

  private _retainSpatialAcceleration(entry: InteractableEntry): void {
    const retained: Array<{ geometry: THREE.BufferGeometry; mesh: THREE.Mesh }> = [];
    entry.mesh.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || !child.geometry) return;
      if (!BVHSpatialAccelerator.shouldBuildGeometryTree(child)) return;
      const geometry = child.geometry;
      retained.push({ geometry, mesh: child });
      const existing = this._geometryReferences.get(geometry);
      if (existing) {
        existing.count += 1;
        return;
      }
      const owned = !geometry.boundsTree;
      BVHSpatialAccelerator.buildTree(child);
      this._geometryReferences.set(geometry, { count: 1, owned });
    });
    this._entryGeometries.set(entry, retained);
  }

  private _releaseSpatialAcceleration(entry: InteractableEntry): void {
    for (const retained of this._entryGeometries.get(entry) ?? []) {
      const reference = this._geometryReferences.get(retained.geometry);
      if (!reference) continue;
      reference.count -= 1;
      if (reference.count > 0) continue;
      if (reference.owned) BVHSpatialAccelerator.disposeTree(retained.mesh);
      this._geometryReferences.delete(retained.geometry);
    }
    this._entryGeometries.delete(entry);
  }

  private _isObjectBvhCandidate(object: THREE.Object3D): boolean {
    const candidate = object as THREE.Object3D & {
      isMesh?: boolean;
      isLine?: boolean;
      isPoints?: boolean;
    };
    const renderable =
      candidate.isMesh === true || candidate.isLine === true || candidate.isPoints === true;
    if (!renderable || object.layers.mask !== 1) return false;
    let hasRenderableDescendant = false;
    object.traverse((descendant) => {
      if (descendant === object) return;
      const child = descendant as THREE.Object3D & {
        isMesh?: boolean;
        isLine?: boolean;
        isPoints?: boolean;
      };
      if (child.isMesh || child.isLine || child.isPoints) hasRenderableDescendant = true;
    });
    return !hasRenderableDescendant;
  }

  private _ensureObjectBvh(): void {
    if (!this._objectBvhDirty) return;
    this._objectBvhDirty = false;
    this._indexedRoots = [];
    this._fallbackRoots = [];
    for (const object of this._interactableMeshes) {
      object.updateWorldMatrix(true, true);
      if (this._isObjectBvhCandidate(object)) this._indexedRoots.push(object);
      else this._fallbackRoots.push(object);
    }
    const primitiveCount = BVHSpatialAccelerator.objectPrimitiveCount(this._indexedRoots);
    this._objectBvh =
      primitiveCount >= MIN_OBJECT_BVH_PRIMITIVES
        ? BVHSpatialAccelerator.buildObjectTree(
            this._indexedRoots,
            primitiveCount <= MAX_EXPANDED_OBJECT_BVH_INSTANCES
          )
        : null;
  }

  private _entryForHit(object: THREE.Object3D): InteractableEntry | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      const entry = this._entryByRoot.get(current);
      if (entry) return entry;
      current = current.parent;
    }
    return null;
  }

  setSuppressSceneSelection(enabled: boolean) {
    this.suppressSceneSelection = !!enabled;
  }

  /**
   * Raycast against visible panels and return the nearest { panel, distance }.
   */
  raycastPanels(): PanelHit | null {
    let nearest: PanelHit | null = null;
    for (const panel of this.panels) {
      if (!panel.mesh?.visible) continue;
      const hits = this.raycaster.intersectObject(panel.mesh, false);
      if (hits.length > 0) {
        if (!nearest || hits[0].distance < nearest.distance) {
          nearest = { panel, distance: hits[0].distance };
        }
      }
    }
    return nearest;
  }

  /**
   * Raycast against scene interactables and return the first hit entry and its
   * distance, or null when scene selection is suppressed or nothing is hit.
   */
  raycastScene(
    raycaster = this.raycaster,
    options: { ignoreSuppression?: boolean } = {}
  ): SceneHit | null {
    if (this.suppressSceneSelection && !options.ignoreSuppression) return null;
    this._ensureObjectBvh();
    this._sceneIntersections.length = 0;
    const objectBvh = raycaster.layers.mask === 1 ? this._objectBvh : null;
    (
      raycaster as THREE.Raycaster & {
        firstHitOnly?: boolean;
      }
    ).firstHitOnly = objectBvh !== null;
    if (objectBvh) {
      objectBvh.raycast(raycaster, this._sceneIntersections);
      raycaster.intersectObjects(this._fallbackRoots, true, this._sceneIntersections);
      this._sceneIntersections.sort((a, b) => a.distance - b.distance);
    } else {
      raycaster.intersectObjects(this._interactableMeshes, true, this._sceneIntersections);
    }
    const hits = this._sceneIntersections;
    if (hits.length > 0) {
      const entry = this._entryForHit(hits[0].object);
      if (entry) return { entry, distance: hits[0].distance };
    }
    return null;
  }

  /**
   * Update hover state based on a panel hit, a scene hit, or nothing.
   * `sceneHit` is the object returned by `raycastScene()`.
   * Returns the active scene entry (if any).
   */
  updateHover(
    panelHit: PanelHit | null,
    sceneHit: SceneHit | null,
    feedback?: FeedbackLike
  ): InteractableEntry | null {
    if (panelHit) {
      this.clearHover();
      return null;
    }

    const sceneEntry = sceneHit?.entry ?? null;
    if (sceneEntry) {
      if (this.hovered !== sceneEntry) {
        if (this.hovered?.onLeave) this.hovered.onLeave(this.hovered.mesh);
        this.hovered = sceneEntry;
        if (sceneEntry.onEnter) sceneEntry.onEnter(sceneEntry.mesh);
        if (feedback) feedback.playHover?.();
      }
      return sceneEntry;
    }

    this.clearHover();
    return null;
  }

  /**
   * Dispatch a click to each registered HUD object until one consumes it.
   * Returns true if consumed.
   */
  dispatchHudClick(): boolean {
    for (const hud of this.hudObjects) {
      if (hud.handlePointerClick) {
        const consumed = hud.handlePointerClick(this.raycaster);
        if (consumed) return true;
      }
    }
    return false;
  }

  clearHover() {
    if (this.hovered?.onLeave) {
      this.hovered.onLeave(this.hovered.mesh);
    }
    this.hovered = null;
  }
}

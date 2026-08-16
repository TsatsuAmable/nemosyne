/**
 * Owns the lists of scene interactables, HUD objects, and world-space panels,
 * and performs raycast/hover bookkeeping.
 *
 * Keeping this state separate from `InputRouter` makes the router a pure
 * coordinator and lets the registry be unit-tested in isolation.
 */

import * as THREE from 'three';
import type { FeedbackLike, PanelLike } from '../coordinators/types.ts';

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

  interactables: InteractableEntry[] = [];
  hudObjects: HudObject[] = [];
  panels: PanelLike[] = [];

  hovered: InteractableEntry | null = null;
  suppressSceneSelection = false;

  constructor() {
    this.raycaster = new THREE.Raycaster();
  }

  addInteractable(mesh: THREE.Object3D, handlers: Partial<InteractableEntry> = {}) {
    this.interactables.push({ mesh, ...handlers });
  }

  removeInteractable(mesh: THREE.Object3D) {
    const idx = this.interactables.findIndex((i) => i.mesh === mesh);
    if (idx >= 0) this.interactables.splice(idx, 1);
  }

  addHudObject(obj: HudObject) {
    this.hudObjects.push(obj);
  }

  addPanel(panel: PanelLike) {
    this.panels.push(panel);
  }

  removePanel(panel: PanelLike) {
    const index = this.panels.indexOf(panel);
    if (index >= 0) this.panels.splice(index, 1);
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
  raycastScene(): SceneHit | null {
    if (this.suppressSceneSelection) return null;
    const hits = this.raycaster.intersectObjects(
      this.interactables.map((i) => i.mesh),
      false
    );
    if (hits.length > 0) {
      const hit = hits[0].object;
      const entry = this.interactables.find((i) => i.mesh === hit) ?? null;
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

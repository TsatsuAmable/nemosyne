import * as THREE from 'three';

/**
 * Owns the lists of scene interactables, HUD objects, and world-space panels,
 * and performs raycast/hover bookkeeping.
 *
 * Keeping this state separate from `InputRouter` makes the router a pure
 * coordinator and lets the registry be unit-tested in isolation.
 */
export class InteractableRegistry {
  constructor() {
    this.raycaster = new THREE.Raycaster();

    this.interactables = []; // { mesh, onEnter, onLeave, onSelect, data }
    this.hudObjects = []; // objects with handlePointerClick(raycaster)
    this.panels = []; // MovablePanels

    this.hovered = null;
    this.suppressSceneSelection = false;
  }

  addInteractable(mesh, handlers = {}) {
    this.interactables.push({ mesh, ...handlers });
  }

  removeInteractable(mesh) {
    const idx = this.interactables.findIndex((i) => i.mesh === mesh);
    if (idx >= 0) this.interactables.splice(idx, 1);
  }

  addHudObject(obj) {
    this.hudObjects.push(obj);
  }

  addPanel(panel) {
    this.panels.push(panel);
  }

  setSuppressSceneSelection(enabled) {
    this.suppressSceneSelection = !!enabled;
  }

  /**
   * Raycast against visible panels and return the nearest { panel, distance }.
   */
  raycastPanels() {
    let nearest = null;
    for (const panel of this.panels) {
      if (!panel.mesh.visible) continue;
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
  raycastScene() {
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
  updateHover(panelHit, sceneHit, feedback) {
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
        if (feedback) feedback.playHover();
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
  dispatchHudClick() {
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

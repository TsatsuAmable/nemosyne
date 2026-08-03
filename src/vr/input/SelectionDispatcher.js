import * as THREE from 'three';
import { SelectionFeedback } from '../audio/SelectionFeedback.js';

/**
 * Dispatches selection events, drives hover/selection audio-haptic feedback, and
 * supports dwell (gaze/pinch-and-hold) selection as a motor accessibility aid.
 */
export class SelectionDispatcher {
  constructor(registry, { onSelectCallback } = {}) {
    this.registry = registry;
    this.onSelectCallback = onSelectCallback;

    this.feedback = new SelectionFeedback();

    this.dwellSelection = false;
    this._dwellThreshold = 1200;
    this._dwellTimer = null;
    this._dwellTarget = null;
  }

  setOnSelectCallback(cb) {
    this.onSelectCallback = cb;
  }

  setDwellSelection(enabled, thresholdMs = 1200) {
    this.dwellSelection = !!enabled;
    this._dwellThreshold = thresholdMs;
    if (!enabled) {
      this._dwellTarget = null;
      if (this._dwellTimer) {
        clearTimeout(this._dwellTimer);
        this._dwellTimer = null;
      }
    }
  }

  /**
   * Trigger selection on the currently hovered scene object or HUD under the
   * active pointer.
   *
   * @param {PointerLike} activePointer
   */
  triggerSelect(activePointer) {
    if (!activePointer) return;
    const ray = activePointer.getRay(new THREE.Ray());
    this.registry.raycaster.ray.copy(ray);

    this.feedback.playSelect();
    this.feedback.flashPointer(activePointer);

    if (this.registry.dispatchHudClick()) return;

    if (this.registry.hovered?.onSelect) {
      this.registry.hovered.onSelect(this.registry.hovered.mesh, this.registry.hovered.data);
    }

    if (this.onSelectCallback) {
      this.onSelectCallback(ray);
    }
  }

  /**
   * Update dwell selection state from the current panel hit and scene entry.
   * `sceneHit` is the object returned by `InteractableRegistry.raycastScene()`.
   */
  updateDwell(panelHit, sceneHit, activePointer) {
    if (!this.dwellSelection || !activePointer) return;

    const sceneEntry = sceneHit?.entry ?? null;
    const target = panelHit
      ? { type: 'panel', value: panelHit.panel }
      : sceneEntry
        ? { type: 'scene', value: sceneEntry }
        : null;

    const targetId = target ? `${target.type}:${target.value?.mesh?.uuid ?? target.value}` : null;

    if (targetId !== this._dwellTarget) {
      this._dwellTarget = targetId;
      if (this._dwellTimer) clearTimeout(this._dwellTimer);
      if (!targetId) return;

      this._dwellTimer = setTimeout(() => {
        if (target.type === 'panel') {
          target.value.handlePointerDown?.(this.registry.raycaster, activePointer);
        } else if (target?.value?.onSelect) {
          target.value.onSelect(target.value.mesh, target.value.data);
        }
      }, this._dwellThreshold ?? 1200);
    }
  }
}

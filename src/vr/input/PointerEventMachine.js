import * as THREE from 'three';

/**
 * Finite-state machine for a single pointer press/move/release cycle.
 *
 * States:
 *   idle  -> down  when the pointer presses while over a panel, HUD, or scene object
 *   down  -> drag  when the panel reports a drag capture on press
 *   down  -> idle when the pointer is released
 *   drag  -> idle when the pointer is released
 *
 * The machine delegates the actual selection event to `onTriggerSelect` so
 * that feedback and higher-level callbacks stay out of the state logic.
 */
export class PointerEventMachine {
  constructor(registry, { panelManager, onTriggerSelect } = {}) {
    this.registry = registry;
    this.panelManager = panelManager;
    this.onTriggerSelect = onTriggerSelect;

    this.state = 'idle';
    this.downPointer = null;
    this.capturedPanel = null;
    this.capturedMode = null;
  }

  /**
   * Press the pointer. Returns true if the press was consumed by UI or scene.
   */
  press(pointer) {
    const ray = pointer.getRay(new THREE.Ray());
    this.registry.raycaster.ray.copy(ray);

    // Launcher ring takes precedence when visible.
    if (this.panelManager?.isLauncherVisible?.()) {
      const hit = this.panelManager.handleLauncherHit(this.registry.raycaster);
      if (hit) return true;
    }

    // Panels take precedence over scene and HUD.
    for (const panel of this.registry.panels) {
      const mode = panel.handlePointerDown(this.registry.raycaster, pointer);
      if (mode) {
        this.downPointer = pointer;
        this.state = mode === 'drag' ? 'drag' : 'down';
        this.capturedPanel = mode === 'drag' ? panel : null;
        this.capturedMode = mode;
        return true;
      }
    }

    // Legacy HUD objects.
    if (this.registry.dispatchHudClick()) {
      return true;
    }

    // Scene selection fires on the down event.
    this.downPointer = pointer;
    this.state = 'down';
    if (this.onTriggerSelect) this.onTriggerSelect(pointer);
    return true;
  }

  /**
   * Move the pointer while a panel is being dragged.
   */
  move(pointer) {
    if (
      (this.state === 'drag' || this.state === 'down') &&
      this.capturedPanel &&
      this.downPointer === pointer
    ) {
      const ray = pointer.getRay(new THREE.Ray());
      this.registry.raycaster.ray.copy(ray);
      this.capturedPanel.handlePointerMove(this.registry.raycaster, pointer);
    }
  }

  /**
   * Release the pointer, ending any drag or down state.
   */
  release(pointer) {
    if (this.capturedPanel) {
      const ray = pointer.getRay(new THREE.Ray());
      this.registry.raycaster.ray.copy(ray);
      this.capturedPanel.handlePointerUp(this.registry.raycaster, pointer);
    }

    if (this.downPointer === pointer || this.capturedPanel) {
      this.capturedPanel = null;
      this.capturedMode = null;
      this.downPointer = null;
      this.state = 'idle';
    }
  }

  reset() {
    this.capturedPanel = null;
    this.capturedMode = null;
    this.downPointer = null;
    this.state = 'idle';
  }
}

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

import * as THREE from 'three';
import type { PanelLike, PanelManagerLike, PointerLike } from '../coordinators/types.ts';
import type { InteractableRegistry } from './InteractableRegistry.ts';

type PointerState = 'idle' | 'down' | 'drag';

interface PointerEventMachineOptions {
  panelManager?: PanelManagerLike | null;
  onTriggerSelect?: (pointer: PointerLike) => void;
}

export class PointerEventMachine {
  registry: InteractableRegistry;
  panelManager: PanelManagerLike | null;
  onTriggerSelect: (pointer: PointerLike) => void;

  state: PointerState = 'idle';
  downPointer: PointerLike | null = null;
  capturedPanel: PanelLike | null = null;
  capturedMode: string | null = null;

  constructor(
    registry: InteractableRegistry,
    { panelManager = null, onTriggerSelect = () => {} }: PointerEventMachineOptions = {}
  ) {
    this.registry = registry;
    this.panelManager = panelManager;
    this.onTriggerSelect = onTriggerSelect;
  }

  /**
   * Press the pointer. Returns true if the press was consumed by UI or scene.
   */
  press(pointer: PointerLike): boolean {
    const ray = pointer.getRay(new THREE.Ray());
    this.registry.raycaster.ray.copy(ray);

    // Launcher ring takes precedence when visible.
    if (this.panelManager?.isLauncherVisible?.()) {
      const hit = this.panelManager.handleLauncherHit?.(this.registry.raycaster);
      if (hit) return true;
    }

    // Panels take precedence over scene and HUD.
    for (const panel of this.registry.panels) {
      const mode = panel.handlePointerDown?.(this.registry.raycaster, pointer);
      if (mode) {
        this.downPointer = pointer;
        this.state = mode === 'drag' ? 'drag' : 'down';
        this.capturedPanel = panel;
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
    this.onTriggerSelect(pointer);
    return true;
  }

  /**
   * Move the pointer while a panel is being dragged.
   */
  move(pointer: PointerLike) {
    if (
      (this.state === 'drag' || this.state === 'down') &&
      this.capturedPanel &&
      this.downPointer === pointer
    ) {
      const ray = pointer.getRay(new THREE.Ray());
      this.registry.raycaster.ray.copy(ray);
      this.capturedPanel.handlePointerMove?.(this.registry.raycaster, pointer);
    }
  }

  /**
   * Release the pointer, ending any drag or down state.
   */
  release(pointer: PointerLike) {
    if (this.capturedPanel) {
      const ray = pointer.getRay(new THREE.Ray());
      this.registry.raycaster.ray.copy(ray);
      this.capturedPanel.handlePointerUp?.(this.registry.raycaster, pointer);
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

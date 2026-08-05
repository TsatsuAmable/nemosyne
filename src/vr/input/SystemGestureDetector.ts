/**
 * Detects system-level toggle gestures from both hands pinching or both
 * controller grips being pressed.
 *
 * The gesture fires once per press and is debounced by tracking the prior
 * combined state.
 */

import type { PointerRegistry } from './PointerRegistry.ts';

export class SystemGestureDetector {
  registry: PointerRegistry;
  onSystemToggle: (() => void) | null = null;

  private _lastGripSystemToggle = false;

  constructor(pointerRegistry: PointerRegistry) {
    this.registry = pointerRegistry;
  }

  /**
   * Check the current controller and hand states and fire `onSystemToggle` once
   * when a system gesture starts.
   */
  update(session: XRSession | null): { bothPinched: boolean } {
    if (!session || !session.inputSources) return { bothPinched: false };

    const sources = Array.from(session.inputSources);
    const bothPinched =
      this.registry.hands.length >= 2 &&
      this.registry.hands[0].isPinched?.() === true &&
      this.registry.hands[1].isPinched?.() === true;

    if (bothPinched && !this.registry.lastBothPinched && this.onSystemToggle) {
      this.onSystemToggle();
    }
    this.registry.lastBothPinched = bothPinched;

    // Controller buttons: trigger is handled by the pointer event machine;
    // here we only watch the grip for the system toggle.
    const gripStates: boolean[] = [];
    for (const controller of this.registry.controllers) {
      const source = this.registry.findSourceForController(controller, sources);
      if (!source?.gamepad?.buttons) {
        gripStates.push(false);
        continue;
      }

      const gripPressed = !!source.gamepad.buttons[1]?.pressed;
      this.registry.controllerGripPressed.set(controller, gripPressed);
      gripStates.push(gripPressed);
    }

    // System gesture on controllers: both grips pressed together. When only
    // one controller is available, a single grip works as a fallback.
    const bothGrips = gripStates.length >= 2 && gripStates.every(Boolean);
    const singleGrip = gripStates.length === 1 && gripStates[0];
    if ((bothGrips || singleGrip) && !this._lastGripSystemToggle && this.onSystemToggle) {
      this.onSystemToggle();
    }
    this._lastGripSystemToggle = bothGrips || singleGrip;

    return { bothPinched };
  }
}

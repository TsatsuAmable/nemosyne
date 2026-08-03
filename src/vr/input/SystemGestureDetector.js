/**
 * Detects system-level toggle gestures from both hands pinching or both
 * controller grips being pressed.
 *
 * The gesture fires once per press and is debounced by tracking the prior
 * combined state.
 */
export class SystemGestureDetector {
  constructor(pointerRegistry) {
    this.registry = pointerRegistry;
    this.onSystemToggle = null;

    this._lastGripSystemToggle = false;
  }

  /**
   * Check the current controller and hand states and fire `onSystemToggle` once
   * when a system gesture starts.
   *
   * @param {XRSession} session
   */
  update(session) {
    if (!session || !session.inputSources) return;

    const sources = Array.from(session.inputSources);
    const bothPinched =
      this.registry.hands.length >= 2 &&
      this.registry.hands[0].isPinched() &&
      this.registry.hands[1].isPinched();

    if (bothPinched && !this.registry.lastBothPinched && this.onSystemToggle) {
      this.onSystemToggle();
    }
    this.registry.lastBothPinched = bothPinched;

    // Controller buttons: trigger is handled by the pointer event machine;
    // here we only watch the grip for the system toggle.
    const gripStates = [];
    for (const controller of this.registry.controllers) {
      const source = this.registry.findSourceForController(controller, sources);
      if (!source || !source.gamepad || !source.gamepad.buttons) {
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

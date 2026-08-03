import * as THREE from 'three';

/**
 * Tracks registered controllers and hands, resolves the active pointer ray,
 * and maps XR input sources to controller button states.
 *
 * This class is intentionally focused on pointer bookkeeping so that
 * `InputRouter` can act as a high-level facade.
 */
export class PointerRegistry {
  constructor(engine) {
    this.engine = engine;

    this.controllers = [];
    this.hands = [];

    this.controllerTriggerPressed = new Map();
    this.controllerGripPressed = new Map();
    this.lastHandPinched = new Map();
    this.lastBothPinched = false;
  }

  addController(controller) {
    this.controllers.push(controller);
    this.controllerTriggerPressed.set(controller, false);
    this.controllerGripPressed.set(controller, false);

    controller.onSelect = (pointer) => {
      // Fallback event path; the primary path is polling.
      if (controller._fallbackSelect) controller._fallbackSelect(pointer);
    };
  }

  addHand(hand) {
    this.hands.push(hand);
    this.lastHandPinched.set(hand, false);

    hand.onPinchStart = (pointer) => {
      if (hand._fallbackPinchStart) hand._fallbackPinchStart(pointer);
    };
  }

  /**
   * Update each hand pointer for the current XR frame.
   */
  updateHands(frame, referenceSpace, session) {
    for (const hand of this.hands) {
      hand.update(frame, referenceSpace, session);
    }
  }

  /**
   * Hide controller placeholder rays when hand tracking is active. Quest Browser
   * reports both hand and controller input sources for the same tracked hands,
   * which would otherwise show two lasers.
   */
  updateControllerRayVisibilities() {
    const activeHand = this.getBestHand();
    for (const c of this.controllers) {
      if (c.setRayVisible) c.setRayVisible(!activeHand);
    }
  }

  /**
   * Return the best pointer ray for hover/scene raycasting, preferring a
   * tracked hand over controllers.
   */
  getBestPointerRay() {
    const activeHand = this.getBestHand();
    if (activeHand) {
      return activeHand.getRay(new THREE.Ray());
    }

    for (const c of this.controllers) {
      const ray = c.getRay(new THREE.Ray());
      if (Number.isFinite(ray.origin.x) && ray.direction.lengthSq() > 0) {
        return ray;
      }
    }

    return null;
  }

  /**
   * Return the pointer object that currently owns the best ray.
   */
  getActivePointerObject() {
    const activeHand = this.getBestHand();
    if (activeHand) return activeHand;
    for (const c of this.controllers) {
      const ray = c.getRay(new THREE.Ray());
      if (ray.direction.lengthSq() > 0 && Number.isFinite(ray.origin.x)) return c;
    }
    return null;
  }

  /**
   * Prefer a hand with a usable pose (live or last-known). A transient frame of
   * missing joints should not force the pointer back to a controller fallback
   * that may have no real pose on Quest Browser.
   */
  getBestHand() {
    for (const hand of this.hands) {
      const poseValid =
        typeof hand.isPoseValid === 'function'
          ? hand.isPoseValid()
          : hand.jointsValid && hand.ray?.visible;
      if (poseValid) {
        const ray = hand.getRay(new THREE.Ray());
        if (ray.direction.lengthSq() > 0) return hand;
      }
    }
    return null;
  }

  /**
   * Match a ControllerPointer to the XRInputSource that represents it.
   * Falls back to index order among non-hand sources if handedness is unknown.
   */
  findSourceForController(controller, sources) {
    if (controller.handedness && controller.handedness !== 'none') {
      const match = sources.find((s) => !s.hand && s.handedness === controller.handedness);
      if (match) return match;
    }
    const nonHand = sources.filter((s) => !s.hand);
    const idx = this.controllers.indexOf(controller);
    return nonHand[idx] ?? null;
  }

  /**
   * Return the current XR session input sources as a normal array.
   * XRInputSourceArray is array-like but may not implement Array methods.
   */
  getInputSources() {
    const session = this.engine.renderer.xr.getSession();
    return session && session.inputSources ? Array.from(session.inputSources) : [];
  }
}

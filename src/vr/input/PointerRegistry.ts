/**
 * Tracks registered controllers and hands, resolves the active pointer ray,
 * and maps XR input sources to controller button states.
 *
 * This class is intentionally focused on pointer bookkeeping so that
 * `InputRouter` can act as a high-level facade.
 */

import * as THREE from 'three';
import { PointerRayFilter } from './PointerRayFilter.ts';
import type { EngineLike, PointerLike } from '../coordinators/types.ts';

interface FallbackPointer extends PointerLike {
  _fallbackSelect?(pointer: PointerLike): void;
  _fallbackPinchStart?(pointer: PointerLike): void;
}

export class PointerRegistry {
  engine: EngineLike;

  controllers: PointerLike[] = [];
  hands: PointerLike[] = [];

  controllerTriggerPressed = new Map<PointerLike, boolean>();
  controllerGripPressed = new Map<PointerLike, boolean>();
  lastHandPinched = new Map<PointerLike, boolean>();
  lastBothPinched = false;

  smoothingEnabled = true;
  private _rayFilters = new Map<PointerLike, PointerRayFilter>();

  constructor(engine: EngineLike) {
    this.engine = engine;
  }

  addController(controller: PointerLike) {
    this.controllers.push(controller);
    this.controllerTriggerPressed.set(controller, false);
    this.controllerGripPressed.set(controller, false);

    const fallback = controller as FallbackPointer;
    controller.onSelect = (pointer: PointerLike) => {
      // Fallback event path; the primary path is polling.
      if (fallback._fallbackSelect) fallback._fallbackSelect(pointer);
    };
  }

  addHand(hand: PointerLike) {
    this.hands.push(hand);
    this.lastHandPinched.set(hand, false);

    const fallback = hand as FallbackPointer;
    hand.onPinchStart = (pointer: PointerLike) => {
      if (fallback._fallbackPinchStart) fallback._fallbackPinchStart(pointer);
    };
  }

  removeController(controller: PointerLike): void {
    const idx = this.controllers.indexOf(controller);
    if (idx >= 0) {
      this.controllers.splice(idx, 1);
    }
    this.controllerTriggerPressed.delete(controller);
    this.controllerGripPressed.delete(controller);
    this._rayFilters.delete(controller);
  }

  removeHand(hand: PointerLike): void {
    const idx = this.hands.indexOf(hand);
    if (idx >= 0) {
      this.hands.splice(idx, 1);
    }
    this.lastHandPinched.delete(hand);
    this._rayFilters.delete(hand);
  }

  getRayFilter(pointer: PointerLike): PointerRayFilter {
    let filter = this._rayFilters.get(pointer);
    if (!filter) {
      filter = new PointerRayFilter();
      this._rayFilters.set(pointer, filter);
    }
    return filter;
  }

  reset(): void {
    this.controllerTriggerPressed.clear();
    this.controllerGripPressed.clear();
    this.lastHandPinched.clear();
    this.lastBothPinched = false;
    this._rayFilters.forEach((f) => f.reset());
  }

  clear(): void {
    this.reset();
    this.controllers.length = 0;
    this.hands.length = 0;
    this._rayFilters.clear();
  }

  /**
   * Update each hand pointer for the current XR frame.
   */
  updateHands(
    frame: XRFrame | null,
    referenceSpace: XRReferenceSpace | null,
    session: XRSession | null
  ) {
    for (const hand of this.hands) {
      hand.update?.(frame, referenceSpace, session);
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
      c.setRayVisible?.(!activeHand);
    }
  }

  /**
   * Return the best pointer ray for hover/scene raycasting, preferring a
   * tracked hand over controllers. Applies adaptive jitter filtering when enabled.
   */
  getBestPointerRay(timestamp?: number): THREE.Ray | null {
    const activeHand = this.getBestHand();
    if (activeHand) {
      const ray = activeHand.getRay(new THREE.Ray());
      if (Number.isFinite(ray.origin.x) && ray.direction.lengthSq() > 0) {
        return this.smoothingEnabled ? this.getRayFilter(activeHand).filter(ray, timestamp) : ray;
      }
    }

    for (const c of this.controllers) {
      const ray = c.getRay(new THREE.Ray());
      if (Number.isFinite(ray.origin.x) && ray.direction.lengthSq() > 0) {
        return this.smoothingEnabled ? this.getRayFilter(c).filter(ray, timestamp) : ray;
      }
    }

    return null;
  }

  isBestPointerOverPanel(): boolean {
    const ray = this.getBestPointerRay();
    if (!ray || !this.engine.input?.raycaster || !this.engine.input.raycastPanels) return false;
    this.engine.input.raycaster.ray.copy(ray);
    const panelHit = this.engine.input.raycastPanels();
    return panelHit !== null && panelHit !== undefined;
  }

  /**
   * Return the pointer object that currently owns the best ray.
   */
  getActivePointerObject(): PointerLike | null {
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
  getBestHand(): PointerLike | null {
    for (const hand of this.hands) {
      const poseValid =
        typeof hand.isPoseValid === 'function'
          ? (hand.isPoseValid as () => boolean)()
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
  findSourceForController(controller: PointerLike, sources: XRInputSource[]): XRInputSource | null {
    if (!Array.isArray(sources)) return null;
    if (controller.handedness && controller.handedness !== 'none') {
      const match = sources.find(
        (s) => Boolean(s) && !s.hand && s.handedness === controller.handedness
      );
      if (match) return match;
    }
    const nonHand = sources.filter((s) => Boolean(s) && !s.hand);
    const idx = this.controllers.indexOf(controller);
    return nonHand[idx] ?? null;
  }

  /**
   * Return the current XR session input sources as a normal array.
   * XRInputSourceArray is array-like but may not implement Array methods.
   */
  getInputSources(): XRInputSource[] {
    const session = this.engine.renderer?.xr?.getSession?.();
    return session && session.inputSources ? Array.from(session.inputSources) : [];
  }
}

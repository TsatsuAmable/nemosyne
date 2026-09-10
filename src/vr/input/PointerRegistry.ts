/**
 * Tracks registered controllers and hands, resolves the active pointer ray,
 * and maps XR input sources to controller button states.
 *
 * This class is intentionally focused on pointer bookkeeping so that
 * `InputRouter` can act as a high-level facade.
 */

import * as THREE from 'three';
import { PointerRayFilter } from './PointerRayFilter.ts';
import { isUsablePointerRay } from './pointerRayValidity.ts';
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
  /** Scratch storage reused by synchronous pointer-authority queries. */
  private readonly _probeRay = new THREE.Ray();
  /** Ephemeral result returned by getBestPointerRay; callers must consume synchronously. */
  private readonly _bestRay = new THREE.Ray();

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

  /** Update each hand pointer for the current XR frame. */
  updateHands(
    frame: XRFrame | null,
    referenceSpace: XRReferenceSpace | null,
    session: XRSession | null
  ) {
    for (const hand of this.hands) {
      hand.update?.(frame, referenceSpace, session);
    }
  }

  /** Hide controller placeholder rays while a usable hand pointer is active. */
  updateControllerRayVisibilities() {
    const activeHand = this.getBestHand();
    for (const c of this.controllers) {
      c.setRayVisible?.(!activeHand);
    }
  }

  /**
   * Return the best usable pointer ray, preferring hands over controllers.
   *
   * The returned Ray is instance-owned scratch storage and is valid only until
   * the next pointer query. Production callers consume/copy it synchronously.
   */
  getBestPointerRay(timestamp?: number): THREE.Ray | null {
    const activeHand = this.getBestHand();
    if (activeHand) {
      const ray = activeHand.getRay(this._probeRay);
      if (isUsablePointerRay(ray)) {
        const resolved = this.smoothingEnabled
          ? this.getRayFilter(activeHand).filterInto(ray, this._bestRay, timestamp)
          : this._bestRay.copy(ray);
        if (isUsablePointerRay(resolved)) return resolved;
      }
    }

    for (const controller of this.controllers) {
      const ray = controller.getRay(this._probeRay);
      if (isUsablePointerRay(ray)) {
        const resolved = this.smoothingEnabled
          ? this.getRayFilter(controller).filterInto(ray, this._bestRay, timestamp)
          : this._bestRay.copy(ray);
        if (isUsablePointerRay(resolved)) return resolved;
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

  /** Return the pointer object that currently owns the best ray. */
  getActivePointerObject(): PointerLike | null {
    const activeHand = this.getBestHand();
    if (activeHand) return activeHand;
    for (const controller of this.controllers) {
      const ray = controller.getRay(this._probeRay);
      if (isUsablePointerRay(ray)) return controller;
    }
    return null;
  }

  /** Prefer a hand with a usable pose (live or last-known). */
  getBestHand(): PointerLike | null {
    for (const hand of this.hands) {
      const poseValid =
        typeof hand.isPoseValid === 'function'
          ? (hand.isPoseValid as () => boolean)()
          : hand.jointsValid && hand.ray?.visible;
      if (poseValid) {
        const ray = hand.getRay(this._probeRay);
        if (isUsablePointerRay(ray)) return hand;
      }
    }
    return null;
  }

  /**
   * Match a ControllerPointer to the XRInputSource that represents it.
   * Falls back to source order among non-hand sources if handedness is unknown.
   * Accepts array-like XRInputSource collections so the frame path need not
   * materialise XRSession.inputSources into a new Array.
   */
  findSourceForController(
    controller: PointerLike,
    sources: ArrayLike<XRInputSource>
  ): XRInputSource | null {
    if (!sources || typeof sources.length !== 'number') return null;
    if (controller.handedness && controller.handedness !== 'none') {
      for (let index = 0; index < sources.length; index += 1) {
        const source = sources[index];
        if (source && !source.hand && source.handedness === controller.handedness) return source;
      }
    }

    const controllerIndex = this.controllers.indexOf(controller);
    if (controllerIndex < 0) return null;
    let nonHandIndex = 0;
    for (let index = 0; index < sources.length; index += 1) {
      const source = sources[index];
      if (!source || source.hand) continue;
      if (nonHandIndex === controllerIndex) return source;
      nonHandIndex += 1;
    }
    return null;
  }

  /**
   * Match a HandPointer to its WebXR hand input source. Handedness is the
   * primary identity; source order is retained only for synthetic/unknown hosts.
   */
  findSourceForHand(hand: PointerLike, sources: ArrayLike<XRInputSource>): XRInputSource | null {
    if (!sources || typeof sources.length !== 'number') return null;
    if (hand.handedness && hand.handedness !== 'none') {
      for (let index = 0; index < sources.length; index += 1) {
        const source = sources[index];
        if (source?.hand && source.handedness === hand.handedness) return source;
      }
    }

    const handIndex = this.hands.indexOf(hand);
    if (handIndex < 0) return null;
    let sourceHandIndex = 0;
    for (let index = 0; index < sources.length; index += 1) {
      const source = sources[index];
      if (!source?.hand) continue;
      if (sourceHandIndex === handIndex) return source;
      sourceHandIndex += 1;
    }
    return null;
  }

  /** Return the current XR session input sources as a normal array. */
  getInputSources(): XRInputSource[] {
    const session = this.engine.renderer?.xr?.getSession?.();
    return session && session.inputSources ? Array.from(session.inputSources) : [];
  }
}

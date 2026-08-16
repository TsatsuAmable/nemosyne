/**
 * Detects system-level toggle gestures from both hands pinching or both
 * controller grips being pressed.
 *
 * The gesture fires once per press and is debounced by tracking the prior
 * combined state.
 */

import type { PointerRegistry } from './PointerRegistry.ts';

export interface SystemGestureTraceInfo {
  kind: 'both-pinch' | 'both-pinch-suppressed' | 'grips';
  y0?: number;
  y1?: number;
}

export class SystemGestureDetector {
  registry: PointerRegistry;
  onSystemToggle: (() => void) | null = null;
  onTrace: ((info: SystemGestureTraceInfo) => void) | null = null;

  private _lastGripSystemToggle = false;
  private _lastSuppressedBothPinched = false;
  private _bothPinchStartAt: number | null = null;
  private _lastBothPinchToggleAt = -Infinity;
  private _lastSystemToggleAt = -Infinity;
  private _gripStartAt: number | null = null;
  private readonly _bothPinchHoldMs: number;
  private readonly _toggleCooldownMs: number;
  private readonly _now: () => number;

  constructor(
    pointerRegistry: PointerRegistry,
    options: { bothPinchHoldMs?: number; toggleCooldownMs?: number; now?: () => number } = {}
  ) {
    this.registry = pointerRegistry;
    this._bothPinchHoldMs = options.bothPinchHoldMs ?? 400;
    this._toggleCooldownMs = options.toggleCooldownMs ?? 1000;
    this._now = options.now ?? (() => performance.now());
  }

  /**
   * Check the current controller and hand states and fire `onSystemToggle` once
   * when a system gesture starts. Suppress system gesture if hands are in a reach zone
   * (Y > 1.5m) to prevent Quest system gesture from blocking user grab input.
   */
  update(session: XRSession | null): { bothPinched: boolean; suppressSelection: boolean } {
    const sources = session?.inputSources ? Array.from(session.inputSources) : [];

    // Suppress system gesture when either hand is in a reach zone (high Y) to avoid
    // blocking user grab input in the upper interaction space.
    const origin0 = this.registry.hands[0]?.rayOrigin as unknown as { y?: number } | undefined;
    const origin1 = this.registry.hands[1]?.rayOrigin as unknown as { y?: number } | undefined;
    const systemGestureZoneSuppressed =
      this.registry.hands.length >= 2 &&
      origin0?.y !== undefined &&
      origin1?.y !== undefined &&
      (origin0.y > 1.5 || origin1.y > 1.5);

    const rawBothPinched =
      this.registry.hands.length >= 2 &&
      this.registry.hands[0].isPinched?.() === true &&
      this.registry.hands[1].isPinched?.() === true;
    const now = this._now();
    const pointerOverPanel = this.registry.isBestPointerOverPanel?.() ?? false;
    if (rawBothPinched && !systemGestureZoneSuppressed && !pointerOverPanel) {
      this._bothPinchStartAt ??= now;
    } else {
      this._bothPinchStartAt = null;
    }
    const bothPinched =
      rawBothPinched &&
      !systemGestureZoneSuppressed &&
      !pointerOverPanel &&
      this._bothPinchStartAt !== null &&
      now - this._bothPinchStartAt >= this._bothPinchHoldMs;
    const suppressSelection = rawBothPinched && !systemGestureZoneSuppressed && !pointerOverPanel;

    if (
      rawBothPinched &&
      systemGestureZoneSuppressed &&
      !this._lastSuppressedBothPinched &&
      origin0?.y !== undefined &&
      origin1?.y !== undefined
    ) {
      console.log(
        `[SystemGestureDetector] both-pinch suppressed in reach zone (y0=${origin0.y.toFixed(2)}, y1=${origin1.y.toFixed(2)})`
      );
      this.onTrace?.({
        kind: 'both-pinch-suppressed',
        y0: origin0.y,
        y1: origin1.y,
      });
    }
    this._lastSuppressedBothPinched = rawBothPinched && systemGestureZoneSuppressed;

    if (
      bothPinched &&
      !this.registry.lastBothPinched &&
      now - this._lastBothPinchToggleAt >= this._toggleCooldownMs &&
      now - this._lastSystemToggleAt >= this._toggleCooldownMs
    ) {
      console.log('[SystemGestureDetector] system toggle fired (both-pinch start)');
      this.onTrace?.({ kind: 'both-pinch' });
      this.onSystemToggle?.();
      this._lastBothPinchToggleAt = now;
      this._lastSystemToggleAt = now;
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
    const rawGrip = bothGrips || singleGrip;
    if (rawGrip && !pointerOverPanel) this._gripStartAt ??= now;
    else this._gripStartAt = null;
    // Keep the one-controller fallback responsive; paired grips still share the
    // panel, release, and cooldown gates with the hand gesture.
    const gripHeld = rawGrip && this._gripStartAt !== null;
    if (gripHeld && !this._lastGripSystemToggle && this.onSystemToggle && now - this._lastSystemToggleAt >= this._toggleCooldownMs) {
      console.log('[SystemGestureDetector] system toggle fired (controller grips)');
      this.onTrace?.({ kind: 'grips' });
      this.onSystemToggle();
      this._lastSystemToggleAt = now;
    }
    this._lastGripSystemToggle = gripHeld;

    return { bothPinched, suppressSelection };
  }
}

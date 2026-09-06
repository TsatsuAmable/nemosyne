/**
 * Detects system-level toggle gestures from both hands selecting or both
 * controller grips being pressed.
 *
 * Commodity WebXR button/profile state is supplied by XRInputProvider when
 * available. Nemosyne retains only the semantic/context policy and an explicit
 * legacy fallback for runtimes that do not expose a compatible profile.
 */

import type { PointerRegistry } from './PointerRegistry.ts';
import type { XRInputProvider } from './XRInputProvider.ts';
import type { PointerLike } from '../coordinators/types.ts';

export interface SystemGestureTraceInfo {
  kind: 'both-pinch' | 'both-pinch-suppressed' | 'grips';
  y0?: number;
  y1?: number;
}

export class SystemGestureDetector {
  registry: PointerRegistry;
  onSystemToggle: (() => void) | null = null;
  onTrace: ((info: SystemGestureTraceInfo) => void) | null = null;
  onSuppressedHint: ((hint: string) => void) | null;

  private readonly _inputProvider: XRInputProvider | null;
  private _lastRawBothPinched = false;
  private _invalidBothPinchHeld = false;
  private _lastRawGrip = false;
  private _invalidGripHeld = false;
  private _lastSuppressedBothPinched = false;
  private _bothPinchStartAt: number | null = null;
  private _lastBothPinchToggleAt = -Infinity;
  private _lastSystemToggleAt = -Infinity;
  private readonly _bothPinchHoldMs: number;
  private readonly _toggleCooldownMs: number;
  /**
   * Hand height (ray-origin Y, metres) above which both-pinch is treated as
   * a reach-zone conflict with the Quest OS gesture and the system toggle
   * is withheld. Tunable for calibration; the 1.5 default is frozen pending
   * trace evidence (no documented rationale yet).
   */
  private readonly _reachZoneY: number;
  private readonly _now: () => number;

  constructor(
    pointerRegistry: PointerRegistry,
    options: {
      bothPinchHoldMs?: number;
      toggleCooldownMs?: number;
      reachZoneY?: number;
      now?: () => number;
      inputProvider?: XRInputProvider | null;
    } = {}
  ) {
    this.registry = pointerRegistry;
    this._inputProvider = options.inputProvider ?? null;
    this._bothPinchHoldMs = options.bothPinchHoldMs ?? 400;
    this._toggleCooldownMs = options.toggleCooldownMs ?? 1000;
    const reachZoneY = options.reachZoneY ?? 1.5;
    if (!Number.isFinite(reachZoneY)) {
      throw new RangeError('reachZoneY must be a finite number');
    }
    this._reachZoneY = reachZoneY;
    this._now = options.now ?? (() => performance.now());

    // Production-default guidance sink. PointerRegistry owns the live Engine,
    // whose UI manager is attached later by World. Resolve it at call time so
    // construction order does not make the callback permanently dead. Tests
    // and specialized hosts may still replace `onSuppressedHint` explicitly.
    this.onSuppressedHint = (hint) => {
      const engine = (
        this.registry as unknown as {
          engine?: {
            uiManager?: {
              interactionCoach?: {
                log?: (entry: { action: string; result: string }) => void;
              } | null;
            } | null;
          };
        }
      ).engine;
      engine?.uiManager?.interactionCoach?.log?.({
        action: 'System gesture blocked',
        result: hint,
      });
    };
  }

  /** Return the semantic gesture state machine to a neutral XR-session boundary. */
  reset(): void {
    this._lastRawBothPinched = false;
    this._invalidBothPinchHeld = false;
    this._lastRawGrip = false;
    this._invalidGripHeld = false;
    this._lastSuppressedBothPinched = false;
    this._bothPinchStartAt = null;
    this._lastBothPinchToggleAt = -Infinity;
    this._lastSystemToggleAt = -Infinity;
    this.registry.lastBothPinched = false;
  }

  private _handSelectPressed(hand: PointerLike, sources: XRInputSource[]): boolean {
    const source = this.registry.findSourceForHand(hand, sources);
    const normalized = this._inputProvider?.getSelect(source);
    if (normalized?.available) return normalized.pressed;
    return hand.isPinched?.() === true;
  }

  private _controllerSqueezePressed(
    controller: PointerLike,
    sources: XRInputSource[]
  ): boolean {
    const source = this.registry.findSourceForController(controller, sources);
    const normalized = this._inputProvider?.getSqueeze(source);
    if (normalized?.available) return normalized.pressed;
    return !!source?.gamepad?.buttons?.[1]?.pressed;
  }

  /**
   * Check the current controller and hand states and fire `onSystemToggle` once
   * when a system gesture starts. Suppress system gesture if hands are in a reach zone
   * (Y above the configured threshold) to prevent Quest system gesture from
   * blocking user grab input.
   */
  update(session: XRSession | null): { bothPinched: boolean; suppressSelection: boolean } {
    const sources = session?.inputSources ? Array.from(session.inputSources) : [];

    const origin0 = this.registry.hands[0]?.rayOrigin as unknown as { y?: number } | undefined;
    const origin1 = this.registry.hands[1]?.rayOrigin as unknown as { y?: number } | undefined;
    const systemGestureZoneSuppressed =
      this.registry.hands.length >= 2 &&
      origin0?.y !== undefined &&
      origin1?.y !== undefined &&
      (origin0.y > this._reachZoneY || origin1.y > this._reachZoneY);

    const rawBothPinched =
      this.registry.hands.length >= 2 &&
      this._handSelectPressed(this.registry.hands[0], sources) &&
      this._handSelectPressed(this.registry.hands[1], sources);
    const now = this._now();
    const pointerOverPanel = this.registry.isBestPointerOverPanel?.() ?? false;

    if (rawBothPinched && !this._lastRawBothPinched) {
      this._invalidBothPinchHeld = systemGestureZoneSuppressed || pointerOverPanel;
    } else if (!rawBothPinched) {
      this._invalidBothPinchHeld = false;
    }
    this._lastRawBothPinched = rawBothPinched;

    const validPinchAttempt =
      rawBothPinched &&
      !systemGestureZoneSuppressed &&
      !pointerOverPanel &&
      !this._invalidBothPinchHeld;

    if (validPinchAttempt) {
      this._bothPinchStartAt ??= now;
    } else {
      this._bothPinchStartAt = null;
    }

    const bothPinched =
      validPinchAttempt &&
      this._bothPinchStartAt !== null &&
      now - this._bothPinchStartAt >= this._bothPinchHoldMs;
    const suppressSelection = validPinchAttempt;

    if (
      rawBothPinched &&
      systemGestureZoneSuppressed &&
      !this._lastSuppressedBothPinched &&
      origin0?.y !== undefined &&
      origin1?.y !== undefined
    ) {
      console.warn(
        `[SystemGestureDetector] both-pinch suppressed in reach zone (y0=${origin0.y.toFixed(2)}, y1=${origin1.y.toFixed(2)})`
      );
      this.onTrace?.({
        kind: 'both-pinch-suppressed',
        y0: origin0.y,
        y1: origin1.y,
      });
      this.onSuppressedHint?.(
        'Both-pinch unavailable in the upper reach zone. Lower both hands and pinch again.'
      );
    }
    this._lastSuppressedBothPinched = rawBothPinched && systemGestureZoneSuppressed;

    if (
      bothPinched &&
      !this.registry.lastBothPinched &&
      now - this._lastBothPinchToggleAt >= this._toggleCooldownMs &&
      now - this._lastSystemToggleAt >= this._toggleCooldownMs
    ) {
      console.warn('[SystemGestureDetector] system toggle fired (both-pinch start)');
      this.onTrace?.({ kind: 'both-pinch' });
      this.onSystemToggle?.();
      this._lastBothPinchToggleAt = now;
      this._lastSystemToggleAt = now;
    }
    this.registry.lastBothPinched = bothPinched;

    const gripStates: boolean[] = [];
    for (const controller of this.registry.controllers) {
      const gripPressed = this._controllerSqueezePressed(controller, sources);
      this.registry.controllerGripPressed.set(controller, gripPressed);
      gripStates.push(gripPressed);
    }

    const bothGrips = gripStates.length >= 2 && gripStates.every(Boolean);
    const singleGrip = gripStates.length === 1 && gripStates[0];
    const rawGrip = bothGrips || singleGrip;

    if (rawGrip && !this._lastRawGrip) {
      this._invalidGripHeld = pointerOverPanel;
    } else if (!rawGrip) {
      this._invalidGripHeld = false;
    }

    if (
      rawGrip &&
      !this._lastRawGrip &&
      !pointerOverPanel &&
      !this._invalidGripHeld &&
      this.onSystemToggle &&
      now - this._lastSystemToggleAt >= this._toggleCooldownMs
    ) {
      console.warn('[SystemGestureDetector] system toggle fired (controller grips)');
      this.onTrace?.({ kind: 'grips' });
      this.onSystemToggle();
      this._lastSystemToggleAt = now;
    }
    this._lastRawGrip = rawGrip;

    return { bothPinched, suppressSelection };
  }
}

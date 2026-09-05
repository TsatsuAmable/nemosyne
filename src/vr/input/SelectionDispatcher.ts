/**
 * Dispatches selection events, drives hover/selection audio-haptic feedback, and
 * supports dwell (gaze/pinch-and-hold) selection as a motor accessibility aid.
 */

import * as THREE from 'three';
import { SelectionFeedback } from '../audio/SelectionFeedback.ts';
import type { PanelLike, PointerLike } from '../coordinators/types.ts';
import type {
  InteractableEntry,
  InteractableRegistry,
  PanelHit,
  SceneHit,
} from './InteractableRegistry.ts';
import { isUsablePointerRay } from './pointerRayValidity.ts';

type DwellTarget =
  | { type: 'panel'; value: PanelLike }
  | { type: 'scene'; value: InteractableEntry };

export interface SelectionDispatchStartInfo {
  hudConsumed: boolean;
  sceneMesh: THREE.Object3D | null;
  sceneData?: unknown;
  pointer: PointerLike | null;
  /**
   * Whether the selecting pointer produced a finite, non-degenerate ray.
   * Lets traces separate tracking-loss misses from aimed misses.
   */
  rayValid: boolean;
}

export interface SelectionDispatchInfo extends SelectionDispatchStartInfo {
  /** True only when a scene/global selection callback completed successfully. */
  hadCallback: boolean;
}

export class SelectionDispatcher {
  registry: InteractableRegistry;
  onSelectCallback: ((ray: THREE.Ray) => void) | null;
  /**
   * Fires after HUD/target resolution but before scene/global callbacks. This
   * gives evidence sinks one pre-action snapshot boundary without weakening the
   * outcome truthfulness of `onDispatch`.
   */
  onDispatchStart: ((info: SelectionDispatchStartInfo) => void) | null = null;
  /** Fires only after the observable selection outcome is known. */
  onDispatch: ((info: SelectionDispatchInfo) => void) | null = null;

  feedback: SelectionFeedback;

  dwellSelection = false;
  private _dwellThreshold = 1200;
  private _dwellTimer: ReturnType<typeof setTimeout> | null = null;
  private _dwellTarget: string | null = null;

  private _pinchLockTarget: InteractableEntry | null = null;
  private _pinchLockExpiry = 0;

  constructor(
    registry: InteractableRegistry,
    { onSelectCallback = null }: { onSelectCallback?: ((ray: THREE.Ray) => void) | null } = {}
  ) {
    this.registry = registry;
    this.onSelectCallback = onSelectCallback;

    this.feedback = new SelectionFeedback();
  }

  /**
   * Lock the currently hovered target entry for a short window (e.g. 80ms)
   * so that physical index-thumb pinch recoil drift (UX-002) does not cause
   * misclicks on release.
   */
  lockTargetForPinch(durationMs = 80): void {
    if (this.registry.hovered) {
      this._pinchLockTarget = this.registry.hovered;
      this._pinchLockExpiry = performance.now() + durationMs;
    }
  }

  clearPinchLock(): void {
    this._pinchLockTarget = null;
    this._pinchLockExpiry = 0;
  }

  setOnSelectCallback(cb: ((ray: THREE.Ray) => void) | null) {
    this.onSelectCallback = cb;
  }

  setDwellSelection(enabled: boolean, thresholdMs = 1200) {
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
   * active pointer, honoring pinch recoil lock when active.
   *
   * The start hook fires before scene/global callbacks. Outcome telemetry fires
   * after callbacks complete, so `hadCallback` is an observed outcome rather
   * than a pre-dispatch guess; a callback that throws cannot be recorded as a
   * successful callback-only hit.
   */
  triggerSelect(activePointer: PointerLike | null) {
    if (!activePointer) return;
    const ray = activePointer.getRay(new THREE.Ray());
    this.registry.raycaster.ray.copy(ray);
    const rayValid = isUsablePointerRay(ray);

    this.feedback.playSelect();
    this.feedback.flashPointer(activePointer);
    this.feedback.playHaptic(
      0.6,
      40,
      activePointer as unknown as {
        gamepad?: {
          hapticActuators?: Array<{ pulse: (v: number, d: number) => Promise<unknown> }>;
        };
      }
    );

    const hudConsumed = this.registry.dispatchHudClick();
    const effectiveHovered =
      this._pinchLockTarget && performance.now() < this._pinchLockExpiry
        ? this._pinchLockTarget
        : this.registry.hovered;
    const startInfo: SelectionDispatchStartInfo = {
      hudConsumed,
      sceneMesh: hudConsumed ? null : effectiveHovered?.mesh ?? null,
      sceneData: hudConsumed ? undefined : effectiveHovered?.data,
      pointer: activePointer,
      rayValid,
    };

    this.onDispatchStart?.(startInfo);

    if (hudConsumed) {
      this.onDispatch?.({ ...startInfo, hadCallback: false });
      return;
    }

    let callbackCompleted = false;
    if (effectiveHovered?.onSelect) {
      effectiveHovered.onSelect(effectiveHovered.mesh, effectiveHovered.data);
      callbackCompleted = true;
    }

    if (this.onSelectCallback) {
      this.onSelectCallback(ray);
      callbackCompleted = true;
    }

    this.onDispatch?.({ ...startInfo, hadCallback: callbackCompleted });
    this.clearPinchLock();
  }

  /**
   * Update dwell selection state from the current panel hit and scene entry.
   * `sceneHit` is the object returned by `InteractableRegistry.raycastScene()`.
   */
  private _dwellStartTime = 0;

  updateDwell(
    panelHit: PanelHit | null,
    sceneHit: SceneHit | null,
    activePointer: PointerLike | null
  ) {
    if (!this.dwellSelection || !activePointer) return;

    const sceneEntry = sceneHit?.entry ?? null;
    const target: DwellTarget | null = panelHit
      ? { type: 'panel', value: panelHit.panel }
      : sceneEntry
        ? { type: 'scene', value: sceneEntry }
        : null;

    const targetId = target
      ? `${target.type}:${target.value.mesh?.uuid ?? String(target.value)}`
      : null;

    if (targetId !== this._dwellTarget) {
      if (this._dwellTarget && this._dwellStartTime > 0) {
        const duration = Date.now() - this._dwellStartTime;
        this.registry.engine?.telemetry?.recordDwell?.(this._dwellTarget, duration, false);
      }

      this._dwellTarget = targetId;
      this._dwellStartTime = Date.now();
      if (this._dwellTimer) clearTimeout(this._dwellTimer);
      if (!targetId || !target) return;

      const dwellTarget = target;
      this._dwellTimer = setTimeout(() => {
        const duration = Date.now() - this._dwellStartTime;
        this.registry.engine?.telemetry?.recordDwell?.(targetId, duration, true);
        if (dwellTarget.type === 'panel') {
          dwellTarget.value.handlePointerDown?.(this.registry.raycaster, activePointer);
        } else if (dwellTarget.value.onSelect) {
          dwellTarget.value.onSelect(dwellTarget.value.mesh, dwellTarget.value.data);
        }
      }, this._dwellThreshold ?? 1200);
    }
  }
}

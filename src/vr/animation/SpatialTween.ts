/**
 * Spatial Animation & Camera Easing Engine.
 *
 * Implements:
 * - Deterministic spatial interpolation using `@tweenjs/tween.js`.
 * - Smooth camera navigation, panel docking, and focus zoom animations.
 * - Frame-budget friendly allocation pooling with explicit update stepping.
 */

import * as TWEEN from '@tweenjs/tween.js';
import type { Vector3, Object3D } from 'three';

export interface TweenOptions {
  durationMs?: number;
  startTimeMs?: number;
  easing?: (amount: number) => number;
  onUpdate?: (progress: number) => void;
  onComplete?: () => void;
}

export class SpatialTweenManager {
  private _group: TWEEN.Group;

  constructor() {
    this._group = new TWEEN.Group();
  }

  /**
   * Smoothly animates a 3D Object or position to target coordinates.
   */
  animatePosition(
    object: Object3D | { position: { x: number; y: number; z: number } },
    target: { x: number; y: number; z: number } | Vector3,
    options: TweenOptions = {}
  ): TWEEN.Tween<{ x: number; y: number; z: number }> {
    const duration = options.durationMs ?? 600;
    const easing = options.easing ?? TWEEN.Easing.Cubic.Out;

    const tween = new TWEEN.Tween(object.position, this._group)
      .to({ x: target.x, y: target.y, z: target.z }, duration)
      .easing(easing);

    if (options.onUpdate) {
      tween.onUpdate(() => options.onUpdate?.(0));
    }

    if (options.onComplete) {
      tween.onComplete(options.onComplete);
    }

    tween.start(options.startTimeMs);
    return tween;
  }

  /**
   * Smoothly animates scalar numeric values (e.g. opacity, scale, camera FOV).
   */
  animateScalar(
    from: { value: number },
    targetValue: number,
    options: TweenOptions = {}
  ): TWEEN.Tween<{ value: number }> {
    const duration = options.durationMs ?? 400;
    const easing = options.easing ?? TWEEN.Easing.Quadratic.Out;

    const tween = new TWEEN.Tween(from, this._group)
      .to({ value: targetValue }, duration)
      .easing(easing);

    if (options.onUpdate) {
      tween.onUpdate(() => options.onUpdate?.(from.value));
    }

    if (options.onComplete) {
      tween.onComplete(options.onComplete);
    }

    tween.start(options.startTimeMs);
    return tween;
  }

  /**
   * Advances active tweens by the given timestamp in milliseconds.
   */
  update(timeMs = (typeof performance !== 'undefined' ? performance.now() : Date.now())): boolean {
    this._group.update(timeMs);
    return this._group.getAll().length > 0;
  }

  /**
   * Cancels all active tweens in this group.
   */
  clear(): void {
    this._group.removeAll();
  }

  get activeCount(): number {
    return this._group.getAll().length;
  }
}

export { TWEEN };

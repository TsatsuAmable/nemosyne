/**
 * PointerRayFilter — Adaptive jitter dampening and aim-drift suppression for WebXR rays.
 *
 * Implements an adaptive filter (1€ Filter derivative) over 3D ray origin and direction.
 * At low velocity (precision pointing / dwell), high smoothing eliminates physiological
 * micro-tremor and sensor noise. At high velocity (fast sweeps / saccades), smoothing
 * decreases to eliminate perceptible tracking lag.
 */

import * as THREE from 'three';

export interface PointerRayFilterConfig {
  /** Minimum cutoff frequency for smoothing (lower = smoother when slow). */
  minCutoff: number;
  /** Speed coefficient for adapting cutoff to velocity (higher = less lag when fast). */
  beta: number;
  /** Derivative cutoff frequency. */
  dCutoff: number;
}

const DEFAULT_CONFIG: PointerRayFilterConfig = {
  minCutoff: 1.0,
  beta: 0.5,
  dCutoff: 1.0,
};

class LowPassFilter3D {
  private _hatx: THREE.Vector3 | null = null;

  filter(val: THREE.Vector3, alpha: number): THREE.Vector3 {
    if (!this._hatx) {
      this._hatx = val.clone();
      return this._hatx.clone();
    }
    this._hatx.lerp(val, alpha);
    return this._hatx.clone();
  }

  hasLast(): boolean {
    return this._hatx !== null;
  }

  last(): THREE.Vector3 {
    return this._hatx ? this._hatx.clone() : new THREE.Vector3();
  }

  reset(): void {
    this._hatx = null;
  }
}

function calculateAlpha(rate: number, cutoff: number): number {
  const tau = 1.0 / (2 * Math.PI * cutoff);
  const te = 1.0 / rate;
  return 1.0 / (1.0 + tau / te);
}

export class PointerRayFilter {
  private _config: PointerRayFilterConfig;
  private _xFilter = new LowPassFilter3D();
  private _dxFilter = new LowPassFilter3D();
  private _dFilter = new LowPassFilter3D();
  private _ddFilter = new LowPassFilter3D();
  private _lastTime: number | null = null;

  constructor(config: Partial<PointerRayFilterConfig> = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Filter an input THREE.Ray and return a smoothed copy.
   */
  filter(ray: THREE.Ray, timestamp: number = performance.now()): THREE.Ray {
    if (this._lastTime === null || timestamp <= this._lastTime) {
      this._lastTime = timestamp;
      this._xFilter.filter(ray.origin, 1.0);
      this._dFilter.filter(ray.direction, 1.0);
      return new THREE.Ray(ray.origin.clone(), ray.direction.clone().normalize());
    }

    const dt = (timestamp - this._lastTime) / 1000.0;
    this._lastTime = timestamp;
    const rate = 1.0 / Math.max(dt, 0.001);

    // Filter origin
    const prevOrigin = this._xFilter.last();
    const dOrigin = new THREE.Vector3().subVectors(ray.origin, prevOrigin).multiplyScalar(rate);
    const edOrigin = this._dxFilter.filter(dOrigin, calculateAlpha(rate, this._config.dCutoff));
    const originSpeed = edOrigin.length();
    const originCutoff = this._config.minCutoff + this._config.beta * originSpeed;
    const filteredOrigin = this._xFilter.filter(ray.origin, calculateAlpha(rate, originCutoff));

    // Filter direction
    const prevDir = this._dFilter.last();
    const dDir = new THREE.Vector3().subVectors(ray.direction, prevDir).multiplyScalar(rate);
    const edDir = this._ddFilter.filter(dDir, calculateAlpha(rate, this._config.dCutoff));
    const dirSpeed = edDir.length();
    const dirCutoff = this._config.minCutoff + this._config.beta * dirSpeed;
    const filteredDir = this._dFilter.filter(ray.direction, calculateAlpha(rate, dirCutoff));
    filteredDir.normalize();

    return new THREE.Ray(filteredOrigin, filteredDir);
  }

  reset(): void {
    this._xFilter.reset();
    this._dxFilter.reset();
    this._dFilter.reset();
    this._ddFilter.reset();
    this._lastTime = null;
  }
}

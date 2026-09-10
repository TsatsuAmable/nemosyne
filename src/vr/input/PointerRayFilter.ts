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
  private readonly _hatx = new THREE.Vector3();
  private _initialized = false;

  filterInto(val: THREE.Vector3, alpha: number, target: THREE.Vector3): THREE.Vector3 {
    if (!this._initialized) {
      this._hatx.copy(val);
      this._initialized = true;
    } else {
      this._hatx.lerp(val, alpha);
    }
    return target.copy(this._hatx);
  }

  lastInto(target: THREE.Vector3): THREE.Vector3 {
    return this._initialized ? target.copy(this._hatx) : target.set(0, 0, 0);
  }

  reset(): void {
    this._hatx.set(0, 0, 0);
    this._initialized = false;
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
  private readonly _prevOrigin = new THREE.Vector3();
  private readonly _originDerivative = new THREE.Vector3();
  private readonly _filteredOriginDerivative = new THREE.Vector3();
  private readonly _prevDirection = new THREE.Vector3();
  private readonly _directionDerivative = new THREE.Vector3();
  private readonly _filteredDirectionDerivative = new THREE.Vector3();

  constructor(config: Partial<PointerRayFilterConfig> = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Filter into caller-owned storage. The returned object is `target`.
   * This is the steady-state XR path and allocates no vectors or rays.
   */
  filterInto(ray: THREE.Ray, target: THREE.Ray, timestamp: number = performance.now()): THREE.Ray {
    if (this._lastTime === null || timestamp <= this._lastTime) {
      this._lastTime = timestamp;
      this._xFilter.filterInto(ray.origin, 1.0, target.origin);
      this._dFilter.filterInto(ray.direction, 1.0, target.direction);
      target.direction.normalize();
      return target;
    }

    const dt = (timestamp - this._lastTime) / 1000.0;
    this._lastTime = timestamp;
    const rate = 1.0 / Math.max(dt, 0.001);

    this._xFilter.lastInto(this._prevOrigin);
    this._originDerivative.subVectors(ray.origin, this._prevOrigin).multiplyScalar(rate);
    this._dxFilter.filterInto(
      this._originDerivative,
      calculateAlpha(rate, this._config.dCutoff),
      this._filteredOriginDerivative
    );
    const originCutoff =
      this._config.minCutoff + this._config.beta * this._filteredOriginDerivative.length();
    this._xFilter.filterInto(ray.origin, calculateAlpha(rate, originCutoff), target.origin);

    this._dFilter.lastInto(this._prevDirection);
    this._directionDerivative.subVectors(ray.direction, this._prevDirection).multiplyScalar(rate);
    this._ddFilter.filterInto(
      this._directionDerivative,
      calculateAlpha(rate, this._config.dCutoff),
      this._filteredDirectionDerivative
    );
    const directionCutoff =
      this._config.minCutoff + this._config.beta * this._filteredDirectionDerivative.length();
    this._dFilter.filterInto(
      ray.direction,
      calculateAlpha(rate, directionCutoff),
      target.direction
    );
    target.direction.normalize();
    return target;
  }

  /** Filter an input ray and return an independent smoothed copy. */
  filter(ray: THREE.Ray, timestamp: number = performance.now()): THREE.Ray {
    return this.filterInto(ray, new THREE.Ray(), timestamp);
  }

  reset(): void {
    this._xFilter.reset();
    this._dxFilter.reset();
    this._dFilter.reset();
    this._ddFilter.reset();
    this._lastTime = null;
  }
}

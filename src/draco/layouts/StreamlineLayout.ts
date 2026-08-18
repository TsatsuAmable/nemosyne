import * as THREE from 'three';
import { LayoutBase } from './LayoutBase.ts';
import { SeededRandom } from '../../utils/SeededRandom.ts';
import type { LayoutEntry, StreamlineEntry, StreamlineOptions } from '../types.ts';
import { computeStreamline3d } from '../../wasm/RuntimeBridge.ts';

/**
 * Generate vector-field streamlines as Catmull-Rom curves.
 *
 * Each row is expected to have vector components (u/v/w or x/y/z) and a
 * magnitude. The layout emits a path of points per streamline.
 */
export class StreamlineLayout extends LayoutBase {
  static compute<T = Record<string, unknown>>(
    rows: T[] = [],
    options: StreamlineOptions = {}
  ): LayoutEntry<T>[] {
    const {
      count = Math.min(30, Math.max(8, rows.length)),
      steps = 3,
      stepSize = 2,
      bounds = { x: [-5, 5], y: [0.5, 4], z: [-8, -2] },
      seed = 1,
    } = options;

    const out: StreamlineEntry<T>[] = [];
    const wasmPositions = computeStreamline3d(count, steps, stepSize, seed);

    if (wasmPositions && wasmPositions.length === count * (steps + 1) * 3) {
      let offset = 0;
      for (let i = 0; i < count; i++) {
        const points: THREE.Vector3[] = [];
        for (let s = 0; s <= steps; s++) {
          points.push(
            new THREE.Vector3(
              wasmPositions[offset + 0],
              wasmPositions[offset + 1],
              wasmPositions[offset + 2]
            )
          );
          offset += 3;
        }
        out.push({
          position: points[0].clone(),
          points,
          row: rows[i] ?? ({} as T),
          index: i,
        });
      }
      return out;
    }

    const rng = new SeededRandom(seed);

    for (let i = 0; i < count; i++) {
      const start = new THREE.Vector3(
        rng.range(bounds.x[0], bounds.x[1]),
        rng.range(bounds.y[0], bounds.y[1]),
        rng.range(bounds.z[0], bounds.z[1])
      );
      const points: THREE.Vector3[] = [start.clone()];

      for (let s = 0; s < steps; s++) {
        const prev = points[points.length - 1];
        const dir = new THREE.Vector3(
          Math.sin(prev.z * 0.7 + i) * 0.8,
          0.2 + Math.cos(prev.x * 0.5 + i) * 0.2,
          -0.6 + Math.sin(prev.y * 0.9 + i) * 0.3
        ).normalize();
        points.push(prev.clone().add(dir.multiplyScalar(stepSize)));
      }

      out.push({
        position: points[0].clone(),
        points,
        row: rows[i] ?? ({} as T),
        index: i,
      });
    }

    return out;
  }
}

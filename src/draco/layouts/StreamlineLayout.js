import * as THREE from 'three';
import { LayoutBase } from './LayoutBase.js';
import { SeededRandom } from '../../utils/SeededRandom.js';

/**
 * Generate vector-field streamlines as Catmull-Rom curves.
 *
 * Each row is expected to have vector components (u/v/w or x/y/z) and a
 * magnitude. The layout emits a path of points per streamline.
 */
export class StreamlineLayout extends LayoutBase {
  static compute(rows = [], options = {}) {
    const {
      count = Math.min(30, Math.max(8, rows.length)),
      steps = 3,
      stepSize = 2,
      bounds = { x: [-5, 5], y: [0.5, 4], z: [-8, -2] },
      seed = 1,
    } = options;

    const rng = new SeededRandom(seed);
    const out = [];

    for (let i = 0; i < count; i++) {
      const start = new THREE.Vector3(
        rng.range(bounds.x[0], bounds.x[1]),
        rng.range(bounds.y[0], bounds.y[1]),
        rng.range(bounds.z[0], bounds.z[1])
      );
      const points = [start.clone()];

      for (let s = 0; s < steps; s++) {
        const prev = points[points.length - 1];
        // Deterministic pseudo-vector field: curl-noise-ish direction.
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
        row: rows[i] ?? {},
        index: i,
      });
    }

    return out;
  }
}

import * as THREE from 'three';
import { LayoutBase } from './LayoutBase.ts';
import type { DatasetEdge } from '../../data/Dataset.ts';
import type { ForceDirectedOptions, LayoutEntry } from '../types.ts';

/**
 * Simple iterative force-directed layout in 3D.
 *
 * Supports optional edge list; if omitted, nodes repel only.
 * Returns positions centered near the origin at y ~ 1.2.
 */
export class ForceDirected3D extends LayoutBase {
  static compute<T = Record<string, unknown>>(
    rows: T[] = [],
    options: ForceDirectedOptions = {}
  ): LayoutEntry<T>[] {
    const {
      edges = [] as DatasetEdge[],
      iterations = 120,
      repulsion = 120,
      attraction = 0.02,
      damping = 0.08,
      radius = 4,
      yOffset = 1.2,
      seed = 1,
    } = options;

    const n = rows.length || 1;

    const positions: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const phi = Math.acos(-1 + (2 * i) / Math.max(1, n - 1));
      const theta = Math.sqrt(n * Math.PI) * phi + seed * 0.1;
      positions.push(
        new THREE.Vector3(
          radius * Math.cos(theta) * Math.sin(phi),
          radius * Math.sin(theta) * Math.sin(phi) + yOffset,
          radius * Math.cos(phi)
        )
      );
    }

    const velocities = positions.map(() => new THREE.Vector3());

    const edgePairs: [number, number, number][] = [];
    for (const e of edges) {
      const src = rows.findIndex((r) => this.rowId(r as Record<string, unknown>) === e.source);
      const dst = rows.findIndex((r) => this.rowId(r as Record<string, unknown>) === e.target);
      if (src >= 0 && dst >= 0) edgePairs.push([src, dst, e.weight ?? 1]);
    }

    const tmp = new THREE.Vector3();

    for (let it = 0; it < iterations; it++) {
      const forces = positions.map(() => new THREE.Vector3());

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          tmp.subVectors(positions[i], positions[j]);
          const distSq = tmp.lengthSq();
          if (distSq < 1e-6) {
            tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
          }
          const f = repulsion / (distSq + 0.1);
          tmp.normalize().multiplyScalar(f);
          forces[i].add(tmp);
          forces[j].sub(tmp);
        }
      }

      for (const [src, dst, weight] of edgePairs) {
        tmp.subVectors(positions[dst], positions[src]);
        const edgeDist = tmp.length();
        const f = attraction * (edgeDist - 2.5) * weight;
        tmp.normalize().multiplyScalar(f);
        forces[src].add(tmp);
        forces[dst].sub(tmp);
      }

      for (let i = 0; i < n; i++) {
        tmp.copy(positions[i]);
        tmp.y -= yOffset;
        forces[i].sub(tmp.multiplyScalar(0.005));
      }

      for (let i = 0; i < n; i++) {
        velocities[i].add(forces[i].multiplyScalar(damping));
        velocities[i].multiplyScalar(0.92);
        positions[i].add(velocities[i]);
      }
    }

    return rows.map((row, i) => ({
      position: positions[i],
      row,
      index: i,
    }));
  }
}

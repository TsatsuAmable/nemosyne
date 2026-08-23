import * as THREE from 'three';
import { LayoutBase, requireKernelLayoutPositions } from './LayoutBase.ts';
import type { DatasetEdge } from '../../data/Dataset.ts';
import type { LayoutEntry } from '../types.ts';
import { computeForceDirectedEdges3d } from '../../wasm/LayoutAuthorityBridge.ts';

export interface ForceDirectedOptions {
  edges?: DatasetEdge[];
  iterations?: number;
  repulsion?: number;
  attraction?: number;
  damping?: number;
  radius?: number;
  yOffset?: number;
  seed?: number;
}

export class ForceDirected3D extends LayoutBase {
  static compute<T = Record<string, unknown>>(
    rows: T[] = [],
    options: ForceDirectedOptions = {}
  ): LayoutEntry<T>[] {
    if (rows.length === 0) return [];

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

    const rowIndex = new Map<unknown, number>();
    rows.forEach((row, index) => rowIndex.set(this.rowId(row as Record<string, unknown>), index));
    const indexedEdges = edges.flatMap((edge) => {
      const source = rowIndex.get(edge.source);
      const target = rowIndex.get(edge.target);
      if (source === undefined || target === undefined) return [];
      return [{ source, target, weight: edge.weight ?? 1 }];
    });

    const positions = requireKernelLayoutPositions(
      'ForceDirected3D',
      computeForceDirectedEdges3d(
        rows.length,
        indexedEdges,
        iterations,
        repulsion,
        attraction,
        damping,
        radius,
        yOffset,
        seed,
      ),
      rows.length * 3,
    );

    return rows.map((row, i) => ({
      position: new THREE.Vector3(
        positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2],
      ),
      row,
      index: i,
    }));
  }
}

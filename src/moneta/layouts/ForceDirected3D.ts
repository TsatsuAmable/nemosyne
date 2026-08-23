import * as THREE from 'three';
import { KernelLayoutUnavailableError, LayoutBase, requireKernelLayoutPositions } from './LayoutBase.ts';
import type { DatasetEdge } from '../../data/Dataset.ts';
import type { LayoutEntry } from '../types.ts';
import { computeForceDirected3d } from '../../wasm/RuntimeBridge.ts';

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
    } = options;

    if (edges.length > 0) {
      throw new KernelLayoutUnavailableError(
        'ForceDirected3D',
        'edge-aware force layout is not yet exposed by the Rust/WASM authority; refusing the former JS implementation',
      );
    }

    const positions = requireKernelLayoutPositions(
      'ForceDirected3D',
      computeForceDirected3d(rows.length, iterations, repulsion, attraction, damping, radius, yOffset),
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

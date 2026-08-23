import * as THREE from 'three';
import { KernelLayoutUnavailableError, LayoutBase } from './LayoutBase.ts';
import type { StreamlineEntry } from '../types.ts';
import { computeStreamline3d } from '../../wasm/RuntimeBridge.ts';

export interface StreamlineOptions {
  count?: number;
  steps?: number;
  bounds?: number[];
  numLines?: number;
  stepsPerLine?: number;
  stepSize?: number;
  curlScale?: number;
  noiseSeed?: number;
  seed?: number;
  yOffset?: number;
}

export class StreamlineLayout extends LayoutBase {
  static compute<T = Record<string, unknown>>(
    rows: T[] = [],
    options: StreamlineOptions = {}
  ): StreamlineEntry<T>[] {
    if (rows.length === 0) return [];

    const { numLines = 16, stepsPerLine = 32, stepSize = 0.12, seed = 42 } = options;
    const actualCount = options.count ?? numLines;
    const actualSteps = options.steps ?? stepsPerLine;
    const positions = computeStreamline3d(actualCount, actualSteps, stepSize, seed);
    const required = actualCount * (actualSteps + 1) * 3;

    if (!positions || positions.length < required) {
      throw new KernelLayoutUnavailableError(
        'StreamlineLayout',
        `expected at least ${required} coordinate values from Rust/WASM, received ${positions?.length ?? 0}`,
      );
    }

    const out: StreamlineEntry<T>[] = [];
    for (let line = 0; line < actualCount; line++) {
      const points: THREE.Vector3[] = [];
      const baseOffset = line * (actualSteps + 1) * 3;
      for (let step = 0; step <= actualSteps; step++) {
        const offset = baseOffset + step * 3;
        points.push(new THREE.Vector3(positions[offset], positions[offset + 1], positions[offset + 2]));
      }

      const rowIndex = line % rows.length;
      out.push({
        position: points[0].clone(),
        points,
        row: rows[rowIndex],
        index: rowIndex,
        streamlineId: line,
        step: 0,
        vector: new THREE.Vector3(1, 0, 0),
      });
    }
    return out;
  }
}

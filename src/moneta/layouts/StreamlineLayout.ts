import * as THREE from 'three';
import { LayoutBase, warnKernelLayoutUnavailable } from './LayoutBase.ts';
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
    const {
      numLines = 16,
      stepsPerLine = 32,
      stepSize = 0.12,
      curlScale = 0.4,
      seed = 42,
      yOffset = 1.0,
    } = options;

    const actualCount = options.count ?? numLines;
    const actualSteps = options.steps ?? stepsPerLine;
    const n = rows.length || 1;

    const wasmPositions = computeStreamline3d(actualCount, actualSteps, stepSize, seed);
    if (wasmPositions && wasmPositions.length >= n * 3) {
      return rows.map((row, i) => {
        const lineIdx = Math.floor(i / actualSteps);
        const stepIdx = i % actualSteps;

        const pts: THREE.Vector3[] = [];
        const baseOffset = lineIdx * (actualSteps + 1) * 3;
        for (let s = 0; s <= actualSteps; s++) {
          const idx = baseOffset + s * 3;
          if (idx + 2 < wasmPositions.length) {
            pts.push(new THREE.Vector3(wasmPositions[idx], wasmPositions[idx + 1], wasmPositions[idx + 2]));
          } else {
            pts.push(new THREE.Vector3(wasmPositions[i * 3], wasmPositions[i * 3 + 1], wasmPositions[i * 3 + 2]));
          }
        }

        return {
          position: new THREE.Vector3(
            wasmPositions[i * 3 + 0],
            wasmPositions[i * 3 + 1],
            wasmPositions[i * 3 + 2]
          ),
          points: pts,
          row,
          index: i,
          streamlineId: lineIdx,
          step: stepIdx,
          vector: new THREE.Vector3(1, 0, 0),
        };
      });
    }

    warnKernelLayoutUnavailable('StreamlineLayout');
    const out: StreamlineEntry<T>[] = [];

    for (let line = 0; line < actualCount; line++) {
      const startAngle = (2 * Math.PI * line) / actualCount;
      const startRadius = 1.5;
      let pos = new THREE.Vector3(
        startRadius * Math.cos(startAngle),
        yOffset + (line / actualCount - 0.5) * 1.0,
        startRadius * Math.sin(startAngle)
      );

      const pts: THREE.Vector3[] = [pos.clone()];

      for (let s = 0; s < actualSteps; s++) {
        const vx = -pos.z * curlScale;
        const vy = Math.sin(pos.x * 2) * 0.1;
        const vz = pos.x * curlScale;
        const v = new THREE.Vector3(vx, vy, vz).normalize().multiplyScalar(stepSize);
        pos = pos.clone().add(v);
        pts.push(pos.clone());
      }

      const rowIdx = line < rows.length ? line : line % rows.length;
      const row = rows[rowIdx] as T;

      out.push({
        position: pts[0].clone(),
        points: pts,
        row,
        index: rowIdx,
        streamlineId: line,
        step: 0,
        vector: new THREE.Vector3(1, 0, 0),
      });
    }

    return out;
  }
}

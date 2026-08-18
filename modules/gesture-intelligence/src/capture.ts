/**
 * Capture recorder — the "collect" half of the capture→train→deploy loop.
 *
 * Attach to a live engine input stream; `arm(label)` starts mirroring every
 * `HandSample` into a raw dual-hand trajectory; `stop()` finalizes and returns a
 * `RawInstance` whose JSONL form is byte-identical to the synthetic
 * `training/_output/raw_*.jsonl` schema, so captured data can be merged with
 * synthetic corpora and fed straight back into `extract_features.ts`.
 */

import type { GestureClass, HandSample } from './contracts.ts';

export interface RawPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly pinched: boolean;
  readonly t: number;
}

export interface RawInstance {
  readonly left: readonly RawPoint[];
  readonly right: readonly RawPoint[];
  readonly label: GestureClass;
}

export class CaptureRecorder {
  private left: RawPoint[] = [];
  private right: RawPoint[] = [];
  private armed: GestureClass | null = null;

  arm(label: GestureClass): void {
    this.reset();
    this.armed = label;
  }

  isArmed(): boolean {
    return this.armed !== null;
  }

  record(sample: HandSample): void {
    if (this.armed === null) return;
    const point: RawPoint = {
      x: sample.position.x,
      y: sample.position.y,
      z: sample.position.z,
      pinched: sample.pinched,
      t: sample.timestamp,
    };
    if (sample.hand === 'left') this.left.push(point);
    else if (sample.hand === 'right') this.right.push(point);
  }

  stop(): RawInstance | null {
    if (this.armed === null) return null;
    const label = this.armed;
    const left = this.left;
    const right = this.right;
    this.armed = null;
    this.left = [];
    this.right = [];
    if (left.length === 0 || right.length === 0) return null;
    return { left, right, label };
  }

  reset(): void {
    this.armed = null;
    this.left = [];
    this.right = [];
  }
}

export function serializeRawJsonl(instances: readonly RawInstance[]): string {
  const lines = instances.map((inst) => JSON.stringify(inst));
  return lines.length > 0 ? lines.join('\n') + '\n' : '';
}
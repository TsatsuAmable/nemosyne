/**
 * Per-hand trajectory ring buffers.
 *
 * Pushes raw hand samples and derives per-frame velocity (m/s) on the way in.
 * Capacity is bounded per hand id; ids are caller-controlled.
 */

import {
  TRAJECTORY_CAPACITY,
  type HandFrame,
  type HandId,
  type HandSample,
} from './contracts.ts';

export class TrajectoryBuffer {
  private readonly _capacity: number;
  private readonly _buffers = new Map<HandId, HandFrame[]>();

  constructor(capacity = TRAJECTORY_CAPACITY) {
    this._capacity = Math.max(2, capacity);
  }

  push(sample: HandSample): void {
    let buf = this._buffers.get(sample.hand);
    if (!buf) {
      buf = [];
      this._buffers.set(sample.hand, buf);
    }
    const prev = buf.length > 0 ? buf[buf.length - 1] : undefined;
    let speed = { x: 0, y: 0, z: 0 };
    if (prev) {
      const dtSec = (sample.timestamp - prev.timestamp) / 1000;
      if (dtSec > 0.001) {
        speed = {
          x: (sample.position.x - prev.position.x) / dtSec,
          y: (sample.position.y - prev.position.y) / dtSec,
          z: (sample.position.z - prev.position.z) / dtSec,
        };
      }
    }
    buf.push({
      position: { ...sample.position },
      pinched: sample.pinched,
      timestamp: sample.timestamp,
      speed,
    });
    if (buf.length > this._capacity) {
      buf.splice(0, buf.length - this._capacity);
    }
  }

  frames(hand: HandId): readonly HandFrame[] {
    return this._buffers.get(hand) ?? [];
  }

  hands(): readonly HandId[] {
    return [...this._buffers.keys()];
  }

  clear(): void {
    this._buffers.clear();
  }
}

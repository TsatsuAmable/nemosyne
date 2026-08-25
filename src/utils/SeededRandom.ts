/**
 * Deterministic seeded PRNG for procedural layouts and study stimuli.
 *
 * Backed by a SHA-256 counter stream (@noble/hashes) instead of a small
 * congruential generator: uniform over the full [0,1) mantissa, no short
 * period, stable across runtimes. Same seed => same sequence everywhere.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import type { SeededRandomLike } from '../vr/coordinators/types.ts';

export class SeededRandom implements SeededRandomLike {
  seed: number;

  private _counter: bigint;
  private _buffer: Uint8Array;
  private _offset: number;

  constructor(seed = 12345) {
    this.seed = seed >>> 0;
    this._counter = 0n;
    this._buffer = new Uint8Array(0);
    this._offset = 0;
  }

  private _refill(): void {
    const block = new ArrayBuffer(12);
    const view = new DataView(block);
    view.setUint32(0, this.seed, true);
    view.setBigUint64(4, this._counter, true);
    this._counter += 1n;
    this._buffer = sha256(new Uint8Array(block));
    this._offset = 0;
  }

  private _nextByte(): number {
    if (this._offset >= this._buffer.length) this._refill();
    return this._buffer[this._offset++];
  }

  /** Uniform unit value in [0, 1): exact 53-bit draw on the 2^-53 grid. */
  next(): number {
    let hi = 0;
    for (let i = 0; i < 4; i += 1) hi = hi * 256 + this._nextByte();
    hi = hi >>> 5; // top 27 of 32 bits
    let lo = 0;
    for (let i = 0; i < 4; i += 1) lo = lo * 256 + this._nextByte();
    lo = lo >>> 6; // top 26 of 32 bits
    return (hi * 2 ** 26 + lo) / 2 ** 53;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  pick<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }
}

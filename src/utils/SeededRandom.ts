/** Simple seedable random number generator for deterministic procedural layouts. */

import type { SeededRandomLike } from '../vr/coordinators/types.ts';

export class SeededRandom implements SeededRandomLike {
  seed: number;

  constructor(seed = 12345) {
    this.seed = seed;
  }

  // Linear congruential generator.
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
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

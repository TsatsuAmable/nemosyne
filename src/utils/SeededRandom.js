/** Simple seedable random number generator for deterministic procedural layouts. */
export class SeededRandom {
  constructor(seed = 12345) {
    this.seed = seed;
  }

  // Linear congruential generator.
  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  rangeInt(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  pick(array) {
    return array[Math.floor(this.next() * array.length)];
  }
}

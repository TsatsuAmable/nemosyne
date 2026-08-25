import { describe, it, expect } from 'vitest';
import { SeededRandom } from '../src/utils/SeededRandom.ts';

describe('SeededRandom (sha256 counter stream)', () => {
  it('produces identical sequences for identical seeds', () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    for (let i = 0; i < 100; i += 1) expect(a.next()).toBe(b.next());
  });

  it('produces different sequences for different seeds', () => {
    const a = new SeededRandom(1);
    const b = new SeededRandom(2);
    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('stays within [0, 1) across many draws and crosses byte-block boundaries', () => {
    const rng = new SeededRandom(7);
    // > 32 bytes forces multiple sha256 block refills.
    for (let i = 0; i < 200; i += 1) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('approximates uniformity loosely (no LCG-style clumping)', () => {
    const rng = new SeededRandom(12345);
    let sum = 0;
    const n = 4000;
    for (let i = 0; i < n; i += 1) sum += rng.next();
    const mean = sum / n;
    expect(mean).toBeGreaterThan(0.47);
    expect(mean).toBeLessThan(0.53);
  });

  it('range/rangeInt/pick honour their bounds', () => {
    const rng = new SeededRandom(9);
    for (let i = 0; i < 50; i += 1) {
      const v = rng.range(-2, 3);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThan(3);
      const k = rng.rangeInt(1, 6);
      expect(Number.isInteger(k)).toBe(true);
      expect(k).toBeGreaterThanOrEqual(1);
      expect(k).toBeLessThanOrEqual(6);
      expect([1, 2, 3]).toContain(rng.pick([1, 2, 3]));
    }
  });
});

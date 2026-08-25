import { describe, expect, it } from 'vitest';
import { decimate, extractFeatures } from '../../src/gesture/features.ts';
import type { HandFrame } from '../../src/gesture/contracts.ts';

function frame(
  x: number,
  y: number,
  z: number,
  t: number,
  pinched = false,
  speed = { x: 0, y: 0, z: 0 }
): HandFrame {
  return { position: { x, y, z }, pinched, timestamp: t, speed };
}

describe('decimate', () => {
  it('returns single element for length-1 input at any n', () => {
    expect(decimate([7], 16)).toEqual([7]);
  });

  it('returns last element for n=1', () => {
    expect(decimate([1, 2, 3, 4], 1)).toEqual([4]);
  });

  it('is deterministic and endpoint-inclusive', () => {
    const a = decimate([0, 1, 2, 3, 4, 5], 4);
    const b = decimate([0, 1, 2, 3, 4, 5], 4);
    expect(a).toEqual(b);
    expect(a[0]).toBe(0);
    expect(a[3]).toBe(5);
  });

  it('passes through when values fit n', () => {
    expect(decimate([1, 2, 3], 3)).toEqual([1, 2, 3]);
  });
});

describe('extractFeatures', () => {
  it('returns null when either hand is empty', () => {
    const one = [frame(0, 1, 0, 0)];
    expect(extractFeatures(one, [])).toBeNull();
    expect(extractFeatures([], one)).toBeNull();
    expect(extractFeatures([], [])).toBeNull();
  });

  it('produces exactly 56 dimensions', () => {
    const f = extractFeatures([frame(0, 1, 0, 0)], [frame(0.5, 1, 0, 0)]);
    expect(f).not.toBeNull();
    expect(f!.length).toBe(56);
  });

  it('matches the frozen layout on a hand-computed fixture', () => {
    const left = [
      frame(-0.1, 1.0, -0.2, 0, false, { x: 0, y: 0, z: 0 }),
      frame(0.0, 1.05, -0.2, 100, true, { x: 1, y: 0.5, z: 0 }),
      frame(0.1, 1.1, -0.25, 200, true, { x: 1, y: 0.5, z: -0.5 }),
      frame(0.2, 1.15, -0.3, 300, true, { x: 3, y: 0, z: 0 }),
    ];
    const right = [
      frame(0.4, 1.0, -0.2, 0, false, { x: 0, y: 0, z: 0 }),
      frame(0.35, 1.05, -0.2, 100, true, { x: -0.5, y: 0.5, z: 0 }),
      frame(0.3, 1.1, -0.25, 200, true, { x: -0.5, y: 0.5, z: -0.5 }),
      frame(0.25, 1.15, -0.3, 300, true, { x: -1.5, y: 0, z: 0 }),
    ];
    const f = extractFeatures(left, right)!;

    for (let i = 0; i < 16; i++) {
      expect(f[i]).toBeGreaterThanOrEqual(0);
      expect(f[i]).toBeLessThanOrEqual(1);
    }
    expect(f[0]).toBeCloseTo(0, 5);
    expect(f[16]).toBeCloseTo(0.3 / 0.5, 5);
    expect(f[17]).toBeCloseTo(0.15 / 0.5, 5);
    expect(f[18]).toBeCloseTo(-0.1 / 0.5, 5);
    expect(f[19]).toBeCloseTo(3 / 4, 5);

    expect(f[36]).toBeCloseTo(-0.15 / 0.5, 5);
    expect(f[37]).toBeCloseTo(0.15 / 0.5, 5);
    expect(f[38]).toBeCloseTo(-0.1 / 0.5, 5);
    expect(f[39]).toBeCloseTo(3 / 4, 5);

    const d0 = Math.hypot(-0.5, 0, 0) / 1.0;
    const d1 = Math.hypot(0.2 - 0.25, 1.15 - 1.15, -0.3 - -0.3);
    expect(f[40]).toBeCloseTo(Math.min(d0, 1), 5);
    expect(f[55]).toBeCloseTo(Math.min(d1 / 1.0, 1), 5);
  });

  it('clamps normalization ranges', () => {
    const far = [frame(-10, 0, 0, 0, true, { x: 0, y: 99, z: 0 })];
    const near = [frame(10, 0, 0, 0, true, { x: 0, y: -99, z: 0 })];
    const f = extractFeatures(far, near)!;
    for (const v of f) {
      expect(v).toBeGreaterThanOrEqual(-1.000001);
      expect(v).toBeLessThanOrEqual(1.000001);
    }
  });
});

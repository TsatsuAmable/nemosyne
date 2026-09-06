// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
  LOAD_TEST_THRESHOLDS,
  percentile,
  computeFrameStats,
  computeVerdict,
  computeOverallVerdict,
  type StepResult,
  type StepFrameStats,
  type StepGpuStats,
  type LoadTestStepSpec,
} from '../src/vr/scalability/LoadTestThresholds';

/**
 * Pure unit test for the load-test verdict math. No three.js, no DOM — just
 * percentile, frame-stats, verdict, and overall-verdict on synthetic frame-time
 * arrays. The grades are *computed* from the arrays against the fixed
 * thresholds, never hardcoded: we build distributions with known statistical
 * properties and assert the grade that those properties imply.
 */

const EMPTY_GPU: StepGpuStats = {
  drawCallsMax: 0, drawCallsAvg: 0, trianglesMax: 0, trianglesAvg: 0,
  pointsMax: 0, pointsAvg: 0, linesMax: 0, linesAvg: 0,
  geometriesMax: 0, texturesMax: 0,
};

function makeStep(
  spec: LoadTestStepSpec,
  frames: StepFrameStats,
  opts: { criticalViolations?: number; grade?: 'green' | 'yellow' | 'red' } = {}
): StepResult {
  const verdict = computeVerdict({ frames, criticalViolations: opts.criticalViolations ?? 0 });
  return {
    spec, frames, gpu: EMPTY_GPU, heapDeltaBytes: null,
    criticalViolations: opts.criticalViolations ?? 0, warnings: 0, errors: 0,
    grade: opts.grade ?? verdict.grade, reasons: verdict.reasons,
  };
}

function spec(rowCount: number, topology = 'TABULAR', durationSec = 20): LoadTestStepSpec {
  return { topology, rowCount, durationSec };
}

describe('percentile (nearest-rank)', () => {
  it('returns 0 for an empty sample', () => {
    expect(percentile([], 95)).toBe(0);
  });

  it('matches the documented nearest-rank semantics', () => {
    // 1..100 ascending: p50 should be the 50th value (ceil(0.5*100)=50 → idx 49 → 50),
    // p95 the 95th value (95), p99 the 99th value (99).
    const samples = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(samples, 50)).toBe(50);
    expect(percentile(samples, 95)).toBe(95);
    expect(percentile(samples, 99)).toBe(99);
    expect(percentile(samples, 100)).toBe(100);
  });

  it('clamps to the max for small samples (p95 of 10 = max)', () => {
    const samples = [5, 3, 9, 1, 7, 8, 2, 4, 6, 10]; // unsorted
    // ceil(0.95*10) = 10 → rank 10 → idx 9 → max = 10
    expect(percentile(samples, 95)).toBe(10);
  });

  it('does not mutate the input array', () => {
    const samples = [3, 1, 2];
    percentile(samples, 50);
    expect(samples).toEqual([3, 1, 2]);
  });
});

describe('computeFrameStats', () => {
  it('returns a zeroed stats object for an empty trace', () => {
    const s = computeFrameStats([]);
    expect(s.frameCount).toBe(0);
    expect(s.p95Ms).toBe(0);
    expect(s.droppedPct).toBe(0);
    expect(s.fpsAvg).toBe(0);
  });

  it('computes percentiles, averages, dropped rate, and GC spikes from a trace', () => {
    // 100 frames: 95 at 10ms, 4 at 33ms, 1 at 80ms (a GC spike).
    const frames = [
      ...Array(95).fill(10),
      ...Array(4).fill(33),
      80,
    ] as number[];
    const s = computeFrameStats(frames);

    expect(s.frameCount).toBe(100);
    expect(s.avgMs).toBeCloseTo((95 * 10 + 4 * 33 + 80) / 100, 5);
    expect(s.minMs).toBe(10);
    expect(s.maxMs).toBe(80);
    // 5 frames exceed 16.67 (the four 33s + the 80) → 5% dropped
    expect(s.dropped).toBe(5);
    expect(s.droppedPct).toBe(5);
    // 1 frame exceeds GC_SPIKE_MS (50) → the 80
    expect(s.gcSpikes).toBe(1);
    // sorted: 95×10, then 33,33,33,33, 80. p95 rank = ceil(0.95*100)=95 → idx 94 → 10
    expect(s.p95Ms).toBe(10);
    // p99 rank = ceil(0.99*100)=99 → idx 98 → 33
    expect(s.p99Ms).toBe(33);
    // fpsAvg = 1000 / avg
    expect(s.fpsAvg).toBeCloseTo(1000 / s.avgMs, 3);
  });
});

describe('computeVerdict', () => {
  it('grades a tight, drop-free distribution green', () => {
    // 200 frames all at 8ms → p95=8, dropped=0, p99=8, no critical violation.
    const frames = computeFrameStats(Array(200).fill(8));
    const { grade, reasons } = computeVerdict({ frames, criticalViolations: 0 });
    expect(grade).toBe('green');
    expect(reasons).toEqual([]);
  });

  it('grades yellow when p95 is marginal (between 13.33 and 16.67) with no drops', () => {
    // 100 frames all at 15ms → p95=15 (>13.33, <=16.67), dropped=0, p99=15.
    const frames = computeFrameStats(Array(100).fill(15));
    const { grade } = computeVerdict({ frames, criticalViolations: 0 });
    expect(grade).toBe('yellow');
  });

  it('grades red when p95 exceeds the 60Hz floor', () => {
    // 100 frames all at 20ms → p95=20 (>16.67), dropped=100%.
    const frames = computeFrameStats(Array(100).fill(20));
    const { grade, reasons } = computeVerdict({ frames, criticalViolations: 0 });
    expect(grade).toBe('red');
    expect(reasons.some((r) => r.includes('p95'))).toBe(true);
  });

  it('grades red when dropped rate hits the red threshold', () => {
    // 85 frames at 10ms + 15 frames at 22ms. 22 > 16.67 so all 15 are dropped
    // → droppedPct = 15 = DROPPED_YELLOW_PCT → red by dropped rate. Note: at 15%
    // dropped the dropped frames occupy ranks 86-100, so p95 (rank 95) is also a
    // 22 → the step is red by p95 too; both reasons appear. We assert the
    // dropped reason is among them. Long frames are <= 33 so p99 stays <= 33.
    const frames = computeFrameStats([
      ...Array(85).fill(10),
      ...Array(15).fill(22),
    ]);
    expect(frames.droppedPct).toBe(15);
    expect(frames.p99Ms).toBe(22); // <= 33
    const { grade, reasons } = computeVerdict({ frames, criticalViolations: 0 });
    expect(grade).toBe('red');
    expect(reasons.some((r) => r.includes('dropped'))).toBe(true);
  });

  it('grades red on a critical budget violation regardless of frame times', () => {
    const frames = computeFrameStats(Array(200).fill(8)); // green-ish frame stats
    const { grade, reasons } = computeVerdict({ frames, criticalViolations: 1 });
    expect(grade).toBe('red');
    expect(reasons.some((r) => r.includes('critical'))).toBe(true);
  });

  it('grades red when p99 exceeds the visible-stutter threshold', () => {
    // 98 frames at 10ms + 2 frames at 50ms → p95=10 (idx 94), dropped=2% (<5%),
    // but p99 = sorted[98] = 50 > 33.
    const frames = computeFrameStats([
      ...Array(98).fill(10),
      ...Array(2).fill(50),
    ]);
    expect(frames.p95Ms).toBe(10);
    expect(frames.p99Ms).toBe(50);
    const { grade, reasons } = computeVerdict({ frames, criticalViolations: 0 });
    expect(grade).toBe('red');
    expect(reasons.some((r) => r.includes('p99'))).toBe(true);
  });
});

describe('computeOverallVerdict', () => {
  it('reports no command buffer warranted when every step stays green', () => {
    const steps = [
      makeStep(spec(1_000), computeFrameStats(Array(200).fill(8))),
      makeStep(spec(8_000), computeFrameStats(Array(200).fill(9))),
      makeStep(spec(65_000), computeFrameStats(Array(200).fill(11))),
    ];
    // sanity: all green
    expect(steps.every((s) => s.grade === 'green')).toBe(true);

    const v = computeOverallVerdict(steps);
    expect(v.jsPathSufficientTo).toBe(65_000);
    expect(v.commandBufferWarrantedAt).toBeNull();
    expect(v.recommendation).toContain('No command buffer warranted');
  });

  it('picks the first red step as the breaking N and the largest green as sufficient', () => {
    const steps = [
      makeStep(spec(1_000), computeFrameStats(Array(200).fill(8))), // green
      makeStep(spec(8_000), computeFrameStats(Array(200).fill(9))), // green
      makeStep(spec(65_000), computeFrameStats(Array(200).fill(20))), // red (p95 20 > 16.67)
      makeStep(spec(100_000), computeFrameStats(Array(200).fill(28))), // red
    ];
    expect(steps[0].grade).toBe('green');
    expect(steps[1].grade).toBe('green');
    expect(steps[2].grade).toBe('red');
    expect(steps[3].grade).toBe('red');

    const v = computeOverallVerdict(steps);
    expect(v.jsPathSufficientTo).toBe(8_000);
    expect(v.commandBufferWarrantedAt).toBe(65_000);
    expect(v.recommendation).toContain('warranted at >= 65000');
    // requiredPerfLevel quotes the measured gap at the red step
    expect(v.requiredPerfLevel).toContain('65000 rows');
  });

  it('handles a staircase that is red from the smallest size', () => {
    const steps = [
      makeStep(spec(1_000), computeFrameStats(Array(200).fill(25))), // red
      makeStep(spec(8_000), computeFrameStats(Array(200).fill(30))), // red
    ];
    const v = computeOverallVerdict(steps);
    expect(v.jsPathSufficientTo).toBeNull();
    expect(v.commandBufferWarrantedAt).toBe(1_000);
    expect(v.recommendation).toContain('below target from the smallest tested size');
  });

  it('grades array maps each step rowCount to its grade in order', () => {
    const steps = [
      makeStep(spec(1_000), computeFrameStats(Array(200).fill(8)), { grade: 'green' }),
      makeStep(spec(8_000), computeFrameStats(Array(200).fill(15)), { grade: 'yellow' }),
      makeStep(spec(65_000), computeFrameStats(Array(200).fill(20)), { grade: 'red' }),
    ];
    const v = computeOverallVerdict(steps);
    expect(v.grades).toEqual([
      { rowCount: 1_000, grade: 'green' },
      { rowCount: 8_000, grade: 'yellow' },
      { rowCount: 65_000, grade: 'red' },
    ]);
    // yellow steps don't count as sufficient (green) nor as the breaking red
    expect(v.jsPathSufficientTo).toBe(1_000);
    expect(v.commandBufferWarrantedAt).toBe(65_000);
  });

  it('excludes flagged warmup steps from the verdict while keeping them graded', () => {
    const warmupSpec: LoadTestStepSpec = { ...spec(1_000), label: 'warmup (ungraded)', warmup: true };
    const steps = [
      makeStep(warmupSpec, computeFrameStats(Array(200).fill(40)), { grade: 'red' }),
      makeStep(spec(1_000), computeFrameStats(Array(200).fill(8)), { grade: 'green' }),
      makeStep(spec(8_000), computeFrameStats(Array(200).fill(9)), { grade: 'green' }),
      makeStep(spec(65_000), computeFrameStats(Array(200).fill(20)), { grade: 'red' }),
    ];
    const v = computeOverallVerdict(steps);
    // The red warmup step must not drive the recommendation...
    expect(v.jsPathSufficientTo).toBe(8_000);
    expect(v.commandBufferWarrantedAt).toBe(65_000);
    // ...but stays visible: excluded rows are reported, grades cover graded only.
    expect(v.warmupExcludedRowCounts).toEqual([1_000]);
    expect(v.grades).toEqual([
      { rowCount: 1_000, grade: 'green' },
      { rowCount: 8_000, grade: 'green' },
      { rowCount: 65_000, grade: 'red' },
    ]);
  });

  it('returns null verdict bounds when every step is warmup', () => {
    const steps = [
      makeStep({ ...spec(1_000), warmup: true }, computeFrameStats(Array(200).fill(40)), { grade: 'red' }),
    ];
    const v = computeOverallVerdict(steps);
    expect(v.jsPathSufficientTo).toBeNull();
    expect(v.commandBufferWarrantedAt).toBeNull();
    expect(v.warmupExcludedRowCounts).toEqual([1_000]);
  });

  it('behaves exactly as before when no step is flagged', () => {
    const steps = [
      makeStep(spec(1_000), computeFrameStats(Array(200).fill(25)), { grade: 'red' }),
    ];
    const v = computeOverallVerdict(steps);
    expect(v.jsPathSufficientTo).toBeNull();
    expect(v.commandBufferWarrantedAt).toBe(1_000);
    expect(v.warmupExcludedRowCounts).toEqual([]);
  });
});

describe('threshold constants are fixed and reviewable', () => {
  it('matches the documented Quest comfort / 60Hz floor / stutter values', () => {
    expect(LOAD_TEST_THRESHOLDS.FRAME_GREEN_MS).toBe(13.33);
    expect(LOAD_TEST_THRESHOLDS.FRAME_YELLOW_MS).toBe(16.67);
    expect(LOAD_TEST_THRESHOLDS.FRAME_RED_P99_MS).toBe(33.0);
    expect(LOAD_TEST_THRESHOLDS.DROPPED_GREEN_PCT).toBe(5);
    expect(LOAD_TEST_THRESHOLDS.DROPPED_YELLOW_PCT).toBe(15);
    expect(LOAD_TEST_THRESHOLDS.GC_SPIKE_MS).toBe(50.0);
  });
});
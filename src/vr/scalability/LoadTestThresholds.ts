/**
 * Defined performance parameters and verdict logic for the VR load-test harness.
 *
 * The WASM command-buffer decision (audit B2) is deferred pending a real-headset
 * load test of the JS render path. This module holds the *fixed, reviewable
 * thresholds* that a run is measured against, plus the pure verdict math that
 * turns a per-frame trace into a green/yellow/red grade and an overall
 * recommendation: the largest dataset size the JS path holds at, the first size
 * it breaks at, and the perf gap a command buffer (or LOD throttle) would have
 * to close.
 *
 * Everything here is pure — no three.js, no DOM, no side effects — so the
 * percentile and verdict logic is unit-tested directly with synthetic frame-time
 * arrays. No hardcoded results: the grade is computed from measurements.
 */

export type VerdictGrade = 'green' | 'yellow' | 'red';

/**
 * Per-frame trace of one load-test step, produced by {@link LoadTestCollector}.
 * Kept as plain numbers (not the raw array) so the summary is compact and the
 * verdict math has everything it needs without re-reading the trace.
 */
export interface StepFrameStats {
  frameCount: number;
  dropped: number; // frames with frameMs > DROPPED_FRAME_MS (16.67)
  droppedPct: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  fpsAvg: number; // 1000 / avgMs
  gcSpikes: number; // frames with frameMs > GC_SPIKE_MS (GC / load candidate proxy)
}

/** GPU counters sampled from `renderer.info` across a step. */
export interface StepGpuStats {
  drawCallsMax: number;
  drawCallsAvg: number;
  trianglesMax: number;
  trianglesAvg: number;
  pointsMax: number;
  pointsAvg: number;
  linesMax: number;
  linesAvg: number;
  geometriesMax: number;
  texturesMax: number;
}

/** One step of a staircase run, after measurement + verdict. */
export interface LoadTestStepSpec {
  topology: string;
  rowCount: number;
  durationSec: number;
  label?: string;
}

export interface StepResult {
  spec: LoadTestStepSpec;
  frames: StepFrameStats;
  gpu: StepGpuStats;
  /** JS heap delta across the step (Chromium `performance.memory`); null if unsupported. */
  heapDeltaBytes: number | null;
  /** Count of *critical* PerformanceBudget violations observed during the step. */
  criticalViolations: number;
  warnings: number;
  errors: number;
  /** Geometry/layout the Draco solver actually picked for this dataset — honest record of what was stressed. */
  specGeometry?: string;
  specLayout?: string;
  grade: VerdictGrade;
  reasons: string[];
}

export interface OverallVerdict {
  grades: { rowCount: number; grade: VerdictGrade }[];
  /** Largest row count that stayed green (JS path sufficient). null if none were green. */
  jsPathSufficientTo: number | null;
  /** First row count that went red (command buffer / LOD throttle warranted at >= this). null if none red. */
  commandBufferWarrantedAt: number | null;
  requiredPerfLevel: string;
  recommendation: string;
}

/**
 * Fixed thresholds. Quest 3/3S defaults to 72 Hz; the runtime's
 * `AdaptiveFrameGovernor` targets 11.1 ms (90 Hz). The green p95 (13.33 ms)
 * matches the strict-budget frame target; the yellow p95 (16.67 ms) is the
 * 60 Hz floor; the red p99 (33 ms) is where stutter becomes visible.
 */
export const LOAD_TEST_THRESHOLDS = {
  FRAME_GREEN_MS: 13.33, // 72 Hz comfort p95
  FRAME_YELLOW_MS: 16.67, // 60 Hz floor p95
  FRAME_RED_P99_MS: 33.0, // visible stutter p99
  DROPPED_GREEN_PCT: 5, // < 5% dropped frames
  DROPPED_YELLOW_PCT: 15,
  GC_SPIKE_MS: 50.0, // long-frame spike (GC / load candidate) proxy
  DROPPED_FRAME_MS: 16.67, // a frame is "dropped" if it exceeds one 60 Hz tick
} as const;

export type LoadTestThresholds = typeof LOAD_TEST_THRESHOLDS;

/**
 * Nearest-rank percentile. Sorts ascending and returns the value at the
 * ceil(q/100 * n) rank (1-indexed, clamped). Deterministic and easy to verify:
 * for n=100, p95 is the 95th smallest value; for n=10, p95 is the max.
 * Returns 0 for an empty sample.
 */
export function percentile(samples: number[], q: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((q / 100) * sorted.length);
  const idx = Math.min(Math.max(rank - 1, 0), sorted.length - 1);
  return sorted[idx];
}

/** Compute the three percentiles + averages + dropped rate + GC-spike count from a raw frame-time trace. */
export function computeFrameStats(
  frameMs: number[],
  thresholds: LoadTestThresholds = LOAD_TEST_THRESHOLDS
): StepFrameStats {
  const n = frameMs.length;
  if (n === 0) {
    return {
      frameCount: 0, dropped: 0, droppedPct: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0,
      avgMs: 0, minMs: 0, maxMs: 0, fpsAvg: 0, gcSpikes: 0,
    };
  }
  let sum = 0, min = Infinity, max = -Infinity, dropped = 0, gcSpikes = 0;
  for (const ms of frameMs) {
    sum += ms;
    if (ms < min) min = ms;
    if (ms > max) max = ms;
    if (ms > thresholds.DROPPED_FRAME_MS) dropped++;
    if (ms > thresholds.GC_SPIKE_MS) gcSpikes++;
  }
  const avg = sum / n;
  return {
    frameCount: n,
    dropped,
    droppedPct: (dropped / n) * 100,
    p50Ms: percentile(frameMs, 50),
    p95Ms: percentile(frameMs, 95),
    p99Ms: percentile(frameMs, 99),
    avgMs: avg,
    minMs: min,
    maxMs: max,
    fpsAvg: avg > 0 ? 1000 / avg : 0,
    gcSpikes,
  };
}

/**
 * Grade a single step green/yellow/red against the thresholds.
 *
 * - **green**: p95 <= FRAME_GREEN_MS AND droppedPct < DROPPED_GREEN_PCT AND
 *   p99 <= FRAME_RED_P99_MS AND no critical budget violation.
 * - **red**: p95 > FRAME_YELLOW_MS OR droppedPct >= DROPPED_YELLOW_PCT OR
 *   p99 > FRAME_RED_P99_MS OR any critical budget violation.
 * - **yellow**: marginal (between green and red).
 */
export function computeVerdict(
  step: { frames: StepFrameStats; criticalViolations: number },
  thresholds: LoadTestThresholds = LOAD_TEST_THRESHOLDS
): { grade: VerdictGrade; reasons: string[] } {
  const f = step.frames;
  const reasons: string[] = [];

  const isGreen =
    f.p95Ms <= thresholds.FRAME_GREEN_MS &&
    f.droppedPct < thresholds.DROPPED_GREEN_PCT &&
    f.p99Ms <= thresholds.FRAME_RED_P99_MS &&
    step.criticalViolations === 0;
  if (isGreen) return { grade: 'green', reasons };

  const isRed =
    f.p95Ms > thresholds.FRAME_YELLOW_MS ||
    f.droppedPct >= thresholds.DROPPED_YELLOW_PCT ||
    f.p99Ms > thresholds.FRAME_RED_P99_MS ||
    step.criticalViolations > 0;
  if (isRed) {
    if (f.p95Ms > thresholds.FRAME_YELLOW_MS) reasons.push(`p95 ${f.p95Ms.toFixed(1)} ms > ${thresholds.FRAME_YELLOW_MS} ms`);
    if (f.droppedPct >= thresholds.DROPPED_YELLOW_PCT) reasons.push(`dropped ${f.droppedPct.toFixed(1)}% >= ${thresholds.DROPPED_YELLOW_PCT}%`);
    if (f.p99Ms > thresholds.FRAME_RED_P99_MS) reasons.push(`p99 ${f.p99Ms.toFixed(1)} ms > ${thresholds.FRAME_RED_P99_MS} ms`);
    if (step.criticalViolations > 0) reasons.push(`${step.criticalViolations} critical budget violation(s)`);
    return { grade: 'red', reasons };
  }

  // yellow — marginal
  if (f.p95Ms > thresholds.FRAME_GREEN_MS) reasons.push(`p95 ${f.p95Ms.toFixed(1)} ms > ${thresholds.FRAME_GREEN_MS} ms (marginal)`);
  if (f.droppedPct >= thresholds.DROPPED_GREEN_PCT) reasons.push(`dropped ${f.droppedPct.toFixed(1)}% >= ${thresholds.DROPPED_GREEN_PCT}% (marginal)`);
  return { grade: 'yellow', reasons };
}

/**
 * Roll up a staircase of step results into the overall recommendation. This is
 * the literal answer to "whether we need the command buffer and what performance
 * level it must meet":
 * - `jsPathSufficientTo` = largest row count that stayed green.
 * - `commandBufferWarrantedAt` = first row count that went red.
 * - `requiredPerfLevel` = the perf gap to restore at the red step (or "no buffer
 *   warranted" if the JS path held across all tested sizes).
 */
export function computeOverallVerdict(steps: StepResult[]): OverallVerdict {
  const grades = steps.map((s) => ({ rowCount: s.spec.rowCount, grade: s.grade }));

  const greenSteps = steps.filter((s) => s.grade === 'green');
  const redSteps = steps.filter((s) => s.grade === 'red');
  const jsPathSufficientTo = greenSteps.length ? Math.max(...greenSteps.map((s) => s.spec.rowCount)) : null;
  const commandBufferWarrantedAt = redSteps.length ? Math.min(...redSteps.map((s) => s.spec.rowCount)) : null;

  let requiredPerfLevel: string;
  let recommendation: string;
  if (commandBufferWarrantedAt === null) {
    requiredPerfLevel = `JS render path meets targets (p95 <= ${LOAD_TEST_THRESHOLDS.FRAME_GREEN_MS} ms, dropped < ${LOAD_TEST_THRESHOLDS.DROPPED_GREEN_PCT}%) across all tested sizes.`;
    recommendation =
      'No command buffer warranted by this run. Defer/descope the WASM command-buffer; revisit only if target dataset sizes grow or frame budget tightens.';
  } else {
    const redStep = steps.find((s) => s.spec.rowCount === commandBufferWarrantedAt)!;
    requiredPerfLevel =
      `Restore p95 <= ${LOAD_TEST_THRESHOLDS.FRAME_GREEN_MS} ms and dropped < ${LOAD_TEST_THRESHOLDS.DROPPED_GREEN_PCT}% ` +
      `at ${redStep.spec.rowCount} rows (measured p95 ${redStep.frames.p95Ms.toFixed(1)} ms, ` +
      `dropped ${redStep.frames.droppedPct.toFixed(1)}%, p99 ${redStep.frames.p99Ms.toFixed(1)} ms).`;
    const where =
      jsPathSufficientTo !== null
        ? `JS path sufficient to ${jsPathSufficientTo} rows; breaks at ${commandBufferWarrantedAt}.`
        : `JS path below target from the smallest tested size (${commandBufferWarrantedAt} rows).`;
    recommendation = `${where} Command buffer (or InstancedPointCloud LOD throttle) warranted at >= ${commandBufferWarrantedAt} rows. ${requiredPerfLevel}`;
  }

  return { grades, jsPathSufficientTo, commandBufferWarrantedAt, requiredPerfLevel, recommendation };
}
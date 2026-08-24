import type { Updatable } from '../coordinators/types.ts';
import { DEFAULT_BUDGETS } from '../../utils/PerformanceBudget.ts';
import {
  computeFrameStats,
  computeVerdict,
  type LoadTestStepSpec,
  type StepFrameStats,
  type StepGpuStats,
  type StepResult,
} from './LoadTestThresholds.ts';
import { computeSustainedPerformanceProxy } from './QuestTelemetry.ts';

/**
 * Per-frame trace collector for the VR load-test harness.
 *
 * This fills the gap the existing collectors leave: `TelemetryCollector` keeps
 * only histogram buckets (no percentiles, no raw trace, no FPS), and
 * `PerformanceBudget` samples `renderer.info` once per second and discards it.
 * To decide whether the WASM command buffer is warranted we need **per-frame**
 * frame times + GPU counters across each staircase step, so we can compute real
 * p50/p95/p99 and dropped rates.
 *
 * Registered as an Engine `Updatable`, so it runs inside the XR frame loop on
 * Quest. Each tick it reads `engine.lastFrameMs` (set by `Engine._tick` after
 * render) and snapshots `engine.renderer.info`. three.js resets `renderer.info`
 * at the start of `render()`, and updatables run *before* render, so the info
 * seen here is the previous frame's accumulated counters — a one-frame lag that
 * is irrelevant for statistics over thousands of frames.
 *
 * No hardcoded results: `endStep()` computes all stats from the recorded trace
 * via the pure `computeFrameStats` / `computeVerdict` helpers.
 */

/** Minimal renderer.info shape we read. */
interface RendererInfoLike {
  render?: { calls?: number; triangles?: number; points?: number; lines?: number };
  memory?: { geometries?: number; textures?: number };
}

/** Minimal Engine surface the collector depends on. */
export interface LoadTestEngineLike {
  lastFrameMs: number;
  frameIntervalMs?: number;
  frameGovernor?: {
    getMetrics(): {
      lodScaleFactor: number;
      throttleCount: number;
    };
  };
  renderer: { info: RendererInfoLike };
}

export interface LoadTestRuntimeProbe {
  getWasmMemoryBytes?(): number | null;
}

interface GpuAccumulator {
  calls: number[];
  triangles: number[];
  points: number[];
  lines: number[];
  geometries: number[];
  textures: number[];
}

function emptyGpuAcc(): GpuAccumulator {
  return { calls: [], triangles: [], points: [], lines: [], geometries: [], textures: [] };
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
}

function maxOf(arr: number[]): number {
  return arr.length === 0 ? 0 : Math.max(...arr);
}

function nullableMax(values: number[], start: number | null, end: number | null): number | null {
  const candidates = [...values];
  if (start !== null) candidates.push(start);
  if (end !== null) candidates.push(end);
  return candidates.length === 0 ? null : Math.max(...candidates);
}

function nullableDelta(start: number | null, end: number | null): number | null {
  return start === null || end === null ? null : end - start;
}

/** Read Chromium-only `performance.memory.usedJSHeapSize`; undefined elsewhere. */
function heapUsed(): number | null {
  const mem = (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory;
  return typeof mem?.usedJSHeapSize === 'number' ? mem.usedJSHeapSize : null;
}

export class LoadTestCollector implements Updatable {
  private _frameMs: number[] = [];
  private _frameIntervalsMs: number[] = [];
  private _gpu: GpuAccumulator = emptyGpuAcc();
  private _heapStart: number | null = null;
  private _heapSamples: number[] = [];
  private _wasmStart: number | null = null;
  private _wasmSamples: number[] = [];
  private _lodScaleSamples: number[] = [];
  private _governorThrottleStart = 0;
  private _criticalFrames = 0;
  private _active = false;
  private _stepStart = 0;
  private _currentSpec: LoadTestStepSpec | null = null;

  constructor(
    private readonly _engine: LoadTestEngineLike,
    private readonly _runtimeProbe: LoadTestRuntimeProbe = {}
  ) {}

  /** Engine updatable hook: records one frame iff a step is active. */
  update(_delta: number, _time: number): void {
    if (!this._active) return;
    this.recordFrame(
      this._engine.lastFrameMs,
      this._engine.renderer.info,
      this._engine.frameIntervalMs ?? 0
    );
  }

  /** Clear all buffers (called at the start of a run). */
  reset(): void {
    this._frameMs = [];
    this._frameIntervalsMs = [];
    this._gpu = emptyGpuAcc();
    this._heapStart = null;
    this._heapSamples = [];
    this._wasmStart = null;
    this._wasmSamples = [];
    this._lodScaleSamples = [];
    this._governorThrottleStart = 0;
    this._criticalFrames = 0;
    this._active = false;
    this._stepStart = 0;
    this._currentSpec = null;
  }

  /** Begin measuring a step. */
  startStep(spec: LoadTestStepSpec): void {
    this._frameMs = [];
    this._frameIntervalsMs = [];
    this._gpu = emptyGpuAcc();
    this._heapSamples = [];
    this._wasmSamples = [];
    this._lodScaleSamples = [];
    this._criticalFrames = 0;
    this._heapStart = heapUsed();
    this._wasmStart = this._runtimeProbe.getWasmMemoryBytes?.() ?? null;
    this._governorThrottleStart = this._engine.frameGovernor?.getMetrics().throttleCount ?? 0;
    this._stepStart = performance.now();
    this._currentSpec = spec;
    this._active = true;
  }

  /** Record one frame's measurements. Public so it can be driven in tests. */
  recordFrame(frameMs: number, info: RendererInfoLike, frameIntervalMs = 0): void {
    this._frameMs.push(frameMs);
    if (frameIntervalMs > 0 && Number.isFinite(frameIntervalMs)) {
      this._frameIntervalsMs.push(frameIntervalMs);
    }

    const render = info?.render ?? {};
    this._gpu.calls.push(render.calls ?? 0);
    this._gpu.triangles.push(render.triangles ?? 0);
    this._gpu.points.push(render.points ?? 0);
    this._gpu.lines.push(render.lines ?? 0);
    const mem = info?.memory ?? {};
    this._gpu.geometries.push(mem.geometries ?? 0);
    this._gpu.textures.push(mem.textures ?? 0);

    const heap = heapUsed();
    if (heap !== null) this._heapSamples.push(heap);
    const wasmBytes = this._runtimeProbe.getWasmMemoryBytes?.() ?? null;
    if (wasmBytes !== null) this._wasmSamples.push(wasmBytes);
    const governor = this._engine.frameGovernor?.getMetrics();
    if (governor) this._lodScaleSamples.push(governor.lodScaleFactor);

    // Critical-budget proxy, mirroring PerformanceBudget's 2x rule for the
    // gates that have a critical tier (frameMs, drawCalls). A frame that trips
    // either counts as a critical frame; a step with any critical frames fails
    // the green gate. Independent of the throttled PerformanceBudget history.
    if (frameMs > DEFAULT_BUDGETS.frameMs * 2 || (render.calls ?? 0) > DEFAULT_BUDGETS.drawCalls * 2) {
      this._criticalFrames++;
    }
  }

  /** Stop measuring and compute the StepResult (stats + verdict). */
  endStep(opts: {
    warnings?: number;
    errors?: number;
    specGeometry?: string;
    specLayout?: string;
    renderedNodeCount?: number;
    loadDurationMs?: number;
  } = {}): StepResult {
    this._active = false;
    const frames = computeFrameStats(this._frameMs);
    const frameCadence = computeFrameStats(this._frameIntervalsMs);
    const gpu: StepGpuStats = {
      drawCallsMax: maxOf(this._gpu.calls),
      drawCallsAvg: avg(this._gpu.calls),
      trianglesMax: maxOf(this._gpu.triangles),
      trianglesAvg: avg(this._gpu.triangles),
      pointsMax: maxOf(this._gpu.points),
      pointsAvg: avg(this._gpu.points),
      linesMax: maxOf(this._gpu.lines),
      linesAvg: avg(this._gpu.lines),
      geometriesMax: maxOf(this._gpu.geometries),
      texturesMax: maxOf(this._gpu.textures),
    };
    const heapEnd = heapUsed();
    const wasmEnd = this._runtimeProbe.getWasmMemoryBytes?.() ?? null;
    const heapDeltaBytes = nullableDelta(this._heapStart, heapEnd);
    const governor = this._engine.frameGovernor?.getMetrics();
    const governorThrottleEvents = Math.max(
      0,
      (governor?.throttleCount ?? this._governorThrottleStart) - this._governorThrottleStart
    );

    const verdictFrames = frameCadence.frameCount > 0 ? frameCadence : frames;
    const verdict = computeVerdict({
      frames: verdictFrames,
      criticalViolations: this._criticalFrames,
    });

    const spec = this._currentSpec ?? { topology: 'TABULAR', rowCount: 0, durationSec: 0 };
    return {
      spec,
      frames,
      frameCadence,
      gpu,
      heapDeltaBytes,
      memory: {
        jsHeapStartBytes: this._heapStart,
        jsHeapPeakBytes: nullableMax(this._heapSamples, this._heapStart, heapEnd),
        jsHeapEndBytes: heapEnd,
        jsHeapDeltaBytes: heapDeltaBytes,
        wasmStartBytes: this._wasmStart,
        wasmPeakBytes: nullableMax(this._wasmSamples, this._wasmStart, wasmEnd),
        wasmEndBytes: wasmEnd,
        wasmDeltaBytes: nullableDelta(this._wasmStart, wasmEnd),
      },
      representation: {
        sourceRowCount: spec.rowCount,
        renderedNodeCount: opts.renderedNodeCount ?? null,
        renderedFraction:
          typeof opts.renderedNodeCount === 'number' && spec.rowCount > 0
            ? opts.renderedNodeCount / spec.rowCount
            : null,
        geometry: opts.specGeometry ?? null,
        layout: opts.specLayout ?? null,
        governorLodScaleMinimum:
          this._lodScaleSamples.length > 0 ? Math.min(...this._lodScaleSamples) : null,
        governorLodScaleFinal: governor?.lodScaleFactor ?? null,
        governorThrottleEvents,
      },
      sustainedPerformance: computeSustainedPerformanceProxy(
        this._frameIntervalsMs,
        this._frameMs,
        governorThrottleEvents
      ),
      loadDurationMs: opts.loadDurationMs ?? 0,
      criticalViolations: this._criticalFrames,
      warnings: opts.warnings ?? 0,
      errors: opts.errors ?? 0,
      specGeometry: opts.specGeometry,
      specLayout: opts.specLayout,
      grade: verdict.grade,
      reasons: verdict.reasons,
    };
  }

  /** Live (running) frame stats for panel display mid-step. Cheap-ish: recompute over current buffer. */
  liveFrameStats(): StepFrameStats {
    return computeFrameStats(this._frameMs);
  }

  /** Live GPU maxes for panel display mid-step. */
  liveGpu(): { drawCalls: number; triangles: number; points: number; lines: number } {
    return {
      drawCalls: maxOf(this._gpu.calls),
      triangles: maxOf(this._gpu.triangles),
      points: maxOf(this._gpu.points),
      lines: maxOf(this._gpu.lines),
    };
  }

  /** Frames recorded in the current step. */
  get frameCount(): number {
    return this._frameMs.length;
  }

  /** Elapsed ms in the current step. */
  get stepElapsedMs(): number {
    return this._active ? performance.now() - this._stepStart : 0;
  }

  /** Critical-frame count in the current step (for live panel display). */
  get criticalFrames(): number {
    return this._criticalFrames;
  }
}

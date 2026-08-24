import { makeStressDataset } from '../../data/makeStressDataset.ts';
import { getDefaultEncodings } from '../../data/SampleDatasets.ts';
import type { DatasetLoadEntry, Updatable } from '../coordinators/types.ts';
import type { TopologyType } from '../../data/types.ts';
import { WorldTopics } from '../../utils/EventBus.ts';
import {
  LoadTestCollector,
  type LoadTestEngineLike,
  type LoadTestRuntimeProbe,
} from './LoadTestCollector.ts';
import {
  LOAD_TEST_THRESHOLDS,
  computeOverallVerdict,
  type LoadTestStepSpec,
  type OverallVerdict,
  type StepResult,
} from './LoadTestThresholds.ts';
import {
  QuestVisibilityTracker,
  captureQuestRuntimeEnvironment,
  type QuestDeviceTarget,
  type QuestRuntimeEnvironment,
  type QuestVisibilityTelemetry,
} from './QuestTelemetry.ts';

/**
 * Staircase load-test driver for the WASM command-buffer decision.
 *
 * Runs a sequence of synthetic datasets of increasing size through the *real*
 * `World.loadDataset` path (clean `disposeObject` teardown, not the leaky
 * re-solve path). For each step: load → settle (let the load GC / allocation
 * spike pass) → measure for a fixed duration → record. The owned
 * {@link LoadTestCollector} captures the per-frame trace; `endStep` computes
 * real p50/p95/p99 + dropped rate + GPU stats and a green/yellow/red verdict.
 *
 * Registered as an Engine `Updatable`, so the whole thing runs inside the XR
 * frame loop on Quest — the measurements are the actual headset frame times.
 *
 * No hardcoded results: the recommendation is computed from the recorded
 * `StepResult`s via `computeOverallVerdict`.
 */

export type LoadTestPhase = 'IDLE' | 'LOADING' | 'SETTLING' | 'MEASURING' | 'COMPLETE';

export interface LoadTestProfile {
  name?: string;
  steps: LoadTestStepSpec[];
  /** Seconds to wait after load before measuring (lets the load spike pass). */
  settleSec?: number;
  deviceTarget?: QuestDeviceTarget;
}

export interface LoadTestSummary {
  version: string;
  runId: string;
  recordedAt: number;
  profileName: string;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  xrActive: boolean;
  userAgent: string;
  aborted: boolean;
  steps: StepResult[];
  verdict: OverallVerdict;
  thresholds: typeof LOAD_TEST_THRESHOLDS;
  device: QuestRuntimeEnvironment;
  visibility: QuestVisibilityTelemetry;
  collection: {
    mode: 'bounded-on-device-aggregates';
    rawFrameTraceIncluded: false;
    datasetRowsIncluded: false;
    cameraPosesIncluded: false;
    temperatureSensorAvailable: false;
  };
  /**
   * Usability aggregates attached by World on completion (friction score/level/
   * patterns — no raw interaction trail). Optional because the driver itself is
   * decoupled from the telemetry collector.
   */
  usability?: {
    frictionLevel: string;
    dissatisfactionScore: number;
    detectedPatterns: string[];
    telemetryConsentEnabled: boolean;
  };
}

/** Minimal World surface the driver needs. */
export interface LoadTestWorldLike {
  loadDataset(entry: DatasetLoadEntry): void;
  /** Read the geometry/layout the Draco solver actually picked, if available. */
  getActiveSpecInfo?(): {
    geometry?: string;
    layout?: string;
    renderedNodeCount?: number;
  } | null;
  eventBus: { emit(topic: string, payload?: unknown): void };
}

/** Engine surface the driver needs: collector's needs + `xr.getSession()` for the xrActive flag. */
export interface LoadTestDriverEngineLike extends LoadTestEngineLike {
  renderer: LoadTestEngineLike['renderer'] & {
    xr: { getSession(): unknown };
    getContext?: () => unknown;
  };
}

/** Default staircase: TABULAR 1k → 8k → 65k → 100k → 250k (stretch). */
export const DEFAULT_LOAD_TEST_PROFILE: LoadTestProfile = {
  name: 'tabular-staircase',
  settleSec: 2,
  steps: [
    { topology: 'TABULAR', rowCount: 1_000, durationSec: 20, label: '1k' },
    { topology: 'TABULAR', rowCount: 8_000, durationSec: 20, label: '8k' },
    { topology: 'TABULAR', rowCount: 65_000, durationSec: 30, label: '65k' },
    { topology: 'TABULAR', rowCount: 100_000, durationSec: 30, label: '100k' },
    { topology: 'TABULAR', rowCount: 250_000, durationSec: 30, label: '250k (stretch)' },
  ],
};

export const QUEST_3S_QUALIFICATION_PROFILE: LoadTestProfile = {
  name: 'quest-3s-qualification',
  deviceTarget: 'META_QUEST_3S',
  settleSec: 5,
  steps: [
    { topology: 'TABULAR', rowCount: 1_000, durationSec: 30, label: '1k baseline' },
    { topology: 'TABULAR', rowCount: 8_000, durationSec: 30, label: '8k baseline' },
    { topology: 'TABULAR', rowCount: 65_000, durationSec: 45, label: '65k scale' },
    { topology: 'TABULAR', rowCount: 100_000, durationSec: 300, label: '100k soak' },
    { topology: 'TABULAR', rowCount: 250_000, durationSec: 60, label: '250k stretch' },
  ],
};

const SAMPLE_EMIT_INTERVAL_MS = 500;

export class LoadTestDriver implements Updatable {
  phase: LoadTestPhase = 'IDLE';
  readonly collector: LoadTestCollector;

  private _profile: LoadTestProfile = DEFAULT_LOAD_TEST_PROFILE;
  private _stepIndex = 0;
  private _phaseStartMs = 0;
  private _lastSampleMs = 0;
  private _startedAt = 0;
  private _finishedAt = 0;
  private _aborted = false;
  private _steps: StepResult[] = [];
  private _settleMs = 2000;
  private _currentLoadDurationMs = 0;
  private _device: QuestRuntimeEnvironment | null = null;
  private _visibilityTracker: QuestVisibilityTracker | null = null;
  private _runId = '';

  constructor(
    private readonly _world: LoadTestWorldLike,
    private readonly _engine: LoadTestDriverEngineLike,
    runtimeProbe: LoadTestRuntimeProbe = {}
  ) {
    this.collector = new LoadTestCollector(_engine, runtimeProbe);
  }

  /** Begin a run. If no profile given, uses the default staircase. */
  run(profile: LoadTestProfile = DEFAULT_LOAD_TEST_PROFILE): void {
    if (this.phase !== 'IDLE' && this.phase !== 'COMPLETE') {
      // Already running; ignore.
      return;
    }
    this._profile = profile;
    this._settleMs = Math.max(0, (profile.settleSec ?? 2) * 1000);
    this._stepIndex = 0;
    this._steps = [];
    this._aborted = false;
    this._startedAt = performance.now();
    this._runId = typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `quest-run-${Date.now()}-${Math.round(this._startedAt)}`;
    this._device = captureQuestRuntimeEnvironment(
      this._engine,
      profile.deviceTarget ?? 'UNDECLARED'
    );
    this._visibilityTracker = new QuestVisibilityTracker(this._engine.renderer.xr.getSession());
    this.collector.reset();
    this._world.eventBus.emit(WorldTopics.LOADTEST_START, {
      profileName: profile.name ?? 'custom',
      stepCount: profile.steps.length,
      startedAt: this._startedAt,
    });
    this._runNextStep();
  }

  /** Abort a running test; emits COMPLETE with whatever was collected. */
  stop(): void {
    if (this.phase === 'IDLE' || this.phase === 'COMPLETE') return;
    if (this.phase === 'MEASURING') {
      // Capture the partial step too.
      this._finishStep(true);
    }
    this._aborted = true;
    this._finishRun();
  }

  /** Engine updatable hook — drives the state machine. */
  update(_delta: number, _time: number): void {
    const now = performance.now();
    switch (this.phase) {
      case 'IDLE':
      case 'COMPLETE':
        return;
      case 'SETTLING':
        if (now - this._phaseStartMs >= this._settleMs) this._startMeasuring();
        break;
      case 'MEASURING': {
        this.collector.update(_delta, _time);
        if (now - this._lastSampleMs >= SAMPLE_EMIT_INTERVAL_MS) {
          this._lastSampleMs = now;
          this._emitSample();
        }
        const spec = this._profile.steps[this._stepIndex - 1];
        const durationMs = (spec?.durationSec ?? 0) * 1000;
        if (now - this._phaseStartMs >= durationMs) this._finishStep(false);
        break;
      }
      default:
        break;
    }
  }

  get currentStep(): LoadTestStepSpec | null {
    return this.phase === 'MEASURING' || this.phase === 'SETTLING'
      ? this._profile.steps[this._stepIndex - 1] ?? null
      : null;
  }

  get stepIndex(): number {
    return this._stepIndex;
  }

  get totalSteps(): number {
    return this._profile.steps.length;
  }

  get steps(): StepResult[] {
    return this._steps.slice();
  }

  // --- internals ---

  private _runNextStep(): void {
    if (this._stepIndex >= this._profile.steps.length) {
      this._finishRun();
      return;
    }
    const spec = this._profile.steps[this._stepIndex];
    this._stepIndex++;
    this.phase = 'LOADING';
    // Load synchronously through the clean World.loadDataset path. The heavy
    // allocation happens here, inside the settle window (not measured).
    const entry = this._buildEntry(spec);
    const loadStartedAt = performance.now();
    try {
      this._world.loadDataset(entry);
    } catch (err) {
      console.error('[LoadTestDriver] loadDataset failed for step', spec, err);
    }
    this._currentLoadDurationMs = performance.now() - loadStartedAt;
    this.phase = 'SETTLING';
    this._phaseStartMs = performance.now();
    this._world.eventBus.emit(WorldTopics.LOADTEST_STEP, {
      phase: 'SETTLING',
      stepIndex: this._stepIndex,
      totalSteps: this._profile.steps.length,
      spec,
    });
  }

  private _startMeasuring(): void {
    const spec = this._profile.steps[this._stepIndex - 1];
    this.collector.startStep(spec);
    this.phase = 'MEASURING';
    this._phaseStartMs = performance.now();
    this._lastSampleMs = this._phaseStartMs;
    this._world.eventBus.emit(WorldTopics.LOADTEST_STEP, {
      phase: 'MEASURING',
      stepIndex: this._stepIndex,
      totalSteps: this._profile.steps.length,
      spec,
    });
  }

  private _finishStep(partial: boolean): void {
    const specInfo = this._world.getActiveSpecInfo?.() ?? null;
    const result = this.collector.endStep({
      specGeometry: specInfo?.geometry,
      specLayout: specInfo?.layout,
      renderedNodeCount: specInfo?.renderedNodeCount,
      loadDurationMs: this._currentLoadDurationMs,
    });
    if (partial) {
      result.reasons = ['step aborted early', ...result.reasons];
    }
    this._steps.push(result);
    this._world.eventBus.emit(WorldTopics.LOADTEST_STEP, {
      phase: 'STEP_DONE',
      stepIndex: this._stepIndex,
      totalSteps: this._profile.steps.length,
      result,
      partial,
    });
    this._runNextStep();
  }

  private _finishRun(): void {
    this.phase = 'COMPLETE';
    this._finishedAt = performance.now();
    const verdict = computeOverallVerdict(this._steps);
    const visibility = this._visibilityTracker?.finish() ?? {
      interruptionCount: 0,
      interruptedDurationMs: 0,
      finalVisibilityState: null,
    };
    this._visibilityTracker = null;
    const summary: LoadTestSummary = {
      version: '2',
      runId: this._runId,
      recordedAt: Date.now(),
      profileName: this._profile.name ?? 'custom',
      startedAt: this._startedAt,
      finishedAt: this._finishedAt,
      durationMs: this._finishedAt - this._startedAt,
      xrActive: this._xrActive(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      aborted: this._aborted,
      steps: this._steps,
      verdict,
      thresholds: LOAD_TEST_THRESHOLDS,
      device:
        this._device ??
        captureQuestRuntimeEnvironment(this._engine, this._profile.deviceTarget ?? 'UNDECLARED'),
      visibility,
      collection: {
        mode: 'bounded-on-device-aggregates',
        rawFrameTraceIncluded: false,
        datasetRowsIncluded: false,
        cameraPosesIncluded: false,
        temperatureSensorAvailable: false,
      },
    };
    this._world.eventBus.emit(WorldTopics.LOADTEST_COMPLETE, summary);
  }

  private _emitSample(): void {
    const spec = this._profile.steps[this._stepIndex - 1];
    const frames = this.collector.liveFrameStats();
    const gpu = this.collector.liveGpu();
    this._world.eventBus.emit(WorldTopics.LOADTEST_SAMPLE, {
      stepIndex: this._stepIndex,
      totalSteps: this._profile.steps.length,
      spec,
      elapsedMs: this.collector.stepElapsedMs,
      frameCount: this.collector.frameCount,
      frames,
      gpu,
      criticalFrames: this.collector.criticalFrames,
    });
  }

  private _buildEntry(spec: LoadTestStepSpec): DatasetLoadEntry {
    const dataset = makeStressDataset(spec.topology as TopologyType, spec.rowCount);
    const encodings = getDefaultEncodings({ dataset, topology: spec.topology as TopologyType });
    return {
      key: `loadtest-${spec.topology}-${spec.rowCount}`,
      label: `Load Test ${spec.label ?? `${spec.rowCount}`}`,
      name: `Load Test ${spec.label ?? `${spec.rowCount}`}`,
      topology: spec.topology,
      dataset,
      encodings,
    };
  }

  private _xrActive(): boolean {
    try {
      return !!this._engine.renderer.xr.getSession();
    } catch {
      return false;
    }
  }
}

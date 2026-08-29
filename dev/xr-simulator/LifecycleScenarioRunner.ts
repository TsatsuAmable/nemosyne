/**
 * P1-USIM USIM-A XR lifecycle / async-race conformance runner (dev/test-only).
 *
 * Attacks the cross-layer invariant that ordinary unit mocks miss: when an XR
 * session's lifecycle changes (visibility -> hidden, input source disappears,
 * session ends) while a real async analysis is in flight, and a new session
 * begins, the Atlas/Worker generation guard must stay authoritative and
 * presentation recovery must neither duplicate nor discard a committed
 * analysis, nor replay a stale captured press as a fresh selection.
 *
 * The runner drives the REAL production surfaces:
 *  - real IWER `XRSession` / `XRFrame` / `XRInputSource` / `XRReferenceSpace`
 *    through `InputRouter.update`, exactly as USIM-0 does;
 *  - the real `DerivedAnalysisScheduler` (the RF-061 generation guard) with a
 *    deferred `compute` standing in for the in-flight Worker/WASM analysis;
 *  - real IWER lifecycle faults via `WebXRSimulatorAdapter.setSessionVisibilityState`
 *    / `setInputSourceConnected` / `endSession` / `startSession`.
 *
 * It NEVER calls NIL/Atlas/component callbacks directly: input drives the
 * router through real XR objects, selection is observed through the real
 * production `onSelect` callback, and the scheduler's `compute`/`publish`
 * callbacks are the same contract the production pipeline uses.
 */

import * as THREE from 'three';
import type { InputRouter } from '../../src/vr/InputRouter.ts';
import { DerivedAnalysisScheduler } from '../../src/vr/coordinators/DerivedAnalysisScheduler.ts';
import { WebXRSimulatorAdapter } from './WebXRSimulatorAdapter.ts';
import { XREvaluationRecorder, type XREvaluationEpisode } from './XREvaluationEpisode.ts';
import {
  bindProductionPointers,
  applyInputSourcePoseToGroup,
} from './ScenarioRunner.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface AsyncAnalysisStub {
  /** Resolves the in-flight analysis; simulates the Worker round-trip landing. */
  resolve(): void;
  resolved: boolean;
}

export interface LifecycleScenarioOptions {
  buildHash?: string;
}

export interface SchedulerOutcome {
  requested: number;
  coalesced: number;
  staleBeforeCompute: number;
  staleAfterCompute: number;
  completed: number;
  refused: number;
  failed: number;
}

export interface LifecycleScenarioResult {
  episode: XREvaluationEpisode;
  scheduler: SchedulerOutcome;
  /** Number of times `publish` was invoked on the real scheduler. */
  published: number;
  committedAnalysisIds: string[];
  /** Real production `onSelect` firings through the router. */
  baselineSelects: number;
  selectsBeforeExit: number;
  selectsAfterReenterNoPress: number;
  selectsAfterReenterFreshPress: number;
  reenterBindsSources: boolean;
  reenterRouterFunctional: boolean;
  errors: string[];
}

interface SchedulerStatsLike {
  requested: number;
  coalesced: number;
  supersededPending: number;
  staleBeforeCompute: number;
  staleAfterCompute: number;
  completed: number;
  failed: number;
}

function schedulerOutcome(stats: SchedulerStatsLike): SchedulerOutcome {
  return {
    requested: stats.requested,
    coalesced: stats.coalesced,
    staleBeforeCompute: stats.staleBeforeCompute,
    staleAfterCompute: stats.staleAfterCompute,
    completed: stats.completed,
    refused: (stats as { refused?: number }).refused ?? 0,
    failed: stats.failed,
  };
}

/**
 * Drive one XR lifecycle + in-flight async-analysis race and assert the
 * cross-layer invariant. The dataset identity guard (`isCurrent`) uses a real
 * Atlas-like dataset version + fingerprint pair so the scheduler's generation
 * authority is exercised, not a mock boolean.
 */
export class XRLifecycleScenarioRunner {
  private readonly _adapter: WebXRSimulatorAdapter;
  private readonly _router: InputRouter;
  private readonly _scene: THREE.Scene;
  private readonly _renderer: THREE.WebGLRenderer;
  private readonly _options: LifecycleScenarioOptions;

  private _datasetVersion = 1;
  private _datasetFingerprint = 'a'.repeat(64);

  constructor(
    adapter: WebXRSimulatorAdapter,
    router: InputRouter,
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    options: LifecycleScenarioOptions = {}
  ) {
    this._adapter = adapter;
    this._router = router;
    this._scene = scene;
    this._renderer = renderer;
    this._options = options;
  }

  get currentIdentity(): { datasetVersion: number; datasetFingerprint: string } {
    return {
      datasetVersion: this._datasetVersion,
      datasetFingerprint: this._datasetFingerprint,
    };
  }

  /** Simulate a governed dataset generation advance (as a real mutation would). */
  advanceGeneration(): void {
    this._datasetVersion += 1;
    this._datasetFingerprint = this._datasetFingerprint.slice(1) + '0';
  }

  private _makeAsyncAnalysis(): {
    scheduler: DerivedAnalysisScheduler<string>;
    stub: AsyncAnalysisStub;
    published: string[];
    committedIds: string[];
  } {
    const published: string[] = [];
    const committedIds: string[] = [];
    const deferred: Array<() => void> = [];
    const stub: AsyncAnalysisStub = {
      resolved: false,
      resolve() {
        deferred.forEach((fn) => fn());
        deferred.length = 0;
        stub.resolved = true;
      },
    };

    const scheduler = new DerivedAnalysisScheduler<string>({
      isCurrent: (request) =>
        request.datasetVersion === this._datasetVersion &&
        request.datasetFingerprint === this._datasetFingerprint,
      compute: (request) =>
        new Promise<string>((resolve) => {
          if (stub.resolved) {
            resolve(`analysis-v${request.datasetVersion}`);
            return;
          }
          deferred.push(() => resolve(`analysis-v${request.datasetVersion}`));
        }),
      publish: (request, result) => {
        published.push(result);
        committedIds.push(`v${request.datasetVersion}:${result}`);
      },
      defer: (cb) => queueMicrotask(cb),
    });

    return { scheduler, stub, published, committedIds };
  }

  /**
   * Run the primary lifecycle/async-race scenario:
   *   enter XR -> begin async analysis -> input-source disappears / visibility
   *   changes -> exit XR -> analysis completes -> re-enter XR (same generation)
   * and assert: exactly one committed analysis survives (no duplicate, no
   * discard), a stale captured press is NOT replayed as a fresh selection in
   * the new session, and the fresh session still binds input + drives the
   * router.
   */
  async run(
    target: THREE.Object3D,
    registerTarget: (target: THREE.Object3D) => void
  ): Promise<LifecycleScenarioResult> {
    const recorder = new XREvaluationRecorder({
      scenarioId: 'usim-a-lifecycle-async-race',
      buildHash: this._options.buildHash ?? 'unknown',
      capabilityGrant: ['input.synthetic.controller', 'analysis.async.generation'],
    });
    recorder.begin();

    const errors: string[] = [];
    const empty = (): LifecycleScenarioResult => ({
      episode: recorder.finish(),
      scheduler: schedulerOutcome({
        requested: 0,
        coalesced: 0,
        supersededPending: 0,
        staleBeforeCompute: 0,
        staleAfterCompute: 0,
        completed: 0,
        failed: 0,
      }),
      published: 0,
      committedAnalysisIds: [],
      baselineSelects: 0,
      selectsBeforeExit: 0,
      selectsAfterReenterNoPress: 0,
      selectsAfterReenterFreshPress: 0,
      reenterBindsSources: false,
      reenterRouterFunctional: false,
      errors,
    });

    const session = this._adapter.session;
    if (!session) {
      recorder.setOutcome('FAILED');
      errors.push('no active XR session');
      return empty();
    }

    const { controllers } = bindProductionPointers(
      this._renderer,
      this._router,
      this._scene,
      'controller'
    );
    this._adapter.setPrimaryInputMode('controller');
    await sleep(40);
    // Production WebXRManager connects each input source to a controller group
    // as sources connect, in connection order. Dispatch `connected` by index so
    // controller 0/1 each carry their real source's handedness; otherwise the
    // router's positional fallback double-fires selects.
    const nonHandSources = this._adapter
      .getInputSources()
      .filter((s) => !s.hand);
    nonHandSources.forEach((source, index) => {
      const target = controllers[index] ?? controllers[controllers.length - 1];
      const group = target.space as unknown as {
        dispatchEvent(e: { type: string; data: XRInputSource }): void;
      };
      group.dispatchEvent({ type: 'connected', data: source });
    });
    const controller = controllers[0];

    const refSpace = this._adapter.referenceSpace!;
    const { scheduler, stub, published, committedIds } = this._makeAsyncAnalysis();

    // Production `onSelect` is the authority for "a selection happened". The
    // test only registers it and observes the count; the router dispatches it.
    let selects = 0;
    const register = (mesh: THREE.Object3D) => {
      registerTarget(mesh);
      this._router.addInteractable(mesh, { onSelect: () => selects++ });
    };
    register(target);

    const pressAndFrame = async () => {
      await this._adapter.runInFrame((frame) => {
        const sources = this._adapter.getInputSources();
        const source = sources.find((s) => s.handedness === 'right' && !s.hand);
        if (source) applyInputSourcePoseToGroup(controller.space, source, frame, refSpace);
        this._adapter.setControllerTrigger('right', true);
        this._router.update(frame, refSpace, session, 0);
      });
    };
    const releaseAndFrame = async () => {
      await this._adapter.runInFrame((frame) => {
        this._adapter.setControllerTrigger('right', false);
        this._router.update(frame, refSpace, session, 0);
      });
    };

    // 1. Baseline: a controller press commits a selection through the real
    //    router (proves the router worked under this session).
    await pressAndFrame();
    await sleep(20);
    await releaseAndFrame();
    await sleep(20);
    const baselineSelects = selects;
    recorder.recordStep({
      stepId: 'baseline-select',
      description: 'baseline controller select committed through the real router',
      outcome: baselineSelects > 0 ? 'PASSED' : 'FAILED',
    });
    recorder.recordMeasurement({
      measurementId: 'baselineSelects',
      metric: 'router.selects.baseline',
      value: baselineSelects,
      unit: 'count',
      source: 'measured',
    });

    // 2. Begin a real async analysis (in-flight while the session races).
    scheduler.schedule({
      datasetVersion: this._datasetVersion,
      datasetFingerprint: this._datasetFingerprint,
      operation: 'tda.persistence',
    });
    await sleep(20);

    // 3. Inject lifecycle faults while the analysis is in flight and the
    //    trigger is held down: visibility -> hidden (input sources vanish),
    //    then the right source disconnects. The held press is the stale
    //    capture that must NOT replay as a selection after re-entry.
    await pressAndFrame();
    await sleep(10);
    this._adapter.setSessionVisibilityState('hidden');
    await this._adapter.runInFrame(() => 1);
    await sleep(20);
    this._adapter.setInputSourceConnected('right', false);
    await this._adapter.runInFrame(() => 1);
    await sleep(20);
    const selectsBeforeExit = selects;

    // 4. Exit XR while the analysis is still in flight.
    await this._adapter.endSession();
    await sleep(20);
    recorder.recordStep({
      stepId: 'session-end-mid-analysis',
      description: 'ended XR session while async analysis was in flight',
      outcome: 'PASSED',
    });
    recorder.recordMeasurement({
      measurementId: 'selectsBeforeExit',
      metric: 'router.selects.before_exit',
      value: selectsBeforeExit,
      unit: 'count',
      source: 'measured',
    });

    // 5. Complete the analysis after exit, then re-enter XR under the SAME
    //    dataset generation: the committed analysis must neither be duplicated
    //    nor discarded by presentation recovery. The visibility fault is a
    //    per-session device state; a fresh session starts visible with its
    //    input sources reconnected, exactly as a real device behaves.
    stub.resolve();
    await scheduler.whenIdle();

    this._adapter.setSessionVisibilityState('visible');
    this._adapter.setInputSourceConnected('right', true);
    await this._adapter.runInFrame(() => 1);
    await sleep(20);
    await this._adapter.startSession();
    const reenterBindsSources = this._adapter.getInputSources().length >= 1;
    const reenterRefSpace = this._adapter.referenceSpace!;
    const reenterSession = this._adapter.session!;

    // 6. Drive the re-entered session with the trigger STILL HELD from the old
    //    session (no fresh press edge). The router must not replay a stale
    //    captured press as a selection.
    await this._adapter.runInFrame((frame) => {
      const sources = this._adapter.getInputSources();
      const source = sources.find((s) => s.handedness === 'right' && !s.hand);
      if (source) applyInputSourcePoseToGroup(controller.space, source, frame, reenterRefSpace);
      this._router.update(frame, reenterRefSpace, reenterSession, 0);
    });
    await sleep(20);
    const selectsAfterReenterNoPress = selects;

    // 7. A FRESH press edge in the new session must produce exactly one new
    //    selection (the router is functional, not poisoned).
    await this._adapter.runInFrame((frame) => {
      const sources = this._adapter.getInputSources();
      const source = sources.find((s) => s.handedness === 'right' && !s.hand);
      if (source) applyInputSourcePoseToGroup(controller.space, source, frame, reenterRefSpace);
      this._adapter.setControllerTrigger('right', false);
      this._router.update(frame, reenterRefSpace, reenterSession, 0);
    });
    await sleep(20);
    await this._adapter.runInFrame((frame) => {
      const sources = this._adapter.getInputSources();
      const source = sources.find((s) => s.handedness === 'right' && !s.hand);
      if (source) applyInputSourcePoseToGroup(controller.space, source, frame, reenterRefSpace);
      this._adapter.setControllerTrigger('right', true);
      this._router.update(frame, reenterRefSpace, reenterSession, 0);
    });
    await sleep(20);
    await this._adapter.runInFrame((frame) => {
      this._adapter.setControllerTrigger('right', false);
      this._router.update(frame, reenterRefSpace, reenterSession, 0);
    });
    await sleep(20);
    const selectsAfterReenterFreshPress = selects;
    const reenterRouterFunctional = selectsAfterReenterFreshPress > selectsAfterReenterNoPress;

    await this._adapter.endSession();
    const statsFinal = schedulerOutcome(scheduler.stats());

    recorder.recordStep({
      stepId: 'reenter-same-generation',
      description: 're-entered XR under the same dataset generation',
      outcome: 'PASSED',
    });
    recorder.recordMeasurement({
      measurementId: 'completed',
      metric: 'scheduler.completed',
      value: statsFinal.completed,
      unit: 'count',
      source: 'measured',
    });
    recorder.recordMeasurement({
      measurementId: 'published',
      metric: 'analysis.published',
      value: published.length,
      unit: 'count',
      source: 'measured',
    });
    recorder.recordMeasurement({
      measurementId: 'committedAnalysisIds',
      metric: 'analysis.committed_ids',
      value: committedIds.length,
      unit: 'count',
      source: 'measured',
    });
    recorder.recordMeasurement({
      measurementId: 'selectsAfterReenterNoPress',
      metric: 'router.selects.after_reenter_no_press',
      value: selectsAfterReenterNoPress - selectsBeforeExit,
      unit: 'count',
      source: 'measured',
    });
    recorder.recordMeasurement({
      measurementId: 'selectsAfterReenterFreshPress',
      metric: 'router.selects.after_reenter_fresh_press',
      value: selectsAfterReenterFreshPress - selectsAfterReenterNoPress,
      unit: 'count',
      source: 'measured',
    });

    if (baselineSelects !== 1) {
      errors.push(`baseline controller press produced ${baselineSelects} selections, expected exactly 1`);
    }
    if (statsFinal.completed !== 1) {
      errors.push(`expected exactly one committed analysis, scheduler.completed=${statsFinal.completed}`);
    }
    if (published.length !== 1) {
      errors.push(`expected exactly one publish, got ${published.length}`);
    }
    if (committedIds.length !== 1) {
      errors.push(`expected exactly one committed analysis identity, got ${committedIds.length}`);
    }
    if (statsFinal.staleAfterCompute !== 0) {
      errors.push(`stale generation published after re-entry: staleAfterCompute=${statsFinal.staleAfterCompute}`);
    }
    const staleSelectsAfterReenter = selectsAfterReenterNoPress - selectsBeforeExit;
    if (staleSelectsAfterReenter !== 0) {
      errors.push(`stale captured press replayed as ${staleSelectsAfterReenter} selection(s) after re-entry`);
    }
    const freshSelects = selectsAfterReenterFreshPress - selectsAfterReenterNoPress;
    if (freshSelects !== 1) {
      errors.push(`fresh press after re-entry produced ${freshSelects} selections, expected exactly 1`);
    }
    if (!reenterBindsSources) {
      errors.push('re-entered session did not bind input sources');
    }
    if (!reenterRouterFunctional) {
      errors.push('re-entered session did not drive the router');
    }

    recorder.recordObservation({
      text: errors.length > 0 ? `lifecycle/async-race scenario completed with ${errors.length} error(s)` : 'lifecycle/async-race invariant held',
      severity: errors.length > 0 ? 'error' : 'info',
    });
    recorder.setOutcome(errors.length > 0 ? 'FAILED' : 'PASSED');

    return {
      episode: recorder.finish(),
      scheduler: statsFinal,
      published: published.length,
      committedAnalysisIds: committedIds,
      baselineSelects,
      selectsBeforeExit,
      selectsAfterReenterNoPress,
      selectsAfterReenterFreshPress,
      reenterBindsSources,
      reenterRouterFunctional,
      errors,
    };
  }

  /**
   * Stale-generation race: begin an analysis under generation N, then advance
   * the dataset generation (a governed mutation) while the analysis is still in
   * flight. Completing the analysis must be rejected by the real `isCurrent`
   * guard and never published.
   */
  async runStaleGenerationRace(): Promise<{
    episode: XREvaluationEpisode;
    scheduler: SchedulerOutcome;
    published: number;
    errors: string[];
  }> {
    const recorder = new XREvaluationRecorder({
      scenarioId: 'usim-a-lifecycle-stale-generation',
      buildHash: this._options.buildHash ?? 'unknown',
      capabilityGrant: ['analysis.async.generation'],
    });
    recorder.begin();

    const { scheduler, stub, published } = this._makeAsyncAnalysis();
    scheduler.schedule({
      datasetVersion: this._datasetVersion,
      datasetFingerprint: this._datasetFingerprint,
      operation: 'tda.persistence',
    });
    await sleep(20);

    // The analysis is in flight; a governed dataset mutation advances the
    // generation that the scheduler's `isCurrent` guard is keyed to.
    this.advanceGeneration();
    stub.resolve();
    await scheduler.whenIdle();
    const stats = schedulerOutcome(scheduler.stats());

    const errors: string[] = [];
    if (published.length !== 0) {
      errors.push(`stale-generation analysis was published (${published.length})`);
    }
    if (stats.completed !== 0) {
      errors.push(`stale-generation analysis counted as completed (${stats.completed})`);
    }
    if (stats.staleAfterCompute < 1 && stats.staleBeforeCompute < 1) {
      errors.push('stale-generation analysis was neither rejected before nor after compute');
    }

    recorder.recordStep({
      stepId: 'stale-generation-rejected',
      description: 'analysis completing after a generation advance was rejected by the real guard',
      outcome: errors.length > 0 ? 'FAILED' : 'PASSED',
    });
    recorder.recordMeasurement({
      measurementId: 'staleRejected',
      metric: 'scheduler.stale_rejected',
      value: stats.staleBeforeCompute + stats.staleAfterCompute,
      unit: 'count',
      source: 'measured',
    });
    recorder.recordMeasurement({
      measurementId: 'stalePublished',
      metric: 'analysis.stale_published',
      value: published.length,
      unit: 'count',
      source: 'measured',
    });
    recorder.recordObservation({
      text: errors.length > 0 ? `stale-generation race completed with ${errors.length} error(s)` : 'stale-generation rejection invariant held',
      severity: errors.length > 0 ? 'error' : 'info',
    });
    recorder.setOutcome(errors.length > 0 ? 'FAILED' : 'PASSED');

    return {
      episode: recorder.finish(),
      scheduler: stats,
      published: published.length,
      errors,
    };
  }
}
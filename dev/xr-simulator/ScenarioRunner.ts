/**
 * P1-USIM deterministic scenario runner (dev/test-only).
 *
 * Executes a `SimulatorScenario` fixture against a real `InputRouter` using the
 * real IWER WebXR objects, and emits bounded `XREvaluationEpisode` evidence
 * with `environment.mode = 'desktop-simulator'`.
 *
 * The runner never calls NIL/Atlas/component callbacks directly: pose and input
 * steps only mutate IWER device state, and assertions read the router's real
 * hover/selection state after a real frame. Selection occurs inside the real
 * `InputRouter.update()` path.
 */

import * as THREE from 'three';
import type { InputRouter } from '../../src/vr/InputRouter.ts';
import { ControllerPointer } from '../../src/vr/Controllers.ts';
import { HandPointer } from '../../src/vr/Hands.ts';
import { WebXRSimulatorAdapter } from './WebXRSimulatorAdapter.ts';
import { XREvaluationRecorder, type XREvaluationEpisode } from './XREvaluationEpisode.ts';
import type { SimulatorScenario, ScenarioStep } from './ScenarioFixtures.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function hashLabel(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export interface ScenarioFaultEffect {
  positionOffset?: { x: number; y: number; z: number };
  angularOffsetDeg?: { x: number; y: number; z: number };
  dropPose?: boolean;
  freezePoseMs?: number;
  workerLatencyMs?: number;
  frameSpikeMs?: number;
  disconnectInput?: boolean;
  labels?: string[];
}

export interface ScenarioFaultController {
  readonly id: string;
  readonly seed: string;
  effectForStep(step: ScenarioStep, stepIndex: number): ScenarioFaultEffect;
}

export interface ScenarioRunnerOptions {
  buildHash?: string;
  faultController?: ScenarioFaultController;
  /** Simulator-only scale applied to configured timing faults. Never physical evidence. */
  faultDelayScale?: number;
  environment?: Partial<XREvaluationEpisode['environment']>;
}

export interface ScenarioRunResult {
  episode: XREvaluationEpisode;
  selected: boolean;
  hovered: boolean;
  errors: string[];
}

/**
 * Bind real `ControllerPointer`/`HandPointer` instances to a real renderer's XR
 * groups, mirroring `Engine._setupControllersAndHands`.
 */
export function bindProductionPointers(
  renderer: THREE.WebGLRenderer,
  router: InputRouter,
  scene: THREE.Scene,
  mode: 'controller' | 'hand'
): { controllers: ControllerPointer[]; hands: HandPointer[] } {
  const controllers: ControllerPointer[] = [];
  const hands: HandPointer[] = [];
  for (let i = 0; i < 2; i++) {
    if (mode === 'controller') {
      const cp = new ControllerPointer(renderer, i);
      router.addController(cp as never);
      controllers.push(cp);
    } else {
      const hp = new HandPointer(renderer, i);
      hp.mount(scene);
      router.addHand(hp as never);
      hands.push(hp);
    }
  }
  return { controllers, hands };
}

/**
 * Faithfully bind real input sources to pointer groups the way three.js
 * `WebXRManager.onInputSourcesChange`/`WebXRController.connect()` does: it
 * dispatches a `connected` event carrying the real input source onto the
 * controller/hand group, which the production `ControllerPointer._onConnected`
 * and `HandPointer._onConnected` handlers consume to set handedness/joints.
 *
 * This keeps `handedness` production-authoritative instead of being assigned
 * manually in the test.
 */
export function bindInputSources(
  inputSources: XRInputSource[],
  controller: ControllerPointer | undefined,
  hand: HandPointer | undefined
): void {
  const dispatchConnected = (group: THREE.Object3D, source: XRInputSource) => {
    // The production handler reads `data.handedness` from the connected event;
    // dispatch the same `{ type, data: inputSource }` shape three.js emits.
    const target = group as unknown as {
      dispatchEvent(e: { type: string; data: XRInputSource }): void;
    };
    target.dispatchEvent({ type: 'connected', data: source });
  };
  for (const source of inputSources) {
    if (controller && !source.hand) {
      dispatchConnected(controller.space, source);
    }
    if (hand && source.hand) {
      dispatchConnected(hand.space, source);
    }
  }
}

/**
 * Apply the real frame pose for an input source to a three.js controller group,
 * replicating exactly what three.js `WebXRController.update()` does from
 * `frame.getPose(inputSource.targetRaySpace, referenceSpace)`.
 */
export function applyInputSourcePoseToGroup(
  group: THREE.Object3D,
  inputSource: XRInputSource,
  frame: XRFrame,
  referenceSpace: XRReferenceSpace
): boolean {
  const pose = frame.getPose(inputSource.targetRaySpace, referenceSpace);
  if (!pose) return false;
  group.matrix.fromArray(pose.transform.matrix as unknown as number[]);
  group.matrix.decompose(group.position, group.quaternion, group.scale);
  group.updateMatrixWorld(true);
  return true;
}

export class SimulatorScenarioRunner {
  private readonly _adapter: WebXRSimulatorAdapter;
  private readonly _router: InputRouter;
  private readonly _scene: THREE.Scene;
  private readonly _renderer: THREE.WebGLRenderer;
  private readonly _options: ScenarioRunnerOptions;

  constructor(
    adapter: WebXRSimulatorAdapter,
    router: InputRouter,
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    options: ScenarioRunnerOptions = {}
  ) {
    this._adapter = adapter;
    this._router = router;
    this._scene = scene;
    this._renderer = renderer;
    this._options = options;
  }

  /**
   * Run a scenario and produce bounded evidence. `registerTarget` registers the
   * production control mesh as an interactable so the real router can hover and
   * select it.
   */
  async run(
    scenario: SimulatorScenario,
    target: THREE.Object3D,
    registerTarget: (target: THREE.Object3D) => void
  ): Promise<ScenarioRunResult> {
    const recorder = new XREvaluationRecorder({
      scenarioId: scenario.id,
      buildHash: this._options.buildHash ?? 'unknown',
      capabilityGrant:
        scenario.mode === 'controller'
          ? ['input.synthetic.controller']
          : ['input.synthetic.hand_ray'],
      environment: this._options.environment,
    });
    recorder.begin();

    let selected = false;
    let hovered = false;
    const errors: string[] = [];

    const { controllers, hands } = bindProductionPointers(
      this._renderer,
      this._router,
      this._scene,
      scenario.mode
    );
    this._adapter.setPrimaryInputMode(scenario.mode === 'controller' ? 'controller' : 'hand');
    await sleep(40);
    const controller = controllers[0];
    // Faithful WebXR binding: the production _onConnected handlers set
    // handedness from the real input source, exactly as three.js WebXRManager
    // does when a session connects input sources.
    bindInputSources(this._adapter.getInputSources(), controller, hands[0]);

    for (const [stepIndex, step] of scenario.steps.entries()) {
      const faultEffect = this._options.faultController?.effectForStep(step, stepIndex) ?? {};
      const outcome = await this._applyStep(
        step,
        target,
        registerTarget,
        controller,
        scenario.mode,
        {
          selected,
          hovered,
        },
        faultEffect
      );
      selected = outcome.selected;
      hovered = outcome.hovered;
      if (outcome.error) errors.push(outcome.error);
      for (const label of faultEffect.labels ?? []) {
        recorder.recordObservation({
          text: `fault:${label} step=${step.id} seed=${this._options.faultController?.seed ?? 'none'}`,
          severity: 'warning',
          evidenceRef: step.id,
        });
      }
      recorder.recordStep({
        stepId: step.id,
        description: step.description,
        outcome: outcome.error ? 'FAILED' : 'PASSED',
        poseRef: step.kind === 'pose' ? step.id : null,
      });
    }

    if (this._options.faultController) {
      recorder.recordMeasurement({
        measurementId: 'fault.seedHash',
        metric: 'fault.seedHash',
        value: hashLabel(this._options.faultController.seed),
        unit: null,
        source: 'observed',
      });
      recorder.recordObservation({
        text: `fault-envelope=${this._options.faultController.id}; seed=${this._options.faultController.seed}`,
        severity: 'info',
      });
    }
    recorder.recordMeasurement({
      measurementId: 'scenario.inputMode',
      metric: 'scenario.inputMode',
      value: scenario.mode === 'controller' ? 0 : 1,
      unit: null,
      source: 'observed',
    });
    recorder.recordMeasurement({
      measurementId: 'targetSelected',
      metric: 'targetSelected',
      value: selected ? 1 : 0,
      unit: 'count',
      source: 'measured',
    });
    recorder.recordObservation({
      text:
        errors.length > 0
          ? `scenario completed with ${errors.length} error(s)`
          : 'scenario completed cleanly',
      severity: errors.length > 0 ? 'error' : 'info',
    });
    recorder.setOutcome(errors.length > 0 ? 'FAILED' : selected ? 'PASSED' : 'INCOMPLETE');

    return { episode: recorder.finish(), selected, hovered, errors };
  }

  private async _applyStep(
    step: ScenarioStep,
    target: THREE.Object3D,
    registerTarget: (target: THREE.Object3D) => void,
    controller: ControllerPointer | undefined,
    mode: 'controller' | 'hand',
    state: { selected: boolean; hovered: boolean },
    fault: ScenarioFaultEffect = {}
  ): Promise<{ selected: boolean; hovered: boolean; error?: string }> {
    const refSpace = this._adapter.referenceSpace;
    const session = this._adapter.session;
    if (!refSpace || !session) return { ...state, error: 'no active session' };

    const delayScale = Math.max(0, this._options.faultDelayScale ?? 1);
    const configuredDelayMs =
      (fault.freezePoseMs ?? 0) + (fault.workerLatencyMs ?? 0) + (fault.frameSpikeMs ?? 0);
    if (configuredDelayMs > 0 && delayScale > 0) await sleep(configuredDelayMs * delayScale);

    const stepSide = 'side' in step ? step.side : 'right';
    if (fault.disconnectInput) this._adapter.setInputSourceConnected(stepSide, false);

    const frameResult = await this._adapter.runInFrame((frame) => {
      if (step.kind === 'pose' && !fault.dropPose) {
        const offset = fault.positionOffset ?? { x: 0, y: 0, z: 0 };
        if (step.head) {
          this._adapter.setHeadPose(
            step.head.x + offset.x,
            step.head.y + offset.y,
            step.head.z + offset.z
          );
          if (fault.angularOffsetDeg)
            this._adapter.setHeadOrientationDegrees(fault.angularOffsetDeg);
        }
        if (mode === 'hand') {
          const hand = this._adapter.device.hands[step.side];
          if (hand) {
            hand.position.set(
              step.position.x + offset.x,
              step.position.y + offset.y,
              step.position.z + offset.z
            );
            if (fault.angularOffsetDeg)
              this._adapter.setHandOrientationDegrees(step.side, fault.angularOffsetDeg);
            else hand.quaternion.set(0, 0, 0, 1);
            this._adapter.configureHandPinch(step.side, step.pinched ?? false);
          }
        } else {
          this._adapter.setControllerPosition(
            step.side,
            step.position.x + offset.x,
            step.position.y + offset.y,
            step.position.z + offset.z
          );
          if (fault.angularOffsetDeg)
            this._adapter.setControllerOrientationDegrees(step.side, fault.angularOffsetDeg);
        }
      }

      if (step.kind === 'input') {
        if (step.trigger !== undefined) this._adapter.setControllerTrigger(step.side, step.trigger);
        if (step.pinch !== undefined) this._adapter.configureHandPinch(step.side, step.pinch);
      }

      if (controller) {
        const side = 'side' in step ? step.side : 'right';
        const source = this._adapter.getInputSources().find((s) => s.handedness === side);
        if (source) applyInputSourcePoseToGroup(controller.space, source, frame, refSpace);
      }

      registerTarget(target);
      this._router.update(frame, refSpace, session, 0);

      if (step.kind === 'assert') {
        const hit = !!this._router.hovered;
        return { ok: step.assertion === 'none' ? true : hit, hovered: hit, selected: hit };
      }
      return { ok: true, hovered: !!this._router.hovered, selected: state.selected };
    });

    if (fault.disconnectInput) {
      this._adapter.setInputSourceConnected(stepSide, true);
      // Let the real emulated session publish the reconnect before the next
      // semantic action. No synthetic input is replayed across the outage.
      await this._adapter.runInFrame(() => undefined);
    }

    if (!frameResult) {
      return { ...state, error: 'no real XR frame produced' };
    }

    let error: string | undefined;
    if (step.kind === 'assert' && step.assertion !== 'none' && !frameResult.ok) {
      error = `assertion '${step.assertion}' failed (no hover/selection)`;
    }

    return { selected: frameResult.selected, hovered: frameResult.hovered, error };
  }
}

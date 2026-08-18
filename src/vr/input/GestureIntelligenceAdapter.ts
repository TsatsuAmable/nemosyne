/**
 * Host-side adapter connecting Nemosyne XR Hand tracking to the
 * @nemosyne/gesture-intelligence GestureEngine.
 *
 * Translates Three.js spatial frames into plain Vec3 HandSample records,
 * performs per-frame heuristic & asynchronous ONNX neural classification,
 * tracks honest provenance, and dispatches analysis actions.
 */

import * as THREE from 'three';
import {
  createGestureEngine,
  CaptureRecorder,
  createPersonalizer,
  type GestureEngine,
  type ClassificationResult,
  type CalibrationState,
  type EngineOptions,
  type EngineStatus,
  type GestureClass,
  type HandSample,
  type Provenance,
  type RawInstance,
} from '../../../modules/gesture-intelligence/src/index.ts';
import type { HandLike } from '../coordinators/types.ts';

export interface GestureIntelligenceAdapterOptions extends EngineOptions {
  cooldown?: number;
  confidenceThreshold?: number;
  onGesture?: (name: string, ctx: Record<string, unknown>) => void;
}

export class GestureIntelligenceAdapter {
  private _engine: GestureEngine;
  private _recorder = new CaptureRecorder();
  private _cooldown: number;
  private _confidenceThreshold: number;
  private _lastGestureTime = 0;
  private _lastGestureName: string | null = null;
  private _lastResult: ClassificationResult | null = null;
  private _onGesture?: (name: string, ctx: Record<string, unknown>) => void;

  constructor(options: GestureIntelligenceAdapterOptions = {}) {
    const personalizer = options.personalizer ?? createPersonalizer();
    this._engine = createGestureEngine({ ...options, personalizer });
    this._cooldown = options.cooldown ?? 0.65;
    this._confidenceThreshold = options.confidenceThreshold ?? 0.55;
    this._onGesture = options.onGesture;
  }

  get engine(): GestureEngine {
    return this._engine;
  }

  get lastResult(): ClassificationResult | null {
    return this._lastResult;
  }

  get lastProvenance(): Provenance | null {
    return this._lastResult?.provenance ?? null;
  }

  async init(): Promise<EngineStatus> {
    return this._engine.init();
  }

  status(): EngineStatus {
    return this._engine.status();
  }

  recordHand(handedness: string, position: THREE.Vector3, pinched: boolean, timestamp: number): void {
    const sample: HandSample = {
      hand: handedness === 'left' ? 'left' : 'right',
      position: { x: position.x, y: position.y, z: position.z },
      pinched,
      timestamp,
    };
    this._engine.recordSample(sample);
    this._recorder.record(sample);
  }

  recordHands(hands: HandLike[], timestamp: number): void {
    for (const h of hands) {
      if (!h) continue;
      const handedness = h.handedness ?? 'right';
      const pos = new THREE.Vector3();
      if (h.getHandTransform) {
        const q = new THREE.Quaternion();
        h.getHandTransform(pos, q);
      } else if (h.rayOrigin) {
        pos.copy(h.rayOrigin as unknown as THREE.Vector3);
      }
      const pinched = h.isPinched?.() ?? (typeof h.pinchDistance === 'number' ? h.pinchDistance < 0.045 : false);
      this.recordHand(handedness, pos, pinched, timestamp);
    }
  }

  classify(time: number): ClassificationResult {
    const result = this._engine.classify();
    this._lastResult = result;
    this._maybeDispatch(result, time);
    return result;
  }

  async classifyWithNeural(time: number): Promise<ClassificationResult> {
    const result = await this._engine.classifyWithNeural();
    this._lastResult = result;
    this._maybeDispatch(result, time);
    return result;
  }

  startCapture(label: GestureClass): void {
    this._recorder.arm(label);
  }

  isCapturing(): boolean {
    return this._recorder.isArmed();
  }

  stopCapture(): RawInstance | null {
    return this._recorder.stop();
  }

  getCalibration(): CalibrationState {
    return this._engine.getCalibration();
  }

  reportFeedback(gesture: GestureClass, confirmed: boolean): void {
    this._engine.reportFeedback(gesture, confirmed);
  }

  reset(): void {
    this._recorder.reset();
    this._lastGestureTime = 0;
    this._lastGestureName = null;
    this._lastResult = null;
  }

  get lastGestureName(): string | null {
    return this._lastGestureName;
  }

  dispose(): void {
    this._engine.dispose();
  }

  private _maybeDispatch(result: ClassificationResult, time: number): void {
    if (result.gesture === 'idle') return;
    if (result.confidence < this._confidenceThreshold) return;

    if (time - this._lastGestureTime < this._cooldown) return;

    this._lastGestureTime = time;
    this._lastGestureName = result.gesture;

    if (this._onGesture) {
      this._onGesture(result.gesture, {
        confidence: result.confidence,
        provenance: result.provenance,
        scores: result.scores,
        timestamp: time,
      });
    }
  }
}

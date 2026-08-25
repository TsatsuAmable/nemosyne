/**
 * GestureEngine — pluggable facade wiring trajectory buffers, feature
 * extraction, the heuristic classifier, an optional injected neural
 * classifier, personalization, and persistence into one lifecycle.
 *
 * Provenance is honest by construction: `source` reports the path that
 * actually produced the numbers; a skipped neural path surfaces as an
 * explicit `degradedReason`.
 */

import {
  GESTURE_CLASSES,
  type CalibrationState,
  type ClassificationResult,
  type DegradedReason,
  type EngineInitState,
  type EngineOptions,
  type EngineStatus,
  type GestureClass,
  type GestureEngine,
  type HandSample,
  type Provenance,
  type StoredProfile,
} from './contracts.ts';
import { TrajectoryBuffer } from './trajectory.ts';
import { extractFeatures } from './features.ts';
import { classifyHeuristic, idleConfidence } from './heuristic.ts';
import { createCalibrationState, updateCalibration } from './calibration.ts';
import { createPersistence } from './store.ts';

const DEFAULT_PROFILE_ID = 'default';
const OPTIMIZE_EVERY = 8;
const DEFAULT_HISTORY_LIMIT = 60;

function defaultClock(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function isCalibrationLike(value: unknown): value is CalibrationState {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Partial<CalibrationState>;
  return (
    typeof c.moveThreshold === 'number' &&
    typeof c.pinchThreshold === 'number' &&
    typeof c.releaseThreshold === 'number' &&
    typeof c.meanSpeedEma === 'number'
  );
}

export function createGestureEngine(options: EngineOptions = {}): GestureEngine {
  const clock = options.clock ?? defaultClock;
  const buffer = new TrajectoryBuffer(options.historyLimit ?? DEFAULT_HISTORY_LIMIT);
  const persistence =
    options.persistence ??
    (typeof indexedDB !== 'undefined' || typeof window !== 'undefined'
      ? createPersistence()
      : undefined);
  const neural = options.neural ?? null;
  const personalizer = options.personalizer ?? null;
  const profileId = options.profileId ?? DEFAULT_PROFILE_ID;

  let initState: EngineInitState = 'idle';
  let calibration = createCalibrationState();
  let feedbackCount = 0;
  let sessionErrorWarned = false;

  function windowStats(): { sampleCount: number; windowMs: number } {
    let newest = -Infinity;
    let oldest = Infinity;
    let count = 0;
    for (const hand of buffer.hands()) {
      const frames = buffer.frames(hand);
      count += frames.length;
      if (frames.length > 0) {
        newest = Math.max(newest, frames[frames.length - 1].timestamp);
        oldest = Math.min(oldest, frames[0].timestamp);
      }
    }
    return {
      sampleCount: count,
      windowMs: Number.isFinite(newest) ? Math.max(newest - oldest, 0) : 0,
    };
  }

  function heuristicResult(
    features: Float32Array,
    degradedReason: DegradedReason | null,
    latencyMs: number
  ): ClassificationResult {
    const verdict = classifyHeuristic(features, calibration);
    const { sampleCount, windowMs } = windowStats();
    const provenance: Provenance = {
      source: 'heuristic',
      modelVersion: null,
      latencyMs,
      sampleCount,
      windowMs,
      degradedReason,
    };
    if (verdict.gesture === 'idle' && verdict.triggerStrength === 0) {
      return {
        gesture: 'idle',
        confidence: 0,
        scores: null,
        provenance,
      };
    }
    if (verdict.gesture === 'idle') {
      return {
        gesture: 'idle',
        confidence: idleConfidence(verdict.triggerStrength),
        scores: null,
        provenance,
      };
    }
    return {
      gesture: verdict.gesture,
      confidence: verdict.confidence,
      scores: null,
      provenance,
    };
  }

  function neuralDegradedReason(): DegradedReason | null {
    if (!neural) return null;
    if (!neural.ready) return 'init-failed';
    return 'stale-neural';
  }

  async function init(): Promise<EngineStatus> {
    initState = 'loading';
    if (persistence) {
      try {
        const stored = await persistence.loadProfile(profileId);
        if (stored && isCalibrationLike(stored.calibration)) {
          calibration = { ...stored.calibration };
        }
      } catch (err) {
        console.warn('[gesture-engine] profile load failed:', err);
      }
    }
    if (neural) {
      try {
        await neural.init();
      } catch (err) {
        console.warn('[gesture-engine] neural init failed:', err);
      }
    }
    initState = 'ready';
    return status();
  }

  function recordSample(sample: HandSample): void {
    const prev = buffer.frames(sample.hand);
    const prevFrame = prev.length > 0 ? prev[prev.length - 1] : undefined;
    calibration = updateCalibration(calibration, sample, prevFrame, clock);
    buffer.push(sample);
  }

  function classify(): ClassificationResult {
    const t0 = clock();
    const left = buffer.frames('left');
    const right = buffer.frames('right');
    const features = extractFeatures(left, right);
    if (!features) {
      return {
        gesture: 'idle',
        confidence: 0,
        scores: null,
        provenance: {
          source: 'heuristic',
          modelVersion: null,
          latencyMs: clock() - t0,
          sampleCount: windowStats().sampleCount,
          windowMs: 0,
          degradedReason: 'insufficient-data',
        },
      };
    }
    return heuristicResult(features, neuralDegradedReason(), clock() - t0);
  }

  async function classifyWithNeural(): Promise<ClassificationResult> {
    const t0 = clock();
    const left = buffer.frames('left');
    const right = buffer.frames('right');
    const features = extractFeatures(left, right);
    if (!features) {
      return {
        gesture: 'idle',
        confidence: 0,
        scores: null,
        provenance: {
          source: 'heuristic',
          modelVersion: null,
          latencyMs: clock() - t0,
          sampleCount: windowStats().sampleCount,
          windowMs: 0,
          degradedReason: 'insufficient-data',
        },
      };
    }
    if (neural && neural.ready) {
      try {
        const scored = await neural.score(features);
        const { sampleCount, windowMs } = windowStats();
        let best: GestureClass = 'idle';
        let bestScore = -1;
        for (const gesture of GESTURE_CLASSES) {
          if (scored.scores[gesture] > bestScore) {
            bestScore = scored.scores[gesture];
            best = gesture;
          }
        }
        return {
          gesture: best,
          confidence: Math.min(Math.max(bestScore, 0), 1),
          scores: scored.scores,
          provenance: {
            source: 'onnx',
            modelVersion: scored.modelVersion,
            latencyMs: scored.latencyMs,
            sampleCount,
            windowMs,
            degradedReason: null,
          },
        };
      } catch (err) {
        if (!sessionErrorWarned) {
          console.warn('[gesture-engine] neural score failed, falling back:', err);
          sessionErrorWarned = true;
        }
        return heuristicResult(features, 'session-error', clock() - t0);
      }
    }
    return heuristicResult(features, neuralDegradedReason(), clock() - t0);
  }

  async function persistProfile(): Promise<void> {
    if (!persistence) return;
    const profile: StoredProfile = {
      schemaVersion: 2,
      profileId,
      updatedAt: clock(),
      calibration,
      feedbackStats: personalizer ? personalizer.stats() : { confirms: 0, corrections: 0, lastUpdatedAt: 0 },
    };
    try {
      await persistence.saveProfile(profileId, profile);
    } catch (err) {
      console.warn('[gesture-engine] profile save failed:', err);
    }
  }

  function reportFeedback(gesture: GestureClass, confirmed: boolean): void {
    if (!personalizer) return;
    const features = extractFeatures(buffer.frames('left'), buffer.frames('right'));
    if (!features) return;
    personalizer.ingest({
      gesture,
      confirmed,
      timestamp: clock(),
      features: new Float32Array(features),
    });
    feedbackCount += 1;
    if (feedbackCount % OPTIMIZE_EVERY === 0) {
      const result = personalizer.optimize();
      if (result && result.replayF1After > result.replayF1Before) {
        calibration = { ...result.calibration };
        void persistProfile();
      }
    }
  }

  function status(): EngineStatus {
    return {
      init: initState,
      runtime: neural && neural.ready ? 'onnx' : 'heuristic',
      modelVersion: neural ? neural.modelVersion : null,
      persistenceBackend: persistence ? persistence.backend : 'disabled',
      supportedGestures: GESTURE_CLASSES,
    };
  }

  function getCalibration(): CalibrationState {
    return { ...calibration };
  }

  function dispose(): void {
    neural?.dispose();
    persistence?.close();
  }

  return {
    init,
    recordSample,
    classify,
    classifyWithNeural,
    getCalibration,
    reportFeedback,
    status,
    dispose,
  };
}


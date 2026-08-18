/**
 * On-device personalization: a closed, measurable threshold-tuning loop.
 *
 * Feedback samples are stored in a bounded ring buffer. `optimize()` performs a
 * coordinate search over (moveThreshold, pinchThreshold) — each varied ±40% of
 * the current calibration in 10% steps — and replays the confirmed corpus
 * through {@link classifyHeuristic} to maximize replayed macro-F1. A result is
 * returned only when a confirmed corpus exists; the engine decides whether to
 * adopt it (it gates on `replayF1After > replayF1Before`).
 *
 * `exportCorpus()` emits the JSONL schema a future retraining step needs:
 * one line per sample with the 56-dim features array, the detected label, and
 * whether the user confirmed it. Neural weight fine-tuning is explicitly out
 * of scope; this module never claims `weightsApplied`.
 *
 * Honesty note: only *confirmed* samples are used as positive labels for the
 * replayed F1 (their `gesture` is the user-endorsed true label). Corrected
 * samples are recorded for stats and corpus export but are not used as positive
 * labels — a correction tells us the detection was wrong, not what the right
 * gesture was, so treating them as positives would fabricate labels.
 */

import {
  GESTURE_CLASSES,
  type CalibrationState,
  type FeedbackSample,
  type FeedbackStats,
  type PersonalizationResult,
  type PersonalizerPort,
} from './contracts.ts';
import { classifyHeuristic } from './heuristic.ts';

const RING_CAP = 200;
const MIN_CONFIRMED = 5;
const PINCH_RELEASE_RATIO = 0.66;

export interface PersonalizerOptions {
  readonly initial?: CalibrationState;
  readonly cap?: number;
}

export type Personalizer = PersonalizerPort & {
  exportCorpus(): string;
};

function macroF1(confirmed: readonly FeedbackSample[], calibration: CalibrationState): number {
  const tp = new Array<number>(GESTURE_CLASSES.length).fill(0);
  const fp = new Array<number>(GESTURE_CLASSES.length).fill(0);
  const fn = new Array<number>(GESTURE_CLASSES.length).fill(0);
  for (const s of confirmed) {
    const verdict = classifyHeuristic(s.features, calibration);
    const predIdx = GESTURE_CLASSES.indexOf(verdict.gesture);
    const trueIdx = GESTURE_CLASSES.indexOf(s.gesture);
    if (predIdx === trueIdx) {
      tp[trueIdx] += 1;
    } else {
      fp[predIdx] += 1;
      fn[trueIdx] += 1;
    }
  }
  let sum = 0;
  let supported = 0;
  for (let c = 0; c < GESTURE_CLASSES.length; c++) {
    if (tp[c] + fn[c] === 0) continue;
    supported += 1;
    if (tp[c] === 0) continue;
    sum += (2 * tp[c]) / (2 * tp[c] + fp[c] + fn[c]);
  }
  return supported === 0 ? 0 : sum / supported;
}

function grid(center: number): number[] {
  const out: number[] = [];
  for (let step = -4; step <= 4; step++) {
    out.push(center * (1 + step * 0.1));
  }
  return out;
}

export function createPersonalizer(options: PersonalizerOptions = {}): Personalizer {
  const cap = options.cap ?? RING_CAP;
  const baseCalibration = options.initial;
  const samples: FeedbackSample[] = [];
  let confirms = 0;
  let corrections = 0;
  let lastUpdatedAt = 0;

  function ingest(sample: FeedbackSample): void {
    samples.push(sample);
    if (samples.length > cap) samples.splice(0, samples.length - cap);
    if (sample.confirmed) confirms += 1;
    else corrections += 1;
    lastUpdatedAt = sample.timestamp;
  }

  function stats(): FeedbackStats {
    return { confirms, corrections, lastUpdatedAt };
  }

  function reset(): void {
    samples.length = 0;
    confirms = 0;
    corrections = 0;
    lastUpdatedAt = 0;
  }

  function optimize(): PersonalizationResult | null {
    const confirmed = samples.filter((s) => s.confirmed);
    if (confirmed.length < MIN_CONFIRMED) return null;
    const current: CalibrationState = baseCalibration ?? {
      moveThreshold: 0.12,
      pinchThreshold: 0.6,
      releaseThreshold: 0.4,
      meanSpeedEma: 0,
      updatedAt: lastUpdatedAt,
    };
    const beforeF1 = macroF1(confirmed, current);
    let bestCal = current;
    let bestF1 = beforeF1;
    for (const move of grid(current.moveThreshold)) {
      if (move <= 0) continue;
      for (const pinch of grid(current.pinchThreshold)) {
        if (pinch <= 0 || pinch > 1) continue;
        const candidate: CalibrationState = {
          moveThreshold: move,
          pinchThreshold: pinch,
          releaseThreshold: pinch * PINCH_RELEASE_RATIO,
          meanSpeedEma: current.meanSpeedEma,
          updatedAt: lastUpdatedAt,
        };
        const f1 = macroF1(confirmed, candidate);
        if (f1 > bestF1) {
          bestF1 = f1;
          bestCal = candidate;
        }
      }
    }
    return {
      calibration: bestCal,
      replayF1Before: beforeF1,
      replayF1After: bestF1,
      samplesUsed: confirmed.length,
    };
  }

  function exportCorpus(): string {
    const lines: string[] = [];
    for (const s of samples) {
      const row = {
        features: Array.from(s.features),
        label: s.gesture,
        confirmed: s.confirmed,
      };
      lines.push(JSON.stringify(row));
    }
    return lines.join('\n') + (lines.length > 0 ? '\n' : '');
  }

  return {
    ingest,
    stats,
    optimize,
    reset,
    exportCorpus,
  };
}
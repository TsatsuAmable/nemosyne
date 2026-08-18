import { describe, expect, it } from 'vitest';
import { createCalibrationState } from '../src/calibration.ts';
import { createPersonalizer } from '../src/personalizer.ts';
import type { FeedbackSample, GestureClass } from '../src/contracts.ts';

function scoopFeatures(strong = true): Float32Array {
  const f = new Float32Array(56);
  f[17] = strong ? 0.8 : 0.3;
  f[37] = strong ? 0.8 : 0.3;
  return f;
}

function confirmedSample(gesture: GestureClass, features: Float32Array, t = 0): FeedbackSample {
  return { gesture, confirmed: true, timestamp: t, features: new Float32Array(features) };
}

describe('createPersonalizer', () => {
  it('optimizer improves a miscalibrated fixture', () => {
    const miscalibrated = createCalibrationState({
      moveThreshold: 0.5,
      pinchThreshold: 0.6,
      releaseThreshold: 0.4,
      meanSpeedEma: 0,
      updatedAt: 0,
    });
    const personalizer = createPersonalizer({ initial: miscalibrated });
    for (let i = 0; i < 8; i++) {
      personalizer.ingest(confirmedSample('scoopUp', scoopFeatures(true), i * 100));
    }
    const result = personalizer.optimize();
    expect(result).not.toBeNull();
    expect(result!.replayF1After).toBeGreaterThan(result!.replayF1Before);
    expect(result!.replayF1Before).toBe(0);
    expect(result!.replayF1After).toBeCloseTo(1, 5);
    expect(result!.calibration.moveThreshold).toBeLessThan(miscalibrated.moveThreshold);
    expect(result!.samplesUsed).toBe(8);
  });

  it('no-improvement case returns result with after <= before', () => {
    const alreadyGood = createCalibrationState();
    const personalizer = createPersonalizer({ initial: alreadyGood });
    for (let i = 0; i < 8; i++) {
      personalizer.ingest(confirmedSample('scoopUp', scoopFeatures(true), i * 100));
    }
    const result = personalizer.optimize();
    expect(result).not.toBeNull();
    expect(result!.replayF1After).toBeLessThanOrEqual(result!.replayF1Before);
    expect(result!.calibration.moveThreshold).toBeCloseTo(alreadyGood.moveThreshold, 5);
  });

  it('returns null when too few confirmed samples', () => {
    const personalizer = createPersonalizer();
    for (let i = 0; i < 4; i++) {
      personalizer.ingest(confirmedSample('scoopUp', scoopFeatures(), i));
    }
    expect(personalizer.optimize()).toBeNull();
  });

  it('stats track confirms and corrections independently', () => {
    const personalizer = createPersonalizer();
    personalizer.ingest(confirmedSample('scoopUp', scoopFeatures(), 10));
    personalizer.ingest({ ...confirmedSample('scoopUp', scoopFeatures(), 20), confirmed: false });
    const stats = personalizer.stats();
    expect(stats.confirms).toBe(1);
    expect(stats.corrections).toBe(1);
    expect(stats.lastUpdatedAt).toBe(20);
  });

  it('ring buffer caps at 200 samples (fifo eviction)', () => {
    const personalizer = createPersonalizer({ cap: 3 });
    for (let i = 0; i < 5; i++) {
      personalizer.ingest(confirmedSample('scoopUp', scoopFeatures(), i));
    }
    const stats = personalizer.stats();
    expect(stats.confirms).toBe(5);
    const corpus = personalizer.exportCorpus();
    expect(corpus.trim().split('\n').length).toBe(3);
  });

  it('exportCorpus round-trips JSONL with features array + label + confirmed', () => {
    const personalizer = createPersonalizer();
    personalizer.ingest(confirmedSample('scoopUp', scoopFeatures(), 100));
    personalizer.ingest({
      gesture: 'pinchTogether',
      confirmed: false,
      timestamp: 200,
      features: scoopFeatures(false),
    });
    const text = personalizer.exportCorpus();
    const lines = text.trim().split('\n');
    expect(lines.length).toBe(2);
    for (const line of lines) {
      const row = JSON.parse(line) as { features: number[]; label: string; confirmed: boolean };
      expect(row.features.length).toBe(56);
      expect(typeof row.label).toBe('string');
      expect(typeof row.confirmed).toBe('boolean');
    }
    const first = JSON.parse(lines[0]) as { features: number[]; label: string; confirmed: boolean };
    expect(first.label).toBe('scoopUp');
    expect(first.confirmed).toBe(true);
    expect(first.features[17]).toBeCloseTo(0.8, 5);
  });

  it('reset clears the corpus and stats', () => {
    const personalizer = createPersonalizer();
    personalizer.ingest(confirmedSample('scoopUp', scoopFeatures(), 1));
    personalizer.reset();
    expect(personalizer.stats().confirms).toBe(0);
    expect(personalizer.optimize()).toBeNull();
    expect(personalizer.exportCorpus()).toBe('');
  });
});
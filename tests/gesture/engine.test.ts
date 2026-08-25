// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createGestureEngine } from '../../src/gesture/engine.ts';
import type {
  GesturePersistence,
  GestureEngine,
  HandSample,
  NeuralClassifierPort,
  NeuralScore,
  PersonalizerPort,
  PersonalizationResult,
  StoredProfile,
} from '../../src/gesture/contracts.ts';

const clock = () => 0;

function feed(
  engine: GestureEngine,
  build: (i: number) => { l: [number, number, number]; r: [number, number, number]; pinched?: boolean }
) {
  for (let i = 0; i < 24; i++) {
    const { l, r, pinched = false } = build(i);
    const t = i * 100;
    const left: HandSample = { hand: 'left', position: { x: l[0], y: l[1], z: l[2] }, pinched, timestamp: t };
    const right: HandSample = { hand: 'right', position: { x: r[0], y: r[1], z: r[2] }, pinched, timestamp: t };
    engine.recordSample(left);
    engine.recordSample(right);
  }
}

function stubNeural(throwing = false): NeuralClassifierPort & { calls: number } {
  return {
    calls: 0,
    ready: true,
    modelVersion: 'stub-1',
    init: async () => true,
    async score(features: Float32Array): Promise<NeuralScore> {
      if (throwing) throw new Error('session blew up');
      (this as { calls: number }).calls += 1;
      expect(features.length).toBe(56);
      return {
        scores: { idle: 0.05, pinchTogether: 0.8, pinchApart: 0.05, scoopUp: 0.04, pushForward: 0.03, bothPinched: 0.03 },
        latencyMs: 2,
        modelVersion: 'stub-1',
      };
    },
    dispose() {},
  };
}

function stubPersonalizer(improves: boolean): PersonalizerPort {
  const stats = { confirms: 0, corrections: 0, lastUpdatedAt: 0 };
  return {
    ingest: () => {
      stats.confirms += 1;
      stats.lastUpdatedAt = 1;
    },
    stats: () => ({ ...stats }),
    optimize: (): PersonalizationResult | null => ({
      calibration: {
        moveThreshold: 0.2,
        pinchThreshold: 0.6,
        releaseThreshold: 0.4,
        meanSpeedEma: 0,
        updatedAt: 42,
      },
      replayF1Before: 0.5,
      replayF1After: improves ? 0.7 : 0.4,
      samplesUsed: 8,
    }),
    reset: () => {
      stats.confirms = 0;
      stats.corrections = 0;
      stats.lastUpdatedAt = 0;
    },
  };
}

function memoryPersistence(): GesturePersistence & { saved: StoredProfile[] } {
  const impl: GesturePersistence & { saved: StoredProfile[] } = {
    backend: 'memory',
    saved: [],
    async loadProfile() {
      return null;
    },
    async saveProfile(_id: string, profile: StoredProfile) {
      impl.saved.push(profile);
      return true;
    },
    async deleteProfile() {
      return true;
    },
    close() {},
  };
  return impl;
}

describe('createGestureEngine', () => {
  it('init reaches ready without any optional deps', async () => {
    const engine = createGestureEngine({ persistence: undefined, clock });
    const status = await engine.init();
    expect(status.init).toBe('ready');
    expect(status.runtime).toBe('heuristic');
    expect(status.persistenceBackend).toBe('disabled');
  });

  it('sync classify labels honest provenance per configuration', async () => {
    const noNeural = createGestureEngine({ persistence: memoryPersistence(), clock });
    await noNeural.init();
    feed(noNeural, () => ({ l: [0, 1, 0], r: [0.4, 1, 0] }));
    const a = noNeural.classify();
    expect(a.provenance.source).toBe('heuristic');
    expect(a.provenance.degradedReason).toBeNull();

    const brokenNeural = createGestureEngine({
      persistence: memoryPersistence(),
      neural: { ...stubNeural(), ready: false, init: async () => false },
      clock,
    });
    await brokenNeural.init();
    feed(brokenNeural, () => ({ l: [0, 1, 0], r: [0.4, 1, 0] }));
    const b = brokenNeural.classify();
    expect(b.provenance.source).toBe('heuristic');
    expect(b.provenance.degradedReason).toBe('init-failed');
  });

  it('reports insufficient-data before any samples', async () => {
    const engine = createGestureEngine({ persistence: memoryPersistence(), clock });
    await engine.init();
    const r = engine.classify();
    expect(r.gesture).toBe('idle');
    expect(r.confidence).toBe(0);
    expect(r.provenance.degradedReason).toBe('insufficient-data');
  });

  it('classifies a scooping trajectory end-to-end', async () => {
    const engine = createGestureEngine({ persistence: memoryPersistence(), clock });
    await engine.init();
    feed(engine, (i) => ({ l: [0, 1 + i * 0.02, 0], r: [0.4, 1 + i * 0.02, 0] }));
    const r = engine.classify();
    expect(r.gesture).toBe('scoopUp');
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.provenance.sampleCount).toBe(48);
    expect(r.provenance.windowMs).toBe(2300);
  });

  it('neural path reports onnx source with the stub numbers', async () => {
    const neural = stubNeural();
    const engine = createGestureEngine({ persistence: memoryPersistence(), neural, clock });
    await engine.init();
    feed(engine, () => ({ l: [0, 1, 0], r: [0.4, 1, 0] }));
    const r = await engine.classifyWithNeural();
    expect(r.provenance.source).toBe('onnx');
    expect(r.provenance.modelVersion).toBe('stub-1');
    expect(r.gesture).toBe('pinchTogether');
    expect(r.confidence).toBeCloseTo(0.8, 5);
    expect(r.scores).not.toBeNull();
    expect(neural.calls).toBe(1);
  });

  it('neural session error falls back to heuristic with session-error reason', async () => {
    const engine = createGestureEngine({
      persistence: memoryPersistence(),
      neural: stubNeural(true),
      clock,
    });
    await engine.init();
    feed(engine, () => ({ l: [0, 1, 0], r: [0.4, 1, 0] }));
    const r = await engine.classifyWithNeural();
    expect(r.provenance.source).toBe('heuristic');
    expect(r.provenance.degradedReason).toBe('session-error');
  });

  it('adopts personalization only when replay F1 improves', async () => {
    const better = stubPersonalizer(true);
    const store = memoryPersistence();
    const engine = createGestureEngine({ persistence: store, personalizer: better, clock });
    await engine.init();
    feed(engine, () => ({ l: [0, 1, 0], r: [0.4, 1, 0] }));
    for (let i = 0; i < 8; i++) engine.reportFeedback('scoopUp', true);
    expect(engine.getCalibration().moveThreshold).toBeCloseTo(0.2, 5);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(store.saved.length).toBe(1);

    const worse = stubPersonalizer(false);
    const engine2 = createGestureEngine({ persistence: memoryPersistence(), personalizer: worse, clock });
    await engine2.init();
    feed(engine2, () => ({ l: [0, 1, 0], r: [0.4, 1, 0] }));
    for (let i = 0; i < 8; i++) engine2.reportFeedback('scoopUp', true);
    expect(engine2.getCalibration().moveThreshold).toBeCloseTo(0.12 * 0.85, 5);
  });

  it('restores calibration from a stored profile', async () => {
    const stored: StoredProfile = {
      schemaVersion: 2,
      profileId: 'default',
      updatedAt: 1,
      calibration: {
        moveThreshold: 0.25,
        pinchThreshold: 0.7,
        releaseThreshold: 0.46,
        meanSpeedEma: 0.5,
        updatedAt: 1,
      },
      feedbackStats: { confirms: 3, corrections: 1, lastUpdatedAt: 1 },
    };
    const persistence = memoryPersistence();
    persistence.loadProfile = async (): Promise<StoredProfile | null> => stored;
    const engine = createGestureEngine({ persistence, clock });
    await engine.init();
    expect(engine.getCalibration().moveThreshold).toBeCloseTo(0.25, 5);
    expect(engine.getCalibration().pinchThreshold).toBeCloseTo(0.7, 5);
  });

  it('status reflects neural readiness after init', async () => {
    const neural = stubNeural();
    const engine = createGestureEngine({ persistence: memoryPersistence(), neural, clock });
    expect(engine.status().init).toBe('idle');
    await engine.init();
    expect(engine.status().runtime).toBe('onnx');
    expect(engine.status().modelVersion).toBe('stub-1');
  });
});

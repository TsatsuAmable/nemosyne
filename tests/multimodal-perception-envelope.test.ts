// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { MultimodalPerceptionEngine } from '../src/vr/perception/MultimodalPerceptionEnvelope.ts';

describe('Multimodal Perception Envelope & Engine (Definitive Vision §11)', () => {
  it('initializes with model version and metadata', () => {
    const engine = new MultimodalPerceptionEngine({
      modelVersion: 'v2.5.0-quest-optimized',
      featureSchema: 'gaze+pinch+voice_v2',
      personalizationState: 'calibrated',
    });

    expect(engine.modelVersion).toBe('v2.5.0-quest-optimized');
    expect(engine.personalizationState).toBe('calibrated');
    expect(engine.isFrozen).toBe(false);
  });

  it('evaluates hybrid multimodal intent when voice and gaze co-occur', () => {
    const engine = new MultimodalPerceptionEngine();

    engine.updateGaze({
      targetEntityId: 'cluster-7',
      direction: [0, 0.2, -1.0],
      dwellDurationMs: 450,
      confidence: 0.85,
    });

    engine.updateVoiceIntent({
      intent: 'filter_outliers',
      transcript: 'filter anomalies in this cluster',
      parameters: { method: 'iqr' },
      confidence: 0.9,
    });

    const snapshot = engine.evaluateSnapshot();
    expect(snapshot.source).toBe('HYBRID_MULTIMODAL');
    expect(snapshot.resolvedAction).toBe('filter_outliers:cluster-7');
    expect(snapshot.confidence).toBeGreaterThanOrEqual(0.9);
    expect(snapshot.fallbackReason).toBeUndefined();
  });

  it('evaluates hybrid multimodal intent when gesture and gaze co-occur', () => {
    const engine = new MultimodalPerceptionEngine();

    engine.updateGaze({
      targetEntityId: 'node-104',
      direction: [0.1, 0, -0.9],
      dwellDurationMs: 300,
      confidence: 0.8,
    });

    engine.updateGesture({
      gesture: 'pinch_select',
      handedness: 'right',
      confidence: 0.88,
      velocity: 0.05,
    });

    const snapshot = engine.evaluateSnapshot();
    expect(snapshot.source).toBe('HYBRID_MULTIMODAL');
    expect(snapshot.resolvedAction).toBe('pinch_select:node-104');
  });

  it('enforces study freeze protocol preventing mid-trial adaptation drift', () => {
    const engine = new MultimodalPerceptionEngine();
    engine.freeze();
    expect(engine.isFrozen).toBe(true);

    expect(() => {
      engine.setPersonalizationState('adapted');
    }).toThrow(/Cannot modify personalization state while perception engine is frozen/);

    const snapshot = engine.evaluateSnapshot();
    expect(snapshot.isFrozen).toBe(true);

    engine.unfreeze();
    expect(engine.isFrozen).toBe(false);
    engine.setPersonalizationState('adapted');
    expect(engine.personalizationState).toBe('adapted');
  });
});

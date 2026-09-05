// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { GestureRetrainService } from '../src/vr/input/GestureRetrainService.ts';

describe('Central Retraining Service & Drift Monitoring (Sprint 23.4 & 23.5)', () => {
  it('registers model cards and manages staged deployment lifecycle', () => {
    const service = new GestureRetrainService();
    const card = {
      version: '1.2.0',
      sha256: 'abc123def456',
      classes: ['idle', 'pinchTogether', 'pinchApart', 'scoopUp', 'pushForward', 'bothPinched'],
      featureDim: 56,
      modelType: 'MLP',
    };
    const dep = service.registerCandidate(card, 'shadow', 0);
    expect(dep.stage).toBe('shadow');
    expect(dep.version).toBe('1.2.0');

    const promoted = service.promoteDeployment('1.2.0', 'canary', 10);
    expect(promoted).toBe(true);
    expect(service.getDeployment('1.2.0')?.stage).toBe('canary');
  });

  it('evaluates genuinely user-disjoint test sets and enforces the six-class quality gate', () => {
    const service = new GestureRetrainService();
    const samples = [
      { features: [0], trueLabel: 'pinchTogether', predictedLabel: 'pinchTogether', confidence: 0.95, profileHash: 'user-test-1' },
      { features: [0], trueLabel: 'scoopUp', predictedLabel: 'scoopUp', confidence: 0.92, profileHash: 'user-test-2' },
      { features: [0], trueLabel: 'pushForward', predictedLabel: 'pushForward', confidence: 0.88, profileHash: 'user-test-3' },
      { features: [0], trueLabel: 'bothPinched', predictedLabel: 'bothPinched', confidence: 0.91, profileHash: 'user-test-1' },
      { features: [0], trueLabel: 'pinchApart', predictedLabel: 'pinchApart', confidence: 0.94, profileHash: 'user-test-2' },
      { features: [0], trueLabel: 'idle', predictedLabel: 'idle', confidence: 0.99, profileHash: 'user-test-3' },
    ];
    const trainProfiles = new Set(['user-train-1', 'user-train-2']);
    const report = service.evaluateUserDisjoint(samples, trainProfiles);

    expect(report.validity).toBe('VALID');
    expect(report.missingClasses).toEqual([]);
    expect(report.accuracy).toBe(1.0);
    expect(report.macroF1).toBe(1.0);
    expect(report.passedBar).toBe(true);
    expect(report.profileCount).toBe(3);
  });

  it('fails closed when no profile is actually held out from training', () => {
    const service = new GestureRetrainService();
    const samples = [
      { features: [0], trueLabel: 'idle', predictedLabel: 'idle', confidence: 0.99, profileHash: 'user-1' },
      { features: [0], trueLabel: 'pinchTogether', predictedLabel: 'pinchTogether', confidence: 0.99, profileHash: 'user-2' },
    ];
    const report = service.evaluateUserDisjoint(samples, new Set(['user-1', 'user-2']));

    expect(report.validity).toBe('NO_HELD_OUT_PROFILES');
    expect(report.sampleCount).toBe(0);
    expect(report.profileCount).toBe(0);
    expect(report.userDisjointAccuracy).toBe(0);
    expect(report.userDisjointMacroF1).toBe(0);
    expect(report.passedBar).toBe(false);
  });

  it('does not award perfect F1 to gesture classes absent from the held-out set', () => {
    const service = new GestureRetrainService();
    const samples = [
      { features: [0], trueLabel: 'idle', predictedLabel: 'idle', confidence: 0.99, profileHash: 'held-out-1' },
      { features: [0], trueLabel: 'pinchTogether', predictedLabel: 'pinchTogether', confidence: 0.99, profileHash: 'held-out-2' },
    ];
    const report = service.evaluateUserDisjoint(samples, new Set(['train-1']));

    expect(report.validity).toBe('MISSING_CLASS_SUPPORT');
    expect(report.accuracy).toBe(1);
    expect(report.perClassF1.idle).toBe(1);
    expect(report.perClassF1.pinchTogether).toBe(1);
    expect(report.perClassF1.pinchApart).toBe(0);
    expect(report.macroF1).toBeCloseTo(2 / 6, 8);
    expect(report.missingClasses).toEqual(['pinchApart', 'scoopUp', 'pushForward', 'bothPinched']);
    expect(report.passedBar).toBe(false);
  });

  it('tracks drift metrics and detects model performance degradation', () => {
    const service = new GestureRetrainService();

    // 8 successes
    for (let i = 0; i < 8; i++) {
      service.recordTelemetryObservation('onnx', true);
    }
    // 6 corrections
    for (let i = 0; i < 6; i++) {
      service.recordTelemetryObservation('onnx', false);
    }

    const drift = service.getDriftMetrics();
    expect(drift.totalConfirmed).toBe(8);
    expect(drift.totalCorrected).toBe(6);
    expect(drift.confirmRatio).toBeCloseTo(8 / 14, 2);
    expect(drift.isDrifting).toBe(true); // < 70% threshold
  });
});

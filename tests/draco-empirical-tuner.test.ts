// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { DracoEmpiricalTuner } from '../src/moneta/evidence/MonetaEmpiricalTuner.ts';
import type { EmpiricalOutcome } from '../src/moneta/evidence/types.ts';

describe('Draco Empirical Tuner & Adaptive Solver Loop (Sprint 26.2)', () => {
  function makeOutcome(
    id: string,
    layout: 'FORCE_DIRECTED_3D' | 'GEO_SURFACE' | 'GRID_3D',
    accuracy: number,
    durationMs: number,
    nasaTlx: number
  ): EmpiricalOutcome {
    return {
      trialId: `trial-${id}`,
      datasetFingerprint: 'hash-abc',
      condition: 'vr_experimental',
      taskType: 'anomaly_isolation',
      accuracy,
      precision: accuracy,
      recall: accuracy,
      f1: accuracy,
      durationMs,
      nasaTlxAverage: nasaTlx,
      confidenceRating: 6,
      timestamp: Date.now(),
      spec: {
        layout,
        geometry: 'ICOSA_NODE',
        behavior: 'STATIC',
        interaction: 'INSPECT_CELL',
      },
    };
  }

  it('promotes layouts with high empirical accuracy, fast completion, and low workload', () => {
    const tuner = new DracoEmpiricalTuner();
    tuner.recordOutcomes([
      makeOutcome('1', 'FORCE_DIRECTED_3D', 0.95, 18000, 25),
      makeOutcome('2', 'FORCE_DIRECTED_3D', 0.90, 22000, 30),
      makeOutcome('3', 'FORCE_DIRECTED_3D', 0.98, 16000, 20),
    ]);

    const preferences = tuner.tunePreferencesForTopology('GRAPH', [
      'FORCE_DIRECTED_3D',
      'GRID_3D',
    ]);

    const forceDirected = preferences.find((p) => p.layout === 'FORCE_DIRECTED_3D');
    expect(forceDirected).toBeDefined();
    expect(forceDirected?.empiricalAdjustment).toBeGreaterThan(0);
    expect(forceDirected?.finalWeight).toBeGreaterThan(1.0);
    expect(forceDirected?.sampleCount).toBe(3);
    expect(forceDirected?.rationale).toContain('promoted');

    const grid = preferences.find((p) => p.layout === 'GRID_3D');
    expect(grid?.sampleCount).toBe(0);
    expect(grid?.finalWeight).toBe(1.0);
  });

  it('demotes layouts with poor accuracy and high cognitive workload', () => {
    const tuner = new DracoEmpiricalTuner();
    tuner.recordOutcomes([
      makeOutcome('1', 'GRID_3D', 0.40, 58000, 85),
      makeOutcome('2', 'GRID_3D', 0.35, 60000, 90),
    ]);

    const preferences = tuner.tunePreferencesForTopology('GRAPH', ['GRID_3D']);
    const grid = preferences[0];

    expect(grid.empiricalAdjustment).toBeLessThan(0);
    expect(grid.finalWeight).toBeLessThan(1.0);
    expect(grid.rationale).toContain('demoted');
  });

  it('generates complete empirical tuning summary with solver override weights', () => {
    const tuner = new DracoEmpiricalTuner();
    tuner.recordOutcomes([
      makeOutcome('1', 'GEO_SURFACE', 0.96, 15000, 20),
      makeOutcome('2', 'GRID_3D', 0.40, 58000, 85),
    ]);

    const summary = tuner.generateTuningSummary('GEOGRAPHIC', ['GEO_SURFACE', 'GRID_3D']);

    expect(summary.totalOutcomesProcessed).toBe(2);
    expect(summary.solverOverrideWeights['GEO_SURFACE']).toBeGreaterThan(1.0);
    expect(summary.solverOverrideWeights['GRID_3D']).toBeLessThan(1.0);
    expect(summary.tunedPreferences.length).toBe(2);
  });
});

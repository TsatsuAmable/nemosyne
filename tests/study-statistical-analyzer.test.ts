import { describe, it, expect } from 'vitest';
import { StudyStatisticalAnalyzer } from '../src/study/StudyStatisticalAnalyzer.ts';
import type { TrialMetrics } from '../src/study/types.ts';

describe('StudyStatisticalAnalyzer (Milestone 25.3 — 2D vs. VR Statistical Analysis)', () => {
  function makeTrial(
    id: string,
    participantId: string,
    condition: '2d_control' | 'vr_experimental',
    durationMs: number,
    accuracy: number,
    f1Score: number,
    confidenceRating: number,
    workloadScore: number
  ): TrialMetrics {
    return {
      trialId: id,
      participantId,
      condition,
      taskId: 'task-anomaly-isolation',
      startTime: 1000,
      endTime: 1000 + durationMs,
      durationMs,
      selectedNodeIds: ['node-1'],
      groundTruthNodeIds: ['node-1'],
      accuracy,
      precision: accuracy,
      recall: accuracy,
      f1Score,
      interactionCount: 12,
      navigationDistanceMeters: 4.2,
      confidenceRating,
      workloadScore,
      completed: true,
      exclusions: [],
    };
  }

  it('computes t-test, Cohen d, and effect sizes between 2D control and VR experimental in paired crossover', () => {
    const trials: TrialMetrics[] = [
      // 2D Control for participants p1, p2, p3, p4
      makeTrial('1', 'p1', '2d_control', 45000, 0.70, 0.68, 4, 65),
      makeTrial('2', 'p2', '2d_control', 50000, 0.75, 0.72, 4, 70),
      makeTrial('3', 'p3', '2d_control', 42000, 0.65, 0.64, 3, 62),
      makeTrial('4', 'p4', '2d_control', 48000, 0.72, 0.70, 4, 68),

      // VR Experimental for same participants p1, p2, p3, p4
      makeTrial('5', 'p1', 'vr_experimental', 22000, 0.95, 0.94, 6, 32),
      makeTrial('6', 'p2', 'vr_experimental', 25000, 0.90, 0.89, 6, 35),
      makeTrial('7', 'p3', 'vr_experimental', 21000, 0.98, 0.97, 7, 28),
      makeTrial('8', 'p4', 'vr_experimental', 24000, 0.92, 0.91, 6, 30),
    ];

    const analyzer = new StudyStatisticalAnalyzer();
    const durationComp = analyzer.compareConditions(trials, 'durationMs');

    expect(durationComp.summaryA.mean).toBe(46250);
    expect(durationComp.summaryB.mean).toBe(23000);
    expect(durationComp.tStatistic).toBeLessThan(0); // VR is faster
    expect(durationComp.effectMagnitude).toBe('large');
    expect(durationComp.isSignificantP05).toBe(true);

    const accuracyComp = analyzer.compareConditions(trials, 'accuracy');
    expect(accuracyComp.summaryB.mean).toBeGreaterThan(accuracyComp.summaryA.mean);
    expect(accuracyComp.cohensD).toBeGreaterThan(0.8);
    expect(accuracyComp.effectMagnitude).toBe('large');
    expect(accuracyComp.isSignificantP05).toBe(true);
  });

  it('correctly detects deterministic significance when all pairs have a constant non-zero difference', () => {
    const trials: TrialMetrics[] = [
      makeTrial('1', 'p1', '2d_control', 40000, 0.60, 0.60, 4, 50),
      makeTrial('2', 'p2', '2d_control', 42000, 0.70, 0.70, 4, 50),
      makeTrial('3', 'p3', '2d_control', 45000, 0.80, 0.80, 4, 50),

      // Every participant improved accuracy by exactly +0.15
      makeTrial('4', 'p1', 'vr_experimental', 25000, 0.75, 0.75, 6, 30),
      makeTrial('5', 'p2', 'vr_experimental', 27000, 0.85, 0.85, 6, 30),
      makeTrial('6', 'p3', 'vr_experimental', 30000, 0.95, 0.95, 6, 30),
    ];

    const analyzer = new StudyStatisticalAnalyzer();
    const comp = analyzer.compareConditions(trials, 'accuracy');

    expect(comp.pValueApprox).toBe(0.0);
    expect(comp.isSignificantP05).toBe(true);
    expect(comp.effectMagnitude).toBe('large');
  });

  it('returns p=1 and t=0 when there is zero difference between paired conditions', () => {
    const trials: TrialMetrics[] = [
      makeTrial('1', 'p1', '2d_control', 40000, 0.75, 0.75, 4, 50),
      makeTrial('2', 'p2', '2d_control', 42000, 0.80, 0.80, 4, 50),

      makeTrial('3', 'p1', 'vr_experimental', 40000, 0.75, 0.75, 4, 50),
      makeTrial('4', 'p2', 'vr_experimental', 42000, 0.80, 0.80, 4, 50),
    ];

    const analyzer = new StudyStatisticalAnalyzer();
    const comp = analyzer.compareConditions(trials, 'accuracy');

    expect(comp.pValueApprox).toBe(1.0);
    expect(comp.tStatistic).toBe(0);
    expect(comp.isSignificantP05).toBe(false);
  });

  it('evaluates complete experiment and generates structured markdown summary', () => {
    const trials: TrialMetrics[] = [
      makeTrial('1', 'p1', '2d_control', 45000, 0.70, 0.68, 4, 65),
      makeTrial('2', 'p2', '2d_control', 50000, 0.75, 0.72, 4, 70),
      makeTrial('3', 'p1', 'vr_experimental', 22000, 0.95, 0.94, 6, 32),
      makeTrial('4', 'p2', 'vr_experimental', 25000, 0.90, 0.89, 6, 35),
    ];

    const analyzer = new StudyStatisticalAnalyzer();
    const report = analyzer.evaluateExperiment(trials);

    expect(report.totalTrials).toBe(4);
    expect(report.conditionCounts['2d_control']).toBe(2);
    expect(report.conditionCounts['vr_experimental']).toBe(2);
    expect(report.hypothesisResults.length).toBe(5);
    expect(report.markdownSummary).toContain('| Metric | 2D Mean (SD) | VR Mean (SD) |');
    expect(report.markdownSummary).toContain('**durationMs**');
    expect(report.markdownSummary).toContain('**accuracy**');
  });
});

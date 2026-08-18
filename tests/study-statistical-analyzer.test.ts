// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { StudyStatisticalAnalyzer } from '../src/study/StudyStatisticalAnalyzer.ts';
import type { TrialMetrics } from '../src/study/types.ts';

describe('StudyStatisticalAnalyzer (Milestone 25.3 — 2D vs. VR Statistical Analysis)', () => {
  function makeTrial(
    id: string,
    condition: '2d_control' | 'vr_experimental',
    durationMs: number,
    accuracy: number,
    f1Score: number,
    confidenceRating: number,
    workloadScore: number
  ): TrialMetrics {
    return {
      trialId: id,
      participantId: `p-${id}`,
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

  it('computes t-test, Cohen d, and effect sizes between 2D control and VR experimental', () => {
    const trials: TrialMetrics[] = [
      // 2D Control (Slower, higher workload, moderate accuracy)
      makeTrial('1', '2d_control', 45000, 0.70, 0.68, 4, 65),
      makeTrial('2', '2d_control', 50000, 0.75, 0.72, 4, 70),
      makeTrial('3', '2d_control', 42000, 0.65, 0.64, 3, 62),
      makeTrial('4', '2d_control', 48000, 0.72, 0.70, 4, 68),

      // VR Experimental (Faster time-to-insight, lower workload, higher accuracy)
      makeTrial('5', 'vr_experimental', 22000, 0.95, 0.94, 6, 32),
      makeTrial('6', 'vr_experimental', 25000, 0.90, 0.89, 6, 35),
      makeTrial('7', 'vr_experimental', 21000, 0.98, 0.97, 7, 28),
      makeTrial('8', 'vr_experimental', 24000, 0.92, 0.91, 6, 30),
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
  });

  it('evaluates complete experiment and generates structured markdown summary', () => {
    const trials: TrialMetrics[] = [
      makeTrial('1', '2d_control', 45000, 0.70, 0.68, 4, 65),
      makeTrial('2', '2d_control', 50000, 0.75, 0.72, 4, 70),
      makeTrial('3', 'vr_experimental', 22000, 0.95, 0.94, 6, 32),
      makeTrial('4', 'vr_experimental', 25000, 0.90, 0.89, 6, 35),
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

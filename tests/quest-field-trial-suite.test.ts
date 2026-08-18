// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { QuestFieldTrialSuite } from '../src/vr/scalability/QuestFieldTrialSuite.ts';

describe('Quest 3S On-Device Field Trial Suite (Milestone 25.2)', () => {
  it('initializes with default multi-stage load test profiles (1k to 100k nodes)', () => {
    const suite = new QuestFieldTrialSuite();
    expect(suite.stages.length).toBe(5);
    expect(suite.stages[0].nodeCount).toBe(1000);
    expect(suite.stages[4].nodeCount).toBe(100000);
  });

  it('executes simulated trial and validates Quest 3S compute envelopes', () => {
    const suite = new QuestFieldTrialSuite();
    const report = suite.executeSimulatedTrial('Quest 3S');

    expect(report.deviceTarget).toBe('Quest 3S');
    expect(report.allStagesPassed).toBe(true);
    expect(report.passedStages).toBe(5);
    expect(report.totalStages).toBe(5);
    expect(report.overallBudgetReport.isWithinBudget).toBe(true);

    // Frame times at 100k nodes must remain within 13.88ms 72Hz budget
    const maxStage = report.stageResults[4];
    expect(maxStage.entry.nodeCount).toBe(100000);
    expect(maxStage.entry.frameTimeP95Ms).toBeLessThanOrEqual(13.8);
    expect(maxStage.entry.jsHeapUsedMb).toBeLessThanOrEqual(250);
    expect(maxStage.entry.droppedFrameRate).toBeLessThanOrEqual(0.05);
    expect(report.auditCertificateHash).toContain('cert-q3s-');
  });

  it('detects and flags budget violations when stage exceeds threshold', () => {
    const suite = new QuestFieldTrialSuite();
    suite.setStages([
      { stageId: 'extreme-stress', nodeCount: 500000, durationSeconds: 10, layoutType: 'FORCE_DIRECTED_3D' },
    ]);

    const report = suite.executeSimulatedTrial('Quest 3S');
    const stage = report.stageResults[0];

    // At 500k nodes, frame time will exceed 13.8ms budget
    expect(stage.entry.nodeCount).toBe(500000);
    expect(stage.passed).toBe(false);
    expect(stage.violations.length).toBeGreaterThan(0);
    expect(report.allStagesPassed).toBe(false);
  });
});

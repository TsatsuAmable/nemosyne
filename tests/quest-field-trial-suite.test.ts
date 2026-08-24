// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { QuestFieldTrialSuite } from '../src/vr/scalability/QuestFieldTrialSuite.ts';

function measuredEntry(nodeCount: number, overrides = {}) {
  return {
    timestamp: 1000 + nodeCount,
    nodeCount,
    frameTimeP50Ms: 10,
    frameTimeP95Ms: 12,
    frameTimeP99Ms: 13,
    droppedFrameRate: 0.01,
    jsHeapUsedMb: 120,
    measurementSource: 'on-device-webxr',
    xrActive: true,
    ...overrides,
  };
}

describe('Quest 3S On-Device Field Trial Suite (Milestone 25.2)', () => {
  it('initializes with default multi-stage load test profiles (1k to 100k nodes)', () => {
    const suite = new QuestFieldTrialSuite();
    expect(suite.stages.length).toBe(5);
    expect(suite.stages[0].nodeCount).toBe(1000);
    expect(suite.stages[4].nodeCount).toBe(250000);
  });

  it('compiles measured WebXR entries and validates Quest 3S compute envelopes', async () => {
    const suite = new QuestFieldTrialSuite();
    const report = await suite.compileMeasuredTrial(
      suite.stages.map((stage) => measuredEntry(stage.nodeCount)),
      'Quest 3S'
    );

    expect(report.deviceTarget).toBe('Quest 3S');
    expect(report.allStagesPassed).toBe(true);
    expect(report.passedStages).toBe(5);
    expect(report.totalStages).toBe(5);
    expect(report.overallBudgetReport.isWithinBudget).toBe(true);

    const maxStage = report.stageResults[4];
    expect(maxStage.entry.nodeCount).toBe(250000);
    expect(maxStage.entry.frameTimeP95Ms).toBeLessThanOrEqual(13.8);
    expect(maxStage.entry.jsHeapUsedMb).toBeLessThanOrEqual(250);
    expect(maxStage.entry.droppedFrameRate).toBeLessThanOrEqual(0.05);
    expect(report.auditCertificateHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('detects and flags measured budget violations', async () => {
    const suite = new QuestFieldTrialSuite();
    suite.setStages([
      { stageId: 'extreme-stress', nodeCount: 500000, durationSeconds: 10, topology: 'TABULAR' },
    ]);

    const report = await suite.compileMeasuredTrial([
      measuredEntry(500000, {
        frameTimeP95Ms: 20,
        frameTimeP99Ms: 30,
        droppedFrameRate: 0.2,
        jsHeapUsedMb: 400,
      }),
    ], 'Quest 3S');
    const stage = report.stageResults[0];

    expect(stage.entry.nodeCount).toBe(500000);
    expect(stage.passed).toBe(false);
    expect(stage.violations.length).toBeGreaterThan(0);
    expect(report.allStagesPassed).toBe(false);
  });

  it('rejects incomplete or non-XR evidence', async () => {
    const suite = new QuestFieldTrialSuite();
    await expect(suite.compileMeasuredTrial([])).rejects.toThrow('exactly one entry');
    const entries = suite.stages.map((stage) => measuredEntry(stage.nodeCount));
    entries[0].xrActive = false;
    await expect(suite.compileMeasuredTrial(entries)).rejects.toThrow('on-device WebXR');
  });
});

/**
 * Quest 3S On-Device Field Trial Suite (Milestone 25.2).
 *
 * Automates multi-stage load-test probe execution across dataset scales
 * (1k, 5k, 20k, 50k, 100k nodes), validates Quest 3S physical compute
 * envelopes (72 Hz / 13.88ms frame budget, <5% dropped frames, <250 MB heap),
 * and generates verifiable research audit certificates.
 */

import { QuestProbeAnalyzer, type QuestLoadTestEntry, type QuestPerformanceBudgetReport } from './QuestProbeAnalyzer.ts';

export interface FieldTrialStage {
  stageId: string;
  nodeCount: number;
  durationSeconds: number;
  topology: 'TABULAR';
}

export interface FieldTrialStageResult {
  stage: FieldTrialStage;
  entry: QuestLoadTestEntry;
  passed: boolean;
  violations: string[];
}

export interface MeasuredQuestLoadTestEntry extends QuestLoadTestEntry {
  measurementSource: 'on-device-webxr';
  xrActive: true;
}

export interface FieldTrialSummaryReport {
  suiteVersion: string;
  timestamp: number;
  deviceTarget: 'Quest 3' | 'Quest 3S' | 'VisionPro' | 'Generic_WebXR';
  allStagesPassed: boolean;
  totalStages: number;
  passedStages: number;
  stageResults: FieldTrialStageResult[];
  overallBudgetReport: QuestPerformanceBudgetReport;
  auditCertificateHash: string;
}

export class QuestFieldTrialSuite {
  private _analyzer = new QuestProbeAnalyzer();
  private _stages: FieldTrialStage[] = [
    { stageId: 'stage-1k', nodeCount: 1000, durationSeconds: 30, topology: 'TABULAR' },
    { stageId: 'stage-8k', nodeCount: 8000, durationSeconds: 30, topology: 'TABULAR' },
    { stageId: 'stage-65k', nodeCount: 65000, durationSeconds: 45, topology: 'TABULAR' },
    { stageId: 'stage-100k', nodeCount: 100000, durationSeconds: 300, topology: 'TABULAR' },
    { stageId: 'stage-250k', nodeCount: 250000, durationSeconds: 60, topology: 'TABULAR' },
  ];

  get stages(): FieldTrialStage[] {
    return [...this._stages];
  }

  setStages(stages: FieldTrialStage[]): void {
    this._stages = [...stages];
  }

  async compileMeasuredTrial(
    entries: MeasuredQuestLoadTestEntry[],
    deviceTarget: 'Quest 3' | 'Quest 3S' | 'VisionPro' | 'Generic_WebXR' = 'Quest 3S'
  ): Promise<FieldTrialSummaryReport> {
    const byNodeCount = new Map(entries.map((entry) => [entry.nodeCount, entry]));
    if (entries.length !== this._stages.length || byNodeCount.size !== this._stages.length) {
      throw new Error('Measured field trial must contain exactly one entry for every configured stage');
    }
    const stageResults = this._stages.map((stage) => {
      const entry = byNodeCount.get(stage.nodeCount);
      if (!entry || entry.measurementSource !== 'on-device-webxr' || entry.xrActive !== true) {
        throw new Error(`Missing on-device WebXR measurement for ${stage.stageId}`);
      }
      const stageReport = this._analyzer.analyze([entry]);
      return {
        stage,
        entry,
        passed: stageReport.isWithinBudget,
        violations: stageReport.budgetViolations,
      };
    });
    const timestamp = Math.max(...entries.map((entry) => entry.timestamp));
    const overallReport = this._analyzer.analyze(entries);
    const passedCount = stageResults.filter((result) => result.passed).length;
    const certificateInput = JSON.stringify({
      suiteVersion: '3.0.0-q3s-measured',
      timestamp,
      deviceTarget,
      stageResults,
    });
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(certificateInput));
    const auditCertificateHash = Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');

    return {
      suiteVersion: '3.0.0-q3s-measured',
      timestamp,
      deviceTarget,
      allStagesPassed: passedCount === stageResults.length,
      totalStages: stageResults.length,
      passedStages: passedCount,
      stageResults,
      overallBudgetReport: overallReport,
      auditCertificateHash,
    };
  }
}

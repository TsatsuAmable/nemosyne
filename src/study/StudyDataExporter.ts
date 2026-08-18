/**
 * Study Protocol Data Exporter.
 *
 * Formats completed 2D-vs-VR study trial records into structured research analysis bundles
 * and statistical analysis CSVs conforming to reproducible study protocols.
 */

import { CompletedTrialRecord } from './StudyHarness.ts';

export interface StudyExportBundle {
  studyId: string;
  exportedAt: number;
  totalTrials: number;
  accuracyRate: number;
  averageDurationMs: number;
  averageWorkloadScore: number;
  trials: CompletedTrialRecord[];
}

export class StudyDataExporter {
  static createBundle(studyId: string, trials: CompletedTrialRecord[], exportedAt = Date.now()): StudyExportBundle {
    const totalTrials = trials.length;
    const correctCount = trials.filter((t) => t.isCorrect).length;
    const accuracyRate = totalTrials > 0 ? correctCount / totalTrials : 0;
    const totalDuration = trials.reduce((acc, t) => acc + t.durationMs, 0);
    const averageDurationMs = totalTrials > 0 ? totalDuration / totalTrials : 0;
    const totalWorkload = trials.reduce((acc, t) => acc + t.workloadScore, 0);
    const averageWorkloadScore = totalTrials > 0 ? totalWorkload / totalTrials : 0;

    return {
      studyId,
      exportedAt,
      totalTrials,
      accuracyRate,
      averageDurationMs,
      averageWorkloadScore,
      trials,
    };
  }

  static toCSV(trials: CompletedTrialRecord[]): string {
    const headers = [
      'trial_id',
      'dataset_id',
      'task_type',
      'condition',
      'is_correct',
      'duration_ms',
      'confidence_score',
      'workload_score',
      'interaction_events_count',
      'completed_at',
    ];

    const rows = trials.map((t) =>
      [
        t.trialId,
        t.datasetId,
        t.taskType,
        t.condition,
        t.isCorrect ? '1' : '0',
        t.durationMs.toString(),
        t.confidenceScore.toString(),
        t.workloadScore.toString(),
        t.interactionEventsCount.toString(),
        t.completedAt.toString(),
      ].join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }
}

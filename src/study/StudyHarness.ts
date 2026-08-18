/**
 * 2D-vs-VR Comparative Study Experimental Harness.
 *
 * Implements a reusable experimental framework executing controlled crossover evaluations:
 * dataset x task x condition (2D | VR) x timer x answer capture x confidence x workload x telemetry.
 *
 * Emits complete trial outcome records for statistical analysis and hypothesis testing.
 */

export type StudyCondition = '2D_CONTROL' | 'VR_EXPERIMENTAL';

export interface StudyTrialSpec {
  trialId: string;
  datasetId: string;
  taskType: 'anomaly_detection' | 'topology_discovery' | 'temporal_pattern' | 'quantitative_comparison' | 'memory_recall';
  condition: StudyCondition;
  prompt: string;
  groundTruthAnswer: string;
}

export interface StudyTrialResponse {
  participantAnswer: string;
  confidenceScore: number; // 1 to 7 Likert scale
  perceivedWorkloadNASA_TLX: number; // 0 to 100
  interactionEventsCount: number;
}

export interface CompletedTrialRecord {
  trialId: string;
  datasetId: string;
  taskType: string;
  condition: StudyCondition;
  isCorrect: boolean;
  durationMs: number;
  confidenceScore: number;
  workloadScore: number;
  interactionEventsCount: number;
  completedAt: number;
}

export class StudyTrialExecutionHarness {
  private _activeTrial: StudyTrialSpec | null = null;
  private _startTimeMs = 0;

  startTrial(spec: StudyTrialSpec, startTimeMs = Date.now()): void {
    this._activeTrial = spec;
    this._startTimeMs = startTimeMs;
  }

  get activeTrial(): StudyTrialSpec | null {
    return this._activeTrial;
  }

  completeTrial(response: StudyTrialResponse, endTimeMs = Date.now()): CompletedTrialRecord {
    if (!this._activeTrial) {
      throw new Error('Cannot complete trial: No active trial running');
    }

    const durationMs = Math.max(0, endTimeMs - this._startTimeMs);
    const isCorrect =
      response.participantAnswer.trim().toLowerCase() ===
      this._activeTrial.groundTruthAnswer.trim().toLowerCase();

    const record: CompletedTrialRecord = {
      trialId: this._activeTrial.trialId,
      datasetId: this._activeTrial.datasetId,
      taskType: this._activeTrial.taskType,
      condition: this._activeTrial.condition,
      isCorrect,
      durationMs,
      confidenceScore: response.confidenceScore,
      workloadScore: response.perceivedWorkloadNASA_TLX,
      interactionEventsCount: response.interactionEventsCount,
      completedAt: endTimeMs,
    };

    this._activeTrial = null;
    return record;
  }
}

/**
 * Type definitions for the Nemosyne Atlas 6 Controlled Experiment Harness.
 *
 * Implements the empirical protocols specified in `docs/study/PROTOCOL.md`,
 * `docs/study/ANALYSIS_PLAN.md`, and `docs/study/DATA_DICTIONARY.md`.
 */

export type StudyCondition = '2d_control' | 'vr_experimental' | 'vr_guided';

export type TrialPhase =
  | 'idle'
  | 'instruction'
  | 'exploration'
  | 'query'
  | 'selection'
  | 'submission'
  | 'survey'
  | 'completed';

export interface GroundTruthSpec {
  targetNodeIds: (string | number)[];
  expectedClusterLabel?: string;
  expectedTopology?: string;
  anomalyIndices?: number[];
  description: string;
}

export interface TaskSpec {
  id: string;
  name: string;
  datasetType: string;
  datasetFingerprint: string;
  description: string;
  instructions: string;
  maxDurationMs: number;
  groundTruth: GroundTruthSpec;
}

export interface ParticipantAssignment {
  participantId: string;
  order: StudyCondition[];
  cohort: string;
  assignedAt: number;
}

export interface TrialEvent {
  timestamp: number;
  phase: TrialPhase;
  eventType: 'phase_change' | 'node_select' | 'node_deselect' | 'camera_move' | 'filter_apply' | 'interaction' | 'reset' | 'survey_submit';
  payload?: Record<string, unknown>;
}

export interface TrialMetrics {
  trialId: string;
  participantId: string;
  condition: StudyCondition;
  taskId: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  selectedNodeIds: (string | number)[];
  groundTruthNodeIds: (string | number)[];
  accuracy: number; // 1.0 if exact match, 0.0 otherwise (or proportion)
  precision: number; // TP / (TP + FP)
  recall: number; // TP / (TP + FN)
  f1Score: number; // 2 * (P * R) / (P + R)
  interactionCount: number;
  navigationDistanceMeters: number;
  confidenceRating?: number; // 1 to 7 Likert scale
  workloadScore?: number; // 1 to 100 NASA-TLX or raw workload rating
  completed: boolean;
  exclusions: string[];
}

export interface StudySessionExport {
  studyName: string;
  protocolVersion: string;
  configHash: string;
  participantId: string;
  conditionOrder: StudyCondition[];
  sessionStartTime: number;
  sessionEndTime: number;
  trials: TrialMetrics[];
  events: TrialEvent[];
  provenanceHash: string;
}

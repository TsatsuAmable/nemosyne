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

export interface StudyRuntimeVersions {
  kernelVersion: string | null;
  monetaEngineVersion: string;
  fitnessModelVersion: string;
  /** Exact immutable registry artifact hash when a learned model is pinned. */
  fitnessModelArtifactHash?: string | null;
  representationOntologyVersion: string;
  nilVersion: string;
  /**
   * Participant-facing UI treatment identity: panel-layout revision, command
   * surface taxonomy and reference-frame policy (vision §14 — spatial
   * arrangement is part of treatment; see docs/study/UI_TREATMENT.md).
   */
  uiTreatmentVersion: string;
}

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
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  interactionCount: number;
  navigationDistanceMeters: number;
  confidenceRating?: number;
  workloadScore?: number;
  completed: boolean;
  exclusions: string[];
  /** Present on V3 controlled ExperimentRunner output; absent on historical/pre-freeze records. */
  studyConfigHash?: string;
  /** Present on V3 controlled ExperimentRunner output; absent on historical/pre-freeze records. */
  runtimeVersions?: StudyRuntimeVersions;
}

export interface StudySessionExport {
  studyName: string;
  protocolVersion: string;
  configHash: string;
  runtimeVersions: StudyRuntimeVersions;
  participantId: string;
  conditionOrder: StudyCondition[];
  sessionStartTime: number;
  sessionEndTime: number;
  trials: TrialMetrics[];
  events: TrialEvent[];
  provenanceHash: string;
}

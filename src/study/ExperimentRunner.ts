/**
 * ExperimentRunner for Nemosyne Atlas 6 Controlled Empirical Studies.
 *
 * Drives the trial lifecycle state machine, real-time telemetry metrics,
 * ground-truth scoring (accuracy, precision, recall, F1), and reproducible
 * session exports pinned to an explicit study/runtime freeze manifest.
 */

import { Counterbalancer } from './Counterbalancer.ts';
import {
  FROZEN_STUDY_NAME,
  FROZEN_PROTOCOL_VERSION,
  FROZEN_CONFIG_HASH,
  FROZEN_STUDY_MANIFEST,
  FROZEN_STUDY_TASKS,
  FROZEN_STUDY_CONDITIONS,
} from './FrozenStudyConfig.ts';
import {
  StudyFreezeGuard,
  hashStudyFreezeManifest,
  type StudyFreezeManifest,
  type StudyRuntimeVersionsProvider,
} from './StudyFreezeManifest.ts';
import type {
  StudyCondition,
  TrialPhase,
  TaskSpec,
  ParticipantAssignment,
  TrialEvent,
  TrialMetrics,
  StudySessionExport,
} from './types.ts';

export interface ExperimentRunnerOptions {
  runtimeVersionsProvider?: StudyRuntimeVersionsProvider;
  /** Explicit opt-in for pilots/method-development runs that differ from the frozen task/condition manifest. */
  allowProtocolVariation?: boolean;
}

export class ExperimentRunner {
  private _counterbalancer: Counterbalancer;
  private _assignment: ParticipantAssignment | null = null;
  private _tasks: TaskSpec[];
  private _currentConditionIndex = 0;
  private _currentTaskIndex = 0;
  private _currentPhase: TrialPhase = 'idle';

  private _trialStartTime = 0;
  private _sessionStartTime = 0;
  private _sessionEndTime = 0;

  private _selectedNodeIds = new Set<string | number>();
  private _interactionCount = 0;
  private _navigationDistance = 0.0;
  private _lastCameraPosition: [number, number, number] | null = null;

  private _completedTrials: TrialMetrics[] = [];
  private _events: TrialEvent[] = [];
  private readonly _studyManifest: StudyFreezeManifest;
  private readonly _freezeGuard: StudyFreezeGuard;

  constructor(
    conditions: StudyCondition[] = FROZEN_STUDY_CONDITIONS,
    tasks: TaskSpec[] = FROZEN_STUDY_TASKS,
    options: ExperimentRunnerOptions = {},
  ) {
    this._counterbalancer = new Counterbalancer(conditions);
    this._tasks = structuredClone(tasks);

    const runtimeVersions = options.runtimeVersionsProvider?.() ?? FROZEN_STUDY_MANIFEST.runtimeVersions;
    this._studyManifest = {
      ...structuredClone(FROZEN_STUDY_MANIFEST),
      conditions: [...conditions],
      tasks: structuredClone(tasks),
      runtimeVersions: structuredClone(runtimeVersions),
    };

    const effectiveHash = hashStudyFreezeManifest(this._studyManifest);
    const protocolVaries = effectiveHash !== FROZEN_CONFIG_HASH;
    const runtimeOnlyVariation =
      hashStudyFreezeManifest({
        ...this._studyManifest,
        runtimeVersions: FROZEN_STUDY_MANIFEST.runtimeVersions,
      }) === FROZEN_CONFIG_HASH;

    if (protocolVaries && !runtimeOnlyVariation && !options.allowProtocolVariation) {
      throw new Error(
        'Study protocol variation requires allowProtocolVariation=true; conditions/tasks differ from the declared frozen manifest',
      );
    }

    this._freezeGuard = new StudyFreezeGuard(
      this._studyManifest,
      options.runtimeVersionsProvider ?? (() => structuredClone(this._studyManifest.runtimeVersions)),
    );
  }

  get currentPhase(): TrialPhase {
    return this._currentPhase;
  }

  get currentCondition(): StudyCondition | null {
    if (!this._assignment) return null;
    return this._assignment.order[this._currentConditionIndex] ?? null;
  }

  get currentTask(): TaskSpec | null {
    return this._tasks[this._currentTaskIndex] ?? null;
  }

  get assignment(): ParticipantAssignment | null {
    return this._assignment;
  }

  get selectedNodeIds(): (string | number)[] {
    return Array.from(this._selectedNodeIds);
  }

  get completedTrials(): TrialMetrics[] {
    return structuredClone(this._completedTrials);
  }

  get freezeSnapshot() {
    return this._freezeGuard.snapshot;
  }

  get isSessionCompleted(): boolean {
    if (!this._assignment) return false;
    const totalExpected = this._assignment.order.length * this._tasks.length;
    return this._completedTrials.length >= totalExpected && this._currentPhase === 'completed';
  }

  /** Initializes a participant session with counterbalanced condition assignment. */
  startParticipantSession(participantId: string, orderOverride?: StudyCondition[]): ParticipantAssignment {
    this._assertStudyFreeze();
    const sanitizedId = String(participantId || '').trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(sanitizedId)) {
      throw new Error(`Invalid participantId: "${participantId}". Must be 1-64 alphanumeric, dash, or underscore characters.`);
    }

    if (orderOverride && orderOverride.length > 0) {
      const allowed = new Set(this._studyManifest.conditions);
      if (orderOverride.some((condition) => !allowed.has(condition))) {
        throw new Error('orderOverride contains a condition outside the study manifest');
      }
      this._assignment = {
        participantId: sanitizedId,
        order: [...orderOverride],
        cohort: 'Custom',
        assignedAt: Date.now(),
      };
    } else {
      this._assignment = this._counterbalancer.assignParticipant(sanitizedId);
    }

    this._currentConditionIndex = 0;
    this._currentTaskIndex = 0;
    this._sessionStartTime = Date.now();
    this._completedTrials = [];
    this._events = [];
    this._currentPhase = 'idle';

    this._logEvent('phase_change', {
      phase: 'idle',
      participantId: sanitizedId,
      studyConfigHash: this.freezeSnapshot.configHash,
      runtimeVersions: this.freezeSnapshot.runtimeVersions,
    });
    return this._assignment;
  }

  /** Starts the next trial in the counterbalanced sequence (Instruction phase). */
  startNextTrial(): { condition: StudyCondition; task: TaskSpec; phase: TrialPhase } {
    this._assertStudyFreeze();
    if (!this._assignment) {
      throw new Error('Participant session not initialized. Call startParticipantSession first.');
    }

    this._selectedNodeIds.clear();
    this._interactionCount = 0;
    this._navigationDistance = 0.0;
    this._lastCameraPosition = null;
    this._trialStartTime = Date.now();
    this._currentPhase = 'instruction';

    const condition = this.currentCondition!;
    const task = this.currentTask!;

    this._logEvent('phase_change', {
      phase: 'instruction',
      condition,
      taskId: task.id,
      trialStartTime: this._trialStartTime,
      studyConfigHash: this.freezeSnapshot.configHash,
    });

    return { condition, task, phase: this._currentPhase };
  }

  /** Transitions trial from instructions to active exploration. */
  beginExploration(): void {
    this._assertStudyFreeze();
    if (this._currentPhase !== 'instruction') {
      throw new Error(`Cannot transition to exploration from phase: ${this._currentPhase}`);
    }
    this._currentPhase = 'exploration';
    this._logEvent('phase_change', { phase: 'exploration' });
  }

  /** Records selection of a node by the participant. */
  selectNode(nodeId: string | number): void {
    if (this._currentPhase !== 'exploration' && this._currentPhase !== 'selection') {
      throw new Error(`Cannot select node in phase: ${this._currentPhase}`);
    }
    this._currentPhase = 'selection';
    this._selectedNodeIds.add(nodeId);
    this._interactionCount++;
    this._logEvent('node_select', { nodeId, totalSelected: this._selectedNodeIds.size });
  }

  /** Deselects a previously selected node. */
  deselectNode(nodeId: string | number): void {
    if (this._currentPhase !== 'exploration' && this._currentPhase !== 'selection') {
      throw new Error(`Cannot deselect node in phase: ${this._currentPhase}`);
    }
    this._selectedNodeIds.delete(nodeId);
    this._interactionCount++;
    this._logEvent('node_deselect', { nodeId, totalSelected: this._selectedNodeIds.size });
  }

  /** Records a user interaction event (e.g. filter, warp, inspector hover). */
  recordInteraction(type: string, details?: Record<string, unknown>): void {
    if (this._currentPhase !== 'exploration' && this._currentPhase !== 'selection') return;
    this._interactionCount++;
    this._logEvent('interaction', { interactionType: type, ...details });
  }

  /** Updates participant camera position and accumulates 3D physical navigation distance. */
  updateCameraPosition(x: number, y: number, z: number): void {
    if (this._lastCameraPosition) {
      const [lx, ly, lz] = this._lastCameraPosition;
      const dx = x - lx;
      const dy = y - ly;
      const dz = z - lz;
      const stepDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (stepDist >= 0.001 && stepDist <= 50.0) this._navigationDistance += stepDist;
    }
    this._lastCameraPosition = [x, y, z];
  }

  /** Submits selections and transitions to survey. */
  submitTrialAnswers(): { trialId: string; selectedCount: number } {
    this._assertStudyFreeze();
    if (this._currentPhase !== 'exploration' && this._currentPhase !== 'selection') {
      throw new Error(`Cannot submit trial answers in phase: ${this._currentPhase}`);
    }

    this._currentPhase = 'survey';
    this._logEvent('phase_change', { phase: 'survey', selected: Array.from(this._selectedNodeIds) });
    const trialId = `trial_${this.currentCondition}_${this.currentTask?.id}_${Date.now()}`;
    return { trialId, selectedCount: this._selectedNodeIds.size };
  }

  /** Records subjective ratings and finalizes trial metrics. */
  finalizeTrial(confidenceRating?: number, workloadScore?: number): TrialMetrics {
    this._assertStudyFreeze();
    if (this._currentPhase !== 'survey') {
      throw new Error(`Cannot finalize trial before survey phase (current: ${this._currentPhase})`);
    }
    if (confidenceRating !== undefined && (confidenceRating < 1 || confidenceRating > 7 || !Number.isFinite(confidenceRating))) {
      throw new Error(`Confidence rating out of range [1, 7]: ${confidenceRating}`);
    }
    if (workloadScore !== undefined && (workloadScore < 0 || workloadScore > 100 || !Number.isFinite(workloadScore))) {
      throw new Error(`Workload score out of range [0, 100]: ${workloadScore}`);
    }

    const endTime = Date.now();
    const durationMs = endTime - this._trialStartTime;
    const task = this.currentTask!;
    const condition = this.currentCondition!;
    const selected = Array.from(this._selectedNodeIds);
    const groundTruth = task.groundTruth.targetNodeIds;
    const gtSet = new Set(groundTruth.map(String));
    const selSet = new Set(selected.map(String));

    let tp = 0;
    let fp = 0;
    for (const s of selSet) {
      if (gtSet.has(s)) tp++;
      else fp++;
    }
    let fn = 0;
    for (const g of gtSet) {
      if (!selSet.has(g)) fn++;
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1Score = precision + recall > 0 ? (2 * (precision * recall)) / (precision + recall) : 0;
    const accuracy = tp === gtSet.size && fp === 0 ? 1.0 : tp / Math.max(1, gtSet.size + fp);
    const exclusions: string[] = [];
    if (durationMs > task.maxDurationMs) exclusions.push('TIMEOUT_EXCEEDED');

    const freeze = this.freezeSnapshot;
    const metrics: TrialMetrics = {
      trialId: `trial_${condition}_${task.id}_${endTime}`,
      participantId: this._assignment!.participantId,
      condition,
      taskId: task.id,
      startTime: this._trialStartTime,
      endTime,
      durationMs,
      selectedNodeIds: selected,
      groundTruthNodeIds: groundTruth,
      accuracy: Number(accuracy.toFixed(4)),
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1Score: Number(f1Score.toFixed(4)),
      interactionCount: this._interactionCount,
      navigationDistanceMeters: Number(this._navigationDistance.toFixed(3)),
      confidenceRating,
      workloadScore,
      completed: true,
      exclusions,
      studyConfigHash: freeze.configHash,
      runtimeVersions: freeze.runtimeVersions,
    };

    this._completedTrials.push(metrics);
    this._logEvent('survey_submit', { confidenceRating, workloadScore, metrics });

    this._currentTaskIndex++;
    if (this._currentTaskIndex >= this._tasks.length) {
      this._currentTaskIndex = 0;
      this._currentConditionIndex++;
    }

    if (this._currentConditionIndex >= this._assignment!.order.length) {
      this._currentPhase = 'completed';
      this._sessionEndTime = Date.now();
      this._logEvent('phase_change', { phase: 'completed' });
    } else {
      this._currentPhase = 'idle';
    }

    return structuredClone(metrics);
  }

  /** Exports the session with the exact treatment/runtime freeze snapshot. */
  exportStudySession(): StudySessionExport {
    this._assertStudyFreeze();
    if (!this._assignment) throw new Error('No study session to export');

    const freeze = this.freezeSnapshot;
    const payload = {
      studyName: FROZEN_STUDY_NAME,
      protocolVersion: FROZEN_PROTOCOL_VERSION,
      configHash: freeze.configHash,
      runtimeVersions: freeze.runtimeVersions,
      participantId: this._assignment.participantId,
      conditionOrder: [...this._assignment.order],
      sessionStartTime: this._sessionStartTime,
      sessionEndTime: this._sessionEndTime || Date.now(),
      trials: structuredClone(this._completedTrials),
      events: structuredClone(this._events),
    };

    let hash = 0x811c9dc5;
    const str = JSON.stringify(payload);
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    const provenanceHash = `fnv1a-${(hash >>> 0).toString(16)}`;
    return { ...payload, provenanceHash };
  }

  private _assertStudyFreeze(): void {
    this._freezeGuard.assertCurrent(this._studyManifest);
  }

  private _logEvent(eventType: TrialEvent['eventType'], payload?: Record<string, unknown>): void {
    this._events.push({
      timestamp: Date.now(),
      phase: this._currentPhase,
      eventType,
      payload,
    });
  }
}

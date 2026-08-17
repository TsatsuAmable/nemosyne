/**
 * StudyController for Nemosyne.
 *
 * Coordinates the live participant study experiment flow:
 * - Bridges ExperimentRunner lifecycle to StudyModeModal UI
 * - Integrates real-time 3D head movement distance tracking
 * - Routes node selection events into active trial metrics
 */

import type { ExperimentRunner } from '../../study/ExperimentRunner.ts';
import type { StudySessionExport, TrialMetrics } from '../../study/types.ts';
import { StudyModeModal } from '../ui/StudyModeModal.ts';

export class StudyController {
  public readonly modal: StudyModeModal;
  private currentTrialIndex = 0;

  constructor(
    public readonly runner: ExperimentRunner,
    public readonly participantId: string = 'P01'
  ) {
    this.modal = new StudyModeModal();
    this._bindModalActions();
  }

  /**
   * Initializes and opens study mode with the consent phase.
   */
  start(): void {
    const assignment = this.runner.startParticipantSession(this.participantId);
    this.currentTrialIndex = 0;

    this.modal.updateState({
      isOpen: true,
      phase: 'consent',
      trialIndex: 0,
      totalTrials: assignment.order.length,
      selectedCount: 0,
    });
    this.modal.show();
  }

  /**
   * Advances from consent to the trial instruction phase.
   */
  acceptConsent(): void {
    const trial = this.runner.startNextTrial();
    this.modal.updateState({
      phase: 'instruction',
      trialIndex: this.currentTrialIndex,
      condition: trial.condition,
      task: trial.task,
      timeLimitMs: trial.task.maxDurationMs,
      selectedCount: 0,
    });
  }

  /**
   * Begins the active exploration / selection phase of the trial.
   */
  beginExploration(): void {
    this.runner.beginExploration();
    this.modal.updateState({
      phase: 'exploration',
      elapsedMs: 0,
    });
  }

  /**
   * Records a user node selection in 2D or 3D.
   */
  recordNodeSelection(nodeId: string | number): void {
    this.runner.selectNode(nodeId);
    this.modal.updateState({
      selectedCount: this.runner.selectedNodeIds.length,
    });
  }

  /**
   * Updates physical head position and accumulates movement distance.
   */
  updateHeadPosition(x: number, y: number, z: number): void {
    this.runner.updateCameraPosition(x, y, z);
  }

  /**
   * Submits selected answers and transitions to the post-task workload survey.
   */
  submitAnswers(): void {
    this.runner.submitTrialAnswers();
    this.modal.updateState({
      phase: 'survey',
    });
  }

  /**
   * Submits workload & confidence ratings and completes the trial.
   */
  submitSurvey(confidenceRating: number = 7, workloadScore: number = 20): TrialMetrics {
    const metrics = this.runner.finalizeTrial(confidenceRating, workloadScore);
    this.currentTrialIndex++;

    if (this.runner.isSessionCompleted) {
      this.modal.updateState({
        phase: 'completed',
        f1Score: metrics.f1Score,
        accuracy: metrics.accuracy,
      });
    } else {
      this.acceptConsent();
    }

    return metrics;
  }

  /**
   * Exports the entire session data with cryptographic provenance hash.
   */
  exportSession(): StudySessionExport {
    return this.runner.exportStudySession();
  }

  private _bindModalActions(): void {
    this.modal.onAction((action, payload) => {
      switch (action) {
        case 'consent_agree':
          this.acceptConsent();
          break;
        case 'start_trial':
          this.beginExploration();
          break;
        case 'submit_answers':
          this.submitAnswers();
          break;
        case 'submit_survey':
          {
            const data = payload as { confidence?: number; workload?: number } | undefined;
            this.submitSurvey(data?.confidence, data?.workload);
          }
          break;
        case 'close':
          this.modal.hide();
          break;
      }
    });
  }
}

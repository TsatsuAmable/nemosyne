/**
 * StudyModeModal for Nemosyne.
 *
 * Interactive study UI for participant trials in Desktop and WebXR VR:
 * - Briefing & ethics consent
 * - Trial instructions & target query
 * - Active trial HUD (timer, selected node count, submit)
 * - NASA-TLX workload & confidence survey
 * - Session completion summary & cryptographic JSON export
 */

import type { TrialPhase, StudyCondition, TaskSpec } from '../../study/types.ts';

export type StudyModalAction =
  | 'consent_agree'
  | 'start_trial'
  | 'submit_answers'
  | 'submit_survey'
  | 'export_json'
  | 'close';

export interface StudyModalState {
  isOpen: boolean;
  phase: TrialPhase | 'consent' | 'completed';
  trialIndex: number;
  totalTrials: number;
  condition?: StudyCondition;
  task?: TaskSpec;
  elapsedMs: number;
  timeLimitMs: number;
  selectedCount: number;
  f1Score?: number;
  accuracy?: number;
}

export class StudyModeModal {
  private state: StudyModalState = {
    isOpen: false,
    phase: 'consent',
    trialIndex: 0,
    totalTrials: 0,
    elapsedMs: 0,
    timeLimitMs: 120_000,
    selectedCount: 0,
  };

  private actionCallback: ((action: StudyModalAction, payload?: unknown) => void) | null = null;

  onAction(cb: (action: StudyModalAction, payload?: unknown) => void): void {
    this.actionCallback = cb;
  }

  show(): void {
    this.state.isOpen = true;
  }

  hide(): void {
    this.state.isOpen = false;
  }

  updateState(partial: Partial<StudyModalState>): void {
    this.state = { ...this.state, ...partial };
  }

  getState(): Readonly<StudyModalState> {
    return this.state;
  }

  triggerAction(action: StudyModalAction, payload?: unknown): void {
    this.actionCallback?.(action, payload);
  }

  /**
   * Generates a descriptive status string for HUD rendering.
   */
  getStatusText(): string {
    if (!this.state.isOpen) return 'Study Mode: Inactive';

    switch (this.state.phase) {
      case 'consent':
        return 'Study Briefing: Please review and accept participant consent to begin.';
      case 'instruction':
        return `Trial ${this.state.trialIndex + 1}/${this.state.totalTrials}: ${this.state.task?.instructions ?? this.state.task?.description ?? 'Prepare for task'}`;
      case 'exploration':
      case 'query':
      case 'selection':
        return `Active Trial (${this.state.condition === '2d_control' ? '2D Baseline' : '3D Spatial'}): ${this.state.selectedCount} nodes selected. Time: ${(this.state.elapsedMs / 1000).toFixed(0)}s`;
      case 'survey':
        return 'Post-Trial Survey: Rate workload demand (NASA-TLX) and answer confidence.';
      case 'completed':
        return `Study Complete! Average F1: ${((this.state.f1Score ?? 1.0) * 100).toFixed(1)}%. Ready to export.`;
      default:
        return 'Study in progress';
    }
  }
}

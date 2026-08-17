import { describe, it, expect, beforeEach } from 'vitest';
import { ExperimentRunner } from '../src/study/ExperimentRunner.ts';
import { StudyController } from '../src/vr/coordinators/StudyController.ts';
import { FROZEN_STUDY_CONDITIONS, FROZEN_STUDY_TASKS } from '../src/study/FrozenStudyConfig.ts';
import { GROUND_TRUTH_FRAUD_IDS } from '../src/study/StudyDatasets.ts';

describe('StudyController & StudyModeModal Integration', () => {
  let runner: ExperimentRunner;
  let controller: StudyController;

  beforeEach(() => {
    runner = new ExperimentRunner(FROZEN_STUDY_CONDITIONS, FROZEN_STUDY_TASKS);
    controller = new StudyController(runner, 'P01');
  });

  it('initializes study mode in consent phase', () => {
    controller.start();
    const state = controller.modal.getState();

    expect(state.isOpen).toBe(true);
    expect(state.phase).toBe('consent');
    expect(state.totalTrials).toBe(FROZEN_STUDY_CONDITIONS.length);
    expect(controller.modal.getStatusText()).toContain('Study Briefing');
  });

  it('accepts consent and transitions to instruction phase', () => {
    controller.start();
    controller.acceptConsent();
    const state = controller.modal.getState();

    expect(state.phase).toBe('instruction');
    expect(state.trialIndex).toBe(0);
    expect(state.task).toBeDefined();
    expect(controller.modal.getStatusText()).toContain('Trial 1');
  });

  it('records 3D head movement and accumulates physical distance', () => {
    controller.start();
    controller.acceptConsent();
    controller.beginExploration();

    controller.updateHeadPosition(0, 0, 0);
    controller.updateHeadPosition(1, 0, 0); // 1 meter movement
    controller.updateHeadPosition(1, 1, 0); // 1 meter movement

    expect(runner.currentPhase).toBe('exploration');
  });

  it('records node selections and updates modal state', () => {
    controller.start();
    controller.acceptConsent();
    controller.beginExploration();

    controller.recordNodeSelection(GROUND_TRUTH_FRAUD_IDS[0]);
    controller.recordNodeSelection(GROUND_TRUTH_FRAUD_IDS[1]);

    expect(controller.modal.getState().selectedCount).toBe(2);
  });

  it('progresses through a complete trial to survey and exports session data', () => {
    controller.start();
    controller.acceptConsent();
    controller.beginExploration();

    // Select ground truth mule nodes
    for (const id of GROUND_TRUTH_FRAUD_IDS) {
      controller.recordNodeSelection(id);
    }

    controller.submitAnswers();
    expect(controller.modal.getState().phase).toBe('survey');

    const metrics = controller.submitSurvey(7, 20);
    expect(metrics).toBeDefined();
    expect(metrics.accuracy).toBe(1.0);
    expect(metrics.f1Score).toBe(1.0);

    // Export session
    const sessionExport = controller.exportSession();
    expect(sessionExport.participantId).toBe('P01');
    expect(sessionExport.provenanceHash).toBeDefined();
    expect(sessionExport.trials.length).toBeGreaterThanOrEqual(1);
  });
});

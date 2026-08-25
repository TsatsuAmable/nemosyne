import { describe, expect, it } from 'vitest';
import {
  ExperimentRunner,
  FROZEN_CONFIG_HASH,
  FROZEN_STUDY_CONDITIONS,
  FROZEN_STUDY_MANIFEST,
  FROZEN_STUDY_TASKS,
  StudyFreezeGuard,
  currentStudyRuntimeVersions,
  hashStudyFreezeManifest,
  type StudyRuntimeVersions,
} from '../src/study/index.ts';

describe('Study freeze enforcement', () => {
  it('derives a deterministic manifest hash instead of an unfrozen placeholder', () => {
    expect(FROZEN_CONFIG_HASH).toBe(hashStudyFreezeManifest(FROZEN_STUDY_MANIFEST));
    expect(FROZEN_CONFIG_HASH).toMatch(/^sha256-[0-9a-f]{64}$/);
    expect(FROZEN_CONFIG_HASH).not.toContain('unfrozen');
  });

  it('detects runtime version drift after the treatment snapshot is captured', () => {
    let versions: StudyRuntimeVersions = currentStudyRuntimeVersions('wasm-1');
    const manifest = {
      ...structuredClone(FROZEN_STUDY_MANIFEST),
      runtimeVersions: structuredClone(versions),
    };
    const guard = new StudyFreezeGuard(manifest, () => structuredClone(versions));

    guard.assertCurrent(manifest);
    versions = { ...versions, fitnessModelVersion: 'fitness-mutated' };
    expect(() => guard.assertCurrent(manifest)).toThrow(/runtime drift/i);
  });

  it('rejects undeclared task/condition variation unless explicitly opted in', () => {
    const variedTasks = structuredClone(FROZEN_STUDY_TASKS);
    variedTasks[0].maxDurationMs += 1;

    expect(() => new ExperimentRunner(FROZEN_STUDY_CONDITIONS, variedTasks)).toThrow(
      /allowProtocolVariation/i,
    );

    expect(
      () =>
        new ExperimentRunner(FROZEN_STUDY_CONDITIONS, variedTasks, {
          allowProtocolVariation: true,
        }),
    ).not.toThrow();
  });

  it('pins the exact study/runtime snapshot into every completed trial and export', () => {
    const versions = currentStudyRuntimeVersions('wasm-test-1');
    const runner = new ExperimentRunner(FROZEN_STUDY_CONDITIONS, FROZEN_STUDY_TASKS, {
      runtimeVersionsProvider: () => structuredClone(versions),
    });

    runner.startParticipantSession('P-freeze');
    runner.startNextTrial();
    runner.beginExploration();
    runner.selectNode('acc_fraud_99');
    runner.submitTrialAnswers();
    const metrics = runner.finalizeTrial(5, 30);

    expect(metrics.studyConfigHash).toBe(runner.freezeSnapshot.configHash);
    expect(metrics.runtimeVersions).toEqual(versions);

    const exported = runner.exportStudySession();
    expect(exported.configHash).toBe(metrics.studyConfigHash);
    expect(exported.runtimeVersions).toEqual(versions);
    expect(exported.trials[0].runtimeVersions).toEqual(versions);
  });

  it('fails at the next trial boundary if the live version provider changes', () => {
    let versions = currentStudyRuntimeVersions('wasm-test-1');
    const runner = new ExperimentRunner(FROZEN_STUDY_CONDITIONS, FROZEN_STUDY_TASKS, {
      runtimeVersionsProvider: () => structuredClone(versions),
    });

    runner.startParticipantSession('P-drift');
    versions = { ...versions, nilVersion: '2.0.0-unapproved' };
    expect(() => runner.startNextTrial()).toThrow(/runtime drift/i);
  });

  it('fails closed when the participant-facing UI treatment drifts mid-session', () => {
    let versions = currentStudyRuntimeVersions('wasm-test-1');
    const runner = new ExperimentRunner(FROZEN_STUDY_CONDITIONS, FROZEN_STUDY_TASKS, {
      runtimeVersionsProvider: () => structuredClone(versions),
    });

    runner.startParticipantSession('P-ui-drift');
    versions = { ...versions, uiTreatmentVersion: 'panel-layout/4+intent-wheel/1' };
    expect(() => runner.startNextTrial()).toThrow(/runtime drift/i);
  });

  it('requires an exact kernel version before a protocol can claim FROZEN status', () => {
    const frozen = {
      ...structuredClone(FROZEN_STUDY_MANIFEST),
      protocolStatus: 'FROZEN' as const,
      runtimeVersions: currentStudyRuntimeVersions(null),
    };
    expect(() => new StudyFreezeGuard(frozen)).toThrow(/kernel version/i);
  });
});

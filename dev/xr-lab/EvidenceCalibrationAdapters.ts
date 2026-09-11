import type { XREvaluationEpisode } from '../xr-simulator/XREvaluationEpisode.ts';
import { validateGuidedUxSubmission, type GuidedUxSubmission } from '../../src/validation/guided-ux-validation.ts';
import { validateValidationManifest, type ValidationManifest } from '../../src/validation/validation-manifest.ts';
import type { CalibrationObservation } from './EvidenceCalibration.ts';

const outcome = (value: XREvaluationEpisode['outcome']): CalibrationObservation['outcome'] =>
  ({ PASSED: 'PASS', FAILED: 'FAIL', INCOMPLETE: 'INCOMPLETE', UNSUPPORTED: 'UNSUPPORTED' } as const)[value];

export function calibrationObservationFromEpisode(episode: XREvaluationEpisode): CalibrationObservation {
  if (episode.environment.mode === 'quest-browser') {
    throw new Error('quest-browser episodes require governed physical evidence, not simulator adaptation');
  }
  const failures = episode.steps.filter((step) => step.outcome === 'FAILED').map((step) => `step:${step.stepId}`);
  return {
    evidenceId: episode.evaluationId,
    scenarioId: episode.scenarioId,
    buildHash: episode.buildHash,
    tier: episode.environment.mode === 'desktop-simulator' ? 'S2' : 'S1',
    kind: episode.environment.mode === 'desktop-simulator' ? 'simulator' : 'browser',
    outcome: outcome(episode.outcome),
    failureClasses: failures,
  };
}

export function calibrationObservationFromGuidedUx(
  submission: GuidedUxSubmission,
  scenarioId: string,
  manifest: ValidationManifest
): CalibrationObservation {
  const submissionErrors = validateGuidedUxSubmission(submission);
  if (submissionErrors.length) {
    throw new Error(`guided UX submission is not governed evidence: ${submissionErrors.join('; ')}`);
  }

  const checked = validateValidationManifest(manifest);
  if (!checked.ok) throw new Error(`validation manifest is invalid: ${checked.errors.join('; ')}`);
  const governed = checked.manifest;

  if (governed.validationMode !== 'quest-ux') {
    throw new Error('guided UX calibration requires a quest-ux validation manifest');
  }
  if (governed.evidenceClass !== 'governed-physical-validation') {
    throw new Error('guided UX calibration requires governed physical validation evidence');
  }
  if (!governed.deviceIdentity || governed.deviceIdentity.captureBasis !== 'adb-system-property') {
    throw new Error('guided UX calibration requires machine-captured ADB device identity');
  }
  if (submission.sessionId !== governed.sessionId || submission.buildId !== governed.buildId) {
    throw new Error('guided UX submission does not match the governed validation session');
  }
  if (
    submission.deviceBuildFingerprint === null ||
    submission.deviceBuildFingerprint !== governed.deviceIdentity.buildFingerprint
  ) {
    throw new Error('guided UX submission device fingerprint does not match the governed device identity');
  }

  const failed = submission.results.filter((result) => result.outcome === 'fail').map((result) => `ux:${result.taskId}`);
  if (submission.comfortObservation.outcome === 'issue') failed.push('ux:comfort');
  const incomplete =
    submission.results.some((result) => result.outcome === 'not-run') ||
    submission.comfortObservation.outcome === 'not-run';

  return {
    evidenceId: submission.sessionId,
    scenarioId,
    buildHash: submission.buildId,
    tier: 'S4',
    kind: 'physical-device',
    outcome: failed.length ? 'FAIL' : incomplete ? 'INCOMPLETE' : 'PASS',
    failureClasses: failed,
  };
}

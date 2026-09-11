import type { XREvaluationEpisode } from '../xr-simulator/XREvaluationEpisode.ts';
import type { GuidedUxSubmission } from '../../src/validation/guided-ux-validation.ts';
import type { CalibrationObservation } from './EvidenceCalibration.ts';

const outcome = (value: XREvaluationEpisode["outcome"]): CalibrationObservation["outcome"] =>
  ({ PASSED: "PASS", FAILED: "FAIL", INCOMPLETE: "INCOMPLETE", UNSUPPORTED: "UNSUPPORTED" } as const)[value];

export function calibrationObservationFromEpisode(episode: XREvaluationEpisode): CalibrationObservation {
  if (episode.environment.mode === "quest-browser") throw new Error("quest-browser episodes require governed physical evidence, not simulator adaptation");
  const failures = episode.steps.filter((step) => step.outcome === "FAILED").map((step) => `step:${step.stepId}`);
  return { evidenceId: episode.evaluationId, scenarioId: episode.scenarioId, buildHash: episode.buildHash, tier: episode.environment.mode === "desktop-simulator" ? "S2" : "S1", kind: episode.environment.mode === "desktop-simulator" ? "simulator" : "browser", outcome: outcome(episode.outcome), failureClasses: failures };
}

export function calibrationObservationFromGuidedUx(submission: GuidedUxSubmission, scenarioId: string): CalibrationObservation {
  const failed = submission.results.filter((result) => result.outcome === "fail").map((result) => `ux:${result.taskId}`);
  if (submission.comfortObservation.outcome === "issue") failed.push("ux:comfort");
  const incomplete = submission.results.some((result) => result.outcome === "not-run") || submission.comfortObservation.outcome === "not-run";
  return { evidenceId: submission.sessionId, scenarioId, buildHash: submission.buildId, tier: "S4", kind: "physical-device", outcome: failed.length ? "FAIL" : incomplete ? "INCOMPLETE" : "PASS", failureClasses: failed };
}

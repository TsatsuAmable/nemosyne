/**
 * P1-USIM WebXR simulator substrate (dev/test-only barrel).
 *
 * This module is intentionally outside `src/`: nothing in the production bundle
 * may reach `iwer` or this substrate. Tests import it directly.
 */

export { WebXRSimulatorAdapter, UnsupportedSimulatorCapabilityError } from './WebXRSimulatorAdapter.ts';
export {
  XREvaluationRecorder,
  EPISODE_BOUNDS,
  type XREvaluationEpisode,
  type XREvaluationStep,
  type XREvaluationMeasurement,
  type XREvaluationObservation,
  type XREvaluationSuggestion,
  type XRScreenshotReference,
  type XREvaluationMode,
  type XREvaluationOutcome,
  type AgentIdentity,
} from './XREvaluationEpisode.ts';
export {
  USIM_SCENARIOS,
  scenarioById,
  presetHandToWorld,
  presetHeadToWorld,
  type SimulatorScenario,
  type ScenarioStep,
  type ScenarioInputMode,
  type ScenarioAssertion,
} from './ScenarioFixtures.ts';
export {
  SimulatorScenarioRunner,
  bindProductionPointers,
  bindInputSources,
  applyInputSourcePoseToGroup,
  type ScenarioRunResult,
  type ScenarioRunnerOptions,
} from './ScenarioRunner.ts';
export {
  XRLifecycleScenarioRunner,
  type LifecycleScenarioResult,
  type SchedulerOutcome,
  type AsyncAnalysisStub,
  type LifecycleScenarioOptions,
} from './LifecycleScenarioRunner.ts';
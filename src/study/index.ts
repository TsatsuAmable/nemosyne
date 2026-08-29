/**
 * Study Subsystem — Barrel Export
 */

export * from './types.ts';
export * from './RuntimeFitnessMode.ts';
export * from './Counterbalancer.ts';
export * from './StudyDatasets.ts';
export * from './StudyFreezeManifest.ts';
export * from './FrozenStudyConfig.ts';
export * from './ExperimentRunner.ts';
export { StudyTrialExecutionHarness, StudyHarness } from './StudyHarness.ts';
export type { StudyTrialSpec, StudyTrialResponse, CompletedTrialRecord } from './StudyHarness.ts';
export * from './StudyStatisticalAnalyzer.ts';
export * from './StudyDataExporter.ts';
export {
  TelemetryConsentManager,
  type ConsentStatus,
  type ConsentScope,
  type ConsentRecord,
} from './TelemetryConsentManager.ts';
export {
  UXFrustrationAnalyzer,
  type UXEvent,
  type FrictionPattern,
  type CompactUXDigest,
} from '../utils/UXFrustrationAnalyzer.ts';

import type { EvidenceTier } from './ExperimentalProfiles.ts';

export type CalibrationOutcome = 'PASS' | 'FAIL' | 'INCOMPLETE' | 'UNSUPPORTED';
export type CalibrationEvidenceKind = 'simulator' | 'browser' | 'physical-device' | 'human-study';

export interface CalibrationObservation {
  evidenceId: string;
  scenarioId: string;
  buildHash: string;
  tier: EvidenceTier;
  kind: CalibrationEvidenceKind;
  outcome: CalibrationOutcome;
  failureClasses: string[];
  cost?: {
    humanMinutes?: number;
    deviceMinutes?: number;
    computeMinutes?: number;
  };
}

export interface EvidenceCalibrationPair {
  schemaVersion: '1';
  calibrationId: string;
  scenarioId: string;
  buildHash: string;
  cheapEvidence: CalibrationObservation[];
  highFidelityEvidence: CalibrationObservation;
  cheapConsensus: CalibrationOutcome | 'DISAGREE';
  counterSimulationFailure: boolean;
  cheapEvidenceDisagreement: boolean;
  missedFailureClasses: string[];
  createdAt: string;
}

const CHEAP_TIERS = new Set<EvidenceTier>(['S0', 'S1', 'S2', 'S3']);
const HIGH_FIDELITY_TIERS = new Set<EvidenceTier>(['S4', 'S5']);

function unique<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort();
}

function validateCommonIdentity(observation: CalibrationObservation, scenarioId: string, buildHash: string): void {
  if (observation.scenarioId !== scenarioId) {
    throw new Error(`calibration evidence scenario mismatch: ${observation.evidenceId}`);
  }
  if (observation.buildHash !== buildHash) {
    throw new Error(`calibration evidence build mismatch: ${observation.evidenceId}`);
  }
}

export function createEvidenceCalibrationPair(input: {
  calibrationId: string;
  cheapEvidence: CalibrationObservation[];
  highFidelityEvidence: CalibrationObservation;
  createdAt?: string;
}): EvidenceCalibrationPair {
  if (input.cheapEvidence.length === 0) throw new Error('calibration requires at least one cheap evidence observation');
  const high = input.highFidelityEvidence;
  if (!HIGH_FIDELITY_TIERS.has(high.tier)) throw new Error('high-fidelity calibration evidence must be S4 or S5');
  if (high.kind !== 'physical-device' && high.kind !== 'human-study') {
    throw new Error('high-fidelity calibration evidence must come from a physical device or human study');
  }
  for (const observation of input.cheapEvidence) {
    if (!CHEAP_TIERS.has(observation.tier)) throw new Error(`cheap evidence must be S0-S3: ${observation.evidenceId}`);
    validateCommonIdentity(observation, high.scenarioId, high.buildHash);
  }

  const cheapOutcomes = unique(input.cheapEvidence.map((e) => e.outcome));
  const cheapConsensus = cheapOutcomes.length === 1 ? cheapOutcomes[0] : 'DISAGREE';
  const cheapEvidenceDisagreement = cheapOutcomes.length > 1;
  const counterSimulationFailure = high.outcome === 'FAIL' && input.cheapEvidence.every((e) => e.outcome === 'PASS');
  const cheapFailureClasses = new Set(input.cheapEvidence.flatMap((e) => e.failureClasses));
  const missedFailureClasses = unique(high.failureClasses.filter((failure) => !cheapFailureClasses.has(failure)));

  return {
    schemaVersion: '1',
    calibrationId: input.calibrationId,
    scenarioId: high.scenarioId,
    buildHash: high.buildHash,
    cheapEvidence: input.cheapEvidence.map((e) => ({ ...e, failureClasses: [...e.failureClasses] })),
    highFidelityEvidence: { ...high, failureClasses: [...high.failureClasses] },
    cheapConsensus,
    counterSimulationFailure,
    cheapEvidenceDisagreement,
    missedFailureClasses,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export interface CalibrationSummary {
  pairs: number;
  counterSimulationFailures: number;
  counterSimulationRate: number | null;
  cheapDisagreementPairs: number;
  missedFailureClasses: Record<string, number>;
}

export function summarizeCalibrationPairs(pairs: EvidenceCalibrationPair[]): CalibrationSummary {
  const missedFailureClasses: Record<string, number> = {};
  for (const pair of pairs) {
    for (const failureClass of pair.missedFailureClasses) {
      missedFailureClasses[failureClass] = (missedFailureClasses[failureClass] ?? 0) + 1;
    }
  }
  const counterSimulationFailures = pairs.filter((pair) => pair.counterSimulationFailure).length;
  return {
    pairs: pairs.length,
    counterSimulationFailures,
    counterSimulationRate: pairs.length === 0 ? null : counterSimulationFailures / pairs.length,
    cheapDisagreementPairs: pairs.filter((pair) => pair.cheapEvidenceDisagreement).length,
    missedFailureClasses,
  };
}

import type { ReplayVerificationResult } from '../../src/session/InvestigationReplayRunner.ts';

/**
 * A replay-result double for callers that are not testing replay.
 *
 * `evidence` is required by the contract, so no double can omit it and still
 * compile. That is the point: a caller that only ever reads `success` is still
 * forced to state what governed evidence the run stood on.
 *
 * The default is the *absent* attestation, because a double represents a
 * package no test here actually exported — claiming `envelope: 'present'` would
 * assert a governed envelope that was never produced. Tests that mean to model a
 * governed package must pass a present attestation explicitly.
 */
export function replayResultDouble(
  overrides: Partial<ReplayVerificationResult> = {},
): ReplayVerificationResult {
  return {
    success: true,
    evidence: { envelope: 'absent' },
    sessionId: 'double-session',
    datasetName: 'double-dataset',
    datasetFingerprint: '0'.repeat(64),
    commandsReplayed: 0,
    eventsMatched: 0,
    provenanceEventsVerified: 0,
    representationProvenanceVerified: false,
    discoveryProvenanceVerified: 0,
    nilProvenanceVerified: 0,
    remediationEventsVerified: 0,
    refusalEventsVerified: 0,
    finalOutputHash: '0'.repeat(64),
    investigationDigest: '0'.repeat(64),
    evidenceCount: { observations: 0, findings: 0, annotations: 0 },
    discrepancies: [],
    ...overrides,
  };
}

/** UXR4 governed verification envelope. No automatic thresholds are invented here. */
export const UXR4_EVIDENCE_CLASSES = [
  'interaction',
  'responsiveness',
  'frame-render',
  'memory-resource',
  'semantic-scale',
] as const;
export type Uxr4EvidenceClass = (typeof UXR4_EVIDENCE_CLASSES)[number];
export type Uxr4EvidenceStatus = 'PASS' | 'FAIL' | 'PARTIAL' | 'INVALID_RUN' | 'BLOCKED';
export const UXR4_QUALIFICATION_PROFILES = [
  'functional-5m',
  'resource-trend-30m',
  'sustained-60m',
  'scale-staircase',
] as const;
export type Uxr4QualificationProfile = (typeof UXR4_QUALIFICATION_PROFILES)[number];
export const UXR4_PROFILE_PERFORMANCE_SOURCE: Record<Uxr4QualificationProfile, string> = {
  'functional-5m': 'uxr0-functional-5m',
  'resource-trend-30m': 'uxr0-resource-trend-30m',
  'sustained-60m': 'uxr0-sustained-60m',
  'scale-staircase': 'quest-3s-qualification',
};
export interface Uxr4EvidenceObservation {
  evidenceClass: Uxr4EvidenceClass;
  status: Uxr4EvidenceStatus;
  reasons: string[];
}
export interface Uxr4VerificationEnvelope {
  schemaVersion: 1;
  profile: Uxr4QualificationProfile;
  evidenceClass: 'governed-physical-validation' | 'clean-production-qualification';
  observations: Uxr4EvidenceObservation[];
}
export interface Uxr4EnvelopeAdjudication {
  schemaVersion: 1;
  profile: Uxr4QualificationProfile;
  results: Record<Uxr4EvidenceClass, Uxr4EvidenceObservation>;
  aggregateStatus: Uxr4EvidenceStatus;
}
const ORDER: Uxr4EvidenceStatus[] = ['INVALID_RUN', 'FAIL', 'BLOCKED', 'PARTIAL', 'PASS'];
export function adjudicateUxr4Envelope(input: Uxr4VerificationEnvelope): Uxr4EnvelopeAdjudication {
  const results = Object.fromEntries(
    UXR4_EVIDENCE_CLASSES.map((evidenceClass) => {
      const matches = input.observations.filter((item) => item.evidenceClass === evidenceClass);
      if (matches.length !== 1)
        return [
          evidenceClass,
          {
            evidenceClass,
            status: 'INVALID_RUN',
            reasons: [
              'expected exactly one ' + evidenceClass + ' observation; received ' + matches.length,
            ],
          },
        ];
      const observation = matches[0];
      return [evidenceClass, { ...observation, reasons: observation.reasons.slice(0, 32) }];
    })
  ) as Record<Uxr4EvidenceClass, Uxr4EvidenceObservation>;
  const aggregateStatus =
    ORDER.find((status) => UXR4_EVIDENCE_CLASSES.some((kind) => results[kind].status === status)) ??
    'PARTIAL';
  return { schemaVersion: 1, profile: input.profile, results, aggregateStatus };
}

export interface Uxr4LaneEvidence {
  sessionId: string;
  buildId: string;
  deviceBuildFingerprint: string | null;
  evidenceClass: 'governed-physical-validation' | 'clean-production-qualification';
  sourceProfile: string | null;
  observations: Uxr4EvidenceObservation[];
  custodyValid: boolean;
}

/** Compose independently finalized QV4 lanes. Never upgrades or averages evidence. */
export function composeUxr4LaneEvidence(
  profile: Uxr4QualificationProfile,
  lanes: Uxr4LaneEvidence[]
): Uxr4EnvelopeAdjudication {
  const invalidReasons: string[] = [];
  if (lanes.length === 0) invalidReasons.push('no finalized QV4 lane evidence supplied');
  const buildIds = new Set(lanes.map((lane) => lane.buildId));
  const fingerprints = new Set(lanes.map((lane) => lane.deviceBuildFingerprint));
  const evidenceClasses = new Set(lanes.map((lane) => lane.evidenceClass));
  if (buildIds.size > 1) invalidReasons.push('lane evidence spans multiple build identities');
  if (fingerprints.size > 1 || fingerprints.has(null))
    invalidReasons.push('lane evidence lacks one exact shared device build fingerprint');
  if (evidenceClasses.size > 1)
    invalidReasons.push('lane evidence spans incompatible evidence classes');
  if (lanes.some((lane) => !lane.custodyValid))
    invalidReasons.push('one or more lane custody records are invalid');
  const expectedPerformanceSource = UXR4_PROFILE_PERFORMANCE_SOURCE[profile];
  const performanceLanes = lanes.filter((lane) =>
    lane.observations.some(
      (observation) =>
        observation.evidenceClass === 'frame-render' ||
        observation.evidenceClass === 'memory-resource'
    )
  );
  if (performanceLanes.some((lane) => lane.sourceProfile !== expectedPerformanceSource)) {
    invalidReasons.push(
      `performance lane profile does not match UXR4 cohort '${profile}' (expected ${expectedPerformanceSource})`
    );
  }

  const observations = lanes.flatMap((lane) => lane.observations);
  if (invalidReasons.length > 0) {
    const results = Object.fromEntries(
      UXR4_EVIDENCE_CLASSES.map((evidenceClass) => [
        evidenceClass,
        {
          evidenceClass,
          status: 'INVALID_RUN' as const,
          reasons: invalidReasons.slice(0, 32),
        },
      ])
    ) as Record<Uxr4EvidenceClass, Uxr4EvidenceObservation>;
    return { schemaVersion: 1, profile, results, aggregateStatus: 'INVALID_RUN' };
  }
  return adjudicateUxr4Envelope({
    schemaVersion: 1,
    profile,
    evidenceClass: lanes[0]?.evidenceClass ?? 'governed-physical-validation',
    observations,
  });
}

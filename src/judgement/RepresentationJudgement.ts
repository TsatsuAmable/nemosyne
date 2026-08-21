/**
 * RepresentationJudgement — provenance-bearing human refinement evidence.
 *
 * Wave 3 deliberately captures trustworthy evidence only. These records are
 * never applied as learned priors or automatic weight updates by this module.
 */

export const REPRESENTATION_JUDGEMENT_SCHEMA_VERSION = '1.0.0' as const;

export type RepresentationJudgementKind =
  | 'PAIRWISE_PREFERENCE'
  | 'ABSOLUTE_RATING'
  | 'WEIGHT_ADJUSTMENT'
  | 'ALTERNATIVE_REJECTION'
  | 'DISCOVERY_OUTCOME_LINK';

export type JudgementRatingDimension =
  | 'TASK_FIT'
  | 'LEGIBILITY'
  | 'SPATIAL_COHERENCE'
  | 'COGNITIVE_LOAD'
  | 'DISCOVERY_UTILITY'
  | 'OVERALL';

export type JudgementOutcome =
  | 'SUPPORTED'
  | 'REFUTED'
  | 'INCONCLUSIVE'
  | 'EXTERNALLY_VALIDATED';

export interface JudgementProvenance {
  datasetFingerprint: string;
  kernelVersion: string;
  monetaVersion: string;
  fitnessModelVersion: string;
  ontologyVersion: string;
  nilVersion: string;
  representationGraphId: string;
  representationDecisionId?: string;
  discoveryId?: string;
  studyProtocolVersion?: string;
  studyConfigHash?: string;
}

export interface JudgementBase {
  schemaVersion: typeof REPRESENTATION_JUDGEMENT_SCHEMA_VERSION;
  judgementId: string;
  investigationId: string;
  researcherId: string;
  sequence: number;
  recordedAt: number;
  kind: RepresentationJudgementKind;
  provenance: JudgementProvenance;
  rationale?: string;
}

export interface PairwisePreferenceJudgement extends JudgementBase {
  kind: 'PAIRWISE_PREFERENCE';
  preferredGraphId: string;
  alternativeGraphId: string;
  strength?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

export interface AbsoluteRatingJudgement extends JudgementBase {
  kind: 'ABSOLUTE_RATING';
  graphId: string;
  dimension: JudgementRatingDimension;
  rating: 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

export interface WeightAdjustmentJudgement extends JudgementBase {
  kind: 'WEIGHT_ADJUSTMENT';
  dimension: string;
  previousWeight: number;
  proposedWeight: number;
  /** True only when the adjustment was explicitly applied by a researcher. */
  applied: boolean;
}

export interface AlternativeRejectionJudgement extends JudgementBase {
  kind: 'ALTERNATIVE_REJECTION';
  rejectedGraphId: string;
  reasonCodes: readonly string[];
}

export interface DiscoveryOutcomeLinkJudgement extends JudgementBase {
  kind: 'DISCOVERY_OUTCOME_LINK';
  discoveryId: string;
  graphId: string;
  outcome: JudgementOutcome;
}

export type RepresentationJudgement =
  | PairwisePreferenceJudgement
  | AbsoluteRatingJudgement
  | WeightAdjustmentJudgement
  | AlternativeRejectionJudgement
  | DiscoveryOutcomeLinkJudgement;

export interface JudgementValidationIssue {
  path: string;
  message: string;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function rating(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 7;
}

function finiteUnitWeight(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function validateRepresentationJudgement(
  judgement: RepresentationJudgement,
): JudgementValidationIssue[] {
  const issues: JudgementValidationIssue[] = [];
  const requireString = (path: string, value: unknown) => {
    if (!nonEmpty(value)) issues.push({ path, message: 'must be a non-empty string' });
  };

  if (judgement.schemaVersion !== REPRESENTATION_JUDGEMENT_SCHEMA_VERSION) {
    issues.push({ path: 'schemaVersion', message: 'unsupported judgement schema version' });
  }
  requireString('judgementId', judgement.judgementId);
  requireString('investigationId', judgement.investigationId);
  requireString('researcherId', judgement.researcherId);
  if (!Number.isSafeInteger(judgement.sequence) || judgement.sequence < 0) {
    issues.push({ path: 'sequence', message: 'must be a non-negative safe integer' });
  }
  if (!Number.isFinite(judgement.recordedAt) || judgement.recordedAt < 0) {
    issues.push({ path: 'recordedAt', message: 'must be a finite non-negative timestamp' });
  }

  const provenance = judgement.provenance;
  requireString('provenance.datasetFingerprint', provenance.datasetFingerprint);
  requireString('provenance.kernelVersion', provenance.kernelVersion);
  requireString('provenance.monetaVersion', provenance.monetaVersion);
  requireString('provenance.fitnessModelVersion', provenance.fitnessModelVersion);
  requireString('provenance.ontologyVersion', provenance.ontologyVersion);
  requireString('provenance.nilVersion', provenance.nilVersion);
  requireString('provenance.representationGraphId', provenance.representationGraphId);

  switch (judgement.kind) {
    case 'PAIRWISE_PREFERENCE':
      requireString('preferredGraphId', judgement.preferredGraphId);
      requireString('alternativeGraphId', judgement.alternativeGraphId);
      if (judgement.preferredGraphId === judgement.alternativeGraphId) {
        issues.push({ path: 'alternativeGraphId', message: 'must differ from preferredGraphId' });
      }
      if (judgement.strength !== undefined && !rating(judgement.strength)) {
        issues.push({ path: 'strength', message: 'must be an integer from 1 to 7' });
      }
      break;
    case 'ABSOLUTE_RATING':
      requireString('graphId', judgement.graphId);
      if (!rating(judgement.rating)) {
        issues.push({ path: 'rating', message: 'must be an integer from 1 to 7' });
      }
      break;
    case 'WEIGHT_ADJUSTMENT':
      requireString('dimension', judgement.dimension);
      if (!finiteUnitWeight(judgement.previousWeight)) {
        issues.push({ path: 'previousWeight', message: 'must be finite and within [0, 1]' });
      }
      if (!finiteUnitWeight(judgement.proposedWeight)) {
        issues.push({ path: 'proposedWeight', message: 'must be finite and within [0, 1]' });
      }
      break;
    case 'ALTERNATIVE_REJECTION':
      requireString('rejectedGraphId', judgement.rejectedGraphId);
      if (judgement.reasonCodes.length === 0 || judgement.reasonCodes.some((code) => !nonEmpty(code))) {
        issues.push({ path: 'reasonCodes', message: 'must contain at least one non-empty reason code' });
      }
      break;
    case 'DISCOVERY_OUTCOME_LINK':
      requireString('discoveryId', judgement.discoveryId);
      requireString('graphId', judgement.graphId);
      if (judgement.provenance.discoveryId && judgement.provenance.discoveryId !== judgement.discoveryId) {
        issues.push({ path: 'provenance.discoveryId', message: 'must match discoveryId when present' });
      }
      break;
  }

  return issues;
}

export function assertRepresentationJudgement(
  judgement: RepresentationJudgement,
): RepresentationJudgement {
  const issues = validateRepresentationJudgement(judgement);
  if (issues.length > 0) {
    throw new TypeError(
      `Invalid RepresentationJudgement: ${issues.map((issue) => `${issue.path} ${issue.message}`).join('; ')}`,
    );
  }
  return judgement;
}

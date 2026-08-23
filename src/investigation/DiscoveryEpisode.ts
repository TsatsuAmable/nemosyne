/**
 * DiscoveryEpisode — V3 first-class record of meaningful discovery.
 *
 * A notice is not a finding. This contract preserves the path from observation
 * through hypothesis and analytical validation, including refutation.
 */

export const DISCOVERY_EPISODE_SCHEMA_VERSION = '1.0.0' as const;

export type DiscoveryValidationStatus =
  | 'UNTESTED'
  | 'UNDER_INVESTIGATION'
  | 'SUPPORTED'
  | 'REFUTED'
  | 'INCONCLUSIVE'
  | 'EXTERNALLY_VALIDATED';

export interface DiscoveryAnalyticalTest {
  id: string;
  method: string;
  evidenceIds: readonly string[];
  outcome: 'SUPPORTS' | 'REFUTES' | 'INCONCLUSIVE';
  note?: string;
}

export interface DiscoveryRepresentationContext {
  representationGraphId?: string;
  /** Stable identity of the exact Moneta decision that framed this discovery. */
  representationDecisionId?: string;
  /** Fitness-model semantic version used by that decision. */
  fitnessModelVersion?: string;
  /** Immutable learned-model artifact identity, null/omitted for non-learned ranking. */
  fitnessModelArtifactHash?: string | null;
  /** Dataset fingerprint the referenced representation decision was made against. */
  decisionDatasetFingerprint?: string;
  /** Evidence item ids from the representation decision that materially framed the discovery. */
  decisionEvidenceIds?: readonly string[];
  ontologyVersion?: string;
}

export interface DiscoveryResearcherJudgement {
  relevance?: number;
  novelty?: number;
  confidence?: number;
  rationale?: string;
}

export interface DiscoveryEpisodeProvenance {
  datasetFingerprint: string;
  /** Dataset version at the time the discovery record was captured, when available. */
  datasetVersion?: number;
  kernelVersion: string;
  investigationVersion: string;
  interactionLanguageVersion?: string;
  randomSeeds: Readonly<Record<string, number>>;
}

export interface DiscoveryEpisode {
  schemaVersion: typeof DISCOVERY_EPISODE_SCHEMA_VERSION;
  discoveryId: string;
  investigationId: string;
  notice: string;
  question?: string;
  hypothesis?: string;
  explorationPath: readonly string[];
  analyticalTests: readonly DiscoveryAnalyticalTest[];
  evidenceIds: readonly string[];
  conclusion?: string;
  validationStatus: DiscoveryValidationStatus;
  representationContext: DiscoveryRepresentationContext;
  researcherJudgement?: DiscoveryResearcherJudgement;
  provenance: DiscoveryEpisodeProvenance;
}

export interface DiscoveryEpisodeValidationIssue {
  path: string;
  message: string;
}

const TERMINAL_STATUSES: readonly DiscoveryValidationStatus[] = [
  'SUPPORTED',
  'REFUTED',
  'INCONCLUSIVE',
  'EXTERNALLY_VALIDATED',
];

function nonEmpty(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function scoreInUnitInterval(value: number | undefined): boolean {
  return value === undefined || (Number.isFinite(value) && value >= 0 && value <= 1);
}

export function validateDiscoveryEpisode(
  episode: DiscoveryEpisode
): DiscoveryEpisodeValidationIssue[] {
  const issues: DiscoveryEpisodeValidationIssue[] = [];

  if (episode.schemaVersion !== DISCOVERY_EPISODE_SCHEMA_VERSION) {
    issues.push({ path: 'schemaVersion', message: `unsupported schema version: ${episode.schemaVersion}` });
  }
  if (!nonEmpty(episode.discoveryId)) issues.push({ path: 'discoveryId', message: 'must be non-empty' });
  if (!nonEmpty(episode.investigationId)) {
    issues.push({ path: 'investigationId', message: 'must be non-empty' });
  }
  if (!nonEmpty(episode.notice)) issues.push({ path: 'notice', message: 'must be non-empty' });

  if (episode.validationStatus !== 'UNTESTED' && !nonEmpty(episode.hypothesis)) {
    issues.push({
      path: 'hypothesis',
      message: 'a hypothesis is required once an episode enters investigation or validation',
    });
  }

  if (TERMINAL_STATUSES.includes(episode.validationStatus) && episode.analyticalTests.length === 0) {
    issues.push({
      path: 'analyticalTests',
      message: 'terminal validation states require at least one analytical test',
    });
  }

  if (TERMINAL_STATUSES.includes(episode.validationStatus) && !nonEmpty(episode.conclusion)) {
    issues.push({ path: 'conclusion', message: 'terminal validation states require a conclusion' });
  }

  const testIds = new Set<string>();
  episode.analyticalTests.forEach((test, index) => {
    const path = `analyticalTests[${index}]`;
    if (!nonEmpty(test.id)) {
      issues.push({ path: `${path}.id`, message: 'must be non-empty' });
    } else if (testIds.has(test.id)) {
      issues.push({ path: `${path}.id`, message: `duplicate analytical test id: ${test.id}` });
    } else {
      testIds.add(test.id);
    }
    if (!nonEmpty(test.method)) issues.push({ path: `${path}.method`, message: 'must be non-empty' });
    if (test.evidenceIds.length === 0) {
      issues.push({ path: `${path}.evidenceIds`, message: 'analytical tests must cite evidence' });
    }
  });

  const judgement = episode.researcherJudgement;
  if (judgement) {
    if (!scoreInUnitInterval(judgement.relevance)) {
      issues.push({ path: 'researcherJudgement.relevance', message: 'must be between 0 and 1' });
    }
    if (!scoreInUnitInterval(judgement.novelty)) {
      issues.push({ path: 'researcherJudgement.novelty', message: 'must be between 0 and 1' });
    }
    if (!scoreInUnitInterval(judgement.confidence)) {
      issues.push({ path: 'researcherJudgement.confidence', message: 'must be between 0 and 1' });
    }
  }

  const representation = episode.representationContext;
  if (representation.representationDecisionId !== undefined && !nonEmpty(representation.representationDecisionId)) {
    issues.push({ path: 'representationContext.representationDecisionId', message: 'must be non-empty when present' });
  }
  if (representation.fitnessModelVersion !== undefined && !nonEmpty(representation.fitnessModelVersion)) {
    issues.push({ path: 'representationContext.fitnessModelVersion', message: 'must be non-empty when present' });
  }
  if (
    representation.fitnessModelArtifactHash !== undefined &&
    representation.fitnessModelArtifactHash !== null &&
    !nonEmpty(representation.fitnessModelArtifactHash)
  ) {
    issues.push({ path: 'representationContext.fitnessModelArtifactHash', message: 'must be non-empty when present' });
  }
  if (
    representation.decisionDatasetFingerprint !== undefined &&
    !nonEmpty(representation.decisionDatasetFingerprint)
  ) {
    issues.push({ path: 'representationContext.decisionDatasetFingerprint', message: 'must be non-empty when present' });
  }
  if (representation.decisionEvidenceIds?.some((id) => !nonEmpty(id))) {
    issues.push({ path: 'representationContext.decisionEvidenceIds', message: 'must contain only non-empty ids' });
  }

  if (!nonEmpty(episode.provenance.datasetFingerprint)) {
    issues.push({ path: 'provenance.datasetFingerprint', message: 'must be non-empty' });
  }
  if (
    episode.provenance.datasetVersion !== undefined &&
    (!Number.isInteger(episode.provenance.datasetVersion) || episode.provenance.datasetVersion < 0)
  ) {
    issues.push({ path: 'provenance.datasetVersion', message: 'must be a non-negative integer when present' });
  }
  if (!nonEmpty(episode.provenance.kernelVersion)) {
    issues.push({ path: 'provenance.kernelVersion', message: 'must be non-empty' });
  }
  if (!nonEmpty(episode.provenance.investigationVersion)) {
    issues.push({ path: 'provenance.investigationVersion', message: 'must be non-empty' });
  }

  return issues;
}

export class InvalidDiscoveryEpisodeError extends Error {
  readonly issues: readonly DiscoveryEpisodeValidationIssue[];

  constructor(issues: readonly DiscoveryEpisodeValidationIssue[]) {
    super(`Invalid DiscoveryEpisode: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`);
    this.name = 'InvalidDiscoveryEpisodeError';
    this.issues = issues;
  }
}

export function assertDiscoveryEpisode(episode: DiscoveryEpisode): void {
  const issues = validateDiscoveryEpisode(episode);
  if (issues.length > 0) throw new InvalidDiscoveryEpisodeError(issues);
}

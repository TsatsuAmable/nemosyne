import {
  assertRepresentationJudgement,
  type RepresentationJudgement,
} from './RepresentationJudgement.ts';

export const JUDGEMENT_DATASET_SCHEMA_VERSION = '1.0.0' as const;

export type JudgementPartition = 'train' | 'validation' | 'holdout';

export type JudgementExclusionReason =
  | 'INVALID_JUDGEMENT'
  | 'DUPLICATE_JUDGEMENT_ID'
  | 'MISSING_REQUIRED_STUDY_PROVENANCE'
  | 'DISALLOWED_KERNEL_VERSION'
  | 'DISALLOWED_FITNESS_MODEL_VERSION'
  | 'DISALLOWED_ONTOLOGY_VERSION';

export interface JudgementCurationPolicy {
  requireStudyProvenance?: boolean;
  allowedKernelVersions?: readonly string[];
  allowedFitnessModelVersions?: readonly string[];
  allowedOntologyVersions?: readonly string[];
  partitionSeed: string;
  trainFraction: number;
  validationFraction: number;
}

export interface CuratedJudgementRecord {
  judgement: RepresentationJudgement;
  datasetGroup: string;
  researcherGroup: string;
  partitionGroup: string;
  partition: JudgementPartition;
}

export interface ExcludedJudgementRecord {
  judgementId: string;
  reason: JudgementExclusionReason;
  detail: string;
}

export interface CuratedJudgementDataset {
  schemaVersion: typeof JUDGEMENT_DATASET_SCHEMA_VERSION;
  policy: JudgementCurationPolicy;
  included: readonly CuratedJudgementRecord[];
  excluded: readonly ExcludedJudgementRecord[];
}

function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function validatePolicy(policy: JudgementCurationPolicy): void {
  if (!policy.partitionSeed.trim()) throw new TypeError('partitionSeed must be non-empty');
  if (!Number.isFinite(policy.trainFraction) || policy.trainFraction <= 0 || policy.trainFraction >= 1) {
    throw new TypeError('trainFraction must be within (0, 1)');
  }
  if (!Number.isFinite(policy.validationFraction) || policy.validationFraction < 0 || policy.validationFraction >= 1) {
    throw new TypeError('validationFraction must be within [0, 1)');
  }
  if (policy.trainFraction + policy.validationFraction >= 1) {
    throw new TypeError('trainFraction + validationFraction must leave a non-empty holdout fraction');
  }
}

function partitionFor(group: string, policy: JudgementCurationPolicy): JudgementPartition {
  const unit = fnv1a32(`${policy.partitionSeed}\u0000${group}`) / 0x1_0000_0000;
  if (unit < policy.trainFraction) return 'train';
  if (unit < policy.trainFraction + policy.validationFraction) return 'validation';
  return 'holdout';
}

function allowed(value: string, allowlist?: readonly string[]): boolean {
  return !allowlist || allowlist.includes(value);
}

/**
 * Builds a deterministic, auditable learning dataset without fitting any model.
 *
 * Partitioning is grouped by dataset fingerprint + researcher ID so repeated
 * judgements from the same researcher on the same dataset can never leak across
 * train/validation/holdout partitions.
 */
export function buildCuratedJudgementDataset(
  judgements: readonly RepresentationJudgement[],
  policy: JudgementCurationPolicy,
): CuratedJudgementDataset {
  validatePolicy(policy);
  const included: CuratedJudgementRecord[] = [];
  const excluded: ExcludedJudgementRecord[] = [];
  const ids = new Set<string>();

  for (const judgement of judgements) {
    try {
      assertRepresentationJudgement(judgement);
    } catch (error) {
      excluded.push({
        judgementId: judgement.judgementId || '<missing>',
        reason: 'INVALID_JUDGEMENT',
        detail: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    if (ids.has(judgement.judgementId)) {
      excluded.push({
        judgementId: judgement.judgementId,
        reason: 'DUPLICATE_JUDGEMENT_ID',
        detail: 'judgementId appears more than once in the source evidence',
      });
      continue;
    }
    ids.add(judgement.judgementId);

    const provenance = judgement.provenance;
    if (policy.requireStudyProvenance && (!provenance.studyProtocolVersion || !provenance.studyConfigHash)) {
      excluded.push({
        judgementId: judgement.judgementId,
        reason: 'MISSING_REQUIRED_STUDY_PROVENANCE',
        detail: 'studyProtocolVersion and studyConfigHash are required by curation policy',
      });
      continue;
    }
    if (!allowed(provenance.kernelVersion, policy.allowedKernelVersions)) {
      excluded.push({ judgementId: judgement.judgementId, reason: 'DISALLOWED_KERNEL_VERSION', detail: provenance.kernelVersion });
      continue;
    }
    if (!allowed(provenance.fitnessModelVersion, policy.allowedFitnessModelVersions)) {
      excluded.push({ judgementId: judgement.judgementId, reason: 'DISALLOWED_FITNESS_MODEL_VERSION', detail: provenance.fitnessModelVersion });
      continue;
    }
    if (!allowed(provenance.ontologyVersion, policy.allowedOntologyVersions)) {
      excluded.push({ judgementId: judgement.judgementId, reason: 'DISALLOWED_ONTOLOGY_VERSION', detail: provenance.ontologyVersion });
      continue;
    }

    const datasetGroup = provenance.datasetFingerprint;
    const researcherGroup = judgement.researcherId;
    const partitionGroup = `${datasetGroup}::${researcherGroup}`;
    included.push({
      judgement: structuredClone(judgement),
      datasetGroup,
      researcherGroup,
      partitionGroup,
      partition: partitionFor(partitionGroup, policy),
    });
  }

  return {
    schemaVersion: JUDGEMENT_DATASET_SCHEMA_VERSION,
    policy: structuredClone(policy),
    included,
    excluded,
  };
}

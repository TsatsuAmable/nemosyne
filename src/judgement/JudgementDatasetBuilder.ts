import { sha256UnitInterval } from '../security/CryptoHash.ts';
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

/**
 * Deterministic group assignment using SHA-256 as a stable pseudo-random
 * mapping. The first 48 digest bits map exactly into IEEE-754, avoiding the
 * weak-distribution assumptions of the previous 32-bit FNV splitter.
 */
function partitionFor(group: string, policy: JudgementCurationPolicy): JudgementPartition {
  const unit = sha256UnitInterval(`${policy.partitionSeed}\u0000${group}`);
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

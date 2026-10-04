import { canonicalSha256Hex, sha256UnitInterval } from '../security/CryptoHash.js';
import type { PairwisePreferenceJudgement, DiscoveryOutcomeLinkJudgement } from '../judgement/RepresentationJudgement.js';
import type { HumanMeaningJudgmentRecordV1, EmbodimentCritiqueRecordV1 } from '../moneta/forma/FormaHumanFeedback.js';
import type { PairwiseCandidateFeatureSnapshot } from '../fitness/PairwiseLearning.js';

export const FORMA_LEARNING_CORPUS_SCHEMA_VERSION = 1 as const;

export type LearningEvidenceCategory =
  | 'PREFERENCE'
  | 'MEANING_RECOVERY'
  | 'DISCOVERY_OUTCOME'
  | 'SCIENTIFIC_VALIDATION';

export type LearningPartition = 'train' | 'validation' | 'holdout';

export interface FormaLearningExampleV1 {
  readonly exampleId: string;
  readonly category: LearningEvidenceCategory;
  readonly representationId: string;
  readonly datasetFingerprint: string;
  readonly researcherId: string;
  readonly partitionGroup: string;
  readonly partition: LearningPartition;
  readonly features: readonly number[];
  readonly targetLabel: number; // 1.0 (positive/accurate/preferred), 0.0 (negative/failed/rejected)
  readonly weight: number;
  readonly rationale?: string;
}

export type FormaLearningCorpusIssueReason =
  | 'UNCONFIRMED_HUMAN_TESTIMONY'
  | 'SELF_LABELED_OR_AUTOMATED'
  | 'MISSING_FEATURE_SNAPSHOT'
  | 'NON_FINITE_FEATURE'
  | 'INVALID_PROVENANCE';

export interface FormaLearningCorpusIssueV1 {
  readonly recordId: string;
  readonly reason: FormaLearningCorpusIssueReason;
  readonly detail: string;
}

export interface FormaCorpusPartitionPolicy {
  readonly partitionSeed: string;
  readonly trainFraction: number;
  readonly validationFraction: number;
  /** 'by-dataset' ensures holdout datasets are completely disjoint from train */
  readonly partitionStrategy: 'by-dataset' | 'by-researcher';
}

export interface FormaCuratedCorpusV1 {
  readonly schemaVersion: typeof FORMA_LEARNING_CORPUS_SCHEMA_VERSION;
  readonly corpusId: string;
  readonly examples: readonly FormaLearningExampleV1[];
  readonly issues: readonly FormaLearningCorpusIssueV1[];
  readonly policy: FormaCorpusPartitionPolicy;
  readonly counts: {
    readonly total: number;
    readonly train: number;
    readonly validation: number;
    readonly holdout: number;
    readonly byCategory: Readonly<Record<LearningEvidenceCategory, number>>;
  };
}

export class FormaCuratedLearningCorpusBuilder {
  private readonly policy: FormaCorpusPartitionPolicy;

  constructor(
    policy: FormaCorpusPartitionPolicy = {
      partitionSeed: 'forma-pt9-curation-seed-v1',
      trainFraction: 0.70,
      validationFraction: 0.15,
      partitionStrategy: 'by-dataset',
    }
  ) {
    if (policy.trainFraction <= 0 || policy.trainFraction >= 1) {
      throw new TypeError('trainFraction must be in (0, 1)');
    }
    if (policy.validationFraction < 0 || policy.validationFraction >= 1) {
      throw new TypeError('validationFraction must be in [0, 1)');
    }
    if (policy.trainFraction + policy.validationFraction >= 1) {
      throw new TypeError('trainFraction + validationFraction must be strictly < 1 (holdout required)');
    }
    this.policy = policy;
  }

  private assignPartition(groupKey: string): LearningPartition {
    const unit = sha256UnitInterval(`${this.policy.partitionSeed}:${groupKey}`);
    if (unit < this.policy.trainFraction) return 'train';
    if (unit < this.policy.trainFraction + this.policy.validationFraction) return 'validation';
    return 'holdout';
  }

  /**
   * Builds the curated learning corpus from input judgments, meaning records, critiques,
   * feature snapshots, and discovery outcome links.
   */
  public build(input: {
    pairwiseJudgements?: readonly PairwisePreferenceJudgement[];
    meaningJudgments?: readonly HumanMeaningJudgmentRecordV1[];
    critiques?: readonly EmbodimentCritiqueRecordV1[];
    discoveryLinks?: readonly DiscoveryOutcomeLinkJudgement[];
    featureSnapshots?: ReadonlyMap<string, PairwiseCandidateFeatureSnapshot>;
  }): FormaCuratedCorpusV1 {
    const examples: FormaLearningExampleV1[] = [];
    const issues: FormaLearningCorpusIssueV1[] = [];
    const snapshots = input.featureSnapshots ?? new Map<string, PairwiseCandidateFeatureSnapshot>();

    // 1. Process Meaning Judgments
    for (const j of input.meaningJudgments ?? []) {
      if (!j.confirmed) {
        issues.push({
          recordId: j.judgmentId,
          reason: 'UNCONFIRMED_HUMAN_TESTIMONY',
          detail: 'Meaning judgment has confirmed = false; unconfirmed testimony excluded',
        });
        continue;
      }

      const snapshotKey = `${j.representationId}`;
      const snap = snapshots.get(snapshotKey);
      if (!snap || !Array.isArray(snap.features) || snap.features.length === 0) {
        issues.push({
          recordId: j.judgmentId,
          reason: 'MISSING_FEATURE_SNAPSHOT',
          detail: `Missing genuine feature snapshot for representation ${j.representationId}`,
        });
        continue;
      }
      const features = snap.features;
      if (features.some((f) => !Number.isFinite(f))) {
        issues.push({
          recordId: j.judgmentId,
          reason: 'NON_FINITE_FEATURE',
          detail: 'Found non-finite feature value in representation snapshot',
        });
        continue;
      }

      const partitionGroup =
        this.policy.partitionStrategy === 'by-dataset'
          ? (snap.datasetFingerprint || j.author.researcherId)
          : j.author.researcherId;
      const partition = this.assignPartition(partitionGroup);

      const isAccurate = j.taskComprehensionOutcome === 'ACCURATE';
      const targetLabel = isAccurate ? 1.0 : 0.0;

      examples.push({
        exampleId: `example-meaning:${j.judgmentId}`,
        category: 'MEANING_RECOVERY',
        representationId: j.representationId,
        datasetFingerprint: snap.datasetFingerprint || 'unknown-dataset',
        researcherId: j.author.researcherId,
        partitionGroup,
        partition,
        features,
        targetLabel,
        weight: 1.0,
        rationale: `Intended: "${j.intendedSemanticMeaning}", Perceived: "${j.perceivedMeaning}"`,
      });
    }

    // 2. Process Pairwise Preference Judgements
    for (const p of input.pairwiseJudgements ?? []) {
      const snapPref = snapshots.get(p.preferredGraphId);
      const snapAlt = snapshots.get(p.alternativeGraphId);

      if (!snapPref || !snapAlt) {
        issues.push({
          recordId: p.judgementId,
          reason: 'MISSING_FEATURE_SNAPSHOT',
          detail: `Missing feature snapshot for preferred (${p.preferredGraphId}) or alternative (${p.alternativeGraphId})`,
        });
        continue;
      }

      const featureDelta = snapPref.features.map((val, idx) => val - (snapAlt.features[idx] ?? 0));
      if (featureDelta.some((f) => !Number.isFinite(f))) {
        issues.push({
          recordId: p.judgementId,
          reason: 'NON_FINITE_FEATURE',
          detail: 'Non-finite value in feature delta',
        });
        continue;
      }

      const partitionGroup =
        this.policy.partitionStrategy === 'by-dataset'
          ? p.provenance.datasetFingerprint
          : p.researcherId;
      const partition = this.assignPartition(partitionGroup);

      examples.push({
        exampleId: `example-pref:${p.judgementId}`,
        category: 'PREFERENCE',
        representationId: p.preferredGraphId,
        datasetFingerprint: p.provenance.datasetFingerprint,
        researcherId: p.researcherId,
        partitionGroup,
        partition,
        features: featureDelta,
        targetLabel: 1.0,
        weight: (p.strength ?? 4) / 7.0,
        rationale: p.rationale,
      });
    }

    // 3. Process Discovery Outcome Links
    for (const d of input.discoveryLinks ?? []) {
      const snap = snapshots.get(d.graphId);
      if (!snap || !Array.isArray(snap.features) || snap.features.length === 0) {
        issues.push({
          recordId: d.judgementId,
          reason: 'MISSING_FEATURE_SNAPSHOT',
          detail: `Missing genuine feature snapshot for representation ${d.graphId}`,
        });
        continue;
      }
      const features = snap.features;
      if (features.some((f) => !Number.isFinite(f))) {
        issues.push({
          recordId: d.judgementId,
          reason: 'NON_FINITE_FEATURE',
          detail: 'Found non-finite feature value in representation snapshot',
        });
        continue;
      }

      const partitionGroup =
        this.policy.partitionStrategy === 'by-dataset'
          ? d.provenance.datasetFingerprint
          : d.researcherId;
      const partition = this.assignPartition(partitionGroup);

      const isSuccess = d.outcome === 'SUPPORTED' || d.outcome === 'EXTERNALLY_VALIDATED';
      const targetLabel = isSuccess ? 1.0 : 0.0;

      examples.push({
        exampleId: `example-disc:${d.judgementId}`,
        category: 'DISCOVERY_OUTCOME',
        representationId: d.graphId,
        datasetFingerprint: d.provenance.datasetFingerprint,
        researcherId: d.researcherId,
        partitionGroup,
        partition,
        features,
        targetLabel,
        weight: d.outcome === 'EXTERNALLY_VALIDATED' ? 1.5 : 1.0,
        rationale: `Discovery ${d.discoveryId} outcome: ${d.outcome}`,
      });
    }

    const byCategory: Record<LearningEvidenceCategory, number> = {
      PREFERENCE: 0,
      MEANING_RECOVERY: 0,
      DISCOVERY_OUTCOME: 0,
      SCIENTIFIC_VALIDATION: 0,
    };

    let train = 0;
    let validation = 0;
    let holdout = 0;

    for (const ex of examples) {
      byCategory[ex.category]++;
      if (ex.partition === 'train') train++;
      else if (ex.partition === 'validation') validation++;
      else if (ex.partition === 'holdout') holdout++;
    }

    const corpusId = `corpus-pt9-v1:${canonicalSha256Hex({
      policy: this.policy,
      examples: examples.map((e) => ({
        exampleId: e.exampleId,
        category: e.category,
        representationId: e.representationId,
        datasetFingerprint: e.datasetFingerprint,
        researcherId: e.researcherId,
        partitionGroup: e.partitionGroup,
        partition: e.partition,
        features: e.features,
        targetLabel: e.targetLabel,
        weight: e.weight,
        rationale: e.rationale,
      })),
      issues: issues.map((i) => ({
        recordId: i.recordId,
        reason: i.reason,
        detail: i.detail,
      })),
    })}`;

    return {
      schemaVersion: FORMA_LEARNING_CORPUS_SCHEMA_VERSION,
      corpusId,
      examples: Object.freeze(examples),
      issues: Object.freeze(issues),
      policy: this.policy,
      counts: {
        total: examples.length,
        train,
        validation,
        holdout,
        byCategory: Object.freeze(byCategory),
      },
    };
  }
}

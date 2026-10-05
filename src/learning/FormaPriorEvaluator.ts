import type {
  FitnessModelArtifact,
  FitnessModelEvaluationSummary,
  FitnessModelRegistry,
  RegisteredFitnessModel,
} from '../fitness/FitnessModelRegistry.js';
import type { FormaCuratedCorpusV1 } from './FormaCuratedLearningCorpus.js';


export interface FormaPriorEvaluationResult {
  readonly modelId: string;
  readonly modelVersion: string;
  readonly candidateWeights: CandidateFormaPriorWeights;
  readonly corpusId: string;
  readonly baselineAccuracy: number;
  readonly candidateAccuracy: number;
  readonly improvement: number;
  readonly holdoutCount: number;
  readonly holdoutGroupCount: number;
  readonly leaveOneGroupOutImprovementFloor: number;
  readonly knownAnswerPassRate: number;
  readonly abstentionComplianceRate: number;
  readonly passedGate: boolean;
  readonly refusalReasons: readonly string[];
}

export interface CandidateFormaPriorWeights {
  readonly intentRelevanceWeight: number;
  readonly budgetFitnessWeight: number;
  readonly templateParityWeight: number;
  readonly caseBasedBonusWeight?: number;
}

export const BASELINE_FORMA_PRIOR_WEIGHTS: CandidateFormaPriorWeights = {
  intentRelevanceWeight: 0.45,
  budgetFitnessWeight: 0.35,
  templateParityWeight: 0.20,
  caseBasedBonusWeight: 0.0,
};

/**
 * A safety/admissibility rate is admissible evidence only when it is a finite
 * measurement inside the declared [0, 1] domain. Bare type presence (which
 * admits NaN and Infinity) must never satisfy a promotion gate.
 */
function isFiniteUnitRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

export class FormaPriorEvaluator {
  private readonly baselineWeights: CandidateFormaPriorWeights;
  private readonly minHoldoutCount: number;

  constructor(
    baselineWeights: CandidateFormaPriorWeights = BASELINE_FORMA_PRIOR_WEIGHTS,
    minHoldoutCount: number = 3
  ) {
    this.baselineWeights = baselineWeights;
    this.minHoldoutCount = minHoldoutCount;
  }

  private scoreExample(features: readonly number[], weights: CandidateFormaPriorWeights): number {
    const f0 = features[0] ?? 0;
    const f1 = features[1] ?? 0;
    const f2 = features[2] ?? 0;
    const f3 = features[3] ?? 0;

    return (
      f0 * weights.intentRelevanceWeight +
      f1 * weights.budgetFitnessWeight +
      f2 * weights.templateParityWeight +
      f3 * (weights.caseBasedBonusWeight ?? 0)
    );
  }

  /**
   * Evaluates candidate weights against the baseline on the held-out partition of the curated corpus.
   */
  public evaluate(
    candidate: CandidateFormaPriorWeights,
    corpus: FormaCuratedCorpusV1,
    metadata: {
      modelId: string;
      modelVersion: string;
      knownAnswerPassRate?: number;
      abstentionComplianceRate?: number;
    }
  ): FormaPriorEvaluationResult {
    const holdoutExamples = corpus.examples.filter((e) => e.partition === 'holdout');
    const holdoutCount = holdoutExamples.length;
    const refusalReasons: string[] = [];

    const rawKnownAnswerPassRate = metadata.knownAnswerPassRate;
    const rawAbstentionComplianceRate = metadata.abstentionComplianceRate;
    const knownAnswerPassRateValid = isFiniteUnitRate(rawKnownAnswerPassRate);
    const abstentionComplianceRateValid = isFiniteUnitRate(rawAbstentionComplianceRate);
    if (!knownAnswerPassRateValid) {
      refusalReasons.push(
        rawKnownAnswerPassRate === undefined || typeof rawKnownAnswerPassRate !== 'number'
          ? 'Missing required evaluation: knownAnswerPassRate must be explicitly measured'
          : 'Invalid required evaluation: knownAnswerPassRate must be a finite rate in [0, 1]'
      );
    }
    if (!abstentionComplianceRateValid) {
      refusalReasons.push(
        rawAbstentionComplianceRate === undefined || typeof rawAbstentionComplianceRate !== 'number'
          ? 'Missing required evaluation: abstentionComplianceRate must be explicitly measured'
          : 'Invalid required evaluation: abstentionComplianceRate must be a finite rate in [0, 1]'
      );
    }

    // Fail closed: only a finite in-domain measurement is stored; anything else
    // normalizes to 0.0 so an invalid value can never read as a legitimate observation.
    const knownAnswerPassRate = knownAnswerPassRateValid ? rawKnownAnswerPassRate : 0.0;
    const abstentionComplianceRate = abstentionComplianceRateValid ? rawAbstentionComplianceRate : 0.0;

    if (holdoutCount < this.minHoldoutCount) {
      refusalReasons.push(
        `Insufficient holdout examples (${holdoutCount}, minimum ${this.minHoldoutCount} required)`
      );
    }

    let baselineCorrect = 0;
    let candidateCorrect = 0;

    for (const ex of holdoutExamples) {
      const baseScore = this.scoreExample(ex.features, this.baselineWeights);
      const candScore = this.scoreExample(ex.features, candidate);

      // Positive prediction if score > 0.5
      const basePred = baseScore >= 0.5 ? 1.0 : 0.0;
      const candPred = candScore >= 0.5 ? 1.0 : 0.0;

      if (basePred === ex.targetLabel) baselineCorrect++;
      if (candPred === ex.targetLabel) candidateCorrect++;
    }

    const baselineAccuracy = holdoutCount > 0 ? baselineCorrect / holdoutCount : 0.0;
    const candidateAccuracy = holdoutCount > 0 ? candidateCorrect / holdoutCount : 0.0;
    const improvement = candidateAccuracy - baselineAccuracy;

    if (candidateAccuracy <= baselineAccuracy) {
      refusalReasons.push(
        `Candidate accuracy (${candidateAccuracy.toFixed(3)}) does not exceed baseline (${baselineAccuracy.toFixed(3)}) on holdout set`
      );
    }

    if (knownAnswerPassRateValid && knownAnswerPassRate < 1.0) {
      refusalReasons.push(
        `Known-answer regression: pass rate ${knownAnswerPassRate.toFixed(3)} is below mandatory 1.0`
      );
    }

    if (abstentionComplianceRateValid && abstentionComplianceRate < 1.0) {
      refusalReasons.push(
        `Abstention constraint violation: compliance rate ${abstentionComplianceRate.toFixed(3)} is below mandatory 1.0`
      );
    }

    const holdoutGroups = Array.from(new Set(holdoutExamples.map((e) => e.partitionGroup)));
    const holdoutGroupCount = holdoutGroups.length;

    let leaveOneGroupOutImprovementFloor = improvement;
    if (holdoutGroupCount >= 2) {
      let minLogo = Infinity;
      for (const group of holdoutGroups) {
        const logoExamples = holdoutExamples.filter((e) => e.partitionGroup !== group);
        if (logoExamples.length === 0) continue;
        let baseLogoCorrect = 0;
        let candLogoCorrect = 0;
        for (const ex of logoExamples) {
          const baseScore = this.scoreExample(ex.features, this.baselineWeights);
          const candScore = this.scoreExample(ex.features, candidate);
          if ((baseScore >= 0.5 ? 1.0 : 0.0) === ex.targetLabel) baseLogoCorrect++;
          if ((candScore >= 0.5 ? 1.0 : 0.0) === ex.targetLabel) candLogoCorrect++;
        }
        const logoImp = (candLogoCorrect - baseLogoCorrect) / logoExamples.length;
        if (logoImp < minLogo) {
          minLogo = logoImp;
        }
      }
      if (Number.isFinite(minLogo)) {
        leaveOneGroupOutImprovementFloor = minLogo;
      }
    }

    const passedGate = refusalReasons.length === 0;

    return {
      modelId: metadata.modelId,
      modelVersion: metadata.modelVersion,
      candidateWeights: { ...candidate },
      corpusId: corpus.corpusId,
      baselineAccuracy,
      candidateAccuracy,
      improvement,
      holdoutCount,
      holdoutGroupCount,
      leaveOneGroupOutImprovementFloor,
      knownAnswerPassRate,
      abstentionComplianceRate,
      passedGate,
      refusalReasons: Object.freeze(refusalReasons),
    };
  }

  /**
   * Promotes candidate prior to the FitnessModelRegistry if it passes the evaluation gate.
   * Fails closed if the evaluation gate rejects the candidate or if candidate substitution is detected.
   */
  public promoteToRegistry(
    candidate: CandidateFormaPriorWeights,
    evaluation: FormaPriorEvaluationResult,
    registry: FitnessModelRegistry,
    trainingDatasetHash: string,
    curationPolicyHash: string
  ): RegisteredFitnessModel {
    if (!evaluation.passedGate) {
      throw new Error(
        `[FormaPriorEvaluator] Cannot promote candidate prior: failed evaluation gate: ${evaluation.refusalReasons.join('; ')}`
      );
    }

    // Candidate weights identity binding check (prevent candidate substitution)
    if (
      !evaluation.candidateWeights ||
      evaluation.candidateWeights.intentRelevanceWeight !== candidate.intentRelevanceWeight ||
      evaluation.candidateWeights.budgetFitnessWeight !== candidate.budgetFitnessWeight ||
      evaluation.candidateWeights.templateParityWeight !== candidate.templateParityWeight ||
      (evaluation.candidateWeights.caseBasedBonusWeight ?? 0) !== (candidate.caseBasedBonusWeight ?? 0)
    ) {
      throw new Error(
        '[FormaPriorEvaluator] Candidate weights do not match evaluated weights: candidate substitution refused'
      );
    }

    // Corpus identity binding check (prevent dataset/policy substitution)
    if (evaluation.corpusId && evaluation.corpusId !== trainingDatasetHash) {
      throw new Error(
        `[FormaPriorEvaluator] Training dataset hash (${trainingDatasetHash}) does not match evaluated corpus (${evaluation.corpusId})`
      );
    }

    const evalSummary: FitnessModelEvaluationSummary = {
      bootstrapMetric: evaluation.baselineAccuracy,
      candidateMetric: evaluation.candidateAccuracy,
      metricName: 'holdout-meaning-recovery-accuracy',
      holdoutJudgementCount: evaluation.holdoutCount,
      holdoutGroupCount: evaluation.holdoutGroupCount,
      leaveOneGroupOutImprovementFloor: evaluation.leaveOneGroupOutImprovementFloor,
    };

    const artifact: FitnessModelArtifact = {
      schemaVersion: '1.0.0',
      modelId: evaluation.modelId,
      modelVersion: evaluation.modelVersion,
      modelKind: 'ranking-linear',
      createdAt: Date.now(),
      trainingDatasetHash,
      curationPolicyHash,
      featureSchemaVersion: '1.0.0',
      parameters: {
        intentRelevanceWeight: candidate.intentRelevanceWeight,
        budgetFitnessWeight: candidate.budgetFitnessWeight,
        templateParityWeight: candidate.templateParityWeight,
        caseBasedBonusWeight: candidate.caseBasedBonusWeight ?? 0,
      },
      evaluation: evalSummary,
      notes: 'FM6 human-refined Forma prior model promoted via held-out validation gate',
    };

    const registered = registry.register(artifact);
    registry.promote(registered.artifactHash, Date.now());
    return registered;
  }
}

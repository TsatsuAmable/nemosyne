import { canonicalSha256Hex } from '../../security/CryptoHash.js';
import type { SpatialPhenotype } from './FormaSpatialCompiler.js';
import type {
  FeedbackScopeV1,
  EmbodimentCritiqueRecordV1,
  HumanMeaningJudgmentRecordV1,
} from './FormaHumanFeedback.js';

export const FORMA_KNOWLEDGE_BASE_SCHEMA_VERSION = 1 as const;

export type MetaphorCaseStatus =
  | 'QUALIFIED'
  | 'CONTRAINDICATED'
  | 'PROBATIONARY'
  | 'DEPRECATED';

export interface FormaMetaphorEvidenceBasisV1 {
  readonly critiqueCount: number;
  readonly meaningJudgmentCount: number;
  readonly discoveryOutcomeCount: number;
  readonly accuracyRate: number;
  readonly contraindications: readonly string[];
}

export interface FormaMetaphorCaseV1 {
  readonly caseId: string;
  readonly templateId: string;
  readonly bindingId: string;
  readonly phenotype: SpatialPhenotype;
  readonly scope: FeedbackScopeV1;
  readonly evidenceBasis: FormaMetaphorEvidenceBasisV1;
  readonly status: MetaphorCaseStatus;
  readonly rationale: string;
  readonly qualifiedAt: number;
  readonly provenanceDigest: string;
}

export interface FormaKnowledgeBaseV1 {
  readonly schemaVersion: typeof FORMA_KNOWLEDGE_BASE_SCHEMA_VERSION;
  readonly knowledgeBaseId: string;
  readonly pinnedKb0ManifestId: string;
  readonly cases: readonly FormaMetaphorCaseV1[];
}

export interface PromoteCaseCandidateInputV1 {
  readonly templateId: string;
  readonly bindingId: string;
  readonly phenotype: SpatialPhenotype;
  readonly scope?: FeedbackScopeV1;
  readonly critiques?: readonly EmbodimentCritiqueRecordV1[];
  readonly meaningJudgments?: readonly HumanMeaningJudgmentRecordV1[];
  readonly discoveryOutcomeCount?: number;
  readonly contraindications?: readonly string[];
  readonly rationale?: string;
}

export class FormaKnowledgeStore {
  private readonly pinnedKb0ManifestId: string;
  private readonly cases: Map<string, FormaMetaphorCaseV1> = new Map();
  private isFrozen = false;

  constructor(pinnedKb0ManifestId: string = 'kb0-manifest-default-v1') {
    this.pinnedKb0ManifestId = pinnedKb0ManifestId;
  }

  /**
   * Freezes this store for Research Mode. Once frozen, no cases can be promoted or modified.
   */
  public freeze(): FormaKnowledgeBaseV1 {
    this.isFrozen = true;
    return this.toSnapshot();
  }

  public get isStoreFrozen(): boolean {
    return this.isFrozen;
  }

  /**
   * Promotes an evidence-bound candidate case into the Forma Knowledge Base.
   * Fails closed if store is frozen or minimum evidence thresholds are not met.
   */
  public promoteCase(candidate: PromoteCaseCandidateInputV1): FormaMetaphorCaseV1 {
    if (this.isFrozen) {
      throw new Error('[FormaKnowledgeStore] Cannot promote case: knowledge store is frozen in Research Mode');
    }

    if (!candidate.templateId || !candidate.bindingId) {
      throw new Error('[FormaKnowledgeStore] Candidate requires valid templateId and bindingId');
    }

    // Each attributable record counts once: resubmitting the same record must not
    // inflate the evidence basis (FMA-11 residual).
    const confirmedCritiques = dedupeById(
      (candidate.critiques ?? []).filter((c) => c.confirmed),
      (c) => c.critiqueId
    );
    const confirmedJudgments = dedupeById(
      (candidate.meaningJudgments ?? []).filter((j) => j.confirmed),
      (j) => j.judgmentId
    );
    const discoveryOutcomeCount = candidate.discoveryOutcomeCount ?? 0;
    if (!Number.isInteger(discoveryOutcomeCount) || discoveryOutcomeCount < 0) {
      throw new Error(
        `[FormaKnowledgeStore] discoveryOutcomeCount must be a non-negative integer (received ${String(discoveryOutcomeCount)})`
      );
    }

    const confirmedHumanEvidence = confirmedCritiques.length + confirmedJudgments.length;
    if (confirmedHumanEvidence === 0) {
      throw new Error(
        '[FormaKnowledgeStore] Insufficient confirmed evidence to promote case (0 confirmed human evidence records provided; count alone cannot substitute for attributable testimony)'
      );
    }

    // discoveryOutcomeCount is a derived summary, not permission: it is recorded in
    // the evidence basis but never contributes to the qualification threshold.
    if (confirmedHumanEvidence < 2) {
      throw new Error(
        `[FormaKnowledgeStore] Insufficient confirmed evidence to promote case (${confirmedHumanEvidence} distinct confirmed human evidence records, minimum 2 required; discovery outcome counts cannot substitute)`
      );
    }

    const accurateCount = confirmedJudgments.filter(
      (j) => j.taskComprehensionOutcome === 'ACCURATE'
    ).length;
    const accuracyRate =
      confirmedJudgments.length > 0 ? accurateCount / confirmedJudgments.length : 0.0;

    const contraindications = [
      ...(candidate.contraindications ?? []),
      ...confirmedJudgments
        .map((j) => j.misleadingImplication)
        .filter((imp): imp is string => typeof imp === 'string' && imp.length > 0),
    ];

    let status: MetaphorCaseStatus = 'QUALIFIED';
    if (contraindications.length > 0 && (confirmedJudgments.length === 0 || accuracyRate < 0.6)) {
      status = 'CONTRAINDICATED';
    } else if (confirmedJudgments.length > 0 && accuracyRate < 0.75) {
      status = 'PROBATIONARY';
    }

    const qualifiedAt = Date.now();
    const scope: FeedbackScopeV1 = candidate.scope ?? {};
    const rationale = candidate.rationale ?? 'Evidence-backed human refinement promotion';

    const evidenceBasis: FormaMetaphorEvidenceBasisV1 = {
      critiqueCount: confirmedCritiques.length,
      meaningJudgmentCount: confirmedJudgments.length,
      discoveryOutcomeCount,
      accuracyRate,
      contraindications: Object.freeze([...contraindications]),
    };

    const provenanceDigest = canonicalSha256Hex({
      templateId: candidate.templateId,
      bindingId: candidate.bindingId,
      phenotype: candidate.phenotype,
      scope,
      evidenceBasis,
      status,
      // Case identity binds the exact attributable records, not just their counts.
      critiqueIds: confirmedCritiques.map((c) => c.critiqueId).sort(),
      judgmentIds: confirmedJudgments.map((j) => j.judgmentId).sort(),
    });

    const caseId = `case-v1:${provenanceDigest.slice(0, 16)}`;

    const metaphorCase: FormaMetaphorCaseV1 = {
      caseId,
      templateId: candidate.templateId,
      bindingId: candidate.bindingId,
      phenotype: candidate.phenotype,
      scope,
      evidenceBasis,
      status,
      rationale,
      qualifiedAt,
      provenanceDigest,
    };

    this.cases.set(caseId, metaphorCase);
    return metaphorCase;
  }

  /**
   * Queries qualified cases matching a given scope and intent.
   */
  public findQualifiedCases(query: {
    domain?: string;
    task?: string;
    population?: string;
    phenotype?: SpatialPhenotype;
  }): readonly FormaMetaphorCaseV1[] {
    const matched: FormaMetaphorCaseV1[] = [];

    for (const c of this.cases.values()) {
      if (c.status !== 'QUALIFIED') continue;
      if (query.phenotype && c.phenotype !== query.phenotype) continue;
      if (query.domain && c.scope.domain && c.scope.domain !== query.domain) continue;
      if (query.task && c.scope.task && c.scope.task !== query.task) continue;
      if (query.population && c.scope.population && c.scope.population !== query.population) continue;

      matched.push(c);
    }

    return Object.freeze(matched);
  }

  /**
   * Finds any known contraindications for a template or binding.
   */
  public findContraindications(templateId: string, bindingId?: string): readonly string[] {
    const results: string[] = [];
    for (const c of this.cases.values()) {
      if (c.templateId === templateId) {
        if (!bindingId || c.bindingId === bindingId) {
          results.push(...c.evidenceBasis.contraindications);
        }
      }
    }
    return Object.freeze([...new Set(results)]);
  }

  public getCase(caseId: string): FormaMetaphorCaseV1 | undefined {
    return this.cases.get(caseId);
  }

  public allCases(): readonly FormaMetaphorCaseV1[] {
    return Object.freeze([...this.cases.values()]);
  }

  public toSnapshot(): FormaKnowledgeBaseV1 {
    const cases = [...this.cases.values()];
    const knowledgeBaseId = `forma-kb-v1:${canonicalSha256Hex({
      pinnedKb0ManifestId: this.pinnedKb0ManifestId,
      cases: cases.map((c) => c.caseId),
    })}`;

    return {
      schemaVersion: FORMA_KNOWLEDGE_BASE_SCHEMA_VERSION,
      knowledgeBaseId,
      pinnedKb0ManifestId: this.pinnedKb0ManifestId,
      cases: Object.freeze(cases),
    };
  }
}

function dedupeById<T>(records: readonly T[], idOf: (record: T) => string): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const record of records) {
    const id = idOf(record);
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(record);
  }
  return unique;
}

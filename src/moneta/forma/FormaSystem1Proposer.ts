import { canonicalSha256Hex } from '../../security/CryptoHash.js';
import type { SemanticSnapshotV1 } from '../representation/SemanticSnapshotV1.js';
import type { CommittedInvestigationContextV2 } from '../../atlas/domain/CommittedInvestigationContext.js';
import type { DeviceCapabilityBudgetV1 } from './FormaResolutionBroker.js';
import type { KB0ManifestV1 } from './KB0Manifest.js';

import type { FormaKnowledgeStore } from './FormaKnowledgeBase.js';

export const FORMA_SYSTEM1_PROPOSAL_SCHEMA_VERSION = 1 as const;

/** Provenance of the advisory set consumed by a synthesis: fresh inference or restored record. */
export type System1ProposalSource = 'GENERATED' | 'RECORDED';

export interface FormaProposalCandidateV1 {
  readonly candidateId: string;
  readonly templateId: string;
  readonly bindingId: string;
  readonly targetResolutionTier: 'STICKMAN_SPARSE' | 'BALANCED_STANDARD' | 'MONA_LISA_EXPANSIVE';
  readonly score: number;
  readonly rationale: string;
  readonly contraindications?: readonly string[];
  readonly formaKnowledgeCaseId?: string;
}

export type FormaProposalSetV1 =
  | {
      readonly schemaVersion: typeof FORMA_SYSTEM1_PROPOSAL_SCHEMA_VERSION;
      readonly proposalSetId: string;
      readonly status: 'PROPOSED';
      readonly snapshotId: string;
      readonly contextId: string;
      readonly candidates: readonly FormaProposalCandidateV1[];
      readonly searchHints: readonly string[];
    }
  | {
      readonly schemaVersion: typeof FORMA_SYSTEM1_PROPOSAL_SCHEMA_VERSION;
      readonly proposalSetId: string;
      readonly status: 'ABSTAIN';
      readonly snapshotId: string;
      readonly contextId: string;
      readonly abstentionReason: string;
    };

/**
 * Transparent linear ranking weights for System-1 proposal scoring.
 */
export interface System1RankingWeights {
  readonly intentRelevanceWeight: number;
  readonly budgetFitnessWeight: number;
  readonly templateParityWeight: number;
}

export const DEFAULT_SYSTEM1_WEIGHTS: System1RankingWeights = {
  intentRelevanceWeight: 0.45,
  budgetFitnessWeight: 0.35,
  templateParityWeight: 0.20,
};

/**
 * System-1 Metaphor Retrieval and Proposal Engine (L3-S1-FORMA / FM5 / FM6).
 * Generates transparent, deterministic candidate proposals or explicit abstentions.
 * Never acts as admission authority or emits arbitrary renderer parameters.
 */
export class FormaSystem1Proposer {
  private readonly weights: System1RankingWeights;
  private readonly knowledgeStore?: FormaKnowledgeStore;

  public constructor(
    weights: System1RankingWeights = DEFAULT_SYSTEM1_WEIGHTS,
    knowledgeStore?: FormaKnowledgeStore
  ) {
    this.weights = weights;
    this.knowledgeStore = knowledgeStore;
  }


  /**
   * Generates a bounded FormaProposalSetV1 from governed inputs.
   */
  public generateProposals(
    snapshot: SemanticSnapshotV1,
    context: CommittedInvestigationContextV2,
    _manifest: KB0ManifestV1,
    budget: DeviceCapabilityBudgetV1,
    confidenceThreshold: number = 0.5,
  ): FormaProposalSetV1 {
    // 1. Check if snapshot or context is invalid or empty
    if (!snapshot.body.nodes || snapshot.body.nodes.length === 0) {
      return {
        schemaVersion: FORMA_SYSTEM1_PROPOSAL_SCHEMA_VERSION,
        proposalSetId: `s1-abstain-v1:${canonicalSha256Hex({ reason: 'NO_SEMANTIC_NODES', contextId: context.nodeId })}`,
        status: 'ABSTAIN',
        snapshotId: snapshot.snapshotId,
        contextId: context.nodeId,
        abstentionReason: 'Semantic snapshot contains no renderable nodes',
      };
    }

    // 2. Deterministic rule-based template retrieval
    const candidateTemplates: {
      templateId: string;
      bindingId: string;
      targetResolutionTier: 'STICKMAN_SPARSE' | 'BALANCED_STANDARD' | 'MONA_LISA_EXPANSIVE';
      baseScore: number;
      rationale: string;
    }[] = [];

    const isConstrained = budget.maxElements <= 50;
    const hasVoxelCapability = budget.allowedShapes.includes('VOXEL');

    if (isConstrained) {
      candidateTemplates.push({
        templateId: 'template-sparse-scatter-v1',
        bindingId: 'binding-radial-scatter',
        targetResolutionTier: 'STICKMAN_SPARSE',
        baseScore: 0.85,
        rationale: 'Constrained device budget strongly favors sparse radial scatter with low element overhead',
      });
    } else {
      candidateTemplates.push({
        templateId: 'template-expansive-surface-v1',
        bindingId: 'binding-voxel-surface',
        targetResolutionTier: 'MONA_LISA_EXPANSIVE',
        baseScore: hasVoxelCapability ? 0.90 : 0.60,
        rationale: 'Expansive device budget supports rich volumetric surface with continuous density',
      });
      candidateTemplates.push({
        templateId: 'template-balanced-scatter-v1',
        bindingId: 'binding-radial-scatter',
        targetResolutionTier: 'BALANCED_STANDARD',
        baseScore: 0.75,
        rationale: 'Balanced standard scatter suitable for general desktop display',
      });
    }

    // 3. Compute linear ranking scores
    const candidates: FormaProposalCandidateV1[] = [];
    for (const t of candidateTemplates) {
      const intentScore = context.intent ? 0.9 : 0.5;
      const budgetScore = isConstrained
        ? (t.targetResolutionTier === 'STICKMAN_SPARSE' ? 1.0 : 0.2)
        : (t.targetResolutionTier === 'MONA_LISA_EXPANSIVE' ? 1.0 : 0.7);
      const templateScore = t.baseScore;

      let scoreDelta = 0;
      let candidateRationale = t.rationale;
      let contraindications: readonly string[] | undefined;
      let formaKnowledgeCaseId: string | undefined;

      if (this.knowledgeStore) {
        const contra = this.knowledgeStore.findContraindications(t.templateId, t.bindingId);
        if (contra.length > 0) {
          contraindications = contra;
          scoreDelta -= 0.30;
          candidateRationale += ` [CONTRAINDICATED: ${contra.join(', ')}]`;
        }

        const matchedCases = this.knowledgeStore.findQualifiedCases({
          task: context.intent?.currentTask,
        });

        const matched = matchedCases.find((c) => c.templateId === t.templateId && c.bindingId === t.bindingId);
        if (matched) {
          formaKnowledgeCaseId = matched.caseId;
          scoreDelta += 0.15;
          candidateRationale += ` [Forma Knowledge Base prior applied: ${matched.caseId}]`;
        }
      }

      const rawScore =
        this.weights.intentRelevanceWeight * intentScore +
        this.weights.budgetFitnessWeight * budgetScore +
        this.weights.templateParityWeight * templateScore +
        scoreDelta;

      const finalScore = Number(Math.max(0, Math.min(1.0, rawScore)).toFixed(4));

      if (finalScore >= confidenceThreshold) {
        candidates.push({
          candidateId: `cand-${t.templateId}`,
          templateId: t.templateId,
          bindingId: t.bindingId,
          targetResolutionTier: t.targetResolutionTier,
          score: finalScore,
          rationale: candidateRationale,
          contraindications,
          formaKnowledgeCaseId,
        });
      }
    }

    // Sort descending by score, tie-breaking deterministically by candidateId
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.candidateId.localeCompare(b.candidateId);
    });

    if (candidates.length === 0) {
      return {
        schemaVersion: FORMA_SYSTEM1_PROPOSAL_SCHEMA_VERSION,
        proposalSetId: `s1-abstain-v1:${canonicalSha256Hex({ reason: 'CONFIDENCE_BELOW_THRESHOLD', contextId: context.nodeId })}`,
        status: 'ABSTAIN',
        snapshotId: snapshot.snapshotId,
        contextId: context.nodeId,
        abstentionReason: `All candidates fell below confidence threshold ${confidenceThreshold}`,
      };
    }

    const proposalSetId = `s1-proposals-v1:${canonicalSha256Hex({
      snapshotId: snapshot.snapshotId,
      contextId: context.nodeId,
      candidates: candidates.map((c) => ({ id: c.candidateId, score: c.score })),
    })}`;

    const searchHints = [
      'PRIORITIZE_PRIMARY_AXIS',
      isConstrained ? 'SUPPRESS_SECONDARY_CHANNELS' : 'PERMIT_VOXEL_SURFACE',
    ];
    if (this.knowledgeStore?.isStoreFrozen) {
      searchHints.push('RESEARCH_MODE_FROZEN_PRIORS');
    }

    return {
      schemaVersion: FORMA_SYSTEM1_PROPOSAL_SCHEMA_VERSION,
      proposalSetId,
      status: 'PROPOSED',
      snapshotId: snapshot.snapshotId,
      contextId: context.nodeId,
      candidates,
      searchHints,
    };
  }
}


import { canonicalSha256Hex } from '../../security/CryptoHash.js';
import type {
  CommittedInvestigationContextV2,
  EpistemicPurpose,
} from '../../atlas/domain/CommittedInvestigationContext.ts';
import type { SemanticSnapshotV1 } from './SemanticSnapshotV1.js';
import {
  compileDirectEmbodimentPlan,
  type AttributableCritiqueV1,
  type DirectEmbodimentCompileResult,
} from './DirectEmbodimentCompiler.ts';
import {
  validateConjecturalProposal,
  type ConjecturalEpistemicStatus,
  type ConjecturalProposalV1,
} from '../forma/ConjecturalProposal.ts';
import type {
  DeviceCapabilityBudgetV1,
  SemanticObligationContractV1,
} from '../forma/FormaResolutionBroker.js';
import type { FormaResolutionBroker } from '../forma/FormaResolutionBroker.js';
import type { FormaAdmissionOptionsV1 } from '../forma/FormaAdmission.ts';
import type { SpatialPhenotype } from '../forma/FormaSpatialCompiler.ts';

export const DIRECT_FEEDBACK_LOOP_SCHEMA_VERSION = '1.0.0' as const;

export interface ConjecturalDisclosureV1 {
  readonly disclosureId: string;
  readonly planElementId: string;
  readonly semanticNodeId: string;
  readonly proposalId: string;
  readonly epistemicStatuses: readonly ConjecturalEpistemicStatus[];
  readonly generatorModelId: string;
  readonly generatorModelVersion: string;
  readonly executionRegime: 'PINNED' | 'ADAPTIVE';
  readonly uncertaintyDisclosure: string;
  readonly admittedUnder: EpistemicPurpose;
}

export interface ConjecturalDisclosureResultV1 {
  readonly disclosures: readonly ConjecturalDisclosureV1[];
  readonly groundedElementCount: number;
}

/**
 * DSE3: visible disclosure. Joins every conjectural plan element to the
 * admitted proposal that produced it via the proposal-id linkage carried
 * from admission through the slice. Refuses unbound elements and proposals
 * admitted against a different snapshot.
 */
export function discloseConjecturalElements(
  compilation: DirectEmbodimentCompileResult,
  proposals: readonly ConjecturalProposalV1[],
  admittedUnder: EpistemicPurpose
): ConjecturalDisclosureResultV1 {
  const validated = proposals.map((p) => validateConjecturalProposal(p));
  for (const proposal of validated) {
    if (proposal.body.snapshotId !== compilation.plan.semanticGraphId) {
      throw new Error(
        `[DirectFeedbackLoop] Proposal snapshot mismatch: ${proposal.proposalId} was admitted against a different snapshot`
      );
    }
  }
  const byId = new Map(validated.map((p) => [p.proposalId, p]));

  const disclosures: ConjecturalDisclosureV1[] = [];
  let groundedElementCount = 0;
  for (const element of compilation.plan.elements) {
    if (!element.parameters.isConjectural) {
      groundedElementCount += 1;
      continue;
    }
    const proposalId = element.representationPrimitiveId;
    const proposal = typeof proposalId === 'string' ? byId.get(proposalId) : undefined;
    if (!proposal || typeof proposalId !== 'string') {
      throw new Error(
        `[DirectFeedbackLoop] Unbound conjectural element '${element.id}': no admitted proposal carries id '${proposalId}'`
      );
    }
    const statuses = Array.from(
      new Set(proposal.body.elements.map((e) => e.epistemicStatus))
    ).sort();
    disclosures.push({
      disclosureId: `disclosure-direct-${canonicalSha256Hex({
        planId: compilation.plan.planId,
        elementId: element.id,
        proposalId,
      }).slice(0, 16)}`,
      planElementId: element.id,
      semanticNodeId: element.semanticNodeId,
      proposalId,
      epistemicStatuses: statuses,
      generatorModelId: proposal.body.generator.modelId,
      generatorModelVersion: proposal.body.generator.modelVersion,
      executionRegime: proposal.body.generator.executionRegime,
      uncertaintyDisclosure: proposal.body.uncertaintyDisclosure,
      admittedUnder,
    });
  }

  disclosures.sort((a, b) => a.planElementId.localeCompare(b.planElementId));
  return { disclosures, groundedElementCount };
}

export interface DirectAlternativeAdjustmentV1 {
  readonly budget?: DeviceCapabilityBudgetV1;
  readonly obligations?: SemanticObligationContractV1;
  readonly admissionOptions?: FormaAdmissionOptionsV1;
  readonly phenotype?: SpatialPhenotype;
  readonly maxElementsOverride?: number;
}

export interface CritiqueAlternativeLinkV1 {
  readonly linkId: string;
  readonly critiqueId: string;
  readonly priorCompilationId: string;
  readonly priorDecisionId: string;
  readonly alternativeCompilationId: string;
  readonly alternativeDecisionId: string;
  readonly targetElementId: string;
  readonly contextPurpose: EpistemicPurpose;
}

export interface AlternativeFeedbackBindingV1 {
  readonly bindingId: string;
  readonly linkId: string;
  readonly critiqueRecordId: string;
}

function findLedgerCritique(
  compilation: DirectEmbodimentCompileResult,
  critiqueId: string
): AttributableCritiqueV1 {
  const critique = compilation.critiqueLedger.find((c) => c.critiqueId === critiqueId);
  if (!critique) {
    throw new Error(
      `[DirectFeedbackLoop] Unknown critique '${critiqueId}': not recorded on compilation ${compilation.compilationId}`
    );
  }
  return critique;
}

/**
 * DSE3: critique -> Road Not Taken alternative. Recompiles the same
 * snapshot, context, and dataset with the requested adjustment and links the
 * alternative to the critique that motivated it. The active compilation is
 * never switched silently: the caller adopts the alternative explicitly.
 * An adjustment that reproduces the prior plan is refused — an alternative
 * must differ.
 */
export function resolveCritiqueToAlternative(input: {
  readonly datasetFingerprint: string;
  readonly snapshot: SemanticSnapshotV1;
  readonly context: CommittedInvestigationContextV2;
  readonly compilation: DirectEmbodimentCompileResult;
  readonly critiqueId: string;
  readonly adjustment?: DirectAlternativeAdjustmentV1;
  readonly broker?: FormaResolutionBroker;
  readonly researchMode?: boolean;
}): {
  readonly alternative: DirectEmbodimentCompileResult;
  readonly link: CritiqueAlternativeLinkV1;
} {
  const critique = findLedgerCritique(input.compilation, input.critiqueId);
  const target = input.compilation.plan.elements.find((e) => e.id === critique.targetElementId);
  if (!target) {
    throw new Error(
      `[DirectFeedbackLoop] Critique target '${critique.targetElementId}' is not an element of compilation ${input.compilation.compilationId}`
    );
  }

  const alternative = compileDirectEmbodimentPlan({
    datasetFingerprint: input.datasetFingerprint,
    snapshot: input.snapshot,
    context: input.context,
    budget: input.adjustment?.budget,
    obligations: input.adjustment?.obligations,
    admissionOptions: input.adjustment?.admissionOptions,
    broker: input.broker,
    phenotype: input.adjustment?.phenotype,
    critiqueFeedback: [...input.compilation.critiqueLedger],
    maxElementsOverride: input.adjustment?.maxElementsOverride,
    researchMode: input.researchMode,
  });

  if (alternative.plan.planId === input.compilation.plan.planId) {
    throw new Error(
      '[DirectFeedbackLoop] Adjustment reproduces the prior plan: an alternative must differ from the critiqued compilation'
    );
  }

  const link: CritiqueAlternativeLinkV1 = {
    linkId: `rnt-direct-${canonicalSha256Hex({
      critiqueId: critique.critiqueId,
      priorPlanId: input.compilation.plan.planId,
      alternativePlanId: alternative.plan.planId,
    }).slice(0, 16)}`,
    critiqueId: critique.critiqueId,
    priorCompilationId: input.compilation.compilationId,
    priorDecisionId: input.compilation.plan.decisionId,
    alternativeCompilationId: alternative.compilationId,
    alternativeDecisionId: alternative.plan.decisionId,
    targetElementId: critique.targetElementId,
    contextPurpose: input.context.epistemicPurpose,
  };
  return { alternative, link };
}

/**
 * DSE3: binds an FM6 outcome-feedback record to its critique->alternative
 * link. The feedback record itself is created through
 * `recordEmbodimentCritique`, so author attribution and the self-labeling
 * prohibition travel with it.
 */
export function bindAlternativeFeedback(
  link: CritiqueAlternativeLinkV1,
  critiqueRecordId: string
): AlternativeFeedbackBindingV1 {
  if (!critiqueRecordId.trim()) {
    throw new Error(
      '[DirectFeedbackLoop] Feedback binding refused: critique record id is required'
    );
  }
  return {
    bindingId: `feedback-bind-${canonicalSha256Hex({
      linkId: link.linkId,
      critiqueRecordId,
    }).slice(0, 16)}`,
    linkId: link.linkId,
    critiqueRecordId,
  };
}

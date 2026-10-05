import type {
  DirectEmbodimentCompileResult,
  ObligationPreservingVariantPairV1,
} from './DirectEmbodimentCompiler.ts';
import type {
  AlternativeFeedbackBindingV1,
  ConjecturalDisclosureResultV1,
  CritiqueAlternativeLinkV1,
} from './DirectFeedbackLoop.ts';
import type { DirectTraversalBindingV1 } from './DirectTraversalSession.ts';

export const DIRECT_LOOP_VIEW_MODEL_SCHEMA_VERSION = '1.0.0' as const;

export interface DisclosureCardV1 {
  readonly elementId: string;
  readonly semanticNodeId: string;
  readonly proposalId: string;
  readonly epistemicStatuses: readonly string[];
  readonly generator: string;
  readonly uncertaintyDisclosure: string;
  readonly admittedUnder: string;
}

export interface DisclosureCardsV1 {
  readonly cards: readonly DisclosureCardV1[];
  readonly groundedElementCount: number;
  readonly conjecturalElementCount: number;
}

export interface PurposeBadgeV1 {
  readonly traversalId: string;
  readonly planElementId: string;
  readonly semanticNodeId: string;
  readonly epistemicPurpose: string;
  readonly isConjectural: boolean;
}

export interface AlternativeEntryV1 {
  readonly linkId: string;
  readonly critiqueId: string;
  readonly priorDecisionId: string;
  readonly alternativeDecisionId: string;
  readonly targetElementId: string;
  readonly contextPurpose: string;
  readonly feedbackRecordId: string | null;
}

export interface VariantEntryV1 {
  readonly budgetProfile: string;
  readonly variantTier: string;
  readonly planId: string;
  readonly decisionId: string;
  readonly elementCount: number;
  readonly shedOptionalChannels: readonly string[];
}

export interface VariantPairViewV1 {
  readonly traversalRootId: string;
  readonly variants: readonly [VariantEntryV1, VariantEntryV1];
  readonly mandatoryNodeIds: readonly string[];
  readonly mandatoryChannels: readonly string[];
}

/**
 * FM1/FM2 product integration: headless view-model projections over direct-loop
 * aggregate state. These are pure deterministic projections for inspector,
 * history, and alternative surfaces — they introduce no state authority and
 * perform no analytical work. On-device rendering remains downstream.
 */
export function buildDisclosureCards(result: ConjecturalDisclosureResultV1): DisclosureCardsV1 {
  const cards = result.disclosures.map((d) => ({
    elementId: d.planElementId,
    semanticNodeId: d.semanticNodeId,
    proposalId: d.proposalId,
    epistemicStatuses: [...d.epistemicStatuses],
    generator: `${d.generatorModelId}@${d.generatorModelVersion} (${d.executionRegime})`,
    uncertaintyDisclosure: d.uncertaintyDisclosure,
    admittedUnder: d.admittedUnder,
  }));
  cards.sort((a, b) => a.elementId.localeCompare(b.elementId));
  return {
    cards,
    groundedElementCount: result.groundedElementCount,
    conjecturalElementCount: cards.length,
  };
}

export function buildPurposeBadge(binding: DirectTraversalBindingV1): PurposeBadgeV1 {
  return {
    traversalId: binding.traversalId,
    planElementId: binding.planElementId,
    semanticNodeId: binding.semanticNodeId,
    epistemicPurpose: binding.epistemicPurpose,
    isConjectural: binding.isConjectural,
  };
}

export function buildAlternativeEntries(
  links: readonly CritiqueAlternativeLinkV1[],
  bindings: readonly AlternativeFeedbackBindingV1[] = []
): readonly AlternativeEntryV1[] {
  const feedbackByLink = new Map(bindings.map((b) => [b.linkId, b.critiqueRecordId]));
  const entries = links.map((link) => ({
    linkId: link.linkId,
    critiqueId: link.critiqueId,
    priorDecisionId: link.priorDecisionId,
    alternativeDecisionId: link.alternativeDecisionId,
    targetElementId: link.targetElementId,
    contextPurpose: link.contextPurpose,
    feedbackRecordId: feedbackByLink.get(link.linkId) ?? null,
  }));
  return [...entries].sort((a, b) => a.linkId.localeCompare(b.linkId));
}

export function buildVariantPairView(pair: ObligationPreservingVariantPairV1): VariantPairViewV1 {
  const entry = (result: DirectEmbodimentCompileResult, budgetProfile: string): VariantEntryV1 => ({
    budgetProfile,
    variantTier: result.admittedVariant.variantTier,
    planId: result.plan.planId,
    decisionId: result.plan.decisionId,
    elementCount: result.plan.elements.length,
    shedOptionalChannels: [...result.admittedVariant.shedOptionalChannels],
  });
  return {
    traversalRootId: pair.traversalRootId,
    variants: [
      entry(pair.desktop, pair.variantBudgets[0] ?? 'DESKTOP_EXPANSIVE'),
      entry(pair.constrained, pair.variantBudgets[1] ?? 'QUEST_CONSTRAINED'),
    ],
    mandatoryNodeIds: [...pair.preservedObligations.mandatoryNodeIds],
    mandatoryChannels: [...pair.preservedObligations.mandatoryChannels],
  };
}

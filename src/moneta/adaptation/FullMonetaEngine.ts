import type { DatasetSignature } from '../representation/DatasetSignature.js';
import {
  type CommittedInvestigationContextV2,
  computeCommittedContextIdentity,
} from '../../atlas/domain/CommittedInvestigationContext.js';
import type { RepresentationGraph } from '../representation/RepresentationGraph.js';
import {
  type ObjectivePreference,
} from '../search/RepresentationObjectiveModel.js';
import {
  RepresentationSearchEngine,
  type SynthesizedCandidate,
} from '../search/RepresentationSearchEngine.js';
import {
  FormaResolutionBroker,
  DESKTOP_EXPANSIVE_BUDGET,
  type DeviceCapabilityBudgetV1,
  type AdmittedVariantSliceV1,
  type SemanticObligationContractV1,
} from '../forma/FormaResolutionBroker.js';
import { createKB0Manifest } from '../forma/KB0Manifest.js';
import {
  normalizeEnvelopeToSnapshot,
  type EvidenceReferenceTupleV1,
  type SemanticSnapshotV1,
  validateSemanticSnapshot,
} from '../representation/SemanticSnapshotV1.js';
import type { SemanticEmbodimentEnvelopeV1 } from '../representation/SemanticEmbodimentPayload.js';
import {
  FormaMultiElementRuntime,
  type ComposedRepresentationStateV1,
} from '../forma/FormaMultiElementRuntime.js';
import type { FormaKnowledgeStore } from '../forma/FormaKnowledgeBase.js';
import { FormaSystem1Proposer, DEFAULT_SYSTEM1_WEIGHTS, type FormaProposalSetV1 } from '../forma/FormaSystem1Proposer.js';
import {
  type ConjecturalProposalV1,
  createConjecturalProposal,
} from '../forma/ConjecturalProposal.js';
import type { FormaAdmissionOptionsV1 } from '../forma/FormaAdmission.js';

export interface AdaptationOptions {
  readonly preference?: ObjectivePreference;
  readonly budget?: DeviceCapabilityBudgetV1;
  readonly currentGraph?: RepresentationGraph;
  readonly maxGenerations?: number;
  readonly populationSize?: number;
  readonly mandatoryChannels?: readonly string[];
  readonly mandatoryNodeIds?: readonly string[];
  readonly researchMode?: boolean;
  readonly snapshot?: SemanticSnapshotV1;
  readonly snapshots?: readonly SemanticSnapshotV1[];
  readonly analyticalEvidence?: {
    readonly envelope: SemanticEmbodimentEnvelopeV1;
    readonly evidenceReferences: readonly EvidenceReferenceTupleV1[];
  };
  readonly admissionOptions?: FormaAdmissionOptionsV1;
  readonly broker?: FormaResolutionBroker;
  readonly contextGeneration?: number;
  /**
   * Deterministic fallback: generate and record System-1 advice as usual,
   * but withhold it from search seeding. The bypass itself is recorded on
   * the result so baseline comparisons stay auditable.
   */
  readonly ignoreSystem1Advice?: boolean;
}

export interface AdaptationTransition {
  readonly fromGraphId: string;
  readonly toGraphId: string;
  readonly landmarkStability: number; // [0, 1]
  readonly semanticContinuity: number; // [0, 1]
  readonly coordinateScalePreservation: boolean;
  readonly visualContinuityRating: number; // [0, 1]
  readonly addedPrimitiveKinds: readonly string[];
  readonly removedPrimitiveKinds: readonly string[];
  readonly retainedPrimitiveKinds: readonly string[];
  readonly summary: string;
}

export interface FullMonetaSynthesisResult {
  readonly schemaVersion: '1.0.0';
  readonly synthesisId: string;
  readonly candidate: SynthesizedCandidate;
  readonly paretoFrontier: readonly SynthesizedCandidate[];
  readonly selectedGraph: RepresentationGraph;
  readonly resolutionVariant: AdmittedVariantSliceV1;
  readonly composedState: ComposedRepresentationStateV1;
  readonly transition?: AdaptationTransition;
  readonly researchModeFrozen: boolean;
  readonly conjecturalProposals?: readonly ConjecturalProposalV1[];
  readonly system1ProposalSet: FormaProposalSetV1;
  readonly system1AdviceApplied: boolean;
  readonly provenance: {
    readonly datasetFingerprint: string;
    readonly timestamp: string;
    readonly fitnessModelVersion: string;
    readonly system1ProposalSetId: string;
  };
}

/**
 * FullMonetaEngine — central coordinator for Controlled Adaptive Representation Intelligence (FM8).
 * Unifies question-aware intent, analytical evidence, System-1 advice, knowledge base precedents,
 * Pareto grammar search, multi-element runtime, and hardware-adaptive resolution brokering.
 */
export class FullMonetaEngine {
  /**
   * Synthesizes or adapts a representation according to researcher intent, dataset signature,
   * hardware capability budget, and research mode state.
   */
  public static synthesizeOrAdapt(
    signature: DatasetSignature,
    context?: CommittedInvestigationContextV2,
    knowledgeStore?: FormaKnowledgeStore,
    options: AdaptationOptions = {}
  ): FullMonetaSynthesisResult {
    // 0. Validate committed investigation context (RFC 0011 / DM-0 / DM-5)
    if (!context || !context.epistemicPurpose) {
      throw new TypeError(
        '[FullMonetaEngine] CommittedInvestigationContextV2 with explicit epistemicPurpose is strictly required.'
      );
    }

    const preference = options.preference ?? 'BALANCED';
    const isResearchMode = options.researchMode ?? false;

    // 1. Freeze knowledge store if research mode is active
    if (isResearchMode && knowledgeStore && !knowledgeStore.isStoreFrozen) {
      knowledgeStore.freeze();
    }

    // 2. Analytical evidence resolution & validation (FMA-01)
    let snapshot: SemanticSnapshotV1 | undefined = options.snapshot;

    if (!snapshot && options.analyticalEvidence) {
      snapshot = normalizeEnvelopeToSnapshot(
        options.analyticalEvidence.envelope,
        options.analyticalEvidence.evidenceReferences
      );
    }

    if (!snapshot) {
      throw new Error(
        '[FullMonetaEngine] Adaptation refused: analytical evidence is unavailable or ungrounded for selected representation family'
      );
    }

    validateSemanticSnapshot(snapshot);

    const budget = options.budget ?? DESKTOP_EXPANSIVE_BUDGET;
    const mandatoryChannels = options.mandatoryChannels ?? ['spatial_position', 'spatial_scatter'];
    const mandatoryNodeIds = options.mandatoryNodeIds
      ? [...options.mandatoryNodeIds]
      : snapshot.body.nodes.slice(0, 1).map((n) => n.nodeId);
    const obligations: SemanticObligationContractV1 = {
      mandatoryNodeIds,
      mandatoryChannels,
    };

    const manifest = createKB0Manifest();

    // 3. System-1 proposals generated before search to guide candidate exploration (DM-5).
    // A caller-requested deterministic fallback withholds the advice from
    // seeding while still recording exactly what was bypassed.
    const proposer = new FormaSystem1Proposer(DEFAULT_SYSTEM1_WEIGHTS, knowledgeStore);
    const s1Proposals = proposer.generateProposals(snapshot, context, manifest, budget);
    const system1AdviceApplied =
      options.ignoreSystem1Advice !== true && s1Proposals.status === 'PROPOSED';

    // 4. Multi-objective Pareto search influenced by System-1 advice
    const maxGenerations = isResearchMode ? 2 : (options.maxGenerations ?? 3);
    const populationSize = isResearchMode ? 8 : (options.populationSize ?? 12);

    const searchResult = RepresentationSearchEngine.search(signature, {
      preference,
      maxGenerations,
      populationSize,
      system1Proposals: system1AdviceApplied ? s1Proposals : undefined,
      context,
    });

    const topCandidate = searchResult.paretoFrontier[0] ?? searchResult.referenceCandidate;
    const selectedGraph = topCandidate.graph;

    // 5. Calculate adaptation transition if a previous graph exists
    let transition: AdaptationTransition | undefined;
    if (options.currentGraph) {
      transition = this.computeAdaptationTransition(options.currentGraph, selectedGraph);
    }

    // 6. Handle Conjectural Proposals and Admission Options (DM-1, DM-2, DM-5)
    const conjecturalProposals: ConjecturalProposalV1[] = [
      ...(options.admissionOptions?.conjecturalProposals ?? []),
    ];
    if (context.epistemicPurpose === 'EXPLORATORY_ABDUCTION' && conjecturalProposals.length === 0) {
      const proposal = createConjecturalProposal({
        snapshotId: snapshot.snapshotId,
        contextId: computeCommittedContextIdentity(context),
        generator: {
          modelId: 'FormaSystem1Proposer+RepresentationSearchEngine',
          modelVersion: 'FM8-Adaptive-1.0',
          executionRegime: isResearchMode ? 'PINNED' : 'ADAPTIVE',
        },
        elements: selectedGraph.primitives.map((p) => ({
          elementId: `conjectural-elem-${p.id}`,
          kind: p.kind,
          epistemicStatus: 'HYPOTHESIZED' as const,
          properties: {
            primitiveKind: p.kind,
            parameters: p.parameters,
          },
          uncertaintyDisclosure: 'Synthesized via Pareto grammar exploration and System-1 priors',
        })),
        relations: selectedGraph.edges.map((e, idx) => ({
          relationId: `conjectural-rel-${idx}`,
          sourceElementId: `conjectural-elem-${e.from}`,
          targetElementId: `conjectural-elem-${e.to}`,
          kind: e.relation,
          epistemicStatus: 'HYPOTHESIZED' as const,
        })),
        assumptions: [
          'Underlying data distribution satisfies representation grammar priors',
          'Candidate discovered outside catalog via exploratory abduction',
        ],
        uncertaintyDisclosure: 'Candidate generated under EXPLORATORY_ABDUCTION; properties are not grounded observations',
        rationale: `Selected candidate rank ${topCandidate.paretoRank} with utility ${topCandidate.utility}`,
      });
      conjecturalProposals.push(proposal);
    }

    const effectiveAdmissionOptions: FormaAdmissionOptionsV1 = {
      ...options.admissionOptions,
      conjecturalProposals: conjecturalProposals.length > 0 ? conjecturalProposals : undefined,
    };

    // 7. Resolution adaptation broker
    const broker = options.broker ?? new FormaResolutionBroker();
    const contextObj = context as unknown as { activationEpoch?: number };
    const requestedGeneration =
      options.contextGeneration ??
      (typeof context.runtimeGeneration === 'number'
        ? context.runtimeGeneration
        : typeof contextObj.activationEpoch === 'number'
          ? contextObj.activationEpoch
          : broker.getContextGeneration(context.nodeId));

    const brokerOutcome = broker.brokerVariant(
      snapshot,
      context,
      manifest,
      budget,
      obligations,
      requestedGeneration,
      effectiveAdmissionOptions
    );

    if (brokerOutcome.status !== 'ADMITTED') {
      throw new Error(
        `[FullMonetaEngine] Resolution adaptation refused: [${brokerOutcome.refusal.code}] ${brokerOutcome.refusal.message}`
      );
    }

    const resolutionVariant = brokerOutcome.variant;

    // 8. Multi-element runtime composition preserving graph relations (FMA-10c)
    const multiRuntime = new FormaMultiElementRuntime();
    const snapshotsList = options.snapshots ?? [snapshot];

    for (let i = 0; i < selectedGraph.primitives.length; i++) {
      const prim = selectedGraph.primitives[i];
      // Match snapshot by primitive kind or family if possible, or use index/primary
      const primSnapshot: SemanticSnapshotV1 =
        snapshotsList.find((s) => s.body.sources.some((src) => src.family === prim.kind)) ??
        snapshotsList[i] ??
        snapshot;

      let sliceToRegister = resolutionVariant.slice;
      if (primSnapshot !== snapshot) {
        const primOutcome = broker.brokerVariant(
          primSnapshot,
          context,
          manifest,
          budget,
          obligations,
          requestedGeneration,
          effectiveAdmissionOptions
        );
        if (primOutcome.status === 'ADMITTED') {
          sliceToRegister = primOutcome.variant.slice;
        }
      }

      multiRuntime.registerElement(
        `element-${prim.id}`,
        sliceToRegister,
        prim.kind
      );
    }

    const registeredIds = new Set(selectedGraph.primitives.map((p) => `element-${p.id}`));
    const validRelations = new Set([
      'OVERLAY',
      'CONTAINS',
      'DERIVES_FROM',
      'COORDINATES_WITH',
      'DETAIL_OF',
      'COMPARES_WITH',
    ]);

    if (selectedGraph.edges.length > 0) {
      for (const edge of selectedGraph.edges) {
        const sourceId = `element-${edge.from}`;
        const targetId = `element-${edge.to}`;
        if (registeredIds.has(sourceId) && registeredIds.has(targetId) && sourceId !== targetId) {
          if (!validRelations.has(edge.relation)) {
            throw new Error(`[FullMonetaEngine] Invalid composition relationship: ${edge.relation}`);
          }
          multiRuntime.addRelationship(
            sourceId,
            targetId,
            edge.relation as import('../forma/FormaMultiElementRuntime.js').CompositionRelationship
          );
        }
      }
    }

    const composedState = multiRuntime.exportComposedState();

    const sessionSuffix =
      typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
        ? globalThis.crypto.randomUUID().slice(0, 8)
        : Date.now().toString(36);
    const synthesisId = `fm8-synth-${Date.now().toString(36)}-${sessionSuffix}`;

    return {
      schemaVersion: '1.0.0',
      synthesisId,
      candidate: topCandidate,
      paretoFrontier: searchResult.paretoFrontier,
      selectedGraph,
      resolutionVariant,
      composedState,
      transition,
      researchModeFrozen: isResearchMode,
      conjecturalProposals: conjecturalProposals.length > 0 ? conjecturalProposals : undefined,
      system1ProposalSet: s1Proposals,
      system1AdviceApplied,
      provenance: {
        datasetFingerprint: signature.provenance.datasetFingerprint,
        timestamp: new Date().toISOString(),
        fitnessModelVersion: isResearchMode
          ? 'FullMonetaEngine-FrozenResearchMode-v1'
          : `FullMonetaEngine-Adaptive-s1-${s1Proposals.status}`,
        system1ProposalSetId: s1Proposals.proposalSetId,
      },
    };
  }

  /**
   * Computes cognitive orientation metrics and transition stability between two representation graphs.
   */
  public static computeAdaptationTransition(
    currentGraph: RepresentationGraph,
    newGraph: RepresentationGraph
  ): AdaptationTransition {
    const currentKinds = currentGraph.primitives.map((p) => p.kind);
    const newKinds = newGraph.primitives.map((p) => p.kind);

    const retainedKinds = currentKinds.filter((k) => newKinds.includes(k));
    const addedKinds = newKinds.filter((k) => !currentKinds.includes(k));
    const removedKinds = currentKinds.filter((k) => !newKinds.includes(k));

    const maxPrimitives = Math.max(1, Math.max(currentGraph.primitives.length, newGraph.primitives.length));
    const landmarkStability = Math.min(1.0, retainedKinds.length / maxPrimitives);

    // Semantic continuity based on shared mapped keys
    const currentKeys = new Set(Object.keys(currentGraph.semanticMappings));
    const newKeys = new Set(Object.keys(newGraph.semanticMappings));
    let sharedKeyCount = 0;
    for (const key of currentKeys) {
      if (newKeys.has(key)) sharedKeyCount++;
    }
    const maxKeys = Math.max(1, Math.max(currentKeys.size, newKeys.size));
    const semanticContinuity = Math.min(1.0, sharedKeyCount / maxKeys);

    // Coordinate scale preservation: true if spatial positioning primitives are retained
    const hasSpatialCurrent = currentKinds.includes('POINT_IDENTITY');
    const hasSpatialNew = newKinds.includes('POINT_IDENTITY');
    const coordinateScalePreservation = hasSpatialCurrent && hasSpatialNew;

    const visualContinuityRating = Math.min(
      1.0,
      landmarkStability * 0.6 + semanticContinuity * 0.4
    );

    const summary =
      `Transition ${currentGraph.graphId} -> ${newGraph.graphId}: ` +
      `retained [${retainedKinds.join(', ') || 'none'}], ` +
      `added [${addedKinds.join(', ') || 'none'}], ` +
      `removed [${removedKinds.join(', ') || 'none'}]. ` +
      `Continuity score: ${(visualContinuityRating * 100).toFixed(1)}%.`;

    return {
      fromGraphId: currentGraph.graphId,
      toGraphId: newGraph.graphId,
      landmarkStability,
      semanticContinuity,
      coordinateScalePreservation,
      visualContinuityRating,
      addedPrimitiveKinds: addedKinds,
      removedPrimitiveKinds: removedKinds,
      retainedPrimitiveKinds: retainedKinds,
      summary,
    };
  }

  /**
   * Renders the System-1 advisory disclosure for a synthesis result.
   * Presents consumed advice (or abstention) as advice, never as evidence.
   */
  private static explainSystem1Advisory(result: FullMonetaSynthesisResult): string {
    const advisory = result.system1ProposalSet;
    let section = `System-1 Advisory Disclosure:\n`;
    section += `   - Advisory proposal set: ${advisory.proposalSetId}\n`;
    if (advisory.status === 'ABSTAIN') {
      section += `   - Status: ABSTAINED — ${advisory.abstentionReason}\n`;
      section += `   - Effect: proceeded on the deterministic/search path without System-1 advice.\n`;
      return section;
    }
    section += `   - Status: PROPOSED (${advisory.candidates.length} candidate(s)) — advice, not analytical evidence.\n`;
    for (const c of advisory.candidates) {
      section += `   - Advised ${c.candidateId}: template ${c.templateId}, tier ${c.targetResolutionTier}, score ${c.score.toFixed(3)}\n`;
    }
    if (!result.system1AdviceApplied) {
      section += `   - Effect: advice deliberately bypassed by caller request; deterministic/search path ran without it. The bypassed set above is preserved for baseline comparison.\n`;
      return section;
    }
    const winner = result.paretoFrontier[0] ?? result.candidate;
    const winnerFromAdvice = (winner.lineage.operatorApplied ?? '').startsWith('SYSTEM1_SEED_');
    section += winnerFromAdvice
      ? `   - Effect: selected candidate ${winner.candidateId} originated from System-1 advice and survived Pareto admission.\n`
      : `   - Effect: System-1 advice competed; the selected candidate ${winner.candidateId} was chosen on Pareto objectives, not by the advisor.\n`;
    return section;
  }

  /**
   * Generates a multi-layer TechnoCore explanation of a Full Moneta synthesis/adaptation decision.
   */
  public static explainFullMonetaDecision(
    result: FullMonetaSynthesisResult,
    preference: ObjectivePreference = 'BALANCED'
  ): string {
    const { candidate, resolutionVariant, transition, researchModeFrozen, provenance } = result;
    const v = candidate.objectiveVector;

    let explanation = `=== FULL MONETA SYNTHESIS REPORT [${result.synthesisId}] ===\n`;
    explanation += `Mode: ${researchModeFrozen ? 'RESEARCH MODE (FROZEN REPRODUCIBILITY)' : 'ADAPTIVE DISCOVERY'}\n`;
    explanation += `Timestamp: ${provenance.timestamp}\n`;
    explanation += `Dataset Fingerprint: ${provenance.datasetFingerprint}\n\n`;

    explanation += `1. Objective Vector Evaluation (Preference: [${preference}], Utility: ${candidate.utility.toFixed(3)}):\n`;
    explanation += `   - Task Relevance:            ${v.taskRelevance.toFixed(3)}\n`;
    explanation += `   - Information Preservation:  ${v.informationPreservation.toFixed(3)}\n`;
    explanation += `   - Perceptual Recoverability: ${v.perceptualRecoverability.toFixed(3)}\n`;
    explanation += `   - Interaction Cost:          ${v.interactionCost.toFixed(3)}\n`;
    explanation += `   - Resource Efficiency:       ${(1.0 - v.resourceCost).toFixed(3)}\n`;
    explanation += `   - Stability:                 ${v.stability.toFixed(3)}\n`;
    explanation += `   - Explicit Loss Contract:    ${(1.0 - v.explicitLoss).toFixed(3)}\n\n`;

    explanation += `2. Composition Topology:\n`;
    explanation += `   - Graph ID: ${result.selectedGraph.graphId}\n`;
    explanation += `   - Primitives: ${result.selectedGraph.primitives.map((p) => `${p.id} (${p.kind})`).join(', ')}\n`;
    explanation += `   - Composition Edges: ${result.selectedGraph.edges.length}\n`;
    explanation += `   - Composed Runtime Identity: ${result.composedState.composedIdentity}\n\n`;

    explanation += `3. Hardware Resolution Brokering:\n`;
    explanation += `   - Resolution Tier: ${resolutionVariant.variantTier}\n`;
    explanation += `   - Budget Profile: ${resolutionVariant.budgetProfile}\n`;
    explanation += `   - Shed Optional Channels: ${resolutionVariant.shedOptionalChannels.join(', ') || 'none'}\n`;
    explanation += `   - Preserved Mandatory Channels: ${resolutionVariant.preservedObligations.mandatoryChannels.join(', ')}\n\n`;

    if (transition) {
      explanation += `4. Cognitive Orientation & Transition Stability:\n`;
      explanation += `   - Landmark Stability: ${(transition.landmarkStability * 100).toFixed(1)}%\n`;
      explanation += `   - Semantic Continuity: ${(transition.semanticContinuity * 100).toFixed(1)}%\n`;
      explanation += `   - Coordinate Scale Preserved: ${transition.coordinateScalePreservation ? 'YES' : 'NO'}\n`;
      explanation += `   - Visual Continuity Rating: ${(transition.visualContinuityRating * 100).toFixed(1)}%\n`;
      explanation += `   - Summary: ${transition.summary}\n`;
    }

    explanation += FullMonetaEngine.explainSystem1Advisory(result);

    return explanation;
  }
}

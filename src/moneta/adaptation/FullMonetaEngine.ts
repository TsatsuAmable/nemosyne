import type { DatasetSignature } from '../representation/DatasetSignature.js';
import type { CommittedInvestigationContextV2 } from '../../atlas/domain/CommittedInvestigationContext.js';
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
import { FormaSystem1Proposer, DEFAULT_SYSTEM1_WEIGHTS } from '../forma/FormaSystem1Proposer.js';

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
  readonly analyticalEvidence?: {
    readonly envelope: SemanticEmbodimentEnvelopeV1;
    readonly evidenceReferences: readonly EvidenceReferenceTupleV1[];
  };
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
  readonly provenance: {
    readonly datasetFingerprint: string;
    readonly timestamp: string;
    readonly fitnessModelVersion: string;
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
    const preference = options.preference ?? 'BALANCED';
    const isResearchMode = options.researchMode ?? false;

    // 1. Freeze knowledge store if research mode is active
    if (isResearchMode && knowledgeStore && !knowledgeStore.isStoreFrozen) {
      knowledgeStore.freeze();
    }

    // 2. Multi-objective Pareto search
    const maxGenerations = isResearchMode ? 2 : (options.maxGenerations ?? 3);
    const populationSize = isResearchMode ? 8 : (options.populationSize ?? 12);

    const searchResult = RepresentationSearchEngine.search(signature, {
      preference,
      maxGenerations,
      populationSize,
      context,
    });

    const topCandidate = searchResult.paretoFrontier[0] ?? searchResult.referenceCandidate;
    const selectedGraph = topCandidate.graph;

    // 3. Calculate adaptation transition if a previous graph exists
    let transition: AdaptationTransition | undefined;
    if (options.currentGraph) {
      transition = this.computeAdaptationTransition(options.currentGraph, selectedGraph);
    }

    // 4. Analytical evidence resolution & validation (FMA-01)
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

    // 5. Query System-1 proposal and knowledge store precedents
    const fallbackContext: CommittedInvestigationContextV2 = context ?? {
      schemaVersion: 2,
      nodeId: 'node-root',
      intent: {
        schemaVersion: 1,
        researchQuestion: 'Explore dataset structure',
        currentTask: 'exploratory_analysis',
      },
      epistemicPurpose: 'EXPLORATORY_ABDUCTION',
    };

    const proposer = new FormaSystem1Proposer(DEFAULT_SYSTEM1_WEIGHTS, knowledgeStore);
    const s1Proposals = proposer.generateProposals(snapshot, fallbackContext, manifest, budget);

    const broker = new FormaResolutionBroker();

    const brokerOutcome = broker.brokerVariant(
      snapshot,
      fallbackContext,
      manifest,
      budget,
      obligations,
      1
    );

    if (brokerOutcome.status !== 'ADMITTED') {
      throw new Error(
        `[FullMonetaEngine] Resolution adaptation refused: [${brokerOutcome.refusal.code}] ${brokerOutcome.refusal.message}`
      );
    }

    const resolutionVariant = brokerOutcome.variant;

    // 6. Multi-element runtime composition
    const multiRuntime = new FormaMultiElementRuntime();
    multiRuntime.registerElement(
      `element-${selectedGraph.primitives[0]?.id ?? 'root'}`,
      resolutionVariant.slice,
      selectedGraph.primitives[0]?.kind ?? 'POINT_IDENTITY'
    );

    if (selectedGraph.primitives.length > 1) {
      for (let i = 1; i < selectedGraph.primitives.length; i++) {
        const prim = selectedGraph.primitives[i];
        multiRuntime.registerElement(
          `element-${prim.id}`,
          resolutionVariant.slice,
          prim.kind
        );
        multiRuntime.addRelationship(
          `element-${selectedGraph.primitives[0].id}`,
          `element-${prim.id}`,
          'COORDINATES_WITH'
        );
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
      provenance: {
        datasetFingerprint: signature.provenance.datasetFingerprint,
        timestamp: new Date().toISOString(),
        fitnessModelVersion: isResearchMode
          ? 'FullMonetaEngine-FrozenResearchMode-v1'
          : `FullMonetaEngine-Adaptive-s1-${s1Proposals.status}`,
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

    return explanation;
  }
}

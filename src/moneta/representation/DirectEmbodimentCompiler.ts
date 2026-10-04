import { canonicalSha256Hex } from '../../security/CryptoHash.js';
import {
  type CommittedInvestigationContextV2,
  computeCommittedContextIdentity,
} from '../../atlas/domain/CommittedInvestigationContext.js';
import {
  type SemanticSnapshotV1,
  validateSemanticSnapshot,
  computeSnapshotId,
} from './SemanticSnapshotV1.js';
import {
  type SpatialEmbodimentPlanV1,
  type SpatialEmbodimentElementV1,
  type SpatialPrimitiveV1,
  validateSpatialEmbodimentPlanV1,
  SPATIAL_EMBODIMENT_PLAN_SCHEMA_VERSION,
  SPATIAL_EMBODIMENT_PLAN_MAX_ELEMENTS,
} from './SpatialEmbodimentPlanV1.js';
import {
  type DeviceCapabilityBudgetV1,
  type AdmittedVariantSliceV1,
  type SemanticObligationContractV1,
  DESKTOP_EXPANSIVE_BUDGET,
  FormaResolutionBroker,
} from '../forma/FormaResolutionBroker.js';
import {
  type FormaCompiledSliceV1,
  type FormaReverseTraceV1,
  type SpatialPhenotype,
} from '../forma/FormaSpatialCompiler.js';
import {
  FormaMultiElementRuntime,
  type ComposedRepresentationStateV1,
} from '../forma/FormaMultiElementRuntime.js';
import { createKB0Manifest } from '../forma/KB0Manifest.js';
import type { FormaAdmissionOptionsV1 } from '../forma/FormaAdmission.js';

export const DIRECT_EMBODIMENT_COMPILER_SCHEMA_VERSION = '1.0.0' as const;

export type GovernedPhenomenonKind = 'DISTRIBUTION' | 'TOPOLOGICAL_CLUSTERING';

export type CritiqueKind =
  | 'SPATIAL_SCALE'
  | 'DENSITY_RESOLUTION'
  | 'CLUSTER_SEPARATION'
  | 'OCCLUSION'
  | 'CUSTOM';

export interface AttributableCritiqueV1 {
  readonly critiqueId: string;
  readonly investigatorId: string;
  readonly timestamp: number;
  readonly targetElementId: string;
  readonly targetPhenomenon: GovernedPhenomenonKind;
  readonly critiqueKind: CritiqueKind;
  readonly note: string;
  readonly recordedContextId: string;
}

export interface DirectEmbodimentCompileRequest {
  readonly datasetFingerprint: string;
  readonly snapshot: SemanticSnapshotV1;
  readonly context: CommittedInvestigationContextV2;
  readonly budget?: DeviceCapabilityBudgetV1;
  readonly obligations?: SemanticObligationContractV1;
  readonly admissionOptions?: FormaAdmissionOptionsV1;
  readonly broker?: FormaResolutionBroker;
  readonly phenotype?: SpatialPhenotype;
  readonly critiqueFeedback?: readonly AttributableCritiqueV1[];
  readonly maxElementsOverride?: number;
  readonly researchMode?: boolean;
}

export interface BoundedOverviewV1 {
  readonly phenomenonCoverage: readonly GovernedPhenomenonKind[];
  readonly totalElementCount: number;
  readonly isCardinalityBounded: boolean;
  readonly maxAllowedElements: number;
  readonly datasetRowCount?: number;
}

export interface DirectEmbodimentCompileResult {
  readonly schemaVersion: typeof DIRECT_EMBODIMENT_COMPILER_SCHEMA_VERSION;
  readonly compilationId: string;
  readonly datasetFingerprint: string;
  readonly plan: SpatialEmbodimentPlanV1;
  readonly slice: FormaCompiledSliceV1;
  readonly reverseExplanation: readonly FormaReverseTraceV1[];
  readonly admittedVariant: AdmittedVariantSliceV1;
  readonly composedState: ComposedRepresentationStateV1;
  readonly boundedOverview: BoundedOverviewV1;
  readonly critiqueLedger: readonly AttributableCritiqueV1[];
  readonly provenance: {
    readonly compilationTimestamp: number;
    readonly snapshotDigest: string;
    readonly contextDigest: string;
    readonly deterministicSeed: number;
    readonly compilationPath: 'DIRECT_DETERMINISTIC';
    readonly neuralAdviceApplied: false;
    readonly evolutionarySearchGenerations: 0;
  };
}

/**
 * Creates an attributable investigator critique with durable identity.
 */
export function recordInvestigatorCritique(input: {
  readonly investigatorId: string;
  readonly targetElementId: string;
  readonly targetPhenomenon: GovernedPhenomenonKind;
  readonly critiqueKind: CritiqueKind;
  readonly note: string;
  readonly contextId: string;
  readonly timestamp?: number;
}): AttributableCritiqueV1 {
  if (!input.investigatorId.trim()) {
    throw new Error('[DirectEmbodimentCompiler] Investigator ID is required for attributable critique');
  }
  if (!input.targetElementId.trim()) {
    throw new Error('[DirectEmbodimentCompiler] Target element ID is required for attributable critique');
  }
  if (!input.note.trim()) {
    throw new Error('[DirectEmbodimentCompiler] Critique note cannot be empty');
  }

  const timestamp = input.timestamp ?? Date.now();
  const hash = canonicalSha256Hex({
    investigatorId: input.investigatorId,
    targetElementId: input.targetElementId,
    targetPhenomenon: input.targetPhenomenon,
    critiqueKind: input.critiqueKind,
    note: input.note,
    contextId: input.contextId,
    timestamp,
  });

  return {
    critiqueId: `critique-${hash.slice(0, 16)}`,
    investigatorId: input.investigatorId,
    timestamp,
    targetElementId: input.targetElementId,
    targetPhenomenon: input.targetPhenomenon,
    critiqueKind: input.critiqueKind,
    note: input.note,
    recordedContextId: input.contextId,
  };
}

/**
 * Detects governed analytical phenomena from semantic snapshot evidence.
 */
function detectGovernedPhenomena(snapshot: SemanticSnapshotV1): GovernedPhenomenonKind[] {
  const phenomena = new Set<GovernedPhenomenonKind>();

  for (const source of snapshot.body.sources) {
    const fam = source.family.toUpperCase();
    if (fam.includes('DISTRIBUTION') || fam.includes('DENSITY') || fam.includes('HISTOGRAM')) {
      phenomena.add('DISTRIBUTION');
    }
    if (fam.includes('CLUSTER') || fam.includes('TOPOLOGY') || fam.includes('SPATIAL') || fam.includes('MANIFOLD')) {
      phenomena.add('TOPOLOGICAL_CLUSTERING');
    }
  }

  for (const node of snapshot.body.nodes) {
    const path = node.propertyPath.toLowerCase();
    const label = node.descriptor.label.toLowerCase();
    if (
      path.includes('density') ||
      path.includes('distribution') ||
      path.includes('histogram') ||
      path.includes('quantile') ||
      path.includes('variance') ||
      label.includes('distribution') ||
      label.includes('density')
    ) {
      phenomena.add('DISTRIBUTION');
    }
    if (
      path.includes('cluster') ||
      path.includes('centroid') ||
      path.includes('hull') ||
      path.includes('topology') ||
      label.includes('cluster') ||
      label.includes('partition')
    ) {
      phenomena.add('TOPOLOGICAL_CLUSTERING');
    }
  }

  // If no explicit tags match, inspect node shapes/descriptors
  if (phenomena.size === 0) {
    // Default fallback to DISTRIBUTION if continuous 1D values exist
    phenomena.add('DISTRIBUTION');
  }

  return Array.from(phenomena);
}

/**
 * DSE1: Direct deterministic embodiment compilation loop.
 *
 * Compiles an authoritative semantic snapshot, investigation context, and device budget
 * directly into an admitted spatial embodiment plan and reverse explanation trace
 * without requiring neural advice or runtime evolutionary search.
 */
export function compileDirectEmbodimentPlan(
  request: DirectEmbodimentCompileRequest
): DirectEmbodimentCompileResult {
  const { datasetFingerprint, snapshot, context } = request;

  // 1. Snapshot validation
  validateSemanticSnapshot(snapshot);

  if (
    snapshot.body.analyticalDatasetFingerprint &&
    datasetFingerprint &&
    snapshot.body.analyticalDatasetFingerprint !== datasetFingerprint
  ) {
    throw new Error(
      `[DirectEmbodimentCompiler] Dataset fingerprint mismatch: snapshot has ${snapshot.body.analyticalDatasetFingerprint}, request specified ${datasetFingerprint}`
    );
  }

  // 2. Dual-epistemic validation (FAL-DSE0-5)
  // When epistemic purpose is CLAIM_BEARING, conjectural proposals must not be admitted.
  if (context.epistemicPurpose === 'CLAIM_BEARING') {
    if (
      request.admissionOptions?.conjecturalProposals &&
      request.admissionOptions.conjecturalProposals.length > 0
    ) {
      throw new Error(
        '[DirectEmbodimentCompiler] Epistemic boundary refusal: conjectural proposals cannot be admitted under CLAIM_BEARING'
      );
    }
  }

  // 3. Governed phenomena detection
  const phenomenonCoverage = detectGovernedPhenomena(snapshot);

  // 4. Budget & Cardinality Bounding (FAL-DSE0-3)
  const budget = request.budget ?? DESKTOP_EXPANSIVE_BUDGET;
  const maxBudgetElements = Math.min(
    budget.maxElements,
    SPATIAL_EMBODIMENT_PLAN_MAX_ELEMENTS,
    request.maxElementsOverride ?? budget.maxElements
  );

  const manifest = createKB0Manifest();
  const broker = request.broker ?? new FormaResolutionBroker();
  const contextGeneration =
    typeof context.runtimeGeneration === 'number'
      ? context.runtimeGeneration
      : broker.getContextGeneration(context.nodeId);

  const mandatoryChannels = request.obligations?.mandatoryChannels ?? [
    'spatial_position',
    'spatial_scatter',
  ];
  const mandatoryNodeIds = request.obligations?.mandatoryNodeIds
    ? [...request.obligations.mandatoryNodeIds]
    : snapshot.body.nodes.slice(0, 1).map((n) => n.nodeId);

  const obligations: SemanticObligationContractV1 = {
    mandatoryNodeIds,
    mandatoryChannels,
  };

  // Cardinality bounding: clamp snapshot nodes to maxBudgetElements to prevent budget exhaustion
  let effectiveSnapshot = snapshot;
  if (snapshot.body.nodes.length > maxBudgetElements) {
    const mandatorySet = new Set(obligations.mandatoryNodeIds);
    const mandatoryNodes = snapshot.body.nodes.filter((n) => mandatorySet.has(n.nodeId));
    const optionalNodes = snapshot.body.nodes.filter((n) => !mandatorySet.has(n.nodeId));
    const remainingSlots = Math.max(0, maxBudgetElements - mandatoryNodes.length);
    const clampedNodes = [...mandatoryNodes, ...optionalNodes.slice(0, remainingSlots)]
      .sort((a, b) => a.nodeId.localeCompare(b.nodeId));

    const clampedBody = {
      ...snapshot.body,
      nodes: clampedNodes,
    };
    effectiveSnapshot = {
      schemaVersion: snapshot.schemaVersion,
      snapshotId: computeSnapshotId(clampedBody),
      body: clampedBody,
    };
  }

  // 5. Resolution adaptation via broker
  const brokerOutcome = broker.brokerVariant(
    effectiveSnapshot,
    context,
    manifest,
    budget,
    obligations,
    contextGeneration,
    request.admissionOptions
  );

  if (brokerOutcome.status !== 'ADMITTED') {
    throw new Error(
      `[DirectEmbodimentCompiler] Resolution adaptation refused: [${brokerOutcome.refusal.code}] ${brokerOutcome.refusal.message}`
    );
  }

  const admittedVariant = brokerOutcome.variant;
  const slice = admittedVariant.slice;

  // 6. Map to SpatialEmbodimentPlanV1 with strict N-independent cardinality bound
  // Enforce budget ceiling on elements
  const boundedSliceElements = slice.elements.slice(0, maxBudgetElements);

  const spatialElements: SpatialEmbodimentElementV1[] = boundedSliceElements.map((elem) => {
    let primitive: SpatialPrimitiveV1 = 'GLYPH';
    if (slice.phenotype === 'SPATIAL_SURFACE_V1' || elem.visualEncoding.shape === 'VOXEL') {
      primitive = 'SURFACE';
    } else if (elem.visualEncoding.shape === 'SPHERE') {
      primitive = 'GLYPH';
    }

    return {
      id: elem.elementId,
      semanticNodeId: elem.semanticNodeId,
      representationPrimitiveId: elem.proposalId ?? elem.elementId,
      primitive,
      parameters: {
        channel: elem.channel,
        posX: elem.position[0],
        posY: elem.position[1],
        posZ: elem.position[2],
        scaleX: elem.scale[0],
        scaleY: elem.scale[1],
        scaleZ: elem.scale[2],
        colorHex: elem.visualEncoding.colorHex,
        opacity: elem.visualEncoding.opacity,
        shape: elem.visualEncoding.shape,
        isConjectural: elem.bindingKind === 'CONJECTURAL',
        bindingKind: elem.bindingKind ?? 'GROUNDED',
      },
    };
  });

  const planHash = canonicalSha256Hex({
    datasetFingerprint,
    snapshotId: snapshot.snapshotId,
    contextId: context.nodeId,
    elementsCount: spatialElements.length,
    phenotype: slice.phenotype,
    budget: budget.profileName,
  });

  const planId = `plan-direct-${planHash.slice(0, 16)}`;
  const decisionId = `decision-direct-${canonicalSha256Hex({ planId, budget: budget.profileName }).slice(0, 16)}`;

  const plan: SpatialEmbodimentPlanV1 = {
    schemaVersion: SPATIAL_EMBODIMENT_PLAN_SCHEMA_VERSION,
    planId,
    semanticGraphId: snapshot.snapshotId,
    datasetFingerprint: datasetFingerprint || snapshot.body.analyticalDatasetFingerprint || 'unknown-dataset',
    decisionId,
    elements: spatialElements,
  };

  const planValidation = validateSpatialEmbodimentPlanV1(plan);
  if (!planValidation.ok) {
    throw new Error(
      `[DirectEmbodimentCompiler] Spatial plan validation failed: ${planValidation.errors.join(', ')}`
    );
  }

  // 7. Multi-element runtime composition
  const multiRuntime = new FormaMultiElementRuntime();
  multiRuntime.registerElement(
    `direct-elem-${slice.sliceId.slice(0, 16)}`,
    slice,
    phenomenonCoverage[0] ?? 'DISTRIBUTION'
  );
  const composedState = multiRuntime.exportComposedState();

  // 8. Bounded overview metadata
  const firstSource = snapshot.body.sources[0];
  const datasetRowCount =
    firstSource && firstSource.state.status === 'AVAILABLE' && firstSource.state.approximation
      ? firstSource.state.approximation.representedRowCount
      : undefined;

  const boundedOverview: BoundedOverviewV1 = {
    phenomenonCoverage,
    totalElementCount: spatialElements.length,
    isCardinalityBounded: spatialElements.length <= maxBudgetElements,
    maxAllowedElements: maxBudgetElements,
    datasetRowCount,
  };

  const compilationId = `compile-direct-${canonicalSha256Hex({
    planId,
    contextId: context.nodeId,
    timestamp: Date.now(),
  }).slice(0, 16)}`;

  return {
    schemaVersion: DIRECT_EMBODIMENT_COMPILER_SCHEMA_VERSION,
    compilationId,
    datasetFingerprint: plan.datasetFingerprint,
    plan,
    slice,
    reverseExplanation: slice.reverseExplanation,
    admittedVariant,
    composedState,
    boundedOverview,
    critiqueLedger: request.critiqueFeedback ? [...request.critiqueFeedback] : [],
    provenance: {
      compilationTimestamp: Date.now(),
      snapshotDigest: canonicalSha256Hex(snapshot.body),
      contextDigest: computeCommittedContextIdentity(context),
      deterministicSeed: 0,
      compilationPath: 'DIRECT_DETERMINISTIC',
      neuralAdviceApplied: false,
      evolutionarySearchGenerations: 0,
    },
  };
}

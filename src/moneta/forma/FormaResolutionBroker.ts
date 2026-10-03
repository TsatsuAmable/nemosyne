import { canonicalSha256Hex } from '../../security/CryptoHash.js';
import type { SemanticSnapshotV1 } from '../representation/SemanticSnapshotV1.js';
import type { CommittedInvestigationContextV2 } from '../../atlas/domain/CommittedInvestigationContext.js';
import type { KB0ManifestV1 } from './KB0Manifest.js';
import {
  compileFormaSpatialSlice,
  type FormaCompiledSliceV1,
  type SpatialElementV1,
  type FormaReverseTraceV1,
  type SpatialPhenotype,
} from './FormaSpatialCompiler.js';

export const FORMA_RESOLUTION_BROKER_SCHEMA_VERSION = 1 as const;

export type ResolutionVariantTier = 'STICKMAN_SPARSE' | 'BALANCED_STANDARD' | 'MONA_LISA_EXPANSIVE';

export interface DeviceCapabilityBudgetV1 {
  readonly profileName: string;
  readonly maxElements: number;
  readonly maxChannels: number;
  readonly maxMemoryBytes: number;
  readonly allowedShapes: readonly ('SPHERE' | 'VOXEL')[];
  readonly allowSecondaryEncodings: boolean;
}

export const QUEST_CONSTRAINED_BUDGET: DeviceCapabilityBudgetV1 = {
  profileName: 'QUEST_CONSTRAINED',
  maxElements: 50,
  maxChannels: 2,
  maxMemoryBytes: 1024 * 1024 * 32, // 32MB
  allowedShapes: ['SPHERE'],
  allowSecondaryEncodings: false,
};

export const DESKTOP_EXPANSIVE_BUDGET: DeviceCapabilityBudgetV1 = {
  profileName: 'DESKTOP_EXPANSIVE',
  maxElements: 10000,
  maxChannels: 5,
  maxMemoryBytes: 1024 * 1024 * 512, // 512MB
  allowedShapes: ['SPHERE', 'VOXEL'],
  allowSecondaryEncodings: true,
};

export interface SemanticObligationContractV1 {
  readonly mandatoryNodeIds: readonly string[];
  readonly mandatoryChannels: readonly string[];
}

export interface AdmittedVariantSliceV1 {
  readonly schemaVersion: typeof FORMA_RESOLUTION_BROKER_SCHEMA_VERSION;
  readonly variantId: string;
  readonly variantTier: ResolutionVariantTier;
  readonly snapshotId: string;
  readonly contextId: string;
  readonly contextGeneration: number;
  readonly slice: FormaCompiledSliceV1;
  readonly budgetProfile: string;
  readonly preservedObligations: SemanticObligationContractV1;
  readonly shedOptionalChannels: readonly string[];
}

export type VariantBrokerOutcomeV1 =
  | { readonly status: 'ADMITTED'; readonly variant: AdmittedVariantSliceV1 }
  | {
      readonly status: 'REFUSED';
      readonly refusal: {
        readonly code:
          | 'MANDATORY_OBLIGATION_UNSATISFIED'
          | 'STALE_CONTEXT_ADOPTION_REFUSED'
          | 'COMPILATION_REFUSED'
          | 'BUDGET_EXCEEDED';
        readonly message: string;
      };
    };

/**
 * Resolution-Adaptive Moneta Broker (L4-RUNTIME-BUDGET / Stickman ↔ Mona Lisa).
 * Manages device-budget-aware compilation of admitted applicable plan variants,
 * enforcing mandatory semantic obligations and rejecting stale context adoption.
 */
export class FormaResolutionBroker {
  private activeContextGenerations: Map<string, number> = new Map();

  /**
   * Sets or advances the active generation for an investigation context.
   */
  public advanceContextGeneration(contextId: string): number {
    const current = this.activeContextGenerations.get(contextId) ?? 1;
    const next = current + 1;
    this.activeContextGenerations.set(contextId, next);
    return next;
  }

  /**
   * Gets current active generation for an investigation context.
   */
  public getContextGeneration(contextId: string): number {
    return this.activeContextGenerations.get(contextId) ?? 1;
  }

  /**
   * Evaluates device budget, compiles the spatial plan, and emits an admitted variant slice.
   * If mandatory obligations cannot be satisfied under the budget, or if the context generation is stale,
   * refuses closed.
   */
  public brokerVariant(
    snapshot: SemanticSnapshotV1,
    context: CommittedInvestigationContextV2,
    manifest: KB0ManifestV1,
    budget: DeviceCapabilityBudgetV1,
    obligations: SemanticObligationContractV1,
    requestedGeneration: number,
  ): VariantBrokerOutcomeV1 {
    // 1. Stale-context guard
    const activeGen = this.activeContextGenerations.get(context.nodeId) ?? 1;
    if (requestedGeneration < activeGen) {
      return {
        status: 'REFUSED',
        refusal: {
          code: 'STALE_CONTEXT_ADOPTION_REFUSED',
          message: `Requested context generation ${requestedGeneration} is stale (active generation: ${activeGen})`,
        },
      };
    }

    // 2. Determine applicable variant tier based on budget
    let variantTier: ResolutionVariantTier;
    let targetPhenotype: SpatialPhenotype;
    let allowedChannels: string[];
    const shedOptionalChannels: string[] = [];

    if (budget.maxElements <= QUEST_CONSTRAINED_BUDGET.maxElements && !budget.allowSecondaryEncodings) {
      variantTier = 'STICKMAN_SPARSE';
      targetPhenotype = 'SPATIAL_SCATTER_V1';
      allowedChannels = ['spatial_position', 'spatial_scatter'];
      shedOptionalChannels.push('secondary_voxel_surface', 'opacity_modulation');
    } else if (budget.maxElements >= 500 && budget.allowSecondaryEncodings) {
      variantTier = 'MONA_LISA_EXPANSIVE';
      targetPhenotype = 'SPATIAL_SURFACE_V1';
      allowedChannels = ['spatial_position', 'spatial_scatter', 'spatial_surface', 'secondary_voxel_surface', 'opacity_modulation'];
    } else {
      variantTier = 'BALANCED_STANDARD';
      targetPhenotype = 'SPATIAL_SCATTER_V1';
      allowedChannels = ['spatial_position', 'spatial_scatter', 'secondary_voxel_surface'];
      shedOptionalChannels.push('opacity_modulation');
    }

    // 3. Validate mandatory channel obligations against allowed channels
    for (const mandatoryChannel of obligations.mandatoryChannels) {
      if (!allowedChannels.includes(mandatoryChannel)) {
        return {
          status: 'REFUSED',
          refusal: {
            code: 'MANDATORY_OBLIGATION_UNSATISFIED',
            message: `Mandatory channel '${mandatoryChannel}' cannot be satisfied under budget profile '${budget.profileName}'`,
          },
        };
      }
    }

    // 4. Compile base spatial slice
    const compilationOutcome = compileFormaSpatialSlice(snapshot, context, manifest, targetPhenotype);
    if (compilationOutcome.status === 'REFUSED') {
      return {
        status: 'REFUSED',
        refusal: {
          code: 'COMPILATION_REFUSED',
          message: compilationOutcome.refusal.message,
        },
      };
    }

    const compiledSlice = compilationOutcome.slice;

    // 5. Pre-check element count budget
    if (compiledSlice.elements.length > budget.maxElements) {
      return {
        status: 'REFUSED',
        refusal: {
          code: 'BUDGET_EXCEEDED',
          message: `Embodied element count (${compiledSlice.elements.length}) exceeds budget maxElements (${budget.maxElements})`,
        },
      };
    }

    // 6. Filter/shape elements to satisfy device budget
    const elementsByNode = new Map<string, SpatialElementV1>();
    for (const el of compiledSlice.elements) {
      const shape = budget.allowedShapes.includes(el.visualEncoding.shape)
        ? el.visualEncoding.shape
        : budget.allowedShapes[0] ?? 'SPHERE';

      const adaptedEl: SpatialElementV1 = {
        ...el,
        visualEncoding: {
          ...el.visualEncoding,
          shape,
          opacity: budget.allowSecondaryEncodings ? el.visualEncoding.opacity : 1.0,
        },
      };

      elementsByNode.set(el.semanticNodeId, adaptedEl);
    }

    // Check mandatory node obligations against either nodeId or producerSemanticId
    const embodiedNodeIds = new Set<string>();
    for (const trace of compiledSlice.reverseExplanation) {
      if (elementsByNode.has(trace.semanticNodeId)) {
        embodiedNodeIds.add(trace.semanticNodeId);
        embodiedNodeIds.add(trace.producerSemanticId);
      }
    }

    for (const mandatoryNodeId of obligations.mandatoryNodeIds) {
      if (!embodiedNodeIds.has(mandatoryNodeId)) {
        return {
          status: 'REFUSED',
          refusal: {
            code: 'MANDATORY_OBLIGATION_UNSATISFIED',
            message: `Mandatory semantic node '${mandatoryNodeId}' could not be embodied`,
          },
        };
      }
    }

    // 7. Build adapted reverse explanation
    const adaptedReverseExplanation: FormaReverseTraceV1[] = compiledSlice.reverseExplanation.filter((trace) =>
      elementsByNode.has(trace.semanticNodeId),
    );

    const adaptedSlice: FormaCompiledSliceV1 = {
      ...compiledSlice,
      elements: Array.from(elementsByNode.values()),
      reverseExplanation: adaptedReverseExplanation,
    };

    const variantId = `forma-variant-v1:${canonicalSha256Hex({
      sliceId: adaptedSlice.sliceId,
      variantTier,
      budgetProfile: budget.profileName,
      contextGeneration: requestedGeneration,
    })}`;

    return {
      status: 'ADMITTED',
      variant: {
        schemaVersion: FORMA_RESOLUTION_BROKER_SCHEMA_VERSION,
        variantId,
        variantTier,
        snapshotId: snapshot.snapshotId,
        contextId: context.nodeId,
        contextGeneration: requestedGeneration,
        slice: adaptedSlice,
        budgetProfile: budget.profileName,
        preservedObligations: obligations,
        shedOptionalChannels,
      },
    };
  }
}

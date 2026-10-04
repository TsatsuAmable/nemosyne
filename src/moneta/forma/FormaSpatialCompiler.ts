import { canonicalSha256Hex } from '../../security/CryptoHash.js';
import type {
  SemanticSnapshotV1,
  SemanticNodeRecordV1,
  EvidenceReferenceTupleV1,
} from '../representation/SemanticSnapshotV1.js';
import type { CommittedInvestigationContextV2 } from '../../atlas/domain/CommittedInvestigationContext.js';
import {
  compileFormaAdmission,
  type FormaRefusalV1,
  type FormaAdmissionOptionsV1,
} from './FormaAdmission.js';
import type { KB0ManifestV1 } from './KB0Manifest.js';

export const FORMA_SPATIAL_COMPILER_SCHEMA_VERSION = 1 as const;

export type SpatialPhenotype = 'SPATIAL_SCATTER_V1' | 'SPATIAL_SURFACE_V1';

export interface SpatialElementV1 {
  readonly elementId: string;
  readonly semanticNodeId: string;
  readonly channel: string;
  readonly position: readonly [number, number, number];
  readonly scale: readonly [number, number, number];
  readonly visualEncoding: {
    readonly colorHex: string;
    readonly opacity: number;
    readonly shape: 'SPHERE' | 'VOXEL';
    readonly isConjectural?: boolean;
  };
  readonly bindingKind?: 'GROUNDED' | 'CONJECTURAL';
  readonly epistemicStatus?: string;
  readonly proposalId?: string;
}

export interface FormaReverseTraceV1 {
  readonly elementId: string;
  readonly channel: string;
  readonly semanticNodeId: string;
  readonly producerSemanticId: string;
  readonly propertyPath: string;
  readonly evidenceReferences: readonly EvidenceReferenceTupleV1[];
  readonly rationale: string;
  readonly bindingKind?: 'GROUNDED' | 'CONJECTURAL';
  readonly epistemicStatus?: string;
  readonly proposalId?: string;
  readonly uncertaintyDisclosure?: string;
}

export interface FormaCompiledSliceV1 {
  readonly schemaVersion: typeof FORMA_SPATIAL_COMPILER_SCHEMA_VERSION;
  readonly sliceId: string;
  readonly planId: string;
  readonly snapshotId: string;
  readonly contextId: string;
  readonly phenotype: SpatialPhenotype;
  readonly elements: readonly SpatialElementV1[];
  readonly reverseExplanation: readonly FormaReverseTraceV1[];
}

export type FormaSpatialCompilationOutcomeV1 =
  | { readonly status: 'COMPILED'; readonly slice: FormaCompiledSliceV1 }
  | { readonly status: 'REFUSED'; readonly refusal: FormaRefusalV1 };

export interface FormaExecutionRecordV1 {
  readonly executionId: string;
  readonly sliceId: string;
  readonly snapshotId: string;
  readonly contextId: string;
  readonly manifestId: string;
  readonly phenotype: SpatialPhenotype;
  readonly inputDigest: string;
}

export type {
  EmbodimentCritiqueInputV1,
  EmbodimentCritiqueRecordV1,
} from './FormaHumanFeedback.js';


/**
 * Compiles an authoritative semantic snapshot, committed context, and pinned KB0 manifest
 * into a deterministic spatial backend slice.
 */
export function compileFormaSpatialSlice(
  snapshot: SemanticSnapshotV1,
  context: CommittedInvestigationContextV2,
  manifest: KB0ManifestV1,
  phenotype: SpatialPhenotype = 'SPATIAL_SCATTER_V1',
  admissionOptions?: FormaAdmissionOptionsV1
): FormaSpatialCompilationOutcomeV1 {
  // 1. Admission gate
  const admissionOutcome = compileFormaAdmission(snapshot, context, admissionOptions ?? 'PRODUCTION');
  if (admissionOutcome.status === 'REFUSED') {
    return {
      status: 'REFUSED',
      refusal: admissionOutcome.refusal,
    };
  }

  // 2. Evidence validation: every source must have non-empty evidence references
  for (const src of snapshot.body.sources) {
    if (!src.evidenceReferences || src.evidenceReferences.length === 0) {
      return {
        status: 'REFUSED',
        refusal: {
          code: 'OBLIGATION_UNSATISFIED',
          message: `Source ${src.sourceId} lacks required analytical evidence references`,
        },
      };
    }
  }

  const perspective = context.perspective;
  if (perspective && perspective.mode === 'foreground') {
    if (perspective.temporalForegrounding) {
      const isTemporal =
        snapshot.body.sources.some((s) => s.family === 'TEMPORAL') ||
        snapshot.body.nodes.some(
          (n) =>
            n.descriptor.frame === 'temporal' ||
            n.descriptor.unit === 'time' ||
            n.descriptor.label.toLowerCase().includes('time') ||
            n.descriptor.label.toLowerCase().includes('temporal')
        );
      if (!isTemporal) {
        return {
          status: 'REFUSED',
          refusal: {
            code: 'UNSUPPORTED_MAPPING',
            message: `Temporal foregrounding (${perspective.temporalForegrounding}) requested on snapshot lacking temporal semantics`,
          },
        };
      }
    }

    if (perspective.uncertaintyForegrounding === 'interval') {
      const hasInterval = snapshot.body.nodes.some(
        (n) =>
          n.descriptor.unit === 'interval' ||
          n.propertyPath.toLowerCase().includes('interval') ||
          n.propertyPath.toLowerCase().includes('bound') ||
          (typeof n.value === 'object' && n.value !== null && ('lower' in n.value || 'upper' in n.value))
      );
      if (!hasInterval) {
        return {
          status: 'REFUSED',
          refusal: {
            code: 'UNSUPPORTED_MAPPING',
            message: 'Interval uncertainty foregrounding requested on snapshot lacking interval or variance metadata',
          },
        };
      }
    }

    if (perspective.uncertaintyForegrounding === 'distribution') {
      const hasDistribution =
        snapshot.body.sources.some((s) => s.family === 'DISTRIBUTION') ||
        snapshot.body.nodes.some(
          (n) =>
            n.descriptor.valueType === 'vector' ||
            n.propertyPath.toLowerCase().includes('distribution') ||
            n.propertyPath.toLowerCase().includes('density')
        );
      if (!hasDistribution) {
        return {
          status: 'REFUSED',
          refusal: {
            code: 'UNSUPPORTED_MAPPING',
            message: 'Distribution uncertainty foregrounding requested on snapshot lacking distribution metadata',
          },
        };
      }
    }
  }

  const nodes = snapshot.body.nodes;
  const elements: SpatialElementV1[] = [];
  const reverseExplanation: FormaReverseTraceV1[] = [];

  // Extract and validate numeric values strictly without silent index/zero fallback
  const numericValues: number[] = [];
  for (const node of nodes) {
    if (node.state.status !== 'AVAILABLE' || node.value === undefined) {
      return {
        status: 'REFUSED',
        refusal: {
          code: 'UNSUPPORTED_MAPPING',
          message: `Semantic node ${node.nodeId} (${node.producerSemanticId}.${node.propertyPath}) has unavailable or missing value`,
        },
      };
    }
    const val = typeof node.value === 'number' ? node.value : Number(node.value);
    if (!Number.isFinite(val)) {
      return {
        status: 'REFUSED',
        refusal: {
          code: 'UNSUPPORTED_MAPPING',
          message: `Semantic node ${node.nodeId} (${node.producerSemanticId}.${node.propertyPath}) has non-finite numeric value: ${node.value}`,
        },
      };
    }
    numericValues.push(val);
  }

  const minVal = numericValues.length > 0 ? Math.min(...numericValues) : 0;
  const maxVal = numericValues.length > 0 ? Math.max(...numericValues) : 0;
  const valRange = maxVal - minVal;

  // 3. Deterministic Phenotype Layout Generation
  nodes.forEach((node: SemanticNodeRecordV1, index: number) => {
    const normVal = numericValues[index];
    // Monotonic scale mapping across full observation range without modulo loss
    const normHeight = valRange === 0 ? 1.0 : 0.2 + ((normVal - minVal) / valRange) * 2.0;

    let position: [number, number, number];
    let shape: 'SPHERE' | 'VOXEL';

    if (phenotype === 'SPATIAL_SCATTER_V1') {
      // 3D scatter arrangement
      const angle = index * 0.5;
      const radius = 1.0 + (index % 5) * 0.4;
      position = [
        Math.cos(angle) * radius,
        normHeight,
        Math.sin(angle) * radius,
      ];
      shape = 'SPHERE';
    } else {
      // 3D stepped surface elevation with monotonic range mapping
      const col = index % 4;
      const row = Math.floor(index / 4);
      const surfaceHeight = valRange === 0 ? 0.5 : 0.2 + ((normVal - minVal) / valRange) * 2.8;
      position = [
        col * 0.8 - 1.2,
        surfaceHeight,
        row * 0.8 - 1.2,
      ];
      shape = 'VOXEL';
    }

    // Full node identity hashed to guarantee 1:1 element uniqueness (FMA-04 fix)
    const elementHash = canonicalSha256Hex({
      phenotype,
      nodeId: node.nodeId,
      sourceId: node.sourceId,
      producerSemanticId: node.producerSemanticId,
      propertyPath: node.propertyPath,
    });
    const elementId = `elem-${phenotype.toLowerCase().replace(/_/g, '-')}-${elementHash.slice(0, 24)}`;

    let channel = phenotype === 'SPATIAL_SCATTER_V1' ? 'spatial_radial_scatter' : 'spatial_elevation_grid';
    let colorHex = phenotype === 'SPATIAL_SCATTER_V1' ? '#38bdf8' : '#34d399';
    let opacity = 0.95;
    let scale: [number, number, number] = [0.15, 0.15, 0.15];
    let rationale = `Perceptual element ${elementId} embodies semantic node ${node.producerSemanticId}.${node.propertyPath} via ${channel} [Phenotype ${phenotype}]`;

    if (perspective) {
      if (perspective.mode === 'foreground') {
        if (perspective.temporalForegrounding === 'recency') {
          const isRecent = index >= Math.floor(nodes.length * 0.5);
          opacity = isRecent ? 1.0 : 0.45;
          if (isRecent) {
            colorHex = '#f59e0b';
            scale = [0.18, 0.18, 0.18];
          }
          rationale += ' [Perspective: recency foregrounded]';
        } else if (perspective.temporalForegrounding === 'historical') {
          const isHistorical = index < Math.ceil(nodes.length * 0.5);
          opacity = isHistorical ? 1.0 : 0.45;
          if (isHistorical) {
            colorHex = '#a855f7';
            scale = [0.18, 0.18, 0.18];
          }
          rationale += ' [Perspective: historical foregrounded]';
        }

        if (perspective.uncertaintyForegrounding === 'interval') {
          channel = `${channel}_interval_bounded`;
          scale = [scale[0] * 1.2, scale[1] * 1.2, scale[2] * 1.2];
          rationale += ' [Uncertainty: interval bounded]';
        } else if (perspective.uncertaintyForegrounding === 'distribution') {
          channel = `${channel}_distribution_cloud`;
          rationale += ' [Uncertainty: distribution cloud]';
        } else if (perspective.uncertaintyForegrounding === 'point') {
          channel = `${channel}_point_estimate`;
          rationale += ' [Uncertainty: point estimate]';
        }
      } else if (perspective.mode === 'request_derivation') {
        rationale += ' [Perspective: derivation requested; current snapshot preserved]';
      }
    }

    // Lookup admitted binding: check for conjectural or specific binding for this node/property
    const admittedBinding =
      admissionOutcome.result.body.bindings?.find(
        (b) =>
          b.kind === 'CONJECTURAL' &&
          (b.elementId === elementId || b.elementId === node.nodeId || b.propertyPath === node.propertyPath)
      ) ??
      admissionOutcome.result.body.bindings?.find(
        (b) =>
          b.elementId === elementId ||
          b.elementId === node.nodeId ||
          b.propertyPath === node.propertyPath
      );
    const bindingKind = admittedBinding?.kind ?? 'GROUNDED';
    const epistemicStatus = admittedBinding?.status ?? 'OBSERVED';
    const proposalId = admittedBinding?.kind === 'CONJECTURAL' ? admittedBinding.proposalId : undefined;

    elements.push({
      elementId,
      semanticNodeId: node.nodeId,
      channel,
      position,
      scale,
      visualEncoding: {
        colorHex,
        opacity: bindingKind === 'CONJECTURAL' ? Math.min(opacity, 0.75) : opacity,
        shape,
        isConjectural: bindingKind === 'CONJECTURAL',
      },
      bindingKind,
      epistemicStatus,
      proposalId,
    });

    // Lookup evidence references from corresponding source
    const sourceRecord = snapshot.body.sources.find((s) => s.sourceId === node.sourceId);
    const evidenceReferences = sourceRecord?.evidenceReferences ?? [];

    reverseExplanation.push({
      elementId,
      channel,
      semanticNodeId: node.nodeId,
      producerSemanticId: node.producerSemanticId,
      propertyPath: node.propertyPath,
      evidenceReferences,
      rationale,
      bindingKind,
      epistemicStatus,
      proposalId,
      uncertaintyDisclosure: bindingKind === 'CONJECTURAL' ? 'Conjectural exploratory hypothesis' : undefined,
    });
  });

  const seenElementIds = new Set<string>();
  for (const el of elements) {
    if (seenElementIds.has(el.elementId)) {
      return {
        status: 'REFUSED',
        refusal: {
          code: 'UNSUPPORTED_MAPPING',
          message: `Colliding spatial element ID: ${el.elementId}`,
        },
      };
    }
    seenElementIds.add(el.elementId);
  }

  const planId = admissionOutcome.result.body.planId;
  const sliceBody = {
    planId,
    snapshotId: snapshot.snapshotId,
    contextId: admissionOutcome.result.body.contextId,
    manifestId: manifest.manifestId,
    phenotype,
    elements,
    reverseExplanation,
  };

  const sliceId = `forma-slice-v1:${canonicalSha256Hex(sliceBody)}`;

  return {
    status: 'COMPILED',
    slice: {
      schemaVersion: FORMA_SPATIAL_COMPILER_SCHEMA_VERSION,
      sliceId,
      planId,
      snapshotId: snapshot.snapshotId,
      contextId: context.nodeId,
      phenotype,
      elements,
      reverseExplanation,
    },
  };
}

/**
 * Creates an exact execution capture record for deterministic replay.
 */
export function captureFormaExecution(
  slice: FormaCompiledSliceV1,
  manifest: KB0ManifestV1,
): FormaExecutionRecordV1 {
  const inputDigest = canonicalSha256Hex({
    snapshotId: slice.snapshotId,
    contextId: slice.contextId,
    manifestId: manifest.manifestId,
    phenotype: slice.phenotype,
  });

  const executionId = `forma-exec-v1:${canonicalSha256Hex({ sliceId: slice.sliceId, inputDigest })}`;

  return {
    executionId,
    sliceId: slice.sliceId,
    snapshotId: slice.snapshotId,
    contextId: slice.contextId,
    manifestId: manifest.manifestId,
    phenotype: slice.phenotype,
    inputDigest,
  };
}

/**
 * Replays a captured Forma execution against candidate inputs.
 * Refuses closed if any inputs or evidence have drifted.
 */
export function replayFormaExecution(
  record: FormaExecutionRecordV1,
  inputs: {
    readonly snapshot: SemanticSnapshotV1;
    readonly context: CommittedInvestigationContextV2;
    readonly manifest: KB0ManifestV1;
    readonly phenotype: SpatialPhenotype;
  },
): { readonly success: true; readonly slice: FormaCompiledSliceV1 } | { readonly success: false; readonly error: string } {
  // Validate input identity match
  if (inputs.snapshot.snapshotId !== record.snapshotId) {
    return { success: false, error: `Snapshot identity mismatch: expected ${record.snapshotId}, got ${inputs.snapshot.snapshotId}` };
  }
  if (inputs.context.nodeId !== record.contextId) {
    return { success: false, error: `Context identity mismatch: expected ${record.contextId}, got ${inputs.context.nodeId}` };
  }
  if (inputs.manifest.manifestId !== record.manifestId) {
    return { success: false, error: `Manifest identity mismatch: expected ${record.manifestId}, got ${inputs.manifest.manifestId}` };
  }
  if (inputs.phenotype !== record.phenotype) {
    return { success: false, error: `Phenotype mismatch: expected ${record.phenotype}, got ${inputs.phenotype}` };
  }

  // Re-run compilation
  const result = compileFormaSpatialSlice(inputs.snapshot, inputs.context, inputs.manifest, inputs.phenotype);
  if (result.status === 'REFUSED') {
    return { success: false, error: `Replay compilation refused: ${result.refusal.message}` };
  }

  if (result.slice.sliceId !== record.sliceId) {
    return { success: false, error: `Replay bitwise sliceId mismatch: expected ${record.sliceId}, got ${result.slice.sliceId}` };
  }

  return { success: true, slice: result.slice };
}

export { recordEmbodimentCritique } from './FormaHumanFeedback.js';


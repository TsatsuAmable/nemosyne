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
  };
}

export interface FormaReverseTraceV1 {
  readonly elementId: string;
  readonly channel: string;
  readonly semanticNodeId: string;
  readonly producerSemanticId: string;
  readonly propertyPath: string;
  readonly evidenceReferences: readonly EvidenceReferenceTupleV1[];
  readonly rationale: string;
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

export interface EmbodimentCritiqueInputV1 {
  readonly planId: string;
  readonly sliceId: string;
  readonly contextId: string;
  readonly semanticNodeId: string;
  readonly critiqueText: string;
  readonly proposedAlternativePhenotype?: SpatialPhenotype;
  readonly confirmed: boolean;
}

export interface EmbodimentCritiqueRecordV1 {
  readonly critiqueId: string;
  readonly planId: string;
  readonly sliceId: string;
  readonly contextId: string;
  readonly semanticNodeId: string;
  readonly critiqueText: string;
  readonly proposedAlternativePhenotype?: SpatialPhenotype;
  readonly confirmed: boolean;
  readonly timestamp: number;
}

/**
 * Compiles an authoritative semantic snapshot, committed context, and pinned KB0 manifest
 * into a deterministic spatial backend slice.
 */
export function compileFormaSpatialSlice(
  snapshot: SemanticSnapshotV1,
  context: CommittedInvestigationContextV2,
  manifest: KB0ManifestV1,
  phenotype: SpatialPhenotype = 'SPATIAL_SCATTER_V1',
): FormaSpatialCompilationOutcomeV1 {
  // 1. Admission gate
  const admissionOutcome = compileFormaAdmission(snapshot, context, 'PRODUCTION');
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

  const nodes = snapshot.body.nodes;
  const elements: SpatialElementV1[] = [];
  const reverseExplanation: FormaReverseTraceV1[] = [];

  // 3. Deterministic Phenotype Layout Generation
  nodes.forEach((node: SemanticNodeRecordV1, index: number) => {
    const rawVal = typeof node.value === 'number' ? node.value : index;
    const normVal = Number.isFinite(rawVal) ? rawVal : 0;

    let position: [number, number, number];
    let shape: 'SPHERE' | 'VOXEL';

    if (phenotype === 'SPATIAL_SCATTER_V1') {
      // 3D scatter arrangement
      const angle = index * 0.5;
      const radius = 1.0 + (index % 5) * 0.4;
      position = [
        Math.cos(angle) * radius,
        (normVal % 10) * 0.2,
        Math.sin(angle) * radius,
      ];
      shape = 'SPHERE';
    } else {
      // 3D stepped surface elevation
      const col = index % 4;
      const row = Math.floor(index / 4);
      position = [
        col * 0.8 - 1.2,
        Math.min(Math.max(normVal * 0.1, 0.1), 3.0),
        row * 0.8 - 1.2,
      ];
      shape = 'VOXEL';
    }

    const elementId = `elem-${phenotype.toLowerCase()}-${node.nodeId.slice(0, 16)}`;
    const channel = phenotype === 'SPATIAL_SCATTER_V1' ? 'spatial_radial_scatter' : 'spatial_elevation_grid';

    elements.push({
      elementId,
      semanticNodeId: node.nodeId,
      channel,
      position,
      scale: [0.15, 0.15, 0.15],
      visualEncoding: {
        colorHex: phenotype === 'SPATIAL_SCATTER_V1' ? '#38bdf8' : '#34d399',
        opacity: 0.95,
        shape,
      },
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
      rationale: `Perceptual element ${elementId} embodies semantic node ${node.producerSemanticId}.${node.propertyPath} via ${channel} [Phenotype ${phenotype}]`,
    });
  });

  const planId = admissionOutcome.result.body.planId;
  const sliceBody = {
    planId,
    snapshotId: snapshot.snapshotId,
    contextId: context.nodeId,
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

/**
 * Records an attributable, confirmed human critique without mutating production priors.
 */
export function recordEmbodimentCritique(
  input: EmbodimentCritiqueInputV1,
): EmbodimentCritiqueRecordV1 {
  const timestamp = Date.now();
  const critiqueId = `critique-v1:${canonicalSha256Hex({
    planId: input.planId,
    sliceId: input.sliceId,
    contextId: input.contextId,
    semanticNodeId: input.semanticNodeId,
    critiqueText: input.critiqueText,
  })}`;

  return {
    critiqueId,
    planId: input.planId,
    sliceId: input.sliceId,
    contextId: input.contextId,
    semanticNodeId: input.semanticNodeId,
    critiqueText: input.critiqueText,
    proposedAlternativePhenotype: input.proposedAlternativePhenotype,
    confirmed: input.confirmed,
    timestamp,
  };
}

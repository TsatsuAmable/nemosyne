import type { Mesh } from 'three';
import type { AnalyticalExecutionPort } from '../../atlas/ports/AnalyticalExecutionPort.ts';
import type { MonetaDataInput } from '../../moneta/types.ts';
import type { MonetaTopologyNode } from '../../moneta/MonetaTopologyNode.ts';
import type {
  ClusterEmbodimentRequestV1,
  ProductionSemanticEmbodimentEnvelopeV1,
} from '../../moneta/representation/ClusterEmbodimentPayload.ts';
import {
  MAX_DETAIL_OBSERVATION_LIMIT_V1,
  SEMANTIC_DETAIL_SCHEMA_VERSION,
  type SemanticDetailEnvelopeV1,
  type SemanticDetailRequestV1,
} from '../../moneta/representation/SemanticDrillDown.ts';
import type { GraphEmbodimentRequestV1 } from '../../moneta/representation/GraphEmbodimentPayload.ts';
import { createSourceRelationshipGraphAuthority } from '../../moneta/representation/RelationshipGraphAuthority.ts';
import {
  SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
  type AggregateEmbodimentRequestV1,
  type DensityEmbodimentRequestV1,
  type DistributionEmbodimentRequestV1,
} from '../../moneta/representation/SemanticEmbodimentPayload.ts';
import type {
  RepresentationSurface,
  SemanticSelectionIdentity,
} from '../../vr/presentation/representation/RepresentationSurface.ts';
import { SemanticDetailObservationOverlay } from '../../vr/presentation/representation/SemanticDetailObservationOverlay.ts';

export const SEMANTIC_DETAIL_PRODUCT_PAGE_LIMIT_V1 = 256 as const;

export interface SemanticDetailAuthority {
  readonly executionPort: AnalyticalExecutionPort | null;
  readonly generation: number;
  readonly datasetVersion: number;
  readonly datasetFingerprint: string | null;
  readonly sessionId: string;
}

export type SemanticDetailTransitionStatus =
  | 'IDLE'
  | 'PENDING'
  | 'READY'
  | 'REFUSED';

export interface SemanticDetailTransitionSnapshot {
  readonly status: SemanticDetailTransitionStatus;
  readonly parent: SemanticSelectionIdentity | null;
  readonly returnedCount: number;
  readonly totalMemberCount: number;
  readonly observationIds: readonly string[];
  readonly refusalReason: string | null;
}

export type SemanticDetailTransitionListener = (
  snapshot: SemanticDetailTransitionSnapshot,
) => void;

export interface SemanticDatumLineageV1 {
  readonly datasetFingerprint: string;
  readonly observationId: string;
  readonly decisionId: string;
  readonly representationFamily: SemanticDetailRequestV1['target']['representationFamily'];
  readonly semanticObjectId: string;
  readonly generation: number;
  readonly datasetVersion: number;
  readonly investigationContext: string;
  readonly kernelVersion: string;
  readonly algorithmVersion: string;
  readonly decisionModelVersion: string | null;
  readonly decisionModelArtifactHash: string | null;
}

export type SemanticDatumSourceProvenanceV1 =
  | {
      readonly status: 'AVAILABLE';
      readonly value: Readonly<Record<string, unknown>>;
    }
  | {
      readonly status: 'UNAVAILABLE';
      readonly reason: string;
    };

export type SemanticDatumInspectionResultV1 =
  | {
      readonly status: 'READY';
      readonly observationId: string;
      readonly fields: Readonly<Record<string, unknown>>;
      readonly lineage: SemanticDatumLineageV1;
      readonly sourceProvenance: SemanticDatumSourceProvenanceV1;
    }
  | {
      readonly status: 'REFUSED';
      readonly observationId: string;
      readonly reason: string;
    };

type SemanticNodeInput = MonetaDataInput & {
  semanticEmbodiment?: ProductionSemanticEmbodimentEnvelopeV1 | null;
};

type DetailEmbodimentRequest =
  | AggregateEmbodimentRequestV1
  | DistributionEmbodimentRequestV1
  | DensityEmbodimentRequestV1
  | ClusterEmbodimentRequestV1
  | GraphEmbodimentRequestV1;

interface ActiveDetailContext {
  readonly parent: SemanticSelectionIdentity;
  readonly node: MonetaTopologyNode;
  readonly envelope: ProductionSemanticEmbodimentEnvelopeV1;
  readonly embodimentRequest: DetailEmbodimentRequest;
  readonly request: SemanticDetailRequestV1;
  readonly generation: number;
  readonly version: number;
  readonly fingerprint: string;
}

let detailRequestSequence = 0;

function sameIdentity(
  left: SemanticSelectionIdentity | null,
  right: SemanticSelectionIdentity | null
): boolean {
  return (
    left !== null &&
    right !== null &&
    left.semanticId === right.semanticId &&
    left.datasetFingerprint === right.datasetFingerprint &&
    left.decisionId === right.decisionId
  );
}

function currentEnvelope(node: MonetaTopologyNode): ProductionSemanticEmbodimentEnvelopeV1 | null {
  return (node.dataInput as SemanticNodeInput).semanticEmbodiment ?? null;
}

function detailEmbodimentRequest(
  envelope: ProductionSemanticEmbodimentEnvelopeV1,
  semanticObjectId: string
): DetailEmbodimentRequest | null {
  if (envelope.result.status !== 'READY') return null;
  const decision = {
    decisionId: envelope.provenance.decisionId,
    decisionModelVersion: envelope.provenance.decisionModelVersion,
    decisionModelArtifactHash: envelope.provenance.decisionModelArtifactHash,
  };

  if (
    envelope.candidateId === 'AGGREGATE_VOLUME' &&
    envelope.result.payload.kind === 'AGGREGATE_VOLUME'
  ) {
    const groupingField = envelope.result.payload.data.groupingFields[0];
    if (!groupingField) return null;
    return {
      schemaVersion: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
      candidateId: 'AGGREGATE_VOLUME',
      groupingField,
      measure: envelope.result.payload.data.measure,
      ...decision,
    };
  }

  if (
    envelope.candidateId === 'DISTRIBUTION_FIELD' &&
    envelope.result.payload.kind === 'EMPIRICAL_DISTRIBUTION'
  ) {
    // Summary marks are analytical summaries, not member containers.
    if (!semanticObjectId.startsWith('distribution-bin:')) return null;
    const distribution = envelope.result.payload.data;
    if (distribution.histogram.length === 0 || distribution.ecdf.length === 0) return null;
    return {
      schemaVersion: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
      candidateId: 'DISTRIBUTION_FIELD',
      measureField: distribution.measureField,
      histogramBinCount: distribution.histogram.length,
      ecdfKnotCount: distribution.ecdf.length,
      quantileProbabilities: distribution.quantiles.map((entry) => entry.probability),
      ...decision,
    };
  }

  if (
    envelope.candidateId === 'DENSITY_FIELD' &&
    envelope.result.payload.kind === 'BINNED_DENSITY'
  ) {
    const density = envelope.result.payload.data;
    return {
      schemaVersion: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
      candidateId: 'DENSITY_FIELD',
      measureFieldX: density.measureFieldX,
      measureFieldY: density.measureFieldY,
      binsX: density.binsX,
      binsY: density.binsY,
      ...decision,
    };
  }

  if (
    envelope.candidateId === 'CLUSTER_REGIONS' &&
    envelope.result.payload.kind === 'CLUSTER_REGIONS'
  ) {
    const cluster = envelope.result.payload.data;
    return {
      schemaVersion: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
      candidateId: 'CLUSTER_REGIONS',
      partitionField: cluster.partitionField,
      coordinateFields: [...cluster.coordinateFields],
      ...decision,
    };
  }

  if (
    envelope.candidateId === 'RELATIONSHIP_GRAPH' &&
    envelope.result.payload.kind === 'RELATIONSHIP_GRAPH'
  ) {
    // Reconstruct the exact B1 authority from the retained payload. Every
    // authority field except directionality is fixed single-variant V1
    // vocabulary, so this is a gate over the governed contract, not a
    // parallel parser: the resident Rust side re-derives membership from
    // the retained authoritative request and refuses any mismatch.
    return {
      schemaVersion: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
      candidateId: 'RELATIONSHIP_GRAPH',
      graphAuthority: createSourceRelationshipGraphAuthority(
        envelope.result.payload.data.directionality
      ),
      ...decision,
    };
  }

  return null;
}

function validateReadyEnvelope(
  envelope: SemanticDetailEnvelopeV1,
  request: SemanticDetailRequestV1,
  generation: number
): string | null {
  if (envelope.schemaVersion !== SEMANTIC_DETAIL_SCHEMA_VERSION) return 'detail schema mismatch';
  if (envelope.generation !== generation) return 'stale detail generation';
  if (
    envelope.request.target.datasetFingerprint !== request.target.datasetFingerprint ||
    envelope.request.target.decisionId !== request.target.decisionId ||
    envelope.request.target.representationFamily !== request.target.representationFamily ||
    envelope.request.target.semanticObjectId !== request.target.semanticObjectId ||
    envelope.request.limit !== request.limit ||
    envelope.request.offset !== request.offset
  ) {
    return 'detail request identity mismatch';
  }
  if (envelope.result.status !== 'READY') return null;

  const result = envelope.result;
  if (
    !Number.isSafeInteger(result.totalMemberCount) ||
    !Number.isSafeInteger(result.returnedCount) ||
    result.totalMemberCount < 0 ||
    result.totalMemberCount > MAX_DETAIL_OBSERVATION_LIMIT_V1 ||
    result.returnedCount < 0 ||
    result.returnedCount > request.limit ||
    result.returnedCount > result.totalMemberCount ||
    result.observationIds.length !== result.returnedCount ||
    new Set(result.observationIds).size !== result.observationIds.length ||
    (result.compactViews !== undefined && result.compactViews.length !== result.returnedCount)
  ) {
    return 'invalid bounded detail result';
  }
  return null;
}

function refusedInspection(observationId: string, reason: string): SemanticDatumInspectionResultV1 {
  return { status: 'REFUSED', observationId, reason };
}

/**
 * Production transition from a dataset-level semantic object to bounded
 * observations and then, on demand, to one exact datum. The selected structure
 * remains the RepresentationSurface selection; detail marks are an overlay,
 * never a replacement representation.
 *
 * This controller intentionally has no dataset registration fallback. A
 * structure can only exist after its semantic embodiment has run against the
 * resident Worker/WASM dataset. If that exact dataset is no longer resident,
 * detail fails closed rather than serialising/rematerialising source rows.
 */
export class SemanticDetailTransition {
  private readonly overlay = new SemanticDetailObservationOverlay();
  private readonly unsubscribe: () => void;
  private readonly snapshotListeners = new Set<SemanticDetailTransitionListener>();
  private requestToken = 0;
  private activeParent: SemanticSelectionIdentity | null = null;
  private activeContext: ActiveDetailContext | null = null;
  private snapshotValue: SemanticDetailTransitionSnapshot = {
    status: 'IDLE',
    parent: null,
    returnedCount: 0,
    totalMemberCount: 0,
    observationIds: [],
    refusalReason: null,
  };

  constructor(
    private readonly surface: RepresentationSurface,
    private readonly authority: SemanticDetailAuthority
  ) {
    this.unsubscribe = surface.subscribeSelection((mesh) => this.handleSelection(mesh));
  }

  get snapshot(): SemanticDetailTransitionSnapshot {
    return this.snapshotValue;
  }

  subscribe(listener: SemanticDetailTransitionListener): () => void {
    this.snapshotListeners.add(listener);
    listener(this.snapshotValue);
    return () => this.snapshotListeners.delete(listener);
  }

  clear(): void {
    this.requestToken += 1;
    this.overlay.clear();
    this.activeParent = null;
    this.activeContext = null;
    this.updateSnapshot({
      status: 'IDLE',
      parent: null,
      returnedCount: 0,
      totalMemberCount: 0,
      observationIds: [],
      refusalReason: null,
    });
  }

  dispose(): void {
    this.unsubscribe();
    this.clear();
    this.snapshotListeners.clear();
  }

  /**
   * Retrieve one exact datum from the resident Rust/Worker authority. The
   * requested observation must be present in the current bounded membership
   * page. A second semantic-detail query with limit=1 is issued at its exact
   * authoritative offset; cached compact row maps from the overview request are
   * deliberately ignored.
   */
  async inspectObservation(observationId: string): Promise<SemanticDatumInspectionResultV1> {
    const context = this.activeContext;
    if (!context || this.snapshotValue.status !== 'READY') {
      return refusedInspection(observationId, 'no active bounded semantic detail');
    }

    const pageOffset = this.snapshotValue.observationIds.indexOf(observationId);
    if (pageOffset < 0) {
      return refusedInspection(observationId, 'observation is not in the active bounded detail page');
    }
    const exactOffset = context.request.offset + pageOffset;

    const port = this.authority.executionPort;
    if (!port?.isAsync || port.hasRegisteredDataset?.(context.generation, context.fingerprint) !== true) {
      return refusedInspection(observationId, 'authoritative dataset is not resident in the analytical Worker');
    }

    if (
      this.authority.generation !== context.generation ||
      this.authority.datasetVersion !== context.version ||
      this.authority.datasetFingerprint !== context.fingerprint ||
      this.surface.currentNode !== context.node ||
      !sameIdentity(this.surface.getSelectedSemanticIdentity(), context.parent)
    ) {
      return refusedInspection(observationId, 'semantic datum inspection context is stale');
    }

    const request: SemanticDetailRequestV1 = {
      ...context.request,
      limit: 1,
      offset: exactOffset,
      investigationContext: `${this.authority.sessionId}: inspect exact datum ${observationId} from ${context.parent.semanticId}`,
    };

    try {
      const result = await port.execute<SemanticDetailEnvelopeV1>({
        requestId: `semantic-datum-${context.generation}-${context.version}-${++detailRequestSequence}`,
        operation: 'semanticDetail',
        dataset: { fingerprint: context.fingerprint, version: context.version },
        generation: context.generation,
        params: {
          request,
          embodimentRequest: context.embodimentRequest,
        },
      });

      if (
        this.authority.generation !== context.generation ||
        this.authority.datasetVersion !== context.version ||
        this.authority.datasetFingerprint !== context.fingerprint ||
        this.activeContext !== context ||
        this.surface.currentNode !== context.node ||
        !sameIdentity(this.surface.getSelectedSemanticIdentity(), context.parent) ||
        result.generation !== context.generation ||
        result.datasetVersion !== context.version ||
        result.datasetFingerprint !== context.fingerprint ||
        result.error ||
        !result.value
      ) {
        return refusedInspection(observationId, 'semantic datum inspection became stale or failed');
      }

      const invalid = validateReadyEnvelope(result.value, request, context.generation);
      if (invalid) return refusedInspection(observationId, invalid);
      if (result.value.result.status === 'REFUSED') {
        return refusedInspection(observationId, result.value.result.refusal.message);
      }

      const exact = result.value.result;
      if (
        exact.returnedCount !== 1 ||
        exact.observationIds.length !== 1 ||
        exact.observationIds[0] !== observationId ||
        exact.compactViews?.length !== 1
      ) {
        return refusedInspection(observationId, 'exact datum query did not return the selected observation');
      }

      const fields = exact.compactViews[0];
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
        return refusedInspection(observationId, 'exact datum values are unavailable');
      }

      return {
        status: 'READY',
        observationId,
        fields: structuredClone(fields),
        lineage: {
          datasetFingerprint: context.fingerprint,
          observationId,
          decisionId: context.request.target.decisionId,
          representationFamily: context.request.target.representationFamily,
          semanticObjectId: context.request.target.semanticObjectId,
          generation: context.generation,
          datasetVersion: context.version,
          investigationContext: request.investigationContext,
          kernelVersion: context.envelope.provenance.kernelVersion,
          algorithmVersion: context.envelope.provenance.algorithmVersion,
          decisionModelVersion: context.envelope.provenance.decisionModelVersion ?? null,
          decisionModelArtifactHash: context.envelope.provenance.decisionModelArtifactHash ?? null,
        },
        sourceProvenance: {
          status: 'UNAVAILABLE',
          reason:
            'The resident dataset provides stable observation identity but no governed per-row source provenance record.',
        },
      };
    } catch {
      return refusedInspection(observationId, 'semantic datum inspection request failed');
    }
  }

  private updateSnapshot(snapshot: SemanticDetailTransitionSnapshot): void {
    this.snapshotValue = snapshot;
    for (const listener of this.snapshotListeners) listener(snapshot);
  }

  private refuse(parent: SemanticSelectionIdentity | null, reason: string): void {
    this.overlay.clear();
    this.activeParent = null;
    this.activeContext = null;
    this.updateSnapshot({
      status: 'REFUSED',
      parent,
      returnedCount: 0,
      totalMemberCount: 0,
      observationIds: [],
      refusalReason: reason,
    });
  }

  private handleSelection(mesh: Mesh | null): void {
    const identity = this.surface.getSelectedSemanticIdentity();
    if (!mesh || !identity) {
      this.clear();
      return;
    }

    // Re-selecting the containing structure remains a secondary reverse path.
    if (sameIdentity(identity, this.activeParent) && this.snapshotValue.status === 'READY') {
      this.clear();
      return;
    }

    const node = this.surface.currentNode;
    if (!node?.artifact?.nodeMeshes.includes(mesh)) {
      this.refuse(identity, 'selected target is not part of the current representation');
      return;
    }

    const envelope = currentEnvelope(node);
    const currentDecisionId = node.representationDecision?.id ?? null;
    const fingerprint = this.authority.datasetFingerprint;
    if (
      !envelope ||
      envelope.result.status !== 'READY' ||
      !fingerprint ||
      envelope.datasetFingerprint !== fingerprint ||
      !currentDecisionId ||
      envelope.provenance.decisionId !== currentDecisionId
    ) {
      this.refuse(identity, 'semantic target has no current authoritative embodiment');
      return;
    }

    const embodimentRequest = detailEmbodimentRequest(envelope, identity.semanticId);
    if (!embodimentRequest) {
      this.refuse(identity, 'selected semantic element does not support bounded membership');
      return;
    }

    const port = this.authority.executionPort;
    const generation = this.authority.generation;
    const version = this.authority.datasetVersion;
    if (!port?.isAsync || port.hasRegisteredDataset?.(generation, fingerprint) !== true) {
      this.refuse(identity, 'authoritative dataset is not resident in the analytical Worker');
      return;
    }

    const request: SemanticDetailRequestV1 = {
      schemaVersion: SEMANTIC_DETAIL_SCHEMA_VERSION,
      target: {
        datasetFingerprint: fingerprint,
        decisionId: currentDecisionId,
        representationFamily: envelope.representationFamily,
        semanticObjectId: identity.semanticId,
      },
      limit: SEMANTIC_DETAIL_PRODUCT_PAGE_LIMIT_V1,
      offset: 0,
      investigationContext: `${this.authority.sessionId}: reveal bounded observations for ${identity.semanticId}`,
    };
    const token = ++this.requestToken;
    this.overlay.clear();
    this.activeParent = identity;
    this.activeContext = {
      parent: identity,
      node,
      envelope,
      embodimentRequest,
      request,
      generation,
      version,
      fingerprint,
    };
    this.updateSnapshot({
      status: 'PENDING',
      parent: identity,
      returnedCount: 0,
      totalMemberCount: 0,
      observationIds: [],
      refusalReason: null,
    });

    void port
      .execute<SemanticDetailEnvelopeV1>({
        requestId: `semantic-detail-${generation}-${version}-${++detailRequestSequence}`,
        operation: 'semanticDetail',
        dataset: { fingerprint, version },
        generation,
        params: {
          request,
          embodimentRequest,
        },
      })
      .then((result) => {
        if (token !== this.requestToken) return;
        if (
          this.authority.generation !== generation ||
          this.authority.datasetVersion !== version ||
          this.authority.datasetFingerprint !== fingerprint ||
          result.generation !== generation ||
          result.datasetVersion !== version ||
          result.datasetFingerprint !== fingerprint ||
          result.error ||
          !result.value
        ) {
          this.refuse(identity, 'semantic detail request became stale or failed');
          return;
        }

        const invalid = validateReadyEnvelope(result.value, request, generation);
        if (invalid) {
          this.refuse(identity, invalid);
          return;
        }
        if (result.value.result.status === 'REFUSED') {
          this.refuse(identity, result.value.result.refusal.message);
          return;
        }

        const selectedNow = this.surface.getSelectedSemanticIdentity();
        const nodeNow = this.surface.currentNode;
        if (
          !sameIdentity(selectedNow, identity) ||
          nodeNow !== node ||
          !nodeNow?.group ||
          nodeNow.representationDecision?.id !== currentDecisionId
        ) {
          this.refuse(identity, 'semantic detail target changed before presentation');
          return;
        }

        this.overlay.show(nodeNow.group, mesh, result.value);
        this.updateSnapshot({
          status: 'READY',
          parent: identity,
          returnedCount: result.value.result.returnedCount,
          totalMemberCount: result.value.result.totalMemberCount,
          observationIds: [...result.value.result.observationIds],
          refusalReason: null,
        });
      })
      .catch(() => {
        if (token === this.requestToken) {
          this.refuse(identity, 'semantic detail request failed');
        }
      });
  }
}

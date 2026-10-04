import { canonicalSha256Hex } from '../../security/CryptoHash.js';
import {
  type DirectEmbodimentCompileResult,
  type GovernedPhenomenonKind,
} from './DirectEmbodimentCompiler.ts';
import type { SemanticEmbodimentFamilyV1 } from './SemanticEmbodimentPayload.ts';
import {
  MAX_DETAIL_OBSERVATION_LIMIT_V1,
  SEMANTIC_DETAIL_SCHEMA_VERSION,
  type SemanticDetailEnvelopeV1,
  type SemanticDetailRequestV1,
} from './SemanticDrillDown.ts';

export const DIRECT_TRAVERSAL_SCHEMA_VERSION = '1.0.0' as const;

/**
 * Product page cap for one direct-traversal subset page. Mirrors the
 * production bounded-detail page limit without depending on the app layer;
 * representation must not import presentation controllers.
 */
export const DIRECT_TRAVERSAL_PAGE_LIMIT_V1 = 256 as const;

export type DetailFamilyForPhenomenon = SemanticEmbodimentFamilyV1;

const PHENOMENON_DETAIL_FAMILY: Record<GovernedPhenomenonKind, DetailFamilyForPhenomenon> = {
  DISTRIBUTION: 'DISTRIBUTION',
  TOPOLOGICAL_CLUSTERING: 'CLUSTER',
};

/**
 * Caller-established drill-down authority. The analytical runtime retains
 * embodiment authority per (dataset, family, decision) when a governed
 * builder runs; a direct compilation does not establish it by itself. The
 * session binds to that authority explicitly and the runtime refuses closed
 * when it is absent — membership is never derived in TypeScript.
 */
export interface EstablishedDetailAuthorityV1 {
  readonly datasetFingerprint: string;
  readonly representationFamily: SemanticEmbodimentFamilyV1;
  readonly decisionId: string;
  readonly generation: number;
  readonly datasetVersion: number;
}

/**
 * Minimal structural port for the `semanticDetail` operation. The production
 * `AnalyticalExecutionPort` satisfies this interface; tests supply fakes.
 */
export interface DirectTraversalPort {
  readonly isAsync: boolean;
  hasRegisteredDataset?(generation: number, fingerprint: string): boolean;
  execute<T>(req: {
    readonly requestId: string;
    readonly operation: 'semanticDetail';
    readonly dataset: { readonly fingerprint: string; readonly version: number };
    readonly generation: number;
    readonly params: {
      readonly request: SemanticDetailRequestV1;
      readonly embodimentRequest: null;
    };
  }): Promise<{
    readonly generation: number;
    readonly datasetVersion: number;
    readonly datasetFingerprint: string;
    readonly error?: string;
    readonly value: T | null;
  }>;
}

export interface DirectTraversalBindingV1 {
  readonly traversalId: string;
  readonly datasetFingerprint: string;
  readonly snapshotId: string;
  readonly directDecisionId: string;
  readonly detailDecisionId: string;
  readonly representationFamily: SemanticEmbodimentFamilyV1;
  readonly contextId: string;
  readonly planElementId: string;
  readonly semanticNodeId: string;
  readonly phenomenon: GovernedPhenomenonKind;
  readonly isConjectural: boolean;
}

export interface DirectSubsetPageV1 {
  readonly pageId: string;
  readonly traversalId: string;
  readonly limit: number;
  readonly offset: number;
  readonly totalMemberCount: number;
  readonly returnedCount: number;
  readonly observationIds: readonly string[];
  readonly isConjectural: boolean;
}

export interface DirectObservationDatumV1 {
  readonly observationId: string;
  readonly traversalId: string;
  readonly fields: Readonly<Record<string, unknown>>;
  readonly isConjectural: boolean;
  readonly lineage: {
    readonly datasetFingerprint: string;
    readonly observationId: string;
    readonly directDecisionId: string;
    readonly detailDecisionId: string;
    readonly representationFamily: SemanticEmbodimentFamilyV1;
    readonly semanticObjectId: string;
    readonly generation: number;
    readonly datasetVersion: number;
    readonly traversalId: string;
    readonly isConjectural: boolean;
    readonly investigationContext: string;
  };
}

export type DirectTraversalLevel = 'STRUCTURE' | 'SUBSET' | 'OBSERVATION';

export type DirectTraversalRefusalCode =
  | 'UNKNOWN_PLAN_ELEMENT'
  | 'DETAIL_AUTHORITY_MISMATCH'
  | 'UNSUPPORTED_PHENOMENON_FAMILY'
  | 'NO_EXECUTION_PORT'
  | 'DATASET_NOT_RESIDENT'
  | 'STALE_TRAVERSAL_GENERATION'
  | 'PAGE_LIMIT_EXCEEDED'
  | 'INVALID_PAGE_WINDOW'
  | 'DETAIL_REFUSED'
  | 'DETAIL_IDENTITY_MISMATCH'
  | 'OBSERVATION_NOT_IN_PAGE'
  | 'NO_ACTIVE_SUBSET'
  | 'REBUILD_IDENTITY_MISMATCH'
  | 'UNKNOWN_RECONSTRUCTION_TOKEN';

export type DirectTraversalOutcome<T> =
  | { readonly status: 'READY'; readonly value: T }
  | {
      readonly status: 'REFUSED';
      readonly code: DirectTraversalRefusalCode;
      readonly message: string;
    };

interface PageReconstructionDescriptor {
  readonly token: string;
  readonly limit: number;
  readonly offset: number;
  readonly expectedObservationIds: readonly string[];
}

let directTraversalRequestSequence = 0;

function refused<T>(code: DirectTraversalRefusalCode, message: string): DirectTraversalOutcome<T> {
  return { status: 'REFUSED', code, message };
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

/**
 * DSE2: reversible dataset -> structure -> subset -> observation traversal
 * over a DSE1 direct compilation. Structure is a compiled plan element;
 * subset and observation members resolve only through the resident analytical
 * authority. Eviction drops materialised pages while retaining reconstruction
 * descriptors; rebuild accepts only identical observation identity.
 */
export class DirectTraversalSession {
  private navigation: DirectTraversalLevel[] = ['STRUCTURE'];
  private activePage: DirectSubsetPageV1 | null = null;
  private activeObservation: DirectObservationDatumV1 | null = null;
  private reconstructions = new Map<string, PageReconstructionDescriptor>();

  private constructor(
    private readonly bindingValue: DirectTraversalBindingV1,
    private readonly authorityValue: EstablishedDetailAuthorityV1,
    private readonly semanticObjectIdValue: string
  ) {}

  static open(
    compilation: DirectEmbodimentCompileResult,
    planElementId: string,
    phenomenon: GovernedPhenomenonKind,
    detailAuthority: EstablishedDetailAuthorityV1
  ): DirectTraversalOutcome<DirectTraversalSession> {
    const element = compilation.plan.elements.find((e) => e.id === planElementId);
    if (!element) {
      return refused(
        'UNKNOWN_PLAN_ELEMENT',
        `[DirectTraversal] Plan element '${planElementId}' is not in compilation ${compilation.compilationId}`
      );
    }
    if (!compilation.boundedOverview.phenomenonCoverage.includes(phenomenon)) {
      return refused(
        'UNSUPPORTED_PHENOMENON_FAMILY',
        `[DirectTraversal] Phenomenon '${phenomenon}' is not in the compiled phenomenon coverage`
      );
    }
    const expectedFamily = PHENOMENON_DETAIL_FAMILY[phenomenon];
    if (
      detailAuthority.datasetFingerprint !== compilation.plan.datasetFingerprint ||
      detailAuthority.representationFamily !== expectedFamily
    ) {
      return refused(
        'DETAIL_AUTHORITY_MISMATCH',
        '[DirectTraversal] Detail authority does not match the compiled dataset and phenomenon family'
      );
    }

    const traversalId = `traversal-direct-${canonicalSha256Hex({
      directDecisionId: compilation.plan.decisionId,
      planElementId,
      detailDecisionId: detailAuthority.decisionId,
      datasetFingerprint: compilation.plan.datasetFingerprint,
    }).slice(0, 16)}`;

    return {
      status: 'READY',
      value: new DirectTraversalSession(
        {
          traversalId,
          datasetFingerprint: compilation.plan.datasetFingerprint,
          snapshotId: compilation.plan.semanticGraphId,
          directDecisionId: compilation.plan.decisionId,
          detailDecisionId: detailAuthority.decisionId,
          representationFamily: expectedFamily,
          contextId: compilation.admittedVariant.contextId,
          planElementId,
          semanticNodeId: element.semanticNodeId,
          phenomenon,
          isConjectural: Boolean(element.parameters.isConjectural),
        },
        detailAuthority,
        `direct:${planElementId}`
      ),
    };
  }

  get binding(): DirectTraversalBindingV1 {
    return this.bindingValue;
  }

  get navigationDepth(): number {
    return this.navigation.length;
  }

  get currentLevel(): DirectTraversalLevel {
    return this.navigation[this.navigation.length - 1] ?? 'STRUCTURE';
  }

  get currentPage(): DirectSubsetPageV1 | null {
    return this.activePage;
  }

  get currentObservation(): DirectObservationDatumV1 | null {
    return this.activeObservation;
  }

  private buildRequest(limit: number, offset: number): SemanticDetailRequestV1 {
    return {
      schemaVersion: SEMANTIC_DETAIL_SCHEMA_VERSION,
      target: {
        datasetFingerprint: this.bindingValue.datasetFingerprint,
        decisionId: this.authorityValue.decisionId,
        representationFamily: this.bindingValue.representationFamily,
        semanticObjectId: this.semanticObjectIdValue,
      },
      limit,
      offset,
      investigationContext: `${this.bindingValue.contextId}: direct traversal ${this.bindingValue.traversalId} page`,
    };
  }

  private checkResidency(port: DirectTraversalPort | null): DirectTraversalRefusalCode | null {
    if (!port) return 'NO_EXECUTION_PORT';
    if (
      !port.isAsync ||
      port.hasRegisteredDataset?.(
        this.authorityValue.generation,
        this.bindingValue.datasetFingerprint
      ) !== true
    ) {
      return 'DATASET_NOT_RESIDENT';
    }
    return null;
  }

  private async executeDetail(
    port: DirectTraversalPort,
    request: SemanticDetailRequestV1
  ): Promise<DirectTraversalOutcome<SemanticDetailEnvelopeV1>> {
    let result: {
      readonly generation: number;
      readonly datasetVersion: number;
      readonly datasetFingerprint: string;
      readonly error?: string;
      readonly value: SemanticDetailEnvelopeV1 | null;
    };
    try {
      result = await port.execute<SemanticDetailEnvelopeV1>({
        requestId: `direct-traversal-${this.authorityValue.generation}-${this.authorityValue.datasetVersion}-${++directTraversalRequestSequence}`,
        operation: 'semanticDetail',
        dataset: {
          fingerprint: this.bindingValue.datasetFingerprint,
          version: this.authorityValue.datasetVersion,
        },
        generation: this.authorityValue.generation,
        params: { request, embodimentRequest: null },
      });
    } catch {
      return refused('DETAIL_REFUSED', '[DirectTraversal] Semantic detail request failed');
    }

    if (
      result.generation !== this.authorityValue.generation ||
      result.datasetVersion !== this.authorityValue.datasetVersion ||
      result.datasetFingerprint !== this.bindingValue.datasetFingerprint ||
      result.error ||
      !result.value
    ) {
      return refused(
        'STALE_TRAVERSAL_GENERATION',
        '[DirectTraversal] Semantic detail response is stale or failed'
      );
    }

    const invalid = validateReadyEnvelope(result.value, request, this.authorityValue.generation);
    if (invalid) {
      return refused('DETAIL_IDENTITY_MISMATCH', `[DirectTraversal] ${invalid}`);
    }
    if (result.value.result.status === 'REFUSED') {
      return refused(
        'DETAIL_REFUSED',
        `[DirectTraversal] Analytical authority refused: ${result.value.result.refusal.message}`
      );
    }
    return { status: 'READY', value: result.value };
  }

  private adoptPage(
    envelope: SemanticDetailEnvelopeV1,
    limit: number,
    offset: number
  ): DirectSubsetPageV1 {
    const ready = envelope.result;
    if (ready.status !== 'READY') {
      throw new Error('[DirectTraversal] adoptPage requires a READY envelope');
    }
    const pageId = `page-direct-${canonicalSha256Hex({
      traversalId: this.bindingValue.traversalId,
      limit,
      offset,
      observationIds: ready.observationIds,
    }).slice(0, 16)}`;
    return {
      pageId,
      traversalId: this.bindingValue.traversalId,
      limit,
      offset,
      totalMemberCount: ready.totalMemberCount,
      returnedCount: ready.returnedCount,
      observationIds: [...ready.observationIds],
      isConjectural: this.bindingValue.isConjectural,
    };
  }

  async requestSubsetPage(
    port: DirectTraversalPort | null,
    limit: number,
    offset: number
  ): Promise<DirectTraversalOutcome<DirectSubsetPageV1>> {
    const residency = this.checkResidency(port);
    if (residency) {
      return refused(
        residency,
        '[DirectTraversal] Analytical dataset is not resident for traversal'
      );
    }
    if (!Number.isSafeInteger(limit) || limit <= 0 || limit > DIRECT_TRAVERSAL_PAGE_LIMIT_V1) {
      return refused(
        'PAGE_LIMIT_EXCEEDED',
        `[DirectTraversal] Page limit must be within 1..${DIRECT_TRAVERSAL_PAGE_LIMIT_V1}`
      );
    }
    if (!Number.isSafeInteger(offset) || offset < 0) {
      return refused(
        'INVALID_PAGE_WINDOW',
        '[DirectTraversal] Page offset must be a non-negative integer'
      );
    }

    const request = this.buildRequest(limit, offset);
    const outcome = await this.executeDetail(port as DirectTraversalPort, request);
    if (outcome.status === 'REFUSED') return outcome;

    const page = this.adoptPage(outcome.value, limit, offset);
    this.activePage = page;
    this.activeObservation = null;
    this.navigation = ['STRUCTURE', 'SUBSET'];
    return { status: 'READY', value: page };
  }

  async inspectObservation(
    port: DirectTraversalPort | null,
    observationId: string
  ): Promise<DirectTraversalOutcome<DirectObservationDatumV1>> {
    const page = this.activePage;
    if (!page || this.currentLevel !== 'SUBSET') {
      return refused(
        'NO_ACTIVE_SUBSET',
        '[DirectTraversal] No active bounded subset page to inspect'
      );
    }
    const pageOffset = page.observationIds.indexOf(observationId);
    if (pageOffset < 0) {
      return refused(
        'OBSERVATION_NOT_IN_PAGE',
        '[DirectTraversal] Observation is not in the active bounded detail page'
      );
    }
    const residency = this.checkResidency(port);
    if (residency) {
      return refused(
        residency,
        '[DirectTraversal] Analytical dataset is not resident for inspection'
      );
    }

    const request: SemanticDetailRequestV1 = {
      ...this.buildRequest(page.limit, page.offset),
      limit: 1,
      offset: page.offset + pageOffset,
      investigationContext: `${this.bindingValue.contextId}: direct traversal ${this.bindingValue.traversalId} inspect ${observationId}`,
    };
    const outcome = await this.executeDetail(port as DirectTraversalPort, request);
    if (outcome.status === 'REFUSED') return outcome;

    const exact = outcome.value.result;
    if (
      exact.status !== 'READY' ||
      exact.returnedCount !== 1 ||
      exact.observationIds.length !== 1 ||
      exact.observationIds[0] !== observationId ||
      exact.compactViews?.length !== 1
    ) {
      return refused(
        'DETAIL_IDENTITY_MISMATCH',
        '[DirectTraversal] Exact datum query did not return the selected observation'
      );
    }
    const fields = exact.compactViews[0];
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      return refused(
        'DETAIL_IDENTITY_MISMATCH',
        '[DirectTraversal] Exact datum values are unavailable'
      );
    }

    const datum: DirectObservationDatumV1 = {
      observationId,
      traversalId: this.bindingValue.traversalId,
      fields: structuredClone(fields),
      isConjectural: this.bindingValue.isConjectural,
      lineage: {
        datasetFingerprint: this.bindingValue.datasetFingerprint,
        observationId,
        directDecisionId: this.bindingValue.directDecisionId,
        detailDecisionId: this.bindingValue.detailDecisionId,
        representationFamily: this.bindingValue.representationFamily,
        semanticObjectId: this.semanticObjectIdValue,
        generation: this.authorityValue.generation,
        datasetVersion: this.authorityValue.datasetVersion,
        traversalId: this.bindingValue.traversalId,
        isConjectural: this.bindingValue.isConjectural,
        investigationContext: request.investigationContext,
      },
    };
    this.activeObservation = datum;
    this.navigation = ['STRUCTURE', 'SUBSET', 'OBSERVATION'];
    return { status: 'READY', value: datum };
  }

  /**
   * Reversible return: pops one navigation level and restores the parent.
   * Returning from SUBSET clears the materialised page; post-return
   * inspection is refused until the page is requested again.
   */
  returnToParent(): DirectTraversalLevel {
    if (this.navigation.length <= 1) {
      this.navigation = ['STRUCTURE'];
      return 'STRUCTURE';
    }
    this.navigation = this.navigation.slice(0, -1);
    if (this.currentLevel === 'SUBSET') {
      this.activeObservation = null;
    } else {
      this.activePage = null;
      this.activeObservation = null;
    }
    return this.currentLevel;
  }

  /**
   * Evicts materialised pages while retaining reconstruction descriptors.
   * Traversal identity survives; page contents do not.
   */
  evictMaterialisedPages(): readonly string[] {
    const tokens: string[] = [];
    if (this.activePage) {
      const page = this.activePage;
      const token = `rebuild-${canonicalSha256Hex({
        traversalId: this.bindingValue.traversalId,
        limit: page.limit,
        offset: page.offset,
        generation: this.authorityValue.generation,
      }).slice(0, 16)}`;
      this.reconstructions.set(token, {
        token,
        limit: page.limit,
        offset: page.offset,
        expectedObservationIds: [...page.observationIds],
      });
      tokens.push(token);
    }
    this.activePage = null;
    this.activeObservation = null;
    this.navigation = ['STRUCTURE'];
    return tokens;
  }

  /**
   * Rebuilds an evicted page by re-issuing the identical analytical request.
   * Accepts only byte-identical observation identity, else fails closed.
   */
  async rebuildPage(
    port: DirectTraversalPort | null,
    token: string
  ): Promise<DirectTraversalOutcome<DirectSubsetPageV1>> {
    const descriptor = this.reconstructions.get(token);
    if (!descriptor) {
      return refused(
        'UNKNOWN_RECONSTRUCTION_TOKEN',
        '[DirectTraversal] No reconstruction descriptor for token'
      );
    }
    const residency = this.checkResidency(port);
    if (residency) {
      return refused(residency, '[DirectTraversal] Analytical dataset is not resident for rebuild');
    }

    const request = this.buildRequest(descriptor.limit, descriptor.offset);
    const outcome = await this.executeDetail(port as DirectTraversalPort, request);
    if (outcome.status === 'REFUSED') return outcome;

    const page = this.adoptPage(outcome.value, descriptor.limit, descriptor.offset);
    if (
      page.observationIds.length !== descriptor.expectedObservationIds.length ||
      !page.observationIds.every((id, idx) => id === descriptor.expectedObservationIds[idx])
    ) {
      return refused(
        'REBUILD_IDENTITY_MISMATCH',
        '[DirectTraversal] Rebuilt page identity differs from the evicted page'
      );
    }
    this.activePage = page;
    this.activeObservation = null;
    this.navigation = ['STRUCTURE', 'SUBSET'];
    return { status: 'READY', value: page };
  }
}

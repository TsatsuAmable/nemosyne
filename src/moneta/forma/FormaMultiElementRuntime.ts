import { canonicalSha256Hex } from '../../security/CryptoHash.js';
import type { FormaCompiledSliceV1, SpatialElementV1 } from './FormaSpatialCompiler.js';

export const FORMA_MULTI_ELEMENT_RUNTIME_SCHEMA_VERSION = 1 as const;

export type ElementLifecycleState = 'RESIDENT' | 'COOLED' | 'EVICTED';

export type CompositionRelationship = 'OVERLAY' | 'COORDINATES_WITH' | 'DETAIL_OF';

export interface RuntimeElementRecordV1 {
  readonly elementId: string;
  readonly sliceId: string;
  readonly snapshotId: string;
  readonly contextId: string;
  readonly phenomenonFamily: string;
  lifecycleState: ElementLifecycleState;
  generation: number;
  spatialElements: readonly SpatialElementV1[];
}

export interface ComposedRepresentationStateV1 {
  readonly schemaVersion: typeof FORMA_MULTI_ELEMENT_RUNTIME_SCHEMA_VERSION;
  readonly composedIdentity: string;
  readonly elements: readonly RuntimeElementRecordV1[];
  readonly relationships: readonly {
    readonly sourceElementId: string;
    readonly targetElementId: string;
    readonly relationship: CompositionRelationship;
  }[];
}

export interface SelectionResultV1 {
  readonly selectedElementId: string;
  readonly semanticNodeId: string;
  readonly channel: string;
}

/**
 * Multi-element runtime managing coexistence, independent lifecycle (cooling/eviction/reconstruction),
 * and semantic-id selection for composed Moneta Forma representations.
 */
export class FormaMultiElementRuntime {
  private readonly elements: Map<string, RuntimeElementRecordV1> = new Map();
  private readonly relationships: {
    sourceElementId: string;
    targetElementId: string;
    relationship: CompositionRelationship;
  }[] = [];
  private activeSelection: SelectionResultV1 | null = null;

  /**
   * Admits and registers a compiled slice as an active resident element.
   */
  public registerElement(
    elementId: string,
    slice: FormaCompiledSliceV1,
    phenomenonFamily: string,
  ): RuntimeElementRecordV1 {
    if (this.elements.has(elementId)) {
      throw new Error(`Element ${elementId} already registered in multi-element runtime`);
    }

    const record: RuntimeElementRecordV1 = {
      elementId,
      sliceId: slice.sliceId,
      snapshotId: slice.snapshotId,
      contextId: slice.contextId,
      phenomenonFamily,
      lifecycleState: 'RESIDENT',
      generation: 1,
      spatialElements: [...slice.elements],
    };

    this.elements.set(elementId, record);
    return record;
  }

  /**
   * Declares a structural/semantic relationship between two registered elements.
   */
  public addRelationship(
    sourceElementId: string,
    targetElementId: string,
    relationship: CompositionRelationship,
  ): void {
    if (!this.elements.has(sourceElementId)) {
      throw new Error(`Source element ${sourceElementId} not found`);
    }
    if (!this.elements.has(targetElementId)) {
      throw new Error(`Target element ${targetElementId} not found`);
    }

    this.relationships.push({
      sourceElementId,
      targetElementId,
      relationship,
    });
  }

  /**
   * Cools an element, keeping its metadata intact while releasing spatial geometry.
   * Does not destroy or re-interpret sibling elements.
   */
  public coolElement(elementId: string): void {
    const record = this.elements.get(elementId);
    if (!record) {
      throw new Error(`Element ${elementId} not found`);
    }

    record.lifecycleState = 'COOLED';
    record.spatialElements = [];
  }

  /**
   * Evicts an element completely, advancing its generation to invalidate stale adoption.
   */
  public evictElement(elementId: string): void {
    const record = this.elements.get(elementId);
    if (!record) {
      throw new Error(`Element ${elementId} not found`);
    }

    record.lifecycleState = 'EVICTED';
    record.generation += 1;
    record.spatialElements = [];
  }

  /**
   * Reconstructs a cooled or evicted element using a freshly compiled slice.
   * Refuses closed if expected generation is stale.
   */
  public reconstructElement(
    elementId: string,
    slice: FormaCompiledSliceV1,
    expectedGeneration: number,
  ): void {
    const record = this.elements.get(elementId);
    if (!record) {
      throw new Error(`Element ${elementId} not found`);
    }

    if (record.generation !== expectedGeneration) {
      throw new Error(
        `STALE_GENERATION_REFUSAL: expected generation ${expectedGeneration}, but runtime is at ${record.generation}`,
      );
    }

    if (slice.sliceId !== record.sliceId) {
      throw new Error(
        `SLICE_IDENTITY_MISMATCH: sliceId ${slice.sliceId} does not match registered sliceId ${record.sliceId}`,
      );
    }

    record.lifecycleState = 'RESIDENT';
    record.spatialElements = [...slice.elements];
  }

  /**
   * Selects an element by semantic node ID, rather than transient mesh index.
   */
  public selectBySemanticId(elementId: string, semanticNodeId: string): SelectionResultV1 {
    const record = this.elements.get(elementId);
    if (!record) {
      throw new Error(`Element ${elementId} not found`);
    }

    if (record.lifecycleState !== 'RESIDENT') {
      throw new Error(`Cannot select element ${elementId} in ${record.lifecycleState} state`);
    }

    const spatialElem = record.spatialElements.find((e) => e.semanticNodeId === semanticNodeId);
    if (!spatialElem) {
      throw new Error(`Semantic node ${semanticNodeId} not found in element ${elementId}`);
    }

    const result: SelectionResultV1 = {
      selectedElementId: elementId,
      semanticNodeId,
      channel: spatialElem.channel,
    };

    this.activeSelection = result;
    return result;
  }

  public getActiveSelection(): SelectionResultV1 | null {
    return this.activeSelection;
  }

  public getElement(elementId: string): RuntimeElementRecordV1 | undefined {
    return this.elements.get(elementId);
  }

  public getAllElements(): readonly RuntimeElementRecordV1[] {
    return Array.from(this.elements.values());
  }

  /**
   * Computes the deterministic composed representation identity.
   * Remains invariant across non-destructive lifecycle changes (e.g. cooling) of constituent elements.
   */
  public computeComposedIdentity(): string {
    const elementsSummary = Array.from(this.elements.values())
      .map((e) => ({
        elementId: e.elementId,
        sliceId: e.sliceId,
        snapshotId: e.snapshotId,
        contextId: e.contextId,
        phenomenonFamily: e.phenomenonFamily,
      }))
      .sort((a, b) => a.elementId.localeCompare(b.elementId));

    const relationshipsSummary = [...this.relationships].sort((a, b) =>
      `${a.sourceElementId}:${a.targetElementId}`.localeCompare(`${b.sourceElementId}:${b.targetElementId}`),
    );

    return `composed-forma-v1:${canonicalSha256Hex({
      elements: elementsSummary,
      relationships: relationshipsSummary,
    })}`;
  }

  /**
   * Exports full composed representation state.
   */
  public exportComposedState(): ComposedRepresentationStateV1 {
    return {
      schemaVersion: FORMA_MULTI_ELEMENT_RUNTIME_SCHEMA_VERSION,
      composedIdentity: this.computeComposedIdentity(),
      elements: this.getAllElements(),
      relationships: [...this.relationships],
    };
  }
}

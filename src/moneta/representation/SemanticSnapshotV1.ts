import { canonicalSha256Hex } from '../../security/CryptoHash.js';

export const SEMANTIC_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export type SemanticStateV1 =
  | { readonly status: 'AVAILABLE'; readonly approximation?: { readonly mode: string; readonly representedRowCount: number; readonly description?: string } }
  | { readonly status: 'UNAVAILABLE'; readonly reason: string }
  | { readonly status: 'REFUSED'; readonly owningReason: string };

export interface EvidenceReferenceTupleV1 {
  readonly datasetFingerprint: string;
  readonly kernelVersion: string;
  readonly bundleContentDigest: string;
  readonly receiptId: string;
  readonly receiptContentDigest: string;
  readonly consumerId: string;
  readonly requirementProfileId: string;
  readonly requirementProfileDigest: string;
  readonly admissionPolicyId: string;
  readonly admissionPolicyDigest: string;
}

export interface SemanticCoverageDescriptorV1 {
  readonly family: string;
  readonly analyticalRequestDigest: string;
  readonly status: 'AVAILABLE' | 'UNAVAILABLE' | 'REFUSED';
}

export interface SemanticSourceRecordV1 {
  readonly sourceId: string;
  readonly family: string;
  readonly analyticalRequestIdentity: string;
  readonly method: string;
  readonly methodVersion: string;
  readonly parametersDigest: string;
  readonly seed?: number;
  readonly state: SemanticStateV1;
  readonly analyticalContentRef?: string;
  readonly evidenceReferences: readonly EvidenceReferenceTupleV1[];
  readonly limitations: readonly string[];
}

export interface SemanticNodeDescriptorV1 {
  readonly label: string;
  readonly valueType: 'number' | 'string' | 'boolean' | 'vector' | 'matrix';
  readonly unit?: string;
  readonly frame?: string;
}

export interface SemanticNodeRecordV1 {
  readonly nodeId: string;
  readonly sourceId: string;
  readonly producerSemanticId: string;
  readonly propertyPath: string;
  readonly descriptor: SemanticNodeDescriptorV1;
  readonly value?: unknown;
  readonly state: SemanticStateV1;
}

export interface SemanticRelationRecordV1 {
  readonly relationId: string;
  readonly type: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly sourceId: string;
  readonly descriptor?: Record<string, unknown>;
}

export interface SemanticLimitationRecordV1 {
  readonly code: string;
  readonly sourceId: string;
  readonly description: string;
}

export interface SemanticSnapshotBodyV1 {
  readonly analyticalDatasetFingerprint: string;
  readonly kernelVersion: string;
  readonly semanticVocabulary: {
    readonly id: string;
    readonly version: string;
    readonly digest: string;
  };
  readonly normalizer: {
    readonly id: string;
    readonly version: string;
    readonly digest: string;
  };
  readonly coverage: readonly SemanticCoverageDescriptorV1[];
  readonly sources: readonly SemanticSourceRecordV1[];
  readonly nodes: readonly SemanticNodeRecordV1[];
  readonly relations: readonly SemanticRelationRecordV1[];
  readonly limitations: readonly SemanticLimitationRecordV1[];
}

export interface SemanticSnapshotV1 {
  readonly schemaVersion: typeof SEMANTIC_SNAPSHOT_SCHEMA_VERSION;
  readonly snapshotId: string;
  readonly body: SemanticSnapshotBodyV1;
}

export function taggedDigest(tag: string, body: unknown): string {
  return `${tag}:${canonicalSha256Hex({ tag, body })}`;
}

export function computeSourceId(preimage: Omit<SemanticSourceRecordV1, 'sourceId'>): string {
  return taggedDigest('semantic-source-v1', preimage);
}

export function computeNodeId(sourceId: string, producerSemanticId: string, propertyPath: string): string {
  return taggedDigest('semantic-node-v1', { sourceId, producerSemanticId, propertyPath });
}

export function computeRelationId(
  type: string,
  sourceNodeId: string,
  targetNodeId: string,
  sourceId: string,
): string {
  return taggedDigest('semantic-relation-v1', { type, sourceNodeId, targetNodeId, sourceId });
}

export function computeSnapshotId(body: SemanticSnapshotBodyV1): string {
  return taggedDigest('semantic-snapshot-v1', body);
}

export function validateSemanticSnapshot(snapshot: SemanticSnapshotV1): void {
  if (snapshot.schemaVersion !== 1) {
    throw new Error(`Invalid snapshot schema version: ${snapshot.schemaVersion}`);
  }

  const expectedSnapshotId = computeSnapshotId(snapshot.body);
  if (snapshot.snapshotId !== expectedSnapshotId) {
    throw new Error(`Snapshot ID mismatch: expected ${expectedSnapshotId}, got ${snapshot.snapshotId}`);
  }
}

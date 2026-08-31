import type { SemanticEmbodimentFamilyV1 } from './SemanticEmbodimentPayload.ts';

export const SEMANTIC_DETAIL_SCHEMA_VERSION = 1 as const;
export const MAX_DETAIL_OBSERVATION_LIMIT_V1 = 1000 as const;

export interface SemanticTargetIdentityV1 {
  readonly datasetFingerprint: string;
  readonly decisionId: string;
  readonly representationFamily: SemanticEmbodimentFamilyV1;
  readonly semanticObjectId: string;
}

export interface SemanticDetailRequestV1 {
  readonly schemaVersion: typeof SEMANTIC_DETAIL_SCHEMA_VERSION;
  readonly target: SemanticTargetIdentityV1;
  readonly limit: number;
  readonly offset: number;
  readonly investigationContext: string;
}

export type SemanticDetailErrorCodeV1 =
  | 'STALE_GENERATION'
  | 'DELETED_TARGET'
  | 'CHANGED_DATASET'
  | 'UNSUPPORTED_MEMBERSHIP'
  | 'RESOURCE_LIMIT';

export interface SemanticDetailRefusalV1 {
  readonly code: SemanticDetailErrorCodeV1;
  readonly message: string;
}

export type SemanticDetailResultV1 =
  | {
      readonly status: 'READY';
      readonly totalMemberCount: number;
      readonly returnedCount: number;
      readonly observationIds: readonly string[];
      readonly compactViews?: readonly Record<string, unknown>[];
    }
  | {
      readonly status: 'REFUSED';
      readonly refusal: SemanticDetailRefusalV1;
    };

export interface SemanticDetailEnvelopeV1 {
  readonly schemaVersion: typeof SEMANTIC_DETAIL_SCHEMA_VERSION;
  readonly request: SemanticDetailRequestV1;
  readonly result: SemanticDetailResultV1;
  readonly generation: number;
}

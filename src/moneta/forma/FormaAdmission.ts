import { canonicalSha256Hex } from '../../security/CryptoHash.js';
import type { SemanticSnapshotV1, SemanticSourceRecordV1, SemanticNodeRecordV1 } from '../representation/SemanticSnapshotV1.js';
import type { CommittedInvestigationContextV2 } from '../../atlas/domain/CommittedInvestigationContext.js';

export const FORMA_ADMISSION_SCHEMA_VERSION = 1 as const;

export type PermittedExecutionUse = 'PRODUCTION' | 'STUDY_ONLY' | 'REFUSED';

export interface FormaRefusalV1 {
  readonly code: 'UNTRUSTED_DECODING' | 'UNSUPPORTED_MAPPING' | 'OBLIGATION_UNSATISFIED' | 'POLICY_REFUSAL';
  readonly message: string;
}

export interface FormaReverseMappingV1 {
  readonly semanticNodeId: string;
  readonly channel: string;
  readonly rationale: string;
}

export interface FormaAdmissionResultV1 {
  readonly schemaVersion: typeof FORMA_ADMISSION_SCHEMA_VERSION;
  readonly admissionId: string;
  readonly body: {
    readonly snapshotId: string;
    readonly contextId: string;
    readonly permittedUse: PermittedExecutionUse;
    readonly planId: string;
    readonly reverseExplanation: {
      readonly mappings: readonly FormaReverseMappingV1[];
    };
  };
}

export type FormaAdmissionOutcomeV1 =
  | { readonly status: 'ADMITTED'; readonly result: FormaAdmissionResultV1 }
  | { readonly status: 'REFUSED'; readonly refusal: FormaRefusalV1 };

export function compileFormaAdmission(
  snapshot: SemanticSnapshotV1,
  context: CommittedInvestigationContextV2,
  requestedUse: PermittedExecutionUse = 'PRODUCTION'
): FormaAdmissionOutcomeV1 {
  // Scientific admissibility check: Refused evidence sources refuse admission
  if (snapshot.body.sources.some((s: SemanticSourceRecordV1) => s.state.status === 'REFUSED')) {
    return {
      status: 'REFUSED',
      refusal: {
        code: 'POLICY_REFUSAL',
        message: 'Analytical snapshot contains refused evidence sources',
      },
    };
  }

  const mappings: FormaReverseMappingV1[] = snapshot.body.nodes.map((node: SemanticNodeRecordV1) => ({
    semanticNodeId: node.nodeId,
    channel: 'spatial_position',
    rationale: `Mapped semantic node ${node.producerSemanticId} (${node.propertyPath}) to spatial_position`,
  }));

  const planId = `sha256-forma-plan-v1-${canonicalSha256Hex({ snapshotId: snapshot.snapshotId, contextId: context.nodeId })}`;

  const body = {
    snapshotId: snapshot.snapshotId,
    contextId: context.nodeId,
    permittedUse: requestedUse === 'STUDY_ONLY' ? ('STUDY_ONLY' as PermittedExecutionUse) : ('PRODUCTION' as PermittedExecutionUse),
    planId,
    reverseExplanation: { mappings },
  };

  const admissionId = `forma-admission-v1:${canonicalSha256Hex(body)}`;

  return {
    status: 'ADMITTED',
    result: {
      schemaVersion: FORMA_ADMISSION_SCHEMA_VERSION,
      admissionId,
      body,
    },
  };
}

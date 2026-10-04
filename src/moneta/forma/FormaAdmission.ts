import { canonicalSha256Hex } from '../../security/CryptoHash.js';
import {
  type SemanticSnapshotV1,
  type SemanticNodeRecordV1,
  validateSemanticSnapshot,
} from '../representation/SemanticSnapshotV1.js';
import {
  computeCommittedContextIdentity,
  type CommittedInvestigationContextV2,
} from '../../atlas/domain/CommittedInvestigationContext.js';

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
  // 1. Refusal on non-admitted requested use
  if (requestedUse === 'REFUSED' || (requestedUse !== 'PRODUCTION' && requestedUse !== 'STUDY_ONLY')) {
    return {
      status: 'REFUSED',
      refusal: {
        code: 'POLICY_REFUSAL',
        message: `Requested execution use is refused or unsupported: ${requestedUse}`,
      },
    };
  }

  // 2. Strict decoding & structural validation of analytical snapshot
  try {
    validateSemanticSnapshot(snapshot);
  } catch (err: unknown) {
    return {
      status: 'REFUSED',
      refusal: {
        code: 'UNTRUSTED_DECODING',
        message: `Semantic snapshot decoding or validation failed: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }

  // 3. Evidence and source validation
  if (!snapshot.body.sources || snapshot.body.sources.length === 0) {
    return {
      status: 'REFUSED',
      refusal: {
        code: 'OBLIGATION_UNSATISFIED',
        message: 'Analytical snapshot contains no evidence sources',
      },
    };
  }

  for (const src of snapshot.body.sources) {
    if (src.state.status === 'REFUSED') {
      return {
        status: 'REFUSED',
        refusal: {
          code: 'POLICY_REFUSAL',
          message: `Analytical snapshot contains refused evidence sources (${src.sourceId}: ${src.state.owningReason})`,
        },
      };
    }
    if (src.state.status === 'UNAVAILABLE') {
      return {
        status: 'REFUSED',
        refusal: {
          code: 'OBLIGATION_UNSATISFIED',
          message: `Analytical snapshot contains unavailable evidence sources (${src.sourceId})`,
        },
      };
    }
    if (!src.evidenceReferences || src.evidenceReferences.length === 0) {
      return {
        status: 'REFUSED',
        refusal: {
          code: 'OBLIGATION_UNSATISFIED',
          message: `Source ${src.sourceId} lacks required analytical evidence references`,
        },
      };
    }
    for (const ev of src.evidenceReferences) {
      if (
        !ev.datasetFingerprint ||
        !ev.kernelVersion ||
        !ev.bundleContentDigest ||
        !ev.receiptId ||
        !ev.receiptContentDigest ||
        !ev.consumerId ||
        !ev.requirementProfileId ||
        !ev.requirementProfileDigest ||
        !ev.admissionPolicyId ||
        !ev.admissionPolicyDigest
      ) {
        return {
          status: 'REFUSED',
          refusal: {
            code: 'OBLIGATION_UNSATISFIED',
            message: `Source ${src.sourceId} has incomplete evidence reference tuple`,
          },
        };
      }
      if (ev.datasetFingerprint !== snapshot.body.analyticalDatasetFingerprint) {
        return {
          status: 'REFUSED',
          refusal: {
            code: 'OBLIGATION_UNSATISFIED',
            message: `Evidence dataset fingerprint mismatch: ${ev.datasetFingerprint} vs ${snapshot.body.analyticalDatasetFingerprint}`,
          },
        };
      }
    }
  }

  // 4. Reverse mappings from valid semantic nodes
  const mappings: FormaReverseMappingV1[] = snapshot.body.nodes.map((node: SemanticNodeRecordV1) => ({
    semanticNodeId: node.nodeId,
    channel: 'spatial_position',
    rationale: `Mapped semantic node ${node.producerSemanticId} (${node.propertyPath}) to spatial_position`,
  }));

  const contextId = computeCommittedContextIdentity(context);
  const planId = `sha256-forma-plan-v1-${canonicalSha256Hex({ snapshotId: snapshot.snapshotId, contextId })}`;

  const body = {
    snapshotId: snapshot.snapshotId,
    contextId,
    permittedUse: requestedUse,
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

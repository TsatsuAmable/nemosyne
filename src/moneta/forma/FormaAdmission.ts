import { canonicalSha256Hex } from '../../security/CryptoHash.js';
import {
  type SemanticSnapshotV1,
  validateSemanticSnapshot,
} from '../representation/SemanticSnapshotV1.js';
import {
  computeCommittedContextIdentity,
  type CommittedInvestigationContextV2,
  type EpistemicPurpose,
} from '../../atlas/domain/CommittedInvestigationContext.js';
import {
  type ConjecturalProposalV1,
  validateConjecturalProposal,
} from './ConjecturalProposal.js';

export const FORMA_ADMISSION_SCHEMA_VERSION = 1 as const;

export type PermittedExecutionUse = 'PRODUCTION' | 'STUDY_ONLY' | 'REFUSED';

export interface FormaRefusalV1 {
  readonly code: 'UNTRUSTED_DECODING' | 'UNSUPPORTED_MAPPING' | 'OBLIGATION_UNSATISFIED' | 'POLICY_REFUSAL';
  readonly message: string;
}

export type GroundedEpistemicStatus = 'OBSERVED' | 'DERIVED' | 'IMPUTED';
export type ConjecturalEpistemicStatus = 'IMPUTED' | 'HYPOTHESIZED' | 'COUNTERFACTUAL';

export interface GroundedFormaBindingV1 {
  readonly kind: 'GROUNDED';
  readonly snapshotId: string;
  readonly sourceId: string;
  readonly propertyPath: string;
  readonly status: GroundedEpistemicStatus;
}

export interface ConjecturalFormaBindingV1 {
  readonly kind: 'CONJECTURAL';
  readonly proposalId: string;
  readonly elementId: string;
  readonly propertyPath: string;
  readonly status: ConjecturalEpistemicStatus;
}

export type FormaBindingV1 = GroundedFormaBindingV1 | ConjecturalFormaBindingV1;

export interface FormaReverseMappingV1 {
  readonly semanticNodeId: string;
  readonly channel: string;
  readonly rationale: string;
  readonly bindingKind?: 'GROUNDED' | 'CONJECTURAL';
  readonly epistemicStatus?: string;
  readonly proposalId?: string;
}

export interface FormaAdmissionOptionsV1 {
  readonly requestedUse?: PermittedExecutionUse;
  readonly conjecturalProposals?: readonly ConjecturalProposalV1[];
  readonly bindings?: readonly FormaBindingV1[];
}

export interface FormaAdmissionResultV1 {
  readonly schemaVersion: typeof FORMA_ADMISSION_SCHEMA_VERSION;
  readonly admissionId: string;
  readonly body: {
    readonly snapshotId: string;
    readonly contextId: string;
    readonly epistemicPurpose: EpistemicPurpose;
    readonly permittedUse: PermittedExecutionUse;
    readonly planId: string;
    readonly bindings: readonly FormaBindingV1[];
    readonly conjecturalProposalRefs?: readonly string[];
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
  requestedUseOrOptions: PermittedExecutionUse | FormaAdmissionOptionsV1 = 'PRODUCTION'
): FormaAdmissionOutcomeV1 {
  const options: FormaAdmissionOptionsV1 =
    typeof requestedUseOrOptions === 'object' && requestedUseOrOptions !== null
      ? requestedUseOrOptions
      : { requestedUse: requestedUseOrOptions };

  const requestedUse = options.requestedUse ?? 'PRODUCTION';

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

  // 4. Validate context and epistemic purpose bindings (DM-2)
  const contextId = computeCommittedContextIdentity(context);
  const epistemicPurpose = context.epistemicPurpose ?? 'CLAIM_BEARING';

  const defaultGroundedBindings: GroundedFormaBindingV1[] = snapshot.body.nodes.map((node) => ({
    kind: 'GROUNDED' as const,
    snapshotId: snapshot.snapshotId,
    sourceId: node.sourceId ?? snapshot.body.sources[0]?.sourceId ?? 'source-root',
    propertyPath: node.propertyPath,
    status: 'OBSERVED' as const,
  }));

  const bindings: readonly FormaBindingV1[] = options.bindings ?? defaultGroundedBindings;

  // Validate conjectural proposals if present
  const validProposals = new Map<string, ConjecturalProposalV1>();
  if (options.conjecturalProposals && options.conjecturalProposals.length > 0) {
    for (const p of options.conjecturalProposals) {
      try {
        const validated = validateConjecturalProposal(p);
        if (validated.body.snapshotId !== snapshot.snapshotId) {
          return {
            status: 'REFUSED',
            refusal: {
              code: 'POLICY_REFUSAL',
              message: `Conjectural proposal snapshotId mismatch: ${validated.body.snapshotId} vs ${snapshot.snapshotId}`,
            },
          };
        }
        if (validated.body.contextId !== contextId && validated.body.contextId !== context.nodeId) {
          return {
            status: 'REFUSED',
            refusal: {
              code: 'POLICY_REFUSAL',
              message: `Conjectural proposal contextId mismatch: ${validated.body.contextId} vs ${contextId}`,
            },
          };
        }
        validProposals.set(validated.proposalId, validated);
      } catch (err: unknown) {
        return {
          status: 'REFUSED',
          refusal: {
            code: 'UNTRUSTED_DECODING',
            message: `Conjectural proposal validation failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        };
      }
    }
  }

  // Epistemic purpose gate: reject conjectural bindings in claim-bearing mode
  for (const b of bindings) {
    if (b.kind === 'CONJECTURAL') {
      if (epistemicPurpose === 'CLAIM_BEARING') {
        return {
          status: 'REFUSED',
          refusal: {
            code: 'POLICY_REFUSAL',
            message: 'Conjectural material bindings are strictly refused under CLAIM_BEARING context',
          },
        };
      }

      // Under EXPLORATORY_ABDUCTION, verify proposal linkage
      const prop = validProposals.get(b.proposalId);
      if (!prop) {
        return {
          status: 'REFUSED',
          refusal: {
            code: 'OBLIGATION_UNSATISFIED',
            message: `Conjectural binding references unknown proposal: ${b.proposalId}`,
          },
        };
      }
      const elemExists = prop.body.elements.some((e) => e.elementId === b.elementId);
      if (!elemExists) {
        return {
          status: 'REFUSED',
          refusal: {
            code: 'OBLIGATION_UNSATISFIED',
            message: `Conjectural element "${b.elementId}" not found in proposal ${b.proposalId}`,
          },
        };
      }
    } else {
      // Grounded binding must match snapshotId
      if (b.snapshotId !== snapshot.snapshotId) {
        return {
          status: 'REFUSED',
          refusal: {
            code: 'OBLIGATION_UNSATISFIED',
            message: `Grounded binding snapshotId mismatch: ${b.snapshotId} vs ${snapshot.snapshotId}`,
          },
        };
      }
    }
  }

  // 5. Reverse mappings from valid bindings
  const mappings: FormaReverseMappingV1[] = bindings.map((b) => {
    if (b.kind === 'GROUNDED') {
      const node = snapshot.body.nodes.find((n) => n.propertyPath === b.propertyPath);
      const semanticNodeId = node?.nodeId ?? b.propertyPath;
      return {
        semanticNodeId,
        channel: 'spatial_position',
        rationale: `Grounded analytical mapping for ${b.propertyPath} [status: ${b.status}]`,
        bindingKind: 'GROUNDED',
        epistemicStatus: b.status,
      };
    } else {
      return {
        semanticNodeId: b.elementId,
        channel: 'spatial_position',
        rationale: `Conjectural exploratory mapping for ${b.elementId} [status: ${b.status}, proposal: ${b.proposalId}]`,
        bindingKind: 'CONJECTURAL',
        epistemicStatus: b.status,
        proposalId: b.proposalId,
      };
    }
  });

  const conjecturalProposalRefs =
    validProposals.size > 0 ? Array.from(validProposals.keys()) : undefined;

  const planId = `sha256-forma-plan-v1-${canonicalSha256Hex({
    snapshotId: snapshot.snapshotId,
    contextId,
    epistemicPurpose,
    bindings,
    conjecturalProposalRefs,
  })}`;

  const body = {
    snapshotId: snapshot.snapshotId,
    contextId,
    epistemicPurpose,
    permittedUse: requestedUse,
    planId,
    bindings,
    conjecturalProposalRefs,
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

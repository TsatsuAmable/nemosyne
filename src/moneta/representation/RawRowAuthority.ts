import type { MonetaDataInput } from '../types.ts';
import type { SemanticRepresentationId } from './RepresentationCandidate.ts';
import {
  isObservationAbstractionLevel,
  type SemanticAbstractionLevel,
} from './SemanticAbstraction.ts';

export type GovernedEmbodimentAvailability = 'NOT_REQUIRED' | 'READY' | 'MISSING' | 'REFUSED';

export interface BoundedObservationDetailAuthorization {
  readonly kind: 'BOUNDED_OBSERVATION_DETAIL';
  /** Stable semantic object whose bounded members were explicitly requested. */
  readonly semanticTargetRef: string;
}

export interface RawRowAuthorityRequest {
  readonly candidateId: SemanticRepresentationId;
  readonly intentAbstractionLevel: SemanticAbstractionLevel;
  readonly governedEmbodiment: GovernedEmbodimentAvailability;
  readonly detailAuthorization?: BoundedObservationDetailAuthorization;
}

export type RawRowAuthorityRefusalReason =
  | 'GOVERNED_EMBODIMENT_UNAVAILABLE'
  | 'NON_OBSERVATION_INTENT'
  | 'REPRESENTATION_NOT_OBSERVATION_LEVEL'
  | 'INVALID_DETAIL_AUTHORIZATION';

export type RawRowAuthorityDecision =
  | {
      readonly authorized: true;
      readonly reason: 'EXPLICIT_OBSERVATION_INTENT' | 'AUTHORIZED_OBSERVATION_DETAIL';
    }
  | { readonly authorized: false; readonly reason: RawRowAuthorityRefusalReason };

const GOVERNED_REPRESENTATIONS = new Set<SemanticRepresentationId>([
  'AGGREGATE_VOLUME',
  'DISTRIBUTION_FIELD',
  'DENSITY_FIELD',
  'CLUSTER_REGIONS',
  'RELATIONSHIP_GRAPH',
]);

/**
 * Pure trust-boundary decision for compatibility row materialisation.
 *
 * Governed representation failure is terminal: even an otherwise valid detail
 * authorization cannot turn a missing/refused aggregate into source points.
 */
export function decideRawRowAuthority(request: RawRowAuthorityRequest): RawRowAuthorityDecision {
  if (GOVERNED_REPRESENTATIONS.has(request.candidateId) && request.governedEmbodiment !== 'READY') {
    return { authorized: false, reason: 'GOVERNED_EMBODIMENT_UNAVAILABLE' };
  }

  if (request.detailAuthorization) {
    if (
      request.detailAuthorization.kind !== 'BOUNDED_OBSERVATION_DETAIL' ||
      request.detailAuthorization.semanticTargetRef.trim().length === 0
    ) {
      return { authorized: false, reason: 'INVALID_DETAIL_AUTHORIZATION' };
    }
    return { authorized: true, reason: 'AUTHORIZED_OBSERVATION_DETAIL' };
  }

  if (!isObservationAbstractionLevel(request.intentAbstractionLevel)) {
    return { authorized: false, reason: 'NON_OBSERVATION_INTENT' };
  }

  // Importing the registry here would create a runtime cycle. Observation-level
  // raw source presentation is deliberately closed to these explicit V1 forms.
  if (request.candidateId !== 'POINT_SET' && request.candidateId !== 'MATRIX_FIELD') {
    return { authorized: false, reason: 'REPRESENTATION_NOT_OBSERVATION_LEVEL' };
  }

  return { authorized: true, reason: 'EXPLICIT_OBSERVATION_INTENT' };
}

export const evaluateRawRowAuthority = decideRawRowAuthority;

export interface AuthorizedRawTopologyInput {
  readonly rows: Record<string, unknown>[];
  readonly edges: NonNullable<MonetaDataInput['edges']>;
}

function compatibilityRawTopologyInput(input: MonetaDataInput): AuthorizedRawTopologyInput {
  return {
    rows: input.dataset?.rows ?? input.rows ?? [],
    edges: input.edges ?? input.dataset?.edges ?? [],
  };
}

/**
 * Resolve the legacy row/edge compatibility input only after the semantic
 * authority decision. Callers without semantic metadata retain their existing
 * lower-level translator contract; production dataset loads bind both fields.
 */
export function resolveAuthorizedRawTopologyInput(
  input: MonetaDataInput,
  semanticEmbodiment: unknown
): AuthorizedRawTopologyInput {
  const candidateId = input.semanticRepresentationId;
  const intentAbstractionLevel = input.semanticIntentAbstractionLevel;
  if (!candidateId || !intentAbstractionLevel) return compatibilityRawTopologyInput(input);

  const decision = decideRawRowAuthority({
    candidateId,
    intentAbstractionLevel,
    governedEmbodiment: GOVERNED_REPRESENTATIONS.has(candidateId)
      ? semanticEmbodiment
        ? 'READY'
        : 'MISSING'
      : 'NOT_REQUIRED',
    detailAuthorization:
      input.observationPresentationAuthority === 'SEMANTIC_DETAIL'
        ? { kind: 'BOUNDED_OBSERVATION_DETAIL', semanticTargetRef: 'authorized-detail' }
        : undefined,
  });
  return decision.authorized ? compatibilityRawTopologyInput(input) : { rows: [], edges: [] };
}

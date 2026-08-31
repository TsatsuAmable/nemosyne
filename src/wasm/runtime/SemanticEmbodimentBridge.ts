import type {
  AggregateEmbodimentRequestV1,
  DensityEmbodimentRequestV1,
  DistributionEmbodimentRequestV1,
  SemanticEmbodimentEnvelopeV1,
  SemanticEmbodimentFamilyV1,
} from '../../moneta/representation/SemanticEmbodimentPayload.ts';
import type {
  ClusterEmbodimentEnvelopeV1,
  ClusterEmbodimentRequestV1,
} from '../../moneta/representation/ClusterEmbodimentPayload.ts';
import type {
  SemanticDetailRequestV1,
  SemanticDetailEnvelopeV1,
} from '../../moneta/representation/SemanticDrillDown.ts';
import {
  allocBuffer,
  allocBytes,
  deallocBuffer,
  deallocBytes,
  readBytes,
} from './MemoryAbi.ts';
import { getRawRuntimeExports } from './RuntimeState.ts';

interface AggregateSemanticRuntime {
  moneta_build_aggregate_embodiment_v1(
    handle: number,
    inputPtr: number,
    inputLen: number,
    outPtr: number,
    outLen: number,
  ): number;
  moneta_build_distribution_embodiment_v1(
    handle: number,
    inputPtr: number,
    inputLen: number,
    outPtr: number,
    outLen: number,
  ): number;
  moneta_build_density_embodiment_v1(
    handle: number,
    inputPtr: number,
    inputLen: number,
    outPtr: number,
    outLen: number,
  ): number;
  moneta_build_cluster_embodiment_v1(
    handle: number,
    inputPtr: number,
    inputLen: number,
    outPtr: number,
    outLen: number,
  ): number;
  moneta_query_semantic_detail_v1(
    handle: number,
    inputPtr: number,
    inputLen: number,
    outPtr: number,
    outLen: number,
  ): number;
}

type EmbodimentRequestV1 =
  | AggregateEmbodimentRequestV1
  | DistributionEmbodimentRequestV1
  | DensityEmbodimentRequestV1
  | ClusterEmbodimentRequestV1;

type EmbodimentEnvelopeV1 = SemanticEmbodimentEnvelopeV1 | ClusterEmbodimentEnvelopeV1;

interface RetainedEmbodimentAuthority {
  readonly datasetFingerprint: string;
  readonly representationFamily: SemanticEmbodimentFamilyV1;
  readonly decisionId?: string;
  readonly decisionModelVersion?: string;
  readonly decisionModelArtifactHash?: string;
  readonly request: EmbodimentRequestV1;
}

const retainedEmbodimentAuthority = new Map<string, RetainedEmbodimentAuthority>();

function authorityKey(
  handle: number,
  family: SemanticEmbodimentFamilyV1,
  decisionId?: string,
): string {
  return `${handle}\u0000${family}\u0000${decisionId ?? ''}`;
}

function retainAuthoritativeRequest(
  handle: number,
  request: EmbodimentRequestV1,
  envelope: EmbodimentEnvelopeV1,
): void {
  if (envelope.result.status !== 'READY') return;

  const decisionId = request.decisionId;
  if (decisionId !== undefined && envelope.provenance.decisionId !== decisionId) return;
  if (
    request.decisionModelVersion !== undefined &&
    envelope.provenance.decisionModelVersion !== request.decisionModelVersion
  ) {
    return;
  }
  if (
    request.decisionModelArtifactHash !== undefined &&
    envelope.provenance.decisionModelArtifactHash !== request.decisionModelArtifactHash
  ) {
    return;
  }

  retainedEmbodimentAuthority.set(
    authorityKey(handle, envelope.representationFamily, decisionId),
    {
      datasetFingerprint: envelope.datasetFingerprint,
      representationFamily: envelope.representationFamily,
      decisionId,
      decisionModelVersion: request.decisionModelVersion,
      decisionModelArtifactHash: request.decisionModelArtifactHash,
      request: structuredClone(request),
    },
  );
}

function authorityMatchesTarget(
  authority: RetainedEmbodimentAuthority | undefined,
  request: SemanticDetailRequestV1,
): authority is RetainedEmbodimentAuthority {
  if (!authority) return false;
  const { target } = request;
  if (authority.datasetFingerprint !== target.datasetFingerprint) return false;
  if (authority.representationFamily !== target.representationFamily) return false;
  if (authority.decisionId !== undefined && authority.decisionId !== target.decisionId) return false;
  return true;
}

function resolveAuthoritativeRequest(
  handle: number,
  request: SemanticDetailRequestV1,
): EmbodimentRequestV1 | null {
  const { target } = request;
  const exact = retainedEmbodimentAuthority.get(
    authorityKey(handle, target.representationFamily, target.decisionId),
  );

  // P1-R2C density truth is decision-bound. A density detail request may never
  // inherit an older/legacy artifact that was built without the target decision.
  if (target.representationFamily === 'DENSITY') {
    if (!authorityMatchesTarget(exact, request)) return null;
    if (exact.decisionId !== target.decisionId) return null;
    return structuredClone(exact.request);
  }

  const legacy = retainedEmbodimentAuthority.get(
    authorityKey(handle, target.representationFamily),
  );
  const authority = exact ?? legacy;
  if (!authorityMatchesTarget(authority, request)) return null;
  return structuredClone(authority.request);
}

function parseEnvelope<T extends EmbodimentEnvelopeV1>(bytes: Uint8Array): T {
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

function invokeEmbodimentBuilder<TRequest extends EmbodimentRequestV1, TEnvelope extends EmbodimentEnvelopeV1>(
  handle: number,
  request: TRequest,
  invoke: (
    handle: number,
    inputPtr: number,
    inputLen: number,
    outPtr: number,
    outLen: number,
  ) => number,
): TEnvelope | null {
  const input = new TextEncoder().encode(JSON.stringify(request));
  const { ptr: inputPtr, len: inputLen } = allocBytes(input);
  try {
    const required = invoke(handle, inputPtr, inputLen, 0, 0);
    if (!Number.isSafeInteger(required) || required <= 0) return null;

    const output = allocBuffer(required);
    try {
      const written = invoke(handle, inputPtr, inputLen, output.ptr, output.len);
      if (written !== required) return null;
      const envelope = parseEnvelope<TEnvelope>(readBytes(output.ptr, written));
      retainAuthoritativeRequest(handle, request, envelope);
      return envelope;
    } finally {
      deallocBuffer(output.ptr, output.len);
    }
  } finally {
    deallocBytes(inputPtr, inputLen);
  }
}

/**
 * Invoke the Rust-owned A4 aggregate builder against an existing canonical
 * dataset handle. Request JSON contains parameters/provenance only; dataset rows
 * never cross this call boundary.
 */
export function buildAggregateSemanticEmbodimentV1(
  handle: number,
  request: AggregateEmbodimentRequestV1,
): SemanticEmbodimentEnvelopeV1 | null {
  if (!Number.isSafeInteger(handle) || handle <= 0) return null;
  const runtime = getRawRuntimeExports() as unknown as AggregateSemanticRuntime;
  if (typeof runtime.moneta_build_aggregate_embodiment_v1 !== 'function') return null;
  return invokeEmbodimentBuilder(handle, request, runtime.moneta_build_aggregate_embodiment_v1.bind(runtime));
}

/**
 * Invoke the Rust-owned M2 empirical-distribution builder against an existing
 * canonical dataset handle. Only the explicit measure, bounds and provenance
 * cross this boundary; TypeScript performs no statistical work.
 */
export function buildDistributionSemanticEmbodimentV1(
  handle: number,
  request: DistributionEmbodimentRequestV1,
): SemanticEmbodimentEnvelopeV1 | null {
  if (!Number.isSafeInteger(handle) || handle <= 0) return null;
  const runtime = getRawRuntimeExports() as unknown as AggregateSemanticRuntime;
  if (typeof runtime.moneta_build_distribution_embodiment_v1 !== 'function') return null;
  return invokeEmbodimentBuilder(handle, request, runtime.moneta_build_distribution_embodiment_v1.bind(runtime));
}

/**
 * Invoke the Rust-owned M2 binned-density builder against an existing
 * canonical dataset handle. Only explicit measures and bin counts cross;
 * TypeScript performs no statistical work.
 */
export function buildDensitySemanticEmbodimentV1(
  handle: number,
  request: DensityEmbodimentRequestV1,
): SemanticEmbodimentEnvelopeV1 | null {
  if (!Number.isSafeInteger(handle) || handle <= 0) return null;
  const runtime = getRawRuntimeExports() as unknown as AggregateSemanticRuntime;
  if (typeof runtime.moneta_build_density_embodiment_v1 !== 'function') return null;
  return invokeEmbodimentBuilder(handle, request, runtime.moneta_build_density_embodiment_v1.bind(runtime));
}

/**
 * Invoke the Rust-owned R2D C2 source-partition builder against an existing
 * canonical resident dataset handle. Only explicit field names and provenance
 * cross this boundary; TypeScript performs no grouping or spatial reduction.
 */
export function buildClusterSemanticEmbodimentV1(
  handle: number,
  request: ClusterEmbodimentRequestV1,
): ClusterEmbodimentEnvelopeV1 | null {
  if (!Number.isSafeInteger(handle) || handle <= 0) return null;
  const runtime = getRawRuntimeExports() as unknown as AggregateSemanticRuntime;
  if (typeof runtime.moneta_build_cluster_embodiment_v1 !== 'function') return null;
  return invokeEmbodimentBuilder(handle, request, runtime.moneta_build_cluster_embodiment_v1.bind(runtime));
}

/**
 * Invoke the Rust-owned progressive disclosure query resolver against an
 * existing canonical resident dataset handle.
 *
 * Detail membership is intentionally bound to the exact request retained when
 * Rust produced the READY semantic embodiment. The caller-supplied request is
 * accepted only for API compatibility and is never allowed to reinterpret an
 * existing semantic object under different fields, bins, or grouping rules.
 */
export function querySemanticDetailV1(
  handle: number,
  request: SemanticDetailRequestV1,
  _embodimentRequest: unknown,
  generation: number,
): SemanticDetailEnvelopeV1 | null {
  if (!Number.isSafeInteger(handle) || handle <= 0) return null;
  const runtime = getRawRuntimeExports() as unknown as AggregateSemanticRuntime;
  if (typeof runtime.moneta_query_semantic_detail_v1 !== 'function') return null;

  const authoritativeRequest = resolveAuthoritativeRequest(handle, request);
  if (!authoritativeRequest) return null;

  const payload = {
    request,
    embodimentRequest: authoritativeRequest,
    generation,
  };

  const input = new TextEncoder().encode(JSON.stringify(payload));
  const { ptr: inputPtr, len: inputLen } = allocBytes(input);
  try {
    const required = runtime.moneta_query_semantic_detail_v1(
      handle,
      inputPtr,
      inputLen,
      0,
      0,
    );
    if (!Number.isSafeInteger(required) || required <= 0) return null;

    const output = allocBuffer(required);
    try {
      const written = runtime.moneta_query_semantic_detail_v1(
        handle,
        inputPtr,
        inputLen,
        output.ptr,
        output.len,
      );
      if (written !== required) return null;
      const bytes = readBytes(output.ptr, written);
      return JSON.parse(new TextDecoder().decode(bytes)) as SemanticDetailEnvelopeV1;
    } finally {
      deallocBuffer(output.ptr, output.len);
    }
  } finally {
    deallocBytes(inputPtr, inputLen);
  }
}

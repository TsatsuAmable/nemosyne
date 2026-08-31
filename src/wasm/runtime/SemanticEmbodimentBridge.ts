import type {
  AggregateEmbodimentRequestV1,
  ClusterEmbodimentRequestV1,
  DensityEmbodimentRequestV1,
  DistributionEmbodimentRequestV1,
  RelationshipGraphEmbodimentRequestV1,
  SemanticEmbodimentEnvelopeV1,
} from '../../moneta/representation/SemanticEmbodimentPayload.ts';
import {
  allocBuffer,
  allocBytes,
  deallocBuffer,
  deallocBytes,
  readBytes,
} from './MemoryAbi.ts';
import { getRawRuntimeExports } from './RuntimeState.ts';

interface SemanticRuntime {
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
  moneta_build_relationship_graph_embodiment_v1(
    handle: number,
    inputPtr: number,
    inputLen: number,
    outPtr: number,
    outLen: number,
  ): number;
}

function invokeSemanticBuilder(
  handle: number,
  request: unknown,
  select: (runtime: SemanticRuntime) => SemanticRuntime[keyof SemanticRuntime] | undefined
): SemanticEmbodimentEnvelopeV1 | null {
  if (!Number.isSafeInteger(handle) || handle <= 0) return null;
  const runtime = getRawRuntimeExports() as unknown as SemanticRuntime;
  const fn = select(runtime);
  if (typeof fn !== 'function') return null;

  const input = new TextEncoder().encode(JSON.stringify(request));
  const { ptr: inputPtr, len: inputLen } = allocBytes(input);
  try {
    const required = fn(handle, inputPtr, inputLen, 0, 0);
    if (!Number.isSafeInteger(required) || required <= 0) return null;

    const output = allocBuffer(required);
    try {
      const written = fn(handle, inputPtr, inputLen, output.ptr, output.len);
      if (written !== required) return null;
      const bytes = readBytes(output.ptr, written);
      return JSON.parse(new TextDecoder().decode(bytes)) as SemanticEmbodimentEnvelopeV1;
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
  return invokeSemanticBuilder(handle, request, (runtime) =>
    runtime.moneta_build_aggregate_embodiment_v1?.bind(runtime)
  );
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
  return invokeSemanticBuilder(handle, request, (runtime) =>
    runtime.moneta_build_distribution_embodiment_v1?.bind(runtime)
  );
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
  return invokeSemanticBuilder(handle, request, (runtime) =>
    runtime.moneta_build_density_embodiment_v1?.bind(runtime)
  );
}

/**
 * Invoke the R2D source-partition builder. Membership comes only from the
 * explicit categorical cluster field; the bridge carries no rows and performs
 * no grouping or clustering.
 */
export function buildClusterSemanticEmbodimentV1(
  handle: number,
  request: ClusterEmbodimentRequestV1,
): SemanticEmbodimentEnvelopeV1 | null {
  return invokeSemanticBuilder(handle, request, (runtime) =>
    runtime.moneta_build_cluster_embodiment_v1?.bind(runtime)
  );
}

/**
 * Invoke the R2E source-edge-list builder. No inferred relationship model is
 * available through this bridge; absent source edges remain unavailable.
 */
export function buildRelationshipGraphSemanticEmbodimentV1(
  handle: number,
  request: RelationshipGraphEmbodimentRequestV1,
): SemanticEmbodimentEnvelopeV1 | null {
  return invokeSemanticBuilder(handle, request, (runtime) =>
    runtime.moneta_build_relationship_graph_embodiment_v1?.bind(runtime)
  );
}

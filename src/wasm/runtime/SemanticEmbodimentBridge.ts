import type {
  AggregateEmbodimentRequestV1,
  DensityEmbodimentRequestV1,
  DistributionEmbodimentRequestV1,
  SemanticEmbodimentEnvelopeV1,
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

  const input = new TextEncoder().encode(JSON.stringify(request));
  const { ptr: inputPtr, len: inputLen } = allocBytes(input);
  try {
    const required = runtime.moneta_build_aggregate_embodiment_v1(
      handle,
      inputPtr,
      inputLen,
      0,
      0,
    );
    if (!Number.isSafeInteger(required) || required <= 0) return null;

    const output = allocBuffer(required);
    try {
      const written = runtime.moneta_build_aggregate_embodiment_v1(
        handle,
        inputPtr,
        inputLen,
        output.ptr,
        output.len,
      );
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

  const input = new TextEncoder().encode(JSON.stringify(request));
  const { ptr: inputPtr, len: inputLen } = allocBytes(input);
  try {
    const required = runtime.moneta_build_distribution_embodiment_v1(
      handle,
      inputPtr,
      inputLen,
      0,
      0,
    );
    if (!Number.isSafeInteger(required) || required <= 0) return null;

    const output = allocBuffer(required);
    try {
      const written = runtime.moneta_build_distribution_embodiment_v1(
        handle,
        inputPtr,
        inputLen,
        output.ptr,
        output.len,
      );
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

  const input = new TextEncoder().encode(JSON.stringify(request));
  const { ptr: inputPtr, len: inputLen } = allocBytes(input);
  try {
    const required = runtime.moneta_build_density_embodiment_v1(
      handle,
      inputPtr,
      inputLen,
      0,
      0,
    );
    if (!Number.isSafeInteger(required) || required <= 0) return null;

    const output = allocBuffer(required);
    try {
      const written = runtime.moneta_build_density_embodiment_v1(
        handle,
        inputPtr,
        inputLen,
        output.ptr,
        output.len,
      );
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

  const input = new TextEncoder().encode(JSON.stringify(request));
  const { ptr: inputPtr, len: inputLen } = allocBytes(input);
  try {
    const required = runtime.moneta_build_cluster_embodiment_v1(
      handle,
      inputPtr,
      inputLen,
      0,
      0,
    );
    if (!Number.isSafeInteger(required) || required <= 0) return null;

    const output = allocBuffer(required);
    try {
      const written = runtime.moneta_build_cluster_embodiment_v1(
        handle,
        inputPtr,
        inputLen,
        output.ptr,
        output.len,
      );
      if (written !== required) return null;
      const bytes = readBytes(output.ptr, written);
      return JSON.parse(new TextDecoder().decode(bytes)) as ClusterEmbodimentEnvelopeV1;
    } finally {
      deallocBuffer(output.ptr, output.len);
    }
  } finally {
    deallocBytes(inputPtr, inputLen);
  }
}

/**
 * Invoke the Rust-owned progressive disclosure query resolver against an
 * existing canonical resident dataset handle.
 */
export function querySemanticDetailV1(
  handle: number,
  request: SemanticDetailRequestV1,
  embodimentRequest: unknown,
  generation: number,
): SemanticDetailEnvelopeV1 | null {
  if (!Number.isSafeInteger(handle) || handle <= 0) return null;
  const runtime = getRawRuntimeExports() as unknown as AggregateSemanticRuntime;
  if (typeof runtime.moneta_query_semantic_detail_v1 !== 'function') return null;

  const payload = {
    request,
    embodimentRequest,
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


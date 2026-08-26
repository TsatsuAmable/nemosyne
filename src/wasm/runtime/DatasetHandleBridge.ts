import type {
  BettiPoint,
  ColumnSchema,
  DatasetJSON,
  EncodingMapping,
  Facts,
  OperationSpec,
  PersistenceInterval,
  Provenance,
  SpectralFacts,
  TdaMapperGraph,
} from '../../data/types.ts';
import {
  allocBuffer,
  allocBytes,
  deallocBuffer,
  deallocBytes,
  readBytes,
  readString,
} from './MemoryAbi.ts';
import { getDatasetHandleExports as getRuntimeExports } from './RuntimeState.ts';
import { kernelProvenance } from './KernelContractBridge.ts';
import type { DatasetHandleExports, MemoryAbiExports } from './RuntimeExports.ts';

type DatasetHandleRuntime = DatasetHandleExports & MemoryAbiExports;

export type TdaExportName =
  | 'data_compute_mapper_graph'
  | 'data_compute_persistence_intervals'
  | 'data_compute_betti0_curve';

export type AnalyticalResourceDecision =
  | 'exact_allowed'
  | 'approximation_required'
  | 'unsupported_at_scale';

export interface AnalyticalResourceEstimate {
  operation: string;
  rows: number;
  dimensions: number;
  complexity: 'linear' | 'n_log_n' | 'quadratic' | 'cubic' | 'exponential';
  estimatedWorkUnits: number;
  estimatedTransientBytes: number;
  decision: AnalyticalResourceDecision;
  reasonCode?: string | null;
}

export interface TdaResourcePreflight {
  sourceRows: number;
  eligibleRows: number;
  excludedRows: number;
  dimensions: number;
  missingDataPolicy: string;
  eligibilityMode: 'complete_case_selected_features' | 'conservative_source_rows_preflight';
  estimate: AnalyticalResourceEstimate;
  refusal: string | null;
}

export class UnsupportedAtScaleError extends Error {
  readonly code = 'UNSUPPORTED_AT_SCALE' as const;
  readonly preflight: TdaResourcePreflight;
  readonly provenance: Provenance | null;

  constructor(preflight: TdaResourcePreflight, provenance: Provenance | null = null) {
    super(
      preflight.refusal ??
        `UNSUPPORTED_AT_SCALE:operation=${preflight.estimate.operation};reason=${preflight.estimate.reasonCode ?? 'RESOURCE_BUDGET_EXCEEDED'}`
    );
    this.name = 'UnsupportedAtScaleError';
    this.preflight = preflight;
    this.provenance = provenance;
    Object.setPrototypeOf(this, UnsupportedAtScaleError.prototype);
  }
}

const TDA_OPERATION_CODES: Record<TdaExportName, number> = {
  data_compute_mapper_graph: 0,
  data_compute_persistence_intervals: 1,
  data_compute_betti0_curve: 2,
};

function readStringExport(invoke: (outPtr: number, outLen: number) => number): string | null {
  const required = invoke(0, 0);
  if (!Number.isSafeInteger(required) || required <= 0) return null;
  const { ptr, len } = allocBuffer(required);
  try {
    const written = invoke(ptr, len);
    if (written !== required) return null;
    return readString(ptr, written);
  } finally {
    deallocBuffer(ptr, len);
  }
}

function parseTdaPreflight(json: string): TdaResourcePreflight {
  const parsed = JSON.parse(json) as Partial<TdaResourcePreflight>;
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !parsed.estimate ||
    typeof parsed.estimate !== 'object' ||
    typeof parsed.estimate.operation !== 'string' ||
    typeof parsed.estimate.decision !== 'string' ||
    typeof parsed.eligibleRows !== 'number' ||
    typeof parsed.sourceRows !== 'number' ||
    (parsed.eligibilityMode !== 'complete_case_selected_features' &&
      parsed.eligibilityMode !== 'conservative_source_rows_preflight')
  ) {
    throw new Error('Invalid TDA resource preflight payload from Rust kernel');
  }
  return parsed as TdaResourcePreflight;
}

function readTdaPreflight(
  wasm: DatasetHandleRuntime,
  handle: number,
  paramPtr: number,
  paramLen: number,
  exportName: TdaExportName
): TdaResourcePreflight | null {
  const operationCode = TDA_OPERATION_CODES[exportName];
  // Resource envelopes are deliberately compact. A one-pass 4 KiB buffer keeps
  // complete-case validity scanning to one pass in the normal case; the generic
  // two-call helper is only a fallback if the diagnostic schema grows later.
  const allocation = allocBuffer(4096);
  try {
    const written = wasm.data_tda_resource_preflight(
      handle,
      paramPtr,
      paramLen,
      operationCode,
      allocation.ptr,
      allocation.len
    );
    if (!Number.isSafeInteger(written) || written <= 0) return null;
    if (written <= allocation.len) {
      return parseTdaPreflight(readString(allocation.ptr, written));
    }
  } finally {
    deallocBuffer(allocation.ptr, allocation.len);
  }

  const json = readStringExport((outPtr, outLen) =>
    wasm.data_tda_resource_preflight(
      handle,
      paramPtr,
      paramLen,
      operationCode,
      outPtr,
      outLen
    )
  );
  return json ? parseTdaPreflight(json) : null;
}

function parseTdaRefusalEnvelope(json: string): TdaResourcePreflight | null {
  // The Rust `data_compute_*` exports run the resource preflight inline and, on
  // refusal, write `{ unsupportedAtScale: true, preflight: <TdaResourcePreflight> }`
  // instead of a result. Valid TDA results (a mapper graph object, persistence /
  // Betti arrays) never carry this marker, so detection is unambiguous and a
  // normal result is returned untouched.
  try {
    const value = JSON.parse(json) as { unsupportedAtScale?: unknown; preflight?: unknown };
    if (value && value.unsupportedAtScale === true && value.preflight) {
      return parseTdaPreflight(JSON.stringify(value.preflight));
    }
  } catch {
    // Not JSON or wrong shape — treat as a normal result.
  }
  return null;
}

function tdaCall(
  wasm: DatasetHandleRuntime,
  handle: number,
  params: Record<string, unknown>,
  exportName: TdaExportName
): string | null {
  const paramBytes = new TextEncoder().encode(JSON.stringify(params));
  const { ptr: paramPtr, len: paramLen } = allocBytes(paramBytes);
  try {
    // Enforcement is kernel-inline: the Rust export refuses over-budget work
    // in-band before any expensive TDA computation, so direct/raw callers cannot
    // bypass the analytical resource envelope. The standalone preflight remains
    // available as a dry-run query via tdaResourcePreflight.
    const json = readStringExport((outPtr, outLen) => {
      const fn = wasm[exportName] as (
        h: number,
        pp: number,
        pl: number,
        p: number,
        l: number
      ) => number;
      return fn(handle, paramPtr, paramLen, outPtr, outLen);
    });
    if (!json) return null;
    const refusal = parseTdaRefusalEnvelope(json);
    if (refusal) {
      // The Rust export wrote the refusal provenance to the kernel side-channel
      // (`LAST_PROVENANCE`) via `record_refusal`. Read it back here — the
      // envelope itself is size-stable (no timestamped provenance embedded) so
      // the two-call ABI holds, and the side-channel is the established
      // provenance channel. Single-threaded WASM guarantees no intervening
      // call clobbers it before this read.
      const provenance = kernelProvenance();
      throw new UnsupportedAtScaleError(refusal, provenance);
    }
    return json;
  } finally {
    deallocBytes(paramPtr, paramLen);
  }
}

/**
 * Dry-run resource preflight for a TDA operation. Calls the standalone
 * `data_tda_resource_preflight` kernel query without executing the compute, so
 * the investigator can be shown scale/eligibility evidence before requesting a
 * result. The production compute path enforces the same envelope inline inside
 * the Rust `data_compute_*` exports.
 */
export function tdaResourcePreflight(
  handle: number,
  params: Record<string, unknown>,
  exportName: TdaExportName
): TdaResourcePreflight | null {
  const wasm = getRuntimeExports();
  const paramBytes = new TextEncoder().encode(JSON.stringify(params));
  const { ptr: paramPtr, len: paramLen } = allocBytes(paramBytes);
  try {
    return readTdaPreflight(wasm, handle, paramPtr, paramLen, exportName);
  } finally {
    deallocBytes(paramPtr, paramLen);
  }
}

export function loadCsv(bytes: Uint8Array): number {
  const wasm = getRuntimeExports();
  const { ptr, len } = allocBytes(bytes);
  try {
    return wasm.data_load_csv(ptr, len);
  } finally {
    deallocBytes(ptr, len);
  }
}

export function loadJson(bytes: Uint8Array): number {
  const wasm = getRuntimeExports();
  const { ptr, len } = allocBytes(bytes);
  try {
    return wasm.data_load_json(ptr, len);
  } finally {
    deallocBytes(ptr, len);
  }
}

export function loadTypedColumns(payload: ArrayBuffer | Uint8Array, name?: string): number {
  const wasm = getRuntimeExports();
  const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const { ptr, len } = allocBytes(bytes);
  try {
    if (name) {
      const nameBytes = new TextEncoder().encode(name);
      const { ptr: namePtr, len: nameLen } = allocBytes(nameBytes);
      try {
        return wasm.data_load_typed_columns_named(ptr, len, namePtr, nameLen);
      } finally {
        deallocBytes(namePtr, nameLen);
      }
    }
    return wasm.data_load_typed_columns(ptr, len);
  } finally {
    deallocBytes(ptr, len);
  }
}

export function loadSample(key: string): number {
  const wasm = getRuntimeExports();
  const bytes = new TextEncoder().encode(key);
  const { ptr, len } = allocBytes(bytes);
  try {
    return wasm.data_load_sample(ptr, len);
  } finally {
    deallocBytes(ptr, len);
  }
}

export function sampleKeys(): string[] {
  const wasm = getRuntimeExports();
  const allocation = allocBuffer(256);
  try {
    const written = wasm.data_sample_keys(allocation.ptr, allocation.len);
    if (written <= 0 || written > allocation.len) return [];
    const value = readString(allocation.ptr, written);
    return value.split(',').filter(Boolean);
  } finally {
    deallocBuffer(allocation.ptr, allocation.len);
  }
}

export function datasetRowCount(handle: number): number {
  return getRuntimeExports().dataset_row_count(handle);
}

export function datasetColumnCount(handle: number): number {
  return getRuntimeExports().dataset_column_count(handle);
}

export function destroyDataset(handle: number): void {
  getRuntimeExports().dataset_destroy(handle);
}

export function parseDatasetBytes(bytes: Uint8Array, ext: 'csv' | 'json'): DatasetJSON | null {
  getRuntimeExports();
  const handle = ext === 'csv' ? loadCsv(bytes) : loadJson(bytes);
  if (handle === 0) return null;
  try {
    return getDatasetJson(handle);
  } finally {
    destroyDataset(handle);
  }
}

export function getDatasetJson(handle: number): DatasetJSON | null {
  const wasm = getRuntimeExports();
  const required = wasm.dataset_to_json(handle, 0, 0);
  if (!Number.isSafeInteger(required) || required <= 0) return null;
  const allocation = allocBuffer(required);
  try {
    const written = wasm.dataset_to_json(handle, allocation.ptr, allocation.len);
    if (written !== required) return null;
    const json = readString(allocation.ptr, written);
    return JSON.parse(json) as DatasetJSON;
  } finally {
    deallocBuffer(allocation.ptr, allocation.len);
  }
}

export function loadDatasetJson(obj: DatasetJSON): number {
  const wasm = getRuntimeExports();
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const { ptr, len } = allocBytes(bytes);
  try {
    return wasm.data_load_dataset_json(ptr, len);
  } finally {
    deallocBytes(ptr, len);
  }
}

export function runOperation(handle: number, op: OperationSpec): number {
  const wasm = getRuntimeExports();
  const bytes = new TextEncoder().encode(JSON.stringify(op));
  const { ptr, len } = allocBytes(bytes);
  try {
    return wasm.data_operation(handle, ptr, len);
  } finally {
    deallocBytes(ptr, len);
  }
}

export function executeOperation(datasetObj: DatasetJSON, op: OperationSpec): DatasetJSON | null {
  getRuntimeExports();
  const inputHandle = loadDatasetJson(datasetObj);
  if (inputHandle === 0) return null;
  const outputHandle = runOperation(inputHandle, op);
  try {
    if (outputHandle === 0) return null;
    return getDatasetJson(outputHandle);
  } finally {
    destroyDataset(inputHandle);
    if (outputHandle !== 0) destroyDataset(outputHandle);
  }
}

export function datasetFingerprint(handle: number): string | null {
  const wasm = getRuntimeExports();
  return readStringExport((ptr, len) => wasm.dataset_fingerprint(handle, ptr, len));
}

export function inferTopology(handle: number): string | null {
  const wasm = getRuntimeExports();
  return readStringExport((ptr, len) => wasm.data_infer_topology(handle, ptr, len));
}

export function inferEncodings(handle: number, topology?: string): EncodingMapping | null {
  const wasm = getRuntimeExports();
  let topoPtr = 0;
  let topoLen = 0;
  if (topology) {
    const allocation = allocBytes(new TextEncoder().encode(topology));
    topoPtr = allocation.ptr;
    topoLen = allocation.len;
  }
  try {
    const json = readStringExport((ptr, len) =>
      wasm.data_infer_encodings(handle, topoPtr, topoLen, ptr, len)
    );
    if (!json) return null;
    return JSON.parse(json) as EncodingMapping;
  } finally {
    if (topoLen > 0) deallocBytes(topoPtr, topoLen);
  }
}

export function inferSchema(handle: number): ColumnSchema[] | null {
  const wasm = getRuntimeExports();
  const json = readStringExport((ptr, len) => wasm.data_infer_schema(handle, ptr, len));
  if (!json) return null;
  return JSON.parse(json) as ColumnSchema[];
}

export function statistics(handle: number): Facts | null {
  const wasm = getRuntimeExports();
  const json = readStringExport((ptr, len) => wasm.data_statistics(handle, ptr, len));
  if (!json) return null;
  return JSON.parse(json) as Facts;
}

export function computeSpectralFacts(
  handle: number,
  timeColumn?: string,
  valueColumn?: string
): SpectralFacts | null {
  const wasm = getRuntimeExports();
  let timePtr = 0;
  let timeLen = 0;
  if (timeColumn) {
    const allocation = allocBytes(new TextEncoder().encode(timeColumn));
    timePtr = allocation.ptr;
    timeLen = allocation.len;
  }
  let valuePtr = 0;
  let valueLen = 0;
  if (valueColumn) {
    const allocation = allocBytes(new TextEncoder().encode(valueColumn));
    valuePtr = allocation.ptr;
    valueLen = allocation.len;
  }
  try {
    const json = readStringExport((ptr, len) =>
      wasm.data_compute_spectral_facts(handle, timePtr, timeLen, valuePtr, valueLen, ptr, len)
    );
    if (!json || json === 'null') return null;
    return JSON.parse(json) as SpectralFacts;
  } finally {
    if (timeLen > 0) deallocBytes(timePtr, timeLen);
    if (valueLen > 0) deallocBytes(valuePtr, valueLen);
  }
}

export function parseArrow(bytes: Uint8Array): number {
  const wasm = getRuntimeExports();
  const { ptr, len } = allocBytes(bytes);
  try {
    return wasm.data_parse_arrow(ptr, len);
  } finally {
    deallocBytes(ptr, len);
  }
}

export function computeMapperGraph(
  handle: number,
  params: Record<string, unknown>
): TdaMapperGraph | null {
  const wasm = getRuntimeExports();
  const json = tdaCall(wasm, handle, params, 'data_compute_mapper_graph');
  if (!json) return null;
  return JSON.parse(json) as TdaMapperGraph;
}

export function computePersistenceIntervals(
  handle: number,
  params: Record<string, unknown>
): PersistenceInterval[] | null {
  const wasm = getRuntimeExports();
  const json = tdaCall(wasm, handle, params, 'data_compute_persistence_intervals');
  if (!json) return null;
  return JSON.parse(json) as PersistenceInterval[];
}

export function computeBetti0Curve(
  handle: number,
  params: Record<string, unknown>
): BettiPoint[] | null {
  const wasm = getRuntimeExports();
  const json = tdaCall(wasm, handle, params, 'data_compute_betti0_curve');
  if (!json) return null;
  return JSON.parse(json) as BettiPoint[];
}

export function computeDatasetStructureProfile(handle: number): Record<string, unknown> | null {
  let wasm: DatasetHandleRuntime;
  try {
    wasm = getRuntimeExports();
  } catch {
    return null;
  }
  const needed = wasm.data_compute_structure_profile(handle, 0, 0);
  if (!Number.isSafeInteger(needed) || needed <= 0) return null;
  const allocation = allocBuffer(needed);
  try {
    const written = wasm.data_compute_structure_profile(handle, allocation.ptr, allocation.len);
    if (written !== needed) return null;
    const resultBytes = readBytes(allocation.ptr, written);
    return JSON.parse(new TextDecoder().decode(resultBytes)) as Record<string, unknown>;
  } finally {
    deallocBuffer(allocation.ptr, allocation.len);
  }
}

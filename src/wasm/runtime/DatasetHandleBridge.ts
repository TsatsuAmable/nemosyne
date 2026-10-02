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
import {
  getDatasetHandleExports as getRuntimeExports,
  getRawRuntimeExports,
} from './RuntimeState.ts';
import { kernelProvenance } from './KernelContractBridge.ts';
import { readPreparedResult } from './PreparedResultBridge.ts';
import type { DatasetHandleExports, MemoryAbiExports } from './RuntimeExports.ts';

type DatasetHandleRuntime = DatasetHandleExports & MemoryAbiExports;

export interface DatasetRowView {
  name: string;
  rowIds: string[];
  rowCount: number;
  columnCount: number;
  edgesPresent: boolean;
}

export type TdaExportName =
  'data_compute_mapper_graph' | 'data_compute_persistence_intervals' | 'data_compute_betti0_curve';

export type AnalyticalResourceDecision =
  'exact_allowed' | 'approximation_required' | 'unsupported_at_scale';

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
    wasm.data_tda_resource_preflight(handle, paramPtr, paramLen, operationCode, outPtr, outLen)
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
  handle: number,
  params: Record<string, unknown>,
  exportName: TdaExportName
): string | null {
  const owner = getRuntimeExports();
  const paramBytes = new TextEncoder().encode(JSON.stringify(params));
  const { ptr: paramPtr, len: paramLen } = allocBytes(paramBytes);
  try {
    // Enforcement is kernel-inline: the Rust export refuses over-budget work
    // in-band before any expensive TDA computation, so direct/raw callers cannot
    // bypass the analytical resource envelope. The standalone preflight remains
    // available as a dry-run query via tdaResourcePreflight.
    const json = readPreparedResult((runtime) => {
      switch (exportName) {
        case 'data_compute_mapper_graph':
          return runtime.data_prepare_mapper_graph(handle, paramPtr, paramLen);
        case 'data_compute_persistence_intervals':
          return runtime.data_prepare_persistence_intervals(handle, paramPtr, paramLen);
        case 'data_compute_betti0_curve':
          return runtime.data_prepare_betti0_curve(handle, paramPtr, paramLen);
      }
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
    owner.host_buffer_dealloc(paramPtr, paramLen);
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

export function datasetRowView(handle: number): DatasetRowView | null {
  const wasm = getRuntimeExports();
  const json = readStringExport((outPtr, outLen) => wasm.dataset_row_view(handle, outPtr, outLen));
  if (!json) return null;
  try {
    const value = JSON.parse(json) as Partial<DatasetRowView>;
    if (
      typeof value.name !== 'string' ||
      !Array.isArray(value.rowIds) ||
      value.rowIds.some((id) => typeof id !== 'string' || id.length === 0) ||
      typeof value.rowCount !== 'number' ||
      !Number.isSafeInteger(value.rowCount) ||
      value.rowCount < 0 ||
      typeof value.columnCount !== 'number' ||
      !Number.isSafeInteger(value.columnCount) ||
      value.columnCount < 0 ||
      value.rowIds.length !== value.rowCount ||
      new Set(value.rowIds).size !== value.rowIds.length ||
      typeof value.edgesPresent !== 'boolean'
    ) {
      return null;
    }
    return value as DatasetRowView;
  } catch {
    return null;
  }
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
  const json = readPreparedResult((runtime) => runtime.dataset_prepare_json(handle), {
    nullOnReadMismatch: true,
  });
  return json === null ? null : (JSON.parse(json) as DatasetJSON);
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
  const json = readPreparedResult((runtime) => runtime.data_prepare_statistics(handle), {
    nullOnReadMismatch: true,
  });
  if (!json) return null;
  return JSON.parse(json) as Facts;
}

export function statisticsEvidenceReceiptBundle(handle: number): unknown | null {
  const json = readPreparedResult(
    (runtime) => runtime.data_prepare_statistics_evidence_receipts(handle),
    { nullOnReadMismatch: true }
  );
  if (!json) return null;
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}

/**
 * RFC 0009 tranche 3 slice 2: the kernel-issued governed-consumer attestation
 * for this dataset (which governed consumers consume the receipts the kernel
 * issues). Two-call string-out ABI, mirroring `datasetFingerprint`.
 *
 * Feature-detecting is deliberate fail-closed behaviour: a wasm build older
 * than this slice has no `data_governed_consumers` export, and governed
 * capture must refuse rather than mint consumer uses without an attestation.
 * The typed presence on `DatasetHandleExports` names the contract; the
 * runtime check is what keeps a stale prebuilt pkg from half-attesting.
 */
export function statisticsGovernedConsumers(handle: number): unknown | null {
  const wasm: DatasetHandleExports = getRuntimeExports();
  // The runtime feature-detect guards a wasm build older than this slice; the
  // typed access below stays on the declared export contract.
  if (typeof wasm.data_governed_consumers !== 'function') return null;
  const json = readStringExport((ptr, len) => wasm.data_governed_consumers(handle, ptr, len));
  if (!json) return null;
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}

/**
 * The two halves of one governed capture, read from the kernel in a single
 * pass. `rawBundle` is exactly the value `statisticsEvidenceReceiptBundle`
 * parses, and `governedConsumers` exactly the value `statisticsGovernedConsumers`
 * parses — the kernel embeds each standalone export's wire shape — so callers
 * switch between the single-pass and two-call reads without reshaping anything.
 * `'unsupported'` is a capability signal, not a refusal: it distinguishes a
 * wasm build that predates the single-pass export (the two-call path is still
 * authoritative there) from a present export that refused or failed its read
 * (`null`).
 */
export interface StatisticsGovernedCaptureResult {
  rawBundle: unknown;
  governedConsumers: unknown;
}

/**
 * RFC 0009 tranche 3 slice 2 follow-up (#866 residual): the governed capture
 * computed in one kernel pass — the receipt bundle is computed exactly once and
 * the consumer attestation is minted from that same in-kernel bundle value,
 * inside one dataset read. Two-call string-out ABI, mirroring
 * `statisticsGovernedConsumers`.
 *
 * The three outcomes are deliberately distinct: `'unsupported'` means this
 * build's wasm has no single-pass export and governed capture must keep the
 * two-call read it still trusts (a slice-2-era pkg paired with this JS build
 * must not start refusing what slice-2 captured); `null` means the export is
 * present and refused — no dataset, families refused, or a payload that does
 * not parse — and the ports refuse outright rather than re-minting from the
 * two-call bytes, which must never be consulted after a real refusal.
 */
export function statisticsGovernedCapture(
  handle: number
): StatisticsGovernedCaptureResult | null | 'unsupported' {
  const wasm: DatasetHandleExports = getRuntimeExports();
  // The runtime feature-detect is a capability signal; the typed access below
  // stays on the declared export contract.
  if (typeof wasm.data_statistics_evidence_governed_capture !== 'function') {
    return 'unsupported';
  }
  const json = readStringExport((ptr, len) =>
    wasm.data_statistics_evidence_governed_capture(handle, ptr, len)
  );
  if (!json) return null;
  try {
    // The kernel wraps the two standalone wire shapes under these keys; an
    // absent (or null) half is a shape mismatch, and the ports refuse it.
    const parsed = JSON.parse(json) as {
      receipts?: unknown;
      governedConsumers?: unknown;
    } | null;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      parsed.receipts === undefined ||
      parsed.receipts === null ||
      parsed.governedConsumers === undefined ||
      parsed.governedConsumers === null
    ) {
      return null;
    }
    return { rawBundle: parsed.receipts, governedConsumers: parsed.governedConsumers };
  } catch {
    return null;
  }
}

export function computeSpectralFacts(
  handle: number,
  timeColumn?: string,
  valueColumn?: string
): SpectralFacts | null {
  const owner = getRawRuntimeExports();
  let timePtr = 0;
  let timeLen = 0;
  let valuePtr = 0;
  let valueLen = 0;
  try {
    if (timeColumn) {
      const allocation = allocBytes(new TextEncoder().encode(timeColumn));
      timePtr = allocation.ptr;
      timeLen = allocation.len;
    }
    if (valueColumn) {
      const allocation = allocBytes(new TextEncoder().encode(valueColumn));
      valuePtr = allocation.ptr;
      valueLen = allocation.len;
    }
    const json = readPreparedResult(
      (runtime) =>
        runtime.data_prepare_spectral_facts(handle, timePtr, timeLen, valuePtr, valueLen),
      { nullOnReadMismatch: true }
    );
    if (!json || json === 'null') return null;
    return JSON.parse(json) as SpectralFacts;
  } finally {
    if (valueLen > 0) owner.host_buffer_dealloc(valuePtr, valueLen);
    if (timeLen > 0) owner.host_buffer_dealloc(timePtr, timeLen);
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
  const json = tdaCall(handle, params, 'data_compute_mapper_graph');
  if (!json) return null;
  return JSON.parse(json) as TdaMapperGraph;
}

export function computePersistenceIntervals(
  handle: number,
  params: Record<string, unknown>
): PersistenceInterval[] | null {
  const json = tdaCall(handle, params, 'data_compute_persistence_intervals');
  if (!json) return null;
  return JSON.parse(json) as PersistenceInterval[];
}

export function computeBetti0Curve(
  handle: number,
  params: Record<string, unknown>
): BettiPoint[] | null {
  const json = tdaCall(handle, params, 'data_compute_betti0_curve');
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

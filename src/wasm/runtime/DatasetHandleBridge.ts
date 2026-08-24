import type {
  BettiPoint,
  ColumnSchema,
  DatasetJSON,
  EncodingMapping,
  Facts,
  OperationSpec,
  PersistenceInterval,
  SpectralFacts,
  TdaMapperGraph,
} from '../../data/types.ts';
import { allocBytes, deallocBytes, readBytes, readString } from './MemoryAbi.ts';
import { getDatasetHandleExports as getRuntimeExports } from './RuntimeState.ts';
import type { DatasetHandleExports, MemoryAbiExports } from './RuntimeExports.ts';

type DatasetHandleRuntime = DatasetHandleExports & MemoryAbiExports;

function readStringExport(
  wasm: DatasetHandleRuntime,
  invoke: (outPtr: number, outLen: number) => number
): string | null {
  const required = invoke(0, 0);
  if (required === 0) return null;
  const ptr = wasm.alloc(required);
  try {
    const written = invoke(ptr, required);
    if (written === 0) return null;
    return readString(ptr, written);
  } finally {
    wasm.dealloc(ptr, required);
  }
}

function tdaCall(
  wasm: DatasetHandleRuntime,
  handle: number,
  params: Record<string, unknown>,
  exportName:
    'data_compute_mapper_graph' | 'data_compute_persistence_intervals' | 'data_compute_betti0_curve'
): string | null {
  const paramBytes = new TextEncoder().encode(JSON.stringify(params));
  const { ptr: paramPtr, len: paramLen } = allocBytes(paramBytes);
  try {
    return readStringExport(wasm, (outPtr, outLen) => {
      const fn = wasm[exportName] as (
        h: number,
        pp: number,
        pl: number,
        p: number,
        l: number
      ) => number;
      return fn(handle, paramPtr, paramLen, outPtr, outLen);
    });
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
    wasm.dealloc(ptr, len);
  }
}

export function loadJson(bytes: Uint8Array): number {
  const wasm = getRuntimeExports();
  const { ptr, len } = allocBytes(bytes);
  try {
    return wasm.data_load_json(ptr, len);
  } finally {
    wasm.dealloc(ptr, len);
  }
}

export function loadSample(key: string): number {
  const wasm = getRuntimeExports();
  const bytes = new TextEncoder().encode(key);
  const { ptr, len } = allocBytes(bytes);
  try {
    return wasm.data_load_sample(ptr, len);
  } finally {
    wasm.dealloc(ptr, len);
  }
}

export function sampleKeys(): string[] {
  const wasm = getRuntimeExports();
  const len = 256;
  const ptr = wasm.alloc(len);
  try {
    const written = wasm.data_sample_keys(ptr, len);
    const value = readString(ptr, written);
    return value.split(',').filter(Boolean);
  } finally {
    wasm.dealloc(ptr, len);
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
  if (required === 0) return null;
  const ptr = wasm.alloc(required);
  try {
    const written = wasm.dataset_to_json(handle, ptr, required);
    const json = readString(ptr, written);
    return JSON.parse(json) as DatasetJSON;
  } finally {
    wasm.dealloc(ptr, required);
  }
}

export function loadDatasetJson(obj: DatasetJSON): number {
  const wasm = getRuntimeExports();
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const { ptr, len } = allocBytes(bytes);
  try {
    return wasm.data_load_dataset_json(ptr, len);
  } finally {
    wasm.dealloc(ptr, len);
  }
}

export function runOperation(handle: number, op: OperationSpec): number {
  const wasm = getRuntimeExports();
  const bytes = new TextEncoder().encode(JSON.stringify(op));
  const { ptr, len } = allocBytes(bytes);
  try {
    return wasm.data_operation(handle, ptr, len);
  } finally {
    wasm.dealloc(ptr, len);
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
  return readStringExport(wasm, (ptr, len) => wasm.dataset_fingerprint(handle, ptr, len));
}

export function inferTopology(handle: number): string | null {
  const wasm = getRuntimeExports();
  return readStringExport(wasm, (ptr, len) => wasm.data_infer_topology(handle, ptr, len));
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
    const json = readStringExport(wasm, (ptr, len) =>
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
  const json = readStringExport(wasm, (ptr, len) => wasm.data_infer_schema(handle, ptr, len));
  if (!json) return null;
  return JSON.parse(json) as ColumnSchema[];
}

export function statistics(handle: number): Facts | null {
  const wasm = getRuntimeExports();
  const json = readStringExport(wasm, (ptr, len) => wasm.data_statistics(handle, ptr, len));
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
    const json = readStringExport(wasm, (ptr, len) =>
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
  if (needed === 0) return null;
  const outPtr = wasm.alloc(needed);
  try {
    wasm.data_compute_structure_profile(handle, outPtr, needed);
    const resultBytes = readBytes(outPtr, needed);
    return JSON.parse(new TextDecoder().decode(resultBytes)) as Record<string, unknown>;
  } finally {
    wasm.dealloc(outPtr, needed);
  }
}

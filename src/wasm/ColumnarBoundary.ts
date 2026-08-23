import type { DatasetJSON, OperationSpec } from '../data/types.ts';
import {
  call,
  destroyDataset,
  loadCsv,
  loadDatasetJson,
  loadJson,
  readString,
  runOperation,
} from './RuntimeBridge.ts';

/**
 * Columnar-native metadata accessor. This is the application-facing row-count
 * boundary and must never materialise compatibility rows.
 */
export function datasetRowCount(handle: number): number {
  return Number(call('canonical_dataset_row_count', handle) ?? 0);
}

/**
 * Columnar-native metadata accessor. This is the application-facing
 * column-count boundary and must never materialise compatibility rows.
 */
export function datasetColumnCount(handle: number): number {
  return Number(call('canonical_dataset_column_count', handle) ?? 0);
}

/**
 * Diagnostic counter exposed by Rust so tests/telemetry can detect explicit
 * crossings into the row-major compatibility view.
 */
export function rowMaterialisationCount(): number {
  return Number(call('compatibility_row_materialisation_count') ?? 0);
}

/**
 * Explicit compatibility export using the standard two-call output-buffer ABI.
 * Calling this function is intentionally observable: a columnar-first handle
 * materialises its cached row view exactly when a JSON consumer asks for it.
 */
export function getDatasetJson(handle: number): DatasetJSON | null {
  const required = Number(call('compatibility_dataset_to_json', handle, 0, 0) ?? 0);
  if (required === 0) return null;

  const ptr = Number(call('alloc', required) ?? 0);
  if (ptr === 0) throw new Error('WASM alloc returned 0');
  try {
    const written = Number(call('compatibility_dataset_to_json', handle, ptr, required) ?? 0);
    if (written === 0 || written > required) return null;
    return JSON.parse(readString(ptr, written)) as DatasetJSON;
  } finally {
    call('dealloc', ptr, required);
  }
}

/**
 * Parse import bytes and explicitly cross into the JSON compatibility view for
 * the JS Dataset facade. Analytical callers should retain the Rust handle and
 * use columnar APIs instead.
 */
export function parseDatasetBytes(bytes: Uint8Array, ext: 'csv' | 'json'): DatasetJSON | null {
  const handle = ext === 'csv' ? loadCsv(bytes) : loadJson(bytes);
  if (handle === 0) return null;
  try {
    return getDatasetJson(handle);
  } finally {
    destroyDataset(handle);
  }
}

/**
 * Legacy operation facade. Generic row operations remain an explicit
 * compatibility crossing until each operation is migrated to a columnar-native
 * implementation.
 */
export function executeOperation(datasetObj: DatasetJSON, op: OperationSpec): DatasetJSON | null {
  const inputHandle = loadDatasetJson(datasetObj);
  if (inputHandle === 0) return null;

  let outputHandle = 0;
  try {
    outputHandle = runOperation(inputHandle, op);
    if (outputHandle === 0) return null;
    return getDatasetJson(outputHandle);
  } finally {
    destroyDataset(inputHandle);
    if (outputHandle !== 0) destroyDataset(outputHandle);
  }
}

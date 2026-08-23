import type { DatasetJSON, OperationSpec } from '../data/types.ts';
import {
  allocBytes,
  call,
  deallocBytes,
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

  const allocation = allocBytes(new Uint8Array(required));
  try {
    const written = Number(
      call('compatibility_dataset_to_json', handle, allocation.ptr, allocation.len) ?? 0,
    );
    if (written === 0 || written > allocation.len) return null;
    return JSON.parse(readString(allocation.ptr, written)) as DatasetJSON;
  } finally {
    deallocBytes(allocation.ptr, allocation.len);
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
  const outputHandle = runOperation(inputHandle, op);
  try {
    if (outputHandle === 0) return null;
    return getDatasetJson(outputHandle);
  } finally {
    destroyDataset(inputHandle);
    if (outputHandle !== 0) destroyDataset(outputHandle);
  }
}

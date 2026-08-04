/**
 * JS host bridge for the Nemosyne Rust/WASM runtime.
 *
 * Responsibilities:
 * - Load the wasm-pack generated module and `.wasm` binary.
 * - Provide typed-memory helpers (`allocBytes`, `readBytes`, `readF32`, etc.).
 * - Expose a small typed interface over the exported Rust functions.
 * - Read the per-frame command buffer once `update()` is implemented.
 *
 * The ABI surface is intentionally narrow: all hot-path data is exchanged
 * through `(ptr, len)` pairs into shared WASM memory; only integer handles and
 * primitives cross the wasm-bindgen boundary.
 */

import type { DatasetJSON, OperationSpec } from '../data/types.js';

/**
 * wasm-bindgen `--target web` exports an `init` function plus the public Rust
 * API. We keep this interface intentionally loose because the ABI is versioned
 * by capability flags, not by TypeScript types.
 */
interface WasmModule {
  default(wasmUrl?: string | URL): Promise<void>;
  init(seed: bigint): number;
  ping(): number;
  memory(): WebAssembly.Memory;
  alloc(len: number): number;
  dealloc(ptr: number, len: number): void;
  fill_pattern(ptr: number, len: number): number;
  update(deltaMs: number, timeMs: number): number;
  capabilities(): number;
  data_load_csv(ptr: number, len: number): number;
  data_load_json(ptr: number, len: number): number;
  data_load_dataset_json(ptr: number, len: number): number;
  data_load_sample(ptr: number, len: number): number;
  data_sample_keys(ptr: number, len: number): number;
  dataset_row_count(handle: number): number;
  dataset_column_count(handle: number): number;
  dataset_destroy(handle: number): void;
  dataset_to_json(handle: number, ptr: number, len: number): number;
  data_operation(handle: number, ptr: number, len: number): number;
  [key: string]: unknown;
}

interface AllocResult {
  ptr: number;
  len: number;
}

let wasmModule: WasmModule | null = null;
let memoryView: DataView | null = null;

/**
 * Initialise the WASM runtime.
 *
 * The wasm-pack generated module is loaded lazily so that builds which do not
 * run `wasm-pack` still bundle and start without a hard import-time dependency
 * on the generated `wasm/pkg/` directory. When the module is present (dev, or
 * after `npm run build:wasm`) it is fetched and initialised; otherwise the
 * caller can fall back to the JS implementation.
 *
 * @param wasmUrl - Optional URL to the `.wasm` binary. When omitted, the
 *   wasm-pack init function fetches it relative to its own JS URL.
 * @returns The raw wasm-bindgen exports.
 */
export async function initRuntime(wasmUrl?: string | URL): Promise<WasmModule> {
  if (wasmModule) return wasmModule;

  // Absolute path is preserved by Vite as an external runtime fetch; it points
  // at the wasm-pack output served from the project root in dev.
  // @vite-ignore prevents Vite from trying to resolve the optional wasm-pack
  // output at transform time, so tests and production builds work without it.
  const wasmModuleUrl = '/wasm/pkg/nemosyne_wasm.js';
  const mod = (await import(/* @vite-ignore */ wasmModuleUrl)) as WasmModule;

  // wasm-pack --target web exports an `init` function that fetches the binary.
  await mod.default(wasmUrl);
  wasmModule = mod;
  refreshMemoryView();

  // Seed the runtime. Phase 0 returns a sentinel handle of 1.
  const handle = wasmModule.init(0x1234_5678_9abc_def0n);
  if (handle !== 1) {
    throw new Error(`Unexpected runtime handle: ${handle}`);
  }

  // Verify the health-check ABI.
  if (wasmModule.ping() !== 42) {
    throw new Error('WASM ping health check failed');
  }

  return wasmModule;
}

/**
 * Refresh the cached memory view after WASM memory has grown.
 */
export function refreshMemoryView(): void {
  if (!wasmModule) throw new Error('Runtime not initialised');
  const memory = wasmModule.memory();
  memoryView = new DataView(memory.buffer);
}

/**
 * @returns The shared WebAssembly memory buffer.
 */
export function memory(): WebAssembly.Memory {
  if (!wasmModule) throw new Error('Runtime not initialised');
  return wasmModule.memory();
}

/**
 * Copy a Uint8Array into WASM memory and return the allocated offset.
 */
export function allocBytes(bytes: Uint8Array): AllocResult {
  if (!wasmModule) throw new Error('Runtime not initialised');
  const len = bytes.length;
  const ptr = wasmModule.alloc(len);
  if (ptr === 0 && len > 0) {
    throw new Error('WASM alloc returned 0');
  }
  const memory = wasmModule.memory();
  new Uint8Array(memory.buffer, ptr, len).set(bytes);
  return { ptr, len };
}

/**
 * Release a previous `allocBytes` allocation.
 */
export function deallocBytes(ptr: number, len: number): void {
  if (!wasmModule) throw new Error('Runtime not initialised');
  wasmModule.dealloc(ptr, len);
}

/**
 * Read `len` bytes from WASM memory starting at `ptr`.
 */
export function readBytes(ptr: number, len: number): Uint8Array {
  if (!wasmModule) throw new Error('Runtime not initialised');
  const memory = wasmModule.memory();
  return new Uint8Array(memory.buffer, ptr, len).slice();
}

/**
 * Read a UTF-8 string from WASM memory.
 */
export function readString(ptr: number, len: number): string {
  const bytes = readBytes(ptr, len);
  return new TextDecoder().decode(bytes);
}

/**
 * Read a little-endian f32 value from WASM memory.
 */
export function readF32(ptr: number): number {
  if (!memoryView) refreshMemoryView();
  return memoryView!.getFloat32(ptr, true);
}

/**
 * Read a little-endian u32 value from WASM memory.
 */
export function readU32(ptr: number): number {
  if (!memoryView) refreshMemoryView();
  return memoryView!.getUint32(ptr, true);
}

/**
 * Per-frame update. For Phase 0/1 this only proves the call path; later phases
 * consume the returned command-buffer byte count.
 *
 * @returns Number of bytes in the current frame command buffer.
 */
export function update(deltaMs: number, timeMs: number): number {
  if (!wasmModule) throw new Error('Runtime not initialised');
  return wasmModule.update(deltaMs, timeMs);
}

/**
 * Load CSV bytes into the Rust data layer and return a dataset handle.
 *
 * @returns Dataset handle, or 0 on failure.
 */
export function loadCsv(bytes: Uint8Array): number {
  if (!wasmModule) throw new Error('Runtime not initialised');
  const { ptr, len } = allocBytes(bytes);
  try {
    return wasmModule.data_load_csv(ptr, len);
  } finally {
    wasmModule.dealloc(ptr, len);
  }
}

/**
 * Load JSON bytes into the Rust data layer and return a dataset handle.
 *
 * @returns Dataset handle, or 0 on failure.
 */
export function loadJson(bytes: Uint8Array): number {
  if (!wasmModule) throw new Error('Runtime not initialised');
  const { ptr, len } = allocBytes(bytes);
  try {
    return wasmModule.data_load_json(ptr, len);
  } finally {
    wasmModule.dealloc(ptr, len);
  }
}

/**
 * Load a built-in sample dataset by key into the Rust data layer.
 *
 * @returns Dataset handle, or 0 on failure / unknown key.
 */
export function loadSample(key: string): number {
  if (!wasmModule) throw new Error('Runtime not initialised');
  const bytes = new TextEncoder().encode(key);
  const { ptr, len } = allocBytes(bytes);
  try {
    return wasmModule.data_load_sample(ptr, len);
  } finally {
    wasmModule.dealloc(ptr, len);
  }
}

/**
 * Return the list of sample dataset keys supported by the Rust runtime.
 */
export function sampleKeys(): string[] {
  if (!wasmModule) throw new Error('Runtime not initialised');
  const len = 256;
  const ptr = wasmModule.alloc(len);
  try {
    const written = wasmModule.data_sample_keys(ptr, len);
    const s = readString(ptr, written);
    return s.split(',').filter(Boolean);
  } finally {
    wasmModule.dealloc(ptr, len);
  }
}

/**
 * @returns The number of rows in a dataset, or 0 for invalid handles.
 */
export function datasetRowCount(handle: number): number {
  if (!wasmModule) throw new Error('Runtime not initialised');
  return wasmModule.dataset_row_count(handle);
}

/**
 * @returns The number of columns in a dataset, or 0 for invalid handles.
 */
export function datasetColumnCount(handle: number): number {
  if (!wasmModule) throw new Error('Runtime not initialised');
  return wasmModule.dataset_column_count(handle);
}

/**
 * Release a dataset handle.
 */
export function destroyDataset(handle: number): void {
  if (!wasmModule) throw new Error('Runtime not initialised');
  wasmModule.dataset_destroy(handle);
}

/**
 * Load a CSV or JSON byte array through the Rust parser and return a plain
 * JS object matching `src/data/Dataset.ts` `toJSON()`.
 */
export function parseDatasetBytes(bytes: Uint8Array, ext: 'csv' | 'json'): DatasetJSON | null {
  if (!wasmModule) throw new Error('Runtime not initialised');
  const handle = ext === 'csv' ? loadCsv(bytes) : loadJson(bytes);
  if (handle === 0) return null;
  try {
    return getDatasetJson(handle);
  } finally {
    destroyDataset(handle);
  }
}

/**
 * Fetch a Rust dataset handle as a plain JS object matching
 * `src/data/Dataset.ts` `toJSON()`.
 */
export function getDatasetJson(handle: number): DatasetJSON | null {
  if (!wasmModule) throw new Error('Runtime not initialised');
  const required = wasmModule.dataset_to_json(handle, 0, 0);
  if (required === 0) {
    return null;
  }
  const ptr = wasmModule.alloc(required);
  try {
    const written = wasmModule.dataset_to_json(handle, ptr, required);
    const json = readString(ptr, written);
    return JSON.parse(json) as DatasetJSON;
  } finally {
    wasmModule.dealloc(ptr, required);
  }
}

/**
 * Load a JS `Dataset.toJSON()` object into the Rust data layer and return a
 * dataset handle. Returns `0` on failure.
 */
export function loadDatasetJson(obj: DatasetJSON): number {
  if (!wasmModule) throw new Error('Runtime not initialised');
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  const { ptr, len } = allocBytes(bytes);
  try {
    return wasmModule.data_load_dataset_json(ptr, len);
  } finally {
    wasmModule.dealloc(ptr, len);
  }
}

/**
 * Apply a generic data operation to a Rust dataset handle and return a new
 * dataset handle. Returns `0` on failure.
 */
export function runOperation(handle: number, op: OperationSpec): number {
  if (!wasmModule) throw new Error('Runtime not initialised');
  const json = JSON.stringify(op);
  const bytes = new TextEncoder().encode(json);
  const { ptr, len } = allocBytes(bytes);
  try {
    return wasmModule.data_operation(handle, ptr, len);
  } finally {
    wasmModule.dealloc(ptr, len);
  }
}

/**
 * Execute a generic operation against a JS `Dataset` through the Rust data
 * layer and return the resulting JS dataset object. Returns `null` on failure.
 */
export function executeOperation(datasetObj: DatasetJSON, op: OperationSpec): DatasetJSON | null {
  if (!wasmModule) throw new Error('Runtime not initialised');
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

/**
 * Low-level call helper used by integration tests. Only a small set of
 * operations is exposed; this keeps the host surface narrow.
 */
export function call(name: string, ...args: unknown[]): unknown {
  if (!wasmModule) throw new Error('Runtime not initialised');
  const fn = wasmModule[name];
  if (typeof fn !== 'function') {
    throw new Error(`Unknown WASM export: ${name}`);
  }
  return fn(...args);
}

/**
 * @returns Whether the WASM runtime has been initialised.
 */
export function isReady(): boolean {
  return wasmModule !== null;
}

/**
 * Return the enabled Rust-side capability set.
 */
export function capabilities(): number {
  if (!wasmModule) throw new Error('Runtime not initialised');
  return wasmModule.capabilities();
}

/**
 * Debug helper: allocate a small buffer, fill it with the Rust test pattern,
 * and return the bytes so tests can verify zero-copy reads.
 */
export function debugFillPattern(len: number): Uint8Array {
  if (!wasmModule) throw new Error('Runtime not initialised');
  const ptr = wasmModule.alloc(len);
  wasmModule.fill_pattern(ptr, len);
  const bytes = readBytes(ptr, len);
  wasmModule.dealloc(ptr, len);
  return bytes;
}

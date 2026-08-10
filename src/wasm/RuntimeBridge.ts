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
interface WasmInitInput { module_or_path?: string | URL | Request | Response | BufferSource | WebAssembly.Module; }
/** Mirrors the InitOutput interface from wasm-bindgen --target web. */
interface WasmInitOutput {
  memory: WebAssembly.Memory;
  init(seed: bigint): number;
  ping(): number;
  alloc(len: number): number;
  dealloc(ptr: number, len: number): void;
  fill_pattern(ptr: number, len: number): number;
  command_buffer_ptr(): number;
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
interface WasmModule {
  default(wasmUrl?: string | URL | WasmInitInput): Promise<void>;
  [key: string]: unknown;
}

interface AllocResult {
  ptr: number;
  len: number;
}

let wasmInstance: WasmInitOutput | null = null;
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

  // Check if WASM package exists before dynamic import to avoid browser 404 network warnings
  try {
    const check = await fetch('/wasm/pkg/nemosyne_wasm.js', { method: 'HEAD' });
    if (!check.ok) {
      throw new Error('WASM module package not found (run npm run dev:wasm to enable WASM)');
    }
  } catch (err) {
    throw new Error(`WASM package unavailable: ${(err as Error).message}`);
  }

  const wasmModuleUrl = '/wasm/pkg/nemosyne_wasm.js';
  const mod = (await import(/* @vite-ignore */ wasmModuleUrl)) as WasmModule;

  // wasm-pack --target web exports an `init` (default) function that returns
  // an InitOutput with `memory` as a plain property, not a callable.
  // The WasmModule interface declares it as Promise<void> for external compat;
  // cast to WasmInitOutput to access the instance exports.
  const targetWasmUrl = typeof wasmUrl === 'string' ? wasmUrl : '/wasm/pkg/nemosyne_wasm_bg.wasm';
  // The wasm-bindgen default() returns InitOutput (memory + exports). The
  // WasmModule interface declares it as Promise<void> for external compatibility;
  // double-cast through unknown to access the typed instance properties.
  wasmInstance = (await (mod.default as unknown as (i: WasmInitInput) => Promise<WasmInitOutput>)(
    { module_or_path: targetWasmUrl }
  ));
  wasmModule = mod;
  refreshMemoryView();

  // Seed the runtime. Phase 0 returns a sentinel handle of 1.
  const handle = wasmInstance.init(0x1234_5678_9abc_def0n);
  if (handle !== 1) {
    throw new Error(`Unexpected runtime handle: ${handle}`);
  }

  // Verify the health-check ABI.
  if (wasmInstance.ping() !== 42) {
    throw new Error('WASM ping health check failed');
  }

  return mod;
}

/**
 * Refresh the cached memory view after WASM memory has grown.
 */
export function refreshMemoryView(): void {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  // `memory` is a WebAssembly.Memory property on InitOutput, not a function.
  memoryView = new DataView(wasmInstance.memory.buffer);
}

/**
 * @returns The shared WebAssembly memory buffer.
 */
export function memory(): WebAssembly.Memory {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  return wasmInstance.memory;
}

/**
 * Copy a Uint8Array into WASM memory and return the allocated offset.
 */
export function allocBytes(bytes: Uint8Array): AllocResult {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  const len = bytes.length;
  if (len === 0) {
    return { ptr: 0, len: 0 };
  }
  const ptr = wasmInstance.alloc(len);
  if (ptr === 0) {
    throw new Error('WASM alloc returned 0');
  }
  new Uint8Array(wasmInstance.memory.buffer, ptr, len).set(bytes);
  return { ptr, len };
}

/**
 * Release a previous `allocBytes` allocation.
 */
export function deallocBytes(ptr: number, len: number): void {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  if (ptr === 0 || len === 0) return;
  wasmInstance.dealloc(ptr, len);
}

/**
 * Read `len` bytes from WASM memory starting at `ptr`.
 */
export function readBytes(ptr: number, len: number): Uint8Array {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  return new Uint8Array(wasmInstance.memory.buffer, ptr, len).slice();
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
  if (!wasmInstance) throw new Error('Runtime not initialised');
  return wasmInstance.update(deltaMs, timeMs);
}

/**
 * Load CSV bytes into the Rust data layer and return a dataset handle.
 *
 * @returns Dataset handle, or 0 on failure.
 */
export function loadCsv(bytes: Uint8Array): number {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  const { ptr, len } = allocBytes(bytes);
  try {
    return wasmInstance.data_load_csv(ptr, len);
  } finally {
    wasmInstance.dealloc(ptr, len);
  }
}

/**
 * Load JSON bytes into the Rust data layer and return a dataset handle.
 *
 * @returns Dataset handle, or 0 on failure.
 */
export function loadJson(bytes: Uint8Array): number {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  const { ptr, len } = allocBytes(bytes);
  try {
    return wasmInstance.data_load_json(ptr, len);
  } finally {
    wasmInstance.dealloc(ptr, len);
  }
}

/**
 * Load a built-in sample dataset by key into the Rust data layer.
 *
 * @returns Dataset handle, or 0 on failure / unknown key.
 */
export function loadSample(key: string): number {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  const bytes = new TextEncoder().encode(key);
  const { ptr, len } = allocBytes(bytes);
  try {
    return wasmInstance.data_load_sample(ptr, len);
  } finally {
    wasmInstance.dealloc(ptr, len);
  }
}

/**
 * Return the list of sample dataset keys supported by the Rust runtime.
 */
export function sampleKeys(): string[] {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  const len = 256;
  const ptr = wasmInstance.alloc(len);
  try {
    const written = wasmInstance.data_sample_keys(ptr, len);
    const s = readString(ptr, written);
    return s.split(',').filter(Boolean);
  } finally {
    wasmInstance.dealloc(ptr, len);
  }
}

/**
 * @returns The number of rows in a dataset, or 0 for invalid handles.
 */
export function datasetRowCount(handle: number): number {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  return wasmInstance.dataset_row_count(handle);
}

/**
 * @returns The number of columns in a dataset, or 0 for invalid handles.
 */
export function datasetColumnCount(handle: number): number {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  return wasmInstance.dataset_column_count(handle);
}

/**
 * Release a dataset handle.
 */
export function destroyDataset(handle: number): void {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  wasmInstance.dataset_destroy(handle);
}

/**
 * Load a CSV or JSON byte array through the Rust parser and return a plain
 * JS object matching `src/data/Dataset.ts` `toJSON()`.
 */
export function parseDatasetBytes(bytes: Uint8Array, ext: 'csv' | 'json'): DatasetJSON | null {
  if (!wasmInstance) throw new Error('Runtime not initialised');
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
  if (!wasmInstance) throw new Error('Runtime not initialised');
  const required = wasmInstance.dataset_to_json(handle, 0, 0);
  if (required === 0) {
    return null;
  }
  const ptr = wasmInstance.alloc(required);
  try {
    const written = wasmInstance.dataset_to_json(handle, ptr, required);
    const json = readString(ptr, written);
    return JSON.parse(json) as DatasetJSON;
  } finally {
    wasmInstance.dealloc(ptr, required);
  }
}

/**
 * Load a JS `Dataset.toJSON()` object into the Rust data layer and return a
 * dataset handle. Returns `0` on failure.
 */
export function loadDatasetJson(obj: DatasetJSON): number {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  const { ptr, len } = allocBytes(bytes);
  try {
    return wasmInstance.data_load_dataset_json(ptr, len);
  } finally {
    wasmInstance.dealloc(ptr, len);
  }
}

/**
 * Apply a generic data operation to a Rust dataset handle and return a new
 * dataset handle. Returns `0` on failure.
 */
export function runOperation(handle: number, op: OperationSpec): number {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  const json = JSON.stringify(op);
  const bytes = new TextEncoder().encode(json);
  const { ptr, len } = allocBytes(bytes);
  try {
    return wasmInstance.data_operation(handle, ptr, len);
  } finally {
    wasmInstance.dealloc(ptr, len);
  }
}

/**
 * Execute a generic operation against a JS `Dataset` through the Rust data
 * layer and return the resulting JS dataset object. Returns `null` on failure.
 */
export function executeOperation(datasetObj: DatasetJSON, op: OperationSpec): DatasetJSON | null {
  if (!wasmInstance) throw new Error('Runtime not initialised');
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
  if (!wasmInstance) throw new Error('Runtime not initialised');
  const fn = wasmInstance[name as keyof WasmInitOutput];
  if (typeof fn !== 'function') {
    throw new Error(`Unknown WASM export: ${name}`);
  }
  return (fn as (...a: unknown[]) => unknown)(...args);
}

/**
 * @returns Whether the WASM runtime has been initialised.
 */
export function isReady(): boolean {
  return wasmInstance !== null;
}

/**
 * Return the enabled Rust-side capability set.
 */
export function capabilities(): number {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  return wasmInstance.capabilities();
}

/**
 * Debug helper: allocate a small buffer, fill it with the Rust test pattern,
 * and return the bytes so tests can verify zero-copy reads.
 */
export function debugFillPattern(len: number): Uint8Array {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  const ptr = wasmInstance.alloc(len);
  wasmInstance.fill_pattern(ptr, len);
  const bytes = readBytes(ptr, len);
  wasmInstance.dealloc(ptr, len);
  return bytes;
}

/**
  * Return the WASM command buffer pointer.
  */
export function commandBufferPtr(): number {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  return wasmInstance.command_buffer_ptr();
}

/**
  * Read the raw bytes of the current WASM frame command buffer.
  */
export function getCommandBufferBytes(byteLength: number): Uint8Array {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  const ptr = wasmInstance.command_buffer_ptr();
  if (ptr === 0 || byteLength === 0) return new Uint8Array(0);
  return readBytes(ptr, byteLength);
}

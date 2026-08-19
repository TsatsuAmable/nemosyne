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

import type {
  DatasetJSON,
  OperationSpec,
  Facts,
  Provenance,
  EncodingMapping,
  TdaMapperGraph,
  PersistenceInterval,
  BettiPoint,
  ColumnSchema,
} from '../data/types.ts';
export { CapabilityFlags, type CapabilityName } from './capabilities.ts';

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
  // Wave 1 analytical-kernel exports.
  data_parse_arrow(ptr: number, len: number): number;
  dataset_fingerprint(handle: number, ptr: number, len: number): number;
  kernel_version(ptr: number, len: number): number;
  kernel_provenance(ptr: number, len: number): number;
  data_infer_topology(handle: number, ptr: number, len: number): number;
  data_infer_encodings(
    handle: number,
    topoPtr: number,
    topoLen: number,
    ptr: number,
    len: number,
  ): number;
  data_infer_schema(handle: number, ptr: number, len: number): number;
  data_statistics(handle: number, ptr: number, len: number): number;
  data_compute_mapper_graph(
    handle: number,
    paramsPtr: number,
    paramsLen: number,
    ptr: number,
    len: number,
  ): number;
  data_compute_persistence_intervals(
    handle: number,
    paramsPtr: number,
    paramsLen: number,
    ptr: number,
    len: number,
  ): number;
  data_compute_betti0_curve(
    handle: number,
    paramsPtr: number,
    paramsLen: number,
    ptr: number,
    len: number,
  ): number;
  data_compute_radial_tree_3d(
    levelsPtr: number,
    levelsLen: number,
    ringSpacing: number,
    yStep: number,
    yOffset: number,
    ptr: number,
    len: number,
  ): number;
  data_compute_time_ribbon_3d(
    seriesPtr: number,
    seriesLen: number,
    timesPtr: number,
    timesLen: number,
    valuesPtr: number,
    valuesLen: number,
    xScale: number,
    yScale: number,
    zSpacing: number,
    yOffset: number,
    ptr: number,
    len: number,
  ): number;
  data_compute_geo_surface_3d(
    lonsPtr: number,
    lonsLen: number,
    latsPtr: number,
    latsLen: number,
    valuesPtr: number,
    valuesLen: number,
    roomWidth: number,
    roomDepth: number,
    heightScale: number,
    yOffset: number,
    ptr: number,
    len: number,
  ): number;
  data_compute_streamline_3d(
    count: number,
    steps: number,
    stepSize: number,
    seed: bigint,
    ptr: number,
    len: number,
  ): number;
  layout_grid_3d(count: number, spacing: number, yOffset: number, outPtr: number): number;
  layout_force_directed_3d(
    count: number,
    iterations: number,
    repulsion: number,
    attraction: number,
    damping: number,
    radius: number,
    yOffset: number,
    outPtr: number,
  ): number;
  draco_solve(factsPtr: number, factsLen: number, outPtr: number, outLen: number): number;
  draco_evaluate_candidate(
    inputPtr: number,
    inputLen: number,
    outPtr: number,
    outLen: number,
  ): number;
  draco_adjust_evidence(
    inputPtr: number,
    inputLen: number,
    outPtr: number,
    outLen: number,
  ): number;
  intent_compile(inputPtr: number, inputLen: number, outPtr: number, outLen: number): number;
  atlas_discover_structures(
    inputPtr: number,
    inputLen: number,
    outPtr: number,
    outLen: number,
  ): number;
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

/**
 * Explicit system state of the Rust/WASM analytical kernel.
 *
 * Architectural Invariant (Vision §5 & Rule AGENTS.md):
 * The Rust/WASM analytical kernel is the SOLE AND EXCLUSIVE analytical authority.
 * There is NO JavaScript analytical fallback. When the kernel is unavailable,
 * the system transitions to an explicit `UNAVAILABLE` state, disabling analytical
 * execution while permitting non-analytical UI diagnostic shells or import staging.
 */
export type KernelState = 'UNINITIALIZED' | 'INITIALIZING' | 'READY' | 'UNAVAILABLE';

/**
 * Thrown whenever an analytical or kernel operation is attempted while the
 * Rust/WASM kernel is not in the READY state.
 */
export class KernelUnavailableError extends Error {
  readonly code = 'KERNEL_UNAVAILABLE';
  readonly state: KernelState;
  readonly reason: string;

  constructor(
    reason = 'Analytical kernel unavailable. Rust/WASM is the sole analytical authority.',
    state: KernelState = 'UNAVAILABLE'
  ) {
    super(`[KernelUnavailable] ${reason}`);
    this.name = 'KernelUnavailableError';
    this.state = state;
    this.reason = reason;
    Object.setPrototypeOf(this, KernelUnavailableError.prototype);
  }
}

let wasmInstance: WasmInitOutput | null = null;
let wasmModule: WasmModule | null = null;
let memoryView: DataView | null = null;
let kernelState: KernelState = 'UNINITIALIZED';
let kernelUnavailableReason: string | null = null;

/**
 * @returns The current lifecycle state of the Rust/WASM analytical kernel.
 */
export function getKernelState(): KernelState {
  return kernelState;
}

/**
 * @returns Diagnostic error string explaining why the kernel is unavailable, if any.
 */
export function getKernelUnavailableReason(): string | null {
  return kernelUnavailableReason;
}

/**
 * Assert that the analytical runtime is in the READY state, or throw an explicit KernelUnavailableError.
 */
export function requireRuntime(): WasmInitOutput {
  if (!wasmInstance || kernelState !== 'READY') {
    throw new KernelUnavailableError(
      kernelUnavailableReason || 'Analytical kernel has not been initialized (run npm run dev:wasm or build:wasm).',
      kernelState
    );
  }
  return wasmInstance;
}

/**
 * Initialise the WASM runtime.
 *
 * The wasm-pack generated module is loaded lazily so that builds which do not
 * run `wasm-pack` still bundle and start without a hard import-time dependency
 * on the generated `wasm/pkg/` directory. When the module is present, it is
 * fetched and initialised into the `READY` state. If the kernel cannot be
 * loaded, the system transitions to an explicit `UNAVAILABLE` state with
 * diagnostic telemetry — NO silent JavaScript analytical fallback is permitted.
 *
 * @param wasmUrl - Optional URL to the `.wasm` binary.
 * @returns The raw wasm-bindgen exports.
 * @throws {KernelUnavailableError} If the kernel package or binary is missing or invalid.
 */
export async function initRuntime(wasmUrl?: string | URL): Promise<WasmModule> {
  if (wasmModule && kernelState === 'READY') return wasmModule;

  kernelState = 'INITIALIZING';
  kernelUnavailableReason = null;

  // Check if WASM package exists before dynamic import to avoid browser 404 network warnings
  try {
    const check = await fetch('/wasm/pkg/nemosyne_wasm.js', { method: 'HEAD' });
    if (!check.ok) {
      kernelState = 'UNAVAILABLE';
      kernelUnavailableReason = 'WASM module package not found (run npm run dev:wasm or npm run wasm to enable analytical kernel)';
      throw new KernelUnavailableError(kernelUnavailableReason, 'UNAVAILABLE');
    }
  } catch (err) {
    kernelState = 'UNAVAILABLE';
    kernelUnavailableReason = `WASM package unavailable: ${(err as Error).message}`;
    throw new KernelUnavailableError(kernelUnavailableReason, 'UNAVAILABLE');
  }

  try {
    const wasmModuleUrl = '/wasm/pkg/nemosyne_wasm.js';
    const mod = (await import(/* @vite-ignore */ wasmModuleUrl)) as WasmModule;

    // Install the host clock the kernel imports as `nemosyneNowMs` for provenance
    // timestamps. wasm-bindgen resolves this import from `globalThis` at
    // instantiation time, so it must be present before `mod.default(...)` runs.
    (globalThis as unknown as Record<string, unknown>).nemosyneNowMs = () => Date.now();

    // wasm-pack --target web exports an `init` (default) function that returns
    // an InitOutput with `memory` as a plain property, not a callable.
    // The WasmModule interface declares it as Promise<void> for external compat;
    // cast to WasmInitOutput to access the instance exports.
    const targetWasmUrl = typeof wasmUrl === 'string' ? wasmUrl : '/wasm/pkg/nemosyne_wasm_bg.wasm';
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

    kernelState = 'READY';
    kernelUnavailableReason = null;
    return mod;
  } catch (err) {
    kernelState = 'UNAVAILABLE';
    kernelUnavailableReason = (err as Error).message;
    wasmInstance = null;
    wasmModule = null;
    if (err instanceof KernelUnavailableError) throw err;
    throw new KernelUnavailableError(kernelUnavailableReason, 'UNAVAILABLE');
  }
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
 * Returns a DataView over the WASM memory buffer, automatically refreshing
 * if memory.grow() has reallocated the underlying buffer.
 */
export function getMemoryView(): DataView {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  if (!memoryView || memoryView.buffer !== wasmInstance.memory.buffer) {
    memoryView = new DataView(wasmInstance.memory.buffer);
  }
  return memoryView;
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
 * Read `len` bytes from WASM memory starting at `ptr`. Bounds-checked: returns
 * an empty buffer if `ptr + len` is outside the current `memory.buffer` (e.g. a
 * stale pointer captured before a memory grow, or the dormant
 * `command_buffer_ptr()` sentinel), so the dormant command-buffer path can never
 * throw a `RangeError`.
 */
export function readBytes(ptr: number, len: number): Uint8Array {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  if (ptr < 0 || len < 0 || ptr + len > wasmInstance.memory.buffer.byteLength) {
    return new Uint8Array(0);
  }
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
  return getMemoryView().getFloat32(ptr, true);
}

/**
 * Read a little-endian u32 value from WASM memory.
 */
export function readU32(ptr: number): number {
  return getMemoryView().getUint32(ptr, true);
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

// ---------------------------------------------------------------------------
// Wave 1 analytical-kernel typed wrappers
// ---------------------------------------------------------------------------
//
// Every result-bearing call here causes the kernel to record a provenance
// envelope, readable immediately afterwards via `kernelProvenance()`. The
// string/JSON exports use the two-call `(out_ptr, out_len)` size-query
// protocol shared with `getDatasetJson`.

/**
 * Two-call `(out_ptr, out_len)` string-read protocol. Call with `(0, 0)` to
 * query the required byte length, allocate, then read. Returns `null` when the
 * kernel reports no result (e.g. an invalid handle).
 */
function readStringExport(invoke: (outPtr: number, outLen: number) => number): string | null {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  const required = invoke(0, 0);
  if (required === 0) return null;
  const ptr = wasmInstance.alloc(required);
  try {
    const written = invoke(ptr, required);
    if (written === 0) return null;
    return readString(ptr, written);
  } finally {
    wasmInstance.dealloc(ptr, required);
  }
}

/**
 * Run a TDA export that takes a JSON `params` payload plus the `(out_ptr,
 * out_len)` string-result protocol. Returns the raw JSON string or `null`.
 */
function tdaCall(
  handle: number,
  params: Record<string, unknown>,
  exportName: 'data_compute_mapper_graph' | 'data_compute_persistence_intervals' | 'data_compute_betti0_curve',
): string | null {
  const paramBytes = new TextEncoder().encode(JSON.stringify(params));
  const { ptr: paramPtr, len: paramLen } = allocBytes(paramBytes);
  try {
    return readStringExport((outPtr, outLen) => {
      const fn = wasmInstance![exportName] as (
        h: number,
        pp: number,
        pl: number,
        p: number,
        l: number,
      ) => number;
      return fn(handle, paramPtr, paramLen, outPtr, outLen);
    });
  } finally {
    deallocBytes(paramPtr, paramLen);
  }
}

/** @returns The canonical kernel version string (e.g. `0.2.0`). */
export function kernelVersion(): string | null {
  return readStringExport((p, l) => wasmInstance!.kernel_version(p, l));
}

/** @returns The provenance envelope recorded by the most recent kernel call. */
export function kernelProvenance(): Provenance | null {
  const json = readStringExport((p, l) => wasmInstance!.kernel_provenance(p, l));
  if (!json) return null;
  return JSON.parse(json) as Provenance;
}

/** @returns The canonical FNV-1a fingerprint of a dataset (8 hex chars). */
export function datasetFingerprint(handle: number): string | null {
  return readStringExport((p, l) => wasmInstance!.dataset_fingerprint(handle, p, l));
}

/**
 * @returns The inferred topology name
 * (`TABULAR`/`HIERARCHY`/`GRAPH`/`TIME_SERIES`/`VECTOR_FIELD`/`GEO`/`FLOW`).
 */
export function inferTopology(handle: number): string | null {
  return readStringExport((p, l) => wasmInstance!.data_infer_topology(handle, p, l));
}

/**
 * Infer the logical encoding mapping. Pass a topology name for the
 * topology-aware variant; omit it for the topology-unaware default.
 */
export function inferEncodings(handle: number, topology?: string): EncodingMapping | null {
  let topoPtr = 0;
  let topoLen = 0;
  if (topology) {
    const r = allocBytes(new TextEncoder().encode(topology));
    topoPtr = r.ptr;
    topoLen = r.len;
  }
  try {
    const json = readStringExport((p, l) =>
      wasmInstance!.data_infer_encodings(handle, topoPtr, topoLen, p, l),
    );
    if (!json) return null;
    return JSON.parse(json) as EncodingMapping;
  } finally {
    if (topoLen > 0) deallocBytes(topoPtr, topoLen);
  }
}

/** @returns The column schema `[ {name, type}, … ]`. */
export function inferSchema(handle: number): ColumnSchema[] | null {
  const json = readStringExport((p, l) => wasmInstance!.data_infer_schema(handle, p, l));
  if (!json) return null;
  return JSON.parse(json) as ColumnSchema[];
}

/** @returns The full `Facts` statistics block. */
export function statistics(handle: number): Facts | null {
  const json = readStringExport((p, l) => wasmInstance!.data_statistics(handle, p, l));
  if (!json) return null;
  return JSON.parse(json) as Facts;
}

/**
 * Parse an Arrow IPC payload and return a dataset handle. Returns `0` on error.
 */
export function parseArrow(bytes: Uint8Array): number {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  const { ptr, len } = allocBytes(bytes);
  try {
    return wasmInstance.data_parse_arrow(ptr, len);
  } finally {
    deallocBytes(ptr, len);
  }
}

/**
 * Compute the TDA Mapper graph. `params`:
 * `{ featureColumns: string[], filterValues: number[], bins?: number, overlap?: number }`.
 */
export function computeMapperGraph(
  handle: number,
  params: Record<string, unknown>,
): TdaMapperGraph | null {
  const json = tdaCall(handle, params, 'data_compute_mapper_graph');
  if (!json) return null;
  return JSON.parse(json) as TdaMapperGraph;
}

/**
 * Compute 1D persistence intervals. `params`:
 * `{ featureColumns: string[], filterValues: number[], maxDistance?: number }`.
 */
export function computePersistenceIntervals(
  handle: number,
  params: Record<string, unknown>,
): PersistenceInterval[] | null {
  const json = tdaCall(handle, params, 'data_compute_persistence_intervals');
  if (!json) return null;
  return JSON.parse(json) as PersistenceInterval[];
}

/**
 * Compute the Betti-0 curve. `params`: `{ featureColumns: string[], steps?: number }`.
 */
export function computeBetti0Curve(
  handle: number,
  params: Record<string, unknown>,
): BettiPoint[] | null {
  const json = tdaCall(handle, params, 'data_compute_betti0_curve');
  if (!json) return null;
  return JSON.parse(json) as BettiPoint[];
}

/**
 * Compute 3D radial-tree positions. Returns a `Float32Array` of `count * 3`
 * little-endian values (`x,y,z` per node), or `null` on failure.
 */
export function computeRadialTree3d(
  levels: number[],
  ringSpacing: number,
  yStep: number,
  yOffset: number,
): Float32Array | null {
  if (!wasmInstance || levels.length === 0) return null;
  const levelBytes = new TextEncoder().encode(JSON.stringify(levels));
  const { ptr: levelPtr, len: levelLen } = allocBytes(levelBytes);
  try {
    const needed = wasmInstance.data_compute_radial_tree_3d(
      levelPtr,
      levelLen,
      ringSpacing,
      yStep,
      yOffset,
      0,
      0,
    );
    if (needed === 0) return null;
    const outPtr = wasmInstance.alloc(needed);
    try {
      const written = wasmInstance.data_compute_radial_tree_3d(
        levelPtr,
        levelLen,
        ringSpacing,
        yStep,
        yOffset,
        outPtr,
        needed,
      );
      if (written === 0) return null;
      return new Float32Array(wasmInstance.memory.buffer, outPtr, written / 4).slice();
    } finally {
      wasmInstance.dealloc(outPtr, needed);
    }
  } finally {
    deallocBytes(levelPtr, levelLen);
  }
}

/**
 * Compute 3D grid layout positions. Returns a `Float32Array` of `count * 3`
 * little-endian values (`x,y,z` per node), or `null` on failure.
 */
export function computeGrid3d(count: number, spacing: number, yOffset: number): Float32Array | null {
  if (!wasmInstance || count <= 0) return null;
  const needed = count * 12;
  const outPtr = wasmInstance.alloc(needed);
  try {
    const written = wasmInstance.layout_grid_3d(count, spacing, yOffset, outPtr);
    if (written === 0) return null;
    return new Float32Array(wasmInstance.memory.buffer, outPtr, count * 3).slice();
  } finally {
    wasmInstance.dealloc(outPtr, needed);
  }
}

/**
 * Compute 3D force-directed layout positions.
 */
export function computeForceDirected3d(
  count: number,
  iterations = 120,
  repulsion = 120,
  attraction = 0.02,
  damping = 0.08,
  radius = 4,
  yOffset = 1.2,
): Float32Array | null {
  if (!wasmInstance || count <= 0) return null;
  const needed = count * 12;
  const outPtr = wasmInstance.alloc(needed);
  try {
    const written = wasmInstance.layout_force_directed_3d(
      count,
      iterations,
      repulsion,
      attraction,
      damping,
      radius,
      yOffset,
      outPtr,
    );
    if (written === 0) return null;
    return new Float32Array(wasmInstance.memory.buffer, outPtr, count * 3).slice();
  } finally {
    wasmInstance.dealloc(outPtr, needed);
  }
}

/**
 * Compute 3D time-series ribbon positions.
 */
export function computeTimeRibbon3d(
  seriesIds: number[],
  timestamps: number[],
  values: number[],
  xScale = 0.8,
  yScale = 0.2,
  zSpacing = 1.5,
  yOffset = 1.2,
): Float32Array | null {
  if (!wasmInstance || seriesIds.length === 0) return null;
  const seriesBytes = new TextEncoder().encode(JSON.stringify(seriesIds));
  const timesBytes = new TextEncoder().encode(JSON.stringify(timestamps));
  const valuesBytes = new TextEncoder().encode(JSON.stringify(values));

  const { ptr: sPtr, len: sLen } = allocBytes(seriesBytes);
  const { ptr: tPtr, len: tLen } = allocBytes(timesBytes);
  const { ptr: vPtr, len: vLen } = allocBytes(valuesBytes);

  try {
    const needed = wasmInstance.data_compute_time_ribbon_3d(
      sPtr,
      sLen,
      tPtr,
      tLen,
      vPtr,
      vLen,
      xScale,
      yScale,
      zSpacing,
      yOffset,
      0,
      0,
    );
    if (needed === 0) return null;
    const outPtr = wasmInstance.alloc(needed);
    try {
      const written = wasmInstance.data_compute_time_ribbon_3d(
        sPtr,
        sLen,
        tPtr,
        tLen,
        vPtr,
        vLen,
        xScale,
        yScale,
        zSpacing,
        yOffset,
        outPtr,
        needed,
      );
      if (written === 0) return null;
      return new Float32Array(wasmInstance.memory.buffer, outPtr, written / 4).slice();
    } finally {
      wasmInstance.dealloc(outPtr, needed);
    }
  } finally {
    deallocBytes(sPtr, sLen);
    deallocBytes(tPtr, tLen);
    deallocBytes(vPtr, vLen);
  }
}

/**
 * Compute 3D geo-surface positions.
 */
export function computeGeoSurface3d(
  longitudes: number[],
  latitudes: number[],
  values: number[],
  roomWidth = 6,
  roomDepth = 3,
  heightScale = 0.05,
  yOffset = 0.5,
): Float32Array | null {
  if (!wasmInstance || longitudes.length === 0) return null;
  const lonsBytes = new TextEncoder().encode(JSON.stringify(longitudes));
  const latsBytes = new TextEncoder().encode(JSON.stringify(latitudes));
  const valuesBytes = new TextEncoder().encode(JSON.stringify(values));

  const { ptr: lonPtr, len: lonLen } = allocBytes(lonsBytes);
  const { ptr: latPtr, len: latLen } = allocBytes(latsBytes);
  const { ptr: valPtr, len: valLen } = allocBytes(valuesBytes);

  try {
    const needed = wasmInstance.data_compute_geo_surface_3d(
      lonPtr,
      lonLen,
      latPtr,
      latLen,
      valPtr,
      valLen,
      roomWidth,
      roomDepth,
      heightScale,
      yOffset,
      0,
      0,
    );
    if (needed === 0) return null;
    const outPtr = wasmInstance.alloc(needed);
    try {
      const written = wasmInstance.data_compute_geo_surface_3d(
        lonPtr,
        lonLen,
        latPtr,
        latLen,
        valPtr,
        valLen,
        roomWidth,
        roomDepth,
        heightScale,
        yOffset,
        outPtr,
        needed,
      );
      if (written === 0) return null;
      return new Float32Array(wasmInstance.memory.buffer, outPtr, written / 4).slice();
    } finally {
      wasmInstance.dealloc(outPtr, needed);
    }
  } finally {
    deallocBytes(lonPtr, lonLen);
    deallocBytes(latPtr, latLen);
    deallocBytes(valPtr, valLen);
  }
}

/**
 * Compute 3D streamline positions.
 */
export function computeStreamline3d(
  count: number,
  steps = 3,
  stepSize = 2,
  seed = 1,
): Float32Array | null {
  if (!wasmInstance || count <= 0) return null;
  const totalPoints = count * (steps + 1);
  const needed = totalPoints * 12;
  const outPtr = wasmInstance.alloc(needed);
  try {
    const written = wasmInstance.data_compute_streamline_3d(
      count,
      steps,
      stepSize,
      BigInt(seed),
      outPtr,
      needed,
    );
    if (written === 0) return null;
    return new Float32Array(wasmInstance.memory.buffer, outPtr, written / 4).slice();
  } finally {
    wasmInstance.dealloc(outPtr, needed);
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
 * @returns Whether the WASM runtime has been initialised and is in the READY state.
 */
export function isReady(): boolean {
  return wasmInstance !== null && kernelState === 'READY';
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
  *
  * **Dormant:** the command buffer is not implemented; the Rust export returns
  * `0` as the "not implemented" sentinel (see `command_buffer_ptr` doc in
  * `wasm/src/lib.rs`). No `src/` caller invokes this; it exists for the future
  * `SCENE_RUST` + `COMMAND_BUFFER` cutover.
  */
export function commandBufferPtr(): number {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  return wasmInstance.command_buffer_ptr();
}

/**
  * Read the raw bytes of the current WASM frame command buffer.
  *
  * **Dormant:** `command_buffer_ptr()` returns `0`, so this returns an empty
  * buffer (the `ptr === 0` short-circuit). No `src/` caller invokes this.
  */
export function getCommandBufferBytes(byteLength: number): Uint8Array {
  if (!wasmInstance) throw new Error('Runtime not initialised');
  const ptr = wasmInstance.command_buffer_ptr();
  if (ptr === 0 || byteLength === 0) return new Uint8Array(0);
  return readBytes(ptr, byteLength);
}

function callJsonAbi(
  fn: (inPtr: number, inLen: number, outPtr: number, outLen: number) => number,
  input: unknown,
): unknown | null {
  const inputBytes = new TextEncoder().encode(JSON.stringify(input));
  const { ptr: inPtr, len: inLen } = allocBytes(inputBytes);
  try {
    const needed = fn(inPtr, inLen, 0, 0);
    if (needed === 0) return null;
    const outPtr = wasmInstance!.alloc(needed);
    fn(inPtr, inLen, outPtr, needed);
    const resultBytes = readBytes(outPtr, needed);
    wasmInstance!.dealloc(outPtr, needed);
    return JSON.parse(new TextDecoder().decode(resultBytes));
  } finally {
    wasmInstance!.dealloc(inPtr, inLen);
  }
}

export function solveDraco(facts: Record<string, unknown>): Record<string, unknown> | null {
  if (!wasmInstance) return null;
  const factsBytes = new TextEncoder().encode(JSON.stringify(facts));
  const { ptr: factsPtr, len: factsLen } = allocBytes(factsBytes);
  try {
    const needed = wasmInstance.draco_solve(factsPtr, factsLen, 0, 0);
    if (needed === 0) return null;
    const outPtr = wasmInstance.alloc(needed);
    wasmInstance.draco_solve(factsPtr, factsLen, outPtr, needed);
    const resultBytes = readBytes(outPtr, needed);
    wasmInstance.dealloc(outPtr, needed);
    return JSON.parse(new TextDecoder().decode(resultBytes)) as Record<string, unknown>;
  } finally {
    wasmInstance.dealloc(factsPtr, factsLen);
  }
}

export function evaluateDracoCandidate(
  facts: Record<string, unknown>,
  spec: Record<string, unknown>,
): { valid: boolean; cost: number; violations: string[] } | null {
  if (!wasmInstance) return null;
  return callJsonAbi(
    wasmInstance.draco_evaluate_candidate.bind(wasmInstance),
    { facts, spec },
  ) as { valid: boolean; cost: number; violations: string[] } | null;
}

export function adjustDracoEvidence(
  baseCost: number,
  evidence: { sampleCount: number; compositeUtility: number } | null,
): { adjustedCost: number; delta: number } | null {
  if (!wasmInstance) return null;
  return callJsonAbi(
    wasmInstance.draco_adjust_evidence.bind(wasmInstance),
    { baseCost, evidence },
  ) as { adjustedCost: number; delta: number } | null;
}

export function compileIntent(
  query: string,
  schema: { columns: { name: string; kind?: string }[] },
): Record<string, unknown> | null {
  if (!wasmInstance) return null;
  return callJsonAbi(
    wasmInstance.intent_compile.bind(wasmInstance),
    { query, schema },
  ) as Record<string, unknown> | null;
}

export function discoverStructures(
  assignments: number[],
  datumIds: string[],
  fingerprint: string,
  version: number,
  algorithmVersion: string,
  parameters: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!wasmInstance) return null;
  return callJsonAbi(
    wasmInstance.atlas_discover_structures.bind(wasmInstance),
    { assignments, datumIds, fingerprint, version, algorithmVersion, parameters },
  ) as Record<string, unknown> | null;
}

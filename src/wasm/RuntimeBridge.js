/**
 * JS host bridge for the Nemosyne Rust/WASM runtime.
 *
 * Responsibilities:
 * - Load the wasm-pack generated module and `.wasm` binary.
 * - Provide typed-memory helpers (`alloc_bytes`, `read_bytes`, `read_f32`, etc.).
 * - Expose a small typed interface over the exported Rust functions.
 * - Read the per-frame command buffer once `update()` is implemented.
 *
 * The ABI surface is intentionally narrow: all hot-path data is exchanged
 * through `(ptr, len)` pairs into shared WASM memory; only integer handles and
 * primitives cross the wasm-bindgen boundary.
 */

import initWasm, * as raw from '../../wasm/pkg/nemosyne_wasm.js';

let wasmModule = null;
let memoryView = null;

/**
 * Initialise the WASM runtime.
 *
 * @param {string|URL} [wasmUrl] - Optional URL to the `.wasm` binary. In dev
 *   the Vite plugin serves it at `/wasm/nemosyne_wasm_bg.wasm`; in production
 *   it is copied to `dist/wasm/`.
 * @returns {Promise<object>} The raw wasm-bindgen exports.
 */
export async function initRuntime(wasmUrl) {
  if (wasmModule) return wasmModule;

  // wasm-pack --target web exports an `init` function that fetches the binary.
  await initWasm(wasmUrl);
  wasmModule = raw;
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
export function refreshMemoryView() {
  if (!wasmModule) throw new Error('Runtime not initialised');
  const memory = wasmModule.memory();
  memoryView = new DataView(memory.buffer);
}

/**
 * @returns {WebAssembly.Memory}
 */
export function memory() {
  if (!wasmModule) throw new Error('Runtime not initialised');
  return wasmModule.memory();
}

/**
 * Copy a Uint8Array into WASM memory and return the allocated offset.
 *
 * @param {Uint8Array} bytes
 * @returns {{ ptr: number, len: number }}
 */
export function allocBytes(bytes) {
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
 *
 * @param {number} ptr
 * @param {number} len
 */
export function deallocBytes(ptr, len) {
  if (!wasmModule) throw new Error('Runtime not initialised');
  wasmModule.dealloc(ptr, len);
}

/**
 * Read `len` bytes from WASM memory starting at `ptr`.
 *
 * @param {number} ptr
 * @param {number} len
 * @returns {Uint8Array}
 */
export function readBytes(ptr, len) {
  if (!wasmModule) throw new Error('Runtime not initialised');
  const memory = wasmModule.memory();
  return new Uint8Array(memory.buffer, ptr, len).slice();
}

/**
 * Read a UTF-8 string from WASM memory.
 *
 * @param {number} ptr
 * @param {number} len
 * @returns {string}
 */
export function readString(ptr, len) {
  const bytes = readBytes(ptr, len);
  return new TextDecoder().decode(bytes);
}

/**
 * Read a little-endian f32 value from WASM memory.
 *
 * @param {number} ptr
 * @returns {number}
 */
export function readF32(ptr) {
  if (!memoryView) refreshMemoryView();
  return memoryView.getFloat32(ptr, true);
}

/**
 * Read a little-endian u32 value from WASM memory.
 *
 * @param {number} ptr
 * @returns {number}
 */
export function readU32(ptr) {
  if (!memoryView) refreshMemoryView();
  return memoryView.getUint32(ptr, true);
}

/**
 * Per-frame update. For Phase 0 this only proves the call path; later phases
 * consume the returned command-buffer byte count.
 *
 * @param {number} deltaMs
 * @param {number} timeMs
 * @returns {number} Number of bytes in the current frame command buffer.
 */
export function update(deltaMs, timeMs) {
  if (!wasmModule) throw new Error('Runtime not initialised');
  return wasmModule.update(deltaMs, timeMs);
}

/**
 * Low-level call helper used by integration tests. Only a small set of
 * operations is exposed; this keeps the host surface narrow.
 *
 * @param {'ping'|'alloc'|'dealloc'|'update'|'memory'|'command_buffer_ptr'} name
 * @param {...any} args
 * @returns {any}
 */
export function call(name, ...args) {
  if (!wasmModule) throw new Error('Runtime not initialised');
  const fn = wasmModule[name];
  if (typeof fn !== 'function') {
    throw new Error(`Unknown WASM export: ${name}`);
  }
  return fn(...args);
}

/**
 * @returns {boolean}
 */
export function isReady() {
  return wasmModule !== null;
}

/**
 * Debug helper: allocate a small buffer, fill it with the Rust test pattern,
 * and return the bytes so tests can verify zero-copy reads.
 *
 * @param {number} len
 * @returns {Uint8Array}
 */
export function debugFillPattern(len) {
  if (!wasmModule) throw new Error('Runtime not initialised');
  const ptr = wasmModule.alloc(len);
  wasmModule.fill_pattern(ptr, len);
  const bytes = readBytes(ptr, len);
  wasmModule.dealloc(ptr, len);
  return bytes;
}

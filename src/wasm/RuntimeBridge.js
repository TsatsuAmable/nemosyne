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

let wasmModule = null;
let memoryView = null;

/**
 * Initialise the WASM runtime.
 *
 * The wasm-pack generated module is loaded lazily so that builds which do not
 * run `wasm-pack` still bundle and start without a hard import-time dependency
 * on the generated `wasm/pkg/` directory. When the module is present (dev, or
 * after `npm run build:wasm`) it is fetched and initialised; otherwise the
 * caller can fall back to the JS implementation.
 *
 * @param {string|URL} [wasmUrl] - Optional URL to the `.wasm` binary. When
 *   omitted, the wasm-pack init function fetches it relative to its own JS URL.
 * @returns {Promise<object>} The raw wasm-bindgen exports.
 */
export async function initRuntime(wasmUrl) {
  if (wasmModule) return wasmModule;

  // Absolute path is preserved by Vite as an external runtime fetch; it points
  // at the wasm-pack output served from the project root in dev.
  const mod = await import('/wasm/pkg/nemosyne_wasm.js');

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
 * Load CSV bytes into the Rust data layer and return a dataset handle.
 *
 * @param {Uint8Array} bytes
 * @returns {number} Dataset handle, or 0 on failure.
 */
export function loadCsv(bytes) {
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
 * @param {Uint8Array} bytes
 * @returns {number} Dataset handle, or 0 on failure.
 */
export function loadJson(bytes) {
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
 * @param {string} key
 * @returns {number} Dataset handle, or 0 on failure / unknown key.
 */
export function loadSample(key) {
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
 *
 * @returns {string[]}
 */
export function sampleKeys() {
  if (!wasmModule) throw new Error('Runtime not initialised');
  const len = 64;
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
 * @param {number} handle
 * @returns {number}
 */
export function datasetRowCount(handle) {
  if (!wasmModule) throw new Error('Runtime not initialised');
  return wasmModule.dataset_row_count(handle);
}

/**
 * @param {number} handle
 * @returns {number}
 */
export function datasetColumnCount(handle) {
  if (!wasmModule) throw new Error('Runtime not initialised');
  return wasmModule.dataset_column_count(handle);
}

/**
 * Release a dataset handle.
 *
 * @param {number} handle
 */
export function destroyDataset(handle) {
  if (!wasmModule) throw new Error('Runtime not initialised');
  wasmModule.dataset_destroy(handle);
}

/**
 * Load a CSV or JSON byte array through the Rust parser and return a plain
 * JS object matching `src/data/Dataset.js` `toJSON()`.
 *
 * @param {Uint8Array} bytes
 * @param {'csv'|'json'} ext
 * @returns {object|null}
 */
export function parseDatasetBytes(bytes, ext) {
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
 * `src/data/Dataset.js` `toJSON()`.
 *
 * @param {number} handle
 * @returns {object|null}
 */
export function getDatasetJson(handle) {
  if (!wasmModule) throw new Error('Runtime not initialised');
  const required = wasmModule.dataset_to_json(handle, 0, 0);
  if (required === 0) {
    return null;
  }
  const ptr = wasmModule.alloc(required);
  try {
    const written = wasmModule.dataset_to_json(handle, ptr, required);
    const json = readString(ptr, written);
    return JSON.parse(json);
  } finally {
    wasmModule.dealloc(ptr, required);
  }
}

/**
 * Load a JS `Dataset.toJSON()` object into the Rust data layer and return a
 * dataset handle. Returns `0` on failure.
 *
 * @param {object} obj
 * @returns {number}
 */
export function loadDatasetJson(obj) {
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
 *
 * @param {number} handle
 * @param {object} op
 * @returns {number}
 */
export function runOperation(handle, op) {
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
 *
 * @param {object} datasetObj
 * @param {object} op
 * @returns {object|null}
 */
export function executeOperation(datasetObj, op) {
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
 * Return the enabled Rust-side capability set.
 *
 * @returns {number}
 */
export function capabilities() {
  if (!wasmModule) throw new Error('Runtime not initialised');
  return wasmModule.capabilities();
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

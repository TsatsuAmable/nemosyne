import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const encoder = new TextEncoder();

const SCENARIOS = Object.freeze({
  tall10m: { rows: 10_000_000, primitiveColumns: 3, categoricalCardinality: 32 },
  wide1m: { rows: 1_000_000, primitiveColumns: 30, categoricalCardinality: 32 },
  highcard1m: { rows: 1_000_000, primitiveColumns: 3, categoricalCardinality: 250_000 },
});

function parseArgs(argv) {
  const requested = argv.filter((a) => a.startsWith('--scenario=')).map((a) => a.slice(11));
  return { scenarios: requested.length ? requested : Object.keys(SCENARIOS), json: argv.includes('--json') };
}

function pushString(parts, value) {
  const bytes = encoder.encode(value);
  if (bytes.length > 0xffff) throw new Error('string too long for NTC1');
  const len = new Uint8Array(2);
  new DataView(len.buffer).setUint16(0, bytes.length, true);
  parts.push(len, bytes);
}

function buildTypedPayload({ rows, primitiveColumns, categoricalCardinality }) {
  const parts = [];
  const header = new Uint8Array(12);
  header.set(encoder.encode('NTC1'), 0);
  const hv = new DataView(header.buffer);
  hv.setUint32(4, rows, true);
  hv.setUint32(8, primitiveColumns + 1, true);
  parts.push(header);

  for (let column = 0; column < primitiveColumns; column += 1) {
    parts.push(Uint8Array.of(column === primitiveColumns - 1 ? 2 : 1));
    pushString(parts, `p${column}`);
    const raw = new Uint8Array(rows * 8);
    const view = new DataView(raw.buffer);
    for (let i = 0; i < rows; i += 1) {
      const value = column === primitiveColumns - 1
        ? 1_700_000_000_000 + i * 1000
        : (i + 1) * (column + 1);
      view.setFloat64(i * 8, value, true);
    }
    parts.push(raw, new Uint8Array(rows).fill(1));
  }

  parts.push(Uint8Array.of(3));
  pushString(parts, 'cohort');
  const dictCount = new Uint8Array(4);
  new DataView(dictCount.buffer).setUint32(0, categoricalCardinality, true);
  parts.push(dictCount);
  for (let i = 0; i < categoricalCardinality; i += 1) pushString(parts, `c${i}`);
  const codes = new Uint8Array(rows * 4);
  const cv = new DataView(codes.buffer);
  for (let i = 0; i < rows; i += 1) cv.setUint32(i * 4, i % categoricalCardinality, true);
  parts.push(codes, new Uint8Array(rows).fill(1));

  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.byteLength; }
  return out;
}

async function runtime() {
  const jsPath = path.resolve('wasm/pkg/nemosyne_wasm.js');
  const wasmPath = path.resolve('wasm/pkg/nemosyne_wasm_bg.wasm');
  if (!fs.existsSync(jsPath) || !fs.existsSync(wasmPath)) throw new Error('run npm run wasm:dev first');
  globalThis.nemosyneNowMs = () => performance.now();
  const mod = await import(`${pathToFileURL(jsPath).href}?capacity=${Date.now()}-${Math.random()}`);
  const wasm = await mod.default(fs.readFileSync(wasmPath));
  wasm.init(0x1234_5678_9abc_def0n);
  return wasm;
}

function loadBytes(wasm, bytes) {
  const beforeAlloc = wasm.memory.buffer.byteLength;
  const ptr = wasm.host_buffer_alloc(bytes.byteLength);
  if (!ptr) throw new Error('host_buffer_alloc failed');
  new Uint8Array(wasm.memory.buffer, ptr, bytes.byteLength).set(bytes);
  const afterAlloc = wasm.memory.buffer.byteLength;
  const started = performance.now();
  const handle = wasm.data_load_typed_columns(ptr, bytes.byteLength);
  const loadMs = performance.now() - started;
  const afterLoad = wasm.memory.buffer.byteLength;
  wasm.host_buffer_dealloc(ptr, bytes.byteLength);
  if (!handle) throw new Error('typed load rejected');
  return { handle, loadMs, beforeAlloc, afterAlloc, afterLoad };
}

function scanPrimitives(wasm, handle, primitiveColumns, rows) {
  const started = performance.now();
  let checksum = 0;
  for (let column = 0; column < primitiveColumns; column += 1) {
    const len = wasm.typed_primitive_column_len(handle, column);
    if (len !== rows) throw new Error(`column ${column} length mismatch: ${len}`);
    const vp = wasm.typed_primitive_values_ptr(handle, column);
    const mp = wasm.typed_primitive_validity_ptr(handle, column);
    const values = new Float64Array(wasm.memory.buffer, vp, len);
    const validity = new Uint8Array(wasm.memory.buffer, mp, len);
    for (let i = 0; i < len; i += 1) if (validity[i]) checksum += values[i];
  }
  return { scanMs: performance.now() - started, checksum };
}

async function runScenario(name) {
  const config = SCENARIOS[name];
  if (!config) throw new Error(`unknown scenario ${name}`);
  global.gc?.();
  const buildStarted = performance.now();
  const payload = buildTypedPayload(config);
  const buildMs = performance.now() - buildStarted;
  const wasm = await runtime();
  const baselineBytes = wasm.memory.buffer.byteLength;

  const first = loadBytes(wasm, payload);
  const firstScan = scanPrimitives(wasm, first.handle, config.primitiveColumns, config.rows);
  const warmScan = scanPrimitives(wasm, first.handle, config.primitiveColumns, config.rows);
  wasm.typed_dataset_destroy(first.handle);
  const afterDestroy = wasm.memory.buffer.byteLength;

  const second = loadBytes(wasm, payload);
  const secondScan = scanPrimitives(wasm, second.handle, config.primitiveColumns, config.rows);
  wasm.typed_dataset_destroy(second.handle);
  const afterSecondDestroy = wasm.memory.buffer.byteLength;

  const logicalPrimitiveBytes = config.rows * config.primitiveColumns * 9;
  const logicalCategoricalBytes = config.rows * 5;
  const logicalCoreBytes = logicalPrimitiveBytes + logicalCategoricalBytes;

  return {
    scenario: name,
    ...config,
    payloadBytes: payload.byteLength,
    payloadBuildMs: buildMs,
    logicalCoreBytes,
    first: {
      rustLoadMs: first.loadMs,
      inputAllocationGrowthBytes: first.afterAlloc - first.beforeAlloc,
      totalWasmGrowthBytes: first.afterLoad - baselineBytes,
      coldScanMs: firstScan.scanMs,
      warmScanMs: warmScan.scanMs,
      checksum: firstScan.checksum,
    },
    cleanup: {
      wasmBytesAfterDestroy: afterDestroy,
      pagesRetainedAfterDestroyBytes: afterDestroy - baselineBytes,
    },
    reload: {
      rustLoadMs: second.loadMs,
      additionalWasmGrowthBytes: second.afterLoad - afterDestroy,
      scanMs: secondScan.scanMs,
      checksumParity: secondScan.checksum === firstScan.checksum,
      pagesAfterSecondDestroyBytes: afterSecondDestroy - baselineBytes,
    },
    ratios: {
      firstWasmGrowthToLogicalCore: (first.afterLoad - baselineBytes) / Math.max(1, logicalCoreBytes),
      payloadToLogicalCore: payload.byteLength / Math.max(1, logicalCoreBytes),
      coldToWarmScan: firstScan.scanMs / Math.max(0.0001, warmScan.scanMs),
    },
  };
}

async function main() {
  const { scenarios, json } = parseArgs(process.argv.slice(2));
  const results = [];
  for (const scenario of scenarios) results.push(await runScenario(scenario));
  const output = {
    schemaVersion: 1,
    purpose: 'Capacity characterization only; not a production promotion gate.',
    architecture: {
      wasmAddressModel: 'wasm32 linear memory',
      note: 'Results characterize resident whole-dataset limits and inform future chunked/record-batch interfaces.',
    },
    results,
  };
  if (json) console.log(JSON.stringify(output, null, 2)); else console.dir(output, { depth: null });
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

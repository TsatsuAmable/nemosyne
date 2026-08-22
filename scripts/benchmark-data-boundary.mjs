import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const TIERS = Object.freeze({
  '10k': 10_000,
  '100k': 100_000,
  '1m': 1_000_000,
  '10m': 10_000_000,
});

function parseArgs(argv) {
  const requested = [];
  let json = false;
  for (const arg of argv) {
    if (arg === '--all') {
      requested.push(...Object.keys(TIERS));
    } else if (arg.startsWith('--tier=')) {
      requested.push(arg.slice('--tier='.length).toLowerCase());
    } else if (arg === '--json') {
      json = true;
    }
  }
  const tiers = requested.length ? [...new Set(requested)] : ['10k'];
  for (const tier of tiers) {
    if (!(tier in TIERS)) {
      throw new Error(`Unknown tier '${tier}'. Expected one of: ${Object.keys(TIERS).join(', ')}`);
    }
  }
  return { tiers, json };
}

function buildDataset(rowCount) {
  const rows = new Array(rowCount);
  for (let i = 0; i < rowCount; i += 1) {
    rows[i] = {
      x: i,
      y: ((i * 48271) % 2147483647) / 2147483647,
      t: 1_700_000_000_000 + i * 1_000,
      cohort: `c${i % 32}`,
    };
  }
  return {
    name: `boundary-${rowCount}`,
    columns: [
      { name: 'x', type: 'NUMERIC' },
      { name: 'y', type: 'NUMERIC' },
      { name: 't', type: 'TEMPORAL' },
      { name: 'cohort', type: 'CATEGORICAL' },
    ],
    rows,
  };
}

function heapUsed() {
  return process.memoryUsage().heapUsed;
}

async function loadRuntime() {
  const pkgPath = path.resolve(process.cwd(), 'wasm/pkg/nemosyne_wasm.js');
  const wasmPath = path.resolve(process.cwd(), 'wasm/pkg/nemosyne_wasm_bg.wasm');
  if (!fs.existsSync(pkgPath) || !fs.existsSync(wasmPath)) {
    throw new Error('WASM package missing. Run `npm run wasm:dev` before benchmarking.');
  }
  globalThis.nemosyneNowMs = () => Date.now();
  const mod = await import(pathToFileURL(pkgPath).href);
  const bytes = fs.readFileSync(wasmPath);
  const wasm = await mod.default(bytes);
  const handle = wasm.init(0x1234_5678_9abc_def0n);
  if (handle !== 1 || wasm.ping() !== 42) {
    throw new Error('WASM runtime health check failed');
  }
  return wasm;
}

function allocBytes(wasm, bytes) {
  const ptr = wasm.alloc(bytes.length);
  if (!ptr && bytes.length) throw new Error('WASM allocation failed');
  if (bytes.length) new Uint8Array(wasm.memory.buffer, ptr, bytes.length).set(bytes);
  return ptr;
}

function loadDataset(wasm, bytes) {
  const ptr = allocBytes(wasm, bytes);
  try {
    return wasm.data_load_dataset_json(ptr, bytes.length);
  } finally {
    if (bytes.length) wasm.dealloc(ptr, bytes.length);
  }
}

function materializeDataset(wasm, handle) {
  const required = wasm.dataset_to_json(handle, 0, 0);
  if (!required) throw new Error('dataset_to_json returned 0 bytes');
  const ptr = wasm.alloc(required);
  if (!ptr) throw new Error('WASM allocation failed for materialisation');
  try {
    const written = wasm.dataset_to_json(handle, ptr, required);
    const copied = new Uint8Array(wasm.memory.buffer, ptr, written).slice();
    const text = new TextDecoder().decode(copied);
    return { bytes: written, parsed: JSON.parse(text) };
  } finally {
    wasm.dealloc(ptr, required);
  }
}

function roundMs(value) {
  return Math.round(value * 1000) / 1000;
}

async function runTier(wasm, tier) {
  const rows = TIERS[tier];
  global.gc?.();
  const heapStart = heapUsed();

  const generateStart = performance.now();
  const dataset = buildDataset(rows);
  const generateMs = performance.now() - generateStart;
  const heapAfterRows = heapUsed();

  const stringifyStart = performance.now();
  const jsonText = JSON.stringify(dataset);
  const jsonBytes = new TextEncoder().encode(jsonText);
  const stringifyMs = performance.now() - stringifyStart;
  const heapAfterJson = heapUsed();

  const loadStart = performance.now();
  const handle = loadDataset(wasm, jsonBytes);
  const loadMs = performance.now() - loadStart;
  if (!handle) throw new Error(`Rust rejected ${tier} benchmark dataset`);

  const wasmBytesAfterLoad = wasm.memory.buffer.byteLength;
  let materialized;
  let materializeMs;
  const materializeHeapStart = heapUsed();
  try {
    const materializeStart = performance.now();
    materialized = materializeDataset(wasm, handle);
    materializeMs = performance.now() - materializeStart;
  } finally {
    wasm.dataset_destroy(handle);
  }
  const heapAfterMaterialize = heapUsed();

  const reconstructedRows = Array.isArray(materialized.parsed.rows)
    ? materialized.parsed.rows.length
    : 0;
  if (reconstructedRows !== rows) {
    throw new Error(`Row-count mismatch: expected ${rows}, materialized ${reconstructedRows}`);
  }

  return {
    tier,
    rows,
    columns: dataset.columns.length,
    hostToWasmBytes: jsonBytes.byteLength,
    wasmToHostBytes: materialized.bytes,
    reconstructedRowObjects: reconstructedRows,
    generateMs: roundMs(generateMs),
    stringifyMs: roundMs(stringifyMs),
    rustLoadMs: roundMs(loadMs),
    materializeAndParseMs: roundMs(materializeMs),
    heapForRowsBytes: Math.max(0, heapAfterRows - heapStart),
    heapForSerializedInputBytes: Math.max(0, heapAfterJson - heapAfterRows),
    heapForMaterializedOutputBytes: Math.max(0, heapAfterMaterialize - materializeHeapStart),
    wasmMemoryBytesAfterLoad: wasmBytesAfterLoad,
    materialisations: 1,
  };
}

function printHuman(result) {
  console.log(`\n[${result.tier}] ${result.rows.toLocaleString()} rows`);
  console.log(`  host -> WASM: ${(result.hostToWasmBytes / 1_048_576).toFixed(2)} MiB`);
  console.log(`  WASM -> host: ${(result.wasmToHostBytes / 1_048_576).toFixed(2)} MiB`);
  console.log(`  Rust load: ${result.rustLoadMs.toFixed(3)} ms`);
  console.log(`  materialize + JSON.parse: ${result.materializeAndParseMs.toFixed(3)} ms`);
  console.log(`  reconstructed row objects: ${result.reconstructedRowObjects.toLocaleString()}`);
  console.log(`  WASM memory after load: ${(result.wasmMemoryBytesAfterLoad / 1_048_576).toFixed(2)} MiB`);
}

async function main() {
  const { tiers, json } = parseArgs(process.argv.slice(2));
  const wasm = await loadRuntime();
  const results = [];
  for (const tier of tiers) {
    const result = await runTier(wasm, tier);
    results.push(result);
    if (!json) printHuman(result);
  }
  if (json) console.log(JSON.stringify({ schemaVersion: 1, results }, null, 2));
}

main().catch((error) => {
  console.error(`[data-boundary-benchmark] ${error.stack || error.message}`);
  process.exitCode = 1;
});

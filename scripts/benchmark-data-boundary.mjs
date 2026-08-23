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

const PRIMITIVE_COLUMN_INDICES = Object.freeze([0, 1, 2]);

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
  for (const fn of [
    'host_buffer_alloc',
    'host_buffer_dealloc',
    'dataset_primitive_column_len',
    'dataset_primitive_column_values_ptr',
    'dataset_primitive_column_validity_ptr',
  ]) {
    if (typeof wasm[fn] !== 'function') {
      throw new Error(`WASM data-boundary ABI missing export: ${fn}`);
    }
  }
  return wasm;
}

function allocBytes(wasm, bytes) {
  const ptr = wasm.host_buffer_alloc(bytes.length);
  if (!ptr && bytes.length) throw new Error('WASM host-buffer allocation failed');
  if (bytes.length) new Uint8Array(wasm.memory.buffer, ptr, bytes.length).set(bytes);
  return ptr;
}

function freeBytes(wasm, ptr, len) {
  if (ptr && len) wasm.host_buffer_dealloc(ptr, len);
}

function loadDataset(wasm, bytes) {
  const ptr = allocBytes(wasm, bytes);
  try {
    return wasm.data_load_dataset_json(ptr, bytes.length);
  } finally {
    freeBytes(wasm, ptr, bytes.length);
  }
}

function materializeDataset(wasm, handle) {
  const required = wasm.dataset_to_json(handle, 0, 0);
  if (!required) throw new Error('dataset_to_json returned 0 bytes');
  const ptr = wasm.host_buffer_alloc(required);
  if (!ptr) throw new Error('WASM host-buffer allocation failed for materialisation');
  try {
    const written = wasm.dataset_to_json(handle, ptr, required);
    const copied = new Uint8Array(wasm.memory.buffer, ptr, written).slice();
    const text = new TextDecoder().decode(copied);
    return { bytes: written, parsed: JSON.parse(text) };
  } finally {
    wasm.host_buffer_dealloc(ptr, required);
  }
}

function consumePrimitiveColumns(wasm, handle, expectedRows) {
  let logicalBytes = 0;
  let checksum = 0;
  let validValues = 0;
  for (const columnIndex of PRIMITIVE_COLUMN_INDICES) {
    const len = wasm.dataset_primitive_column_len(handle, columnIndex);
    if (len !== expectedRows) {
      throw new Error(`Primitive column ${columnIndex} length ${len} != expected ${expectedRows}`);
    }
    const valuesPtr = wasm.dataset_primitive_column_values_ptr(handle, columnIndex);
    const validityPtr = wasm.dataset_primitive_column_validity_ptr(handle, columnIndex);
    if (!valuesPtr || !validityPtr) {
      throw new Error(`Primitive column ${columnIndex} returned an invalid pointer`);
    }
    const values = new Float64Array(wasm.memory.buffer, valuesPtr, len);
    const validity = new Uint8Array(wasm.memory.buffer, validityPtr, len);
    logicalBytes += values.byteLength + validity.byteLength;
    for (let i = 0; i < len; i += 1) {
      if (validity[i]) {
        checksum += values[i];
        validValues += 1;
      }
    }
  }
  return { logicalBytes, checksum, validValues };
}

function roundMs(value) {
  return Math.round(value * 1000) / 1000;
}

function roundRatio(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 1000) / 1000;
}

function safeRatio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : Number.POSITIVE_INFINITY;
}

function addDecisionMetrics(result) {
  return {
    ...result,
    decisionMetrics: {
      materializeVsFirstBorrowSpeedup: roundRatio(
        safeRatio(result.materializeAndParseMs, result.firstPrimitiveBorrowAndScanMs),
      ),
      materializeVsCachedBorrowSpeedup: roundRatio(
        safeRatio(result.materializeAndParseMs, result.cachedPrimitiveBorrowAndScanMs),
      ),
      fullJsonVsBorrowedPayloadBytes: roundRatio(
        safeRatio(result.wasmToHostBytes, result.borrowedPrimitiveLogicalBytes),
      ),
      hostInputVsBorrowedPayloadBytes: roundRatio(
        safeRatio(result.hostToWasmBytes, result.borrowedPrimitiveLogicalBytes),
      ),
      borrowCacheGrowthVsBorrowedPayload: roundRatio(
        safeRatio(result.wasmMemoryGrowthForBorrowCacheBytes, result.borrowedPrimitiveLogicalBytes),
      ),
      reconstructedRowsAvoided: result.reconstructedRowObjects - result.borrowedRowObjects,
    },
  };
}

function buildScaleDecision(results) {
  const byTier = new Map(results.map((result) => [result.tier, result]));
  const required = ['100k', '1m'];
  const missingTiers = required.filter((tier) => !byTier.has(tier));
  if (missingTiers.length) {
    return {
      status: 'INCOMPLETE',
      missingTiers,
      rationale: 'Canonical-columnar promotion requires like-for-like 100K and 1M evidence from the same run.',
    };
  }

  const hundredK = byTier.get('100k');
  const oneM = byTier.get('1m');
  const materializeScaling = safeRatio(oneM.materializeAndParseMs, hundredK.materializeAndParseMs);
  const cachedBorrowScaling = safeRatio(oneM.cachedPrimitiveBorrowAndScanMs, hundredK.cachedPrimitiveBorrowAndScanMs);
  const firstBorrowScaling = safeRatio(oneM.firstPrimitiveBorrowAndScanMs, hundredK.firstPrimitiveBorrowAndScanMs);
  const cacheGrowthRatio = safeRatio(oneM.wasmMemoryGrowthForBorrowCacheBytes, oneM.borrowedPrimitiveLogicalBytes);
  const cachedSpeedupAt1m = safeRatio(oneM.materializeAndParseMs, oneM.cachedPrimitiveBorrowAndScanMs);
  const firstSpeedupAt1m = safeRatio(oneM.materializeAndParseMs, oneM.firstPrimitiveBorrowAndScanMs);

  const gates = {
    zeroJsRowReconstruction: results.every((result) => result.borrowedRowObjects === 0),
    deterministicBorrowChecksum: results.every((result) => Number.isFinite(result.primitiveChecksum)),
    cachedBorrowMateriallyFasterAt1m: cachedSpeedupAt1m >= 3,
    firstBorrowFasterAt1m: firstSpeedupAt1m > 1,
    cachedBorrowScalingNoWorseThanMaterialization: cachedBorrowScaling <= materializeScaling * 1.25,
    firstBorrowScalingNoWorseThanMaterialization: firstBorrowScaling <= materializeScaling * 1.25,
    cacheGrowthBoundedToLogicalPayload: cacheGrowthRatio <= 1.5,
  };
  const passed = Object.values(gates).every(Boolean);

  return {
    status: passed ? 'PROMOTE_COLUMNAR_CANDIDATE' : 'HOLD_DUAL_REPRESENTATION',
    gates,
    ratios: {
      materializeScaling100kTo1m: roundRatio(materializeScaling),
      firstBorrowScaling100kTo1m: roundRatio(firstBorrowScaling),
      cachedBorrowScaling100kTo1m: roundRatio(cachedBorrowScaling),
      firstBorrowSpeedupAt1m: roundRatio(firstSpeedupAt1m),
      cachedBorrowSpeedupAt1m: roundRatio(cachedSpeedupAt1m),
      borrowCacheGrowthVsLogicalPayloadAt1m: roundRatio(cacheGrowthRatio),
    },
    rationale: passed
      ? 'The measured 100K/1M path clears the predeclared scale gates for a follow-up canonical-columnar cutover.'
      : 'At least one scale or memory gate failed; retain the transitional dual representation and investigate before cutover.',
  };
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
  let firstBorrow;
  let secondBorrow;
  let firstBorrowMs;
  let secondBorrowMs;
  let wasmBytesAfterFirstBorrow;
  let materialized;
  let materializeMs;
  const materializeHeapStart = heapUsed();
  try {
    const firstBorrowStart = performance.now();
    firstBorrow = consumePrimitiveColumns(wasm, handle, rows);
    firstBorrowMs = performance.now() - firstBorrowStart;
    wasmBytesAfterFirstBorrow = wasm.memory.buffer.byteLength;

    const secondBorrowStart = performance.now();
    secondBorrow = consumePrimitiveColumns(wasm, handle, rows);
    secondBorrowMs = performance.now() - secondBorrowStart;

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
  if (firstBorrow.validValues !== rows * PRIMITIVE_COLUMN_INDICES.length) {
    throw new Error(`Unexpected primitive validity count ${firstBorrow.validValues}`);
  }
  if (secondBorrow.checksum !== firstBorrow.checksum) {
    throw new Error('Primitive-column checksum changed between first and cached borrow');
  }

  return addDecisionMetrics({
    tier,
    rows,
    columns: dataset.columns.length,
    primitiveColumns: PRIMITIVE_COLUMN_INDICES.length,
    hostToWasmBytes: jsonBytes.byteLength,
    wasmToHostBytes: materialized.bytes,
    borrowedPrimitiveLogicalBytes: firstBorrow.logicalBytes,
    reconstructedRowObjects: reconstructedRows,
    borrowedRowObjects: 0,
    generateMs: roundMs(generateMs),
    stringifyMs: roundMs(stringifyMs),
    rustLoadMs: roundMs(loadMs),
    firstPrimitiveBorrowAndScanMs: roundMs(firstBorrowMs),
    cachedPrimitiveBorrowAndScanMs: roundMs(secondBorrowMs),
    materializeAndParseMs: roundMs(materializeMs),
    heapForRowsBytes: Math.max(0, heapAfterRows - heapStart),
    heapForSerializedInputBytes: Math.max(0, heapAfterJson - heapAfterRows),
    heapForMaterializedOutputBytes: Math.max(0, heapAfterMaterialize - materializeHeapStart),
    wasmMemoryBytesAfterLoad: wasmBytesAfterLoad,
    wasmMemoryBytesAfterFirstBorrow: wasmBytesAfterFirstBorrow,
    wasmMemoryGrowthForBorrowCacheBytes: Math.max(0, wasmBytesAfterFirstBorrow - wasmBytesAfterLoad),
    materialisations: 1,
    primitiveBorrowCacheBuilds: 1,
    primitiveBorrowCacheHits: 1,
    primitiveChecksum: firstBorrow.checksum,
    hostBufferAllocator: 'rust-global',
  });
}

function printHuman(result) {
  console.log(`\n[${result.tier}] ${result.rows.toLocaleString()} rows`);
  console.log(`  host -> WASM JSON: ${(result.hostToWasmBytes / 1_048_576).toFixed(2)} MiB`);
  console.log(`  WASM -> host full JSON: ${(result.wasmToHostBytes / 1_048_576).toFixed(2)} MiB`);
  console.log(`  borrowed primitive payload: ${(result.borrowedPrimitiveLogicalBytes / 1_048_576).toFixed(2)} MiB`);
  console.log(`  Rust load + sidecar build: ${result.rustLoadMs.toFixed(3)} ms`);
  console.log(`  first primitive borrow + full scan: ${result.firstPrimitiveBorrowAndScanMs.toFixed(3)} ms`);
  console.log(`  cached primitive borrow + full scan: ${result.cachedPrimitiveBorrowAndScanMs.toFixed(3)} ms`);
  console.log(`  full materialize + JSON.parse: ${result.materializeAndParseMs.toFixed(3)} ms`);
  console.log(`  reconstructed row objects: ${result.reconstructedRowObjects.toLocaleString()} vs borrowed ${result.borrowedRowObjects}`);
  console.log(`  WASM memory after load: ${(result.wasmMemoryBytesAfterLoad / 1_048_576).toFixed(2)} MiB`);
  console.log(`  WASM memory growth for stable borrow cache: ${(result.wasmMemoryGrowthForBorrowCacheBytes / 1_048_576).toFixed(2)} MiB`);
  console.log(`  materialize / cached-borrow speedup: ${result.decisionMetrics.materializeVsCachedBorrowSpeedup}x`);
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
  const scaleDecision = buildScaleDecision(results);
  if (!json) {
    console.log(`\nScale decision: ${scaleDecision.status}`);
    console.log(`  ${scaleDecision.rationale}`);
  } else {
    console.log(JSON.stringify({ schemaVersion: 3, results, scaleDecision }, null, 2));
  }
}

main().catch((error) => {
  console.error(`[data-boundary-benchmark] ${error.stack || error.message}`);
  process.exitCode = 1;
});

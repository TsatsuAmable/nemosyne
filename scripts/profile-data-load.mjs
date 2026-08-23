import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const TIERS = Object.freeze({ '100k': 100_000, '1m': 1_000_000 });
const PRIMITIVE_COLUMN_INDICES = Object.freeze([0, 1, 2]);

function parseArgs(argv) {
  const requested = argv
    .filter((arg) => arg.startsWith('--tier='))
    .map((arg) => arg.slice('--tier='.length).toLowerCase());
  const tiers = requested.length ? [...new Set(requested)] : ['100k', '1m'];
  for (const tier of tiers) {
    if (!(tier in TIERS)) throw new Error(`Unknown tier '${tier}'`);
  }
  return { tiers, json: argv.includes('--json') };
}

function buildDataset(rowCount, withRowIds) {
  const rows = new Array(rowCount);
  for (let i = 0; i < rowCount; i += 1) {
    rows[i] = {
      x: i,
      y: ((i * 48271) % 2147483647) / 2147483647,
      t: 1_700_000_000_000 + i * 1_000,
      cohort: `c${i % 32}`,
    };
  }
  const dataset = {
    name: `load-profile-${rowCount}`,
    columns: [
      { name: 'x', type: 'NUMERIC' },
      { name: 'y', type: 'NUMERIC' },
      { name: 't', type: 'TEMPORAL' },
      { name: 'cohort', type: 'CATEGORICAL' },
    ],
    rows,
  };
  if (withRowIds) dataset.rowIds = Array.from({ length: rowCount }, (_, i) => `r${i}`);
  return dataset;
}

async function freshRuntime() {
  const pkgPath = path.resolve(process.cwd(), 'wasm/pkg/nemosyne_wasm.js');
  const wasmPath = path.resolve(process.cwd(), 'wasm/pkg/nemosyne_wasm_bg.wasm');
  if (!fs.existsSync(pkgPath) || !fs.existsSync(wasmPath)) {
    throw new Error('WASM package missing. Run `npm run wasm:dev` before profiling.');
  }
  globalThis.nemosyneNowMs = () => performance.now();
  const moduleUrl = `${pathToFileURL(pkgPath).href}?instance=${Date.now()}-${Math.random()}`;
  const mod = await import(moduleUrl);
  const wasm = await mod.default(fs.readFileSync(wasmPath));
  wasm.init(0x1234_5678_9abc_def0n);
  for (const fn of ['data_load_dataset_json_profiled', 'data_last_load_profile']) {
    if (typeof wasm[fn] !== 'function') throw new Error(`profile ABI missing ${fn}`);
  }
  return wasm;
}

function allocBytes(wasm, bytes) {
  const ptr = wasm.host_buffer_alloc(bytes.length);
  if (!ptr && bytes.length) throw new Error('host_buffer_alloc failed');
  new Uint8Array(wasm.memory.buffer, ptr, bytes.length).set(bytes);
  return ptr;
}

function loadDataset(wasm, bytes) {
  const ptr = allocBytes(wasm, bytes);
  try {
    return wasm.data_load_dataset_json_profiled(ptr, bytes.length);
  } finally {
    wasm.host_buffer_dealloc(ptr, bytes.length);
  }
}

function readStringAbi(wasm, fn) {
  const required = fn(0, 0);
  if (!required) return '';
  const ptr = wasm.host_buffer_alloc(required);
  if (!ptr) throw new Error('host_buffer_alloc failed for string result');
  try {
    const written = fn(ptr, required);
    return new TextDecoder().decode(new Uint8Array(wasm.memory.buffer, ptr, written).slice());
  } finally {
    wasm.host_buffer_dealloc(ptr, required);
  }
}

function readLoadProfile(wasm) {
  const text = readStringAbi(wasm, wasm.data_last_load_profile);
  if (!text) throw new Error('profile ABI returned no JSON');
  return JSON.parse(text);
}

function acquirePrimitiveViews(wasm, handle, rows) {
  const views = [];
  for (const columnIndex of PRIMITIVE_COLUMN_INDICES) {
    const len = wasm.dataset_primitive_column_len(handle, columnIndex);
    if (len !== rows) throw new Error(`column ${columnIndex} len ${len} != ${rows}`);
    const valuesPtr = wasm.dataset_primitive_column_values_ptr(handle, columnIndex);
    const validityPtr = wasm.dataset_primitive_column_validity_ptr(handle, columnIndex);
    if (!valuesPtr || !validityPtr) throw new Error(`invalid primitive pointers for ${columnIndex}`);
    views.push({ len, valuesPtr, validityPtr });
  }
  return views;
}

function scanViews(wasm, views) {
  let checksum = 0;
  let validValues = 0;
  for (const view of views) {
    const values = new Float64Array(wasm.memory.buffer, view.valuesPtr, view.len);
    const validity = new Uint8Array(wasm.memory.buffer, view.validityPtr, view.len);
    for (let i = 0; i < view.len; i += 1) {
      if (validity[i]) {
        checksum += values[i];
        validValues += 1;
      }
    }
  }
  return { checksum, validValues };
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

async function profileVariant(tier, withRowIds) {
  const rows = TIERS[tier];
  global.gc?.();
  const dataset = buildDataset(rows, withRowIds);
  const stringifyStart = performance.now();
  const bytes = new TextEncoder().encode(JSON.stringify(dataset));
  const stringifyMs = performance.now() - stringifyStart;

  const wasm = await freshRuntime();
  const beforeLoadMemory = wasm.memory.buffer.byteLength;
  const loadStart = performance.now();
  const handle = loadDataset(wasm, bytes);
  const loadMs = performance.now() - loadStart;
  if (!handle) throw new Error(`${tier} ${withRowIds ? 'with' : 'without'} rowIds rejected`);
  // Snapshot memory immediately after ingestion. Reading the diagnostic profile
  // uses a temporary WASM output buffer and must not contaminate load growth.
  const afterLoadMemory = wasm.memory.buffer.byteLength;
  const rustPhases = readLoadProfile(wasm);

  try {
    const acquireStart = performance.now();
    const views = acquirePrimitiveViews(wasm, handle, rows);
    const acquireMs = performance.now() - acquireStart;

    const coldScanStart = performance.now();
    const cold = scanViews(wasm, views);
    const coldScanMs = performance.now() - coldScanStart;

    const warmScanStart = performance.now();
    const warm = scanViews(wasm, views);
    const warmScanMs = performance.now() - warmScanStart;

    if (cold.checksum !== warm.checksum || cold.validValues !== warm.validValues) {
      throw new Error('primitive scan changed between cold and warm passes');
    }

    return {
      tier,
      rows,
      rowIdsProvided: withRowIds,
      inputBytes: bytes.byteLength,
      stringifyMs: round(stringifyMs),
      rustLoadMs: round(loadMs),
      rustPhases,
      pointerAcquireMs: round(acquireMs),
      coldScanMs: round(coldScanMs),
      warmScanMs: round(warmScanMs),
      wasmMemoryBeforeLoadBytes: beforeLoadMemory,
      wasmMemoryAfterLoadBytes: afterLoadMemory,
      wasmMemoryGrowthDuringLoadBytes: Math.max(0, afterLoadMemory - beforeLoadMemory),
      primitiveChecksum: cold.checksum,
      validPrimitiveValues: cold.validValues,
    };
  } finally {
    wasm.dataset_destroy(handle);
  }
}

function buildDiagnosis(results) {
  const byKey = new Map(results.map((r) => [`${r.tier}:${r.rowIdsProvided}`, r]));
  const tiers = [...new Set(results.map((r) => r.tier))];
  return tiers.map((tier) => {
    const generated = byKey.get(`${tier}:false`);
    const supplied = byKey.get(`${tier}:true`);
    if (!generated || !supplied) return { tier, status: 'INCOMPLETE' };
    const phases = generated.rustPhases;
    const dominantPhase = [
      ['utf8ValidationMs', phases.utf8ValidationMs],
      ['compatibilityDatasetBuildMs', phases.compatibilityDatasetBuildMs],
      ['columnarSidecarBuildMs', phases.columnarSidecarBuildMs],
      ['registryInsertMs', phases.registryInsertMs],
    ].sort((a, b) => b[1] - a[1])[0][0];
    return {
      tier,
      status: 'COMPLETE',
      generatedRowIdLoadMs: generated.rustLoadMs,
      suppliedRowIdLoadMs: supplied.rustLoadMs,
      generatedVsSuppliedLoadRatio: round(generated.rustLoadMs / supplied.rustLoadMs),
      extraInputBytesWithSuppliedRowIds: supplied.inputBytes - generated.inputBytes,
      pointerAcquireMs: supplied.pointerAcquireMs,
      coldVsWarmScanRatio: round(supplied.coldScanMs / supplied.warmScanMs),
      dominantRustPhase: dominantPhase,
      dominantRustPhaseShare: round(phases[dominantPhase] / phases.totalRustLoadMs),
      inference:
        dominantPhase === 'utf8ValidationMs'
          ? 'UTF8_VALIDATION_DOMINATES'
          : dominantPhase === 'compatibilityDatasetBuildMs'
            ? 'JSON_ROW_COMPATIBILITY_BUILD_DOMINATES'
            : dominantPhase === 'columnarSidecarBuildMs'
              ? 'ROW_TO_COLUMNAR_RECONSTRUCTION_DOMINATES'
              : 'REGISTRY_OR_OTHER_COST_DOMINATES',
    };
  });
}

async function main() {
  const { tiers, json } = parseArgs(process.argv.slice(2));
  const results = [];
  for (const tier of tiers) {
    results.push(await profileVariant(tier, false));
    results.push(await profileVariant(tier, true));
  }
  const output = { schemaVersion: 2, results, diagnosis: buildDiagnosis(results) };
  if (json) console.log(JSON.stringify(output, null, 2));
  else console.table(results.map(({ rustPhases, ...result }) => ({ ...result, ...rustPhases })));
}

main().catch((error) => {
  console.error(`[profile-data-load] ${error.stack || error.message}`);
  process.exitCode = 1;
});

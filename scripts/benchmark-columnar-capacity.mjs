import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const encoder = new TextEncoder();

const SCENARIOS = Object.freeze({
  tall10k: { rows: 10_000, primitiveColumns: 3, categoricalCardinality: 32 },
  tall100k: { rows: 100_000, primitiveColumns: 3, categoricalCardinality: 32 },
  tall1m: { rows: 1_000_000, primitiveColumns: 3, categoricalCardinality: 32 },
  tall10m: { rows: 10_000_000, primitiveColumns: 3, categoricalCardinality: 32 },
  wide1m: { rows: 1_000_000, primitiveColumns: 30, categoricalCardinality: 32 },
  highcard1m: { rows: 1_000_000, primitiveColumns: 3, categoricalCardinality: 250_000 },
});

function parseArgs(argv) {
  const requested = argv.filter((arg) => arg.startsWith('--scenario=')).map((arg) => arg.slice(11));
  const scenarios = requested.length ? [...new Set(requested)] : Object.keys(SCENARIOS);
  for (const scenario of scenarios) {
    if (!(scenario in SCENARIOS)) {
      throw new Error(
        `unknown scenario ${scenario}; expected one of ${Object.keys(SCENARIOS).join(', ')}`
      );
    }
  }
  return { scenarios, json: argv.includes('--json') };
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
  const headerView = new DataView(header.buffer);
  headerView.setUint32(4, rows, true);
  headerView.setUint32(8, primitiveColumns + 1, true);
  parts.push(header);

  for (let column = 0; column < primitiveColumns; column += 1) {
    parts.push(Uint8Array.of(column === primitiveColumns - 1 ? 2 : 1));
    pushString(parts, `p${column}`);
    const raw = new Uint8Array(rows * 8);
    const values = new DataView(raw.buffer);
    for (let row = 0; row < rows; row += 1) {
      const value =
        column === primitiveColumns - 1 ? 1_700_000_000_000 + row * 1000 : (row + 1) * (column + 1);
      values.setFloat64(row * 8, value, true);
    }
    parts.push(raw, new Uint8Array(rows).fill(1));
  }

  parts.push(Uint8Array.of(3));
  pushString(parts, 'cohort');
  const dictionaryCount = new Uint8Array(4);
  new DataView(dictionaryCount.buffer).setUint32(0, categoricalCardinality, true);
  parts.push(dictionaryCount);
  for (let category = 0; category < categoricalCardinality; category += 1) {
    pushString(parts, `c${category}`);
  }
  const codes = new Uint8Array(rows * 4);
  const codeView = new DataView(codes.buffer);
  for (let row = 0; row < rows; row += 1) {
    codeView.setUint32(row * 4, row % categoricalCardinality, true);
  }
  parts.push(codes, new Uint8Array(rows).fill(1));

  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const payload = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    payload.set(part, offset);
    offset += part.byteLength;
  }
  return payload;
}

async function runtime() {
  const jsPath = path.resolve('wasm/pkg/nemosyne_wasm.js');
  const wasmPath = path.resolve('wasm/pkg/nemosyne_wasm_bg.wasm');
  if (!fs.existsSync(jsPath) || !fs.existsSync(wasmPath)) {
    throw new Error('run npm run wasm:dev first');
  }
  globalThis.nemosyneNowMs = () => performance.now();
  const module = await import(
    `${pathToFileURL(jsPath).href}?boundary=${Date.now()}-${Math.random()}`
  );
  const wasm = await module.default({ module_or_path: fs.readFileSync(wasmPath) });
  wasm.init(0x1234_5678_9abc_def0n);
  return { api: module, wasm };
}

function loadBytes(wasm, bytes) {
  const beforeAllocation = wasm.memory.buffer.byteLength;
  const copyStarted = performance.now();
  const pointer = wasm.host_buffer_alloc(bytes.byteLength);
  if (!pointer) throw new Error('host_buffer_alloc failed');
  new Uint8Array(wasm.memory.buffer, pointer, bytes.byteLength).set(bytes);
  const hostAllocationAndCopyMs = performance.now() - copyStarted;
  const afterAllocation = wasm.memory.buffer.byteLength;
  const loadStarted = performance.now();
  const handle = wasm.data_load_typed_columns(pointer, bytes.byteLength);
  const rustLoadMs = performance.now() - loadStarted;
  const afterLoad = wasm.memory.buffer.byteLength;
  wasm.host_buffer_dealloc(pointer, bytes.byteLength);
  if (!handle) throw new Error('typed load rejected');
  return {
    handle,
    hostAllocationAndCopyMs,
    rustLoadMs,
    beforeAllocation,
    afterAllocation,
    afterLoad,
  };
}

function scanPrimitives(wasm, handle, primitiveColumns, rows) {
  const started = performance.now();
  let checksum = 0;
  for (let column = 0; column < primitiveColumns; column += 1) {
    const length = wasm.typed_primitive_column_len(handle, column);
    if (length !== rows) throw new Error(`column ${column} length mismatch: ${length}`);
    const valuesPointer = wasm.typed_primitive_values_ptr(handle, column);
    const validityPointer = wasm.typed_primitive_validity_ptr(handle, column);
    const values = new Float64Array(wasm.memory.buffer, valuesPointer, length);
    const validity = new Uint8Array(wasm.memory.buffer, validityPointer, length);
    for (let row = 0; row < length; row += 1) {
      if (validity[row]) checksum += values[row];
    }
  }
  return { scanMs: performance.now() - started, checksum };
}

function measureFingerprint(api, handle) {
  const started = performance.now();
  const value = api.typed_dataset_fingerprint(handle);
  const elapsedMs = performance.now() - started;
  if (!value) throw new Error('typed_dataset_fingerprint returned an empty identity');
  return { elapsedMs, transferBytes: encoder.encode(value).byteLength, value };
}

function measureStructureProfile(wasm, handle, expectedRows) {
  const rowMaterialisationsBefore = wasm.compatibility_row_materialisation_count();
  const probeStarted = performance.now();
  const requiredBytes = wasm.data_compute_structure_profile(handle, 0, 0);
  const sizeProbeMs = performance.now() - probeStarted;
  if (requiredBytes === 0) {
    return {
      status: 'UNAVAILABLE_FOR_COLUMNAR_HANDLE',
      sizeProbeMs,
      writeDecodeMs: 0,
      transferBytes: 0,
      rowMaterialisations:
        wasm.compatibility_row_materialisation_count() - rowMaterialisationsBefore,
    };
  }

  const pointer = wasm.host_buffer_alloc(requiredBytes);
  if (!pointer) throw new Error('host_buffer_alloc failed for DatasetStructureProfile');
  const writeStarted = performance.now();
  let profile;
  let written;
  try {
    written = wasm.data_compute_structure_profile(handle, pointer, requiredBytes);
    const bytes = new Uint8Array(wasm.memory.buffer, pointer, written).slice();
    profile = JSON.parse(new TextDecoder().decode(bytes));
  } finally {
    wasm.host_buffer_dealloc(pointer, requiredBytes);
  }
  const writeDecodeMs = performance.now() - writeStarted;
  if (profile.rowCount !== expectedRows) {
    throw new Error(`DatasetStructureProfile row count ${profile.rowCount} != ${expectedRows}`);
  }
  return {
    status: 'AVAILABLE',
    sizeProbeMs,
    writeDecodeMs,
    transferBytes: written,
    rowMaterialisations: wasm.compatibility_row_materialisation_count() - rowMaterialisationsBefore,
  };
}

async function runScenario(name) {
  const config = SCENARIOS[name];
  global.gc?.();
  const rssBefore = process.memoryUsage().rss;
  const buildStarted = performance.now();
  const payload = buildTypedPayload(config);
  const payloadBuildMs = performance.now() - buildStarted;
  const rssAfterPayload = process.memoryUsage().rss;
  const { api, wasm } = await runtime();
  const baselineBytes = wasm.memory.buffer.byteLength;

  const first = loadBytes(wasm, payload);
  const fingerprint = measureFingerprint(api, first.handle);
  const structureProfile = measureStructureProfile(wasm, first.handle, config.rows);
  const firstScan = scanPrimitives(wasm, first.handle, config.primitiveColumns, config.rows);
  const warmScan = scanPrimitives(wasm, first.handle, config.primitiveColumns, config.rows);
  wasm.typed_dataset_destroy(first.handle);
  const afterDestroy = wasm.memory.buffer.byteLength;

  const second = loadBytes(wasm, payload);
  const secondFingerprint = measureFingerprint(api, second.handle);
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
    payloadBuildMs,
    payloadRssGrowthBytes: Math.max(0, rssAfterPayload - rssBefore),
    logicalCoreBytes,
    first: {
      hostAllocationAndCopyMs: first.hostAllocationAndCopyMs,
      rustLoadMs: first.rustLoadMs,
      inputAllocationGrowthBytes: first.afterAllocation - first.beforeAllocation,
      totalWasmGrowthBytes: first.afterLoad - baselineBytes,
      fingerprintMs: fingerprint.elapsedMs,
      fingerprintTransferBytes: fingerprint.transferBytes,
      coldScanMs: firstScan.scanMs,
      warmScanMs: warmScan.scanMs,
      checksum: firstScan.checksum,
    },
    structureProfile,
    cleanup: {
      wasmBytesAfterDestroy: afterDestroy,
      pagesRetainedAfterDestroyBytes: afterDestroy - baselineBytes,
    },
    reload: {
      hostAllocationAndCopyMs: second.hostAllocationAndCopyMs,
      rustLoadMs: second.rustLoadMs,
      additionalWasmGrowthBytes: second.afterLoad - afterDestroy,
      fingerprintMs: secondFingerprint.elapsedMs,
      scanMs: secondScan.scanMs,
      checksumParity: secondScan.checksum === firstScan.checksum,
      fingerprintParity: secondFingerprint.value === fingerprint.value,
      pagesAfterSecondDestroyBytes: afterSecondDestroy - baselineBytes,
    },
    ratios: {
      firstWasmGrowthToLogicalCore:
        (first.afterLoad - baselineBytes) / Math.max(1, logicalCoreBytes),
      payloadToLogicalCore: payload.byteLength / Math.max(1, logicalCoreBytes),
      coldToWarmScan: firstScan.scanMs / Math.max(0.0001, warmScan.scanMs),
    },
  };
}

function boundaryAssessment(results) {
  const tenMillion = results.find((result) => result.scenario === 'tall10m');
  if (!tenMillion) {
    return {
      status: 'INCOMPLETE_NO_10M_SCENARIO',
      maximumVerifiedResidentRows: Math.max(0, ...results.map((result) => result.rows)),
      residentColumnarAt10m: null,
      authoritativeEvidenceAt10m: null,
      rustToJsEvidenceTransferBytes: null,
      rowMaterialisationsForEvidence: null,
    };
  }
  const residentColumnarAt10m = Boolean(
    tenMillion.reload.checksumParity && tenMillion.reload.fingerprintParity
  );
  const authoritativeEvidenceAt10m = tenMillion.structureProfile.status === 'AVAILABLE';
  return {
    status:
      residentColumnarAt10m && authoritativeEvidenceAt10m
        ? 'END_TO_END_10M_BOUNDARY_READY'
        : residentColumnarAt10m
          ? 'COLUMNAR_CAPACITY_ONLY'
          : 'BELOW_10M_RESIDENT_CAPACITY',
    maximumVerifiedResidentRows: residentColumnarAt10m ? tenMillion.rows : null,
    residentColumnarAt10m,
    authoritativeEvidenceAt10m,
    authoritativeEvidenceAvailableInAnyScenario: results.some(
      (result) => result.structureProfile.status === 'AVAILABLE'
    ),
    rustToJsEvidenceTransferBytes: tenMillion.structureProfile.transferBytes,
    rowMaterialisationsForEvidence: results.reduce(
      (sum, result) => sum + result.structureProfile.rowMaterialisations,
      0
    ),
    coldFingerprintMsAt10m: tenMillion.first.fingerprintMs,
    fingerprintToRustLoadRatioAt10m:
      tenMillion.first.fingerprintMs / Math.max(0.0001, tenMillion.first.rustLoadMs),
    retainedWasmBytesAfter10mDestroy: tenMillion.cleanup.pagesRetainedAfterDestroyBytes,
  };
}

async function main() {
  const { scenarios, json } = parseArgs(process.argv.slice(2));
  const results = [];
  for (const scenario of scenarios) results.push(await runScenario(scenario));
  const cpus = os.cpus();
  const output = {
    schemaVersion: 2,
    purpose: 'Rust/JS boundary envelope characterization; not a production promotion gate.',
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      logicalCpuCount: cpus.length,
      cpuModel: cpus[0]?.model ?? 'unknown',
      totalHostMemoryBytes: os.totalmem(),
      wasmAddressModel: 'wasm32 linear memory',
    },
    assessment: boundaryAssessment(results),
    results,
  };
  if (json) console.log(JSON.stringify(output, null, 2));
  else console.dir(output, { depth: null });
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

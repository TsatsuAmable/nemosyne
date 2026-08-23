import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const TIERS = Object.freeze({ '100k': 100_000, '1m': 1_000_000 });
const encoder = new TextEncoder();

function parseArgs(argv) {
  const requested = argv.filter((a) => a.startsWith('--tier=')).map((a) => a.slice(7));
  return { tiers: requested.length ? requested : ['100k', '1m'], json: argv.includes('--json') };
}

function pushString(parts, value) {
  const bytes = encoder.encode(value);
  const len = new Uint8Array(2);
  new DataView(len.buffer).setUint16(0, bytes.length, true);
  parts.push(len, bytes);
}

function buildTypedPayload(rows) {
  const parts = [];
  const header = new Uint8Array(12);
  header.set(encoder.encode('NTC1'), 0);
  const hv = new DataView(header.buffer);
  hv.setUint32(4, rows, true);
  hv.setUint32(8, 4, true);
  parts.push(header);

  function primitive(kind, name, valueAt) {
    parts.push(Uint8Array.of(kind));
    pushString(parts, name);
    const raw = new Uint8Array(rows * 8);
    const view = new DataView(raw.buffer);
    for (let i = 0; i < rows; i += 1) view.setFloat64(i * 8, valueAt(i), true);
    parts.push(raw, new Uint8Array(rows).fill(1));
  }

  primitive(1, 'x', (i) => i);
  primitive(1, 'y', (i) => ((i * 48271) % 2147483647) / 2147483647);
  primitive(2, 't', (i) => 1_700_000_000_000 + i * 1000);

  parts.push(Uint8Array.of(3));
  pushString(parts, 'cohort');
  const dictCount = new Uint8Array(4);
  new DataView(dictCount.buffer).setUint32(0, 32, true);
  parts.push(dictCount);
  for (let i = 0; i < 32; i += 1) pushString(parts, `c${i}`);
  const codes = new Uint8Array(rows * 4);
  const cv = new DataView(codes.buffer);
  for (let i = 0; i < rows; i += 1) cv.setUint32(i * 4, i % 32, true);
  parts.push(codes, new Uint8Array(rows).fill(1));

  const total = parts.reduce((sum, p) => sum + p.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.byteLength; }
  return out;
}

function buildJsonPayload(rows) {
  const records = new Array(rows);
  for (let i = 0; i < rows; i += 1) {
    records[i] = { x: i, y: ((i * 48271) % 2147483647) / 2147483647, t: 1_700_000_000_000 + i * 1000, cohort: `c${i % 32}` };
  }
  return encoder.encode(JSON.stringify({
    name: `typed-ingest-${rows}`,
    columns: [
      { name: 'x', type: 'NUMERIC' },
      { name: 'y', type: 'NUMERIC' },
      { name: 't', type: 'TEMPORAL' },
      { name: 'cohort', type: 'CATEGORICAL' },
    ],
    rows: records,
  }));
}

async function runtime() {
  const jsPath = path.resolve('wasm/pkg/nemosyne_wasm.js');
  const wasmPath = path.resolve('wasm/pkg/nemosyne_wasm_bg.wasm');
  if (!fs.existsSync(jsPath) || !fs.existsSync(wasmPath)) throw new Error('run npm run wasm:dev first');
  globalThis.nemosyneNowMs = () => performance.now();
  const mod = await import(`${pathToFileURL(jsPath).href}?typed=${Date.now()}-${Math.random()}`);
  const wasm = await mod.default(fs.readFileSync(wasmPath));
  wasm.init(0x1234_5678_9abc_def0n);
  return wasm;
}

function alloc(wasm, bytes) {
  const ptr = wasm.host_buffer_alloc(bytes.byteLength);
  if (!ptr) throw new Error('host_buffer_alloc failed');
  new Uint8Array(wasm.memory.buffer, ptr, bytes.byteLength).set(bytes);
  return ptr;
}

function load(wasm, bytes, fn) {
  const ptr = alloc(wasm, bytes);
  try { return fn(ptr, bytes.byteLength); }
  finally { wasm.host_buffer_dealloc(ptr, bytes.byteLength); }
}

function scan(wasm, handle, typed, rows) {
  let checksum = 0;
  for (const index of [0, 1, 2]) {
    const len = typed ? wasm.typed_primitive_column_len(handle, index) : wasm.dataset_primitive_column_len(handle, index);
    if (len !== rows) throw new Error(`column ${index} length mismatch: ${len}`);
    const vp = typed ? wasm.typed_primitive_values_ptr(handle, index) : wasm.dataset_primitive_column_values_ptr(handle, index);
    const mp = typed ? wasm.typed_primitive_validity_ptr(handle, index) : wasm.dataset_primitive_column_validity_ptr(handle, index);
    const values = new Float64Array(wasm.memory.buffer, vp, len);
    const validity = new Uint8Array(wasm.memory.buffer, mp, len);
    for (let i = 0; i < len; i += 1) if (validity[i]) checksum += values[i];
  }
  return checksum;
}

async function runTier(tier) {
  const rows = TIERS[tier];
  if (!rows) throw new Error(`unknown tier ${tier}`);

  global.gc?.();
  const typedBuildStart = performance.now();
  const typedBytes = buildTypedPayload(rows);
  const typedBuildMs = performance.now() - typedBuildStart;
  const typedWasm = await runtime();
  const typedBefore = typedWasm.memory.buffer.byteLength;
  const typedLoadStart = performance.now();
  const typedHandle = load(typedWasm, typedBytes, typedWasm.data_load_typed_columns);
  const typedLoadMs = performance.now() - typedLoadStart;
  if (!typedHandle || typedWasm.typed_dataset_row_count(typedHandle) !== rows) throw new Error('typed load rejected');
  const typedAfter = typedWasm.memory.buffer.byteLength;
  const typedChecksum = scan(typedWasm, typedHandle, true, rows);
  typedWasm.typed_dataset_destroy(typedHandle);

  global.gc?.();
  const jsonBuildStart = performance.now();
  const jsonBytes = buildJsonPayload(rows);
  const jsonBuildMs = performance.now() - jsonBuildStart;
  const jsonWasm = await runtime();
  const jsonBefore = jsonWasm.memory.buffer.byteLength;
  const jsonLoadStart = performance.now();
  const jsonHandle = load(jsonWasm, jsonBytes, jsonWasm.data_load_dataset_json);
  const jsonLoadMs = performance.now() - jsonLoadStart;
  if (!jsonHandle) throw new Error('JSON load rejected');
  const jsonAfter = jsonWasm.memory.buffer.byteLength;
  const jsonChecksum = scan(jsonWasm, jsonHandle, false, rows);
  jsonWasm.dataset_destroy(jsonHandle);

  const checksumScale = Math.max(1, Math.abs(jsonChecksum));
  const checksumRelativeError = Math.abs(typedChecksum - jsonChecksum) / checksumScale;
  return {
    tier, rows,
    typed: { payloadBytes: typedBytes.byteLength, buildMs: typedBuildMs, rustLoadMs: typedLoadMs, wasmGrowthBytes: typedAfter - typedBefore, checksum: typedChecksum },
    json: { payloadBytes: jsonBytes.byteLength, buildMs: jsonBuildMs, rustLoadMs: jsonLoadMs, wasmGrowthBytes: jsonAfter - jsonBefore, checksum: jsonChecksum },
    gates: {
      primitiveParity: checksumRelativeError < 1e-12,
      typedLoadAtLeast5xFaster: typedLoadMs * 5 < jsonLoadMs,
      typedMemoryAtMostHalf: (typedAfter - typedBefore) * 2 < (jsonAfter - jsonBefore),
    },
    ratios: {
      rustLoadSpeedup: jsonLoadMs / typedLoadMs,
      wasmGrowthReduction: (jsonAfter - jsonBefore) / Math.max(1, typedAfter - typedBefore),
      payloadReduction: jsonBytes.byteLength / typedBytes.byteLength,
    },
  };
}

async function main() {
  const { tiers, json } = parseArgs(process.argv.slice(2));
  const results = [];
  for (const tier of tiers) results.push(await runTier(tier));
  const promotionCandidate = results.every((r) => Object.values(r.gates).every(Boolean));
  const output = {
    schemaVersion: 1,
    status: promotionCandidate ? 'TYPED_COLUMN_DATA_PLANE_CANDIDATE' : 'HOLD_JSON_COMPATIBILITY_BASELINE',
    note: 'Performance spike only. Identity/provenance promotion remains gated until the canonical registry integration preserves those contracts.',
    results,
  };
  if (json) console.log(JSON.stringify(output, null, 2)); else console.dir(output, { depth: null });
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

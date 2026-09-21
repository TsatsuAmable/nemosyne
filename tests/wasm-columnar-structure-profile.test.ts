import { beforeAll, describe, expect, it } from 'vitest';
import {
  structureProfileToDatasetEvidence,
  type RustDatasetStructureProfile,
} from '../src/data/evidence/index.ts';
import { rowMaterialisationCount } from '../src/wasm/ColumnarBoundary.ts';
import * as bridge from '../src/wasm/RuntimeBridge.ts';

/**
 * TEC2 retired every transport name that overstated a heuristic as statistical
 * confidence or significance. A surviving key means the rename missed a site,
 * and every one of these renames degrades to a silent `undefined` rather than a
 * thrown error on the adapter path, so this walk is the only loud check.
 */
const RETIRED_TERMINOLOGY = /significant|confidence|localDensityVariation/i;

function collectTransportDefects(
  node: unknown,
  path: string,
  undefinedPaths: string[],
  retiredKeyPaths: string[]
): void {
  if (node === undefined) {
    undefinedPaths.push(path);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((child, index) =>
      collectTransportDefects(child, `${path}[${index}]`, undefinedPaths, retiredKeyPaths)
    );
    return;
  }
  if (node === null || typeof node !== 'object') return;
  for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
    const childPath = `${path}.${key}`;
    if (RETIRED_TERMINOLOGY.test(key)) retiredKeyPaths.push(childPath);
    collectTransportDefects(child, childPath, undefinedPaths, retiredKeyPaths);
  }
}

const encoder = new TextEncoder();

function pushU16(parts: Uint8Array[], value: number): void {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  parts.push(bytes);
}

function pushU32(parts: Uint8Array[], value: number): void {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  parts.push(bytes);
}

function pushString(parts: Uint8Array[], value: string): void {
  const bytes = encoder.encode(value);
  pushU16(parts, bytes.byteLength);
  parts.push(bytes);
}

function typedPayload(options: { correlatedNumericColumns?: boolean } = {}): Uint8Array {
  const rows = 8;
  const parts: Uint8Array[] = [encoder.encode('NTC1')];
  pushU32(parts, rows);
  // `value_mirror` is an exact copy of `value`, so the kernel emits one
  // correlation pair at maximum |r| and the pair-level transport can be
  // observed on the real path rather than over an empty pair list.
  const columns: readonly (readonly [number, string, number])[] = options.correlatedNumericColumns
    ? [
        [1, 'value', 2],
        [1, 'value_mirror', 2],
        [2, 'time', 1],
      ]
    : [
        [1, 'value', 2],
        [2, 'time', 1],
      ];
  pushU32(parts, columns.length + 1);

  for (const [type, name, scale] of columns) {
    parts.push(Uint8Array.of(type));
    pushString(parts, name);
    const values = new Uint8Array(rows * 8);
    const view = new DataView(values.buffer);
    for (let row = 0; row < rows; row += 1) view.setFloat64(row * 8, row * scale, true);
    parts.push(values, new Uint8Array(rows).fill(1));
  }

  parts.push(Uint8Array.of(3));
  pushString(parts, 'cohort');
  pushU32(parts, 2);
  pushString(parts, 'A');
  pushString(parts, 'B');
  const codes = new Uint8Array(rows * 4);
  const codeView = new DataView(codes.buffer);
  for (let row = 0; row < rows; row += 1) codeView.setUint32(row * 4, row % 2, true);
  parts.push(codes, new Uint8Array(rows).fill(1));

  const payload = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    payload.set(part, offset);
    offset += part.byteLength;
  }
  return payload;
}

describe('columnar DatasetStructureProfile real-WASM boundary', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) throw new Error('real WASM runtime unavailable');
  });

  it('returns authoritative compact evidence without materialising compatibility rows', () => {
    const payload = typedPayload();
    const allocation = bridge.allocBytes(payload);
    const handle = Number(bridge.call('data_load_typed_columns', allocation.ptr, allocation.len));
    bridge.deallocBytes(allocation.ptr, allocation.len);
    expect(handle).toBeGreaterThan(0);
    const before = rowMaterialisationCount();

    try {
      const fingerprintBytes = Number(bridge.call('data_typed_dataset_fingerprint', handle, 0, 0));
      expect(fingerprintBytes).toBe(64);
      const fingerprintPtr = Number(bridge.call('host_buffer_alloc', fingerprintBytes));
      try {
        const written = Number(
          bridge.call('data_typed_dataset_fingerprint', handle, fingerprintPtr, fingerprintBytes)
        );
        expect(written).toBe(fingerprintBytes);
        expect(bridge.readString(fingerprintPtr, written)).toMatch(/^[0-9a-f]{64}$/);
      } finally {
        bridge.call('host_buffer_dealloc', fingerprintPtr, fingerprintBytes);
      }
      const profile = bridge.computeDatasetStructureProfile(handle);
      expect(profile).not.toBeNull();
      expect(profile?.rowCount).toBe(8);
      expect(profile?.columnCount).toBe(3);
      expect(profile?.provenance).toMatchObject({
        algorithmSuite: 'nemosyne-rust-analytical-core-v3',
      });
      expect(profile?.clusters).toMatchObject({
        method: 'full-complete-row-kmeans',
        eligibleObservationCount: 8,
        sampleCount: 8,
        samplingSeed: null,
        sourceObservationsPerSample: 1,
      });
      // The temporal column is regular-spaced, so the Rust spectral path selects
      // the physical-unit `regular-time-fft` method (per-unit dominant frequencies,
      // spectral entropy, periodicity) rather than the generic full-series path.
      expect(profile?.spectral).toMatchObject({
        method: 'regular-time-fft',
        observedCount: 8,
        transformLength: 8,
        sourceObservationsPerBin: 1,
        windowFunction: 'hann',
        hasPeriodicity: true,
      });
      expect(rowMaterialisationCount()).toBe(before);
    } finally {
      bridge.call('typed_dataset_destroy', handle);
    }
  });

  it('transports only renamed heuristic fields, with no undefined values, on the real profile', () => {
    const payload = typedPayload({ correlatedNumericColumns: true });
    const allocation = bridge.allocBytes(payload);
    const handle = Number(bridge.call('data_load_typed_columns', allocation.ptr, allocation.len));
    bridge.deallocBytes(allocation.ptr, allocation.len);
    expect(handle).toBeGreaterThan(0);

    try {
      const profile = bridge.computeDatasetStructureProfile(handle);
      expect(profile).not.toBeNull();
      const evidence = structureProfileToDatasetEvidence(
        profile as unknown as RustDatasetStructureProfile
      );

      const undefinedPaths: string[] = [];
      const retiredKeyPaths: string[] = [];
      for (const entry of evidence.evidence) {
        collectTransportDefects(entry, entry.id, undefinedPaths, retiredKeyPaths);
      }
      expect(undefinedPaths).toEqual([]);
      expect(retiredKeyPaths).toEqual([]);

      const density = evidence.evidence.find((entry) => entry.id === 'density:global');
      expect(density?.value).toMatchObject({
        heuristicScaleDensityProxy: expect.any(Number),
        heuristicModeCount: expect.any(Number),
        heuristicSparseByRowCount: expect.any(Boolean),
      });
      expect(density?.value).not.toHaveProperty('localDensityVariation');

      const dependency = evidence.evidence.find((entry) => entry.id === 'dependency:correlations');
      expect(dependency?.value).toMatchObject({
        strongCorrelationPairCount: expect.any(Number),
        maxAbsolutePearsonCorrelation: expect.any(Number),
      });
      const pairs = (dependency?.value as { pairs?: readonly { isStrongByMagnitudeThreshold?: unknown }[] })
        .pairs;
      expect(pairs?.length).toBeGreaterThan(0);
      let pairsAboveThreshold = 0;
      for (const pair of pairs ?? []) {
        expect(typeof pair.isStrongByMagnitudeThreshold).toBe('boolean');
        if (pair.isStrongByMagnitudeThreshold === true) pairsAboveThreshold += 1;
      }
      // The transported count must agree with the transported per-pair flags:
      // both are derived from one magnitude rule, so a divergence here would
      // mean the count is being recomputed somewhere other than the kernel.
      expect(dependency?.value).toMatchObject({
        strongCorrelationPairCount: pairsAboveThreshold,
      });

      const cluster = evidence.evidence.find((entry) => entry.id === 'cluster:global');
      expect(cluster?.value).toMatchObject({
        legacySilhouetteDerivedScore: expect.any(Number),
      });

      // The typed fixture is a regular 8-point time series, so Rust emits both the
      // physical-unit spectral profile and the temporal periodicity manifest.
      const spectral = evidence.evidence.find((entry) => entry.id === 'spectral:global');
      expect(spectral?.value).toMatchObject({
        periodicityHeuristicScore: expect.any(Number),
      });

      const temporal = evidence.evidence.find((entry) => entry.id === 'temporal:global');
      expect(temporal).toBeDefined();
      const periodicities = (temporal?.value as { periodicities?: readonly { heuristicScore?: unknown }[] })
        .periodicities;
      expect(periodicities).toBeDefined();
      for (const periodicity of periodicities ?? []) {
        expect(typeof periodicity.heuristicScore).toBe('number');
      }

      // Reachable value set: the scale/density proxy is a row-count threshold, so
      // only these three values can ever be transported.
      expect([0.15, 0.4, 0.7]).toContain(
        (density?.value as { heuristicScaleDensityProxy: number }).heuristicScaleDensityProxy
      );
    } finally {
      bridge.call('typed_dataset_destroy', handle);
    }
  });
});

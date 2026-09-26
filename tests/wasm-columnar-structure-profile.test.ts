import { beforeAll, describe, expect, it } from 'vitest';
import {
  structureProfileToDatasetEvidence,
  type RustDatasetStructureProfile,
} from '../src/data/evidence/index.ts';
import { assertRustDatasetStructureProfile } from '../src/atlas/MonetaEvidenceAuthority.ts';
import { rowMaterialisationCount } from '../src/wasm/ColumnarBoundary.ts';
import * as bridge from '../src/wasm/RuntimeBridge.ts';

/**
 * TEC2 retired every transport name that overstated a heuristic as statistical
 * confidence or significance. A surviving key means the rename missed a site,
 * and every one of these renames degrades to a silent `undefined` rather than a
 * thrown error on the adapter path, so this walk is the only loud check.
 */
const RETIRED_TERMINOLOGY = /significant|confidence|densityVariation/i;

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

function typedPayload(
  options: { correlatedNumericColumns?: boolean; rows?: number; twoBlobs?: boolean } = {}
): Uint8Array {
  const rows = options.rows ?? 8;
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
    for (let row = 0; row < rows; row += 1) {
      // `twoBlobs` builds two tight, well-separated 1-D blobs so the
      // deterministic estimator must detect a partition with a high silhouette.
      const value = options.twoBlobs
        ? (row % 2 === 0 ? 0 : 100) + row * 0.001
        : row * scale;
      view.setFloat64(row * 8, value, true);
    }
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
      // Run the boundary validator over the real payload first. The other WASM
      // datasets in this suite are numeric/categorical only, so their `spectral`
      // and `temporal` records are null and the validator's renamed-field checks
      // for those two records would never execute against a live kernel. The
      // typed fixture is the only real payload with a temporal column, so this
      // call is what proves the strictest new requirements do not reject a valid
      // profile. A false rejection here is an outage at the evidence boundary.
      assertRustDatasetStructureProfile(profile as unknown as RustDatasetStructureProfile);
      // The live Rust producer must no longer emit the retired two-valued
      // cluster density-variation proxy at all; the validator above would throw
      // on a stale kernel build, and this assertion pins the removal directly.
      expect((profile as unknown as { clusters?: Record<string, unknown> }).clusters).not.toHaveProperty(
        'densityVariation'
      );
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
      // Guard against a vacuous loop: `temporal` is defined even when the
      // manifest carries no entries, so without this the per-entry assertion
      // below (and the retired-key walk) would pass on an empty list.
      expect(periodicities?.length).toBeGreaterThan(0);
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

  it('rejects the real profile when a renamed spectral or temporal field is dropped', () => {
    const payload = typedPayload({ correlatedNumericColumns: true });
    const allocation = bridge.allocBytes(payload);
    const handle = Number(bridge.call('data_load_typed_columns', allocation.ptr, allocation.len));
    bridge.deallocBytes(allocation.ptr, allocation.len);
    expect(handle).toBeGreaterThan(0);

    try {
      const profile = bridge.computeDatasetStructureProfile(handle);
      expect(profile).not.toBeNull();
      const clone = JSON.parse(JSON.stringify(profile)) as unknown as RustDatasetStructureProfile;

      // The real payload must actually carry the fields whose absence is
      // asserted below, otherwise this test would pass vacuously and prove
      // nothing about the transport.
      const real = profile as unknown as {
        spectral?: Record<string, unknown>;
        temporal?: { periodicities?: readonly Record<string, unknown>[] } | null;
      };
      expect(typeof real.spectral?.periodicityHeuristicScore).toBe('number');
      expect(real.temporal?.periodicities?.[0]).toBeDefined();
      expect(typeof real.temporal?.periodicities?.[0]?.heuristicScore).toBe('number');

      // Dropping the renamed field must fail closed at the boundary rather than
      // degrading to a silent `undefined` downstream.
      const mutatedSpectral = clone as unknown as { spectral: Record<string, unknown> };
      delete mutatedSpectral.spectral.periodicityHeuristicScore;
      expect(() => assertRustDatasetStructureProfile(clone)).toThrow(
        /periodicityHeuristicScore/,
      );

      // And so must a retired name reappearing on the real transport.
      const mutatedRetired = JSON.parse(JSON.stringify(profile)) as unknown as {
        temporal: { periodicities: Record<string, unknown>[] };
      };
      mutatedRetired.temporal.periodicities[0].confidence = 0.5;
      expect(() => assertRustDatasetStructureProfile(mutatedRetired as unknown as RustDatasetStructureProfile)).toThrow(
        /confidence/,
      );
    } finally {
      bridge.call('typed_dataset_destroy', handle);
    }
  });

  it('pins the producer value semantics the TypeScript fixtures must mirror (TEC2 Q4/Q5)', () => {
    // The scale/density proxy and the sparse flag are pure row-count
    // thresholds in the Rust producer (wasm/src/data/profile.rs), so their
    // exact values are determined by N alone. The pre-TEC2-fixture-closure
    // TypeScript fixtures invented values the kernel cannot emit (0.5, 1) and
    // reported `sparse: false` for small datasets; this pin is the falsifier
    // that would have caught those invented values and would catch any future
    // producer drift the fixtures silently absorb.
    const rowCases: readonly { rows: number; proxy: number; sparse: boolean }[] = [
      { rows: 3, proxy: 0.15, sparse: true },
      { rows: 14, proxy: 0.15, sparse: true },
      { rows: 19, proxy: 0.15, sparse: false },
      { rows: 20, proxy: 0.4, sparse: false },
      { rows: 49, proxy: 0.4, sparse: false },
      { rows: 50, proxy: 0.7, sparse: false },
    ];

    for (const { rows, proxy, sparse } of rowCases) {
      const payload = typedPayload({ rows });
      const allocation = bridge.allocBytes(payload);
      const handle = Number(bridge.call('data_load_typed_columns', allocation.ptr, allocation.len));
      bridge.deallocBytes(allocation.ptr, allocation.len);
      expect(handle).toBeGreaterThan(0);
      try {
        const profile = bridge.computeDatasetStructureProfile(handle) as unknown as
          | RustDatasetStructureProfile
          | null;
        expect(profile).not.toBeNull();
        expect(profile?.rowCount).toBe(rows);
        expect(profile?.density.heuristicScaleDensityProxy).toBe(proxy);
        expect(profile?.density.heuristicSparseByRowCount).toBe(sparse);
        if (rows === 3) {
          // Fewer than six complete rows take the producer's empty-cluster
          // path: no partition detected, a 0.0 partition score (never a
          // positive sentinel), and a single estimated cluster — the exact
          // fail-closed semantics the old shared fixture inverted to 1.
          expect(profile?.clusters.hasClusters).toBe(false);
          expect(profile?.clusters.heuristicSilhouettePartitionScore).toBe(0);
          expect(profile?.clusters.separationScore).toBe(0);
          expect(profile?.clusters.estimatedCount).toBe(1);
          // mode_count mirrors estimated_count in the producer.
          expect(profile?.density.modeCount).toBe(1);
        }
      } finally {
        bridge.call('typed_dataset_destroy', handle);
      }
    }
  });

  it('pins the clustered silhouette/separation relation on the real kernel (TEC2 Q4/Q5)', () => {
    // The affine rescale (partition score = (best_silhouette * 0.9) clamped to
    // [0.1, 1.0], separation = best_silhouette clamped to [0, 1]) is the one
    // fixture-mirrored relation the row-count pins above cannot anchor: both
    // transported numbers come from the same best_silhouette, so their exact
    // relation on a live clustered payload is what pins the 0.9 factor. The
    // `hasClusters` precondition keeps this from passing vacuously if the
    // estimator ever stops detecting the two-blob partition.
    const payload = typedPayload({ twoBlobs: true });
    const allocation = bridge.allocBytes(payload);
    const handle = Number(bridge.call('data_load_typed_columns', allocation.ptr, allocation.len));
    bridge.deallocBytes(allocation.ptr, allocation.len);
    expect(handle).toBeGreaterThan(0);
    try {
      const profile = bridge.computeDatasetStructureProfile(handle) as unknown as
        | RustDatasetStructureProfile
        | null;
      expect(profile).not.toBeNull();
      const clusters = profile?.clusters;
      expect(clusters?.hasClusters).toBe(true);
      expect(clusters?.separationScore).toBeGreaterThan(0.35);
      expect(clusters?.heuristicSilhouettePartitionScore).toBe(
        Math.min(1, Math.max(0.1, (clusters?.separationScore ?? 0) * 0.9))
      );
    } finally {
      bridge.call('typed_dataset_destroy', handle);
    }
  });
});

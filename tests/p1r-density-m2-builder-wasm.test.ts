import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import { encodeTypedColumnsPayload } from '../src/wasm/TypedColumnsCodec.ts';
import { buildDensitySemanticEmbodimentV1 } from '../src/wasm/runtime/SemanticEmbodimentBridge.ts';
import {
  MAX_DENSITY_CELLS_V1,
  type BinnedDensityPayloadV1,
  type DensityEmbodimentRequestV1,
  type SemanticEmbodimentEnvelopeV1,
} from '../src/moneta/representation/SemanticEmbodimentPayload.ts';

function request(): DensityEmbodimentRequestV1 {
  return {
    schemaVersion: 1,
    candidateId: 'DENSITY_FIELD',
    measureFieldX: 'x',
    measureFieldY: 'y',
    binsX: 2,
    binsY: 2,
    decisionId: 'decision-density-m2-wasm',
  };
}

function payload(envelope: SemanticEmbodimentEnvelopeV1 | null): BinnedDensityPayloadV1 {
  if (envelope?.result.status !== 'READY') throw new Error('expected READY density');
  if (envelope.result.payload.kind !== 'BINNED_DENSITY') throw new Error('expected BINNED_DENSITY payload');
  return envelope.result.payload.data;
}

function loadPairs(name: string, pairs: Array<[number | null, number | null]>): number {
  return bridge.loadDatasetJson({
    name,
    columns: [
      { name: 'x', type: 'NUMERIC' },
      { name: 'y', type: 'NUMERIC' },
    ],
    rows: pairs.map(([x, y]) => ({ x, y })),
  });
}

describe('P1-R density M2 Rust binned-density builder', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) throw new Error('M2 requires the real WASM runtime');
  });

  it('keeps computation on the resident columnar Rust path', () => {
    const rust = readFileSync('wasm/src/moneta/density_embodiment.rs', 'utf8');
    const bridgeSource = readFileSync('src/wasm/runtime/SemanticEmbodimentBridge.ts', 'utf8');
    expect(rust).toContain('data::with_columnar_metadata');
    expect(rust).not.toContain('with_dataset(');
    expect(rust).not.toContain('.rows');
    expect(bridgeSource).toContain('moneta_build_density_embodiment_v1');
  });

  it('computes the hand-calculable binned density from a resident handle', () => {
    const handle = loadPairs('m2-density-reference', [
      [0, 0],
      [1, 1],
      [3, 1.5],
      [null, 1],
      [0.5, null],
    ]);
    expect(handle).toBeGreaterThan(0);
    try {
      const envelope = buildDensitySemanticEmbodimentV1(handle, request());
      expect(envelope?.datasetFingerprint).toBe(bridge.datasetFingerprint(handle));
      expect(envelope?.candidateId).toBe('DENSITY_FIELD');
      expect(envelope?.representationFamily).toBe('DENSITY');
      expect(envelope?.approximation).toMatchObject({ mode: 'BINNED', representedRowCount: 3 });
      expect(envelope?.resource).toMatchObject({ sourceRowCount: 5, elementCount: 4 });

      const density = payload(envelope);
      expect(density.counts).toEqual({ sourceCount: 5, validCount: 3, excludedCount: 2 });
      expect(density.grid.length).toBe(4);
      expect(density.grid.reduce((sum, c) => sum + c.count, 0)).toBe(3);
      expect(JSON.stringify(envelope)).not.toContain('"rows"');
      expect(buildDensitySemanticEmbodimentV1(handle, request())).toEqual(envelope);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('is row-order invariant at the representation-payload boundary', () => {
    const forward = loadPairs('m2-density-forward', [
      [0, 0],
      [1, 1],
      [3, 1.5],
    ]);
    const reverse = loadPairs('m2-density-reverse', [
      [3, 1.5],
      [1, 1],
      [0, 0],
    ]);
    try {
      expect(payload(buildDensitySemanticEmbodimentV1(reverse, request()))).toEqual(
        payload(buildDensitySemanticEmbodimentV1(forward, request())),
      );
    } finally {
      bridge.destroyDataset(forward);
      bridge.destroyDataset(reverse);
    }
  });

  it('reports canonical non-finite normalization as excluded', () => {
    const typed = encodeTypedColumnsPayload({
      rowCount: 3,
      columns: [
        { name: 'x', type: 'numeric', values: [1, Number.NaN, 2] },
        { name: 'y', type: 'numeric', values: [1, 1, 1] },
      ],
    });
    const handle = bridge.loadTypedColumns(typed, 'm2-density-canonical-invalid');
    expect(handle).toBeGreaterThan(0);
    try {
      expect(payload(buildDensitySemanticEmbodimentV1(handle, request())).counts).toEqual({
        sourceCount: 3,
        validCount: 2,
        excludedCount: 1,
      });
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('keeps maximum semantic output bounded independently of source N', () => {
    const pairs: Array<[number | null, number | null]> = Array.from({ length: 2048 }, (_, i) => [
      i as unknown as number,
      (i % 20) as unknown as number,
    ]);
    const handle = loadPairs('m2-density-bounded', pairs);
    const maximum: DensityEmbodimentRequestV1 = {
      ...request(),
      binsX: 20,
      binsY: 20,
    };
    try {
      const envelope = buildDensitySemanticEmbodimentV1(handle, maximum);
      expect(envelope?.resource).toEqual({
        sourceRowCount: 2048,
        elementCount: MAX_DENSITY_CELLS_V1,
        maxElementCount: MAX_DENSITY_CELLS_V1,
      });
      expect(payload(envelope).grid).toHaveLength(400);
    } finally {
      bridge.destroyDataset(handle);
    }
  });
});

import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import { encodeTypedColumnsPayload } from '../src/wasm/TypedColumnsCodec.ts';
import { buildDistributionSemanticEmbodimentV1 } from '../src/wasm/runtime/SemanticEmbodimentBridge.ts';
import {
  MAX_DISTRIBUTION_ELEMENTS_V1,
  type DistributionEmbodimentRequestV1,
  type EmpiricalDistributionPayloadV1,
  type SemanticEmbodimentEnvelopeV1,
} from '../src/moneta/representation/SemanticEmbodimentPayload.ts';

function request(): DistributionEmbodimentRequestV1 {
  return {
    schemaVersion: 1,
    candidateId: 'DISTRIBUTION_FIELD',
    measureField: 'value',
    histogramBinCount: 2,
    ecdfKnotCount: 3,
    quantileProbabilities: [0, 0.125, 0.5, 0.875, 1],
    decisionId: 'decision-distribution-m2-wasm',
  };
}

function payload(envelope: SemanticEmbodimentEnvelopeV1 | null): EmpiricalDistributionPayloadV1 {
  if (envelope?.result.status !== 'READY') throw new Error('expected READY distribution');
  if (envelope.result.payload.kind !== 'EMPIRICAL_DISTRIBUTION') {
    throw new Error('expected EMPIRICAL_DISTRIBUTION payload');
  }
  return envelope.result.payload.data;
}

function loadValues(name: string, values: Array<number | null>): number {
  return bridge.loadDatasetJson({
    name,
    columns: [{ name: 'value', type: 'NUMERIC' }],
    rows: values.map((value) => ({ value })),
  });
}

describe('Stream M M2 Rust empirical-distribution builder', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) throw new Error('M2 requires the real WASM runtime');
  });

  it('keeps computation on the resident columnar Rust path', () => {
    const rust = readFileSync('wasm/src/moneta/distribution_embodiment.rs', 'utf8');
    const bridgeSource = readFileSync('src/wasm/runtime/SemanticEmbodimentBridge.ts', 'utf8');
    expect(rust).toContain('data::with_columnar_metadata');
    expect(rust).not.toContain('with_dataset(');
    expect(rust).not.toContain('.rows');
    expect(bridgeSource).not.toMatch(/histogram|quantile_r7|sort_by|cumulative_count/);
  });

  it('computes the hand-calculable empirical summary from a resident handle', () => {
    const handle = loadValues('m2-reference', [0, 1, 1, 2, 4, null]);
    expect(handle).toBeGreaterThan(0);
    try {
      const envelope = buildDistributionSemanticEmbodimentV1(handle, request());
      expect(envelope?.datasetFingerprint).toBe(bridge.datasetFingerprint(handle));
      expect(envelope?.candidateId).toBe('DISTRIBUTION_FIELD');
      expect(envelope?.representationFamily).toBe('DISTRIBUTION');
      expect(envelope?.approximation).toMatchObject({ mode: 'BINNED', representedRowCount: 5 });
      expect(envelope?.resource).toMatchObject({ sourceRowCount: 6, elementCount: 10 });

      const distribution = payload(envelope);
      expect(distribution.counts).toEqual({ sourceCount: 6, validCount: 5, excludedCount: 1 });
      expect(distribution.histogram.map((bin) => bin.count)).toEqual([3, 2]);
      expect(
        distribution.ecdf.map((knot) => [
          knot.value,
          knot.cumulativeCount,
          knot.cumulativeProbability,
        ])
      ).toEqual([
        [0, 1, 0.2],
        [1, 3, 0.6],
        [4, 5, 1],
      ]);
      expect(distribution.quantiles.map((quantile) => quantile.value)).toEqual([0, 0.5, 1, 3, 4]);
      expect(JSON.stringify(envelope)).not.toContain('"rows"');
      expect(JSON.stringify(envelope)).not.toContain('"layout"');
      expect(buildDistributionSemanticEmbodimentV1(handle, request())).toEqual(envelope);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('is row-order invariant at the representation-payload boundary', () => {
    const forward = loadValues('m2-forward', [0, 1, 1, 2, 4, null]);
    const reverse = loadValues('m2-reverse', [null, 4, 2, 1, 1, 0]);
    try {
      expect(payload(buildDistributionSemanticEmbodimentV1(reverse, request()))).toEqual(
        payload(buildDistributionSemanticEmbodimentV1(forward, request()))
      );
    } finally {
      bridge.destroyDataset(forward);
      bridge.destroyDataset(reverse);
    }
  });

  it('reports canonical non-finite normalization as excluded without inventing a source reason', () => {
    const typed = encodeTypedColumnsPayload({
      rowCount: 3,
      columns: [{ name: 'value', type: 'numeric', values: [1, Number.NaN, 2] }],
    });
    const handle = bridge.loadTypedColumns(typed, 'm2-canonical-invalid');
    expect(handle).toBeGreaterThan(0);
    try {
      expect(payload(buildDistributionSemanticEmbodimentV1(handle, request())).counts).toEqual({
        sourceCount: 3,
        validCount: 2,
        excludedCount: 1,
      });
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('returns explicit refusals for unknown, non-numeric, and empty-valid measures', () => {
    const handle = loadValues('m2-refusals', [null, null]);
    try {
      const empty = buildDistributionSemanticEmbodimentV1(handle, request());
      expect(empty?.result.status).toBe('REFUSED');
      if (empty?.result.status !== 'REFUSED') throw new Error('expected missing-evidence refusal');
      expect(empty.result.refusal.code).toBe('MISSING_EVIDENCE');

      const unknownRequest = { ...request(), measureField: 'absent' };
      const unknown = buildDistributionSemanticEmbodimentV1(handle, unknownRequest);
      expect(unknown?.result.status).toBe('REFUSED');
      if (unknown?.result.status !== 'REFUSED')
        throw new Error('expected invalid-parameter refusal');
      expect(unknown.result.refusal.code).toBe('INVALID_PARAMETERS');
      expect(JSON.stringify(unknown)).not.toContain('"payload"');
    } finally {
      bridge.destroyDataset(handle);
    }

    const categorical = bridge.loadDatasetJson({
      name: 'm2-categorical-refusal',
      columns: [{ name: 'value', type: 'CATEGORICAL' }],
      rows: [{ value: 'a' }],
    });
    try {
      const result = buildDistributionSemanticEmbodimentV1(categorical, request());
      expect(result?.result.status).toBe('REFUSED');
      if (result?.result.status !== 'REFUSED')
        throw new Error('expected invalid-parameter refusal');
      expect(result.result.refusal.code).toBe('INVALID_PARAMETERS');
    } finally {
      bridge.destroyDataset(categorical);
    }
  });

  it('keeps maximum semantic output bounded independently of source N', () => {
    const handle = loadValues(
      'm2-bounded-output',
      Array.from({ length: 4_096 }, (_, index) => index)
    );
    const maximum: DistributionEmbodimentRequestV1 = {
      ...request(),
      histogramBinCount: 256,
      ecdfKnotCount: 256,
      quantileProbabilities: Array.from({ length: 32 }, (_, index) => index / 31),
    };
    try {
      const envelope = buildDistributionSemanticEmbodimentV1(handle, maximum);
      expect(envelope?.resource).toEqual({
        sourceRowCount: 4_096,
        elementCount: MAX_DISTRIBUTION_ELEMENTS_V1,
        maxElementCount: MAX_DISTRIBUTION_ELEMENTS_V1,
      });
      const distribution = payload(envelope);
      expect(distribution.histogram).toHaveLength(256);
      expect(distribution.ecdf).toHaveLength(256);
      expect(distribution.quantiles).toHaveLength(32);
    } finally {
      bridge.destroyDataset(handle);
    }
  });
});

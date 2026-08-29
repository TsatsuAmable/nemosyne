import { beforeAll, describe, expect, it } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import { buildAggregateSemanticEmbodimentV1 } from '../src/wasm/runtime/SemanticEmbodimentBridge.ts';
import type { AggregateEmbodimentRequestV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.ts';

const request: AggregateEmbodimentRequestV1 = {
  schemaVersion: 1,
  candidateId: 'AGGREGATE_VOLUME',
  groupingField: 'group',
  measure: { field: 'value', function: 'MEAN' },
  decisionId: 'decision-a4-wasm',
};

describe('Stream A A4 Rust aggregate embodiment', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) throw new Error('A4 requires the real WASM runtime');
  });

  it('builds a bounded semantic aggregate from a canonical Rust dataset handle', () => {
    const handle = bridge.loadDatasetJson({
      name: 'a4-wasm',
      columns: [
        { name: 'group', type: 'CATEGORICAL' },
        { name: 'value', type: 'NUMERIC' },
      ],
      rows: [
        { group: 'a', value: 0 },
        { group: 'a', value: null },
        { group: 'b', value: 4 },
        { value: 8 },
      ],
    });
    expect(handle).toBeGreaterThan(0);
    try {
      const fingerprint = bridge.datasetFingerprint(handle);
      expect(fingerprint).toBeTruthy();
      const envelope = buildAggregateSemanticEmbodimentV1(handle, request);
      expect(envelope).not.toBeNull();
      expect(envelope?.datasetFingerprint).toBe(fingerprint);
      expect(envelope?.candidateId).toBe('AGGREGATE_VOLUME');
      expect(envelope?.representationFamily).toBe('AGGREGATE');
      expect(envelope?.approximation).toMatchObject({ mode: 'EXACT', representedRowCount: 4 });
      expect(envelope?.resource).toMatchObject({ sourceRowCount: 4, elementCount: 3, maxElementCount: 4096 });
      expect(envelope?.result.status).toBe('READY');
      if (envelope?.result.status !== 'READY') throw new Error('expected READY aggregate payload');
      const groups = envelope.result.payload.data.groups;
      const a = groups.find((group) => group.key === 'a');
      const b = groups.find((group) => group.key === 'b');
      const missing = groups.find((group) => group.key === null);
      expect(a).toMatchObject({ count: 2, aggregateValue: 0 });
      expect(b).toMatchObject({ count: 1, aggregateValue: 4 });
      expect(missing).toMatchObject({ count: 1, aggregateValue: 8 });
      expect(JSON.stringify(envelope)).not.toContain('"rows"');
      expect(JSON.stringify(envelope)).not.toContain('"layout"');
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('returns an explicit refusal rather than fabricating an aggregate for invalid parameters', () => {
    const handle = bridge.loadDatasetJson({
      name: 'a4-refusal',
      columns: [{ name: 'value', type: 'NUMERIC' }],
      rows: [{ value: 1 }, { value: 2 }],
    });
    try {
      const envelope = buildAggregateSemanticEmbodimentV1(handle, request);
      expect(envelope?.result.status).toBe('REFUSED');
      if (envelope?.result.status !== 'REFUSED') throw new Error('expected refusal');
      expect(envelope.result.refusal.code).toBe('INVALID_PARAMETERS');
      expect(JSON.stringify(envelope)).not.toContain('"payload"');
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('keeps semantic output bounded by group cardinality rather than source row count', () => {
    const source = {
      name: 'a4-bounded-output',
      columns: [
        { name: 'group', type: 'CATEGORICAL' as const },
        { name: 'value', type: 'NUMERIC' as const },
      ],
      rows: Array.from({ length: 1_024 }, (_, index) => ({
        group: `g${index % 4}`,
        value: index,
      })),
    };
    const handle = bridge.loadDatasetJson(source);
    expect(handle).toBeGreaterThan(0);
    try {
      const envelope = buildAggregateSemanticEmbodimentV1(handle, request);
      expect(envelope?.result.status).toBe('READY');
      expect(envelope?.resource).toMatchObject({ sourceRowCount: 1_024, elementCount: 4 });
      if (envelope?.result.status !== 'READY') throw new Error('expected READY aggregate payload');
      expect(envelope.result.payload.data.groups).toHaveLength(4);

      // This is a deterministic serialized-size proxy, not a claim about exact
      // structured-clone bytes. A1 keeps exact Worker transfer bytes unmeasured.
      const sourceJsonBytes = new TextEncoder().encode(JSON.stringify(source)).byteLength;
      const semanticJsonBytes = new TextEncoder().encode(JSON.stringify(envelope)).byteLength;
      expect(semanticJsonBytes).toBeLessThan(sourceJsonBytes);
      expect(JSON.stringify(envelope)).not.toContain('"rows"');
    } finally {
      bridge.destroyDataset(handle);
    }
  });
});

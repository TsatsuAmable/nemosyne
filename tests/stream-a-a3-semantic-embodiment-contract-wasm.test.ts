import { beforeAll, describe, expect, it } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import {
  MAX_AGGREGATE_GROUPS_V1,
  SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
  type SemanticEmbodimentEnvelopeV1,
} from '../src/moneta/representation/SemanticEmbodimentPayload.ts';

function aggregateFixture(): SemanticEmbodimentEnvelopeV1 {
  return {
    schemaVersion: SEMANTIC_EMBODIMENT_SCHEMA_VERSION,
    datasetFingerprint: 'a'.repeat(64),
    candidateId: 'AGGREGATE_VOLUME',
    representationFamily: 'AGGREGATE',
    analyticalMethod: {
      name: 'grouped-aggregate',
      version: 'aggregate-contract-v1',
      parameters: {
        groupBy: ['group'],
        measure: 'value',
        function: 'MEAN',
      },
    },
    approximation: {
      mode: 'EXACT',
      representedRowCount: 4,
    },
    informationContract: {
      preserves: ['aggregate-group-magnitude'],
      loses: [
        'individual-observation-identity',
        'exact-metric-values',
        'outlier-boundary-visibility',
      ],
    },
    resource: {
      sourceRowCount: 4,
      elementCount: 2,
      maxElementCount: MAX_AGGREGATE_GROUPS_V1,
    },
    provenance: {
      kernelVersion: '0.1.0',
      algorithmVersion: 'aggregate-contract-v1',
      decisionId: 'decision_AGGREGATE_VOLUME_fixture',
    },
    result: {
      status: 'READY',
      payload: {
        kind: 'AGGREGATE_VOLUME',
        data: {
          groupingFields: ['group'],
          measure: { field: 'value', function: 'MEAN' },
          groups: [
            { semanticId: 'group:b', key: 'b', count: 2, aggregateValue: 3.5 },
            { semanticId: 'group:a', key: 'a', count: 2, aggregateValue: 1.5 },
          ],
        },
      },
    },
  };
}

describe('Stream A A3 semantic embodiment V1 contract', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) {
      await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    }
    if (!bridge.isReady()) {
      throw new Error('A3 requires the real WASM runtime');
    }
  });

  it('round-trips a bounded aggregate payload through real Rust/WASM deterministically', () => {
    const first = bridge.roundTripSemanticEmbodimentPayloadV1(aggregateFixture());
    expect(first).not.toBeNull();
    expect(first?.schemaVersion).toBe(1);
    expect(first?.candidateId).toBe('AGGREGATE_VOLUME');
    expect(first?.representationFamily).toBe('AGGREGATE');
    expect(first?.informationContract.preserves).toEqual(['aggregate-group-magnitude']);
    expect(first?.informationContract.loses).toEqual([
      'individual-observation-identity',
      'exact-metric-values',
      'outlier-boundary-visibility',
    ]);
    expect(first?.result.status).toBe('READY');
    if (first?.result.status !== 'READY') throw new Error('expected READY aggregate payload');
    expect(first.result.payload.kind).toBe('AGGREGATE_VOLUME');
    expect(first.result.payload.data.groups.map((group) => group.semanticId)).toEqual([
      'group:a',
      'group:b',
    ]);

    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain('"rows"');
    expect(serialized).not.toContain('"layout"');

    const second = bridge.roundTripSemanticEmbodimentPayloadV1(first);
    expect(second).toEqual(first);
  });

  it('fails closed on unknown schema versions', () => {
    const input = aggregateFixture() as unknown as Record<string, unknown>;
    input.schemaVersion = 2;
    expect(
      bridge.roundTripSemanticEmbodimentPayloadV1(
        input as unknown as SemanticEmbodimentEnvelopeV1
      )
    ).toBeNull();
  });

  it('fails closed when candidate identity and payload semantics disagree', () => {
    const input = aggregateFixture();
    input.candidateId = 'DENSITY_FIELD';
    input.representationFamily = 'DISTRIBUTION';
    expect(bridge.roundTripSemanticEmbodimentPayloadV1(input)).toBeNull();
  });

  it('rejects attempts to smuggle raw rows into the versioned envelope', () => {
    const input = aggregateFixture() as unknown as Record<string, unknown>;
    input.rows = [{ group: 'a', value: 1 }];
    expect(
      bridge.roundTripSemanticEmbodimentPayloadV1(
        input as unknown as SemanticEmbodimentEnvelopeV1
      )
    ).toBeNull();
  });

  it('enforces the aggregate resource bound even when the payload is otherwise valid', () => {
    const input = aggregateFixture();
    input.resource.maxElementCount = MAX_AGGREGATE_GROUPS_V1 - 1;
    expect(bridge.roundTripSemanticEmbodimentPayloadV1(input)).toBeNull();
  });

  it('can carry an explicit unsupported-candidate refusal without inventing a payload', () => {
    const input: SemanticEmbodimentEnvelopeV1 = {
      ...aggregateFixture(),
      candidateId: 'DENSITY_FIELD',
      representationFamily: 'DISTRIBUTION',
      analyticalMethod: {
        name: 'density-field',
        version: 'not-implemented-v1',
        parameters: {},
      },
      approximation: {
        mode: 'ESTIMATED',
        representedRowCount: 0,
      },
      informationContract: {
        preserves: ['population-density-distribution', 'cluster-separation'],
        loses: ['individual-observation-identity', 'exact-metric-values'],
      },
      resource: {
        sourceRowCount: 10_000,
        elementCount: 0,
        maxElementCount: 4096,
      },
      result: {
        status: 'REFUSED',
        refusal: {
          code: 'UNSUPPORTED_CANDIDATE',
          message: 'DENSITY_FIELD builder is not implemented in A3',
        },
      },
    };

    const result = bridge.roundTripSemanticEmbodimentPayloadV1(input);
    expect(result).not.toBeNull();
    expect(result?.candidateId).toBe('DENSITY_FIELD');
    expect(result?.result).toEqual({
      status: 'REFUSED',
      refusal: {
        code: 'UNSUPPORTED_CANDIDATE',
        message: 'DENSITY_FIELD builder is not implemented in A3',
      },
    });
    expect(JSON.stringify(result)).not.toContain('"payload"');
  });
});

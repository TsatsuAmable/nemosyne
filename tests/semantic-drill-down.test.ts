import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import {
  SEMANTIC_DETAIL_SCHEMA_VERSION,
  MAX_DETAIL_OBSERVATION_LIMIT_V1,
  type SemanticDetailEnvelopeV1,
} from '../src/moneta/representation/SemanticDrillDown.ts';

import {
  buildAggregateSemanticEmbodimentV1,
  buildClusterSemanticEmbodimentV1,
  buildDensitySemanticEmbodimentV1,
  buildDistributionSemanticEmbodimentV1,
  querySemanticDetailV1,
} from '../src/wasm/runtime/SemanticEmbodimentBridge.ts';

function detailFixture(): SemanticDetailEnvelopeV1 {
  return {
    schemaVersion: SEMANTIC_DETAIL_SCHEMA_VERSION,
    generation: 1,
    request: {
      schemaVersion: SEMANTIC_DETAIL_SCHEMA_VERSION,
      target: {
        datasetFingerprint: 'a'.repeat(64),
        decisionId: 'decision-fixture-123',
        representationFamily: 'CLUSTER',
        semanticObjectId: 'cluster-0',
      },
      limit: 100,
      offset: 0,
      investigationContext: 'Inspect cluster-0 observations for outlier detection.',
    },
    result: {
      status: 'READY',
      totalMemberCount: 150,
      returnedCount: 2,
      observationIds: ['obs-1', 'obs-2'],
      compactViews: [
        { id: 'obs-1', value: 42.0 },
        { id: 'obs-2', value: 43.5 },
      ],
    },
  };
}

describe('Stream A A1 semantic drill-down V1 contract', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) {
      await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    }
    if (!bridge.isReady()) {
      throw new Error('A1 tests require the real WASM runtime');
    }
  });

  describe('WASM querySemanticDetailV1 integration', () => {
    let handle: number;
    let fingerprint: string;

    beforeAll(() => {
      const rawData = {
        name: 'test-dataset',
        columns: [
          { name: 'id', type: 'CATEGORICAL' as const },
          { name: 'group', type: 'CATEGORICAL' as const },
          { name: 'value', type: 'NUMERIC' as const },
          { name: 'value2', type: 'NUMERIC' as const },
        ],
        rows: [
          { id: 'obs-1', group: 'A', value: 10.0, value2: 10.0 },
          { id: 'obs-2', group: 'A', value: 20.0, value2: 20.0 },
          { id: 'obs-3', group: 'B', value: 30.0, value2: 30.0 },
          { id: 'obs-4', group: 'B', value: 40.0, value2: 40.0 },
          { id: 'obs-5', group: 'B', value: 50.0, value2: 50.0 },
        ],
        rowIds: ['obs-1', 'obs-2', 'obs-3', 'obs-4', 'obs-5'],
      };
      handle = bridge.loadDatasetJson(rawData);
      expect(handle).toBeGreaterThan(0);
      fingerprint = bridge.datasetFingerprint(handle)!;
      expect(fingerprint).toBeTruthy();
    });

    it('successfully queries CLUSTER observation details', () => {
      const clusterRequest = {
        schemaVersion: 1 as const,
        candidateId: 'CLUSTER_REGIONS' as const,
        partitionField: 'group',
        coordinateFields: ['value', 'value2'],
      };
      const clusterEmbodiment = buildClusterSemanticEmbodimentV1(handle, clusterRequest);
      expect(clusterEmbodiment).not.toBeNull();
      expect(clusterEmbodiment!.result.status).toBe('READY');

      let regionBId = '';
      if (clusterEmbodiment!.result.status === 'READY') {
        const payload = clusterEmbodiment!.result.payload;
        if (payload.kind === 'CLUSTER_REGIONS') {
          const regionB = payload.data.regions.find(r => r.sourcePartitionValue === 'B');
          regionBId = regionB!.semanticId;
        }
      }
      expect(regionBId).not.toBe('');

      const detailRequest = {
        schemaVersion: SEMANTIC_DETAIL_SCHEMA_VERSION,
        target: {
          datasetFingerprint: fingerprint,
          decisionId: 'decision-123',
          representationFamily: 'CLUSTER' as any,
          semanticObjectId: regionBId,
        },
        limit: 2,
        offset: 0,
        investigationContext: 'Test cluster query',
      };

      const envelope = querySemanticDetailV1(handle, detailRequest, clusterRequest, 1);
      expect(envelope).not.toBeNull();
      expect(envelope!.result.status).toBe('READY');
      if (envelope!.result.status === 'READY') {
        expect(envelope!.result.totalMemberCount).toBe(3);
        expect(envelope!.result.returnedCount).toBe(2);
        expect(envelope!.result.observationIds).toEqual(['obs-3', 'obs-4']);
        expect(envelope!.result.compactViews).toHaveLength(2);
        expect(envelope!.result.compactViews![0]).toEqual({ id: 'obs-3', group: 'B', value: 30.0, value2: 30.0 });
      }

      const offsetRequest = {
        ...detailRequest,
        limit: 10,
        offset: 1,
      };
      const envelopeOffset = querySemanticDetailV1(handle, offsetRequest, clusterRequest, 1);
      expect(envelopeOffset).not.toBeNull();
      expect(envelopeOffset!.result.status).toBe('READY');
      if (envelopeOffset!.result.status === 'READY') {
        expect(envelopeOffset!.result.totalMemberCount).toBe(3);
        expect(envelopeOffset!.result.returnedCount).toBe(2);
        expect(envelopeOffset!.result.observationIds).toEqual(['obs-4', 'obs-5']);
      }
    });

    it('fails closed before membership evaluation when the dataset fingerprint mismatches', () => {
      const clusterRequest = {
        schemaVersion: 1,
        candidateId: 'CLUSTER_REGIONS' as any,
        partitionField: 'group',
        coordinateFields: ['value', 'value2'],
      };
      const detailRequest = {
        schemaVersion: SEMANTIC_DETAIL_SCHEMA_VERSION,
        target: {
          datasetFingerprint: 'b'.repeat(64),
          decisionId: 'decision-123',
          representationFamily: 'CLUSTER' as any,
          semanticObjectId: 'cluster-0',
        },
        limit: 10,
        offset: 0,
        investigationContext: 'Test bad fingerprint',
      };
      const envelope = querySemanticDetailV1(handle, detailRequest, clusterRequest, 1);
      expect(envelope).toBeNull();
    });

    it('successfully queries AGGREGATE observation details', () => {
      const aggregateRequest = {
        schemaVersion: 1 as const,
        candidateId: 'AGGREGATE_VOLUME' as const,
        groupingField: 'group',
        measure: {
          field: 'value',
          function: 'SUM' as const,
        },
      };
      const aggregateEmbodiment = buildAggregateSemanticEmbodimentV1(handle, aggregateRequest);
      expect(aggregateEmbodiment).not.toBeNull();
      expect(aggregateEmbodiment!.result.status).toBe('READY');

      const detailRequest = {
        schemaVersion: SEMANTIC_DETAIL_SCHEMA_VERSION,
        target: {
          datasetFingerprint: fingerprint,
          decisionId: 'decision-123',
          representationFamily: 'AGGREGATE' as any,
          semanticObjectId: 'aggregate-group:00001',
        },
        limit: 10,
        offset: 0,
        investigationContext: 'Test aggregate query',
      };

      const envelope = querySemanticDetailV1(handle, detailRequest, aggregateRequest, 1);
      expect(envelope).not.toBeNull();
      expect(envelope!.result.status).toBe('READY');
      if (envelope!.result.status === 'READY') {
        expect(envelope!.result.totalMemberCount).toBe(3);
        expect(envelope!.result.observationIds).toEqual(['obs-3', 'obs-4', 'obs-5']);
        expect(envelope!.result.compactViews![0]).toEqual({ id: 'obs-3', group: 'B', value: 30.0, value2: 30.0 });
      }
    });

    it('successfully queries DISTRIBUTION observation details', () => {
      const distributionRequest = {
        schemaVersion: 1 as const,
        candidateId: 'DISTRIBUTION_FIELD' as const,
        measureField: 'value',
        histogramBinCount: 5,
        ecdfKnotCount: 5,
        quantileProbabilities: [0.25, 0.5, 0.75],
      };
      const distributionEmbodiment = buildDistributionSemanticEmbodimentV1(handle, distributionRequest);
      expect(distributionEmbodiment).not.toBeNull();
      expect(distributionEmbodiment!.result.status).toBe('READY');

      const detailRequest = {
        schemaVersion: SEMANTIC_DETAIL_SCHEMA_VERSION,
        target: {
          datasetFingerprint: fingerprint,
          decisionId: 'decision-123',
          representationFamily: 'DISTRIBUTION' as any,
          semanticObjectId: 'distribution-bin:002',
        },
        limit: 10,
        offset: 0,
        investigationContext: 'Test distribution query',
      };

      const envelope = querySemanticDetailV1(handle, detailRequest, distributionRequest, 1);
      expect(envelope).not.toBeNull();
      expect(envelope!.result.status).toBe('READY');
      if (envelope!.result.status === 'READY') {
        expect(envelope!.result.totalMemberCount).toBe(1);
        expect(envelope!.result.observationIds).toEqual(['obs-3']);
      }
    });

    it('successfully queries DENSITY observation details', () => {
      const densityRequest = {
        schemaVersion: 1 as const,
        candidateId: 'DENSITY_FIELD' as const,
        measureFieldX: 'value',
        measureFieldY: 'value2',
        binsX: 5,
        binsY: 5,
        decisionId: 'decision-123',
      };
      const densityEmbodiment = buildDensitySemanticEmbodimentV1(handle, densityRequest);
      expect(densityEmbodiment).not.toBeNull();
      expect(densityEmbodiment!.result.status).toBe('READY');

      const detailRequest = {
        schemaVersion: SEMANTIC_DETAIL_SCHEMA_VERSION,
        target: {
          datasetFingerprint: fingerprint,
          decisionId: 'decision-123',
          representationFamily: 'DENSITY' as any,
          semanticObjectId: 'density-cell:2-2',
        },
        limit: 10,
        offset: 0,
        investigationContext: 'Test density query',
      };

      const envelope = querySemanticDetailV1(handle, detailRequest, densityRequest, 1);
      expect(envelope).not.toBeNull();
      expect(envelope!.result.status).toBe('READY');
      if (envelope!.result.status === 'READY') {
        expect(envelope!.result.totalMemberCount).toBe(1);
        expect(envelope!.result.observationIds).toEqual(['obs-3']);
      }
    });

    it('refuses query if total matched members exceeds limit (1000)', () => {
      const clusterRequest = {
        schemaVersion: 1 as const,
        candidateId: 'CLUSTER_REGIONS' as const,
        partitionField: 'group',
        coordinateFields: ['value', 'value2'],
      };
      const largeRows = [];
      const largeRowIds = [];
      for (let i = 0; i < 1001; i++) {
        largeRows.push({ id: `obs-${i}`, group: 'A', value: i * 1.0, value2: i * 1.0 });
        largeRowIds.push(`obs-${i}`);
      }
      const largeData = {
        name: 'large-test-dataset',
        columns: [
          { name: 'id', type: 'CATEGORICAL' as const },
          { name: 'group', type: 'CATEGORICAL' as const },
          { name: 'value', type: 'NUMERIC' as const },
          { name: 'value2', type: 'NUMERIC' as const },
        ],
        rows: largeRows,
        rowIds: largeRowIds,
      };
      const largeHandle = bridge.loadDatasetJson(largeData);
      const largeFingerprint = bridge.datasetFingerprint(largeHandle)!;

      const largeClusterEmbodiment = buildClusterSemanticEmbodimentV1(largeHandle, clusterRequest);
      let regionAId = '';
      if (largeClusterEmbodiment!.result.status === 'READY') {
        const payload = largeClusterEmbodiment!.result.payload;
        if (payload.kind === 'CLUSTER_REGIONS') {
          const regionA = payload.data.regions.find(r => r.sourcePartitionValue === 'A');
          regionAId = regionA!.semanticId;
        }
      }

      const detailRequest = {
        schemaVersion: SEMANTIC_DETAIL_SCHEMA_VERSION,
        target: {
          datasetFingerprint: largeFingerprint,
          decisionId: 'decision-123',
          representationFamily: 'CLUSTER' as any,
          semanticObjectId: regionAId,
        },
        limit: 10,
        offset: 0,
        investigationContext: 'Test large cluster refusal',
      };

      const envelope = querySemanticDetailV1(largeHandle, detailRequest, clusterRequest, 1);
      expect(envelope).not.toBeNull();
      expect(envelope!.result.status).toBe('REFUSED');
      if (envelope!.result.status === 'REFUSED') {
        expect(envelope!.result.refusal.code).toBe('RESOURCE_LIMIT');
        expect(envelope!.result.refusal.message).toContain('exceeding the maximum progressive disclosure limit');
      }

      bridge.destroyDataset(largeHandle);
    });
  });

  it('successfully round-trips a valid READY detail envelope', () => {
    const fixture = detailFixture();
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).not.toBeNull();
    expect(result).toEqual(fixture);
  });

  it('successfully round-trips a valid REFUSED detail envelope', () => {
    const fixture: SemanticDetailEnvelopeV1 = {
      ...detailFixture(),
      result: {
        status: 'REFUSED',
        refusal: {
          code: 'RESOURCE_LIMIT',
          message: 'Requested offset out of bounds.',
        },
      },
    };
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).not.toBeNull();
    expect(result).toEqual(fixture);
  });

  it('rejects envelope with invalid schema version', () => {
    const fixture = {
      ...detailFixture(),
      schemaVersion: 99 as any,
    };
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects request with invalid schema version', () => {
    const fixture = detailFixture();
    (fixture.request as any).schemaVersion = 99;
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects target with invalid fingerprint length', () => {
    const fixture = detailFixture();
    (fixture.request.target as any).datasetFingerprint = 'abc';
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects target with non-hex fingerprint characters', () => {
    const fixture = detailFixture();
    (fixture.request.target as any).datasetFingerprint = 'g' + 'a'.repeat(63);
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects target with uppercase hex fingerprint characters', () => {
    const fixture = detailFixture();
    (fixture.request.target as any).datasetFingerprint = 'A' + 'a'.repeat(63);
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects request with 0 limit', () => {
    const fixture = detailFixture();
    (fixture.request as any).limit = 0;
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects request with limit exceeding MAX_DETAIL_OBSERVATION_LIMIT_V1', () => {
    const fixture = detailFixture();
    (fixture.request as any).limit = MAX_DETAIL_OBSERVATION_LIMIT_V1 + 1;
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects request with overly large investigation context', () => {
    const fixture = detailFixture();
    (fixture.request as any).investigationContext = 'a'.repeat(1025);
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects READY result with mismatched returnedCount', () => {
    const fixture = detailFixture();
    if (fixture.result.status === 'READY') {
      (fixture.result as any).returnedCount = 3;
    }
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects READY result with returnedCount exceeding limit', () => {
    const fixture = detailFixture();
    (fixture.request as any).limit = 1;
    if (fixture.result.status === 'READY') {
      (fixture.result as any).returnedCount = 2;
      (fixture.result as any).observationIds = ['obs-1', 'obs-2'];
    }
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects READY result with totalMemberCount less than returnedCount', () => {
    const fixture = detailFixture();
    if (fixture.result.status === 'READY') {
      (fixture.result as any).totalMemberCount = 1;
    }
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects READY result with invalid compactViews size', () => {
    const fixture = detailFixture();
    if (fixture.result.status === 'READY') {
      (fixture.result as any).compactViews = [{ id: 'obs-1' }];
    }
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects REFUSED result with too large refusal message', () => {
    const fixture: SemanticDetailEnvelopeV1 = {
      ...detailFixture(),
      result: {
        status: 'REFUSED',
        refusal: {
          code: 'RESOURCE_LIMIT',
          message: 'a'.repeat(1025),
        },
      },
    };
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  describe('Architectural Boundary Falsifier', () => {
    const checkedFiles = [
      'src/moneta/embodiment/ClusterSemanticEmbodiment.ts',
      'src/moneta/embodiment/DensitySemanticEmbodiment.ts',
      'src/moneta/embodiment/ScalableTopologyEmbodiment.ts',
      'src/vr/presentation/representation/RepresentationSurface.ts',
    ];

    it('ensures representation embodiment files do not scan or rematerialize raw rows directly', () => {
      for (const relPath of checkedFiles) {
        const filePath = path.resolve(process.cwd(), relPath);
        const content = fs.readFileSync(filePath, 'utf8');
        expect(content, `${relPath} must not directly scan dataset rows`).not.toContain('dataset.rows');
        expect(content, `${relPath} must not directly scan dataInput rows`).not.toContain('dataInput.rows');
      }
    });
  });
});
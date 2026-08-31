import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import {
  buildClusterSemanticEmbodimentV1,
} from '../src/wasm/runtime/SemanticEmbodimentBridge.ts';
import {
  MAX_CLUSTER_REGIONS_V1,
  type ClusterEmbodimentEnvelopeV1,
  type ClusterEmbodimentRequestV1,
  type ClusterRegionsPayloadV1,
} from '../src/moneta/representation/ClusterEmbodimentPayload.ts';

function request(): ClusterEmbodimentRequestV1 {
  return {
    schemaVersion: 1,
    candidateId: 'CLUSTER_REGIONS',
    partitionField: 'group',
    coordinateFields: ['x', 'y'],
    decisionId: 'decision-cluster-c2-wasm',
    decisionModelVersion: 'bootstrap-fitness-v4',
  };
}

function payload(envelope: ClusterEmbodimentEnvelopeV1 | null): ClusterRegionsPayloadV1 {
  if (envelope?.result.status !== 'READY') throw new Error('expected READY cluster payload');
  if (envelope.result.payload.kind !== 'CLUSTER_REGIONS') {
    throw new Error('expected CLUSTER_REGIONS payload');
  }
  return envelope.result.payload.data;
}

function loadRows(
  name: string,
  rows: Array<{ group: string | null; x: number | null; y: number | null }>,
): number {
  return bridge.loadDatasetJson({
    name,
    columns: [
      { name: 'group', type: 'CATEGORICAL' },
      { name: 'x', type: 'NUMERIC' },
      { name: 'y', type: 'NUMERIC' },
    ],
    rows,
  });
}

function region(cluster: ClusterRegionsPayloadV1, label: string) {
  const match = cluster.regions.find((candidate) => candidate.sourcePartitionValue === label);
  if (!match) throw new Error(`missing cluster region ${label}`);
  return match;
}

describe('P1-R2D C2 Rust source-partition cluster builder', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) throw new Error('R2D C2 requires the real WASM runtime');
  });

  it('keeps grouping and spatial reduction on the resident columnar Rust path', () => {
    const rust = readFileSync('wasm/src/moneta/cluster_embodiment.rs', 'utf8');
    const bridgeSource = readFileSync('src/wasm/runtime/SemanticEmbodimentBridge.ts', 'utf8');
    expect(rust).toContain('data::with_columnar_metadata');
    expect(rust).not.toContain('with_dataset(');
    expect(rust).not.toContain('.rows');
    expect(rust).not.toContain('RelationshipGraph');
    expect(bridgeSource).toContain('moneta_build_cluster_embodiment_v1');
  });

  it('computes the hand-calculable bounded partition summary from a resident handle', () => {
    const handle = loadRows('c2-cluster-reference', [
      { group: 'A', x: 0, y: 0 },
      { group: 'A', x: 2, y: 2 },
      { group: 'A', x: null, y: 4 },
      { group: 'B', x: 10, y: 5 },
      { group: 'B', x: null, y: 6 },
      { group: null, x: 20, y: 20 },
      { group: '', x: 30, y: 30 },
    ]);
    expect(handle).toBeGreaterThan(0);
    try {
      const envelope = buildClusterSemanticEmbodimentV1(handle, request());
      expect(envelope?.datasetFingerprint).toBe(bridge.datasetFingerprint(handle));
      expect(envelope?.candidateId).toBe('CLUSTER_REGIONS');
      expect(envelope?.representationFamily).toBe('CLUSTER');
      expect(envelope?.analyticalMethod).toEqual({
        name: 'source-partition-cluster-summary',
        version: 'source-partition-cluster-summary-v1',
        parameters: {
          partitionField: 'group',
          coordinateFields: ['x', 'y'],
          membershipAuthority: 'source-partition',
          coordinateValidity: 'complete-case-finite',
          spatialSummary: 'arithmetic-centroid-axis-aligned-bounds',
          maxGroups: MAX_CLUSTER_REGIONS_V1,
        },
      });
      expect(envelope?.provenance.algorithmVersion).toBe('source-partition-cluster-columnar-v1');
      expect(envelope?.informationContract).toEqual({
        preserves: ['cluster-separation', 'aggregate-group-magnitude'],
        loses: [
          'individual-observation-identity',
          'exact-metric-values',
          'population-density-distribution',
          'empirical-bivariate-bin-mass',
          'empirical-distribution-shape',
          'outlier-boundary-visibility',
        ],
      });
      expect(envelope?.approximation).toMatchObject({ mode: 'BOUNDED', representedRowCount: 3 });
      expect(envelope?.resource).toEqual({
        sourceRowCount: 7,
        elementCount: 2,
        maxElementCount: MAX_CLUSTER_REGIONS_V1,
      });

      const cluster = payload(envelope);
      expect(cluster.counts).toEqual({
        sourceCount: 7,
        assignedCount: 5,
        unassignedCount: 2,
        coordinateValidCount: 3,
        coordinateExcludedCount: 2,
      });
      expect(cluster.regions.map(({ sourcePartitionValue }) => sourcePartitionValue)).toEqual(['A', 'B']);
      expect(region(cluster, 'A')).toMatchObject({
        assignedCount: 3,
        coordinateValidCount: 2,
        coordinateExcludedCount: 1,
        spatialSummary: {
          axes: [
            { field: 'x', centroid: 1, min: 0, max: 2 },
            { field: 'y', centroid: 1, min: 0, max: 2 },
          ],
        },
      });
      expect(JSON.stringify(envelope)).not.toContain('"rows"');
      expect(JSON.stringify(envelope)).not.toContain('rowIds');
      expect(buildClusterSemanticEmbodimentV1(handle, request())).toEqual(envelope);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('keeps an assigned but spatially unavailable group explicit without fabricated coordinates', () => {
    const handle = loadRows('c2-cluster-partial-spatial', [
      { group: 'A', x: 0, y: 0 },
      { group: 'B', x: null, y: 2 },
      { group: 'B', x: 3, y: null },
    ]);
    try {
      const b = region(payload(buildClusterSemanticEmbodimentV1(handle, request())), 'B');
      expect(b).toMatchObject({
        assignedCount: 2,
        coordinateValidCount: 0,
        coordinateExcludedCount: 2,
        spatialSummary: null,
      });
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('refuses when every assigned group lacks a complete coordinate tuple', () => {
    const handle = loadRows('c2-cluster-no-spatial', [
      { group: 'A', x: 1, y: null },
      { group: 'B', x: null, y: 2 },
    ]);
    try {
      const envelope = buildClusterSemanticEmbodimentV1(handle, request());
      expect(envelope?.result.status).toBe('REFUSED');
      if (envelope?.result.status === 'REFUSED') {
        expect(envelope.result.refusal.code).toBe('MISSING_EVIDENCE');
      }
      expect(envelope?.resource.elementCount).toBe(0);
      expect(envelope?.approximation.representedRowCount).toBe(0);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('refuses the 257th source group rather than truncating, merging or sampling', () => {
    const rows = Array.from({ length: 257 }, (_, index) => ({
      group: `g${index.toString().padStart(3, '0')}`,
      x: index,
      y: 0,
    }));
    const handle = loadRows('c2-cluster-over-bound', rows);
    try {
      const envelope = buildClusterSemanticEmbodimentV1(handle, request());
      expect(envelope?.result.status).toBe('REFUSED');
      if (envelope?.result.status === 'REFUSED') {
        expect(envelope.result.refusal).toMatchObject({
          code: 'RESOURCE_LIMIT',
          estimatedElements: 257,
        });
      }
      expect(envelope?.resource).toEqual({
        sourceRowCount: 257,
        elementCount: 0,
        maxElementCount: MAX_CLUSTER_REGIONS_V1,
      });
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('separates exact artifact fingerprint identity from row-order-stable region identity', () => {
    const rows = [
      { group: 'A', x: 1e16, y: 0 },
      { group: 'A', x: 1, y: 1 },
      { group: 'A', x: -1e16, y: 2 },
      { group: 'B', x: 4, y: 4 },
    ];
    const forward = loadRows('c2-cluster-order', rows);
    const reverse = loadRows('c2-cluster-order', [...rows].reverse());
    try {
      const forwardEnvelope = buildClusterSemanticEmbodimentV1(forward, request());
      const reverseEnvelope = buildClusterSemanticEmbodimentV1(reverse, request());
      expect(forwardEnvelope?.datasetFingerprint).not.toBe(reverseEnvelope?.datasetFingerprint);
      const forwardPayload = payload(forwardEnvelope);
      const reversePayload = payload(reverseEnvelope);
      expect(forwardPayload.regions.map(({ semanticId }) => semanticId)).toEqual(
        reversePayload.regions.map(({ semanticId }) => semanticId),
      );
      expect(forwardPayload).toEqual(reversePayload);
    } finally {
      bridge.destroyDataset(forward);
      bridge.destroyDataset(reverse);
    }
  });

  it('does not renumber existing region IDs when an unrelated earlier label appears', () => {
    const baseRows = [
      { group: 'A', x: 0, y: 0 },
      { group: 'B', x: 1, y: 1 },
    ];
    const base = loadRows('c2-cluster-id-base', baseRows);
    const expanded = loadRows('c2-cluster-id-expanded', [
      { group: '0-earlier', x: -1, y: -1 },
      ...baseRows,
    ]);
    try {
      const before = payload(buildClusterSemanticEmbodimentV1(base, request()));
      const after = payload(buildClusterSemanticEmbodimentV1(expanded, request()));
      for (const label of ['A', 'B']) {
        expect(region(after, label).semanticId).toBe(region(before, label).semanticId);
      }
    } finally {
      bridge.destroyDataset(base);
      bridge.destroyDataset(expanded);
    }
  });
});

// @ts-nocheck
// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { VRTopologyTranslator } from '../src/moneta/VRTopologyTranslator.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';

function makeGridDataset(count, categories = 3) {
  const rows = Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    value: i,
    category: String.fromCharCode(65 + (i % categories)),
  }));
  return new Dataset(
    'Grid',
    [
      { name: 'id', type: ColumnType.CATEGORICAL },
      { name: 'value', type: ColumnType.NUMERIC },
      { name: 'category', type: ColumnType.CATEGORICAL },
    ],
    rows
  );
}

function aggregateEnvelope(groups) {
  const sourceRowCount = groups.reduce((sum, group) => sum + group.count, 0);
  return {
    schemaVersion: 1,
    datasetFingerprint: 'a'.repeat(64),
    candidateId: 'AGGREGATE_VOLUME',
    representationFamily: 'AGGREGATE',
    analyticalMethod: {
      name: 'categorical-grouped-aggregate',
      version: 'aggregate-columnar-v1',
      parameters: { groupingField: 'region', measure: { field: 'magnitude', function: 'MEAN' } },
    },
    approximation: { mode: 'EXACT', representedRowCount: sourceRowCount },
    informationContract: {
      preserves: ['aggregate-group-magnitude'],
      loses: ['individual-observation-identity', 'exact-metric-values', 'outlier-boundary-visibility'],
    },
    resource: { sourceRowCount, elementCount: groups.length, maxElementCount: 4096 },
    provenance: { kernelVersion: 'test', algorithmVersion: 'aggregate-columnar-v1' },
    result: {
      status: 'READY',
      payload: {
        kind: 'AGGREGATE_VOLUME',
        data: {
          groupingFields: ['region'],
          measure: { field: 'magnitude', function: 'MEAN' },
          groups,
        },
      },
    },
  };
}

describe('VRTopologyTranslator scalable artefacts', () => {
  it('builds an instanced point cloud for large tabular data', () => {
    const ds = makeGridDataset(50);
    const result = {
      facts: { rowCount: 50, topology: 'TABULAR', isLargeDataset: true },
      spec: {
        layout: 'GRID_3D',
        geometry: 'INSTANCED_POINT_CLOUD',
        behavior: 'STATIC',
        interaction: 'CLUSTER_PROBE',
      },
      cost: 0,
    };
    const artifact = VRTopologyTranslator.synthesizeArtifact(result, {
      topology: 'TABULAR',
      dataset: ds,
      encodings: { color: 'category', size: 'value' },
    });

    expect(artifact.nodeMeshes.length).toBe(1);
    expect(artifact.nodeMeshes[0]).toBeInstanceOf(THREE.InstancedMesh);
    expect(artifact.nodeMeshes[0].count).toBe(50);
  });

  it('honors the per-synthesis point-cloud factory over the registered default', () => {
    const ds = makeGridDataset(4);
    const setPoints = vi.fn();
    const factory = vi.fn((count, geometry) => ({
      mesh: new THREE.InstancedMesh(
        geometry,
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
        count
      ),
      setPoints,
    }));
    const artifact = VRTopologyTranslator.synthesizeArtifact(
      {
        facts: { rowCount: 4, topology: 'TABULAR', isLargeDataset: true },
        spec: {
          layout: 'GRID_3D',
          geometry: 'INSTANCED_POINT_CLOUD',
          behavior: 'STATIC',
          interaction: 'CLUSTER_PROBE',
        },
        cost: 0,
      },
      {
        topology: 'TABULAR',
        dataset: ds,
        encodings: { color: 'category', size: 'value' },
      },
      { pointCloudFactory: factory }
    );
    expect(factory).toHaveBeenCalledTimes(1);
    expect(setPoints).toHaveBeenCalledTimes(1);
    expect(artifact.nodeMeshes[0]).toBeInstanceOf(THREE.InstancedMesh);
  });

  it('does not derive cluster regions from a high-cardinality categorical encoding', () => {
    const ds = makeGridDataset(30, 5);
    const result = {
      facts: { rowCount: 30, topology: 'TABULAR', hasHighCardinality: true, cardinalityOfColor: 5 },
      spec: {
        layout: 'GRID_3D',
        geometry: 'CLUSTER_VOLUME',
        behavior: 'STATIC',
        interaction: 'CLUSTER_PROBE',
      },
      cost: 0,
    };
    const artifact = VRTopologyTranslator.synthesizeArtifact(result, {
      topology: 'TABULAR',
      dataset: ds,
      encodings: { color: 'category' },
    });

    expect(artifact.nodeMeshes).toHaveLength(0);
    expect(artifact.group.userData.semanticEmbodimentStatus).toBe('PENDING');
    expect(artifact.group.children.some((child) => child instanceof THREE.Mesh)).toBe(false);
  });

  it('builds aggregate bars only from the bounded semantic payload', () => {
    const result = {
      facts: { rowCount: 40, topology: 'GEO', isLargeDataset: true },
      spec: {
        layout: 'GEO_SURFACE',
        geometry: 'AGGREGATE_BARS',
        behavior: 'STATIC',
        interaction: 'INSPECT_CELL',
      },
      cost: 0,
    };
    const artifact = VRTopologyTranslator.synthesizeArtifact(result, {
      topology: 'GEO',
      semanticEmbodiment: aggregateEnvelope([
        { semanticId: 'region:A', key: 'A', count: 10, aggregateValue: 4 },
        { semanticId: 'region:B', key: 'B', count: 10, aggregateValue: 8 },
        { semanticId: 'region:C', key: 'C', count: 10, aggregateValue: 12 },
        { semanticId: 'region:D', key: 'D', count: 10, aggregateValue: 16 },
      ]),
    });

    expect(artifact.nodeMeshes.length).toBe(4);
    for (const mesh of artifact.nodeMeshes) {
      expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
      expect(mesh.userData.category).toBeDefined();
      expect(mesh.userData.count).toBe(10);
      expect(mesh.userData.representationKind).toBe('AGGREGATE_VOLUME');
    }
  });

  it('does not expose interaction proxies for unauthorised row-derived cluster volumes', () => {
    const ds = makeGridDataset(20, 4);
    const result = {
      facts: { rowCount: 20, topology: 'TABULAR' },
      spec: {
        layout: 'GRID_3D',
        geometry: 'CLUSTER_VOLUME',
        behavior: 'STATIC',
        interaction: 'CLUSTER_PROBE',
      },
      cost: 0,
    };
    const artifact = VRTopologyTranslator.synthesizeArtifact(result, {
      topology: 'TABULAR',
      dataset: ds,
      encodings: { color: 'category' },
    });

    expect(artifact.nodeMeshes).toHaveLength(0);
    expect(artifact.group.userData.semanticEmbodimentStatus).toBe('PENDING');
  });
});

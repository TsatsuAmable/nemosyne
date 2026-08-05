// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { VRTopologyTranslator } from '../src/draco/VRTopologyTranslator.ts';
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

function makeGeoDataset(count, categories = 3) {
  const rows = Array.from({ length: count }, (_, i) => ({
    lat: 35 + (i % 10) * 0.1,
    lon: -118 + Math.floor(i / 10) * 0.1,
    magnitude: i,
    region: String.fromCharCode(65 + (i % categories)),
  }));
  return new Dataset(
    'Geo',
    [
      { name: 'lat', type: ColumnType.NUMERIC },
      { name: 'lon', type: ColumnType.NUMERIC },
      { name: 'magnitude', type: ColumnType.NUMERIC },
      { name: 'region', type: ColumnType.CATEGORICAL },
    ],
    rows
  );
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

  it('builds cluster volumes from a high-cardinality categorical encoding', () => {
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

    expect(artifact.nodeMeshes.length).toBe(5);
    for (const mesh of artifact.nodeMeshes) {
      expect(mesh.geometry).toBeInstanceOf(THREE.SphereGeometry);
      expect(mesh.material.transparent).toBe(true);
      expect(mesh.userData.cluster).toBeDefined();
    }
  });

  it('builds aggregate bars for large geo data', () => {
    const ds = makeGeoDataset(40, 4);
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
      dataset: ds,
      encodings: { color: 'region', size: 'magnitude' },
    });

    expect(artifact.nodeMeshes.length).toBe(4);
    for (const mesh of artifact.nodeMeshes) {
      expect(mesh.geometry).toBeInstanceOf(THREE.CylinderGeometry);
      expect(mesh.userData.category).toBeDefined();
      expect(mesh.userData.count).toBeGreaterThan(0);
    }
  });

  it('exposes interactions that work with transparent cluster volumes', () => {
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
    const mesh = artifact.nodeMeshes[0];
    const originalOpacity = mesh.material.opacity;

    artifact.interactions.onHover(mesh);
    expect(mesh.material.opacity).toBeGreaterThan(originalOpacity);

    artifact.interactions.onUnhover(mesh);
    expect(mesh.material.opacity).toBeCloseTo(originalOpacity, 5);
  });
});

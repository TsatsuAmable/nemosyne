import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import './setup-wasm.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { VRTopologyTranslator } from '../src/moneta/VRTopologyTranslator.ts';
import type { MonetaFacts, MonetaSpec, SolverResult } from '../src/moneta/types.ts';

const baseFacts: MonetaFacts = {
  topology: 'TABULAR',
  rowCount: 10000,
  nodeCount: 10000,
  edgeCount: 0,
  depth: 0,
  numericColumns: 4,
  categoricalColumns: 2,
  temporalColumns: 0,
  hasTimeSeries: false,
  hasContinuousValues: true,
  density: 0.1,
  estimatedDensity: 0.1,
  outlierCount: 0,
  cardinalityOfColor: 5,
  hasHighCardinality: false,
  isLargeDataset: true,
  clusterCount: 4,
  columnStats: {},
  correlationMatrix: {},
  categoryDistribution: {},
  trendDirection: 'flat',
  seasonalityHint: false,
  hasOutliers: false,
  hasHighVariance: false,
  numericSkew: 0,
  topCategory: null,
};

function createSyntheticDataset(count: number): Dataset {
  const rows: Record<string, unknown>[] = [];
  const categories = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];
  for (let i = 0; i < count; i++) {
    rows.push({
      x: (i % 50) * 0.1,
      y: Math.sin(i * 0.05) * 10,
      z: Math.floor(i / 50) * 0.1,
      category: categories[i % categories.length],
      cluster: `cluster_${i % 4}`,
      value: 10 + (i % 100),
    });
  }
  return new Dataset('synthetic', [
    { name: 'x', type: ColumnType.NUMERIC },
    { name: 'y', type: ColumnType.NUMERIC },
    { name: 'z', type: ColumnType.NUMERIC },
    { name: 'category', type: ColumnType.CATEGORICAL },
    { name: 'cluster', type: ColumnType.CATEGORICAL },
    { name: 'value', type: ColumnType.NUMERIC },
  ], rows);
}

function createZeroAggregateDataset(): Dataset {
  return new Dataset(
    'zero-aggregate',
    [
      { name: 'category', type: ColumnType.CATEGORICAL },
      { name: 'value', type: ColumnType.NUMERIC },
    ],
    [
      { category: 'Zero', value: 0 },
      { category: 'Zero', value: 0 },
    ]
  );
}

describe('P1-R Representation Embodiment Convergence Contracts', () => {
  const dataset = createSyntheticDataset(10000);

  it('C1: non-point semantic candidates do not produce point clouds or point-per-row fallbacks', () => {
    // 1. AGGREGATE_VOLUME
    const aggSpec: MonetaSpec = {
      layout: 'GRID_3D',
      geometry: 'AGGREGATE_BARS',
      behavior: 'STATIC',
      interaction: 'INSPECT_CELL',
    };
    const aggResult: SolverResult = {
      spec: aggSpec,
      facts: baseFacts,
      cost: 0.9,
    };
    const aggArtifact = VRTopologyTranslator.synthesizeArtifact(aggResult, {
      dataset,
      encodings: { color: 'category', size: 'value' },
    });
    expect(aggArtifact.nodeMeshes.length).toBeGreaterThan(0);
    expect(aggArtifact.nodeMeshes.length).toBeLessThan(20); // 5 categories
    for (const mesh of aggArtifact.nodeMeshes) {
      expect(mesh.userData).toHaveProperty('representationKind', 'AGGREGATE_VOLUME');
      expect(mesh.userData).not.toHaveProperty('instancedCloud');
    }

    // 2. DENSITY_FIELD
    const densitySpec: MonetaSpec = {
      layout: 'GRID_3D',
      geometry: 'DENSITY_FIELD',
      behavior: 'STATIC',
      interaction: 'INSPECT_CELL',
    };
    const densityResult: SolverResult = {
      spec: densitySpec,
      facts: baseFacts,
      cost: 0.85,
    };
    const densityArtifact = VRTopologyTranslator.synthesizeArtifact(densityResult, {
      dataset,
      encodings: { color: 'category' },
    });
    expect(densityArtifact.nodeMeshes.length).toBeGreaterThan(0);
    expect(densityArtifact.nodeMeshes.length).toBeLessThanOrEqual(216); // 6x6x6 max voxels
    for (const mesh of densityArtifact.nodeMeshes) {
      expect(mesh.userData).toHaveProperty('representationKind', 'DENSITY_FIELD');
      expect(mesh.userData).not.toHaveProperty('instancedCloud');
    }

    // 3. CLUSTER_REGIONS
    const clusterSpec: MonetaSpec = {
      layout: 'GRID_3D',
      geometry: 'CLUSTER_VOLUME',
      behavior: 'STATIC',
      interaction: 'CLUSTER_PROBE',
    };
    const clusterResult: SolverResult = {
      spec: clusterSpec,
      facts: baseFacts,
      cost: 0.88,
    };
    const clusterArtifact = VRTopologyTranslator.synthesizeArtifact(clusterResult, {
      dataset,
      encodings: { color: 'cluster' },
    });
    expect(clusterArtifact.nodeMeshes.length).toBe(4); // 4 clusters * 1 volumetric hull mesh
    for (const mesh of clusterArtifact.nodeMeshes) {
      expect(mesh.userData).toHaveProperty('representationKind', 'CLUSTER_REGIONS');
    }
  });

  it('C2: bounds render primitive generation independently of source row count N', () => {
    const smallDs = createSyntheticDataset(100);
    const largeDs = createSyntheticDataset(10000);

    const spec: MonetaSpec = {
      layout: 'GRID_3D',
      geometry: 'AGGREGATE_BARS',
      behavior: 'STATIC',
      interaction: 'INSPECT_CELL',
    };
    const solverResult: SolverResult = {
      spec,
      facts: baseFacts,
      cost: 0.9,
    };

    const smallArtifact = VRTopologyTranslator.synthesizeArtifact(solverResult, {
      dataset: smallDs,
      encodings: { color: 'category', size: 'value' },
    });
    const largeArtifact = VRTopologyTranslator.synthesizeArtifact(solverResult, {
      dataset: largeDs,
      encodings: { color: 'category', size: 'value' },
    });

    // 100 rows vs 10,000 rows with 5 categories produce the exact same bounded mesh count (5)
    expect(smallArtifact.nodeMeshes.length).toBe(5);
    expect(largeArtifact.nodeMeshes.length).toBe(5);
  });

  it('C2b: preserves legitimate zero values when computing aggregate means', () => {
    const zeroDataset = createZeroAggregateDataset();
    const spec: MonetaSpec = {
      layout: 'GRID_3D',
      geometry: 'AGGREGATE_BARS',
      behavior: 'STATIC',
      interaction: 'INSPECT_CELL',
    };

    const artifact = VRTopologyTranslator.synthesizeArtifact(
      { spec, facts: { ...baseFacts, rowCount: 2, nodeCount: 2 }, cost: 0.9 },
      { dataset: zeroDataset, encodings: { color: 'category', size: 'value' } }
    );

    expect(artifact.nodeMeshes).toHaveLength(1);
    expect(artifact.nodeMeshes[0].userData.aggregateValue).toBe(0);
  });

  it('C3: generates visibly and structurally distinct spatial embodiments for distinct semantic candidates', () => {
    const pointSpec: MonetaSpec = {
      layout: 'GRID_3D',
      geometry: 'INSTANCED_POINT_CLOUD',
      behavior: 'STATIC',
      interaction: 'INSPECT_CELL',
    };
    const aggSpec: MonetaSpec = {
      layout: 'GRID_3D',
      geometry: 'AGGREGATE_BARS',
      behavior: 'STATIC',
      interaction: 'INSPECT_CELL',
    };

    const pointArtifact = VRTopologyTranslator.synthesizeArtifact(
      { spec: pointSpec, facts: baseFacts, cost: 0.5 },
      { dataset: createSyntheticDataset(100), encodings: { color: 'category' } }
    );
    const aggArtifact = VRTopologyTranslator.synthesizeArtifact(
      { spec: aggSpec, facts: baseFacts, cost: 0.9 },
      { dataset: createSyntheticDataset(100), encodings: { color: 'category' } }
    );

    // Point cloud vs Aggregate bars must have completely distinct structures
    expect(pointArtifact.nodeMeshes[0].userData).toHaveProperty('instancedCloud');
    expect(aggArtifact.nodeMeshes[0].userData).toHaveProperty(
      'representationKind',
      'AGGREGATE_VOLUME'
    );
    expect(pointArtifact.nodeMeshes.length).not.toBe(aggArtifact.nodeMeshes.length);
  });

  it('C4: static source contract forbids silent point-cloud fallback from non-point branches', () => {
    const scalableSource = readFileSync(
      resolve(process.cwd(), 'src/moneta/embodiment/ScalableTopologyEmbodiment.ts'),
      'utf8'
    );

    const clusterStart = scalableSource.indexOf('buildClusterVolume(');
    const densityStart = scalableSource.indexOf('buildDensityField(');
    const aggregateStart = scalableSource.indexOf('buildAggregateBars(');

    expect(clusterStart).toBeGreaterThanOrEqual(0);
    expect(densityStart).toBeGreaterThan(clusterStart);
    expect(aggregateStart).toBeGreaterThan(densityStart);

    const clusterFn = scalableSource.slice(clusterStart, densityStart);
    const densityFn = scalableSource.slice(densityStart, aggregateStart);
    const aggregateFn = scalableSource.slice(aggregateStart);

    expect(clusterFn).not.toContain('buildInstancedPointCloud(');
    expect(densityFn).not.toContain('buildInstancedPointCloud(');
    expect(aggregateFn).not.toContain('buildInstancedPointCloud(');
  });
});

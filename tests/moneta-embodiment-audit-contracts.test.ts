import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import './setup-wasm.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { VRTopologyTranslator } from '../src/moneta/VRTopologyTranslator.ts';
import type { MonetaFacts, MonetaSpec, SolverResult } from '../src/moneta/types.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.ts';

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

function aggregateEnvelope(
  sourceRowCount: number,
  groups: Array<{ semanticId: string; key: string | number | boolean | null; count: number; aggregateValue?: number }>,
): SemanticEmbodimentEnvelopeV1 {
  return {
    schemaVersion: 1,
    datasetFingerprint: 'a'.repeat(64),
    candidateId: 'AGGREGATE_VOLUME',
    representationFamily: 'AGGREGATE',
    analyticalMethod: {
      name: 'categorical-grouped-aggregate',
      version: 'aggregate-columnar-v1',
      parameters: {},
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
          groupingFields: ['category'],
          measure: { field: 'value', function: 'MEAN' },
          groups,
        },
      },
    },
  };
}

function fiveGroupEnvelope(sourceRowCount: number): SemanticEmbodimentEnvelopeV1 {
  const keys = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];
  return aggregateEnvelope(
    sourceRowCount,
    keys.map((key, index) => ({
      semanticId: `category:${key}`,
      key,
      count: sourceRowCount / keys.length,
      aggregateValue: 20 + index * 10,
    })),
  );
}

function densityEnvelope(sourceRowCount: number): SemanticEmbodimentEnvelopeV1 {
  return {
    schemaVersion: 1,
    datasetFingerprint: 'd'.repeat(64),
    candidateId: 'DENSITY_FIELD',
    representationFamily: 'DENSITY',
    analyticalMethod: {
      name: 'bivariate-binned-density',
      version: 'binned-density-contract-v1',
      parameters: {
        binning: 'equal-width',
        interval: 'left-closed-right-open-final-closed',
        excludedPolicy: 'canonical-invalid-exclude-and-count',
        constantDomain: 'assign-final-bin-per-degenerate-axis',
      },
    },
    approximation: { mode: 'BINNED', representedRowCount: sourceRowCount },
    informationContract: {
      preserves: ['empirical-bivariate-bin-mass'],
      loses: ['individual-observation-identity', 'exact-metric-values', 'population-density-distribution', 'empirical-distribution-shape', 'outlier-boundary-visibility'],
    },
    resource: { sourceRowCount, elementCount: 4, maxElementCount: 400 },
    provenance: { kernelVersion: 'test', algorithmVersion: 'bivariate-binned-density-columnar-v1', decisionId: 'audit-density' },
    result: {
      status: 'READY',
      payload: {
        kind: 'BINNED_DENSITY',
        data: {
          measureFieldX: 'x',
          measureFieldY: 'y',
          domainX: { min: 0, max: 2 },
          domainY: { min: 0, max: 2 },
          counts: { sourceCount: sourceRowCount, validCount: sourceRowCount, excludedCount: 0 },
          binsX: 2,
          binsY: 2,
          grid: [
            { semanticId: 'density:0:0', xIndex: 0, yIndex: 0, xLowerBound: 0, xUpperBound: 1, yLowerBound: 0, yUpperBound: 1, count: Math.floor(sourceRowCount / 4), xUpperInclusive: false, yUpperInclusive: false },
            { semanticId: 'density:1:0', xIndex: 1, yIndex: 0, xLowerBound: 1, xUpperBound: 2, yLowerBound: 0, yUpperBound: 1, count: Math.floor(sourceRowCount / 4), xUpperInclusive: true, yUpperInclusive: false },
            { semanticId: 'density:0:1', xIndex: 0, yIndex: 1, xLowerBound: 0, xUpperBound: 1, yLowerBound: 1, yUpperBound: 2, count: Math.floor(sourceRowCount / 4), xUpperInclusive: false, yUpperInclusive: true },
            { semanticId: 'density:1:1', xIndex: 1, yIndex: 1, xLowerBound: 1, xUpperBound: 2, yLowerBound: 1, yUpperBound: 2, count: sourceRowCount - Math.floor(sourceRowCount / 4) * 3, xUpperInclusive: true, yUpperInclusive: true },
          ],
        },
      },
    },
  };
}

describe('P1-R Representation Embodiment Convergence Contracts', () => {
  const dataset = createSyntheticDataset(10000);

  it('C1: non-point semantic candidates do not produce point clouds or point-per-row fallbacks', () => {
    const aggSpec: MonetaSpec = {
      layout: 'GRID_3D', geometry: 'AGGREGATE_BARS', behavior: 'STATIC', interaction: 'INSPECT_CELL',
    };
    const aggResult: SolverResult = { spec: aggSpec, facts: baseFacts, cost: 0.9 };
    const aggArtifact = VRTopologyTranslator.synthesizeArtifact(aggResult, {
      semanticEmbodiment: fiveGroupEnvelope(10000),
    });
    expect(aggArtifact.nodeMeshes).toHaveLength(5);
    for (const mesh of aggArtifact.nodeMeshes) {
      expect(mesh.userData).toHaveProperty('representationKind', 'AGGREGATE_VOLUME');
      expect(mesh.userData).not.toHaveProperty('instancedCloud');
    }

    const densitySpec: MonetaSpec = {
      layout: 'GRID_3D', geometry: 'DENSITY_FIELD', behavior: 'STATIC', interaction: 'INSPECT_CELL',
    };
    const densityResult: SolverResult = { spec: densitySpec, facts: baseFacts, cost: 0.85 };
    const densityArtifact = VRTopologyTranslator.synthesizeArtifact(densityResult, {
      semanticEmbodiment: densityEnvelope(10000),
    });
    expect(densityArtifact.nodeMeshes).toHaveLength(4);
    for (const mesh of densityArtifact.nodeMeshes) {
      expect(mesh.userData).toHaveProperty('representationKind', 'DENSITY_FIELD');
      expect(mesh.userData).toHaveProperty('payloadKind', 'BINNED_DENSITY');
      expect(mesh.userData).not.toHaveProperty('instancedCloud');
    }

    const clusterSpec: MonetaSpec = {
      layout: 'GRID_3D', geometry: 'CLUSTER_VOLUME', behavior: 'STATIC', interaction: 'CLUSTER_PROBE',
    };
    const clusterResult: SolverResult = { spec: clusterSpec, facts: baseFacts, cost: 0.88 };
    const clusterArtifact = VRTopologyTranslator.synthesizeArtifact(clusterResult, {
      dataset,
      encodings: { color: 'cluster' },
    });
    expect(clusterArtifact.nodeMeshes.length).toBe(4);
    for (const mesh of clusterArtifact.nodeMeshes) {
      expect(mesh.userData).toHaveProperty('representationKind', 'CLUSTER_REGIONS');
    }
  });

  it('C2: migrated semantic primitive generation is bounded by payload elements, not source N', () => {
    const aggregateSpec: MonetaSpec = {
      layout: 'GRID_3D', geometry: 'AGGREGATE_BARS', behavior: 'STATIC', interaction: 'INSPECT_CELL',
    };
    const densitySpec: MonetaSpec = {
      layout: 'GRID_3D', geometry: 'DENSITY_FIELD', behavior: 'STATIC', interaction: 'INSPECT_CELL',
    };
    const aggregateResult: SolverResult = { spec: aggregateSpec, facts: baseFacts, cost: 0.9 };
    const densityResult: SolverResult = { spec: densitySpec, facts: baseFacts, cost: 0.85 };

    expect(VRTopologyTranslator.synthesizeArtifact(aggregateResult, { semanticEmbodiment: fiveGroupEnvelope(100) }).nodeMeshes).toHaveLength(5);
    expect(VRTopologyTranslator.synthesizeArtifact(aggregateResult, { semanticEmbodiment: fiveGroupEnvelope(10000) }).nodeMeshes).toHaveLength(5);
    expect(VRTopologyTranslator.synthesizeArtifact(densityResult, { semanticEmbodiment: densityEnvelope(100) }).nodeMeshes).toHaveLength(4);
    expect(VRTopologyTranslator.synthesizeArtifact(densityResult, { semanticEmbodiment: densityEnvelope(10000) }).nodeMeshes).toHaveLength(4);
  });

  it('C2b: preserves legitimate zero aggregate values supplied by Rust', () => {
    const spec: MonetaSpec = {
      layout: 'GRID_3D', geometry: 'AGGREGATE_BARS', behavior: 'STATIC', interaction: 'INSPECT_CELL',
    };
    const artifact = VRTopologyTranslator.synthesizeArtifact(
      { spec, facts: { ...baseFacts, rowCount: 2, nodeCount: 2 }, cost: 0.9 },
      { semanticEmbodiment: aggregateEnvelope(2, [{ semanticId: 'category:Zero', key: 'Zero', count: 2, aggregateValue: 0 }]) },
    );
    expect(artifact.nodeMeshes).toHaveLength(1);
    expect(artifact.nodeMeshes[0].userData.aggregateValue).toBe(0);
  });

  it('C3: distinct semantic candidates remain visibly and structurally distinct', () => {
    const pointSpec: MonetaSpec = {
      layout: 'GRID_3D', geometry: 'INSTANCED_POINT_CLOUD', behavior: 'STATIC', interaction: 'INSPECT_CELL',
    };
    const densitySpec: MonetaSpec = {
      layout: 'GRID_3D', geometry: 'DENSITY_FIELD', behavior: 'STATIC', interaction: 'INSPECT_CELL',
    };
    const pointArtifact = VRTopologyTranslator.synthesizeArtifact(
      { spec: pointSpec, facts: baseFacts, cost: 0.5 },
      { dataset: createSyntheticDataset(100), encodings: { color: 'category' } },
    );
    const densityArtifact = VRTopologyTranslator.synthesizeArtifact(
      { spec: densitySpec, facts: baseFacts, cost: 0.85 },
      { semanticEmbodiment: densityEnvelope(100) },
    );
    expect(pointArtifact.nodeMeshes[0].userData).toHaveProperty('instancedCloud');
    expect(densityArtifact.nodeMeshes[0].userData).toHaveProperty('payloadKind', 'BINNED_DENSITY');
    expect(pointArtifact.nodeMeshes.length).not.toBe(densityArtifact.nodeMeshes.length);
  });

  it('C4: production source routes density to its bounded semantic adapter, not point or legacy voxel fallback', () => {
    const translator = readFileSync('src/moneta/VRTopologyTranslator.ts', 'utf8');
    const adapter = readFileSync('src/moneta/embodiment/DensitySemanticEmbodiment.ts', 'utf8');
    expect(translator).toContain('buildDensitySemanticField(group, nodeMeshes, semanticInput.semanticEmbodiment)');
    expect(translator).not.toContain('scalable.buildDensityField(');
    expect(adapter).not.toContain('buildInstancedPointCloud(');
    expect(adapter).not.toContain('computeLayoutPositions');
    expect(adapter).not.toContain('dataset.rows');
  });
});

// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { ConstraintEngine, TopologyTypes } from '../src/moneta/ConstraintEngine.ts';
import { VRTopologyTranslator } from '../src/moneta/VRTopologyTranslator.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { fraudGraph, orgChart, windField } from '../src/data/SampleDatasets.ts';
import { makeFactProvider } from './helpers/dracoFactsHelper.ts';

describe('ConstraintEngine', () => {
  it('solves a hierarchy with radial orbital layout', () => {
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const result = engine.solve({
      topology: TopologyTypes.HIERARCHY,
      dataset: orgChart,
      maxDepth: 3,
    });

    expect(result).toHaveProperty('spec');
    expect(result).toHaveProperty('cost');
    expect(result.spec.layout).toBe('RADIAL_ORBITAL');
    expect(result.spec.interaction).toBe('DRILL_DOWN');
    expect(Number.isFinite(result.cost)).toBe(true);
  });

  it('solves a graph with force-directed layout', () => {
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const result = engine.solve({
      topology: TopologyTypes.GRAPH,
      dataset: fraudGraph,
    });

    expect(result.spec.layout).toBe('FORCE_DIRECTED_3D');
    expect(result.spec.interaction).toBe('TRAVERSE_EDGE');
  });

  it('solves a vector field with streamline layout', () => {
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const result = engine.solve({
      topology: TopologyTypes.VECTOR_FIELD,
      dataset: windField,
    });

    expect(result.spec.layout).toBe('VECTOR_STREAMLINE');
    expect(result.spec.interaction).toBe('HARVEST_STREAM');
  });

  it('hard-constrains a graph away from grid layout', () => {
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const result = engine.solve({
      topology: TopologyTypes.GRAPH,
      dataset: fraudGraph,
    });
    expect(result.spec.layout).not.toBe('GRID_3D');
  });

  it('allows weight tuning to change the winning spec', () => {
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const base = engine.solve({
      topology: TopologyTypes.TABULAR,
      dataset: new Dataset(
        'Table',
        [{ name: 'a', type: ColumnType.NUMERIC }],
        [{ a: 1 }, { a: 2 }]
      ),
    });

    // Crush the grid preference.
    engine.setWeight('prefer_grid_for_tabular', 0);
    const changed = engine.solve({
      topology: TopologyTypes.TABULAR,
      dataset: new Dataset(
        'Table',
        [{ name: 'a', type: ColumnType.NUMERIC }],
        [{ a: 1 }, { a: 2 }]
      ),
    });

    expect(changed.cost).toBeLessThanOrEqual(base.cost);
  });

  it('extracts scale-aware facts', () => {
    const engine = new ConstraintEngine({ largeRowThreshold: 10, factProvider: makeFactProvider({ largeRowThreshold: 10 }) });
    const rows = Array.from({ length: 20 }, (_, i) => ({
      value: i,
      category: String.fromCharCode(65 + (i % 3)),
    }));
    const ds = new Dataset(
      'Scale',
      [
        { name: 'value', type: ColumnType.NUMERIC },
        { name: 'category', type: ColumnType.CATEGORICAL },
      ],
      rows
    );
    const result = engine.solve({
      topology: TopologyTypes.TABULAR,
      dataset: ds,
      encodings: { color: 'category' },
    });

    expect(result.facts.isLargeDataset).toBe(true);
    expect(result.facts.cardinalityOfColor).toBe(3);
    expect(result.facts.clusterCount).toBe(3);
    expect(result.facts.estimatedDensity).toBeGreaterThan(0);
  });

  it('prefers instanced point cloud for large tabular datasets', () => {
    const engine = new ConstraintEngine({ largeRowThreshold: 10, factProvider: makeFactProvider({ largeRowThreshold: 10 }) });
    const rows = Array.from({ length: 20 }, (_, i) => ({ value: i, category: 'A' }));
    const ds = new Dataset(
      'BigTable',
      [
        { name: 'value', type: ColumnType.NUMERIC },
        { name: 'category', type: ColumnType.CATEGORICAL },
      ],
      rows
    );
    const result = engine.solve({ topology: TopologyTypes.TABULAR, dataset: ds });

    expect(result.spec.geometry).toBe('INSTANCED_POINT_CLOUD');
    expect(result.spec.interaction).toBe('CLUSTER_PROBE');
  });

  it('prefers aggregate bars for large geo datasets', () => {
    const engine = new ConstraintEngine({ largeRowThreshold: 10, factProvider: makeFactProvider({ largeRowThreshold: 10 }) });
    const rows = Array.from({ length: 20 }, (_, i) => ({
      lat: 35 + i * 0.01,
      lon: -118 + i * 0.01,
      magnitude: i,
    }));
    const ds = new Dataset(
      'BigGeo',
      [
        { name: 'lat', type: ColumnType.NUMERIC },
        { name: 'lon', type: ColumnType.NUMERIC },
        { name: 'magnitude', type: ColumnType.NUMERIC },
      ],
      rows
    );
    const result = engine.solve({ topology: TopologyTypes.GEO, dataset: ds });

    expect(result.spec.geometry).toBe('AGGREGATE_BARS');
  });

  it('prefers cluster volume for high-cardinality color', () => {
    const engine = new ConstraintEngine({ largeRowThreshold: 100, highCardinalityThreshold: 8, factProvider: makeFactProvider({ largeRowThreshold: 100, highCardinalityThreshold: 8 }) });
    const rows = Array.from({ length: 20 }, (_, i) => ({
      value: i,
      category: String.fromCharCode(65 + i),
    }));
    const ds = new Dataset(
      'HighCard',
      [
        { name: 'value', type: ColumnType.NUMERIC },
        { name: 'category', type: ColumnType.CATEGORICAL },
      ],
      rows
    );
    const result = engine.solve({
      topology: TopologyTypes.TABULAR,
      dataset: ds,
      encodings: { color: 'category' },
    });

    expect(result.spec.geometry).toBe('CLUSTER_VOLUME');
  });

  it('extracts statistical facts for numeric columns', () => {
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const ds = new Dataset(
      'Stats',
      [{ name: 'value', type: ColumnType.NUMERIC }],
      [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }, { value: 100 }]
    );
    const result = engine.solve({ topology: TopologyTypes.TABULAR, dataset: ds });

    expect(result.facts.columnStats.value).toBeDefined();
    expect(result.facts.columnStats.value.mean).toBe(19.166666666666668);
    expect(result.facts.columnStats.value.median).toBe(3.5);
    expect(result.facts.columnStats.value.stdDev).toBeGreaterThan(0);
    expect(result.facts.hasOutliers).toBe(true);
  });

  it('computes correlation matrix for multiple numeric columns', () => {
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const ds = new Dataset(
      'Correlated',
      [
        { name: 'a', type: ColumnType.NUMERIC },
        { name: 'b', type: ColumnType.NUMERIC },
      ],
      [
        { a: 1, b: 2 },
        { a: 2, b: 4 },
        { a: 3, b: 6 },
        { a: 4, b: 8 },
        { a: 5, b: 10 },
      ]
    );
    const result = engine.solve({ topology: TopologyTypes.TABULAR, dataset: ds });

    expect(Object.keys(result.facts.correlationMatrix)).toContain('a');
    expect(result.facts.correlationMatrix.a.b).toBeCloseTo(1, 5);
  });

  it('reports categorical distribution and entropy', () => {
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const ds = new Dataset(
      'Categories',
      [{ name: 'category', type: ColumnType.CATEGORICAL }],
      [
        { category: 'A' },
        { category: 'A' },
        { category: 'B' },
        { category: 'B' },
        { category: 'B' },
      ]
    );
    const result = engine.solve({
      topology: TopologyTypes.TABULAR,
      dataset: ds,
      encodings: { color: 'category' },
    });

    expect(result.facts.categoryDistribution.category).toBeDefined();
    expect(result.facts.categoryDistribution.category.topCategories[0].value).toBe('B');
    expect(result.facts.categoryDistribution.category.entropy).toBeGreaterThan(0);
  });

  it('detects temporal trend direction', () => {
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const ds = new Dataset(
      'Trend',
      [
        { name: 'time', type: ColumnType.TEMPORAL },
        { name: 'value', type: ColumnType.NUMERIC },
      ],
      [
        { time: '2026-07-28T00:00:00', value: 1 },
        { time: '2026-07-28T01:00:00', value: 2 },
        { time: '2026-07-28T02:00:00', value: 3 },
        { time: '2026-07-28T03:00:00', value: 4 },
        { time: '2026-07-28T04:00:00', value: 5 },
      ]
    );
    const result = engine.solve({ topology: TopologyTypes.TIME_SERIES, dataset: ds });

    expect(result.facts.trendDirection).toBe('up');
    expect(result.facts.hasTimeSeries).toBe(true);
  });

  it('prefers ORB geometry when outliers are present', () => {
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const ds = new Dataset(
      'Outliers',
      [{ name: 'value', type: ColumnType.NUMERIC }],
      [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }, { value: 500 }]
    );

    // Override default grid preference so statistical rules can win.
    engine.setWeight('prefer_grid_for_tabular', 0);
    engine.setWeight('prefer_orb_for_outliers', 100);
    const result = engine.solve({ topology: TopologyTypes.TABULAR, dataset: ds });

    expect(result.spec.geometry).toBe('ORB');
  });
});

describe('VRTopologyTranslator', () => {
  it('synthesizes a radial hierarchy artifact', () => {
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const result = engine.solve({
      topology: TopologyTypes.HIERARCHY,
      dataset: orgChart,
      maxDepth: 3,
    });
    const artifact = VRTopologyTranslator.synthesizeArtifact(result, {
      topology: TopologyTypes.HIERARCHY,
      dataset: orgChart,
      maxDepth: 3,
    });

    expect(artifact.group).toBeDefined();
    expect(artifact.nodeMeshes.length).toBeGreaterThan(0);
    expect(typeof artifact.update).toBe('function');
  });

  it('synthesizes a graph artifact with edges', () => {
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const result = engine.solve({
      topology: TopologyTypes.GRAPH,
      dataset: fraudGraph,
    });
    const artifact = VRTopologyTranslator.synthesizeArtifact(result, {
      topology: TopologyTypes.GRAPH,
      dataset: fraudGraph,
    });

    expect(artifact.edgeMeshes.length).toBeGreaterThan(0);
  });

  it('maps numeric values to size and categorical values to color', () => {
    const ds = new Dataset(
      'Mini',
      [
        { name: 'category', type: ColumnType.CATEGORICAL },
        { name: 'value', type: ColumnType.NUMERIC },
      ],
      [
        { category: 'A', value: 10 },
        { category: 'B', value: 100 },
      ]
    );
    const artifact = VRTopologyTranslator.synthesizeArtifact(
      {
        facts: { nodeCount: 2, topology: 'TABULAR' },
        spec: {
          layout: 'GRID_3D',
          geometry: 'CUBE_MATRIX',
          behavior: 'STATIC',
          interaction: 'INSPECT_CELL',
        },
        cost: 0,
      },
      { topology: 'TABULAR', dataset: ds, encodings: { color: 'category', size: 'value' } }
    );

    const [m1, m2] = artifact.nodeMeshes;
    expect(m1.scale.x).not.toBe(m2.scale.x);
    expect(m1.material.color.getHex()).not.toBe(m2.material.color.getHex());
  });
});

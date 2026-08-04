// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { TopologyTypes } from '../src/draco/ConstraintEngine.js';
import { inferTopology, inferEncodingsForTopology } from '../src/data/TopologyInference.js';

function makeDataset(columns, rows) {
  return new Dataset('test', columns, rows);
}

describe('inferTopology', () => {
  it('infers TABULAR by default', () => {
    const ds = makeDataset(
      [
        { name: 'name', type: ColumnType.CATEGORICAL },
        { name: 'value', type: ColumnType.NUMERIC },
      ],
      [{ name: 'A', value: 1 }]
    );
    expect(inferTopology(ds)).toBe(TopologyTypes.TABULAR);
  });

  it('infers TIME_SERIES when a temporal column and numeric column exist', () => {
    const ds = makeDataset(
      [
        { name: 'time', type: ColumnType.TEMPORAL },
        { name: 'value', type: ColumnType.NUMERIC },
      ],
      [{ time: '2026-07-28T00:00:00', value: 10 }]
    );
    expect(inferTopology(ds)).toBe(TopologyTypes.TIME_SERIES);
  });

  it('infers GRAPH when source/target columns exist', () => {
    const ds = makeDataset(
      [
        { name: 'source', type: ColumnType.CATEGORICAL },
        { name: 'target', type: ColumnType.CATEGORICAL },
        { name: 'weight', type: ColumnType.NUMERIC },
      ],
      [{ source: 'A', target: 'B', weight: 1 }]
    );
    expect(inferTopology(ds)).toBe(TopologyTypes.GRAPH);
  });

  it('infers HIERARCHY when parent/level columns exist', () => {
    const ds = makeDataset(
      [
        { name: 'name', type: ColumnType.CATEGORICAL },
        { name: 'parentId', type: ColumnType.CATEGORICAL },
        { name: 'level', type: ColumnType.NUMERIC },
      ],
      [{ name: 'A', parentId: 'root', level: 1 }]
    );
    expect(inferTopology(ds)).toBe(TopologyTypes.HIERARCHY);
  });

  it('infers GEO when lat/lon columns exist', () => {
    const ds = makeDataset(
      [
        { name: 'lat', type: ColumnType.NUMERIC },
        { name: 'lon', type: ColumnType.NUMERIC },
        { name: 'city', type: ColumnType.CATEGORICAL },
      ],
      [{ lat: 40.7, lon: -74, city: 'NYC' }]
    );
    expect(inferTopology(ds)).toBe(TopologyTypes.GEO);
  });

  it('infers VECTOR_FIELD when vector component columns exist', () => {
    const ds = makeDataset(
      [
        { name: 'u', type: ColumnType.NUMERIC },
        { name: 'v', type: ColumnType.NUMERIC },
        { name: 'w', type: ColumnType.NUMERIC },
      ],
      [{ u: 1, v: 2, w: 3 }]
    );
    expect(inferTopology(ds)).toBe(TopologyTypes.VECTOR_FIELD);
  });

  it('prefers explicit user override', () => {
    const ds = makeDataset(
      [
        { name: 'time', type: ColumnType.TEMPORAL },
        { name: 'value', type: ColumnType.NUMERIC },
      ],
      [{ time: '2026-07-28T00:00:00', value: 10 }]
    );
    expect(inferTopology(ds, 'GRAPH')).toBe(TopologyTypes.GRAPH);
  });

  it('ignores invalid explicit overrides', () => {
    const ds = makeDataset(
      [
        { name: 'source', type: ColumnType.CATEGORICAL },
        { name: 'target', type: ColumnType.CATEGORICAL },
      ],
      [{ source: 'A', target: 'B' }]
    );
    expect(inferTopology(ds, 'INVALID')).toBe(TopologyTypes.GRAPH);
  });
});

describe('inferEncodingsForTopology', () => {
  it('produces TABULAR encodings', () => {
    const ds = makeDataset(
      [
        { name: 'category', type: ColumnType.CATEGORICAL },
        { name: 'value', type: ColumnType.NUMERIC },
      ],
      [{ category: 'A', value: 1 }]
    );
    expect(inferEncodingsForTopology(ds, TopologyTypes.TABULAR)).toEqual({
      color: 'category',
      size: 'value',
    });
  });

  it('produces TIME_SERIES encodings', () => {
    const ds = makeDataset(
      [
        { name: 'time', type: ColumnType.TEMPORAL },
        { name: 'value', type: ColumnType.NUMERIC },
        { name: 'sensorId', type: ColumnType.CATEGORICAL },
      ],
      [{ time: '2026-07-28T00:00:00', value: 10, sensorId: 'S1' }]
    );
    expect(inferEncodingsForTopology(ds, TopologyTypes.TIME_SERIES)).toEqual({
      color: 'sensorId',
      size: 'value',
      time: 'time',
    });
  });

  it('drops undefined encoding values', () => {
    const ds = makeDataset([{ name: 'value', type: ColumnType.NUMERIC }], [{ value: 1 }]);
    expect(inferEncodingsForTopology(ds, TopologyTypes.TABULAR)).toEqual({
      color: 'value',
      size: 'value',
    });
  });
});

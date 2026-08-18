// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { ConstraintEngine, TopologyTypes } from '../src/draco/ConstraintEngine.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeFactProvider } from './helpers/dracoFactsHelper.ts';

function makeDataset(rows, topology) {
  const columns = [
    { name: 'time', type: ColumnType.TEMPORAL },
    { name: 'value', type: ColumnType.NUMERIC },
    { name: 'sensorId', type: ColumnType.CATEGORICAL },
  ];
  return new Dataset('Live', columns, rows);
}

describe('Draco live data topology mapping', () => {
  it('resolves TIME_SERIES to TIME_RIBBON', () => {
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const ds = makeDataset([
      { time: '2024-01-01T00:00:00Z', value: 10, sensorId: 'A' },
      { time: '2024-01-01T00:01:00Z', value: 12, sensorId: 'A' },
    ]);
    const result = engine.solve({ topology: TopologyTypes.TIME_SERIES, dataset: ds });
    expect(result.spec.layout).toBe('TIME_RIBBON');
    expect(result.spec.interaction).toBe('HARVEST_STREAM');
  });

  it('resolves VECTOR_FIELD to VECTOR_STREAMLINE', () => {
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const ds = new Dataset(
      'Vectors',
      [
        { name: 'vx', type: ColumnType.NUMERIC },
        { name: 'vy', type: ColumnType.NUMERIC },
        { name: 'vz', type: ColumnType.NUMERIC },
      ],
      [
        { vx: 1, vy: 0, vz: 0 },
        { vx: 0, vy: 1, vz: 0 },
      ]
    );
    const result = engine.solve({ topology: TopologyTypes.VECTOR_FIELD, dataset: ds });
    expect(result.spec.layout).toBe('VECTOR_STREAMLINE');
    expect(result.spec.interaction).toBe('HARVEST_STREAM');
  });

  it('resolves GEO to GEO_SURFACE', () => {
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const ds = new Dataset(
      'Geo',
      [
        { name: 'lat', type: ColumnType.NUMERIC },
        { name: 'lon', type: ColumnType.NUMERIC },
        { name: 'magnitude', type: ColumnType.NUMERIC },
      ],
      [
        { lat: 35.0, lon: -118.0, magnitude: 2.5 },
        { lat: 36.0, lon: -119.0, magnitude: 3.1 },
      ]
    );
    const result = engine.solve({ topology: TopologyTypes.GEO, dataset: ds });
    expect(result.spec.layout).toBe('GEO_SURFACE');
    expect(result.spec.geometry).toBe('GEO_COLUMN');
    expect(result.spec.interaction).toBe('INSPECT_CELL');
  });

  it('prefers motion for continuous live data', () => {
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const ds = makeDataset([{ time: '2024-01-01T00:00:00Z', value: 10, sensorId: 'A' }]);
    const result = engine.solve({ topology: TopologyTypes.TIME_SERIES, dataset: ds });
    expect(result.spec.behavior).not.toBe('STATIC');
  });
});

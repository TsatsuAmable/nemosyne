// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ConstraintEngine, TopologyTypes } from '../src/draco/ConstraintEngine.ts';
import { VRTopologyTranslator } from '../src/draco/VRTopologyTranslator.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeFactProvider } from './helpers/dracoFactsHelper.ts';

describe('VRTopologyTranslator live/incremental updates', () => {
  beforeEach(() => {
    // Ensure Three.js mocks are present from tests/setup.js.
    expect(THREE.Vector3).toBeDefined();
  });

  function makeTimeSeriesDataset(rows) {
    const columns = [
      { name: 'time', type: ColumnType.TEMPORAL },
      { name: 'value', type: ColumnType.NUMERIC },
      { name: 'sensorId', type: ColumnType.CATEGORICAL },
    ];
    return new Dataset('Live', columns, rows);
  }

  it('builds a TIME_RIBBON with one mesh per series', () => {
    const ds = makeTimeSeriesDataset([
      { time: '2024-01-01T00:00:00Z', value: 10, sensorId: 'A' },
      { time: '2024-01-01T00:01:00Z', value: 12, sensorId: 'A' },
      { time: '2024-01-01T00:00:00Z', value: 5, sensorId: 'B' },
      { time: '2024-01-01T00:01:00Z', value: 7, sensorId: 'B' },
    ]);
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const solved = engine.solve({ topology: TopologyTypes.TIME_SERIES, dataset: ds });
    const artifact = VRTopologyTranslator.synthesizeArtifact(solved, { dataset: ds });

    const seriesMeshes = artifact.nodeMeshes.filter((m) => m.userData.row?.series);
    expect(seriesMeshes.length).toBe(2);
    expect(artifact.spec.layout).toBe('TIME_RIBBON');
  });

  it('incrementally appends rows to TIME_RIBBON without recreating all meshes', () => {
    const ds = makeTimeSeriesDataset([
      { time: '2024-01-01T00:00:00Z', value: 10, sensorId: 'A' },
      { time: '2024-01-01T00:01:00Z', value: 12, sensorId: 'A' },
    ]);
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const solved = engine.solve({ topology: TopologyTypes.TIME_SERIES, dataset: ds });
    const artifact = VRTopologyTranslator.synthesizeArtifact(solved, { dataset: ds });

    const beforeCount = artifact.nodeMeshes.length;
    const meshA = artifact.nodeMeshes.find((m) => m.userData.row?.series === 'A');
    const beforeGeometry = meshA.geometry;

    const appended = VRTopologyTranslator.appendRowsToArtifact(
      artifact,
      [{ time: '2024-01-01T00:02:00Z', value: 14, sensorId: 'A' }],
      { dataset: ds }
    );

    expect(appended).toBe(true);
    expect(artifact.nodeMeshes.length).toBe(beforeCount);
    expect(meshA.geometry).not.toBe(beforeGeometry);
    expect(meshA.geometry).toBeDefined();
  });

  it('returns false for incremental append on non-ribbon layouts', () => {
    const ds = new Dataset(
      'Tabular',
      [
        { name: 'a', type: ColumnType.NUMERIC },
        { name: 'b', type: ColumnType.CATEGORICAL },
      ],
      [
        { a: 1, b: 'x' },
        { a: 2, b: 'y' },
      ]
    );
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const solved = engine.solve({ topology: TopologyTypes.TABULAR, dataset: ds });
    const artifact = VRTopologyTranslator.synthesizeArtifact(solved, { dataset: ds });

    const appended = VRTopologyTranslator.appendRowsToArtifact(artifact, [{ a: 3, b: 'z' }], {
      dataset: ds,
    });
    expect(appended).toBe(false);
  });
});

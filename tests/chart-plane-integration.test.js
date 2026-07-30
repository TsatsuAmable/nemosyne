import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ConstraintEngine, TopologyTypes } from '../src/draco/ConstraintEngine.js';
import { VRTopologyTranslator } from '../src/draco/VRTopologyTranslator.js';
import { Dataset, ColumnType } from '../src/data/Dataset.js';
import { ChartPlane } from '../src/vr/artifacts/ChartPlane.js';

describe('ChartPlane integration', () => {
  it('synthesizes a chart plane for time-series data', () => {
    const ds = new Dataset('Time', [
      { name: 'time', type: ColumnType.TEMPORAL },
      { name: 'value', type: ColumnType.NUMERIC },
    ], [
      { time: '2026-07-28T00:00:00', value: 1 },
      { time: '2026-07-28T01:00:00', value: 2 },
      { time: '2026-07-28T02:00:00', value: 3 },
    ]);
    const engine = new ConstraintEngine();
    const solved = engine.solve({ topology: TopologyTypes.TIME_SERIES, dataset: ds });
    const artifact = VRTopologyTranslator.synthesizeArtifact(solved, { dataset: ds });

    expect(artifact.chartPlane).toBeTruthy();
    expect(artifact.chartPlane.mesh.parent).toBe(artifact.group);
  });

  it('synthesizes a chart plane for tabular data with multiple numeric columns', () => {
    const ds = new Dataset('Multi', [
      { name: 'a', type: ColumnType.NUMERIC },
      { name: 'b', type: ColumnType.NUMERIC },
    ], [
      { a: 1, b: 2 },
      { a: 2, b: 4 },
      { a: 3, b: 6 },
    ]);
    const engine = new ConstraintEngine();
    const solved = engine.solve({ topology: TopologyTypes.TABULAR, dataset: ds });
    const artifact = VRTopologyTranslator.synthesizeArtifact(solved, { dataset: ds });

    expect(artifact.chartPlane).toBeTruthy();
  });

  it('does not attach a chart plane for tabular data without multiple numeric columns or time', () => {
    const ds = new Dataset('Single', [
      { name: 'category', type: ColumnType.CATEGORICAL },
      { name: 'value', type: ColumnType.NUMERIC },
    ], [
      { category: 'A', value: 10 },
      { category: 'B', value: 20 },
    ]);
    const engine = new ConstraintEngine();
    const solved = engine.solve({ topology: TopologyTypes.TABULAR, dataset: ds });
    const artifact = VRTopologyTranslator.synthesizeArtifact(solved, { dataset: ds });

    expect(artifact.chartPlane).toBeUndefined();
  });

  it('factory picks correlation chart for multi-numeric facts', () => {
    const ds = new Dataset('Corr', [
      { name: 'a', type: ColumnType.NUMERIC },
      { name: 'b', type: ColumnType.NUMERIC },
    ], [
      { a: 1, b: 2 },
      { a: 2, b: 4 },
      { a: 3, b: 6 },
    ]);
    const chart = ChartPlane.fromFacts({ numericColumns: 2, hasTimeSeries: false }, ds);
    expect(chart.chartType).toBe('CORRELATION');
    chart.setDataset(ds);
    expect(chart.mesh).toBeTruthy();
  });

  it('factory picks line chart for time-series facts', () => {
    const ds = new Dataset('Trend', [
      { name: 'time', type: ColumnType.TEMPORAL },
      { name: 'value', type: ColumnType.NUMERIC },
    ], [
      { time: '2026-07-28T00:00:00', value: 1 },
      { time: '2026-07-28T01:00:00', value: 2 },
    ]);
    const chart = ChartPlane.fromFacts({ numericColumns: 1, hasTimeSeries: true }, ds);
    expect(chart.chartType).toBe('LINE');
    chart.setDataset(ds);
    expect(chart.mesh).toBeTruthy();
  });
});

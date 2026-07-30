import { describe, it, expect } from 'vitest';
import { Dataset, ColumnType } from '../src/data/Dataset.js';
import { ChartPlane, ChartType } from '../src/vr/artifacts/ChartPlane.js';

describe('ChartPlane', () => {
  it('renders a bar chart from a numeric column', () => {
    const ds = new Dataset('Bar', [
      { name: 'id', type: ColumnType.NUMERIC },
      { name: 'value', type: ColumnType.NUMERIC },
    ], [
      { id: 1, value: 10 },
      { id: 2, value: 30 },
      { id: 3, value: 20 },
    ]);
    const chart = new ChartPlane({ chartType: ChartType.BAR, column: 'value', title: 'Values' });
    const versionBefore = chart.texture.version;
    chart.setDataset(ds);
    expect(chart.mesh).toBeTruthy();
    expect(chart.texture.version).toBeGreaterThan(versionBefore);
  });

  it('renders a line chart from temporal + numeric columns', () => {
    const ds = new Dataset('Line', [
      { name: 'time', type: ColumnType.TEMPORAL },
      { name: 'value', type: ColumnType.NUMERIC },
    ], [
      { time: '2026-07-28T00:00:00', value: 1 },
      { time: '2026-07-28T01:00:00', value: 2 },
      { time: '2026-07-28T02:00:00', value: 3 },
    ]);
    const chart = new ChartPlane({ chartType: ChartType.LINE, title: 'Trend' });
    const versionBefore = chart.texture.version;
    chart.setDataset(ds);
    expect(chart.texture.version).toBeGreaterThan(versionBefore);
  });

  it('renders a histogram of a numeric field', () => {
    const ds = new Dataset('Hist', [
      { name: 'value', type: ColumnType.NUMERIC },
    ], [
      { value: 1 }, { value: 2 }, { value: 3 }, { value: 5 }, { value: 8 },
    ]);
    const chart = new ChartPlane({ chartType: ChartType.HISTOGRAM, column: 'value' });
    const versionBefore = chart.texture.version;
    chart.setDataset(ds);
    expect(chart.texture.version).toBeGreaterThan(versionBefore);
  });

  it('renders a box plot for a numeric field', () => {
    const ds = new Dataset('Box', [
      { name: 'value', type: ColumnType.NUMERIC },
    ], [
      { value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 100 },
    ]);
    const chart = new ChartPlane({ chartType: ChartType.BOX, column: 'value' });
    const versionBefore = chart.texture.version;
    chart.setDataset(ds);
    expect(chart.texture.version).toBeGreaterThan(versionBefore);
  });

  it('renders a correlation heatmap when numericColumns > 1', () => {
    const ds = new Dataset('Corr', [
      { name: 'a', type: ColumnType.NUMERIC },
      { name: 'b', type: ColumnType.NUMERIC },
    ], [
      { a: 1, b: 2 },
      { a: 2, b: 4 },
      { a: 3, b: 6 },
      { a: 4, b: 8 },
    ]);
    const chart = new ChartPlane({ chartType: ChartType.CORRELATION });
    const versionBefore = chart.texture.version;
    chart.setDataset(ds);
    expect(chart.texture.version).toBeGreaterThan(versionBefore);
  });

  it('shows no-data placeholder for empty dataset', () => {
    const ds = new Dataset('Empty', [{ name: 'value', type: ColumnType.NUMERIC }], []);
    const chart = new ChartPlane({ chartType: ChartType.BAR, column: 'value' });
    const versionBefore = chart.texture.version;
    chart.setDataset(ds);
    expect(chart.texture.version).toBeGreaterThan(versionBefore);
  });

  it('updates title and redraws', () => {
    const ds = new Dataset('Title', [{ name: 'value', type: ColumnType.NUMERIC }], [{ value: 5 }]);
    const chart = new ChartPlane({ chartType: ChartType.BAR, column: 'value', title: 'Old' });
    chart.setDataset(ds);
    const versionBefore = chart.texture.version;
    chart.setTitle('New');
    expect(chart.title).toBe('New');
    expect(chart.texture.version).toBeGreaterThan(versionBefore);
  });
});

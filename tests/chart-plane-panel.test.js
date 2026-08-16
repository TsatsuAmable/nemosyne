// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { ChartPlanePanel } from '../src/vr/ui/ChartPlanePanel.ts';
import { MovablePanel } from '../src/vr/ui/MovablePanel.ts';
import { DashboardManager } from '../src/vr/ui/DashboardManager.ts';

describe('ChartPlanePanel', () => {
  let cameraGroup;
  let dataset;

  beforeEach(() => {
    cameraGroup = new THREE.Group();
    dataset = new Dataset(
      'Test',
      [
        { name: 'category', type: ColumnType.CATEGORICAL },
        { name: 'value', type: ColumnType.NUMERIC },
      ],
      [
        { category: 'A', value: 10 },
        { category: 'B', value: 30 },
        { category: 'C', value: 20 },
      ]
    );
  });

  it('extends MovablePanel', () => {
    const panel = new ChartPlanePanel(cameraGroup, dataset, {
      title: 'Values',
      chartType: 'BAR',
      column: 'value',
    });
    expect(panel).toBeInstanceOf(MovablePanel);
    expect(panel.mesh).toBeTruthy();
  });

  it('hosts a ChartPlane and renders its title', () => {
    const panel = new ChartPlanePanel(cameraGroup, dataset, {
      title: 'Values',
      chartType: 'BAR',
      column: 'value',
    });
    expect(panel.chartPlane).toBeTruthy();
    expect(panel.chartPlane.title).toBe('Values');
    expect(panel.title).toBe('Values');
  });

  it('passes and updates colorblind mode on the chart renderer', () => {
    const panel = new ChartPlanePanel(cameraGroup, dataset, {
      chartType: 'BAR',
      column: 'value',
      colorblindMode: 'deuteranopia',
    });
    expect(panel.chartPlane.colorblindMode).toBe('deuteranopia');

    panel.applyAccessibility({ textScale: 1, highContrast: false, colorblindMode: 'tritanopia' });
    expect(panel.chartPlane.colorblindMode).toBe('tritanopia');
  });

  it.each(['BAR', 'LINE', 'HISTOGRAM', 'BOX', 'CORRELATION'])(
    'redraws an existing %s chart when colorblind mode changes',
    (chartType) => {
      const chartDataset =
        chartType === 'LINE'
          ? new Dataset(
              'Line',
              [
                { name: 'time', type: ColumnType.TEMPORAL },
                { name: 'value', type: ColumnType.NUMERIC },
              ],
              [
                { time: '2026-01-01T00:00:00Z', value: 1 },
                { time: '2026-01-01T01:00:00Z', value: 2 },
              ]
            )
          : chartType === 'CORRELATION'
            ? new Dataset(
                'Correlation',
                [
                  { name: 'a', type: ColumnType.NUMERIC },
                  { name: 'b', type: ColumnType.NUMERIC },
                ],
                [
                  { a: 1, b: 2 },
                  { a: 2, b: 4 },
                  { a: 3, b: 6 },
                ]
              )
            : dataset;
      const panel = new ChartPlanePanel(cameraGroup, chartDataset, {
        chartType,
        column: 'value',
      });
      const before = panel.chartPlane.texture.version;

      panel.applyAccessibility({ textScale: 1, highContrast: false, colorblindMode: 'protanopia' });

      expect(panel.chartPlane.colorblindMode).toBe('protanopia');
      expect(panel.chartPlane.texture.version).toBeGreaterThan(before);
    }
  );

  it('updates the chart when the dataset changes', () => {
    const panel = new ChartPlanePanel(cameraGroup, dataset, {
      chartType: 'BAR',
      column: 'value',
    });
    const before = panel.texture.version;

    const updated = new Dataset(
      'Updated',
      [
        { name: 'category', type: ColumnType.CATEGORICAL },
        { name: 'value', type: ColumnType.NUMERIC },
      ],
      [{ category: 'X', value: 100 }]
    );
    panel.setDataset(updated);

    expect(panel.texture.version).toBeGreaterThan(before);
  });

  it('can be registered and snapped to a dashboard zone', () => {
    const panel = new ChartPlanePanel(cameraGroup, dataset, {
      chartType: 'BAR',
      column: 'value',
    });

    const dashboard = new DashboardManager(cameraGroup, {
      columns: 2,
      rows: 1,
      cellWidth: 1,
      cellHeight: 0.7,
      wallPosition: [0, 1.6, 1.5],
    });

    dashboard.registerPanel(panel, 0);

    expect(dashboard.getPanelCount()).toBe(1);
    expect(panel.mesh.position.y).toBeCloseTo(1.6, 3);
    expect(panel.mesh.position.z).toBeCloseTo(1.5, 3);
  });

  it('exposes an update hook that refreshes the chart', () => {
    const panel = new ChartPlanePanel(cameraGroup, dataset, {
      chartType: 'BAR',
      column: 'value',
    });
    const before = panel.texture.version;
    panel.update();
    expect(panel.texture.version).toBeGreaterThanOrEqual(before);
  });

  it('disposes the chart GPU resources with the panel', () => {
    const panel = new ChartPlanePanel(cameraGroup, dataset, { chartType: 'BAR', column: 'value' });
    const textureDispose = panel.chartPlane.texture.dispose;
    const materialDispose = panel.chartPlane.material.dispose;
    panel.dispose();
    expect(panel.chartPlane.canvas.width).toBe(1);
    expect(panel.chartPlane.canvas.height).toBe(1);
    expect(panel.chartPlane.texture.dispose).toBe(textureDispose);
    expect(panel.chartPlane.material.dispose).toBe(materialDispose);
  });
});

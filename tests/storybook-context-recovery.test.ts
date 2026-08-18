// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { AnalysisStorybookExporter } from '../src/utils/AnalysisStorybookExporter.ts';
import { ContextRecoveryManager } from '../src/vr/scalability/ContextRecoveryManager.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';

describe('Sprint 13.3 & 13.4: Storybook Exporter & Context Recovery Suite', () => {
  const sampleDataset = new Dataset(
    'SalesData',
    [{ name: 'region', type: ColumnType.CATEGORICAL }, { name: 'revenue', type: ColumnType.NUMERIC }],
    [{ region: 'North', revenue: 100 }, { region: 'South', revenue: 200 }]
  );

  it('exports structured Storybook JSON bundle with dataset snapshot and checkpoints', () => {
    const checkpoints = [
      {
        id: 'chk-1',
        title: 'Initial Outlier View',
        description: 'Selected top region node',
        cameraPose: { position: [0, 1.6, 0] as [number, number, number], rotation: [0, 0, 0, 1] as [number, number, number, number] },
        timestamp: Date.now(),
      },
    ];

    const bundle = AnalysisStorybookExporter.exportStorybook(sampleDataset, 'Q1 Analysis', 'Lead Analyst', checkpoints);

    expect(bundle.title).toBe('Q1 Analysis');
    expect(bundle.datasetName).toBe('SalesData');
    expect(bundle.datasetSnapshot.rowCount).toBe(2);
    expect(bundle.checkpoints.length).toBe(1);

    const jsonStr = AnalysisStorybookExporter.serializeBundle(bundle);
    expect(jsonStr).toContain('Q1 Analysis');
    expect(jsonStr).toContain('Initial Outlier View');
  });

  it('detects WebGL context loss and triggers recovery handlers', () => {
    const domElement = document.createElement('canvas');
    const renderer = { domElement } as unknown as THREE.WebGLRenderer;

    const onContextLost = vi.fn();
    const onContextRestored = vi.fn();

    const manager = new ContextRecoveryManager(renderer, { onContextLost, onContextRestored });

    expect(manager.isContextLost).toBe(false);

    manager.simulateContextLoss();
    expect(manager.isContextLost).toBe(true);
    expect(onContextLost).toHaveBeenCalledTimes(1);

    manager.simulateContextRestoration();
    expect(manager.isContextLost).toBe(false);
    expect(onContextRestored).toHaveBeenCalledTimes(1);
  });
});

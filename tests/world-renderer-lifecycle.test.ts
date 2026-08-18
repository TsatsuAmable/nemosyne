// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { WorldRendererLifecycle } from '../src/vr/coordinators/WorldRendererLifecycle.ts';

function makeDataset(): Dataset {
  return new Dataset(
    'Dashboard',
    [{ name: 'value', type: ColumnType.NUMERIC }],
    [{ value: 1 }, { value: 2 }]
  );
}

describe('WorldRendererLifecycle dashboard ownership', () => {
  it('disposes dashboard panels and unregisters their input and tooltip targets', () => {
    const cameraGroup = new THREE.Group();
    const input = { panels: [] as unknown[], addPanel: vi.fn() };
    const engine = {
      cameraGroup,
      scene: new THREE.Scene(),
      input,
    };
    const dashboard = {
      registerPanel: vi.fn(),
      unregisterPanel: vi.fn(),
    };
    const tooltipManager = { targets: [] as THREE.Object3D[], registerTarget: vi.fn() };
    const lifecycle = new WorldRendererLifecycle({
      engine: engine as never,
      dashboard: dashboard as never,
      tooltipManager: tooltipManager as never,
      getOriginalDataset: () => makeDataset(),
      getDracoNode: () => null,
      getAtlas: () => null,
    });

    lifecycle.rebuildDashboard();

    expect(lifecycle.dashboardPanels).toHaveLength(1);
    const panel = lifecycle.dashboardPanels[0].panel;
    input.panels.push(panel);
    tooltipManager.targets.push(panel.mesh);
    const dispose = vi.spyOn(panel, 'dispose');

    lifecycle.disposeDashboard();

    expect(dispose).toHaveBeenCalledOnce();
    expect(dashboard.unregisterPanel).toHaveBeenCalledWith(panel);
    expect(input.panels).toEqual([]);
    expect(tooltipManager.targets).toEqual([]);
    expect(lifecycle.dashboardPanels).toEqual([]);
    expect(lifecycle.dashboardTooltipTargets).toEqual([]);
  });
});

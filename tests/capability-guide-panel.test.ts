// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CapabilityGuidePanel } from '../src/vr/ui/CapabilityGuidePanel.ts';
import { ContextualTaskSurface } from '../src/vr/ui/ContextualTaskSurface.ts';
import type { WheelMenuCategory } from '../src/vr/coordinators/types.ts';

function engine() {
  const camera = new THREE.PerspectiveCamera();
  return { camera } as never;
}

function categories(onData = vi.fn()): WheelMenuCategory[] {
  return [
    {
      id: 'DATA',
      label: 'Data',
      items: [{ id: 'data-sources', label: 'Data Sources', callback: onData }],
    },
    {
      id: 'ANALYSE',
      label: 'Analyse',
      items: [{ id: 'anomaly', label: 'Detect Anomalies', callback: vi.fn() }],
    },
    {
      id: 'GUIDE',
      label: 'Guide',
      items: [{ id: 'what-can-i-do', label: 'What can I do here?', callback: vi.fn() }],
    },
  ];
}

describe('CapabilityGuidePanel', () => {
  it('derives selected-object guidance from canonical investigator task metadata', () => {
    const taskSurface = new ContextualTaskSurface(engine());
    taskSurface.showAtNode(new THREE.Group(), { id: 'row-1', topology: 'TABULAR' });
    const panel = new CapabilityGuidePanel({
      parent: new THREE.Group(),
      getWheelCategories: () => categories(),
      contextualTaskSurface: taskSurface,
    });

    panel.show();
    const summary = panel.getRenderedSummary();
    expect(summary).toContain('Selected: row-1');
    expect(summary).toContain('Inspect — Inspect the selected data object');
    expect(summary).toContain('Navigate — No linked path');
    expect(summary).toContain('Data: Data Sources');
    expect(summary).not.toContain('What can I do here? ·');
    expect(panel.visible).toBe(true);
    panel.dispose();
    taskSurface.dispose();
  });

  it('dispatches global actions through the live wheel category authority', () => {
    const onData = vi.fn();
    const taskSurface = new ContextualTaskSurface(engine());
    const panel = new CapabilityGuidePanel({
      parent: new THREE.Group(),
      getWheelCategories: () => categories(onData),
      contextualTaskSurface: taskSurface,
    });
    panel.show();

    expect(panel.dispatchGlobal('DATA', 'data-sources')).toBe(true);
    expect(onData).toHaveBeenCalledTimes(1);
    expect(panel.visible).toBe(false);
    expect(panel.dispatchGlobal('DATA', 'missing')).toBe(false);
    panel.dispose();
    taskSurface.dispose();
  });

  it('dispatches available selected-object actions and rejects disabled ones', () => {
    const onInspect = vi.fn();
    const onNavigate = vi.fn();
    const taskSurface = new ContextualTaskSurface(engine(), { onInspect, onNavigate });
    taskSurface.showAtNode(new THREE.Group(), { id: 'row-1', topology: 'TABULAR' });
    const panel = new CapabilityGuidePanel({
      parent: new THREE.Group(),
      getWheelCategories: () => categories(),
      contextualTaskSurface: taskSurface,
    });
    panel.show();

    expect(panel.dispatchSelected('navigate')).toBe(false);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(panel.dispatchSelected('inspect')).toBe(true);
    expect(onInspect).toHaveBeenCalledWith({ id: 'row-1', topology: 'TABULAR' });
    panel.dispose();
    taskSurface.dispose();
  });
});

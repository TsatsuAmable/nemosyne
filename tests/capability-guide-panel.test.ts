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
  it('explains Nemosyne purpose and the investigation mental model before listing actions', () => {
    const taskSurface = new ContextualTaskSurface(engine());
    const panel = new CapabilityGuidePanel({
      parent: new THREE.Group(),
      getWheelCategories: () => categories(),
      contextualTaskSurface: taskSurface,
    });

    panel.show();
    const summary = panel.getRenderedSummary();
    expect(summary).toContain('PURPOSE');
    expect(summary).toContain(
      'Nemosyne turns governed analytical structure into spatial representations you can inspect, challenge, and trace to evidence.'
    );
    expect(summary).toContain('MENTAL MODEL');
    expect(summary).toContain(
      'dataset → representation → structure → question → investigation → evidence'
    );
    expect(summary).toContain(
      'A representation is a governed view of the dataset, not the dataset itself.'
    );
    expect(summary.indexOf('PURPOSE')).toBeLessThan(summary.indexOf('CONTEXT'));
    expect(summary).not.toContain('GLOBAL CAPABILITIES');
    panel.dispose();
    taskSurface.dispose();
  });

  it('keeps the default orientation compact and reveals the capability map on demand', () => {
    const taskSurface = new ContextualTaskSurface(engine());
    taskSurface.showAtNode(new THREE.Group(), { id: 'row-1', topology: 'TABULAR' });
    const panel = new CapabilityGuidePanel({
      parent: new THREE.Group(),
      getWheelCategories: () => categories(),
      contextualTaskSurface: taskSurface,
    });

    panel.show();
    expect(panel.getRenderedSummary()).not.toContain('GLOBAL CAPABILITIES');
    expect(panel.getRenderedSummary()).not.toContain('Navigate — No linked path');

    panel.setCapabilityDetailsExpanded(true);
    expect(panel.getRenderedSummary()).toContain('GLOBAL CAPABILITIES');
    expect(panel.getRenderedSummary()).toContain('Navigate — No linked path');
    panel.dispose();
    taskSurface.dispose();
  });

  it('does not recommend loading again when a dataset and promoted representation are live', () => {
    const taskSurface = new ContextualTaskSurface(engine());
    const panel = new CapabilityGuidePanel({
      parent: new THREE.Group(),
      getWheelCategories: () => categories(),
      contextualTaskSurface: taskSurface,
      hasDataset: () => true,
      hasRepresentation: () => true,
    });

    panel.show();
    const summary = panel.getRenderedSummary();
    expect(summary).toContain('Dataset loaded. Nothing selected.');
    expect(summary).toContain(
      'NEXT: Select a structure — choose a visible dataset structure to inspect or challenge'
    );
    expect(summary).not.toContain('NEXT: Data Sources');
    panel.dispose();
    taskSurface.dispose();
  });

  it('routes a loaded dataset with no promoted representation to canonical context guidance', () => {
    const onMore = vi.fn();
    const taskSurface = new ContextualTaskSurface(engine(), { onMore });
    const panel = new CapabilityGuidePanel({
      parent: new THREE.Group(),
      getWheelCategories: () => categories(),
      contextualTaskSurface: taskSurface,
      hasDataset: () => true,
      hasRepresentation: () => false,
    });

    panel.show();
    const summary = panel.getRenderedSummary();
    expect(summary).toContain('Dataset loaded. No representation is currently promoted.');
    expect(summary).toContain('NEXT: More — Open constraints and additional context');
    expect(summary).not.toContain('NEXT: Select a structure');
    expect(panel.dispatchSelected('more')).toBe(true);
    expect(onMore).toHaveBeenCalledOnce();
    panel.dispose();
    taskSurface.dispose();
  });

  it('points an unstarted investigation at the live Data Sources action', () => {
    const taskSurface = new ContextualTaskSurface(engine());
    const panel = new CapabilityGuidePanel({
      parent: new THREE.Group(),
      getWheelCategories: () => categories(),
      contextualTaskSurface: taskSurface,
    });

    panel.show();
    expect(panel.getRenderedSummary()).toContain(
      'NEXT: Data Sources — load a dataset to begin an investigation'
    );
    panel.dispose();
    taskSurface.dispose();
  });

  it('derives the next meaningful selected-object step from canonical task availability', () => {
    const taskSurface = new ContextualTaskSurface(engine());
    taskSurface.showAtNode(new THREE.Group(), { id: 'row-1', topology: 'TABULAR' });
    const panel = new CapabilityGuidePanel({
      parent: new THREE.Group(),
      getWheelCategories: () => categories(),
      contextualTaskSurface: taskSurface,
    });

    panel.show();
    expect(panel.getRenderedSummary()).toContain(
      'NEXT: Inspect — Inspect the selected data object'
    );
    panel.dispose();
    taskSurface.dispose();
  });

  it('refreshes the displayed orientation only when live context changes while GUIDE is open', () => {
    const taskSurface = new ContextualTaskSurface(engine());
    const panel = new CapabilityGuidePanel({
      parent: new THREE.Group(),
      getWheelCategories: () => categories(),
      contextualTaskSurface: taskSurface,
      hasDataset: () => true,
      hasRepresentation: () => true,
    });

    panel.show();
    expect(panel.getRenderedSummary()).toContain('NEXT: Select a structure');
    const refresh = vi.spyOn(panel, 'refresh');
    panel.update(0.016);
    expect(refresh).not.toHaveBeenCalled();

    taskSurface.showAtNode(new THREE.Group(), { id: 'row-1', topology: 'TABULAR' });
    expect(panel.getRenderedSummary()).toContain('NEXT: Select a structure');
    panel.update(0.016);
    expect(refresh).toHaveBeenCalledOnce();
    expect(panel.getRenderedSummary()).toContain(
      'NEXT: Inspect — Inspect the selected data object'
    );
    panel.dispose();
    taskSurface.dispose();
  });

  it('derives selected-object guidance from canonical investigator task metadata', () => {
    const taskSurface = new ContextualTaskSurface(engine());
    taskSurface.showAtNode(new THREE.Group(), { id: 'row-1', topology: 'TABULAR' });
    const panel = new CapabilityGuidePanel({
      parent: new THREE.Group(),
      getWheelCategories: () => categories(),
      contextualTaskSurface: taskSurface,
    });

    panel.show();
    expect(panel.getRenderedSummary()).toContain('Selected: row-1');
    expect(panel.getRenderedSummary()).toContain(
      'NEXT: Inspect — Inspect the selected data object'
    );

    panel.setCapabilityDetailsExpanded(true);
    const summary = panel.getRenderedSummary();
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

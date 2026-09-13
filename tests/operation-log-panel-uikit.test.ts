import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { OperationLogPanel } from '../src/vr/ui/OperationLogPanel.ts';
import { SpatialPanel } from '../src/vr/ui-system/SpatialPanel.ts';

describe('OperationLogPanel UXR1 UIKit migration', () => {
  it('uses SpatialPanel and preserves panel lifecycle', () => {
    const anchor = new THREE.Group();
    const panel = new OperationLogPanel(anchor);
    expect(panel).toBeInstanceOf(SpatialPanel);
    expect(panel.parent).toBe(anchor);
    expect(panel.mesh).toBe(panel);

    panel.hide();
    expect(panel.visible).toBe(false);
    panel.show();
    expect(panel.visible).toBe(true);
  });

  it('copies supplied history and renders newest entries first without owning history state', () => {
    const panel = new OperationLogPanel(new THREE.Group());
    const entries = [
      { operation: 'filter', timestamp: 1, rowCount: 10 },
      { operation: 'cluster', timestamp: 2, rowCount: 4 },
    ];

    panel.setEntries(entries);
    expect(panel.entries.map((entry) => entry.operation)).toEqual(['cluster', 'filter']);
    expect(entries.map((entry) => entry.operation)).toEqual(['filter', 'cluster']);
  });

  it('keeps accessibility mutation on the UIKit path', () => {
    const panel = new OperationLogPanel(new THREE.Group());
    expect(() =>
      panel.applyAccessibility({
        textScale: 1.25,
        highContrast: true,
        colorblindMode: 'none',
        reducedMotion: false,
      })
    ).not.toThrow();
  });
});

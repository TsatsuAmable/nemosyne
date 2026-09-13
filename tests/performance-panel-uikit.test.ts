import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { PerformancePanel } from '../src/vr/ui/PerformancePanel.ts';
import { SpatialPanel } from '../src/vr/ui-system/SpatialPanel.ts';

describe('PerformancePanel UXR1 UIKit migration', () => {
  it('uses SpatialPanel and preserves visibility lifecycle', () => {
    const anchor = new THREE.Group();
    const panel = new PerformancePanel(anchor);
    expect(panel).toBeInstanceOf(SpatialPanel);
    expect(panel.parent).toBe(anchor);
    expect(panel.mesh).toBe(panel);
    panel.hide();
    expect(panel.visible).toBe(false);
    panel.show();
    expect(panel.visible).toBe(true);
  });

  it('polls live budget and telemetry authorities without owning their state', () => {
    const budget = {
      getBudgets: vi.fn(() => ({
        frameMs: 13.9,
        drawCalls: 100,
        triangles: 1000,
        points: 50,
        interactables: 10,
        updatables: 5,
        panels: 3,
      })),
      getViolations: vi.fn(() => []),
    };
    const telemetry = {
      getReport: vi.fn(() => ({
        enabled: true,
        timestamp: 1,
        session: { durationSeconds: 5, datasetName: 'Demo', datasetTopology: 'grid' },
        frames: {
          count: 10,
          dropped: 0,
          lastMs: 14,
          averageMs: 14.5,
          histogram: { under16: 10, under33: 0, under50: 0, under100: 0, over100: 0 },
        },
        operations: {},
        gestures: {},
        errors: { count: 0, warnings: 0, unhandledRejections: 0, last: null },
      })),
    };
    const panel = new PerformancePanel(new THREE.Group(), {
      budget: budget as never,
      telemetry: telemetry as never,
    });
    panel.update();
    expect(budget.getBudgets).toHaveBeenCalled();
    expect(budget.getViolations).toHaveBeenCalled();
    expect(telemetry.getReport).toHaveBeenCalled();
  });

  it('keeps accessibility mutation available on the UIKit path', () => {
    const panel = new PerformancePanel(new THREE.Group());
    expect(() =>
      panel.applyAccessibility({
        textScale: 1.2,
        highContrast: true,
        colorblindMode: 'none',
        reducedMotion: false,
      })
    ).not.toThrow();
  });
});

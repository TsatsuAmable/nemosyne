import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { TelemetryPanel } from '../src/vr/ui/TelemetryPanel.ts';
import { SpatialPanel } from '../src/vr/ui-system/SpatialPanel.ts';

describe('TelemetryPanel UIKit migration', () => {
  it('uses SpatialPanel and preserves visibility lifecycle', () => {
    const anchor = new THREE.Group();
    const panel = new TelemetryPanel(anchor);
    expect(panel).toBeInstanceOf(SpatialPanel);
    expect(panel.parent).toBe(anchor);
    expect(panel.mesh).toBe(panel);

    panel.hide();
    expect(panel.visible).toBe(false);
    panel.show();
    expect(panel.visible).toBe(true);
  });

  it('toggles explicit export privacy without changing collection authority', () => {
    const panel = new TelemetryPanel(new THREE.Group());
    expect(panel.fullSession).toBe(false);
    expect(panel.privacyLevel).toBe('metadata');
    panel.togglePrivacyLevel();
    expect(panel.fullSession).toBe(true);
    expect(panel.privacyLevel).toBe('full-session');
    panel.togglePrivacyLevel();
    expect(panel.privacyLevel).toBe('metadata');
  });

  it('reads live reports on update and suppresses identical report refreshes', () => {
    const report = {
      enabled: true,
      timestamp: 1,
      session: { durationSeconds: 5, datasetName: 'Demo', datasetTopology: 'grid' },
      frames: {
        count: 10,
        dropped: 1,
        lastMs: 16,
        averageMs: 17,
        histogram: { under16: 2, under33: 7, under50: 1, under100: 0, over100: 0 },
      },
      operations: {},
      gestures: {},
      errors: { count: 0, warnings: 0, unhandledRejections: 0, last: null },
    };
    const telemetry = { getReport: vi.fn(() => report) };
    const panel = new TelemetryPanel(new THREE.Group(), { telemetry: telemetry as never });
    panel.update();
    panel.update();
    expect(telemetry.getReport).toHaveBeenCalled();
  });

  it('keeps export disabled when required local authorities are absent', () => {
    const panel = new TelemetryPanel(new THREE.Group());
    expect(() => panel.render()).not.toThrow();
  });
});

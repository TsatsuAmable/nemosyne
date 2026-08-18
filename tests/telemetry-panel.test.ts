// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { TelemetryPanel } from '../src/vr/ui/TelemetryPanel.ts';
import { downloadText } from '../src/utils/Download.ts';

vi.mock('../src/utils/Download.ts', () => ({
  downloadText: vi.fn(() => Promise.resolve()),
}));

describe('TelemetryPanel button dispatch', () => {
  let panel: TelemetryPanel;
  const cameraGroup = new THREE.Group();

  beforeEach(() => {
    vi.mocked(downloadText).mockClear();
  });

  /** Hit a canvas-space point (cx, cy) on the panel mesh. */
  function rayAt(panel: TelemetryPanel, cx: number, cy: number): THREE.Raycaster {
    const u = cx / panel.width;
    const v = 1 - cy / panel.height;
    const raycaster = new THREE.Raycaster();
    vi.spyOn(raycaster, 'intersectObject').mockReturnValue([
      { object: panel.mesh, uv: new THREE.Vector2(u, v) } as any,
    ]);
    return raycaster;
  }

  it('toggle label flips privacy level between metadata and full-session', () => {
    panel = new TelemetryPanel(cameraGroup);
    panel.show();
    panel.mesh.updateMatrixWorld();

    // Toggle label occupies cx in [20,160], cy in [height-60, height-20].
    const cy = panel.height - 40;
    expect(panel.fullSession).toBe(false);
    expect(panel.privacyLevel).toBe('metadata');

    expect(panel.handleContentClick(rayAt(panel, 90, cy))).toBe(true);
    expect(panel.fullSession).toBe(true);
    expect(panel.privacyLevel).toBe('full-session');

    // Click again toggles back.
    expect(panel.handleContentClick(rayAt(panel, 90, cy))).toBe(true);
    expect(panel.fullSession).toBe(false);
    expect(panel.privacyLevel).toBe('metadata');
  });

  it('EXPORT button is consumed but no-ops when telemetry/budget are absent', () => {
    panel = new TelemetryPanel(cameraGroup);
    panel.show();
    panel.mesh.updateMatrixWorld();

    // EXPORT button: cx in [width-280, width-20], cy in [height-60, height-20].
    const cx = panel.width - 140;
    const cy = panel.height - 40;
    expect(panel.handleContentClick(rayAt(panel, cx, cy))).toBe(true);
    expect(downloadText).not.toHaveBeenCalled();
  });

  it('EXPORT button downloads a review bundle when telemetry + budget are present', () => {
    const telemetry = { getReport: () => ({ errors: { last: null } }) } as any;
    const budget = { getViolations: () => [] } as any;
    panel = new TelemetryPanel(cameraGroup, { telemetry, budget });
    panel.show();
    panel.mesh.updateMatrixWorld();

    const cx = panel.width - 140;
    const cy = panel.height - 40;
    expect(panel.handleContentClick(rayAt(panel, cx, cy))).toBe(true);
    expect(downloadText).toHaveBeenCalledTimes(1);
    const [, filename, mime] = vi.mocked(downloadText).mock.calls[0];
    expect(filename).toBe('nemosyne-review-bundle.json');
    expect(mime).toBe('application/json');
  });

  it('returns false for a click outside any interactive region', () => {
    panel = new TelemetryPanel(cameraGroup);
    panel.show();
    panel.mesh.updateMatrixWorld();
    // Top-left content area, well clear of the bottom-right buttons.
    expect(panel.handleContentClick(rayAt(panel, 40, 80))).toBe(false);
  });
});
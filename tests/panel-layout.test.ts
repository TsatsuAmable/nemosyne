import { describe, it, expect } from 'vitest';
import {
  PANEL_LAYOUT,
  toAnchorLocal,
  fanSlot,
  ANCHOR_TORSO_WORLD_Y,
} from '../src/vr/ui/panelLayout.ts';

const dist = (p: readonly number[]) => Math.hypot(p[0], p[2]);

describe('panelLayout (C1′ role-aware depth tiers)', () => {
  it('fanSlot places panels on the forward −Z arc', () => {
    const p = fanSlot(30, 1.15, 1.55);
    expect(p[0]).toBeCloseTo(0.575, 2);
    expect(p[1]).toBe(1.55);
    expect(p[2]).toBeCloseTo(-0.996, 3); // forward = −Z
  });

  it('keeps the forward center cone (±12°) clear in the mid tier', () => {
    const midFan = ['vrMenu', 'operationLogPanel', 'recommendationPanel', 'monetaExplainerPanel', 'settingsPanel'] as const;
    for (const key of midFan) {
      const p = PANEL_LAYOUT[key];
      const angle = Math.abs(Math.atan2(p[0], -p[2])) * (180 / Math.PI);
      expect(angle).toBeGreaterThanOrEqual(12);
    }
  });

  it('keeps mid-tier panels inside the 0.9–1.4 m comfort band', () => {
    const mid = ['vrMenu', 'operationLogPanel', 'recommendationPanel', 'monetaExplainerPanel', 'settingsPanel', 'vrConsole', 'narrativeStrip'] as const;
    for (const key of mid) {
      expect(dist(PANEL_LAYOUT[key])).toBeGreaterThanOrEqual(0.9);
      expect(dist(PANEL_LAYOUT[key])).toBeLessThanOrEqual(1.4);
    }
  });

  it('parks diagnostic tooling in the far tier at r ≥ 1.4 m', () => {
    const far = ['loadTestPanel', 'schemaMappingPanel', 'monetaDiagnosticHUD', 'telemetryPanel', 'inputTelemetry', 'networkPanel', 'performancePanel', 'gestureConfidenceHUD'] as const;
    for (const key of far) {
      expect(dist(PANEL_LAYOUT[key])).toBeGreaterThanOrEqual(1.4);
    }
  });

  it('has no two panels sharing an identical default slot', () => {
    const seen = new Map<string, string>();
    for (const [key, p] of Object.entries(PANEL_LAYOUT)) {
      const sig = p.map((v) => v.toFixed(3)).join(',');
      expect(seen.get(sig), `${key} collides with ${seen.get(sig)} at ${sig}`).toBeUndefined();
      seen.set(sig, key);
    }
  });

  it('toAnchorLocal converts world y/z into torso-anchor space', () => {
    const world: [number, number, number] = [0.5, 1.3, -0.6];
    expect(toAnchorLocal(world)).toEqual([0.5, 1.3 - ANCHOR_TORSO_WORLD_Y, -0.6]);
    expect(toAnchorLocal(world, 1.2)).toEqual([0.5, 1.3 - ANCHOR_TORSO_WORLD_Y, 0.6]);
  });

  it('near-tier overlays land at reachable eye-height when anchor-parented (F1)', () => {
    // World height = anchor torso y (1.35 at eye 1.6) + local y.
    for (const key of ['miniOverview', 'peerPresenceHUD'] as const) {
      const local = PANEL_LAYOUT[key];
      const worldY = ANCHOR_TORSO_WORLD_Y + local[1];
      expect(worldY).toBeGreaterThanOrEqual(1.0);
      expect(worldY).toBeLessThanOrEqual(1.7);
      expect(Math.hypot(local[0], local[2])).toBeLessThanOrEqual(0.9);
    }
  });
});

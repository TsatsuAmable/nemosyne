import { describe, it, expect } from 'vitest';
import {
  PANEL_LAYOUT,
  fanSlot,
  ANCHOR_TORSO_WORLD_Y,
} from '../src/vr/ui/panelLayout.ts';

const dist = (p: readonly number[]) => Math.hypot(p[0], p[2]);

describe('panelLayout (C1′ role-aware depth tiers, torso-locked)', () => {
  it('fanSlot places panels on the forward −Z arc', () => {
    const p = fanSlot(30, 1.15, 0.2);
    expect(p[0]).toBeCloseTo(0.575, 2);
    expect(p[1]).toBe(0.2);
    expect(p[2]).toBeCloseTo(-0.996, 3); // forward = −Z
  });

  it('keeps the forward center cone (±12°) clear in the mid tier', () => {
    const midFan = ['legacyMenu', 'operationLogPanel', 'recommendationPanel', 'monetaExplainerPanel', 'settingsPanel'] as const;
    for (const key of midFan) {
      const p = PANEL_LAYOUT[key];
      const angle = Math.abs(Math.atan2(p[0], -p[2])) * (180 / Math.PI);
      expect(angle).toBeGreaterThanOrEqual(12);
    }
  });

  it('keeps mid-tier panels inside the 0.9–1.4 m comfort band', () => {
    const mid = ['legacyMenu', 'operationLogPanel', 'recommendationPanel', 'monetaExplainerPanel', 'settingsPanel', 'vrConsole', 'narrativeStrip'] as const;
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

  it('is expressed uniformly in torso-anchor-local space (single reference frame)', () => {
    // Anchor-local heights must map into a comfortable world band:
    // world y = ANCHOR_TORSO_WORLD_Y (≈1.35) + local y ∈ [0.75, 1.70] m.
    for (const [key, p] of Object.entries(PANEL_LAYOUT)) {
      const worldY = ANCHOR_TORSO_WORLD_Y + p[1];
      expect(worldY, `${key} renders at ${worldY} m`).toBeGreaterThanOrEqual(0.75);
      expect(worldY, `${key} renders at ${worldY} m`).toBeLessThanOrEqual(1.7);
    }
  });

  it('near-tier overlays sit inside per-arm reach (< 0.9 m) at chest-to-eye height (F1)', () => {
    for (const key of ['miniOverview', 'peerPresenceHUD'] as const) {
      const local = PANEL_LAYOUT[key];
      const worldY = ANCHOR_TORSO_WORLD_Y + local[1];
      expect(worldY).toBeGreaterThanOrEqual(1.0);
      expect(worldY).toBeLessThanOrEqual(1.7);
      expect(dist(local)).toBeLessThanOrEqual(0.9);
    }
  });
});

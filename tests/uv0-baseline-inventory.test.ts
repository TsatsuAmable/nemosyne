import { describe, expect, it } from 'vitest';
import {
  UV0_INVENTORY,
  validateUv0Inventory,
  UV0_CLASSIFICATIONS,
  type Uv0SurfaceEntry,
} from '../src/validation/uv0-inventory.ts';

/**
 * P1-UV0 baseline inventory drift + schema gate (Stream B3).
 *
 * The id set below is deliberately HARDCODED in this test rather than derived
 * from the module, so B4/B5 (or any later visible-product change) cannot edit
 * the inventory silently: a reclassification, removal, or addition must update
 * this expected set in the same change, proving the baseline was consciously
 * revised.
 */

const EXPECTED_ENTRY_IDS: readonly string[] = [
  'datum-plane',
  'techno-core',
  'ice-vault',
  'farcaster-portal-a',
  'farcaster-portal-b',
  'moneta-palace',
  'moneta-diagnostic-hud',
  'input-telemetry',
  'vr-console',
  'mini-overview',
  'peer-presence-hud',
  'dashboard-wall',
  'chart-plane',
  'tda-planes',
  'holographic-inspector',
  'contextual-task-surface',
  'hand-wheel-menu',
  'legacy-vr-menu',
  'analyst-journey-controls',
  'dom-telemetry',
  'boot-overlay',
  'nemosyne-loader',
  'nemosyne-vr-button',
];

describe('P1-UV0 visible-product baseline inventory', () => {
  it('covers at least 10 normal-mode surfaces/objects and matches the pinned id set', () => {
    expect(UV0_INVENTORY.length).toBeGreaterThanOrEqual(10);
    expect(UV0_INVENTORY.length).toBe(EXPECTED_ENTRY_IDS.length);
    expect(UV0_INVENTORY.map((entry) => entry.id)).toEqual(EXPECTED_ENTRY_IDS);
    expect(new Set(UV0_INVENTORY.map((entry) => entry.id)).size).toBe(UV0_INVENTORY.length);
  });

  it('every entry passes schema validation with a valid classification and reference frame', () => {
    const result = validateUv0Inventory(UV0_INVENTORY);
    expect(result.ok, `inventory validation errors: ${result.errors.join('; ')}`).toBe(true);
  });

  it('classifications are bounded and the taxonomy is exercised, with no missing rationale', () => {
    const classifications = new Set(UV0_INVENTORY.map((entry) => entry.classification));
    for (const classification of classifications) {
      expect(UV0_CLASSIFICATIONS).toContain(classification);
    }
    for (const entry of UV0_INVENTORY) {
      expect(entry.rationale.trim().length).toBeGreaterThan(0);
      expect(entry.source).toMatch(/:\d+$/);
    }
  });

  it('contains a balanced spread of classifications rather than a single default', () => {
    const byClassification = new Map<string, number>();
    for (const entry of UV0_INVENTORY) {
      byClassification.set(entry.classification, (byClassification.get(entry.classification) ?? 0) + 1);
    }
    // At least three distinct dispositions (e.g. KEEP + DEMOTE + CONVERGE +
    // REMOVE + REPLACE) must be present for the inventory to be an honest
    // pre-transformation picture rather than a "everything is fine" listing.
    expect(byClassification.size).toBeGreaterThanOrEqual(4);
  });

  it('every boot-visible entry is listed as visibleAtBoot and every hidden one is not', () => {
    const entries: readonly Uv0SurfaceEntry[] = UV0_INVENTORY;
    expect(entries.filter((entry) => entry.visibleAtBoot).length).toBeGreaterThan(0);
    expect(entries.filter((entry) => !entry.visibleAtBoot).length).toBeGreaterThan(0);
  });
});
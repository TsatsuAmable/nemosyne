import { readFileSync } from 'node:fs';
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
 * The id set is deliberately hardcoded rather than derived from the module.
 * The separate WorldUIManager source audit below prevents the inventory and its
 * expected-id list from merely agreeing with each other while missing an eager
 * runtime surface.
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
  'settings-panel',
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

const EAGER_WORLD_UI_DISPOSITIONS: Readonly<Record<string, string>> = {
  statusStrip: 'excluded: controller, not an independently visible surface',
  panelRolesManager: 'excluded: UI policy manager, not a visible surface',
  contextualTaskSurface: 'contextual-task-surface',
  panelBudgetController: 'excluded: workspace budget controller, not a visible surface',
  telemetryPanel: 'input-telemetry',
  vrConsole: 'vr-console',
  vrMenu: 'legacy-vr-menu',
  panelManager: 'excluded: panel lifecycle manager, not a visible surface',
  miniOverview: 'mini-overview',
  peerPresenceHUD: 'peer-presence-hud',
  dashboard: 'dashboard-wall',
  handWheelMenu: 'hand-wheel-menu',
  settingsPanel: 'settings-panel',
  metricsPanel: 'excluded: diagnostic role, hidden in ANALYST mode',
  performancePanel: 'excluded: diagnostic role, hidden in ANALYST mode',
  networkPanel: 'excluded: diagnostic role, hidden in ANALYST mode',
  recommendationPanel: 'excluded: hidden task panel outside the canonical B3 journey',
  dracoExplainerPanel: 'excluded: hidden task panel outside the canonical B3 journey',
  vaultPanel: 'excluded: hidden task panel outside the canonical B3 journey',
};

describe('P1-UV0 visible-product baseline inventory', () => {
  it('matches the consciously pinned canonical entry set', () => {
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
    expect(byClassification.size).toBeGreaterThanOrEqual(4);
  });

  it('contains both boot-visible and state-summoned surfaces', () => {
    const entries: readonly Uv0SurfaceEntry[] = UV0_INVENTORY;
    expect(entries.filter((entry) => entry.visibleAtBoot).length).toBeGreaterThan(0);
    expect(entries.filter((entry) => !entry.visibleAtBoot).length).toBeGreaterThan(0);
  });

  it('source-audits every eagerly constructed WorldUIManager surface or controller', () => {
    const source = readFileSync('src/vr/coordinators/WorldUIManager.ts', 'utf8');
    const constructorStart = source.indexOf('  constructor(');
    const constructorEnd = source.indexOf('  getOrCreateOperationLogPanel()');
    expect(constructorStart).toBeGreaterThanOrEqual(0);
    expect(constructorEnd).toBeGreaterThan(constructorStart);

    const constructorSource = source.slice(constructorStart, constructorEnd);
    const eagerProperties = Array.from(
      constructorSource.matchAll(/this\.([A-Za-z0-9_]+)\s*=\s*new\s+[A-Za-z0-9_]+/g),
      (match) => match[1],
    );

    expect(eagerProperties).toEqual(Object.keys(EAGER_WORLD_UI_DISPOSITIONS));

    const inventoryIds = new Set(UV0_INVENTORY.map((entry) => entry.id));
    for (const property of eagerProperties) {
      const disposition = EAGER_WORLD_UI_DISPOSITIONS[property];
      expect(disposition, `${property} must have an explicit UV0 disposition`).toBeTruthy();
      if (!disposition.startsWith('excluded:')) {
        expect(inventoryIds.has(disposition), `${property} -> ${disposition} missing from UV0 inventory`).toBe(true);
      }
    }

    // Independent-review regression: SettingsPanel is attached eagerly and no
    // constructor-time hide call exists. It must remain a boot-visible baseline
    // entry until product treatment deliberately changes in B4/B5.
    expect(constructorSource).toContain('this.settingsPanel = new SettingsPanel');
    expect(constructorSource).not.toContain('hidePanel(this.settingsPanel)');
    expect(UV0_INVENTORY.find((entry) => entry.id === 'settings-panel')?.visibleAtBoot).toBe(true);
  });
});

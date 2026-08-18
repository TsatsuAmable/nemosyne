// @ts-nocheck
/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ANALYSIS_TEMPLATES, resolveTemplate } from '../src/data/AnalysisTemplates.ts';
import { allSampleDatasets } from '../src/data/SampleDatasets.ts';

describe('AnalysisTemplates', () => {
  it('contains well-defined story templates', () => {
    expect(ANALYSIS_TEMPLATES.length).toBeGreaterThan(0);
    for (const t of ANALYSIS_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.label).toBeTruthy();
      expect(t.datasetKey).toBeTruthy();
      expect(t.theme).toBeTruthy();
      expect(t.tourId).toBeTruthy();
    }
  });

  it('resolves each template against the sample dataset registry', () => {
    for (const t of ANALYSIS_TEMPLATES) {
      const resolved = resolveTemplate(t.id, allSampleDatasets);
      expect(resolved, `template ${t.id} should resolve`).not.toBeNull();
      expect(resolved.entry).toBeDefined();
      expect(resolved.entry.key).toBe(t.datasetKey);
      expect(resolved.theme).toBe(t.theme);
      expect(resolved.tourId).toBe(t.tourId);
    }
  });

  it('returns null for unknown template ids', () => {
    expect(resolveTemplate('does-not-exist', allSampleDatasets)).toBeNull();
  });
});

describe('World.loadTemplate integration', () => {
  let world;

  beforeEach(async () => {
    vi.resetModules();
    const { World } = await import('../src/vr/World.ts');
    world = new World();
    // Wait for async autosave restore to settle.
    await new Promise((r) => setTimeout(r, 50));
  });

  it('loads a valid template and changes dataset/theme', () => {
    const template = ANALYSIS_TEMPLATES[0];
    const beforeName = world.currentEntry?.name;
    const result = world.loadTemplate(template.id);

    expect(result).toBe(true);
    expect(world.currentEntry?.name).not.toBe(beforeName);
    expect(world.currentEntry?.topology).toBeDefined();
    expect(world.engine.theme.currentPreset).toBe(template.theme);
  });

  it('returns false and logs for unknown template ids', () => {
    const logSpy = vi.spyOn(world.vrConsole, 'log').mockImplementation(() => {});
    const result = world.loadTemplate('unknown-template');
    expect(result).toBe(false);
    expect(logSpy).toHaveBeenCalled();
  });
});

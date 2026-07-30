import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { WorldTheme } from '../src/vr/WorldTheme.js';

describe('WorldTheme', () => {
  let scene;
  let theme;

  beforeEach(() => {
    scene = new THREE.Scene();
    theme = new WorldTheme(scene);
  });

  afterEach(() => {
    theme.dispose();
  });

  it('exports a set of named presets', () => {
    expect(Object.keys(WorldTheme.PRESETS)).toEqual(
      expect.arrayContaining(['neonMidnight', 'daylightGlobe', 'coolDepth', 'warmAnomaly', 'deepNet'])
    );
  });

  it('applies a preset and updates the scene fog and lights', () => {
    theme.applyPreset('daylightGlobe');

    expect(theme.currentPreset).toBe('daylightGlobe');
    expect(scene.fog.color.getHex()).toBe(WorldTheme.PRESETS.daylightGlobe.fogColor);
    expect(theme.ambient.color.getHex()).toBe(WorldTheme.PRESETS.daylightGlobe.ambientColor);
  });

  it('cycles to the next preset in order', () => {
    const first = theme.currentPreset;
    const second = theme.cyclePreset();

    expect(second).not.toBe(first);
    expect(Object.keys(WorldTheme.PRESETS)).toContain(second);

    const third = theme.cyclePreset();
    expect(third).not.toBe(second);
  });

  it('warns when applying an unknown preset and keeps the current one', () => {
    const before = theme.currentPreset;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    theme.applyPreset('nonexistent');

    expect(theme.currentPreset).toBe(before);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('updates ambient particle positions over time', () => {
    theme.update(0.016, 1, 0.5);

    expect(theme.particles).toBeTruthy();
    const positions = theme.particles.geometry.attributes.position.array;
    expect(positions.length).toBeGreaterThan(0);
  });
});

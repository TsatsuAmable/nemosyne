// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  remapColor,
  normalizeHex,
  colorFamily,
  scaleFont,
  DwellTimer,
} from '../src/utils/Accessibility.ts';
import { World } from '../src/vr/World.ts';
import { WorldTheme } from '../src/vr/WorldTheme.ts';

describe('Accessibility utilities', () => {
  it('normalizes hex strings and numbers', () => {
    expect(normalizeHex(0x00ffcc)).toBe(0x00ffcc);
    expect(normalizeHex('#00ffcc')).toBe(0x00ffcc);
    expect(normalizeHex('00ffcc')).toBe(0x00ffcc);
  });

  it('classifies color families', () => {
    expect(colorFamily(0x00ff00)).toBe('green');
    expect(colorFamily(0xff0000)).toBe('red');
    expect(colorFamily(0x00ffff)).toBe('cyan');
    expect(colorFamily(0xff00ff)).toBe('magenta');
    expect(colorFamily(0x808080)).toBe('neutral');
  });

  it('remaps colors for colorblind modes', () => {
    const green = remapColor(0x00ff00, 'deuteranopia');
    expect(green).not.toBe(0x00ff00);
    const red = remapColor(0xff0000, 'deuteranopia');
    expect(red).not.toBe(0xff0000);
    expect(remapColor(0x00ff00, 'none')).toBe(0x00ff00);
  });

  it('scales font strings', () => {
    expect(scaleFont('18px', 1.5)).toBe('27.0px');
    expect(scaleFont('bold 20px monospace', 1.25)).toBe('bold 25.0px monospace');
    expect(scaleFont(16, 2)).toBe('32px');
  });

  it('dwell timer confirms after threshold', () => {
    vi.useFakeTimers();
    const dwell = new DwellTimer(500);
    expect(dwell.hover('A')).toBe(false);
    vi.advanceTimersByTime(400);
    expect(dwell.hover('A')).toBe(false);
    vi.advanceTimersByTime(150);
    expect(dwell.hover('A')).toBe(true);
    expect(dwell.hover('A')).toBe(false); // already confirmed
    vi.useRealTimers();
  });

  it('dwell timer resets on new target', () => {
    vi.useFakeTimers();
    const dwell = new DwellTimer(500);
    dwell.hover('A');
    vi.advanceTimersByTime(300);
    dwell.hover('B');
    vi.advanceTimersByTime(300);
    expect(dwell.hover('B')).toBe(false);
    vi.advanceTimersByTime(250);
    expect(dwell.hover('B')).toBe(true);
    vi.useRealTimers();
  });
});

describe('World accessibility integration', () => {
  let world: World | null = null;

  beforeEach(() => {
    (globalThis.navigator as unknown as Record<string, unknown>).xr = {
      isSessionSupported: vi.fn().mockResolvedValue(true),
      requestSession: vi.fn().mockResolvedValue({
        addEventListener: vi.fn(),
        updateRenderState: vi.fn().mockResolvedValue(undefined),
        renderState: {},
        inputSources: [],
      }),
    };
    world = new World();
  });

  afterEach(() => {
    world?.engine?.dispose?.();
    world = null;
    vi.restoreAllMocks();
    const button = document.getElementById('nemosyne-vr-button');
    if (button?.parentNode) button.parentNode.removeChild(button);
    for (const canvas of Array.from(document.querySelectorAll('canvas'))) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  });

  it('applies text scale to panels when settings change', () => {
    const panel = world!.panelManager.panels[0] as any;
    const spy = vi.spyOn(panel, 'applyAccessibility');
    world!.settingsPanel.setSetting('textScale', 1.5);
    expect(spy).toHaveBeenCalled();
    expect(panel.textScale).toBe(1.5);
  });

  it('applies high contrast to panels when settings change', () => {
    const panel = world!.panelManager.panels[0] as any;
    world!.settingsPanel.setSetting('highContrast', true);
    expect(panel.highContrast).toBe(true);
  });

  it('sets colorblind mode on panels and theme', () => {
    const panel = world!.panelManager.panels[0] as any;
    world!.settingsPanel.setSetting('colorblindMode', 'deuteranopia');
    expect(panel.colorblindMode).toBe('deuteranopia');
    expect(world!.engine.theme.pointLight.color.getHex()).not.toBe(
      WorldTheme.PRESETS.neonMidnight.pointColor
    );
  });

  it('toggles dwell selection on the input router', () => {
    const spy = vi.spyOn(world!.engine.input, 'setDwellSelection');
    world!.settingsPanel.setSetting('dwellSelection', true);
    expect(spy).toHaveBeenCalledWith(true, 1200);
  });
});

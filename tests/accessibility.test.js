import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TelemetryCollector } from '../src/utils/Telemetry.js';
import {
  remapColor,
  normalizeHex,
  colorFamily,
  scaleFont,
  DwellTimer,
  COLORBLIND_PALETTE,
} from '../src/utils/Accessibility.js';
import { World } from '../src/vr/World.js';
import { WorldTheme } from '../src/vr/WorldTheme.js';

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
  let world;

  beforeEach(() => {
    globalThis.navigator.xr = {
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
    const spy = vi.spyOn(world.panelManager.panels[0], 'applyAccessibility');
    world.settingsPanel.setSetting('textScale', 1.5);
    expect(spy).toHaveBeenCalled();
    expect(world.panelManager.panels[0].textScale).toBe(1.5);
  });

  it('applies high contrast to panels when settings change', () => {
    world.settingsPanel.setSetting('highContrast', true);
    expect(world.panelManager.panels[0].highContrast).toBe(true);
  });

  it('sets colorblind mode on panels and theme', () => {
    world.settingsPanel.setSetting('colorblindMode', 'deuteranopia');
    expect(world.panelManager.panels[0].colorblindMode).toBe('deuteranopia');
    expect(world.engine.theme.pointLight.color.getHex()).not.toBe(
      WorldTheme.PRESETS.neonMidnight.pointColor
    );
  });

  it('toggles dwell selection on the input router', () => {
    const spy = vi.spyOn(world.engine.input, 'setDwellSelection');
    world.settingsPanel.setSetting('dwellSelection', true);
    expect(spy).toHaveBeenCalledWith(true);
  });
});

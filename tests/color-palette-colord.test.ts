import { describe, it, expect } from 'vitest';
import { ColorPaletteEngine } from '../src/data/ColorPaletteEngine.ts';

describe('Color Palette & CVD Accessibility Engine (colord)', () => {
  it('generates N distinct categorical colors with valid hex and 24-bit integers', () => {
    const palette = ColorPaletteEngine.generateCategoricalPalette(5);
    expect(palette).toHaveLength(5);

    for (const color of palette) {
      expect(color.hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(color.threeInt).toBeGreaterThan(0);
      expect(typeof color.isDark).toBe('boolean');
      expect(color.contrastOnWhite).toBeGreaterThan(1);
    }
  });

  it('generates smooth sequential color ramps', () => {
    const ramp = ColorPaletteEngine.generateSequentialRamp('#1e293b', '#38bdf8', 10);
    expect(ramp).toHaveLength(10);
    expect(ramp[0].hex.toLowerCase()).toBe('#1e293b');
    expect(ramp[9].hex.toLowerCase()).toBe('#38bdf8');
  });

  it('evaluates WCAG AA readability contrast ratios accurately', () => {
    expect(ColorPaletteEngine.isReadable('#000000', '#ffffff')).toBe(true);
    expect(ColorPaletteEngine.isReadable('#ffffff', '#ffffff')).toBe(false);
    expect(ColorPaletteEngine.isReadable('#38bdf8', '#0f172a')).toBe(true);
  });

  it('simulates Color Vision Deficiencies (CVD)', () => {
    const red = '#ff0000';
    const protanopiaRed = ColorPaletteEngine.simulateCVD(red, 'protanopia');
    const deuteranopiaRed = ColorPaletteEngine.simulateCVD(red, 'deuteranopia');
    const tritanopiaRed = ColorPaletteEngine.simulateCVD(red, 'tritanopia');
    const achromatopsiaRed = ColorPaletteEngine.simulateCVD(red, 'achromatopsia');

    expect(protanopiaRed).not.toBe(red);
    expect(deuteranopiaRed).not.toBe(red);
    expect(tritanopiaRed).not.toBe(red);
    expect(achromatopsiaRed).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

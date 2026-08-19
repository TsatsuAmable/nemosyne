/**
 * Color Palette & CVD Accessibility Engine.
 *
 * Implements:
 * - Perceptually distinct color palettes using `colord`.
 * - Contrast ratio calculations compliant with WCAG 2.1 AA/AAA standards.
 * - Color Vision Deficiency (CVD) simulation for protanopia, deuteranopia, and tritanopia.
 */

import { colord, extend } from 'colord';
import a11yPlugin from 'colord/plugins/a11y';
import harmoniesPlugin from 'colord/plugins/harmonies';

extend([a11yPlugin, harmoniesPlugin]);

export type CVDMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';

export interface PaletteColor {
  hex: string;
  threeInt: number;
  isDark: boolean;
  contrastOnWhite: number;
  contrastOnDark: number;
}

export class ColorPaletteEngine {
  /**
   * Generates N harmonious, distinct categorical colors distributed evenly around the color wheel.
   */
  static generateCategoricalPalette(count: number, baseHue = 210, saturation = 75, lightness = 60): PaletteColor[] {
    const palette: PaletteColor[] = [];
    const step = 360 / Math.max(1, count);

    for (let i = 0; i < count; i++) {
      const hue = (baseHue + i * step) % 360;
      const color = colord({ h: hue, s: saturation, l: lightness });
      const hex = color.toHex();
      const threeInt = parseInt(hex.replace('#', ''), 16);

      palette.push({
        hex,
        threeInt,
        isDark: color.isDark(),
        contrastOnWhite: color.contrast('#ffffff'),
        contrastOnDark: color.contrast('#0f172a'),
      });
    }

    return palette;
  }

  /**
   * Interpolates a sequential gradient between two colors.
   */
  static generateSequentialRamp(startHex: string, endHex: string, steps: number): PaletteColor[] {
    const palette: PaletteColor[] = [];
    const start = colord(startHex);
    const end = colord(endHex);

    for (let i = 0; i < steps; i++) {
      const t = steps === 1 ? 0 : i / (steps - 1);
      const r = Math.round(start.toRgb().r + (end.toRgb().r - start.toRgb().r) * t);
      const g = Math.round(start.toRgb().g + (end.toRgb().g - start.toRgb().g) * t);
      const b = Math.round(start.toRgb().b + (end.toRgb().b - start.toRgb().b) * t);

      const color = colord({ r, g, b });
      const hex = color.toHex();
      const threeInt = parseInt(hex.replace('#', ''), 16);

      palette.push({
        hex,
        threeInt,
        isDark: color.isDark(),
        contrastOnWhite: color.contrast('#ffffff'),
        contrastOnDark: color.contrast('#0f172a'),
      });
    }

    return palette;
  }

  /**
   * Checks if two colors meet the WCAG AA minimum contrast ratio (4.5:1 for normal text, 3:1 for large UI).
   */
  static isReadable(foregroundHex: string, backgroundHex: string, largeText = false): boolean {
    const minRatio = largeText ? 3.0 : 4.5;
    return colord(foregroundHex).contrast(backgroundHex) >= minRatio;
  }

  /**
   * Simulates Color Vision Deficiency (CVD) on a hex color.
   */
  static simulateCVD(hex: string, mode: CVDMode): string {
    if (mode === 'none') return hex;

    const rgb = colord(hex).toRgb();

    if (mode === 'achromatopsia') {
      const gray = Math.round(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);
      return colord({ r: gray, g: gray, b: gray }).toHex();
    }

    // Simplified Brettel-Vienot-Mollon CVD projection matrices
    let r = rgb.r / 255;
    let g = rgb.g / 255;
    let b = rgb.b / 255;

    if (mode === 'protanopia') {
      const nr = 0.56667 * r + 0.43333 * g;
      const ng = 0.55833 * r + 0.44167 * g;
      const nb = 0.24167 * g + 0.75833 * b;
      r = nr;
      g = ng;
      b = nb;
    } else if (mode === 'deuteranopia') {
      const nr = 0.625 * r + 0.375 * g;
      const ng = 0.70 * r + 0.30 * g;
      const nb = 0.30 * g + 0.70 * b;
      r = nr;
      g = ng;
      b = nb;
    } else if (mode === 'tritanopia') {
      const nr = 0.95 * r + 0.05 * g;
      const ng = 0.43333 * g + 0.56667 * b;
      const nb = 0.475 * g + 0.525 * b;
      r = nr;
      g = ng;
      b = nb;
    }

    return colord({
      r: Math.round(Math.min(1, Math.max(0, r)) * 255),
      g: Math.round(Math.min(1, Math.max(0, g)) * 255),
      b: Math.round(Math.min(1, Math.max(0, b)) * 255),
    }).toHex();
  }
}

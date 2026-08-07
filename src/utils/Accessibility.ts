/**
 * Accessibility helpers for Nemosyne.
 *
 * - Colorblind-safe palette translations (deuteranopia, protanopia, tritanopia)
 * - High-contrast overrides for UI chrome
 * - Text scale factors applied to canvas-based VR panels
 * - Dwell/pinch-hold selection timing for motor accessibility
 */

import type { AccessibilityOptions } from '../vr/coordinators/types.ts';

/** Colorblind-safe palette keyed by mode. */
export interface ColorblindPalette {
  primary: number;
  secondary: number;
  alert: number;
  ok: number;
  text: number;
  bg: number;
}

/** Deuteranopia-safe accent colors: blue/yellow/purple tones avoid red/green confusion. */
export const COLORBLIND_PALETTE: Record<string, ColorblindPalette> = {
  deuteranopia: {
    primary: 0x0077ff,
    secondary: 0xffdd00,
    alert: 0xaa00ff,
    ok: 0x00aaff,
    text: 0xffffff,
    bg: 0x050510,
  },
  protanopia: {
    primary: 0x00aaff,
    secondary: 0xffee33,
    alert: 0x8800cc,
    ok: 0x0088cc,
    text: 0xffffff,
    bg: 0x050510,
  },
  tritanopia: {
    primary: 0x00ffcc,
    secondary: 0xff0055,
    alert: 0xff6600,
    ok: 0x00ccff,
    text: 0xffffff,
    bg: 0x050510,
  },
};

/** High-contrast preset: white on near-black with bright primaries. */
export const HIGH_CONTRAST: ColorblindPalette = {
  primary: 0xffffff,
  secondary: 0x00ffff,
  alert: 0xff0055,
  ok: 0x00ff66,
  text: 0xffffff,
  bg: 0x000000,
};

/** Valid color family names used by {@link colorFamily}. */
export type ColorFamily = 'green' | 'red' | 'cyan' | 'magenta' | 'neutral' | 'other';

/**
 * Remap a hex color through an accessibility palette.
 * If no palette mapping exists, returns the original color.
 */
export function remapColor(hex: number | string, mode: string | boolean): number | string {
  if (!mode || mode === 'none') return hex;
  const palette = COLORBLIND_PALETTE[typeof mode === 'string' ? mode : 'none'] ?? null;
  if (!palette) return hex;

  // Map known theme accent families to palette roles.
  const normalized = normalizeHex(hex);
  const family = colorFamily(normalized);
  if (family === 'green') return palette.ok;
  if (family === 'red') return palette.alert;
  if (family === 'cyan') return palette.primary;
  if (family === 'magenta') return palette.secondary;
  return hex;
}

export function normalizeHex(hex: number | string): number {
  const h =
    typeof hex === 'number' ? hex.toString(16).padStart(6, '0') : String(hex).replace('#', '');
  return parseInt(h.slice(0, 6), 16);
}

export function colorFamily(hex: number): ColorFamily {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 'neutral';

  // Hue in degrees.
  let hue = 0;
  if (max === min) return 'neutral';
  const delta = max - min;
  if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
  else if (max === g) hue = ((b - r) / delta + 2) * 60;
  else hue = ((r - g) / delta + 4) * 60;

  if (hue >= 90 && hue < 150) return 'green';
  if (hue >= 330 || hue < 20) return 'red';
  if (hue >= 160 && hue < 200) return 'cyan';
  if (hue >= 260 && hue < 320) return 'magenta';
  return 'other';
}

/**
 * Scale a CSS pixel font size by a factor. Supports sizes in the form
 * "18px", "bold 20px monospace", or plain numbers.
 */
export function scaleFont(font: number | string | null | undefined, scale: number): string | null | undefined {
  const regex = /(\d+(?:\.\d+)?)\s*px/;
  if (typeof font === 'number') return `${font * scale}px`;
  if (!font || typeof font !== 'string') return font;
  return font.replace(regex, (match, size) => `${(parseFloat(size) * scale).toFixed(1)}px`);
}

/**
 * Dwell selection timer. Call `hover(id)` while the pointer is over a target
 * and `clear()` when it leaves. Returns true for the duration threshold once.
 */
export class DwellTimer {
  threshold: number;
  private _activeId: string | null;
  private _startTime: number;
  private _confirmed: Set<string>;

  constructor(thresholdMs = 1200) {
    this.threshold = thresholdMs;
    this._activeId = null;
    this._startTime = 0;
    this._confirmed = new Set();
  }

  hover(id: string): boolean {
    const now = performance.now();
    if (this._activeId !== id) {
      this._activeId = id;
      this._startTime = now;
      this._confirmed.delete(id);
      return false;
    }
    if (this._confirmed.has(id)) return false;
    if (now - this._startTime >= this.threshold) {
      this._confirmed.add(id);
      return true;
    }
    return false;
  }

  clear(): void {
    this._activeId = null;
    this._startTime = 0;
  }

  reset(id: string): void {
    this._confirmed.delete(id);
  }
}

// Re-export the default accessibility preset so panels can use it.
export { DEFAULT_ACCESSIBILITY } from '../vr/coordinators/types.ts';

export type { AccessibilityOptions };

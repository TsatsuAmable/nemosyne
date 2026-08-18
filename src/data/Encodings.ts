/**
 * Utilities to map data values to visual channels:
 * color (categorical hue / numeric sequential), size, pulse, rotation.
 *
 * Zero Three.js/DOM dependencies (Strict Dependency Direction).
 */

const PALETTE = [0x00ffcc, 0xff0055, 0xffaa00, 0x00aaff, 0xff00ff, 0x88ff00] as const;
const COLORBLIND_PALETTE = [0x0072b2, 0xe69f00, 0x009e73, 0xf0e442, 0x56b4e9, 0xd55e00, 0xcc79a7, 0x000000] as const;

export function categoricalColor(_value: unknown, index: number, colorblindMode: string | boolean = 'none'): number {
  const safe = colorblindMode !== 'none' && colorblindMode !== false;
  const palette = safe ? COLORBLIND_PALETTE : PALETTE;
  return palette[index % palette.length];
}

export function numericColor(
  value: number,
  min: number,
  max: number,
  low: number = 0x00ffcc,
  high: number = 0xff0055
): number {
  if (max === min) return low;
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const r1 = (low >> 16) & 0xff;
  const g1 = (low >> 8) & 0xff;
  const b1 = low & 0xff;
  const r2 = (high >> 16) & 0xff;
  const g2 = (high >> 8) & 0xff;
  const b2 = high & 0xff;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}

export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

import * as THREE from 'three';
import type { Color } from 'three';

/**
 * Utilities to map data values to visual channels:
 * color (categorical hue / numeric sequential), size, pulse, rotation.
 *
 * NOTE: `inferEncodings` (analytical default-encoding selection) has moved to
 * the Rust kernel (`wasm/src/data/encodings.rs`). This module keeps only the
 * visual mapping helpers used by `VRTopologyTranslator`, `ChartPlane`, and the
 * layout generators.
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
  const c1: Color = new THREE.Color(low);
  const c2: Color = new THREE.Color(high);
  return c1.lerp(c2, t).getHex();
}

export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

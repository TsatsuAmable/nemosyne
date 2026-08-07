import * as THREE from 'three';
import type { Color } from 'three';
import type { Dataset } from './Dataset.ts';
import type { EncodingMapping } from './types.ts';

/**
 * Utilities to map data values to visual channels:
 * color (categorical hue / numeric sequential), size, pulse, rotation.
 */

const PALETTE = [0x00ffcc, 0xff0055, 0xffaa00, 0x00aaff, 0xff00ff, 0x88ff00] as const;

export function categoricalColor(_value: unknown, index: number): number {
  return PALETTE[index % PALETTE.length];
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

/**
 * Given a dataset, choose default encodings for common visual channels.
 */
export function inferEncodings(dataset: Dataset): EncodingMapping {
  const enc: EncodingMapping = {};
  if (dataset.categoricalColumns.length > 0) {
    enc.color = dataset.categoricalColumns[0].name;
  }
  if (dataset.numericColumns.length > 0) {
    enc.size = dataset.numericColumns[0].name;
    if (!enc.color) enc.color = dataset.numericColumns[0].name;
  }
  if (dataset.temporalColumns.length > 0) {
    enc.pulse = dataset.temporalColumns[0].name;
    enc.time = dataset.temporalColumns[0].name;
  }
  return enc;
}

// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { categoricalColor } from '../src/data/Encodings.ts';

describe('categoricalColor', () => {
  it('keeps the legacy palette when colorblind mode is disabled', () => {
    expect(categoricalColor('A', 0, 'none')).toBe(0x00ffcc);
  });

  it('uses a colorblind-safe categorical palette when a mode is active', () => {
    expect(categoricalColor('A', 0, 'deuteranopia')).toBe(0x0072b2);
    expect(categoricalColor('B', 1, 'protanopia')).toBe(0xe69f00);
    expect(categoricalColor('C', 2, 'tritanopia')).toBe(0x009e73);
  });
});

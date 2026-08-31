import { describe, expect, it } from 'vitest';
import {
  ALL_REPRESENTATION_FAMILIES,
  FAMILY_TO_COMPATIBLE_LAYOUTS,
  FAMILY_TO_LAYOUTS,
  LAYOUT_PRIMARY_REASONING_FAMILY,
  LAYOUT_TO_COMPATIBLE_FAMILIES,
  LAYOUT_TO_FAMILY,
  isLayoutCompatibleWithFamily,
} from '../src/moneta/index.ts';

describe('R6 representation family/layout compatibility', () => {
  it('treats family-to-layout mapping as compatibility rather than bespoke representation geometry', () => {
    expect(ALL_REPRESENTATION_FAMILIES).toHaveLength(10);
    expect(Object.keys(LAYOUT_TO_COMPATIBLE_FAMILIES)).toHaveLength(7);

    expect(FAMILY_TO_COMPATIBLE_LAYOUTS.DISTRIBUTION).toEqual(['GRID_3D']);
    expect(FAMILY_TO_COMPATIBLE_LAYOUTS.AGGREGATE).toEqual(['GRID_3D']);
    expect(LAYOUT_TO_COMPATIBLE_FAMILIES.GRID_3D).toEqual(
      expect.arrayContaining(['POINT', 'DISTRIBUTION', 'CLUSTER', 'AGGREGATE', 'TOPOLOGY'])
    );

    // Sharing GRID_3D cannot be interpreted as all five families being point
    // representations. Analytical/payload semantics live outside this mapping.
    expect(LAYOUT_TO_COMPATIBLE_FAMILIES.GRID_3D).toHaveLength(5);
  });

  it('keeps the compatibility relation mechanically reversible', () => {
    for (const family of ALL_REPRESENTATION_FAMILIES) {
      for (const layout of FAMILY_TO_COMPATIBLE_LAYOUTS[family]) {
        expect(LAYOUT_TO_COMPATIBLE_FAMILIES[layout]).toContain(family);
        expect(isLayoutCompatibleWithFamily(family, layout)).toBe(true);
      }
    }

    expect(isLayoutCompatibleWithFamily('DISTRIBUTION', 'FORCE_DIRECTED_3D')).toBe(false);
    expect(isLayoutCompatibleWithFamily('AGGREGATE', 'TIME_RIBBON')).toBe(false);
  });

  it('makes the single-valued legacy layout label explicitly non-invertible', () => {
    expect(LAYOUT_PRIMARY_REASONING_FAMILY.GRID_3D).toBe('POINT');
    expect(LAYOUT_TO_COMPATIBLE_FAMILIES.GRID_3D).toContain('DISTRIBUTION');
    expect(LAYOUT_TO_COMPATIBLE_FAMILIES.GRID_3D).toContain('AGGREGATE');

    // Backward-compatible exports remain identity aliases, so existing runtime
    // behavior does not change in this clarification tranche.
    expect(FAMILY_TO_LAYOUTS).toBe(FAMILY_TO_COMPATIBLE_LAYOUTS);
    expect(LAYOUT_TO_FAMILY).toBe(LAYOUT_PRIMARY_REASONING_FAMILY);
  });
});

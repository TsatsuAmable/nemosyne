import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const LAYOUT_DIR = path.resolve(process.cwd(), 'src/moneta/layouts');
const DATA_DERIVED_LAYOUTS = [
  'GridLayout3D.ts',
  'ForceDirected3D.ts',
  'RadialTreeLayout.ts',
  'TimeSeriesRibbonLayout.ts',
  'StreamlineLayout.ts',
  'GeoSurfaceLayout.ts',
  'SpectralVolumeLayout.ts',
];

describe('Moneta layout analytical authority', () => {
  it('does not retain degraded JS computational fallbacks beside Rust/WASM layouts', () => {
    for (const name of DATA_DERIVED_LAYOUTS) {
      const source = fs.readFileSync(path.join(LAYOUT_DIR, name), 'utf8');
      expect(source).not.toContain('warnKernelLayoutUnavailable');
      expect(source).not.toContain('using degraded JS spatial fallback');
    }
  });

  it('uses an explicit kernel-result guard at every Rust-owned layout boundary', () => {
    for (const name of [
      'GridLayout3D.ts',
      'ForceDirected3D.ts',
      'RadialTreeLayout.ts',
      'TimeSeriesRibbonLayout.ts',
      'GeoSurfaceLayout.ts',
      'SpectralVolumeLayout.ts',
    ]) {
      const source = fs.readFileSync(path.join(LAYOUT_DIR, name), 'utf8');
      expect(source).toContain('requireKernelLayoutPositions');
    }
    expect(fs.readFileSync(path.join(LAYOUT_DIR, 'StreamlineLayout.ts'), 'utf8'))
      .toContain('KernelLayoutUnavailableError');
  });
});

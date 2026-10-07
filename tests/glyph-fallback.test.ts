import { describe, it, expect } from 'vitest';
import {
  applyGlyphFallback,
  GLYPH_FALLBACK_SOURCES,
} from '../src/vr/ui-system/glyphFallback.ts';

/**
 * The uikit Inter MSDF atlas covers printable ASCII plus a small Latin-1
 * supplement. Every fallback output must itself be atlas-safe (pure ASCII),
 * otherwise the sanitizer would trade one missing glyph for another.
 */
const ATLAS_SAFE_RE = /^[\x20-\x7e\t\n]*$/;

describe('applyGlyphFallback (uikit atlas coverage)', () => {
  it('passes ASCII copy through unchanged (identity negative control)', () => {
    const copy = 'Settings | POS: [1, 2, 3] | LAYOUT: FORCE_DIRECTED_3D (v2)';
    expect(applyGlyphFallback(copy)).toBe(copy);
  });

  it('passes empty input through unchanged', () => {
    expect(applyGlyphFallback('')).toBe('');
  });

  it('replaces the observed Quest boot offender: em dash', () => {
    expect(applyGlyphFallback('ground — of every dataset')).toBe('ground - of every dataset');
  });

  it('maps each documented source to ASCII-only output', () => {
    expect(GLYPH_FALLBACK_SOURCES.length).toBeGreaterThan(0);
    for (const source of GLYPH_FALLBACK_SOURCES) {
      const out = applyGlyphFallback(`a${source}b`);
      expect(out).not.toContain(source);
      expect(out).toMatch(ATLAS_SAFE_RE);
    }
  });

  it('maps the exact observed cases', () => {
    expect(applyGlyphFallback('a—b–c→d…e•f′g’h“i”j×k÷l✓m█n')).toBe(
      'a-b-c->d...e-f\'g\'h"i"jxk/l>m#n',
    );
  });

  it('is idempotent: a second pass changes nothing', () => {
    const once = applyGlyphFallback('Layout — filter → aggregate … done ✓');
    expect(applyGlyphFallback(once)).toBe(once);
    expect(once).toMatch(ATLAS_SAFE_RE);
  });

  it('leaves covered atlas glyphs alone (° is in the atlas)', () => {
    expect(applyGlyphFallback('180° turn')).toBe('180° turn');
  });

  it('leaves out-of-scope accented letters untouched (documented non-goal)', () => {
    expect(applyGlyphFallback('café')).toBe('café');
  });
});

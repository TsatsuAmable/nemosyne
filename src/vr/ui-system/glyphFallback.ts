/**
 * ASCII fallback for glyphs missing from the uikit VR text atlas.
 *
 * The VR panels render through `@pmndrs/uikit`, whose default Inter MSDF atlas
 * (`@pmndrs/msdfonts`) covers printable ASCII plus a small Latin-1 supplement
 * (measured: 104 glyphs, max codepoint U+00FC). Any other character renders as
 * the atlas missing-glyph and emits a `Missing glyph info for character "…"`
 * console warning per occurrence — observed on Quest boot from tour-adjacent
 * and panel copy (notably the em dash).
 *
 * `applyGlyphFallback` normalizes the measured-missing punctuation to ASCII
 * equivalents that are all verified present in the atlas. Apply it to every
 * string entering a uikit `Text` node (`text:` prop and
 * `setProperties({ text })` funnels), including dynamically composed panel
 * copy (dataset names, moneta prose, log lines) — not just literals.
 * DOM-rendered UI (src/ui) uses browser fonts and does not need this.
 *
 * Non-goal: accented Latin-1 letters (é, ñ, …) are also absent from the atlas
 * but are left untouched — transliterating proper names is a separate
 * decision. They keep the previous behavior (missing glyph + warning).
 */

const FALLBACK_ENTRIES: ReadonlyArray<readonly [string, string]> = [
  ['\u2014', '-'],
  ['\u2013', '-'],
  ['\u2192', '->'],
  ['\u2190', '<-'],
  ['\u2026', '...'],
  ['\u2022', '-'],
  ['\u2032', "'"],
  ['\u2018', "'"],
  ['\u2019', "'"],
  ['\u201c', '"'],
  ['\u201d', '"'],
  ['\u00d7', 'x'],
  ['\u00f7', '/'],
  ['\u2713', '>'],
  ['\u2588', '#'],
];

/** Source characters replaced by {@link applyGlyphFallback}. */
export const GLYPH_FALLBACK_SOURCES: ReadonlyArray<string> = FALLBACK_ENTRIES.map(
  ([source]) => source,
);

const FALLBACK_PATTERN = new RegExp(
  FALLBACK_ENTRIES.map(([source]) =>
    source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  ).join('|'),
  'g',
);

const FALLBACK_BY_SOURCE: ReadonlyMap<string, string> = new Map(FALLBACK_ENTRIES);

/** Replace atlas-missing punctuation with ASCII equivalents. ASCII input passes through unchanged. */
export function applyGlyphFallback(text: string): string {
  if (!text || text.length === 0) return text;
  return text.replace(
    FALLBACK_PATTERN,
    (match) => FALLBACK_BY_SOURCE.get(match) ?? match,
  );
}

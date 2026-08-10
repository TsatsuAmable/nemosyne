/**
 * Shared colour tokens for the Nemosyne VR runtime.
 *
 * Single source of truth for the palette shared between the world theme
 * (`WorldTheme`) and the world-space panel base class (`MovablePanel`). Theme
 * presets and panel render routines source their shared colours from here so the
 * accent, alert, and panel-backing values cannot drift apart. Theme-specific
 * atmospheric tones (fog/ambient/grid secondaries) remain inline in
 * `WorldTheme.PRESETS` — only the shared semantic colours are tokenised here.
 *
 * Convergence with the docs design-system tokens (`docs/DESIGN_SYSTEM.md`) is a
 * separate Sprint 22.3 task; the values here are the runtime canonical set.
 */

/** Numeric hex colour tokens (little-endian hex used by three.js `setHex`). */
export const PALETTE = {
  // Semantic accents — neon reserved for selection / active state.
  accent: 0x00ffcc, // primary neon teal (selection, hover, active)
  alert: 0xff3864, // destructive / anomaly
  gold: 0xd4af37,
  violet: 0x6b4ee6,

  // Panel backings (MovablePanel base). Solid, not glassmorphic — prevents the
  // 3D wireframe grid behind from bleeding through small text.
  panelBg: 0x0b1626,
  panelBgHighContrast: 0x050a12,
  panelBorder: 0x00ccaa,
  panelBorderHighContrast: 0x00ffff,
  panelTitleBg: 0x10243e,
  panelTitleBgHighContrast: 0x0d1f38,
  panelText: 0xe0f7ff,
  panelTextHighContrast: 0xffffff,
  panelMinimize: 0xff3366,
  panelScrollbarTrack: 0x0a1626,
} as const;

/**
 * Convert a numeric hex token to a CSS `#rrggbb` string for canvas 2D contexts.
 * e.g. `cssHex(0x00ffcc)` → `'#00ffcc'`.
 */
export function cssHex(n: number): string {
  return '#' + (n >>> 0).toString(16).padStart(6, '0');
}
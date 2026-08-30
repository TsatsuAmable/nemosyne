/**
 * Shared colour tokens for the Nemosyne VR runtime.
 *
 * @deprecated Use `src/vr/ui-system/tokens.ts` (COLOR_TOKENS, SPACING_TOKENS, etc.) instead.
 * This module is retained as a compatibility alias during the B-V1 migration.
 * It will be removed after all consumers have migrated.
 */

import { COLOR_TOKENS } from './ui-system/tokens.ts';

/** Numeric hex colour tokens (little-endian hex used by three.js `setHex`). */
export const PALETTE = {
  // Semantic accents — neon reserved for selection / active state.
  accent: COLOR_TOKENS.interaction.focus,
  alert: COLOR_TOKENS.danger.destructive,
  gold: COLOR_TOKENS.epistemic.uncertain,
  violet: 0x6b4ee6,

  // Panel backings (MovablePanel base). Solid, not glassmorphic — prevents the
  // 3D wireframe grid behind from bleeding through small text.
  panelBg: COLOR_TOKENS.surface.base,
  panelBgHighContrast: COLOR_TOKENS.space.void,
  panelBorder: COLOR_TOKENS.surface.border,
  panelBorderHighContrast: COLOR_TOKENS.interaction.focus,
  panelTitleBg: COLOR_TOKENS.surface.raised,
  panelTitleBgHighContrast: COLOR_TOKENS.surface.raised,
  panelText: COLOR_TOKENS.text.primary,
  panelTextHighContrast: COLOR_TOKENS.text.primary,
  panelMinimize: COLOR_TOKENS.danger.destructive,
  panelScrollbarTrack: COLOR_TOKENS.surface.base,
} as const;

/**
 * Convert a numeric hex token to a CSS `#rrggbb` string for canvas 2D contexts.
 * e.g. `cssHex(0x00ffcc)` → `'#00ffcc'`.
 */
export function cssHex(n: number): string {
  return '#' + (n >>> 0).toString(16).padStart(6, '0');
}
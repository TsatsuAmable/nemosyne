import { COLOR_TOKENS, DEPTH_TOKENS } from './tokens.ts';

export interface UITheme {
  backgroundColor: number | string;
  borderColor: number | string;
  borderWidth: number;
  borderRadius: number;
  opacity: number;
  textPrimary: number | string;
  textSecondary: number | string;
  textMuted: number | string;
  accentColor: number | string;
  commitColor: number | string;
  dangerColor: number | string;
  uncertainColor: number | string;
  contradictionColor: number | string;
}

export const DARK_THEME: UITheme = {
  backgroundColor: COLOR_TOKENS.surface.base,
  borderColor: COLOR_TOKENS.surface.border,
  borderWidth: DEPTH_TOKENS.panel.borderWidth,
  borderRadius: DEPTH_TOKENS.panel.borderRadius,
  opacity: DEPTH_TOKENS.panel.opacity,
  textPrimary: COLOR_TOKENS.text.primary,
  textSecondary: COLOR_TOKENS.text.secondary,
  textMuted: COLOR_TOKENS.text.muted,
  accentColor: COLOR_TOKENS.interaction.focus,
  commitColor: COLOR_TOKENS.interaction.commit,
  dangerColor: COLOR_TOKENS.danger.destructive,
  uncertainColor: COLOR_TOKENS.epistemic.uncertain,
  contradictionColor: COLOR_TOKENS.epistemic.contradiction,
};

export const HIGH_CONTRAST_THEME: UITheme = {
  backgroundColor: 0x050a12, // Deep black for high contrast
  borderColor: 0x00ffff,     // Full neon cyan border
  borderWidth: 2.0,
  borderRadius: DEPTH_TOKENS.panel.borderRadius,
  opacity: 0.98,
  textPrimary: 0xffffff,
  textSecondary: 0xe0f7ff,
  textMuted: 0xa9b8c6,
  accentColor: 0x00ffff,
  commitColor: 0x8ce6c1,
  dangerColor: 0xff3300,
  uncertainColor: COLOR_TOKENS.epistemic.uncertain,
  contradictionColor: COLOR_TOKENS.epistemic.contradiction,
};

export function getTheme(highContrast = false): UITheme {
  return highContrast ? HIGH_CONTRAST_THEME : DARK_THEME;
}

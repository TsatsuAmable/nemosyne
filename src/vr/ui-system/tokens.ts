/**
 * Nemosyne VR Design Tokens.
 * Single source of truth for color, spacing, typography, depth and layout constraints.
 */

export const TOKEN_SET_VERSION = '20260830.1';

export const COLOR_TOKENS = {
  space: {
    void: 0x05070b, // '#05070b' world background
  },
  surface: {
    base: 0x0b1119, // '#0b1119' primary panel background
    raised: 0x111a24, // '#111a24' active/raised surface
    border: 0x263544, // '#263544' quiet separation
  },
  text: {
    primary: 0xf2f6fa, // '#f2f6fa' primary text
    secondary: 0xa9b8c6, // '#a9b8c6' secondary labels
    muted: 0x718394, // '#718394' inactive/meta text
  },
  interaction: {
    focus: 0x59d6ff, // '#59d6ff' focus/hover/active interaction
    commit: 0x8ce6c1, // '#8ce6c1' successful committed interaction
  },
  epistemic: {
    uncertain: 0xffc46b, // '#ffc46b' ambiguity/inconclusive state
    contradiction: 0xff7aae, // '#ff7aae' contradiction/counterevidence
  },
  danger: {
    destructive: 0xff6464, // '#ff6464' destructive system action only
  },
  status: {
    verified: 0x71d99b, // '#71d99b' verified replay/integrity state
  },
} as const;

export const SPACING_TOKENS = {
  grid: {
    x4: 4,
    x8: 8,
    x12: 12,
    x16: 16,
    x24: 24,
    x32: 32,
    x48: 48,
    x64: 64,
  },
  panel: {
    outerPadding: 24,
    gap: 16,
  },
} as const;

export const TYPOGRAPHY_TOKENS = {
  scale: {
    display: 38,
    title: 28,
    heading: 22,
    body: 18,
    label: 16,
    meta: 14,
  },
  fontFamily: 'system-ui, sans-serif',
} as const;

export const DEPTH_TOKENS = {
  panel: {
    opacity: 0.94,
    opacityInactive: 0.78,
    borderWidth: 1.5,
    borderRadius: 16,
  },
  control: {
    raisedDepth: 0.006, // 6mm virtual
    pressTravel: 0.004, // 4mm virtual
    ornamentZOffset: 0.012, // 12mm
    minSeparation: 0.03, // 30mm near surface separation
  },
} as const;

export const SPATIAL_ZONES = {
  micro: {
    min: 0.25,
    max: 0.45,
    default: 0.35,
  },
  nearTouch: {
    min: 0.45,
    max: 0.70,
    default: 0.55,
  },
  primaryWork: {
    min: 0.70,
    max: 1.20,
    default: 0.95,
  },
  reference: {
    min: 1.20,
    max: 1.80,
    default: 1.50,
  },
  dataField: {
    min: 2.0,
    max: 8.0,
  },
  nearEnvelope: 0.55, // Hysteresis near transition
} as const;

/** Convert numeric hex token to CSS `#rrggbb` string. */
export function toCssHex(n: number): string {
  return '#' + (n >>> 0).toString(16).padStart(6, '0');
}

/** Alias for backwards compatibility with palette.ts consumers. */
export const cssHex = toCssHex;

/** CSS custom property (variable) map derived from tokens — inject into :root for DOM consumers. */
export const CSS_VARIABLES: Record<string, string> = {
  '--nms-color-void': toCssHex(COLOR_TOKENS.space.void),
  '--nms-color-surface-base': toCssHex(COLOR_TOKENS.surface.base),
  '--nms-color-surface-raised': toCssHex(COLOR_TOKENS.surface.raised),
  '--nms-color-surface-border': toCssHex(COLOR_TOKENS.surface.border),
  '--nms-color-text-primary': toCssHex(COLOR_TOKENS.text.primary),
  '--nms-color-text-secondary': toCssHex(COLOR_TOKENS.text.secondary),
  '--nms-color-text-muted': toCssHex(COLOR_TOKENS.text.muted),
  '--nms-color-interaction-focus': toCssHex(COLOR_TOKENS.interaction.focus),
  '--nms-color-interaction-commit': toCssHex(COLOR_TOKENS.interaction.commit),
  '--nms-color-epistemic-uncertain': toCssHex(COLOR_TOKENS.epistemic.uncertain),
  '--nms-color-epistemic-contradiction': toCssHex(COLOR_TOKENS.epistemic.contradiction),
  '--nms-color-danger-destructive': toCssHex(COLOR_TOKENS.danger.destructive),
  '--nms-color-status-verified': toCssHex(COLOR_TOKENS.status.verified),
  '--nms-spacing-x4': `${SPACING_TOKENS.grid.x4}px`,
  '--nms-spacing-x8': `${SPACING_TOKENS.grid.x8}px`,
  '--nms-spacing-x12': `${SPACING_TOKENS.grid.x12}px`,
  '--nms-spacing-x16': `${SPACING_TOKENS.grid.x16}px`,
  '--nms-spacing-x24': `${SPACING_TOKENS.grid.x24}px`,
  '--nms-spacing-x32': `${SPACING_TOKENS.grid.x32}px`,
  '--nms-spacing-x48': `${SPACING_TOKENS.grid.x48}px`,
  '--nms-spacing-x64': `${SPACING_TOKENS.grid.x64}px`,
  '--nms-panel-outer-padding': `${SPACING_TOKENS.panel.outerPadding}px`,
  '--nms-panel-gap': `${SPACING_TOKENS.panel.gap}px`,
  '--nms-font-size-display': `${TYPOGRAPHY_TOKENS.scale.display}px`,
  '--nms-font-size-title': `${TYPOGRAPHY_TOKENS.scale.title}px`,
  '--nms-font-size-heading': `${TYPOGRAPHY_TOKENS.scale.heading}px`,
  '--nms-font-size-body': `${TYPOGRAPHY_TOKENS.scale.body}px`,
  '--nms-font-size-label': `${TYPOGRAPHY_TOKENS.scale.label}px`,
  '--nms-font-size-meta': `${TYPOGRAPHY_TOKENS.scale.meta}px`,
  '--nms-font-family': TYPOGRAPHY_TOKENS.fontFamily,
  '--nms-panel-border-radius': `${DEPTH_TOKENS.panel.borderRadius}px`,
  '--nms-panel-border-width': `${DEPTH_TOKENS.panel.borderWidth}px`,
  '--nms-panel-opacity': String(DEPTH_TOKENS.panel.opacity),
  '--nms-panel-opacity-inactive': String(DEPTH_TOKENS.panel.opacityInactive),
} as const;

/** Inject CSS variables into document root for DOM terminal surfaces. */
export function injectCssVariables(root: HTMLElement = document.documentElement): void {
  for (const [key, value] of Object.entries(CSS_VARIABLES)) {
    root.style.setProperty(key, value);
  }
}

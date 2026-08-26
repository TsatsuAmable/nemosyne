/**
 * Nemosyne VR Design Tokens.
 * Single source of truth for color, spacing, typography, depth and layout constraints.
 */

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

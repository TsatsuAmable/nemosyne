/**
 * Central VR panel default layout — C1′ role-aware depth-tier zoning.
 *
 * Authority: docs/decisions/VR_PANEL_SPATIAL_LAYOUT.md revision 3 (role-aware
 * tiers grounded in the vision doc §9 "UI / Analyst Cockpit", §4.3 interaction
 * ontology, and docs/archive/USER_STORIES_AND_UX_ANALYSIS_2026-08-19.md).
 *
 * Reference-frame decision (revision 3): every persistent panel is
 * BODY_LOCKED — parented to the torso anchor (WorldSceneComposer.analystAnchor,
 * damped yaw, y ≈ 1.35 m at eye height 1.6 m) — never head/camera-locked.
 * Rationale: body-fixed slots build landmark/survey knowledge, damped yaw
 * avoids visual-vestibular conflict while scanning, snap turns ease instead
 * of jumping, and drag-to-reposition remains the user override.
 *
 * Vision-directed principles baked into this layout:
 *  1. The forward center cone (±12°, mid field) is RESERVED for data. The palace
 *     is the primary analytical focus; no panel may park there.
 *  2. Roles (PanelRolesManager) drive tiers: workspace/task panels live MID-left
 *     to MID-right; diagnostic/superuser panels live FAR and low.
 *  3. Progressive disclosure stays authoritative — panels open hidden and appear
 *     at their slot; this module defines *where they appear*, nothing more.
 *  4. Tiers encode interaction proximity, NOT analytical importance (skill §15).
 *
 * ALL coordinates are torso-anchor-LOCAL. Do not subtract ANCHOR_TORSO_WORLD_Y
 * here or at call sites — the table below is already in the anchor frame.
 */

export const ANCHOR_TORSO_WORLD_Y = 1.35; // eye 1.6 − 0.25 (WorldSceneComposer)

export type Vec3 = [number, number, number];

/** Polar slot helper: angle in degrees from forward (−Z), radius, ANCHOR-LOCAL height. */
export function fanSlot(angleDeg: number, radius: number, localY: number): Vec3 {
  const a = (angleDeg * Math.PI) / 180;
  return [radius * Math.sin(a), localY, -radius * Math.cos(a)];
}

export const PANEL_LAYOUT = {
  // ---- NEAR tier (0.45–0.8 m from the body): embodied/attention ----
  miniOverview: [0.55, -0.05, -0.6], // world ≈ [0.55, 1.3, −0.6]
  peerPresenceHUD: [-0.55, -0.05, -0.6],
  interactionCoach: [0, -0.2, -0.75], // novice onboarding

  // ---- MID workspace fan (r=1.15, eye-line +0.20). Center cone ±12° stays clear. ----
  settingsPanel: fanSlot(-45, 1.15, 0.2), // system
  operationLogPanel: fanSlot(-30, 1.15, 0.2), // task — op audit trail
  recommendationPanel: fanSlot(-15, 1.15, 0.2), // task — challenge Moneta
  monetaExplainerPanel: fanSlot(15, 1.15, 0.2), // task — "why this palace?"
  vaultPanel: fanSlot(30, 1.15, 0.2), // evidence vault — archive/restore
  legacyMenu: fanSlot(45, 1.15, 0.2), // legacy — retired main menu (diagnostic)

  // ---- MID lower strip: transient narrative/log surfaces under the data centerline ----
  vrConsole: [0, -0.3, -1.05], // live ops/results log
  narrativeStrip: [0, -0.5, -0.95], // history route-knowledge strip

  // ---- FAR tier (r=1.6): diagnostic / superuser / researcher tooling ----
  // Upper row (eye-line +0.15):
  loadTestPanel: fanSlot(-50, 1.6, 0.15),
  schemaMappingPanel: fanSlot(-25, 1.6, 0.15),
  monetaDiagnosticHUD: fanSlot(0, 1.6, 0.15),
  telemetryPanel: fanSlot(25, 1.6, 0.15),
  inputTelemetry: fanSlot(50, 1.6, 0.15),
  // Lower row (eye-line −0.30):
  networkPanel: fanSlot(-50, 1.6, -0.3), // collaboration transport diagnostics
  performancePanel: fanSlot(-25, 1.6, -0.3),
  gestureConfidenceHUD: fanSlot(50, 1.6, -0.3),

  // ---- Behind-user wall ----
  chartPlanePanel: [0, 0.25, 1.5],
} satisfies Record<string, Vec3>;

export type PanelLayoutKey = keyof typeof PANEL_LAYOUT;

/**
 * Participant-facing UI treatment identity for the vision §14 freeze contract:
 * panel defaults = C1′ revision 3 (torso-locked), command surface = intent
 * wheel v1 (+ SUPERUSER annex), reference-frame policy = BODY_LOCKED with
 * head lock reserved for transient alerts. Bump whenever any participant-facing
 * spatial arrangement changes and record it in docs/study/UI_TREATMENT.md.
 */
export const UI_TREATMENT_VERSION = 'panel-layout/3+intent-wheel/1+frames/torso-locked' as const;

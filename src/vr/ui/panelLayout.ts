/**
 * Central VR panel default layout — the "C1′ role-aware depth-tier zoning" decision.
 *
 * Authority: docs/decisions/VR_PANEL_SPATIAL_LAYOUT.md, revision 2 (role-aware,
 * grounded in the vision doc §9 "UI / Analyst Cockpit — expose reasoning and
 * challenge controls", §4.3 interaction ontology, and the archived use-case
 * analysis docs/archive/USER_STORIES_AND_UX_ANALYSIS_2026-08-19.md).
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
 * Coordinates are cameraGroup-space (world at default rig origin, eye 1.6 m).
 * Anything re-parented into the torso anchor must use `toAnchorLocal` — the
 * anchor lives at (cam.x, max(0.8, cam.y − 0.25), cam.z − panelDistance), so a
 * world-style y under the anchor double-counts ~1.35 m (finding F1).
 */

export const ANCHOR_TORSO_WORLD_Y = 1.35; // eye 1.6 − 0.25 (WorldSceneComposer)

export type Vec3 = [number, number, number];

/** Polar slot helper: angle in degrees from forward (−Z), radius, world height. */
export function fanSlot(angleDeg: number, radius: number, y: number): Vec3 {
  const a = (angleDeg * Math.PI) / 180;
  return [radius * Math.sin(a), y, -radius * Math.cos(a)];
}

/** Convert a world (cameraGroup-space) position to torso-anchor local space. */
export function toAnchorLocal(p: Vec3, panelDistance = 0): Vec3 {
  return [p[0], p[1] - ANCHOR_TORSO_WORLD_Y, p[2] + panelDistance];
}

export const PANEL_LAYOUT = {
  // ---- NEAR tier (0.45–0.8 m): embodied/attention, anchor-local ----
  miniOverview: toAnchorLocal([0.55, 1.3, -0.6]),
  peerPresenceHUD: toAnchorLocal([-0.55, 1.3, -0.6]),
  interactionCoach: [0, 1.15, -0.75], // cameraGroup-space (novice onboarding)

  // ---- MID workspace fan (r=1.15, y=1.55). Center cone ±12° stays clear. ----
  settingsPanel: fanSlot(-45, 1.15, 1.55), // system
  vrMenu: fanSlot(-30, 1.15, 1.55), // workspace — primary operation surface
  operationLogPanel: fanSlot(-15, 1.15, 1.55), // task — op audit trail
  recommendationPanel: fanSlot(15, 1.15, 1.55), // task — challenge Moneta
  monetaExplainerPanel: fanSlot(30, 1.15, 1.55), // task — "why this palace?"

  // ---- MID lower strip: transient narrative/log surfaces under the data cone ----
  vrConsole: [0, 1.05, -1.05], // live ops/results log, below the data centerline
  narrativeStrip: [0, 0.85, -0.95], // history route-knowledge strip (cameraGroup-space value; anchor-parented at runtime — convert via toAnchorLocal at the call site)

  // ---- FAR tier (r=1.6): diagnostic / superuser / researcher tooling ----
  // Upper row y=1.5:
  loadTestPanel: fanSlot(-50, 1.6, 1.5),
  schemaMappingPanel: fanSlot(-25, 1.6, 1.5),
  monetaDiagnosticHUD: fanSlot(0, 1.6, 1.5), // anchor-parented at runtime — convert
  telemetryPanel: fanSlot(25, 1.6, 1.5),
  inputTelemetry: fanSlot(50, 1.6, 1.5),
  // Lower row y=1.05:
  networkPanel: fanSlot(-50, 1.6, 1.05), // collaboration transport diagnostics
  performancePanel: fanSlot(-25, 1.6, 1.05),
  gestureConfidenceHUD: fanSlot(50, 1.6, 1.05), // superuser; anchor-parented at runtime — convert

  // ---- Behind-user wall (unchanged) ----
  chartPlanePanel: [0, 1.6, 1.5],
} satisfies Record<string, Vec3>;

export type PanelLayoutKey = keyof typeof PANEL_LAYOUT;

# Participant-Facing UI Treatment Declaration

**Treatment identity (`uiTreatmentVersion`):** `panel-layout/5+intent-wheel/1+frames/body-stable`
**Declared:** 5 September 2026 · **Authority:** decision record
`docs/decisions/VR_PANEL_SPATIAL_LAYOUT.md` revisions 1–5 · **Vision basis:**
`Nemosyne_Definitive_Vision_and_Roadmap.md` §14 (research safeguards) and §15
(UI / Analyst Cockpit).

Spatial arrangement and reference-frame behavior of participant-facing UI are
part of the experimental treatment (vr_engineer skill §24: spatial-arrangement
changes are CONTROLLED-TREATMENT MODIFICATIONS). This file declares the exact
arrangement that any controlled study freezes; it is mirrored into the
machine-checked freeze contract as `runtimeVersions.uiTreatmentVersion`, so a
mid-session UI drift fails closed at the next trial boundary instead of silently
changing treatment.

## Frozen components

### 1. Panel layout — revision 5 (`src/vr/ui/panelLayout.ts`)

Role-aware depth-tier zoning remains unchanged from revision 4. Revision 5
changes the BODY_LOCKED reference-frame and manipulation semantics so the
implementation now matches the survey-knowledge rationale that justified the
layout in the first place:

- rig/world locomotion owns body-frame translation;
- physical HMD X/Z lean is head motion and does not translate the persistent
  workspace;
- current `XRFrame` viewer pose is consumed when available instead of relying on
  the camera pose that may not be updated until render;
- ordinary gaze scanning stays inside an 18° heading deadband;
- sustained heading changes cross a 0.2 s intent gate, then follow with
  delta-time-independent damping and 8° hysteresis release;
- the body-frame transform freezes while a panel grab is active;
- persistent panels use stable parent-local reading yaw toward the body viewer
  target, never `lookAt(0,0,0)` in world space;
- free-floating panel grabs are direct ray-parametric 3D manipulation, safety
  distance is enforced on release rather than every move, and visibility
  restoration preserves the user's placement.

| Tier | Distance | Contents |
|---|---|---|
| Near (embodied/attention) | 0.45–0.8 m | MiniOverview (+0.55), PeerPresenceHUD (−0.55), InteractionCoach (0, −0.2, −0.75) |
| Mid workspace fan | r=1.15 m, ±45°, ±12° eye-line center cone reserved for data | Settings −45°, OperationLog −30°, Recommendation −15°, MonetaExplainer +15°, Vault +30°, LegacyMenu +45° (all at local y +0.2) |
| Mid lower grounding/log | 0.9–1.4 m, below the data centerline | VRConsole `(0,−0.3,−1.05)`; NarrativeStrip `(0,−0.5,−0.95)`; persistent StatusStrip `45° @ r=1.15, local y −0.58` |
| Far diagnostic | r=1.6 m | LoadTest −50°, SchemaMapping −25°, MonetaDiagnostic 0°, TelemetryPanel +25°, InputTelemetry +50° (upper row); NetworkPanel −50°, PerformancePanel −25°, GestureConfidenceHUD +50° (lower row) |
| Behind | wall | ChartPlanePanel |

The Status Strip remains a compact, non-interactive grounding surface. Its
0.9 m-wide four-line treatment is centred at 45° and approximately 0.77 m world
height for the nominal 1.35 m standing baseline. This keeps it outside the
forward data cone and visually subordinate to the data field while retaining
persistent focus/decision/preview/evidence/recovery grounding.

Exact slots are test-pinned in `tests/panel-layout.test.ts`. Body-frame and
manipulation semantics are pinned independently in `tests/torso-anchor.test.ts`,
`tests/movable-panel.test.ts`, `tests/free-3d-panel-orientation.test.ts`, and the
F9/F10 cross-feature suites. These are repository/simulator assertions, not a
claim of Quest ergonomics or human-subject comfort.

### 2. Command surface — intent wheel v1 (`buildIntentWheelMenuCategories`)

Task-oriented categories ANALYSE / VIEW / DATA / STUDY / COLLABORATE / SYSTEM
plus a SUPERUSER annex excluded from the participant command surface. Novice
vocabulary coverage per UX spec §6.1: Move (teleport/flight/floor),
Undo/Redo (ANALYSE), Return-to-Overview (VIEW). Contract tests:
`tests/vr-ux-convergence.test.ts`.

### 3. Reference-frame policy

Every persistent panel is BODY_LOCKED to the analyst body-workspace anchor
(`WorldSceneComposer.analystAnchor`). BODY_LOCKED means the panel follows the
locomotion rig and accepted body-heading changes, not raw per-frame HMD
translation or gaze yaw. Head/camera lock remains reserved for transient
comfort/system alerts only. World-locked landmarks (Datum Plane, TechnoCore,
Ice Vault, Portals) are unaffected.

Revision 5 preserves the revision-4 Status Strip ownership: it is constructed
directly under the body-workspace anchor by `WorldUIManager`; application
bootstrap performs no reference-frame repair.

## Change protocol

Any change to panel defaults, wheel taxonomy or frame policy must:

1. bump `UI_TREATMENT_VERSION`;
2. update this declaration and the decision record;
3. classify the change per skill §24 (treatment modification vs protocol impact);
4. obtain research review before it reaches study conditions.

Studies frozen to revision 4 remain frozen to revision 4. This declaration does
not retroactively reclassify or validate evidence collected under the previous
treatment.

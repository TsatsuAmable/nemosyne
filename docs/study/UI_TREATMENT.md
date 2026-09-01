# Participant-Facing UI Treatment Declaration

**Treatment identity (`uiTreatmentVersion`):** `panel-layout/4+intent-wheel/1+frames/torso-locked`
**Declared:** 1 September 2026 · **Authority:** decision record
`docs/decisions/VR_PANEL_SPATIAL_LAYOUT.md` revisions 1–4 · **Vision basis:**
`Nemosyne_Definitive_Vision_and_Roadmap.md` §14 (research safeguards) and §15
(UI / Analyst Cockpit).

Spatial arrangement of participant-facing UI is part of the experimental
treatment (vr_engineer skill §24: spatial-arrangement changes are CONTROLLED-
TREATMENT MODIFICATIONS). This file declares the exact arrangement that any
controlled study freezes; it is mirrored into the machine-checked freeze
contract as `runtimeVersions.uiTreatmentVersion`, so a mid-session UI drift
fails closed at the next trial boundary instead of silently changing treatment.

## Frozen components

### 1. Panel layout — revision 4 (`src/vr/ui/panelLayout.ts`)

Role-aware depth-tier zoning, all positions torso-anchor-local. Revision 4 keeps
the revision-3 BODY_LOCKED policy and brings the persistent P1-UV C2 Status
Strip under the same central layout authority instead of allowing it to remain
a direct camera child or be repaired by bootstrap after construction.

| Tier | Distance | Contents |
|---|---|---|
| Near (embodied/attention) | 0.45–0.8 m | MiniOverview (+0.55), PeerPresenceHUD (−0.55), InteractionCoach (0, −0.2, −0.75) |
| Mid workspace fan | r=1.15 m, ±45°, ±12° eye-line center cone reserved for data | Settings −45°, OperationLog −30°, Recommendation −15°, MonetaExplainer +15°, Vault +30°, LegacyMenu +45° (all at local y +0.2) |
| Mid lower grounding/log | 0.9–1.4 m, below the data centerline | VRConsole `(0,−0.3,−1.05)`; NarrativeStrip `(0,−0.5,−0.95)`; persistent StatusStrip `45° @ r=1.15, local y −0.58` |
| Far diagnostic | r=1.6 m | LoadTest −50°, SchemaMapping −25°, MonetaDiagnostic 0°, TelemetryPanel +25°, InputTelemetry +50° (upper row); NetworkPanel −50°, PerformancePanel −25°, GestureConfidenceHUD +50° (lower row) |
| Behind | wall | ChartPlanePanel |

The Status Strip remains a compact, non-interactive grounding surface. Its
0.9 m-wide four-line treatment is centred at 45° and approximately 0.77 m world
height for a nominal 1.35 m torso anchor. This keeps it outside the forward data
cone and visually subordinate to the data field while retaining persistent
focus/decision/preview/evidence/recovery grounding.

Exact slots are test-pinned in `tests/panel-layout.test.ts` (cone clearance,
comfort band, far-tier radius, unique defaults, single-frame height band and the
Status Strip treatment identity). P1-UV C2 production-browser evidence also
asserts that the live Status Strip is parented to `analystAnchor` and carries the
exact `PANEL_LAYOUT.statusStrip` local coordinates.

### 2. Command surface — intent wheel v1 (`buildIntentWheelMenuCategories`)

Task-oriented categories ANALYSE / VIEW / DATA / STUDY / COLLABORATE / SYSTEM
plus a SUPERUSER annex excluded from the participant command surface. Novice
vocabulary coverage per UX spec §6.1: Move (teleport/flight/floor),
Undo/Redo (ANALYSE), Return-to-Overview (VIEW). Contract tests:
`tests/vr-ux-convergence.test.ts`.

### 3. Reference-frame policy

Every persistent panel is BODY_LOCKED to the torso anchor
(`WorldSceneComposer.analystAnchor`, damped yaw). Head/camera lock is reserved
for transient comfort/system alerts only. World-locked landmarks (Datum Plane,
TechnoCore, Ice Vault, Portals) are unaffected.

Revision 4 closes the Status Strip exception that survived revision 3: it is now
constructed directly under the torso anchor by `WorldUIManager`; application
bootstrap only wires state and performs no reference-frame repair.

## Change protocol

Any change to panel defaults, wheel taxonomy or frame policy must:

1. bump `UI_TREATMENT_VERSION`;
2. update this declaration and the decision record;
3. classify the change per skill §24 (treatment modification vs protocol impact);
4. obtain research review before it reaches study conditions.

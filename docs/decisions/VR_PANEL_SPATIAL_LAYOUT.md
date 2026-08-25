# VR Panel Spatial Layout — Hypothesis & Decision Record

**Branch:** `feat/vr-panel-blender-prototypes` (off `main` @ `d42c0ac`)
**Governing skill:** `src/.agent/skills/vr_engineer_skill.md` (§4, §5, §6, §15, §21, §22)
**Workflow stage:** UX/SPATIAL HYPOTHESIS — completed after code audit, before 3D prototype.
**Research classification (skill §24):** CONTROLLED-TREATMENT MODIFICATION candidate — this changes spatial arrangement of participant-facing UI. Any merged runtime change must be flagged for research review.

---

## 1. Code audit findings (evidence: static inspection, skill Evidence Hierarchy tier 6)

All facts verified with `file:line` citations in the audit; key numbers:

### Panel inventory (all camera/torso-anchored via `MovablePanel`, `depthTest:false`)

| Panel | Size (m) | Default position |
|---|---|---|
| VRConsole | 1.2×0.84 | `[0, 1.45, -1.3]` |
| VRMenu | 0.95×1.45 | `[-0.9, 1.5, -1.1]` |
| InputTelemetry | 1.1×0.73 | `[0.85, 1.5, -1.2]` |
| SettingsPanel | 0.9×0.82 | `[0.65, 1.55, -1.1]` |
| TelemetryPanel | 0.9×0.72 | `[0.75, 1.55, -1.1]` |
| PerformancePanel | 0.96×0.72 | `[0.55, 1.6, -1.05]` |
| NetworkPanel | 0.72×0.48 | `[-0.65, 1.55, -1.1]` |
| OperationLogPanel | 0.8×0.64 | `[-0.65, 1.55, -1.1]` |
| RecommendationPanel | 0.72×0.62 | `[0.8, 1.5, -1.2]` |
| MonetaExplainerPanel | 1.1×0.72 | `[0.8, 1.5, -1.2]` |
| GestureConfidenceHUD | 0.85×0.65 | `[0.8, 1.5, -1.2]` |
| NarrativeStrip | 0.9×0.22 | `[0, 1.35, -1.05]` |
| InteractionCoach | 0.8×0.7 | `[0.75, 1.45, -1.0]` |
| LoadTestPanel | 0.92×0.82 | `[-0.9, 1.55, -1.1]` |
| SchemaMappingPanel | 1.1×0.8 | `[-0.7, 1.4, -1.2]` |
| MonetaDiagnosticHUD | 1.3×0.72 | `[-0.8, 1.5, -1.2]` |
| ChartPlanePanel | 1.1×0.75 | `[0, 1.6, 1.5]` (behind user) |
| MiniOverview | 0.5² | `[0.9, 1.35, -0.7]` (anchor-local) |
| PeerPresenceHUD | 0.5² | `[-0.9, 1.35, -0.7]` (anchor-local) |

### Structural findings

1. **Default-position collisions.** NetworkPanel and OperationLogPanel share the identical default position; RecommendationPanel, MonetaExplainerPanel and GestureConfidenceHUD share another; Settings/Telemetry/Performance occupy a 0.3 m cluster on the right. There is no collision or overlap resolution anywhere in `src/vr/ui/` (finding 6 of audit).
2. **Depth arbitration is draw-order only.** Every panel uses `depthTest:false, depthWrite:false` (`MovablePanel.ts:124-125`), so overlapping panels z-fight perceptually and read through the world.
3. **The anchored layout machinery is bypassed.** Production constructs `PanelManager` with `freeFloating:true` (`WorldUIManager.ts:195-199`); the 90° fan (`PanelManager.ts:316-360`) and comfort clamp (0.45–1.4 m) only run in the non-production anchored mode.
4. **Torso anchor is well-founded.** `WorldSceneComposer.analystAnchor` tracks `(cam.x, max(0.8, cam.y-0.25), cam.z - panelDistance)` with damped yaw — a torso-locked frame, correct for body-referenced UI.
5. **HandWheelMenu's declared arc constants are dead.** `categoryRadius/actionRadius/actionSpread` (`HandWheelMenu.ts:126-129`) are assigned and never read; the real layout is two pill columns at ±0.36 m with 0.085 m pitch.
6. **Dashboard semicircle** is the one spatially coherent arrangement: r=1.35 m, 180° arc, 5 visible columns × 2 rows, heightY 1.45, tilt 0.12 (`WorldUIManager.ts:235-250`).

## 2. Hypothesis (testable in the §22 reference scene)

**H1 (clutter):** With three or more panels open at their defaults, the forward 90° of the analyst's mid field is perceptually cluttered — overlapping planes at 1.0–1.3 m with `depthTest:false` produce ambiguous figure-ground, violating skill §13 (visual hierarchy) and §5 (survey knowledge: "where is everything?").

**H2 (zoning):** Assigning each panel class to a depth tier resolves H1 without reducing density: near field (0.45–0.8 m) = embodied/attention items (HandWheel, MiniOverview, PeerPresenceHUD, InteractionCoach); mid field (0.9–1.4 m) = primary work panels, fan-distributed on ±45° to avoid axis stacking; far field (≥1.35 m) = the dashboard semicircle, which already owns that tier.

**H3 (fan revival):** Re-enabling the (already-implemented, non-production) PanelManager fan as the *default arrangement* for newly opened mid-field panels — while preserving `freeFloating` drag overrides — needs no new layout system (skill §20 convergence rule) and restores the existing 0.45–1.4 m comfort clamp.

**H4 (skill §17):** Distance tiers communicate *interaction proximity*, not analytical importance — consistent with skill §15.

Distance markers are hypotheses, not rules (skill §22); the Blender comparison must test them rather than assume them.

## 3. Candidates to prototype

- **C0 — Current state (control):** reproduce the audit defaults exactly.
- **C1 — Depth-tier zoning (H2):** same panel set, re-bucketed by distance tier + mid-field fan.
- **C2 — Consolidation:** C1 plus moving the dashboard semicircle to the dominant depth reference, i.e. all work panels snap into dashboard zones instead of floating (larger change; tests whether two spatial systems — free panels vs dashboard zones — can converge, skill Gate B).

## 4. Decision criteria (skill §2, §9, §30)

1. Survey knowledge: at a glance, can the analyst name where each open panel lives? (target: no two panels overlapping within the forward ±60°)
2. Visual hierarchy: PRIMARY focus panel dominates; TERTIARY panels subordinate in scale/glow.
3. Interaction cost: hand travel distance & head rotation to bring any panel into focus; fan pitch ≤ 45° steps.
4. Recoverability: any default layout restorable (existing `setPanelPositions` machinery).
5. Smallest responsible layer (skill §20): prefer configuration/ownership changes in `WorldUIManager` over new systems.

## 5. Decision (25 August 2026)

**Selected: C1 — depth-tier zoning, implemented as default-position changes.** Rationale:

- C0 (control) confirms H1: identical-position triples, draw-order-only arbitration, and panels
  stacked on the forward axis at 1.0–1.3 m produce a cluttered, unmappable field.
- C1 preserves the existing free-floating drag/serialization authority (Gate D clean): tiers are
  *defaults*, not a second layout system. It reuses the production torso anchor and the existing
  comfort band (0.45–1.4 m). Smallest responsible layer: constructor defaults + one anchor-local
  transform fix.
- C2 (dashboard consolidation) offers the most uniform survey model but collapses the
  transient-work-surface / dashboard distinction, forces every occasional panel into the
  180° wall at r=1.35 (weaker focus differentiation), and is a Gate F-sized research-treatment
  change. Not justified by current evidence.

**Independent finding F1 (bug):** `MiniOverview`/`PeerPresenceHUD` are re-parented into the
torso anchor (y ≈ 1.35) with anchor-local positions whose own y is 1.35 → they render at
≈2.7 m, above the analyst's head (`MiniOverview.ts:50-76`,
`PeerPresenceHUD` constructed equivalently in `WorldUIManager.ts:222-228`). C1's near tier
requires fixing this to `[±0.55, 1.3, -0.6]` *world* within the anchor frame (anchor-local
`[±0.55, -0.05, -0.6]`).

**Runtime wiring (C1 tiers, world coords in the torso-anchor frame):**

| Tier | Distance | Contents |
|---|---|---|
| Near (0.45–0.8 m) | wheel/menu/HUDs | HandWheel (unchanged, body-space `[0,-0.1,-0.42]`); MiniOverview `[0.55,1.3,-0.6]`; PeerPresenceHUD `[-0.55,1.3,-0.6]`; InteractionCoach `[0,1.15,-0.75]` |
| Mid (0.9–1.4 m, ±45° fan at r=1.15, 15° slots) | primary work | VRConsole `[0,1.5,-1.15]` center; VRMenu −45°; NetworkPanel −30°; OperationLogPanel −15°; SettingsPanel +15°; TelemetryPanel +30°; InputTelemetry +45°; lower strip r=1.0 y=1.15: NarrativeStrip 0°, PerformancePanel −20°, RecommendationPanel +20° |
| Far (r=1.6, ±50°) | occasional reference | LoadTestPanel −50°; SchemaMappingPanel −25°; MonetaDiagnosticHUD 0°; MonetaExplainerPanel +25°; GestureConfidenceHUD +50° |
| Behind | wall | ChartPlanePanel unchanged `[0,1.6,1.5]` |

## 6. Prototype evidence

Blender 5.2 LTS reference scene (skill §22: rig, hands, gaze, 0.45–2.0 m distance rings,
0.45–1.4 m comfort envelope, ±30° focus wedge, data-artefact proxy, clutter wall): three spatial
stations, one per candidate, rendered head-level POV + oblique + side-by-side establishing shot.

- `assets/establishing_all.png` — C0 (left, with REF context), C1 (center), C2 (right)
- `assets/final_C0_obl.png` / `final_C0_pov.png` — current state: overlap stack on forward axis
- `assets/final_C1_obl.png` / `final_C1_pov.png` — zoned tiers
- `assets/final_C2_obl.png` / `final_C2_pov.png` — consolidated dashboard arc
- `assets/nemosyne_panel_layout_c1.glb` — origin-centered GLB of the selected C1 layout
  (planes + rings + torso stand-in; metric scale, +Y-up export)

Evidence tier: spatial prototype (skill §23 tier 4). Not a substitute for Quest 3S device
validation, which remains blocking per ROADMAP.

## 7. Risks

- **Gate F (research validity):** spatial arrangement is part of treatment; runtime change needs research review before merge.
- **Gate D (state authority):** reviving the fan must not create a second position authority alongside free-floating drag; fan = defaults only, drag/serialization stays authoritative.
- Device validation (Quest 3S) remains blocking per ROADMAP; this is spatial-prototype evidence (tier 4), not device evidence (tier 1).

# B-V1 — Visual System Convergence

**Date:** 2026-08-29
**Stream:** B (Product UX) — Visual system convergence
**Base expectation:** `main` after #555 (B-U2 merged) and #556 (S2 merged)
**Status:** PLANNED — pre-implementation adversarial contract

## Purpose

P1-UV4 requires the shared UI implementation to produce a **deliberate, sparse visual language**: one system, not a substrate mosaic. The current implementation mixes at least four mechanically distinct substrate generations (Three.js world primitives / MovablePanel canvas-terminal / ad-hoc canvas planes / UIKit SpatialPanel / DOM terminal) with two conflicting token sets (`palette.ts` vs `tokens.ts`), and the data is still surrounded by instrumentation rather than dominant.

This checkpoint freezes a versioned token set, migrates all surfaces to it, standardises chrome/affordances, and enforces restrained emissive/material rules so state/affordance are visible without decorative neon instrumentation.

## Current state (verified on main 2ea6ddf)

| Substrate | Surfaces | Token source | Chrome/affordance |
|---|---|---|---|
| Three.js world primitives | DatumPlane, TechnoCore, IceVault, portals, palace, TDA glyphs | inline hex / `PALETTE` | wireframe/glow, no chrome |
| MovablePanel canvas | VaultPanel, RecommendationPanel, MonetaDiagnosticHUD, VRConsole, InputTelemetry, ChartPlane, VRMenu, Telemetry/Performance/Network/OperationLog/LoadTest/Coach/Narrative/GestureConfidenceHUD | `PALETTE` (src/vr/palette.ts) | beveled metal chassis + permanent grab-handle + status LED + minimise `—` + title bar (`MovablePanel.ts:368-380`) |
| ad-hoc canvas planes | MiniOverview, PeerPresenceHUD | inline `rgba(...)` | flat quad, `depthTest:false` |
| UIKit SpatialPanel | Settings, SchemaMapping, HolographicInspector, ContextualTaskSurface, StatusStripPanel, EmbodimentStatusNotice | `tokens.ts` (COLOR_TOKENS, SPACING_TOKENS, TYPOGRAPHY_TOKENS, DEPTH_TOKENS) | 1.5px flat border, 16px radius, PIN/CLOSE buttons (`PanelChrome`) |
| DOM terminal | overlay, telemetry, loader, analyst controls, VR button | inline hex `#00ffcc` | 1-2px neon border |

**Token conflict:** `palette.ts` (accent `0x00ffcc`, panelBg `0x0b1626`, border `0x00ccaa`) vs `tokens.ts` (accent `0x59d6ff`, surface.base `0x0b1119`, border `0x263544`). Both claim to be the canonical runtime set; `palette.ts` comment admits "Convergence with the docs design-system tokens is a separate Sprint 22.3 task."

**Panel chrome inconsistency:**
- MovablePanel: permanent heavy chrome (title bar + `—` minimise + beveled chassis + grab-handle cylinder + status LED always rendered)
- SpatialPanel: grab rail initially hidden (`visible=false`), only Inspector calls `setGrabRailVisible(true)`; PIN/CLOSE always rendered (not hover-gated)
- Neither meets "movable surfaces visibly movable without permanent heavy chrome" / "minimal chrome appears on hover/proximity"

**Boot state:** ≥6 persistent HUD surfaces visible at fresh boot, including MonetaDiagnosticHUD dead-centre in the reserved data cone (violating `panelLayout.ts:16-17` "forward center cone reserved for data").

## Pre-implementation adversarial contract

### 1. Invariant

After B-V1:
- A **single versioned token set** (`tokens.ts` as the canonical runtime source; `PALETTE` deprecated/aliased) drives ALL surfaces — MovablePanel, SpatialPanel, ad-hoc planes, world landmarks, DOM.
- All migrated surfaces **visibly belong to one system**: same border radius, border width, colour palette, spacing scale, typography hierarchy, depth/shadow model.
- Data remains visually salient: no persistent decorative object without a tested function; no neon garnish competing with data marks; diagnostic HUDs demoted/opt-in (B-U2 already hides at boot).
- Movable surfaces are **visibly movable without permanent heavy chrome**: grab rail on hover/proximity, pin/follow/close appear on proximity, no permanent title bar/minimise chrome.
- Emissive/glow/material rules are **restrained**: state/affordance visible, no "neon instrumentation" competing with data marks.
- Accessibility modes (high-contrast, large-text, colour-vision, reduced-motion) preserve hierarchy, not merely swap CSS values.

### 2. Authority and production path

- `tokens.ts` (`src/vr/ui-system/tokens.ts`) is the **single canonical token set** for all new work. `PALETTE` (`src/vr/palette.ts`) is deprecated; existing consumers migrate to `tokens.ts` or are aliased during transition.
- `SpatialPanel`/`PanelChrome` is the reference implementation; `MovablePanel` and ad-hoc planes migrate to it or are deleted.
- `WorldTheme`/`DatumPlane`/landmarks consume tokens for emissive/grid colours; no inline hex.
- `MovablePanel` either migrates to `SpatialPanel` substrate or is deleted; no parallel chrome implementations persist.
- `WorldTheme` particle "glyph rain" and `DatumPlane` perpetual pulse removed/demoted (spec §9: "Calm by default").

### 3. Failure modes

- **Token drift:** `PALETTE` and `tokens.ts` diverge again because a surface is missed during migration, or a new inline hex is introduced.
- **Parallel chrome:** `MovablePanel` keeps its heavy permanent chrome while `SpatialPanel` has hover-gated chrome, creating two visibly different interaction grammars for "movable surface".
- **Token leakage:** a surface uses `PALETTE` directly instead of the canonical `tokens.ts`, creating silent drift.
- **Data salience loss:** neon garnish/particles/wireframes visually dominate the palace at boot.
- **Accessibility regression:** high-contrast/large-text/reduced-motion only restyle part of the UI (e.g. DOM but not VR, or SpatialPanel but not MovablePanel).
- **Version drift:** token set has no version field; a surface can silently use stale token names.

### 4. Falsifying evidence (cheapest authoritative checks)

- **Token set audit:** a test asserts that `grep -r "from.*palette" src/` (excluding `palette.ts` itself) returns zero matches — all consumers migrated to `tokens.ts` or deleted.
- **Visual regression:** the UV0 evidence job (instrumented build) captures the five canonical states; a diff against the B-V1 baseline shows unified chrome/borders/typography across Settings, Inspector, SchemaMapping, RecommendationPanel, VaultPanel, ContextualTaskSurface, StatusStripPanel, EmbodimentStatusNotice, and no surface uses inline hex for borders/backgrounds.
- **Chrome consistency:** a test asserts that `MovablePanel` either no longer exists or uses `PanelChrome`/`SpatialPanel` chrome; `SpatialPanel` grab rail is invisible until hover/proximity; PIN/CLOSE appear on proximity.
- **Boot salience:** the B-U2 UV0 evidence job re-runs and asserts the first frame has ≥3 fewer persistent HUD surfaces than B-U2 baseline (diagnostics hidden, particles/pulse removed).
- **Accessibility parity:** a test toggles high-contrast/large-text/reduced-motion and asserts the DOM `#analyst-journey-controls` AND all SpatialPanel/MovablePanel surfaces respond (no surface ignored).
- **Token version:** `tokens.ts` exports a `TOKEN_SET_VERSION` constant; a test asserts it is present and incremented.

### 5. Non-goals / dependencies

- NO new analytical math, no Rust/WASM/Atlas/Moneta changes.
- NO B-U2 journey work (merged #555) — reuse B-U2 seams (`StatusStripPanel`, `EmbodimentStatusNotice`, `VaultPanel`, `RecommendationPanel`, `_previewRemediation`).
- NO P1-UV5/UV6/UV7 work (state transitions, desktop parity, evidence gate) — those are subsequent checkpoints.
- NO Blender-assisted geometry unless it improves functional comprehension within Quest budgets (explicitly documented if used).
- NO `World.ts` refactor beyond the named seams (WorldTheme token migration, DatumPlane/particle removal).

## File ownership (draft)

| Surface | Files | Notes |
|---|---|---|
| Token canonicalisation | `tokens.ts` (freeze + version), `palette.ts` (deprecate/alias), all `import { PALETTE }` sites | Do not edit `ContextualTaskSurface.ts` (B5), `uv0TestHandle.ts` (B3) |
| MovablePanel → SpatialPanel migration | `MovablePanel.ts` (delete or migrate), `SpatialPanel.ts`, `PanelChrome.ts`, all consumers (`RecommendationPanel`, `VaultPanel`, `VRConsole`, `InputTelemetry`, `ChartPlane`, `VRMenu`, `Telemetry/Performance/Network/OperationLog/LoadTest/Coach/Narrative/GestureConfidenceHUD`, `MonetaDiagnosticHUD`, `DracoExplainerPanel`, `NetworkPanel`) | This is the largest surface area; must justify `World.ts` collision if `World.ts` constructs any of these |
| WorldTheme / landmarks | `WorldTheme.ts`, `DatumPlane.ts`, `TechnoCore`, `IceVault`, portals — migrate to tokens, remove pulse/particles | Collision-sensitive: justify `World.ts` touches |
| ad-hoc planes | `MiniOverview`, `PeerPresenceHUD` — migrate to tokens + SpatialPanel or remove | |
| DOM terminal | `index.html` inline styles → CSS variables driven by tokens (or shared CSS module) | |
| Accessibility modes | `SettingsPanel` (applies tokens), `SpatialPanel` (already reads tokens), `MovablePanel` (migrate) | |
| Versioning | `tokens.ts` exports `TOKEN_SET_VERSION`; test asserts increment | |

## Stream-rail collisions

- `World.ts` is collision-sensitive: only touch `WorldTheme` token migration, `DatumPlane`/particle removal, and token imports. Justify in PR.
- `package.json`/`vite.config.ts`/`docs/ROADMAP.md` untouched.
- One open Stream B PR: B-V1 runs after B-U2 merge; B-U2 (#555) merged, S2 (#556) mergeable. B-V1 is the next B checkpoint.

## Exit gate

B-V1 is complete when: the instrumented UV0 evidence job shows a unified visual language across all precision surfaces (Settings, Inspector, SchemaMapping, Evidence/History, RecommendationPanel, VaultPanel, ContextualTaskSurface, StatusStripPanel, EmbodimentStatusNotice) — same border radius, border width, colour palette, spacing, typography; no surface uses `PALETTE` or inline hex for chrome; MovablePanel surfaces migrated/deleted; grab rail visible on hover only; no perpetual pulse/particles; accessibility modes respond across all surfaces; data is visually dominant at boot. Then B-V2 (desktop parity) and P1-UV7 (evidence gate) follow.
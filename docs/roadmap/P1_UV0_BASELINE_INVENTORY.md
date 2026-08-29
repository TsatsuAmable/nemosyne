# P1-UV0 — Canonical visible-product baseline inventory

**Status:** B3 checkpoint (evidence/inventory only — this document changes no product treatment)
**Base:** `81ec16b` (B1 #531, B2 #535 merged)
**Machine-readable source of truth:** `src/validation/uv0-inventory.ts` (dependency-free; pinned by `tests/uv0-baseline-inventory.test.ts`)
**Run-linked evidence:** `tests/smoke/p1-uv0-baseline.spec.ts` writes screenshots + `run-inventory.json` to `tests/smoke/artifacts/uv0-baseline/` (gitignored)
**Classification basis:** `docs/Nemosyne_VR_UI_Design_System_and_Agent_Spec.md` §16 panel-role table + what is actually visible in the built production app at boot/state (verified against constructor defaults at authoring time)

> Guardrail (docs/ROADMAP.md B3): this checkpoint captures evidence and inventory. It does **not** restyle, re-layout, hide, or move panels. Do not call substrate migration a visible improvement.

## What the baseline proves

`tests/smoke/p1-uv0-baseline.spec.ts` boots the production `dist/` in real headless Chromium and captures five canonical investigation states with **hard state assertions** (screenshots are evidence artifacts, not the gate):

| # | State | Asserted evidence | Screenshot |
|---|---|---|---|
| S1 | Fresh boot / loaded representation (`World` constructor auto-loads `supply-chain`) | telemetry per-frame form `LAYOUT:`/`GEOM:`/`BEHAVIOR:`; status `Ready`; dataset `Supply Chain Hierarchy`; palace built | `01-fresh-boot.png` |
| S2 | Focused observation / structure (node selected) | contextual task surface visible; inspector visible after Inspect verb | `02-focused-observation.png` |
| S3 | Moneta decision / NIL (`#analyst-max-elements=1` + assess) | outcome `NIL: no feasible representation`; `NIL outcome recorded`; session `nilCount ≥ 1` | `03-nil.png` |
| S4 | Evidence / hypothesis state (analysis + mark-moment) | `Evidence ready`; `Observation recorded`; authoritative ledger `evidenceCount > 0`, `observationCount ≥ 1` | `04-evidence.png` |
| S5 | Saved / replay state (export `.nemosyne` + replay) | `Investigation exported`; `Replay verified` (or recorded `kernel-unavailable` where no analytical kernel exists) | `05-replay.png` |

Run inventory JSON links every screenshot to its asserted state and to the inventory ids below, so B4/B5 can diff the baseline mechanically.

## Normal-mode visible surface/object inventory

Every persistent surface/object in normal analyst mode (as visible at `81ec16b`), with reference frame, summon/dismiss path, owning semantic state, and `KEEP / CONVERGE / DEMOTE / REPLACE / REMOVE` classification.

| id | Surface | Purpose | Ref. frame | Summon / dismiss | Owning state | Class. | Rationale |
|---|---|---|---|---|---|---|---|
| `datum-plane` | DatumPlane | Ground reference plane anchoring the palace | WORLD | Always at boot; not dismissible | World origin / datum | **KEEP** | Neutral spatial orientation, not chrome |
| `techno-core` | TechnoCoreNode | Lens hub landmark | WORLD | Always at boot; select to cycle lens | Representation decision / lens | **CONVERGE** | §16/P1-UV3: decorative hub today; must expose decision state |
| `ice-vault` | IceVaultNode | Cold-storage evidence-vault landmark | WORLD | Always at boot; VaultPanel via wheel/launcher | Evidence archive / freeze-restore | **CONVERGE** | §16/P1-UV3: remove/demote unless archive-recovery is production-usable |
| `farcaster-portal-a` | FarcasterPortal A (DEEP_NET) | Semantic travel portal | WORLD | Always at boot; walk through | Semantic destination | **CONVERGE** | §16/P1-UV3: destination semantics must be visible before traversal |
| `farcaster-portal-b` | FarcasterPortal B (LOCAL_MATRIX / saved) | Semantic travel portal / archive restore | WORLD | Always at boot; walk through | Saved-investigation / return | **CONVERGE** | §16/P1-UV3: return semantics must be visible |
| `moneta-palace` | MonetaTopologyNode (data palace) | Embodied representation of the dataset | WORLD | Built per load; always present | Representation decision + dataset identity | **KEEP** | The data IS the protagonist |
| `moneta-diagnostic-hud` | MonetaDiagnosticHUD (alias DracoDiagnosticHUD) | Moneta constraint-solver diagnostic | BODY | Built per palace at boot; superuser Dev Lab toggle | Solver candidate/cost state | **DEMOTE** | §16: developer diagnostic — but visible at boot today (finding) |
| `input-telemetry` | InputTelemetry panel | Live WebXR input debug | BODY | Visible at boot; launcher/panel toggle | Input subsystem debug | **DEMOTE** | §16: developer-only diagnostic; visible at boot |
| `vr-console` | VRConsole | In-VR console/log mirror | BODY | Visible at boot; launcher/panel toggle | Runtime log stream | **DEMOTE** | §16: developer-only diagnostic; visible at boot |
| `mini-overview` | MiniOverview | Palace + frustum mini-map | BODY | Visible at boot; setting toggle | Spatial orientation | **KEEP** | §16: optional orientation instrument, subdued |
| `peer-presence-hud` | PeerPresenceHUD | Collaborator presence dots | BODY | Visible at boot; setting toggle | Collaboration presence | **DEMOTE** | §16: optional ornament; demote to opt-in |
| `dashboard-wall` | DashboardManager | Semicircle panel wall behind user | BODY | Visible at boot; launcher toggle | Dashboard reference state | **REMOVE** | §16: remove as default "panel wall" |
| `chart-plane` | ChartPlanePanel | Correlation / time-series / distribution charts in the wall | BODY | Visible at boot in wall; hidden when lens off | Derived analytical summaries | **CONVERGE** | Analytical content belongs at the locus of work, not a behind-user wall |
| `tda-planes` | TDAPlanes (statistical lens) | Statistical-lens overlays on the palace | WORLD | Hidden at boot; statistical-lens intent/setting | Statistical-lens state | **KEEP** | Data-derived overlay gated behind a lens |
| `holographic-inspector` | HolographicInspector | Precision inspector for the selected node | BODY | Hidden at boot; node select → Inspect | Selection + node inspection | **KEEP** | §16: canonical inspector/context surface |
| `contextual-task-surface` | ContextualTaskSurface | Node-attached verb surface (Inspect/Compare/Challenge/Record/Navigate/More) | BODY | Hidden at boot; shown at selected node | Selection context / intents | **KEEP** | P1-UV2 canonical locus-of-work surface |
| `hand-wheel-menu` | HandWheelMenu (intent wheel) | Hand-attached radial command wheel | HAND | Hidden at boot; pinch / M / launcher | Intent/category navigation | **CONVERGE** | Frozen command surface = wheel v1; converge vocabulary to verbs |
| `legacy-vr-menu` | VRMenu (legacy menu) | Legacy operation/dataset menu | BODY | Hidden at boot (retired per P1-U8); superuser ring | Legacy navigation | **REMOVE** | §16: retired as primary navigation |
| `analyst-journey-controls` | AnalystJourneyControls (`#analyst-journey-controls`) | Desktop DOM journey controls (load/assess/run/mark/export/replay) | DOM | Always mounted bottom-right | Journey status/outcome | **REPLACE** | P1-UV6: raw engineering controls are the primary desktop surface today |
| `dom-telemetry` | `#telemetry` | Legacy 2D per-frame status line | DOM | Always present | Runtime/kernel readiness | **DEMOTE** | P1-UV1: readiness without a telemetry wall |
| `boot-overlay` | `#overlay` | Static "NEMOSYNE // SPATIAL DATA SUITE" heading | DOM | Always present; never hidden | Boot identity | **DEMOTE** | Splash must yield to the data after boot (finding) |
| `nemosyne-loader` | `#nemosyne-loader` (FileLoaderUI) | Dataset import / schema-mapping loader | DOM | Created at boot top-right | Dataset import + schema | **CONVERGE** | Load is a first-class task; must not be a raw debug dropdown (finding) |
| `nemosyne-vr-button` | `#nemosyne-vr-button` | VR session entry affordance | DOM | Always present | XR session availability | **KEEP** | Essential VR entry affordance |

**Not visible (planned-absent):** Memory Palace is **not** a visible VR object at this base (graph machinery exists; no persistent embodiment). It is deliberately excluded from the inventory rather than silently implied.

**Naming finding:** `MonetaDiagnosticHUD` is imported into `World.ts` under the alias `DracoDiagnosticHUD` (`src/vr/World.ts:6-7`) and there is **one** diagnostic HUD per palace, not two. The inventory lists it once (`moneta-diagnostic-hud`).

## Fresh-start / first-insight path

`launch → (World constructor auto-loads supply-chain palace + DatumPlane + TechnoCore + IceVault + portals + HUD constellation) → first frame rendered → user reads #telemetry / journey controls → #analyst-load-sample → assess representation → inspect a node (ray/click) → ContextualTaskSurface → Inspect → HolographicInspector → record observation → export/replay`

The minimum desktop path to a first *meaningful* inspection action (`launch → select a node → inspector`) requires: boot → orient in a scene dominated by the dashboard wall, two portals, the diagnostic HUD, telemetry panels, and the loader — then find a data node, select it, and choose **Inspect** on the node-attached verb surface. Nothing at first glance says "this is the dataset; here is the next useful action".

## Obvious subsystem/panel-first friction (observed, unchanged)

1. **Fresh boot is not dataset-first.** The first visual impression is the HUD constellation (dashboard wall, two diagnostic HUD panels, InputTelemetry, VRConsole, MonetaDiagnosticHUD) plus a loader, journey controls and a static splash — the palace is one object among many. P1-UV1 (B4) must make the dataset/workspace and next task the primary first-choice surface.
2. **Five diagnostics visible in normal analyst mode.** `moneta-diagnostic-hud`, `input-telemetry`, `vr-console`, `dom-telemetry` and the loader's debug chrome are all visible at boot; §16 marks all as developer-only. This is the single largest visible-product debt the baseline records.
3. **`#overlay` never hides.** The static "NEMOSYNE // SPATIAL DATA SUITE" heading stays over the live scene for the whole session.
4. **`AnalystJourneyControls` is the primary desktop surface.** The journey's verbs are reachable only through this raw DOM panel; there is no desktop shell that looks like a product.
5. **Dashboard wall behind the user.** `DashboardManager` + `ChartPlane` cells reconstruct a floating desktop (§16: remove as default wall).
6. **Inspect is a discoverable-but-late action.** The node-attached verb surface only appears after selecting a node; the first meaningful action requires the user to already know to select data.
7. **Representation outcome is "pending" at boot.** The dataset is auto-loaded but the Moneta outcome panel shows `Moneta outcome: pending` until the user presses Assess — the loaded representation's state is not surfaced at boot.

## How to read this document going forward

- **B4 (task-first shell):** must move `analyst-journey-controls` (`REPLACE`) and demote the boot-visible diagnostics; any visible-product change updates `src/validation/uv0-inventory.ts` **and** the pinned expected set in `tests/uv0-baseline-inventory.test.ts` in the same PR.
- **B5 (contextual locus-of-work):** must make `inspect/compare/challenge/record/navigate/more` originate visibly from the selection; the `contextual-task-surface` / `holographic-inspector` entries are the baseline for that work.
- Screenshots from later tranches compare against `tests/smoke/artifacts/uv0-baseline/`.
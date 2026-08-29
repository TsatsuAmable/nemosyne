# P1-UV0 — Canonical visible-product baseline inventory

**Status:** B3 checkpoint plus independent-review fix-forward (evidence/inventory only — no product treatment change)
**Original B3 base:** `81ec16b` (B1 #531, B2 #535 merged)
**Machine-readable source of truth:** `src/validation/uv0-inventory.ts` (dependency-free; pinned and source-audited by `tests/uv0-baseline-inventory.test.ts`)
**Run-linked evidence:** the dedicated `P1-UV0 baseline evidence` CI job builds an explicitly instrumented bundle, runs `tests/smoke/p1-uv0-baseline.spec.ts`, requires five non-empty screenshots, writes a source-SHA-linked `run-inventory.json`, and uploads the directory as a retained workflow artifact.
**Production negative proof:** the ordinary `Production build` job fails if `dist/` contains `__NEMOSYNE_UV0__` or `nemosyne-uv0`; the test handle is therefore not part of the normal production artifact.
**Classification basis:** `docs/Nemosyne_VR_UI_Design_System_and_Agent_Spec.md` §16 panel-role table + actual built-product state.

> Guardrail (docs/ROADMAP.md B3): this checkpoint captures evidence and inventory. It does **not** restyle, re-layout, hide, or move panels. Do not call substrate migration a visible improvement.

## What the baseline proves

The dedicated instrumented UV0 evidence build captures five canonical investigation states with **hard state assertions and hard screenshot existence/size assertions**. Pixel equality is intentionally not a gate, but a missing/empty screenshot now fails the job.

| # | State | Asserted evidence | Screenshot |
|---|---|---|---|
| S1 | Fresh boot / loaded representation (`World` constructor auto-loads `supply-chain`) | telemetry per-frame form `LAYOUT:`/`GEOM:`/`BEHAVIOR:`; status `Ready`; dataset `Supply Chain Hierarchy`; palace built; boot-visible `SettingsPanel` observed | `01-fresh-boot.png` |
| S2 | Focused observation / structure (node selected) | contextual task surface visible; inspector visible after Inspect verb | `02-focused-observation.png` |
| S3 | Moneta decision / NIL (`#analyst-max-elements=1` + assess) | outcome `NIL: no feasible representation`; `NIL outcome recorded`; session `nilCount ≥ 1` | `03-nil.png` |
| S4 | Evidence / hypothesis state (analysis + mark-moment) | `Evidence ready`; `Observation recorded`; authoritative ledger `evidenceCount > 0`, `observationCount ≥ 1` | `04-evidence.png` |
| S5 | Saved / replay state (export `.nemosyne` + replay) | `Investigation exported`; `Replay verified` (or recorded `kernel-unavailable` where no analytical kernel exists) | `05-replay.png` |

`run-inventory.json` schema v2 records `testedSourceSha`, the CI merge SHA when present, capture time, viewport, kernel availability, every asserted state, screenshot byte counts and the inventory snapshot. This replaces the original misleading hardcoded `baseSha` field.

## Baseline scope

The machine inventory covers:

1. every surface/object known to be visible at fresh boot in normal analyst mode; and
2. hidden interaction surfaces exercised by the canonical B3 journey (for example the contextual task surface, inspector, intent wheel and retired legacy menu).

It is **not** an exhaustive catalogue of every developer-only diagnostic or every hidden task panel in the application. To stop the inventory and its expected-id list merely agreeing with each other, the fast test independently parses the `WorldUIManager` constructor and requires every eagerly constructed UI surface to be either mapped to a baseline id or carry an explicit exclusion reason.

## Normal-mode baseline surface/object inventory

| id | Surface | Purpose | Ref. frame | Summon / dismiss | Owning state | Class. | Rationale |
|---|---|---|---|---|---|---|---|
| `datum-plane` | DatumPlane | Ground reference plane anchoring the palace | WORLD | Always at boot; not dismissible | World origin / datum | **KEEP** | Neutral spatial orientation, not chrome |
| `techno-core` | TechnoCoreNode | Lens hub landmark | WORLD | Always at boot; select to cycle lens | Representation decision / lens | **CONVERGE** | §16/P1-UV3: decorative hub today; must expose decision state |
| `ice-vault` | IceVaultNode | Cold-storage evidence-vault landmark | WORLD | Always at boot; VaultPanel via wheel/launcher | Evidence archive / freeze-restore | **CONVERGE** | §16/P1-UV3: remove/demote unless archive-recovery is production-usable |
| `farcaster-portal-a` | FarcasterPortal A (DEEP_NET) | Semantic travel portal | WORLD | Always at boot; walk through | Semantic destination | **CONVERGE** | §16/P1-UV3: destination semantics must be visible before traversal |
| `farcaster-portal-b` | FarcasterPortal B (LOCAL_MATRIX / saved) | Semantic travel portal / archive restore | WORLD | Always at boot; walk through | Saved-investigation / return | **CONVERGE** | §16/P1-UV3: return semantics must be visible |
| `moneta-palace` | MonetaTopologyNode (data palace) | Embodied representation of the dataset | WORLD | Built per load; always present | Representation decision + dataset identity | **KEEP** | The data IS the protagonist |
| `moneta-diagnostic-hud` | MonetaDiagnosticHUD (alias DracoDiagnosticHUD) | Moneta constraint-solver diagnostic | BODY | Built per palace at boot; superuser Dev Lab toggle | Solver candidate/cost state | **DEMOTE** | §16: developer diagnostic — but visible at boot today |
| `input-telemetry` | InputTelemetry panel | Live WebXR input debug | BODY | Visible at boot; launcher/panel toggle | Input subsystem debug | **DEMOTE** | §16: developer-only diagnostic; visible at boot |
| `vr-console` | VRConsole | In-VR console/log mirror | BODY | Visible at boot; launcher/panel toggle | Runtime log stream | **DEMOTE** | §16: developer-only diagnostic; visible at boot |
| `mini-overview` | MiniOverview | Palace + frustum mini-map | BODY | Visible at boot; setting toggle | Spatial orientation | **KEEP** | §16: optional orientation instrument, subdued |
| `peer-presence-hud` | PeerPresenceHUD | Collaborator presence dots | BODY | Visible at boot; setting toggle | Collaboration presence | **DEMOTE** | §16: optional ornament; demote to opt-in |
| `dashboard-wall` | DashboardManager | Semicircle panel wall behind user | BODY | Visible at boot; launcher toggle | Dashboard reference state | **REMOVE** | §16: remove as default "panel wall" |
| `settings-panel` | SettingsPanel | Spatial comfort/accessibility/collaboration/settings controls | BODY | Eagerly constructed and attached; no boot-time hide | System settings | **CONVERGE** | Independent review found this boot-visible panel missing from the original B3 inventory |
| `chart-plane` | ChartPlanePanel | Correlation / time-series / distribution charts in the wall | BODY | Visible at boot in wall; hidden when lens off | Derived analytical summaries | **CONVERGE** | Analytical content belongs at the locus of work, not a behind-user wall |
| `tda-planes` | TDAPlanes (statistical lens) | Statistical-lens overlays on the palace | WORLD | Hidden at boot; statistical-lens intent/setting | Statistical-lens state | **KEEP** | Data-derived overlay gated behind a lens |
| `holographic-inspector` | HolographicInspector | Precision inspector for the selected node | BODY | Hidden at boot; node select → Inspect | Selection + node inspection | **KEEP** | §16: canonical inspector/context surface |
| `contextual-task-surface` | ContextualTaskSurface | Node-attached verb surface (Inspect/Compare/Challenge/Record/Navigate/More) | BODY | Hidden at boot; shown at selected node | Selection context / intents | **KEEP** | P1-UV2 canonical locus-of-work surface |
| `hand-wheel-menu` | HandWheelMenu (intent wheel) | Hand-attached radial command wheel | HAND | Hidden at boot; pinch / M / launcher | Intent/category navigation | **CONVERGE** | Frozen command surface = wheel v1; converge vocabulary to verbs |
| `legacy-vr-menu` | VRMenu (legacy menu) | Legacy operation/dataset menu | BODY | Hidden at boot (retired per P1-U8); superuser ring | Legacy navigation | **REMOVE** | §16: retired as primary navigation |
| `analyst-journey-controls` | AnalystJourneyControls (`#analyst-journey-controls`) | Desktop DOM journey controls (load/assess/run/mark/export/replay) | DOM | Always mounted bottom-right | Journey status/outcome | **REPLACE** | P1-UV6: raw engineering controls are the primary desktop surface today |
| `dom-telemetry` | `#telemetry` | Legacy 2D per-frame status line | DOM | Always present | Runtime/kernel readiness | **DEMOTE** | P1-UV1: readiness without a telemetry wall |
| `boot-overlay` | `#overlay` | Static "NEMOSYNE // SPATIAL DATA SUITE" heading | DOM | Always present; never hidden | Boot identity | **DEMOTE** | Splash must yield to the data after boot |
| `nemosyne-loader` | `#nemosyne-loader` (FileLoaderUI) | Dataset import / schema-mapping loader | DOM | Created at boot top-right | Dataset import + schema | **CONVERGE** | Load is a first-class task; must not be a raw debug dropdown |
| `nemosyne-vr-button` | `#nemosyne-vr-button` | VR session entry affordance | DOM | Always present | XR session availability | **KEEP** | Essential VR entry affordance |

**Explicitly outside this bounded baseline:** diagnostic-role panels hidden in ANALYST mode (`metricsPanel`, `performancePanel`, `networkPanel`) and hidden task panels not exercised by the canonical B3 journey (`recommendationPanel`, `dracoExplainerPanel`, `vaultPanel`). The source-audit test requires these exclusions to remain explicit if the constructor changes.

**Not visible (planned-absent):** Memory Palace is **not** a visible VR object at this checkpoint (graph machinery exists; no persistent embodiment). It is deliberately excluded rather than silently implied.

## Fresh-start / first-insight path

`launch → (World constructor auto-loads supply-chain palace + DatumPlane + TechnoCore + IceVault + portals + boot-visible HUD/panel constellation) → first frame rendered → user reads #telemetry / journey controls → #analyst-load-sample → assess representation → inspect a node → ContextualTaskSurface → Inspect → HolographicInspector → record observation → export/replay`

The minimum desktop path to a first meaningful inspection action (`launch → select a node → inspector`) still requires orienting through a scene crowded by the dashboard wall, portals, diagnostics, SettingsPanel, loader, journey controls and static splash before finding the data and the contextual action.

## Obvious subsystem/panel-first friction (observed, unchanged)

1. **Fresh boot is not dataset-first.** The first visual impression is the HUD/panel constellation plus loader, journey controls and splash; the palace is one object among many.
2. **Boot-time diagnostic debt remains large.** `moneta-diagnostic-hud`, `input-telemetry`, `vr-console` and `dom-telemetry` remain visible in the normal journey, while the loader also exposes engineering-like chrome.
3. **SettingsPanel is also boot-visible.** The independent B3 review caught this omission. B4 should decide whether settings need to be summoned/contextual rather than persistently present.
4. **`#overlay` never hides.** The static heading remains over the live scene.
5. **`AnalystJourneyControls` is the primary desktop surface.** There is no deliberate desktop product shell yet.
6. **Dashboard wall behind the user.** `DashboardManager` + `ChartPlane` cells reconstruct a floating desktop.
7. **Inspect is a discoverable-but-late action.** The task surface appears only after node selection.
8. **Representation outcome is pending at boot.** The loaded representation state is not surfaced until Assess is invoked.

## How to read this document going forward

- **B4 (task-first shell):** must replace/demote the boot-time engineering surfaces based on this corrected baseline. Any visible-product change updates `src/validation/uv0-inventory.ts` and the hardcoded expected set in `tests/uv0-baseline-inventory.test.ts` in the same PR.
- **B5 (contextual locus-of-work):** must make `inspect/compare/challenge/record/navigate/more` originate visibly from the selection; the `contextual-task-surface` / `holographic-inspector` entries remain the baseline.
- Later tranches compare against the retained `p1-uv0-baseline-evidence` workflow artifact, whose manifest identifies the exact tested source SHA.

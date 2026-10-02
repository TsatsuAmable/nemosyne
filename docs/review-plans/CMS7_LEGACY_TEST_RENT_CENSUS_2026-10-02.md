# CMS-7 — legacy-test rent census

**Date:** 2 October 2026
**Base:** `main@87502f7d657e2af6f8ebf7e40c5cb39ffa6d97e6` (#890, CMS-2 FlatBuffers retirement merge), branch `census/cms7-legacy-test-rent`
**Mode:** READ-ONLY ANALYSIS + docs deliverable only. No production code, test, or config file was modified. `docs/ROADMAP.md` left untouched for the landing agent.
**Sprint:** CMS-7 "legacy-test rent census" (`docs/ROADMAP.md`, "Claude parallel maintenance sprints"): inventory tests whose **primary purpose** is preserving development-only, compatibility-only or explicitly superseded code; classify each as `PROTECT`, `MIGRATE`, `DELETE_WITH_SURFACE`, or `RESEARCH_FIXTURE`; measure approximate CI/test volume without recommending deletion for speed.
**Machine-readable mirror:** `docs/review-plans/cms7_legacy_test_rent_census.json` (validate with `node -e "JSON.parse(require('fs').readFileSync(...))"`).

## 1. Method (and its limits)

1. **Topology read:** `tests/config/test-groups.ts` (`FAST_NODE_TESTS`, `UI_ONLY_TESTS`, `WASM_TESTS`), `vitest.fast.config.ts`, `vitest.wasm.config.ts`, `vitest.config.ts` (integration lane globs the default vitest include minus the three lists, `tests/smoke` and `tests/collaboration-browser`), `vitest.ui.config.ts` via `package.json` (`test`, `test:fast`, `test:ui`, `test:integration`, `test:wasm`, `test:e2e*`, `test:smoke`).
2. **Approximate per-file test counts:** `git ls-files` over `tests/` (634 files matching `*.test.ts`/`*.spec.ts`), counting occurrences of `(?<![.\w])(it|test)\(` per file (`it.each(`/`test.each(` recorded separately). This is a cheap occurrence count, not a vitest run result: it includes nested/helper `it(` call sites and misses parameterised expansion counts, so numbers are labelled **approx** throughout.
3. **Production reachability evidence (approximate, automated + spot-verified):** a static import graph over `git ls-files src dev scripts`, BFS from four entry roots — `src/main.ts` (browser bundle, per `index.html`), `src/network/SignallingServer.mjs` (`npm run start:signalling`), `src/governance-service/server-entry.ts` (documented service entry), `src/atlas/ports/analytical.worker.ts` (worker entry via `new Worker(new URL(...))`). The resolver matches `from '...'`, literal `import('...')`, side-effect `import '...'` and `new URL('...', import.meta.url)` forms, with `.ts/.tsx/.js/.mjs//index` resolution. **Limits:** type-only imports are counted as edges; barrels re-exporting test-only modules distort chains; node-side entries referenced only by docs (e.g. `src/network/server.ts`) are not script roots. Every claim below that drives a classification was additionally spot-verified with direct `grep` of the named module/value, and all four categories of doubt above are flagged inline.
4. **Keyword sweep:** case-insensitive `legacy|deprecated|compat|shim|alias|superseded|backward` over all test files (126 candidate files), reading each match line and following the file's actual imports; most hits turned out to be **fail-closed guards against legacy input** or negative assertions that legacy substrates are *not* used (both `PROTECT`), not rent.
5. **Registry cross-check:** every development-only capability in `governance/production-capabilities.json` (9 entries) mapped to its tests. Deep enumeration of src-side deprecated aliases/fallbacks is deliberately out of scope — that is ERA-AG4's task; this census only touches aliases that tests pin.

## 2. Test topology and approximate volume

Overall inventory: **634 test files, ~3,693 tests** (approx, method §1.2). Vitest lanes:

| Lane | Config | Files | ~Tests |
|---|---|---|---|
| fast-node | `vitest.fast.config.ts` (explicit list) | 63 | ~450 |
| real-wasm-boundary | `vitest.wasm.config.ts` (explicit list, 10 of these are e2e tier specs) | 54 | ~389 |
| ui-only | `vitest.ui.config.ts` (`UI_ONLY_TESTS`: adaptive-assist-controller, ai-gesture-jit-hints, asymmetric-desktop-companion) | 3 | ~13 |
| jsdom-integration | `vitest.config.ts` (globs everything else; ~30 e2e tier specs land here) | 493 | ~2,806 |
| playwright (excluded from all vitest lanes) | `playwright.config.ts` + `playwright.collaboration.config.ts` over `tests/smoke/` and `tests/collaboration-browser/` | 21 | ~35 |

`npm run test:e2e` re-invokes the integration and wasm lanes over `tests/e2e`, so tier specs are counted once in the lane table above. `tests/config/test-groups.ts` contains no dangling entries at this base (all listed paths exist; 12 apparent "dangling" entries were comment-text parsing artefacts of the extraction regex, verified harmlessly non-path).

## 3. Classified inventory (by surface)

Classification legend: `PROTECT` = protects production-reachable (or deliberately retained, registry-owned) behavior. `MIGRATE` = valuable invariant tied to a surface that should change; replacement invariant named. `DELETE_WITH_SURFACE` = exists only for code a cleanup package should delete; replacement invariant named or absence explained. `RESEARCH_FIXTURE` = fixture/data-generation test or dev-experiment harness with no production assertion.

### S1 — CMS-4: superseded `src/network/CollaborativeStateSync.ts`

**Reachability evidence:** zero src importers (only self-reference); `governance/production-capabilities.json` entry `legacy-collaborative-state-sync` (`development-only`): "Superseded by NetworkManager plus CollaborationCoordinator; retained only for legacy tests until deletion"; `forbiddenPublicExports` pins it out of the network barrel. CMS-1 (#889-era) already extracted the contract and pinned non-import.

| Test file | Lane | ~Tests | Class |
|---|---|---|---|
| `tests/collaborative-sync.test.ts` — imports only the synchronizer; 2 `its`, both construct `new CollaborativeStateSync` | integration | 2 | **DELETE_WITH_SURFACE** |
| `tests/zero-copy-network-sync.test.ts` — mixed: 10 `its` target the `BinaryPoseSerializer` wire contract directly (40-byte roundtrip, short/long buffer rejection, NaN/out-of-bound rejection, plus the `acceptsSequence` monotonic/duplicate/out-of-order/per-key gating falsifiers, which run on the serializer itself and already have a production home); 5 `its` construct `new CollaborativeStateSync` (8 `new CollaborativeStateSync` call sites across those 5) for peer-id derivation, peer-map and channel-binding fail-closed behavior | integration | 15 | **MIGRATE** |
| `tests/production-runtime-wiring.test.ts` — 6 `its`, only 1 (`sends binary pose streams via CollaborativeStateSync`, line 150) touches the surface | wasm | 6 | **MIGRATE** (1/6) |

- **Replacement invariant:**
  - Wire contract: the 7 serializer-level falsifiers survive unchanged — `BinaryPoseSerializer` is production-reachable (`src/network/NetworkManager.ts` imports it) and is also pinned by `tests/network.test.ts`, `tests/collaboration-embodied-presence.test.ts`, `tests/rf057-pose-identity.test.ts`, `tests/binary-pose-governor-binding.test.ts`.
  - Sequence/peer-binding: **verify before deletion** — the 5 class-instantiating `its` (channel-bound peer identity, no-untrusted-fallback fail-closed, out-of-order binary pose drop, numeric-ID mismatch refusal, peer-id derivation) currently instantiate the legacy class; CMS-4 must re-home them onto the production `NetworkManager`/`CollaborationCoordinator` binary path (or confirm the production path already implements the same gating) **before** removing `CollaborativeStateSync.ts`. Note the *monotonic-sequence* gating falsifiers do **not** instantiate the class — they run on `BinaryPoseSerializer.acceptsSequence`, which `NetworkManager.ts` calls directly (line 447), so they already live on the production path. Connection-recovery, avatar and coordination invariants already live elsewhere: `tests/collaboration-recovery.test.ts` (NetworkManager), `tests/cms1-collaboration-contract.test.ts` (avatar contract), `tests/coordinator-consumer-contracts.test.ts`, `tests/peer-presence-hud.test.ts`.
- Feeds CMS-4 directly: 3 files / ~23 tests, of which ~8 `its` touch the legacy surface by import (2 in `collaborative-sync` + 5 class-instantiating in `zero-copy-network-sync` + 1 in `production-runtime-wiring`); `collaborative-sync.test.ts` is fully retirable with the surface, one `zero-copy-network-sync.test.ts` describe block retires once the 5 falsifiers are re-homed, and 5 of 6 `production-runtime-wiring` `its` are surface-independent.

**Adjacent guard (`PROTECT`):** `tests/cms1-collaboration-contract.test.ts` (fast, 5) — pins no-src-import, barrel cleanliness and avatar-contract shape; keep until CMS-4 lands, then evaluate whether the no-import falsifier remains meaningful once the synchronizer is gone (it degenerates when the file is deleted with the surface).

### S2 — CMS-4: superseded `src/network/SharedAnnotationManager.ts` (network barrel)

**Reachability evidence:** zero src value importers (the canonical authority `src/vr/interactions/SharedAnnotationManager.ts` is what `src/vr/coordinators/CollaborationCoordinator.ts` and `src/vr/ui/AsymmetricDesktopCompanion.ts` import). Registry entry `legacy-network-shared-annotations` (`development-only`): "Superseded by the live VR interaction annotation authority; retained only for legacy tests until deletion."

| Test file | Lane | ~Tests | Class |
|---|---|---|---|
| `tests/peer-avatars-annotations.test.ts` — 2 `its`: 1 on `PeerAvatarManager` (production, exported by `src/network/index.ts`, consumed by `CollaborationCoordinator`), 1 on the legacy network annotation manager (`// @ts-nocheck` file) | integration | 2 | **MIGRATE** (split) |

- **Replacement invariant:** the avatar half is already covered shape-for-shape by `tests/cms1-collaboration-contract.test.ts` (the production literal-shape transform test) and `tests/peer-presence-hud.test.ts`; the annotation half needs nothing new — the canonical manager has a dedicated 12-test suite (`tests/shared-annotations.test.ts`, imports the `vr/interactions` authority) plus `tests/asymmetric-desktop-companion.test.ts` (ui lane).
- Canonical contrast (PROTECT, not rent): `tests/shared-annotations.test.ts` (integration, 12).

### S3 — FM4-UI-CLEAN: legacy `MovablePanel` canvas substrate

**Reachability evidence:** `grep -rln "from '.*MovablePanel"` over `src/` returns **zero** value importers; the only live references are `MovablePanelOptions` **interface** members (defined in `src/vr/coordinators/types.ts`) consumed as `import type` by ChartPlanePanel/DataSourcePanel/InteractionCoach/LoadTestPanel/NarrativeStrip/RecommendationPanel/ValidationOperatorPanel, and comments. `src/vr/ui/MovablePanel.ts` appears in the production-unreachable set. Roadmap FM4-UI-CLEAN explicitly schedules its retirement ("retires remaining legacy `MovablePanel` substrate where safe"). Downstream helper `src/vr/ui/CanvasTextureCacheManager.ts` is reachable **only** through `MovablePanel`.

**Test fixture caveats (both compile loudly if the class is deleted, so neither hides a deletion):** besides the table below, `tests/ui-system/webxr-simulator.test.ts` (S7 `RESEARCH_FIXTURE`, 14 `its`) also value-imports and constructs `MovablePanel` at line 164 — it must get its fixture re-hosted or retired in the same FM4-UI-CLEAN change even though its classification lives in S7; and the PROTECT-classified `tests/workspace-surface-manager.test.ts` builds its `TestPanel` fixture by `extends MovablePanel` — its anti-rent assertion ("adapts SpatialPanel-like surfaces … without MovablePanel lifecycle methods") survives, but the fixture must be re-hosted off the legacy class when the substrate dies.

| Test file | Lane | ~Tests | Class |
|---|---|---|---|
| `tests/movable-panel.test.ts` — tests only the legacy class | integration | 13 | **DELETE_WITH_SURFACE** |
| `tests/movable-panel-scrollbar.test.ts` — scrollbar affordance of the legacy class | integration | 6 | **DELETE_WITH_SURFACE** |
| `tests/canvas-texture-cache.test.ts` — tests a helper whose only import chain is the legacy class | integration | 3 | **DELETE_WITH_SURFACE** |
| `tests/dashboard-manager.test.ts` — `DashboardManager` is production-reachable (`src/vr/coordinators/WorldUIManager.ts`, `WorldRendererLifecycle.ts`); the MovablePanel import is substrate fixture use | integration | 21 | **MIGRATE** |
| `tests/free-3d-panel-orientation.test.ts` — orientation math invariant, substrate fixture | integration | 2 | **MIGRATE** |
| `tests/matrix-world-regression.test.ts` — 3 `its`: 1 MovablePanel drag crash regression, 1 DashboardManager crash regression, 1 HandWheel raycast guard (reachable) | integration | 3 | **MIGRATE** (regression claims must be re-pinned on the surviving surfaces) |
| `tests/layout-binding-panel-typing.test.ts` — `IPanelContentHandler` typing contract, `MovablePanel` used only as a `TestPanel` host | wasm | 3 | **MIGRATE** (re-host on a live panel) |
| `tests/workspace-surface-manager.test.ts` — asserts substrate-neutral lifecycle, explicitly including "adapts SpatialPanel-like surfaces … without MovablePanel lifecycle methods" | integration | 12 | **PROTECT** (anti-rent pin; keep) |
| `tests/zero-alloc-instanced-buffer.test.ts` — instanced-buffer allocation invariants plus a MovablePanel texture-cache bypass case | wasm | 5 | **MIGRATE** (allocation invariants survive; texture-cache case goes with the surface) |
| e2e `tier1 f10_panel_z_sorting.spec.ts` (5, integration), `tier2 f10_boundary.spec.ts` (5, integration), `tier3 suite_3_3_ui_headset_tracking.spec.ts` (2, integration), `tier4 scenario1_large_scale_analytics.spec.ts` (1, wasm), `tier4 scenario5_complete_analyst_journey.spec.ts` (1, wasm) — value-import `MovablePanel` inside wider journeys | mixed | 14 total | **MIGRATE** (journey coverage must survive under the SpatialPanel/UIKit surfaces; migrate at FM4-UI-CLEAN time) |

- **Replacement invariant:** panel behavior on product surfaces is pinned substrate-neutrally by `tests/workspace-surface-manager.test.ts` (12) and `tests/vr-interactions.test.ts` ("uses SpatialPanel/UIKit rather than the legacy canvas substrate", integration lane). Where the deleted tests pin behavior only the legacy class has (dragging, snapping, scrollbar, texture-cache signature), the replacement is deliberately **"behavior must not survive"**; where they pin panel-agnostic geometry/regression claims, they must be re-hosted on a live `SpatialPanel`-backed surface before the substrate deletion — FM4-UI-CLEAN owns that migration step, and `MovablePanelOptions` (types.ts) must go in the same deletion or live on as the options interface.
- Volume: 9 vitest files + 5 e2e specs / ~82 `its` total.

### S4 — CMS-2: retired `FlatBuffersSerializer` (confirmation; executed)

Verified at this base: case-insensitive `flatbuffer` finds **zero** occurrences in `src/`, `tests/`, `dev/`, `scripts/`, `wasm/`, `governance/`, and `docs/examples/`. No test still references, imports, or names the retired surface, including the e2e harness (`tests/e2e/harness/dataset_fixtures.ts` no longer carries `generateCorruptedFlatBuffers`). **No census action**; this row documents that a retired surface carried zero residual test rent after CMS-2's migration work, and that the exit falsifier `tests/cms2-serializer-truthfulness.test.ts` (fast, 5) guards recurrence. *A premise of the sprint brief ("check no test still references it") held.*

### S5 — CMS-3: dev debug tooling that deliberately survives

`RemoteDebugStreamer` is registry `development-only` with a landed keep decision (CMS-3: dynamic-import DEV boundary in `src/main.ts`, `init()` guard, production build eliminates the module).

| Test file | Lane | ~Tests | Class |
|---|---|---|---|
| `tests/cms3-debug-bundling.test.ts` — pins the production boundary (no static import, guard order, DEV refusal) | fast | 5 | **PROTECT** |
| `tests/remote-debug-streamer.test.ts` — dev-tool behavior test | integration | 1 | **PROTECT** (dev-only, deliberately retained per CMS-3) |

(`tests/smoke/load.spec.ts` mentions the streamer only in a comment about the dev-only `/__remote-logs` route.)

### S6 — Dev-only validation infrastructure (registry `validation-infrastructure`) — PROTECT by landed design

`dev/loadtest-server.ts`, `dev/validation-*.ts`, `dev/uxr4-cohort-finalizer.ts`, `dev/ux-trace-server.ts` and `src/validation/*` are development-only by construction (no src production importer) but are the **promotion-evidence path** for governed Quest/UX research sessions; the registry classifies them as validation infrastructure, not investigator-facing product. ~20 test files, ~198 `its` (`tests/quest-loadtest-sink.test.ts` 22 in the fast lane over the real `resolveLoadTestSink` plugin handler; `quest-validation-manifest` 36 fast; the balance integration-lane). Classification: **PROTECT** — these tests guard device-declaration truthfulness (QV2), evidence-sink isolation (QV3), adjudication and UX-trace integrity; deleting them would delete governance evidence, not rent. Measured here so CMS-4/2-style cleanups never touch this directory "for speed".

### S7 — Dev XR research/eval harness (`dev/xr-lab`, `dev/xr-simulator`, `dev/spatial-tools`, `dev/benchmark-uikit.ts`) — RESEARCH_FIXTURE

No src importer; experiment and campaign harnesses. ~17 test files, ~73 `its`: `tests/ui-system/*` (webxr-simulator 14, usim-a-lifecycle 3, xr-* and portable-* 18), `tests/spatial-ergonomics-linter.test.ts` 5, `tests/webxr-6dof-pose-rig.test.ts` 3, `tests/moneta-benchmark-corpus.test.ts` 3, `tests/moneta-evidence-protocol.test.ts` ~10 (incl. 1 `it.each`), `tests/moneta-known-structure-campaign-wasm.test.ts` 2 (wasm lane, kernel campaign evidence), `tests/benchmark-session.test.ts` 3, `tests/seeded-random.test.ts` 5 (deterministic-random utility used by synthetic fixtures and `e2e f15`), `tests/research-position-draco-hardware.test.ts` 3, `tests/quest-field-trial-suite.test.ts` 4. Classification: **RESEARCH_FIXTURE** with no deletion recommendation — they are the fixture/evidence machinery for kernel-qualification campaigns (some run in the real-wasm lane by design). If any are ever retired, their *campaign evidence obligations* must be reconciled in `governance/production-readiness.json` first.

### S8 — Non-product study instrumentation (`src/study/**`, `StudyController`, `StudyModeModal`) — PROTECT

Registry `study-harness` (`development-only`): "Research protocol and validation instrumentation… dedicated barrel is intentionally non-product." Entire `src/study` domain has zero production import chains (only tests). ~7 test files, ~39 `its` (`study-controller` 5, `study-harness` 9, `study-freeze-enforcement` 7, `study-statistical-analyzer` 4, `study-data-exporter-security` ~2, `runtime-fitness-mode-policy` 10, `research-validation` 3). **PROTECT**: roadmap FM6 schedules human-refined learning; the registry owns the non-product declaration; rent is measured, not condemned. (`src/study/TelemetryConsentManager` is likewise registry-owned and pinned by `security-hardening`/consent tests.)

### S9 — Research-only learned-fitness + gesture-learning machinery — PROTECT, with one flag

Registry `learned-fitness-training` (`development-only`): research-only "until a promoted artifact and operator workflow are intentionally activated". ~20 test files, ~81 `its` (fitness model promotion gate/registry, learned-fitness runtime adapter + opt-in, pairwise snapshot ledger, gesture upload/retrain/edge-cases/contracts, pt6c/pt6d/pt7/pt8 suites). **PROTECT** — promotion-gate and snapshot-authority falsifiers, scheduled product destination.

- **Flag for production-readiness/ERA-AG1:** `src/governance-service/GestureLearningHttpService.ts` and `src/governance-service/GestureLearningGovernance.ts` are value-imported by **no** production composition — `src/governance-service/server-entry.ts` (the documented service entry) builds `GovernanceHttpService` + `ProductAnalyticsGovernanceComposition` without mounting them; only `tests/pt6c-*/pt8-*` reach them. Consistent with the registry's research-only status, but worth recording so the eventual activation slices know the HTTP surface exists unmounted.

### S10 — Dormant experiments pending CMS-5/CMS-6 decisions

| Surface | Test file | Lane | ~Tests | Class |
|---|---|---|---|---|
| `src/data/ColorPaletteEngine.ts` (registry `development-only`, "not consumed by the production encoding or UI token paths") — CMS-5's named comparison target | `tests/color-palette-colord.test.ts` | integration | 4 | **PROTECT pending CMS-5**; if CMS-5 decides DELETE, becomes **DELETE_WITH_SURFACE** — replacement invariant named there: CVD/contrast semantics that materially improve accessibility must land on the canonical encoding/representation path (correction from the CMS-5 review, 2 Oct 2026: this census originally claimed canonical contrast assertions already exist in `tests/encodings.test.ts` and the ui-system token tests — verified false, no production code computes contrast anywhere; the CMS-5 absorption supplies the first executable contrast evidence), or none remains |
| `src/vr/perception/MultimodalPerceptionEnvelope.ts` + `src/vr/perception/GeometricGestureRecognizer.ts` (registry `development-only`, dormant prototype) — CMS-6's named audit target | `tests/multimodal-perception-envelope.test.ts` (4), `tests/sprint-27-4-resilience-and-gestures.test.ts` (3, mixed — part tests resilience) | integration | 7 | **RESEARCH_FIXTURE pending CMS-6** (prototype must not be promoted; assertion surface tied to the audit outcome) |

### S11 — Explicitly dormant Rust scene command buffer — PROTECT

`src/wasm/CommandApplier.ts` + `wasm/src/command_buffer.rs` (registry `development-only`, "deliberately dormant until headset evidence warrants CAP_SCENE_RUST/CAP_COMMAND_BUFFER"; `docs/ROADMAP.md` explicitly names it *not a sprint*). `tests/command-applier.test.ts` (integration, 6, **PROTECT**) and the `CommandApplier` slice of `tests/subsystem-resiliency-audit.test.ts` (wasm, 7 total, **PROTECT**). ~13 `its` measured; no deletion consideration while the roadmap retains the dormant surface.

### S12 — Compat and legacy-input fail-closed guards — PROTECT

Tests whose keyword matches are **falsifiers against legacy/compat input** or negative assertions that superseded mechanisms are *not* used. All exercise production-reachable code, and several pin persisted-format/historical-replay compatibility the repo treats as durable. ~14 files (incl. `rf035b2b`), ~111 `its`, counted once against S13 overlaps: `rf-050-session-storage-dedup` 7 (legacy compact session-shape expansion — persisted-format compat), `pt5d-continuity-ui` 3 / `pt5d-investigation-continuity` 7 (legacy portable packages carry no governed envelope — exact, deliberate), `runtime-columnar-boundary` 3 + `rust-js-boundary-benchmark-contract` 5 (the `compatibility_*` kernel crossings are deliberate, production Rust exports), `composed-representation-validation` 10, `nemosyne-file-presentation-contract` (~2 `it.each` cases; legacy ZIP import), `c2-investigation-state-legibility` 11 (legacy one-line format retained alongside new rows), `governor-event-loop` 5, `atlas-async-execution` 18 (async-parity), `rf062g-analytical-runtime-owner` 6 (governed legacy asset fallback), `tec1-f1-governed-replay` 21 (fast; refuses legacy schema-v1 digest composition), `tec1-governed-export` 12. Also `rf035b2b-compatibility-regressions.test.ts` (3): despite its name it pins production `EvidenceLedger`/`DatasetVersionStore` reference-result storage invariants — **PROTECT**.

### S13 — Compatibility alias family pinned by tests — MIGRATE at rename time

Verified alias set and its rent:

- `src/wasm/runtime/KernelContractBridge.ts:135` — `adjustDracoEvidence = adjustMonetaEvidence` (plus `solveDraco`/`evaluateDracoCandidate` facades), re-exported by `src/wasm/RuntimeBridge.ts` (production-reached).
- `src/atlas/DatasetSpace.ts:60` — `fnv1aHex`, `@deprecated` alias of `contentHashHex`; **still has 6+ live src callers** (AtlasCore, RustAnalyticalEvidenceAdapter, ActionableNil, LearnedMonetaRuntime, MonetaHypothesisEngine, InvestigationReplayRunner) — migration incomplete, its alias-identity tests are live-protective, not rent.
- `src/moneta/representation/RepresentationDecision.ts:112` — `representationFamily`/`confidence` compat aliases "retained while downstream call sites migrate".
- `src/vr/palette.ts` — compat alias module of `ui-system/tokens.ts`, `@deprecated`, **zero src importers and zero test importers** — already dead; *no test rent exists*; flag for ERA-AG4 mechanical deletion (no replacement invariant needed beyond typecheck).

| Test file | Lane | ~Tests | Class |
|---|---|---|---|
| `tests/runtime-bridge-module-boundaries.test.ts` ("keeps compatibility aliases as identity-only adapters") | fast | 5 | **MIGRATE** (file-level: 1 of 5 `its` is the alias guard) |
| `tests/wasm-runtime.test.ts` | wasm | 28 | **MIGRATE partial** (1 `its`/block of 28 targets the alias) |
| `tests/moneta-evidence-scorer-authority.test.ts` | fast | 4 | **MIGRATE partial** (alias-identity its) |
| `tests/moneta-explainer-panel-uikit.test.ts` | integration | 3 | **MIGRATE partial** ("preserves Draco compatibility aliases without adding a second authority") |
| `tests/moneta-diagnostic-hud-uikit.test.ts` | integration | 4 | **MIGRATE partial** (same pattern) |

- **Replacement invariant (named):** the substantive property is already stated in-test and in `tests/moneta-evidence-scorer-authority.test.ts`: "**one Rust authority per operation**". When the alias names are retired (caller migration completing on `fnv1aHex`, `*Draco` facades), these guards collapse into the existing single-authority/canonical-name assertions plus typecheck; **no new test is needed**, the alias-identity lines are simply removed with the alias. Until then the guards are live.

### S14 — Test-only-reachable production modules — flagged, not condemned

Automated reachability surfaced src modules whose only value-import chains are tests. Each was spot-verified; none is classified legacy-rent, but the census records the reachability evidence for ERA-AG1/AG4 adjudication. **Do not delete these tests on reachability alone.**

| Test file | Lane | ~Tests | Class | Flag |
|---|---|---|---|---|
| `tests/serializers.test.ts` | integration | 13 | **PROTECT** | The "canonical" Arrow (`datasetToArrowIPC`) and MessagePack (`datasetToMessagePack`) serializers — kept as the truthful boundary by CMS-2 — have **zero src value callers**; production persistence flows through the `.nemosyne` package path (`NemosynePackage`, fflate) instead. The boundary/safety assertions are the format contracts, not dead-code rent; but "canonical format" reachability is currently test-proved only. |
| `tests/network-security.test.ts` | integration | 36 | **PROTECT** | `src/network/server.ts` is the documented server-only authority barrel (`docs/PRODUCTION_SIGNALLING.md`); my 4-root graph cannot see node-only deployment roots — limitation, not unreachability. |
| `tests/architectural-invariants.test.ts`, `tests/golden-path-vertical-slice.test.ts` | integration | 7 / 1 | **PROTECT** | Import barrels (`src/data/index.ts` etc.) that src never imports (src imports files directly); barrel-unreachable ≠ production-unreachable. |
| `tests/intent-compiler.test.ts` (11), `tests/investigation-intent.test.ts` (9) | integration | 20 | **PROTECT (forward path)** | `src/atlas/intent/**` (`IntentCompiler`, `StructureExplainer`, `InvestigationIntent`) has zero src callers today; roadmap FM1 schedules question-aware intent as a forward product path, and `tests/e2e/investigator-journey-e2e.test.ts` also uses it. Retention is forward-path, flagged so a future cleanup cannot silently orphan intent coverage. |
| `tests/data-card.test.ts` (6), `tests/ui-system/text-field.test.ts` (5) | integration | 11 | **RESEARCH_FIXTURE (flagged)** | `src/vr/artifacts/DataCard.ts` (World only uses a `_showDataCard` method name) and `src/vr/ui-system/components/TextField.ts` have zero src import chains — dormant product-increment candidates; retention decision belongs to FM increments/ERA-AG1. |
| `tests/spatial-tween.test.ts` (2), `tests/spatial-audio.test.ts` (5), `tests/webrtc-user-cloud-avatar.test.ts` (6), `tests/github-corpus-connector.test.ts` (14) | integration | 27 | **RESEARCH_FIXTURE (flagged)** | Dormant experiment modules (`SpatialTween`, `SpatialAudioSynthesizer`/`Narrator` — FM3-PERCEPT candidates, `UserCloudAvatar`/`UserMetadataDataset`/`TelemetryInterpreter`, `GitHubCorpusConnector`); no production assertion, no deletion recommendation without an FM-increment disposition. |
| `tests/inference-free-compute-policy.test.ts` (7), `tests/cockpit-taxonomy.test.ts` (5), `tests/status-strip-gates.test.ts` (3), `tests/investigation-branching-error-register.test.ts` (2) | integration | 17 | **RESEARCH_FIXTURE (flagged)** | `FreeComputePolicy` (FM5+ inference), `HandWheelCategorization` (zero importers), `UXAcceptanceGate` (zero importers; the status strip's live gates live elsewhere), `ErrorRegistry` — research/scaffolding modules with tests but no production chain. |

### S15 — Superseded `src/app/AnalystJourneyControls.ts` UI mount — MIGRATE

**Reachability evidence:** zero src value importers. Supersession is recorded in-repo: `src/app/uv0TestHandle.ts:154` — "InvestigationShell replaced AnalystyJourneyControls"; `src/app/bootstrap.ts` mounts `InvestigationShell`/rail actions, not this module; `src/validation/uv0-inventory.ts:292` still carries a DOM-id inventory entry referencing the module (stale inventory entry worth a follow-up).

| Test file | Lane | ~Tests | Class |
|---|---|---|---|
| `tests/application-semantic-intents.test.ts` — intent dispatch/fail-closed contract; mounts through `mountAnalystJourneyControls` | integration | 5 | **MIGRATE** |
| `tests/p1-uv1-task-first-shell.test.ts` — consumes `TASK_FIRST_PRIMARY_ACTION_IDS`, defined only in `AnalystJourneyControls.ts` (no src consumer) | integration | 7 | **MIGRATE** |
| `tests/post-m4-fix-forward.test.ts` — dataset load journey through `mountAnalystJourneyControls` | integration | 4 | **MIGRATE** |

- **Replacement invariant:** re-pin the semantic-intent dispatch, unknown-intent fail-closed and task-first-rail contracts through the live mounts (`InputIntentBindings`/`InvestigationShell`/`DesktopSelectionTaskRail` in `bootstrap.ts`), re-homing `TASK_FIRST_PRIMARY_ACTION_IDS` to the production rail module, before deleting `AnalystJourneyControls.ts`. Until that mount migration happens these tests are the only executable evidence for the intent vocabulary — **do not delete them for the mount's sake.**

### S16 — Superseded `src/vr/coordinators/InvestigatorJourneyCoordinator.ts` e2e

**Reachability evidence:** imported only by `tests/e2e/investigator-journey-e2e.test.ts`; the installed production journey authority is `src/app/investigation/InvestigationJourneyController.ts` (imported by `installInvestigationJourney` and `DesktopInvestigationJourney`), with dedicated production tests (`pt5c-investigation-journey`, `pt5c-xr-investigation-panel`, `pt5e-*`).

| Test file | Lane | ~Tests | Class |
|---|---|---|---|
| `tests/e2e/investigator-journey-e2e.test.ts` — self-describes: "This legacy lifecycle test does not pass the compiled analytical intent into Moneta… candidate-specific embodiment/fallback behavior is covered by the representation-specific production tests rather than pinned here" | integration | 1 | **MIGRATE** |

- **Replacement invariant:** the journey phases this test walks are covered by `tests/pt5c-*`/`pt5e-*` over the real controller plus tier4 `scenario5_complete_analyst_journey.spec.ts`; after confirming no phase gap, delete the file **with** the superseded coordinator as one CMS/era-cleanup package (replacement named: `InvestigationJourneyController` coverage — none of it needs the superseded coordinator).

### S17 — Playwright smoke + collaboration harness — PROTECT

`tests/smoke/` (20 spec files, ~34 `its`) run in the required CI `playwright-smoke` job (`npm run test:smoke`, production journeys incl. the load path) — **PROTECT**. `tests/collaboration-browser/recovery.spec.ts` (1) runs in the same CI job (`test:smoke:collaboration`) as collaboration-recovery smoke over the `tests/smoke/collaboration-harness.html` composition — **PROTECT** (CI-required evidence; exercises the real collaboration stack through a harness page, a bounded production-path approximation).

## 4. Volume measurement (approximate; method in §1.2)

Inventory total: 634 test files / ~3,693 `it`-call occurrences. Census-cited subset 152 files / ~889 `its`; the remaining ~482 files / ~2,804 `its` produced no legacy/dev/compat/superseded rent signal under the keyword sweep and reachability cross-reference (routine product-invariant/authority tests; screened, not individually adjudicated — ERA-AG5 owns deeper test-quality audit).

| Classification | Files cited | ~Tests |
|---|---|---|
| DELETE_WITH_SURFACE | 4 (`collaborative-sync`, `movable-panel`, `movable-panel-scrollbar`, `canvas-texture-cache`) | ~24 |
| MIGRATE (many partial — file carries both rent and surviving invariants) | 22 | ~132 (of which ~25 `its` are pure rent, re-counted after correcting the S1 split) |
| RESEARCH_FIXTURE | 29 | ~135 |
| PROTECT | 97 | ~598 |

Per-lane totals are in §2. No deletion recommendation is made for speed; the deletable-rent sum (~24 + ~25 `its`) is tiny — the value of this census is the named surfaces, not the counts.

## 5. How this feeds CMS-2 / CMS-4 and later cleanup packages

1. **CMS-4 (superseded collaboration deletion)** — owns S1 (`CollaborativeStateSync`: 3 files/~23 `its`) and S2 (network `SharedAnnotationManager` annotations half). The census adds a hard prerequisite CMS-4's exit criterion did not name: before deleting the synchronizer, the 5 class-instantiating sequence/peer/channel-binding falsifiers in `tests/zero-copy-network-sync.test.ts` must be re-homed (or their existence on the production path confirmed); the wire-contract half (10 serializer-direct `its`, incl. the `acceptsSequence` gating already called by `NetworkManager`) already has named equivalent homes. CMS-4 should also delete the two `governance/production-capabilities.json` `legacy-*` entries in the same change and re-evaluate whether `tests/cms1-collaboration-contract.test.ts`'s no-import falsifier is still meaningful.
2. **CMS-2 follow-up** — none: the retirement is complete at this base (S4 confirmation), guarded by `tests/cms2-serializer-truthfulness.test.ts`.
3. **FM4-UI-CLEAN** — owns S3 (MovablePanel substrate): 9 vitest files + 5 e2e specs / ~82 `its`, with the split stated per-file (which assertions die with the substrate, which must be re-hosted on SpatialPanel surfaces first).
4. **ERA-AG4/AG1 (compat & authority census)** — owns: the S13 alias families (`fnv1aHex` with live callers; `*Draco` bridge facades; dead `src/vr/palette.ts`), the test-only-reachable flags in S14 (notably the Arrow/MessagePack serializers and the NTC1 `TypedColumnsCodec` encoder, which has no production caller behind the reachable `loadTypedColumns` seam — worth an authority finding), and the stale `uv0-inventory.ts` entry for `AnalystJourneyControls`.
5. **Forward-tranche safety notes** — S6/S7/S8/S9/S11 are deliberately retained dev/research surfaces with registry ownership; their ~415 `its` (S6 198 + S7 73 + S8 39 + S9 81 + S10 11 + S11 13) are measured rent only in the sense of inventory, with explicit "do not delete for speed" statements, so later cleanup packages cannot mistake them for legacy.

## 6. Surprising findings (truthful ledger)

1. The canonical Arrow/MessagePack serializers under `src/data/serializers/` — kept and hardened by CMS-2 — have no production caller in `src/` (value-import check + symbol usage). The production package path is `NemosynePackage`/fflate. This is a reachability gap in a *declared canonical* boundary, not test rent.
2. `src/wasm/TypedColumnsCodec.ts` (NTC1 wire encoder for `data_load_typed_columns`) has zero production callers: `loadTypedColumns` appears only as an optional port method signature in `src/atlas/adapters/AnalyticalKernelPort.ts` and the bridge; only tests call `encodeTypedColumnsPayload`.
3. `src/vr/ui/MovablePanel.ts` is already value-unreachable in src — FM4-UI-CLEAN's deletion target is smaller than the roadmap phrasing suggests (only the class plus `CanvasTextureCacheManager` and the options interface), and tests are currently the main consumer of the class. Two non-S3 test files additionally touch the class as fixtures: `tests/ui-system/webxr-simulator.test.ts` (constructs it; see the S3 fixture caveats) and `tests/workspace-surface-manager.test.ts` (subclasses it).
4. `src/vr/ui/CanvasTextureCacheManager.ts` survives only through `MovablePanel` — a hidden dependency of the S3 deletion.
5. The gesture-learning HTTP service (`GestureLearningHttpService`/`GestureLearningGovernance`) is not mounted by the composed governance service entry — consistent with research-only registry status, but an unmounted service surface is easy to mistake for landed production capability.
6. `src/vr/resilience/*` (`WebGLContextRecovery`, `DiegeticErrorBoundary`, `GPUResourceDisposal`) show zero production import chains in the automated graph despite resilience tests existing; this may be a graph limitation — flagged for ERA-AG1 confirmation rather than classified (I did not delete-classify anything on this basis).
7. `src/validation/uv0-inventory.ts` still inventories the superseded `AnalystJourneyControls` mount as a live DOM id.

## 7. Verification of this census

- `docs:check` run at the end of this change (see PR body for the recorded result).
- JSON mirror validated with `node -e "JSON.parse(...)"`.
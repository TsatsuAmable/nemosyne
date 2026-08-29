# Stream B-U1 — Interaction Grammar (Settings reachability, single command authority, Record verb, inspector buttons, heuristic-rank honesty, selection coherence)

## Summary

Resolves the six verified BLOCKERs on the current production input/interaction grammar:

1. **Settings panel reachable** — `World._toggleSettingsPanel` now delegates to the working `WorldUIManager.toggleSettingsPanel()` (SpatialPanel lifecycle) instead of `panelManager.togglePanel` (MovablePanel-only, early-returns for `SettingsPanel`). This repairs every production input path: the XR wheel `SYSTEM → Settings` and legacy `Panels → Settings` items, and the `okSign` gesture via `WorldInputCoordinator`.
2. **Single command authority** — `WheelMenuBuilder` now accepts a canonical `dispatchIntent` (injected by the bootstrap composition root as `world.dispatchIntent`). Wheel analysis ops (`filter/sort/aggregate/cluster/hierarchical/density/anomaly/timeSlice`), `reset`, `undo`/`redo`, `dataset.cycle`, and `workspace.toggleStatisticalLens` dispatch through the same `ApplicationIntentDispatcher` that governs gestures and desktop DOM — no shadow path. World-side op funnels (CTS/VRMenu callbacks, in-place operation handles, input-coordinator `onApplyOperation`, and `World.applyDataOperation`) all route through a `_dispatchAnalysis` seam, so every mutating command (including `WorldLandmarkController` via `applyDataOperation`) reaches the single dispatcher when injected, and falls back to the legacy controller only in isolated harnesses where no dispatcher exists.
3. **Contextual `Record` verb is real** — `onRecordFinding` now creates an authoritative `Observation` via `world.markMoment(note, targetIds)` carrying the selected node identity (row `id`/`name`), preserving the existing status-strip + VR-console feedback.
4. **Inspector footer buttons wired** — `Compare`/`Challenge`/`Annotate` have real `onClick` handlers routed through `inspectorActions` (Compare → `analysis.apply compare`, Challenge → `analysis.apply anomaly`, Annotate → `atlas.recordAnnotation` onto the evidence ledger). When an action is not injected, the button shows an explanatory reason instead of remaining inert.
5. **Heuristic rank no longer labeled statistical confidence** — rename-only: `AtlasRecommendation.confidence` → `heuristicScore`, `computeConfidence` → `computeHeuristicScore`, `GuidanceOptions.minConfidence` → `minHeuristicScore`; `RecommendationPanel` renders `// HEURISTIC RANK` plus an explicit "not statistical confidence" disclaimer (matching `StructureProfileEvidenceAdapter.ts` terminology discipline). Math unchanged.
6. **Selection/context coherence** — the contextual task surface is hidden on dataset load / representation change (`_doLoadDataset`) and before Compare releases the artifact (`_dispatchAnalysis('compare')`), so stale row data and poses are not orphaned.

## Scope / collision classification

- **Files changed (src):** `src/app/bootstrap.ts` (one wiring line), `src/vr/World.ts` (minimal seams), `src/vr/coordinators/WheelMenuBuilder.ts`, `src/vr/artifacts/HolographicInspector.ts`, `src/atlas/GuidanceEngine.ts` (rename-only), `src/atlas/types.ts` (rename-only), `src/vr/ui/RecommendationPanel.ts` (label only).
- **Files changed (tests):** `tests/interaction-grammar-authority.test.ts` (new falsifier suite), `tests/interaction-grammar-cts-coherence.test.ts` (new, real-wasm lane), plus fixture/contract updates in `tests/atlas-core.test.ts`, `tests/golden-path-vertical-slice.test.ts`, `tests/investigation-domain-aggregate.test.ts`, `tests/ui-system/technocore-remediation.test.ts`, `tests/coordinator-consumer-contracts.test.ts`, `tests/config/test-groups.ts` (WASM lane registration for the new CTS test).
- **Not touched (B5-owned / non-goal):** `ContextualTaskSurface.ts`, `uv0TestHandle.ts`, `p1-uv0-baseline.spec.ts`, `contextual-task-surface.test.ts`, `docs/ROADMAP.md`, `package.json`, `vite.config.ts`, `src/app/bootstrap.ts` composition (only the dispatcher wiring line added), Rust/WASM/Atlas/Moneta, `World.ts` (no refactor — seams only).
- The `WheelMenuHost` consumer contract intentionally grows one optional member (`dispatchIntent`); the contract test was updated to match.

## Pre-implementation adversarial contract (recorded)

- **Invariant:** the canonical command vocabulary dispatches through ONE governed intent authority; the contextual Record verb creates real ledger observations with target identity; Settings is reachable; heuristic rank is not labeled statistical confidence; no selection context is orphaned by dataset/operation transitions.
- **Authority and production path:** `ApplicationIntentDispatcher` (composed in `bootstrap.ts`, bound to input callbacks and now to the wheel/World funnels) is the single command authority; `AtlasCore`/`EvidenceLedger` own observations/annotations; `WorldUIManager.toggleSettingsPanel` owns Settings visibility; `_doLoadDataset`/`_dispatchAnalysis` own CTS lifecycle on transitions.
- **Failure modes attacked:** wheel silently bypassing the dispatcher again; Record only logging to the status strip; Settings unreachable via wheel/okSign; `CONFIDENCE` label regression; CTS orphaned with stale row data; unhandled promise rejection from the dispatcher path; wheel built before dispatcher injection; legacy-wheel fallback behavior regressing.
- **Falsifying evidence:** the falsifier tests below; `npm run typecheck`; `npm run lint`; existing focused suites that exercise these files.

## Post-implementation adversarial review

**Disposition: High-risk change** (interaction grammar, command authority, scientific-semantics naming, ledger writes).

What was proven (with exact evidence):

- **Wheel dispatches through the dispatcher, never `applyDataOperation`** — `tests/interaction-grammar-authority.test.ts` invokes every wheel op/reset/undo/redo/dataset/lens callback on a stub world with a `dispatchIntent` spy and asserts the dispatched intents, and asserts `applyDataOperation`/`resetDataOperation`/`undoAnalysis`/`redoAnalysis`/`_cycleDataset`/`_toggleStatisticalLens` are NOT called. Also covers the legacy wheel and `World.applyDataOperation` funnel.
- **Settings reachable** — real `World` (mock kernel) via the wheel `SYSTEM → Settings` item and via `inputCoordinator.onGesture('okSign')`; `settingsPanel.mesh.visible` flips both ways; source assertion that `World.ts` references `toggleSettingsPanel()`.
- **Record verb writes a real Observation** — `world.uiManager.callbacks.onRecordFinding?.({ id: 'NODE-7' })` increments `world.atlas.observations`, with `notes` containing the identity and `targetIds` containing it.
- **No inert inspector footer button** — every footer button has a non-null handler and invoking it calls the mapped action; unavailable-action path shows a notice without throwing.
- **Heuristic rank honesty** — `RecommendationPanel.renderContent` renders `// HEURISTIC RANK` and the disclaimer, never `// CONFIDENCE`; `tests/atlas-core.test.ts` asserts `rec.heuristicScore` in [0,1]; math formulas byte-identical.
- **CTS coherence** — real-world (real-wasm lane) test asserts CTS is hidden after `loadDataset` and after `_dispatchAnalysis('compare')`.
- **Regression suites** — `npm run typecheck` clean; `npm run lint` 0 errors; jsdom-integration lane 343/345 files pass (2 pre-existing Stream-A wasm-ABI files fail identically on base `main`); fast-node lane 18/18 (120 tests); UI lane 3/3 (13 tests); real-wasm lane 42/42 (301 tests).

What remains unproved / not run:

- `npm run architecture:check`'s dependency-cruiser steps could not run in this environment (the installed `dependency-cruiser` does not support the local Node 25 runtime). The only new cross-module import is `src/vr/coordinators` → `src/app/intents` (intent types), which violates no boundary rule in `.dependency-cruiser.boundaries.cjs` (verified by reading the boundary config). `architecture:ast` and `architecture:ast:test` pass.
- Real-wasm tests can only execute in this worktree after dereferencing the `wasm/pkg` symlink (a vite module-resolution limitation of the symlinked worktree); they pass when run that way and on `main`. The symlink was restored afterward.
- Full CI (Cargo suite, docs check, coverage) not run locally.

Residual risks / deferred work (validated, not blockers):

- **Compare/Navigate semantic divergence** (global top-2-groups compare vs the CTS `Compare` verb expectations; `Navigate` = `timeSlice` vs teleport) is deliberately OUT of scope for this checkpoint and recorded here as a known residual.
- **Undo/redo/seek/reset re-solve paths** also rebuild the artifact via `_restoreDataset`/`resetDataOperation`; the CTS is not hidden on those paths (this checkpoint scoped dataset load + Compare). A follow-up may hide the CTS on any re-solve.
- **Persisted field rename** `AtlasRecommendation.confidence → heuristicScore` changes the serialized session shape; older snapshots carrying `confidence` will drop that value on roundtrip. This rename is the sanctioned fix and no production consumer reads the old field.
- **Inspector `Annotate`** writes a ledger annotation with the last-selected-node identity and camera position; node-scoped annotation UI (text input) is not part of this checkpoint.
- `WorldLandmarkController` still invokes `World.applyDataOperation`, which now funnels through the dispatcher when injected — authority is restored transitively, not by touching that file.

## Verification evidence (commands and results)

- `npm run typecheck` → exit 0, no errors.
- `npm run lint` → 0 errors (209 pre-existing warnings across the repo; none in changed files).
- `npx vitest run --config vitest.config.ts tests/interaction-grammar-authority.test.ts tests/wheel-menu-builder.test.ts tests/vr-ux-convergence.test.ts tests/coordinator-consumer-contracts.test.ts tests/holographic-inspector.test.ts tests/world-input-coordinator.test.ts tests/world-ui-manager.test.ts tests/application-semantic-intents.test.ts tests/atlas-core.test.ts tests/golden-path-vertical-slice.test.ts tests/investigation-domain-aggregate.test.ts tests/ui-system/technocore-remediation.test.ts` → 11 files / 134 tests passed.
- `npx vitest run --config vitest.fast.config.ts` → 18 files / 120 tests passed.
- `npx vitest run --config vitest.ui.config.ts` → 3 files / 13 tests passed.
- `npx vitest run --config vitest.wasm.config.ts` (after dereferencing the `wasm/pkg` symlink) → 42 files / 301 tests passed.
- `npx vitest run --config vitest.config.ts` (after dereferencing the `wasm/pkg` symlink) → 343/345 files passed; the 2 failing files (`stream-a-a3-semantic-embodiment-contract-wasm`, `stream-a-a4-rust-aggregate-embodiment-wasm`, 9 tests) fail identically on base `main` (pre-existing wasm-ABI drift, unrelated to this change).
- `npm run architecture:ast:test` → 1 passed; `npm run architecture:ast` → clean. `npm run architecture:boundaries` / `architecture:deps` blocked by Node 25 (dependency-cruiser unsupported) — environment limitation, not a code failure.
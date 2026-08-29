# RF-UV B3 — P1-UV0 canonical visible-product baseline — adversarial contract

Date: 29 August 2026
Base: `81ec16b` (#531 B1, #535 B2 merged)
Stream: B — B3 (P1-UV0 visible-product baseline)
Status: pre-implementation contract recorded before coding; post-implementation adversarial review appended below after verification

## Problem

B3 is the reproducible before-state that later P1-UV tranches (B4 task-first shell, B5 contextual locus-of-work) will be measured against. Today there is no screenshot/visual-regression infrastructure, no inventory of the visible normal-mode surfaces, and no record of the fresh-start path. Without this, a later PR can replace substrate and claim "visible improvement" with nothing to compare against. B3 must make the current experience inspectable and falsifiable without changing product treatment.

## Invariant

When B3 is correct:

1. **Deterministic, falsifiable baseline.** `tests/smoke/p1-uv0-baseline.spec.ts` boots the real production `dist/` in real headless Chromium (WebGL2/SwiftShader), reaches ≥3 canonical states deterministically (fresh-boot, NIL via `#analyst-max-elements=1` + assess, evidence via analysis + mark-moment), asserts the states are actually reached (telemetry `LAYOUT:`/`GEOM:`/`BEHAVIOR:`, NIL outcome text, evidence/observation ledger counts, inspector/task-surface visibility), and writes deterministic 1280×720 screenshots + a linked run JSON to `tests/smoke/artifacts/uv0-baseline/`. Screenshots are evidence artifacts; the asserts are on state, so renderer variance in CI cannot break the gate.
2. **Honest inventory.** `src/validation/uv0-inventory.ts` (dependency-free) lists every visible normal-mode surface/object with id, name, source `file:line`, purpose, reference frame, summon/dismiss, owning semantic state, classification (`KEEP`/`CONVERGE`/`DEMOTE`/`REPLACE`/`REMOVE`) and one-line rationale grounded in the design-spec §16 table *and* what is actually visible today. The static doc `docs/roadmap/P1_UV0_BASELINE_INVENTORY.md` records the same inventory plus the fresh-start/first-insight path and observed subsystem/panel-first friction.
3. **Drift detection.** A fast test asserts the inventory is complete against a hardcoded expected entry set (count + ids) and that every entry validates (schema + valid classification + valid reference frame), so B4/B5 cannot silently drift the baseline.
4. **No product treatment change.** B3 changes evidence/inventory only: no panel is restyled, re-laid-out, hidden, moved, or renamed in production behavior; `World.ts` is untouched; `npm run dev`/`dev:wasm` and the CI graph are unchanged.

## Authority and production path

- **Truth owner (visible state):** the built production app itself. The spec boots `dist/` via `vite preview` (CI: `NEMOSYNE_SMOKE_PREBUILT=1` against the production-bundle artifact), exactly like the existing `load.spec.ts`/`analyst-journey.spec.ts` smoke gate.
- **Truth owner (states):**
  - fresh-boot: `World` constructor auto-loads `DEFAULT_DATASET_ENTRY` (`src/vr/World.ts:724`) → `#telemetry` per-frame form (`LAYOUT:`/`GEOM:`/`BEHAVIOR:`, `World._updateTelemetry`).
  - NIL: `#analyst-assess-representation` → `assessAnalystRepresentation(world.atlas, world.session, 1)` (`src/app/AnalystRepresentationAssessment.ts:21`) → `NoFeasibleRepresentationError` → `#analyst-representation-outcome` NIL text + `#analyst-journey-status` "NIL outcome recorded".
  - evidence: `#analyst-run-analysis` → `dispatchIntent({type:'analysis.apply'})` → "Evidence ready"; `#analyst-mark-moment` → `world.markMoment` → "Observation recorded"; ledger counts read from the authoritative `world.atlas.results` / `world.atlas.observations`.
  - focused-observation: real `_showDataCard` path (`src/vr/World.ts:1146`) + the same `onInspect` callback the ContextualTaskSurface Inspect verb invokes (`src/vr/World.ts:366`) → `world.inspector.visible` / `world.uiManager.contextualTaskSurface.visible`.
  - replay: real `#analyst-export-package` → `world.session.exportPortablePackage` + `#analyst-replay-package` → `world.replayPortableInvestigation` (`src/vr/World.ts:833`), which is kernel-dependent; recorded as not-yet-baselined when the environment has no analytical kernel.
- **Truth owner (inventory):** the pure module `src/validation/uv0-inventory.ts` + the smoke spec writes a per-run JSON that links screenshots to the inventory ids. The test-only runtime handle is installed in `src/app/bootstrap.ts` (Stream B's documented seam, `docs/ROADMAP.md:186`) gated behind the `?nemosyne-uv0=1` query parameter so ordinary production/dev loads are byte-identical.

## Failure modes (most plausible ways this silently misleads)

1. **Screenshot-only baseline with no state proof.** The spec captures images but would pass even if a state was not reached. → every state has a hard assertion (telemetry form, NIL text, evidence/observation counts, inspector/task-surface visibility) before its screenshot is taken.
2. **Flaky boot.** Fixed sleeps instead of polling, or asserting the transient boot string. → poll `#telemetry` for `LAYOUT:` (existing load.spec pattern, proven stable in CI); never assert transient strings.
3. **Screenshots gate CI on renderer variance.** SwiftShader pixels differ across CI/local, so pixel asserts would be flaky. → screenshots are evidence artifacts written to a gitignored dir; capture failures are recorded in the run JSON but do not fail the gate; the gate asserts state only.
4. **Inventory describes aspirational design, not today's scene.** Entries claim "DEMOTE" for surfaces that do not actually exist/behave that way, or list surfaces that are not visible. → every boot-visible claim is verified against the actual constructors/defaults (checked `file:line` during inventory authoring); classification rationale cites both §16 and what is visible today.
5. **Inventory drift undetected.** B4/B5 deletes or renames a surface and no test notices. → the fast test pins an expected id list + count and validates schema/classification/frame of every entry.
6. **B3 accidentally changes product treatment.** Any production file touched in a way that alters layout/visibility/behavior. → diff review targets only `bootstrap.ts` (query-gated test handle) + additive modules; `World.ts`/panels untouched; the post-review explicitly checks this.
7. **Test handle expands production footprint.** An unconditional `window` handle ships in every production build. → handle is installed only when `?nemosyne-uv0=1` is present at boot; absent the query param the production bundle behaves identically.
8. **Kernel-dependent states treated as required.** NIL/evidence/replay need the analytical kernel (CI builds it; a local worktree without a working `wasm/pkg` does not). → replay is recorded as `kernel-unavailable`/not-yet-baselined in that environment instead of failing; NIL/evidence are the hard states the mission requires (they pass in CI, which ships the kernel).
9. **Focused-observation state is fabricated through a fake raycast.** Building a synthetic selection path that bypasses the real selection call graph. → the handle calls the real `world._showDataCard` (the exact method `onSelectNode` invokes after a real ray select) and the real `onInspect` callback the Inspect verb dispatches; only the pointer-raycast hover mechanics are skipped, analogous to how the DOM journey controls call world methods directly.

## Falsifying evidence

1. `tests/smoke/p1-uv0-baseline.spec.ts` reaches fresh-boot (telemetry `LAYOUT:`+`GEOM:`+`BEHAVIOR:`, status `Ready`), NIL (`#analyst-representation-outcome` contains `NIL: no feasible representation`), evidence (`Evidence ready` + `Observation recorded` + `evidenceCount>0` + `observationCount>=1`) and focused-observation (`inspectorVisible` + `taskSurfaceVisible` true) — each asserted before capture.
2. `tests/uv0-baseline-inventory.test.ts` (fast lane) asserts the inventory entry set equals a hardcoded expected count/ids and every entry has a valid classification + reference frame.
3. The run JSON lands beside the screenshots in `tests/smoke/artifacts/uv0-baseline/` with per-state asserted flags and linked inventory ids.
4. `npm run typecheck`, `npx eslint` on changed files, `npm run test:fast`, `npm run test:ui`, `npm run docs:check` all pass; existing smoke specs still pass.
5. Boot with `?nemosyne-uv0=1` vs `/` renders the same scene (the handle mutates nothing at install).

## Non-goals / dependencies

- B3 does **not** restyle, re-layout, hide, move, or rename any panel/object (that is B4/B5).
- B3 does **not** change `World.ts`, panel classes, `src/moneta/**`, `src/wasm/**`, `src/atlas/**`, signalling/collaboration, or `package.json`/`vite.config.ts`.
- B3 does **not** add npm dependencies and does **not** assert screenshot pixels (renderer variance is out of scope; pixel contracts belong to a later visual-regression gate).
- B3 does **not** baseline IWER/simulator poses or Quest physical evidence (P1-UV0 lists them; simulator poses are deferred — see residual risk).
- **Dependency:** B3 reuses the existing production smoke harness (`playwright.config.ts`, `NEMOSYNE_SMOKE_PREBUILT=1`, `NEMOSYNE_FORCE_HTTP=1`, baseURL `http://localhost:4173`) and the existing kernel-in-CI assumption the analyst-journey spec already relies on.

## Drift note (pre-implementation discovery)

Remote `main` advanced to `d9c348b` (#533, Stream A Rust-owned aggregate embodiment) after the pinned base `81ec16b`. By PR time it had advanced further to `a62fc8c` (#538) via #533/#536/#537/#538; none of those commits touch any B3 file (`src/validation/uv0-inventory.ts`, `src/app/uv0TestHandle.ts`, `src/app/bootstrap.ts`, `tests/smoke/p1-uv0-baseline.spec.ts`, `tests/uv0-baseline-inventory.test.ts`, `tests/config/test-groups.ts`, docs). Per the checkpoint instructions the branch stays on base `81ec16b`; the PR must re-check `main` before raising and reconcile if needed.

---

# Post-implementation adversarial review

Date: 29 August 2026
Reviewer: Stream B (self-review, adversarial contract applied)
Verification run in worktree: `npx tsc --noEmit` clean; `npx eslint` clean on all changed files; `npm run docs:check` PASSED; `npm run test:fast` 119/119 (incl. new `tests/uv0-baseline-inventory.test.ts` 5/5); `npm run test:ui` 13/13; full local smoke suite 20 passed / 10 pre-existing skips (incl. the new `p1-uv0-baseline.spec.ts`). Local production evidence: `npx vite build` (no wasm build, to avoid writing through the `wasm/pkg` symlink) + `vite preview` + the baseline spec captured all 5 states with hard assertions — kernel available (`kernelAvailable: true`), replay verified — and wrote five 1280×720 screenshots (175–191 KB each, non-blank) plus `run-inventory.json` (23 inventory ids, per-state asserted flags) to `tests/smoke/artifacts/uv0-baseline/`.

## Adversarial questions

1. **Is the baseline reproducible and deterministic, or flaky/decorative?**
   Deterministic, not decorative. Every state is reached through the real production entry points (DOM journey controls + real `_showDataCard`/`onInspect`), each state asserts its defining evidence before a screenshot is taken (telemetry per-frame form; `NIL:` outcome text; `Evidence ready`+`Observation recorded`+ledger counts; `inspectorVisible`/`taskSurfaceVisible`), and boot uses the existing proven `#telemetry` `LAYOUT:` poll rather than fixed sleeps. Screenshots are captured only after the state assertion passes and are written to a gitignored artifacts dir; a renderer difference or a capture error is recorded in the run JSON, never allowed to fail the gate. The one environment-dependent state (replay) is classified in the run JSON as `kernel-unavailable` rather than asserted, matching the mission's "record as not-yet-baselined" rule.

2. **Does it change product treatment (must NOT)?**
   No. The diff adds: `src/validation/uv0-inventory.ts` (pure module), `src/app/uv0TestHandle.ts` (test-only handle), a query-param-gated install block in `src/app/bootstrap.ts` (Stream B seam), the smoke spec, the fast test, and docs/gitignore. `World.ts`, all panels, `src/moneta/**`, `src/wasm/**`, `src/atlas/**`, `package.json`, `vite.config.ts`, and the CI workflow are untouched. Without the `?nemosyne-uv0=1` query parameter the production bundle behaves byte-identically; the handle only adds a read/summon surface and mutates nothing at install.

3. **Does the inventory reflect the real visible scene, not aspirational design?**
   Every `visibleAtBoot: true` claim was checked against the real constructor/default (e.g. MovablePanel meshes default `visible: true`; MiniOverview/PeerPresence enabled by default; Dashboard zones recompute `zone.visible` each frame so wall cells show; `#nemosyne-loader` is appended and never hidden; `#overlay` is never hidden). The classification rationale for each entry cites the §16 table plus the observable current behavior (e.g. MonetaDiagnosticHUD visible at boot in analyst mode, Dashboard wall present at boot, `AnalystJourneyControls` as the primary desktop surface). The Draco/Moneta diagnostic naming collision is recorded as a finding rather than papered over.

4. **Do assertions prove the states were reached?**
   Yes, and they are the gate: telemetry `LAYOUT:`+`GEOM:`+`BEHAVIOR:` and status `Ready` prove boot+frame; `NIL:` text + `NIL outcome recorded` prove the Moneta refusal path; `Evidence ready` + `Observation recorded` plus `evidenceCount>0`/`observationCount>=1` prove the ledger was populated; `inspectorVisible`/`taskSurfaceVisible` true prove the node-select path ran. A state whose assertion fails cannot emit a "passing" screenshot for that state.

5. **Did it cross Stream A/C ownership?**
   No. Stream B owns `visible-product evidence`, `desktop analyst shell`, and `src/app/bootstrap.ts` is Stream B's documented seam (`docs/ROADMAP.md:186`). No `src/moneta`, `src/wasm`, `src/atlas`, signalling, NetworkManager, or pose-serializer file was touched, and no analytical code was added or moved.

6. **Is the claim narrower than or equal to the evidence?**
   Claims: (a) a reproducible 5-state production-build baseline with state-gated screenshots + linked run JSON — proven by the spec's assertions and artifacts; (b) a complete, schema-valid, drift-pinned inventory of normal-mode visible surfaces — proven by the fast test's hardcoded expected set and validation; (c) the fresh-start path + friction recorded — proven by the static doc. Unproven/recorded-as-deferred: IWER/simulator poses, Quest physical evidence, and replay in a kernel-less local worktree (classified in the run JSON, proven in CI where the kernel ships). No claim exceeds the evidence.

## Disposition

- **BLOCKER:** none.
- **DEFER (valid, non-blocking):**
  1. **IWER/simulator poses for the canonical states.** P1-UV0 lists them; this checkpoint deliberately stops at the deterministic desktop production path. A simulator pose baseline is a natural B4/B5 continuation.
  2. **Screenshot pixel contracts (visual-regression diffing).** This baseline writes evidence screenshots but does not diff pixels (renderer variance across CI runners makes a hard pixel gate a separate decision). B4/B5 may promote the same artifacts into an actual diff gate once a single governed renderer is pinned.
  3. **`AnalystJourneyControls` remains the primary desktop surface (REPLACE).** Reclassified but not changed in B3; B4 (task-first shell) owns the change.
  4. **`#overlay` stays visible over the live scene.** Recorded as `DEMOTE`; no change in B3.
  5. **Kernel-dependent state reachability in a local worktree without a compatible `wasm/pkg`.** NIL/evidence/replay are CI-proven; local runs without a working kernel get replay classified `kernel-unavailable` and a `kernel: unavailable` run header instead of a hard fail. Verified locally with the worktree's symlinked wasm where available.
- **SUGGESTION:**
  1. Surface the run-JSON `kernel` field and per-state asserted flags in the PR body so reviewers can confirm the states were real.
  2. A follow-up could expose the run JSON path on the `test:smoke` summary line.

## Residual risk

- The focused-observation state dispatches the real `_showDataCard`/`onInspect` handlers directly rather than simulating a pointer-ray hover+click; the skipped boundary is the raycast hover mechanics (`InteractableRegistry.hovered`), which are exercised by the existing `tests/selection-dispatcher.test.ts`/`tests/input-router.test.ts` unit surface. The state that matters for the baseline (inspector/task surface visible) is produced by the identical production handlers the real select path calls.
- Replay is kernel-dependent and is `kernel-unavailable`-classified where no kernel exists; CI ships the kernel (production-build runs `npm run wasm`), so CI exercises the real replay path.
- `wasm/pkg` in this worktree is a symlink to the main repo; `npm run build` (which runs wasm-pack) would write through the symlink and clobber the main repo's pkg, so local verification used `npx vite build` (no wasm build) + `vite preview`. CI's playwright-smoke job is the authoritative kernel-present run.
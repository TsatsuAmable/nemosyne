## Current Status

> **Single source of truth for project state.** Read this block FIRST on pickup and
> update it BEFORE stopping. Other docs (CLAUDE.md, `.agents/`) point here — they do
> not duplicate state.

- **Last updated:** 2026-08-11 · #90 merged — **Phase 22 — UX V2.0** Sprint 22.2 landed.
  Sprint 22.1 (#88) + Sprint 22.2 (#90) both merged. Sprint 22.2 shipped: TDA on-demand
  (statistical lens hidden by default; Views → Lens wheel item is the explicit request path),
  Draco menu shorter (640 px / 0.72 m), tour expanded 13 → 19 stops, WIMP best-practices
  (shared `palette.ts` tokens, unified `TourStep`/`Tour` types, dead-code cleanup),
  Low-Strain + Muted theme presets, and full button-surface test coverage (+48 tests).
  Gates green: `tsc` 0 · `eslint` 0 errors (186 warnings) · `vitest` 1272/9/0 ·
  `build` ~275 KB gzip. Sprints 22.3/22.4/22.5/22.6/22.7 🔲 not started (scoped from
  `docs/USER_STORIES_AND_UX_ANALYSIS.md` — 29 user stories + gap/UX audit — plus a second
  architecture/research review and a third UX/user-journey review, both verified 2026-08-11).
  **Doc staleness fixed this PR:** `SampleDatasets.js`→`.ts` across 6 doc files;
  `DataCard`→`HolographicInspector` in GETTING_STARTED; test-count 1191→1272 in README +
  TEST_READY (verified by `npm test`: 1272 pass / 9 skip / 182 files).
  ⚠️ On-device validation owed (Sprint 22.1 + 22.2): dashboard distance (~1.35 m → ~2.55 m),
  transient reduced-motion vignette comfort, TDA-on-demand feel, Draco short-frame scroll
  readability, new tour stop targets, Low-Strain/Muted slate backdrops + neon-on-selection
  contrast — all in-headset before advancing to Sprint 22.3.
- **Active branch:** `main` (clean, synced; #81–#90 merged). Note:
  `feature/phase20-graphics-optimization` is a stale, superseded branch (older `World.ts`,
  lacks #77–#90) — not unmerged work.
- **Working tree:** clean. Recent merges — #90 Phase 22 Sprint 22.2 · #89 ROADMAP refresh
  (#88) · #88 Phase 22 Sprint 22.1 UX quick wins · #86
  distill all plans into ROADMAP.md as single reference · #84 Node 24 single-leg CI +
  cross-platform lockfile fix + Netlify 24 · #82 f15 e2e test-isolation fix (un-awaited
  `import('src/main.ts')` racing jsdom teardown) · #81 WASM capability honesty hardening
  (bitfield realigned to spec; dormant command-buffer `0` sentinel; `readBytes` bounds guard;
  `COMMAND_BUFFER requires SCENE_RUST` ordering invariant as a Rust test).
- **Command-buffer decision (B2):** DEFER + minimal hardening (both Expert Graphics
  Engineer & Principal Architect consultations converged). The command buffer targets a
  problem that isn't a *measured* current regression; the JS scalability layer already
  implements the spec's instancing tiers. Revisit after load-testing the JS path at 65k+.
  PR #80 (merged) delivered the harness that produces that data; #81 (merged) delivered the
  honesty hardening that is its precondition if the run says "implement". Privacy (PR #80):
  perf/UX aggregates only, local dev-server endpoint, no external API, no user dataset
  rows/session snapshots. Verdict computed from real measurements against fixed reviewable
  thresholds — no hardcoded results.
- **Last gate:** `cargo test --manifest-path wasm/Cargo.toml` 30 pass / 0 fail (3 honesty
  tests) · `tsc --noEmit` 0 errors · `eslint` 0 errors (186 warnings, baseline) ·
  `vitest run` 1272 pass / 9 skip / 0 fail · `vite build` green (~275 KB gzip total) —
  2026-08-10. (JS honesty-lock assertions in `wasm-runtime.test.ts` are `maybeDescribe` —
  skipped in jsdom without a served wasm; the Rust test is the authoritative lock.)
- **Merge policy (live):** main ruleset `id=20623327` requires PR + required checks
  (`Rust unit tests (wasm/)` / `Node 24` / `approval-gate`), no bypass.
  `approval-gate.yml` passes immediately for owner PRs (squash auto-merge on green);
  others need owner approval. New work lands via PR only. (`Playwright load smoke` is
  informational/non-required — NOT in the ruleset.) Required-checks list updated to
  `Node 24` with #84 (was `Node 20`/`Node 22`).
- **Recently merged:** #90 Phase 22 Sprint 22.2 — TDA on-demand, Draco/tour/WIMP polish,
  button-test coverage, Low-Strain/Muted presets · #89 ROADMAP Current Status refresh (#88)
  · #88 Phase 22 Sprint 22.1 — UX V2.0 convergence quick wins (panel distance no-op fix,
  wheel-menu ray mismatch, Undo/Redo, transient reduced-motion vignette) · #86 distill all
  plans into ROADMAP.md as single reference (Phase 21 WASM migration + audit + TS-first docs
  + 7 .js stubs removed) · #84 Node 24 single-leg CI + cross-platform lockfile fix +
  Netlify 24 · #82 f15 e2e test-isolation fix (un-awaited `import('src/main.ts')` racing
  jsdom teardown) · #81 WASM capability honesty hardening (bitfield realigned to spec;
  dormant command-buffer sentinel) · #80 VR load-test harness (command-buffer decision B2)
  · #78 global WebGL mock deficiencies fix (Option 3c) · #76 Playwright real-WebGL load smoke
  (Track A) · #74 render-loop GL introspection tripwire (Track B). Real-WebGL coverage thread
  closed. Binary-parser length-field bounds thread closed (#70/#72).
- **In progress / next:** (1) **on-device validation** of Phase 22 Sprint 22.1 + 22.2
  perceptual changes (dashboard ~1.35 m → ~2.55 m; transient reduced-motion vignette comfort;
  TDA-on-demand feel; Draco short-frame scroll; new tour stops; Low-Strain/Muted backdrops +
  neon-on-selection contrast) on a Quest before advancing to **Sprint 22.3**; (2) user
  connects Quest, runs the full load-test staircase in XR (`npm run dev` → wheel menu Load
  Test → Start, or desktop `KeyT`/`Shift+T`); (3) read `logs/loadtest-results.jsonl` and
  deliver the implement/descope verdict for B2 (if "implement", build `SCENE_RUST` →
  `COMMAND_BUFFER` per the ordering invariant now encoded as a Rust test). (4) **Sprint
  scoping from the UX audit** (`docs/USER_STORIES_AND_UX_ANALYSIS.md`): **22.3** now covers
  accessibility (colorblind data-encoding gap + per-mode remap + dwell-delay stepper +
  hand-wheel dominant hand), **onboarding last-mile** (wire the built-but-never-instantiated
  `JITGestureHintManager` + `FrustrationResponseManager` — both grep-confirmed dead in
  production), **analysis completeness** (aggregate placeholder → real `AGGREGATE_BARS`;
  Streamline/Geo layout honesty), and dead-code cleanup; **22.4** keeps spatial zonation +
  foveation + diegetic and adds the **four-tier-instancing spec/impl reconciliation** (decide:
  implement `GL_POINTS` tier vs. correct `CLAUDE.md` to the two-tier reality); **22.5** (new)
  wires the built-but-dead **collaboration embodied-presence** stack
  (`PeerAvatarManager`/`CollaborativeStateSync`/`BinaryPoseSerializer` + full quaternion
  broadcast); **22.6** (new, from a second architecture/research review) covers data/Draco
  correctness (`_correlationMatrix` pairwise-complete fix — P0, feeds representation
  selection), confidence-bearing facts, stable `datumId`, `Dataset` immutability-model
  decision, `World`→composition-root shrink, dependency-direction rule, event-bus discipline,
  `updatables` typing, `three`/`@types` version alignment, `allowJs` review, `src/ai` README
  staleness, semantic-mark-vs-visual-skin separation, load-test transition metrics. **22.7**
  (new, from a third UX/user-journey review — factually accurate, no false headlines) holds
  the task-first workflow items: Draco "Why this view?" / "Explain this" explainer (P0,
  verified missing — `DracoDiagnosticHUD` is a weight tuner, not an explainer), task-first
  onboarding with templates as the front door + a guided "Find the Fraud" investigation,
  precision/detail transition (use space for discovery, conventional representations for
  precision), investigation-timeline / analytical-narrative provenance for the returning
  analyst (wire the built-but-dead annotation/bookmark classes), navigation-cost
  instrumentation (analysis_time vs navigation_time); plus a record correction that the
  review's "no in-app import" framing is inaccurate (`FileLoader.ts` is an in-app overlay at
  `World.ts:401`). Sprint 22.3 also gains a first-class **Compare** operation (verified
  missing — named in the conceptual loop but not implemented), an **input parity matrix**
  (accessibility), and **error-recovery UX messaging**. The research-direction items
  (2D-vs-VR experimental harness, human-performance benchmark, semantic/structural position
  discipline, evidence-informed Draco loop, hardware-validation matrix, 5-level evidence
  hierarchy, 5-study research programme, UX-cost composite, frustration-analyzer-as-signal)
  are recorded under **Planned but not actioned → Research validation**. **"Dwell
  Select" is a working feature, not a defect** — record corrected, do not chase. **Live site
  is in sync** (three.js/WebXR, verified 2026-08-11) — the review's "serves A-Frame/D3" P0 is
  stale; do not chase, though exposing build/commit metadata is a valid cheap follow-up.
- **Blockers / open:** B2 (WASM command-buffer) — deferred pending real-headset
  load-test data from the PR #80 harness. Honesty hardening (#81) + f15 isolation (#82)
  now DONE (precondition met). **The harness has not yet been run** —
  `logs/loadtest-results.jsonl` does not exist (`logs/` holds only `vr-remote-console.log`);
  the staircase can be exercised on desktop (`KeyT`/`Shift+T`) but GPU/latency fidelity
  needs a Quest.
- **Resume pointers:** test inventory → `TEST_READY.md`; WASM migration technical
  standards + working notes → `.claude/plan.md` (status tracked here in §Phase 21);
  this file's Current Status is the source of truth.

### How to update this block
1. On pickup: read this block first; read resume pointers only if you need detail.
2. Before stopping: refresh *every* bullet above with current truth (date, branch,
   tree state, gate result, next action, blockers). Keep it to ~10 lines.
3. Never let the bullets go stale — a stale "next" is worse than none.

---

# Nemosyne Roadmap

This roadmap follows a phased structure adapted to the current three.js/WebXR runtime core.

### Completed work-streams

Cross-cutting work-streams that are **done** and recorded here (not in
`.claude/plan.md`) as the single reference:

- **TypeScript migration** ✅ — the entire JS source tree was converted to `.ts`
  (import maps + Vite; `tsc --noEmit` is a required CI gate). The 7 stale `.js`
  re-export stubs left behind were removed in the distillation PR.
- **Docs-site refactor** ✅ — `docs/index.html`, examples, dataset mapping, and
  use-case blurbs.

---

## Phase 1 — Foundation ✅

- [x] Git repository initialized.
- [x] Working three.js/WebXR runtime on Meta Quest 3S.
- [x] WebXR session binding compatible with Quest Browser.
- [x] Controller and hand tracking input routing.
- [x] Basic telemetry and diagnostic panels.
- [x] Unit tests with Vitest.

## Phase 2 — Specification ✅

- [x] Draco-style constraint engine.
- [x] Topology fact extraction (tabular, graph, hierarchy, vector, time-series).
- [x] Hard/soft constraint rule registration and weighted scoring.
- [x] Spec serializable as JSON.

## Phase 3 — Core Framework ✅ 🔄

- [x] `Dataset` with typed columns and encodings.
- [x] `VRTopologyTranslator` synthesizing artefacts.
- [x] World-space data inspection via DataCard.
- [x] Independent, moveable HUD panels (`MovablePanel`, `PanelManager`).
- [x] Live streaming connectors (`WebSocketAdapter`, `PollingAdapter`, `OpenDataSources`).
- [x] Hand-attached radial wheel menu.
- [x] HUD panels clustered around a central anchor point.
- [x] Incremental live-stream updates.

## Phase 4 — Examples & Documentation 🔄

- [x] `README.md`, `docs/IDEOLOGY.md`, `docs/ARTEFACTS.md`, `docs/INTERACTIONS.md`, `docs/ARCHITECTURE.md`, `docs/GETTING_STARTED.md`.
- [x] Complete `docs/ROADMAP.md` and keep it current.
- [x] Expand built-in sample datasets (financial, geospatial, process-flow).
- [ ] Add tutorial screencasts or screenshots.

## Phase 5 — Artefact Library Expansion ✅ 🔄

- [x] Add Column, Orb, Token, Plinth, Beam, Trail, Ring, Field, Zone artefact variants.
- [x] Add geospatial and flow topologies.
- [x] Add real force-directed, radial-tree, and time-ribbon layout generators.
- [x] Add lightweight TDA artefact glyphs (persistence barcode, mapper graph, Betti curve).
- [x] Add data-operation transforms (filter, aggregate, sort, time-slice, cluster).

## Phase 6 — Real-World Deployments 🔄

- [x] Production build and deployment pipeline (`vite build`, Netlify, Vercel).
- [x] GitHub Actions CI workflow (`.github/workflows/ci.yml`).
- [x] Desktop fallback with mouse/keyboard (`DesktopControls`).
- [x] Efficient data transmission hooks (Apache Arrow IPC, FlatBuffers, MessagePack serializers + `WebSocketAdapter.binaryParser`).
- [x] Multi-user collaborative memory palaces (see Phase 10B).
- [x] Neural predictive layer for soft-constraint weight recommendation (see Phase 11).

## Phase 7 — VR Comfort, Scalability & Interaction Metaphors ✅

- [x] Recalibrate panel anchor to ~0.55 m (Meta Quest comfort zone).
- [x] Detach radial wheel menu from wrist; body-lock it in front of the chest.
- [x] Add procedural audio + visual selection feedback (`SelectionFeedback`).
- [x] Build scalable rendering package (`InstancedPointCloud`, `SpatialIndex`, `LODManager`).
- [x] Add scale-aware facts and hard/soft constraints to `ConstraintEngine`.
- [x] Add `INSTANCED_POINT_CLOUD`, `CLUSTER_VOLUME`, and `AGGREGATE_BARS` artefact paths.
- [x] Implement six interaction metaphors: Resonance Pulse, Fork Plane, Chrono Dial, Constellation, Beacon, Aleph.
- [x] Update tests and documentation for all of the above.

## Phase 8 — Deeper Analytics & TDA Artefacts 🔄

- [x] **Sprint 8.1** — Statistical facts engine (`columnStats`, `correlationMatrix`, `categoryDistribution`, temporal trend/seasonality, outlier detection).
- [x] **Sprint 8.2** — Advanced clustering (`hierarchical`, `dbscan`, k-means++ seeding, `ClusterTransforms.ts`).
- [x] **Sprint 8.3** — Anomaly & outlier layer (`anomaly` operation with IQR/Z-score/isolation methods, ORB halo rendering, outlier lens).
- [x] **Sprint 8.4** — 2D chart planes in VR (`ChartPlane` artefact for bar/line/histogram/box/correlation plots, auto-attached by `VRTopologyTranslator`).
- [x] **Sprint 8.5** — TDA artefact factory (`TDAMapper`, persistence barcode, mapper graph, Betti curve).

## Phase 9 — Production Polish & Game-Inspired UX ✅

- [x] **Sprint 9.1** — Diegetic data inspector (`HolographicInspector.js`).
- [x] **Sprint 9.2** — Contextual gaze tooltips (`TooltipManager`).
- [x] **Sprint 9.3** — Constellation / nested radial menus.
- [x] **Sprint 9.4** — Spatial dashboard wall with snap zones (`DashboardManager.ts`, `ChartPlanePanel.ts`, dashboard reset in wheel menu).
- [x] **Sprint 9.5** — Teleport anchors and comfort vignette (`locomotion.teleportToAnchor`, overview/detail anchors).
- [x] **Sprint 9.6** — Guided tour system (`GuidedTour`, `DefaultTour.js`).
- [x] **Sprint 9.7** — Dual-hand gestures, analysis history undo/redo, settings panel, feedback customization.
- [x] **Sprint 9.8** — Hand-pointer anchoring, gesture cooldown/threshold tuning, production test hardening.
- [x] **Sprint 9.9** — Visual polish and atmosphere presets (`WorldTheme.ts`, ambient particles, portal/TechnoCore glow pulses, dataset-key atmosphere mapping).

----

## Evaluation Checkpoint — End of Phase 9

*Status as of 2026-07-28, written after completing Phase 9. Test counts have grown since; see TEST_READY.md for the current number.*

### Goal delivery

The project’s core thesis — multi-dimensional datasets become interactive 3D memory palaces — is **demonstrated end-to-end**. The constraint-driven Draco pipeline, artefact taxonomy, multi-modal input model, statistical aids, live connectors, and atmosphere layer all work together in a single WebXR/three.js runtime. Most of the foundational vision is implemented and tested, with rough edges and unfinished features remaining — this is a personal, experimental project, not a finished product.

### Strengths

- **Architecture:** Clean separation between Engine, World, artifacts, UI, interactions, and data layers.
- **Test discipline:** A growing Vitest suite (1191 pass / 9 skip — see TEST_READY.md) makes refactoring safe for a WebXR codebase.
- **Constraint-driven synthesis:** `DracoTopologyNode` + `ConstraintEngine` turn data facts into layout/interaction/geometry specs rather than hard-coding one chart per dataset.
- **Unified input:** `HandGestureRecognizer`, `InputRouter`, `HandPointer`, `ControllerPointer`, `DesktopControls` share one model across VR and desktop.
- **Atmosphere as signal:** Theme presets tied to dataset mood make the environment itself convey information.
- **Diegetic UI:** Panels, wheel menus, and inspector live in world space, respecting immersion.

### Critical gaps and missing capabilities

1. **Hardware/runtime validation.** Frame time and draw-call budgets are now enforced in-engine with a live Performance panel; Quest Browser GPU memory and hand-tracking latency still need device-specific measurement.
2. **Broad data ingestion.** No CSV/Excel/Parquet import, SQL/warehouse connectors, schema-mapping UI, or API authentication.
3. **Output, provenance, and sharing.** Screenshot export, JSON analysis-story export, operation-log panel, and opt-in telemetry are implemented; annotations, bookmarks, shared links, and persistent revision history are still missing.
4. **Collaboration.** Single-user only; no voice, avatars, synchronized cursors, or shared state.
5. **Accessibility.** Colorblind palette remapping, text scaling, high-contrast UI mode, and dwell-selection motor alternative are implemented. Audio descriptions and full WCAG-equivalent coverage are still missing.
6. **Graceful degradation.** GPU context loss, tracking loss mid-gesture, malformed CSVs, and network stalls need explicit recovery paths.
7. **Evidence of value.** No user studies, task benchmarks, or telemetry to prove spatial analysis improves insight speed/accuracy over 2D tools.

### How it differs from related work

Nemosyne is a personal exploration of metaphor-first, embodied spatial analysis, not a competitor to shipping products. Compared with notebook/BI tools (Tableau, Power BI, Observable) it trades chart grammar, broad connectors, and provenance for immersion and the memory-palace metaphor; compared with one-off three.js/A-Frame viz demos it adds real analysis operations, undo/redo, live data, and tests; compared with enterprise VR analytics (e.g. Virtualitics) it lacks validated studies, connector breadth, and SSO. It is best understood as an experiment, not a replacement for any of these.

### Recommended decision gate before Phase 10

Do **not** jump straight into multi-user collaboration. First satisfy these four prerequisites:

1. **Quest Browser validation pass** — capture frame-time, GPU memory, and hand-tracking latency baselines.
2. **Canonical file-import flow** — CSV → `Dataset` with encoding inference, so non-developers can use the tool.
3. **First usability benchmark** — define a repeatable task (e.g., “find the top outlier”) and compare Nemosyne against a 2D dashboard.
4. **Non-functional requirements baseline** — performance budget, error boundaries, accessibility targets, telemetry, and state persistence.

Only after those four are met should the roadmap choose between **Phase 10A: Validate & Harden** or **Phase 10B: Scale & Collaborate**.

## Phase 10 — Decision Gate: Validate & Harden OR Scale & Collaborate ⏳

*Phase 10 is intentionally a fork. The prerequisites above determine which track is selected.*

### Track A — Validate & Harden (recommended if hardware/provenance gaps are not closed)

- [x] **Sprint 10A.1** — Quest Browser performance profiling and performance budget enforcement.
- [x] **Sprint 10A.2** — CSV file import with robust parsing, automatic topology/schema inference, and error boundaries (Excel/Parquet deferred to future plugin importers).
- [x] **Sprint 10A.3** — Session persistence (`IndexedDB`): dataset, camera pose, operation history, settings, tour progress, with auto-save and wheel-menu actions.
- [x] **Sprint 10A.4** — Export and provenance: PNG/WebP capture of renderer output, downloadable JSON analysis story, in-VR operation log panel.
- [x] **Sprint 10A.5** — Accessibility pass: colorblind-safe palettes, text scaling, high-contrast, motor-accessible input alternatives.
- [x] **Sprint 10A.6** — Telemetry and observability: session metrics, gesture counts, frame drops, error rates; opt-in only.
- [x] **Sprint 10A.7** — Gesture coaching and controller equivalence: running interaction commentary panel, hand-gesture to Meta Quest controller mapping, controller gesture mapper.

### Track B — Scale & Collaborate (recommended only after Track A prerequisites are satisfied)

- [x] **Sprint 10B.1** — Networking foundation (WebRTC data channels, signalling server, room model, wheel-menu join/leave, in-VR network status panel).
- [x] **Sprint 10B.2** — Free-floating, persisted HUD panels: panels no longer forced into the analyst-anchor arc, drag in cameraGroup local space, positions/visibility saved with the session.
- [x] **Sprint 10B.3** — Shared state synchronisation (dataset, operations, camera pose, selections).
- [x] **Sprint 10B.4** — Presence & avatars (voice-less or voice-optional, hand/controller avatar, name tags).
- [x] **Sprint 10B.5** — Shared annotations, bookmarks, and tours.
- [x] **Sprint 10B.6** — Asymmetric desktop companion (2D view of the same session for non-VR stakeholders).

### Deferred longer-term work

- [x] Neural predictive layer for soft-constraint weight recommendation (`NeuralConstraintPredictor.ts`).
- [ ] Direct SQL / data-warehouse connectors.
- [ ] Scientific user studies comparing spatial vs. 2D analysis workflows.

---

## Phase 11 — On-Device AI Intelligence, Low-Token Observability & WebXR Ergonomics ✅

- [x] **Sprint 11.1 — Analyst Torso Anchor & Ergonomics**: Reparented scene anchor to analyst torso (`analystAnchor`) at `~1.35m` chest height, continuously tracking headset position and yaw orientation.
- [x] **Sprint 11.2 — Dual Vertical Multicoloured Wheel Menus**: Redesigned `HandWheelMenu.ts` into twin vertical arcs on left (`-0.36m`) and right (`+0.36m`) side of torso with wide rectangular pill geometry (`0.24m x 0.075m`), 30px+ fonts, and horizontal action fan-outs.
- [x] **Sprint 11.3 — Guided Tour Onboarding & Sequential Progression**: Fixed single-step auto-advance guards so tour counts sequentially `1/9` through `9/9`. Added Data Loading, Saving/Exporting, Collaboration, and Data Characteristics demonstration steps.
- [x] **Sprint 11.4 — On-Device UX Frustration Engine & Low-Token Observability**: Implemented `UXFrustrationAnalyzer.ts` to detect rapid repeated clicking, window thrashing, air-click misses, WASM errors, gesture misfires, and gaze/laser dwell hesitations locally. Generates 8-line token-compressed UX digests.
- [x] **Sprint 11.5 — Gaze/Laser Dwell & Gesture Confidence Telemetry**: Integrated `recordDwell()` in `SelectionDispatcher.ts` and `recordGestureConfidence()` in `WorldInputCoordinator.ts`.
- [x] **Sprint 11.6 — Geometry & Material Object Pooling**: Built `MeshPool` in `src/utils/ObjectPool.ts` and `executeInTimeSlices()` async batch execution to eliminate >200ms dataset load spikes.
- [x] **Sprint 11.7 — Customization Architecture & AI Developer Team**: Defined 4-agent team in `.agents/team.json` (`technical-architect`, `coder`, `qa-engineer`, `reviewer`) and custom Workspace Skill `.agents/skills/vr-accessibility/SKILL.md`.

----

## Phase 12 — AI Tuning, Gesture Validation & UX Feedback Loop Closure ✅

> **Focus:** Close the loop between the intelligence already built (Draco GA, gesture AI, frustration engine) and measurable, user-visible quality. No new major features — deepen, validate, and surface what's already there.

### Sprint 12.1 — Gesture Recognition Validation Harness

Existing coverage in `tests/hand-gesture-recognizer.test.js` tests the recognizer at unit level with synthetic `makePose` stubs, but lacks recorded trajectory fixtures, accuracy assertions, and edge-case coverage.

- [x] `tests/fixtures/gesture-sequences/` — JSON multi-frame trajectory recordings for 6 core gestures: `pinchTogether`, `pinchApart`, `swipeLeft`, `swipeRight`, `scoopUp`, `pushForward`
- [x] `tests/gesture-recognizer-accuracy.test.ts` — TP rate ≥ 90 %, FP rate ≤ 5 % per gesture, asserted from fixtures
- [x] `tests/gesture-edge-cases.test.ts` — cooldown boundary, rapid alternation, dual-hand conflict, controller-equivalent parity
- [x] `GestureConfidenceThresholds` config object in `HandGestureRecognizer` — per-gesture tunable `floor` / `ceiling` replacing magic numbers
- [x] Update `docs/INTERACTIONS.md` with a gesture confidence spec table

### Sprint 12.2 — Draco Recommender Evaluation Suite

The GA solver runs but its recommendation quality is untested against known-good outputs. `DracoDiagnosticHUD` shows weights live but gives no quality signal back to the analyst.

- [x] `tests/fixtures/draco-golden/` — golden pairs covering all primary topology types (`TABULAR`, `GRAPH`, `HIERARCHY`, `VECTOR_FIELD`, `TIME_SERIES`, `GEO`)
- [x] `tests/draco-recommender-quality.test.ts` — topology match precision ≥ 80 %, soft-constraint score evaluation on golden set
- [x] `ConstraintEngine.evaluateCandidate(spec, facts)` public method — exposed for external testability
- [x] `DracoDiagnosticHUD` improvements: live per-constraint contribution bars, last 5 candidate history, colour-coded score delta (green = improved, red = regressed)

### Sprint 12.3 — AI Module Integration & Fine-Tuning

- [x] **`NeuralConstraintPredictor`** — weight normalization & prediction evaluation
- [x] **`GestureClassifierModel`** — ONNX bridge & heuristic classification
- [x] **`UXFrustrationAnalyzer`** threshold calibration: `RAPID_ABANDONMENT` window, `REPEATED_ACTION` floor, `AIR_CLICK_MISS` rate

### Sprint 12.4 — Usability Feedback Loop Closure

- [x] **`FrustrationResponseManager`** (`src/vr/ui/FrustrationResponseManager.ts`) — class + isolated unit test built; surfaces a contextual diegetic hint card when `dissatisfactionScore > threshold`
- [x] **`GestureConfidenceHUD`** panel (`src/vr/ui/GestureConfidenceHUD.ts`) — per-gesture real-time confidence bar visualization
- [x] `tests/frustration-response.test.ts` — assert hint cards appear within 2 operations of threshold breach; assert threshold adapts to expert mode
- ⚠️ **Correction (verified 2026-08-11):** `FrustrationResponseManager` is **never
  instantiated in production** — `new FrustrationResponseManager` appears only in tests,
  never in `src/` (grep-confirmed). The class and its test exist, but the in-VR hint card
  never appears at runtime; the `UXFrustrationAnalyzer` score only reaches the manual
  review-bundle export. Wiring it into the runtime is now **Sprint 22.3** (onboarding
  last-mile). Same applies to `JITGestureHintManager` (built + tested, never instantiated).

### Sprint 12.5 — UI/UX Polish & Data Transition Animations

- [x] **Artefact transition animation** — smooth lerp via `executeInTimeSlices`
- [x] **Panel visual hierarchy pass** — category-coloured left border strip (analytics `#00ffcc`, settings `#ffaa00`, collaboration `#aa44ff`)
- [x] **Empty state designs** for `DataCard`, `OperationLog`, `ChartPlane`

### Sprint 12.6 — Analyst Benchmark Suite (Evidence of Value)

*First structured evidence that spatial analysis delivers real analyst benefit.*

| # | Task | Dataset | Success criterion |
|---|---|---|---|
| 1 | *Find the top outlier* | Financial scatter | Correct node selected via inspector |
| 2 | *Identify the dominant cluster* | Geospatial | Correct cluster label confirmed |
| 3 | *Trace a causal path* | Process-flow hierarchy | Correct leaf-to-root path activated |
| 4 | *Spot a temporal anomaly* | Time-series | Anomaly node inspected within time budget |
| 5 | *Compare two encodings* | Any | Both carousel candidates evaluated, one confirmed |

- [x] **`BenchmarkSession`** (`src/utils/BenchmarkSession.ts`) — instruments each task with `timeToFirstCorrectSelection`, `gestureCount`, `operationCount`, `frustrationScoreAtCompletion`
- [x] Benchmark results exported as JSON alongside the existing analysis story export
- [x] `tests/benchmark-session.test.ts` — all 5 tasks pass under deterministic simulated input

### Sequencing

```
12.1 → 12.3  (gesture fixtures feed AI accuracy tests)
12.2 → 12.3  (golden Draco set feeds predictor eval)
12.1 + 12.2 → 12.6  (benchmark tasks use both)
12.4 → 12.5  (feedback polish builds on closed loop)
```

---

## Phase 13 — Real-World Data Ingestion & Provenance Export Infrastructure ✅

> **Focus:** Make Nemosyne production-ready for arbitrary analyst datasets. Enable non-developers to load CSV files with automatic schema inference, support binary Arrow IPC streams, export interactive 3D analysis storybooks, and handle WebGL context loss gracefully.

### Sprint 13.1 — CSV/TSV Auto-Inference & Field Mapping UI

- [x] `CSVDataParser.ts` — robust client-side CSV/TSV parser handling quoted fields, escaped delimiters, missing values, and automatic type inference (`NUMERIC`, `CATEGORICAL`, `TEMPORAL`)
- [x] `SchemaMappingPanel.ts` — in-VR panel letting analysts confirm column type assignments, cycle types, and apply updated field mappings
- [x] `tests/csv-parser.test.ts` — test suite verifying quoted field parsing, numeric casting, date detection, and type cycling

### Sprint 13.2 — Apache Arrow IPC & FlatBuffers Binary Parsers

- [x] `ArrowBinaryParser.ts` — zero-copy Apache Arrow IPC stream reader extracting Float32 position buffers directly targeting `InstancedPointCloud` attributes
- [x] `tests/arrow-ipc.test.ts` — test suite asserting zero-copy memory parsing accuracy

### Sprint 13.3 — Spatial Analysis Storybook & Provenance Export

- [x] `AnalysisStorybookExporter.ts` — packages session state, dataset snapshot, camera poses, selected filters, annotations, and tour checkpoints into a downloadable JSON/HTML bundle
- [x] Client-side browser download trigger helper
- [x] `tests/storybook-context-recovery.test.ts` — test suite verifying storybook bundle serialization

### Sprint 13.4 — Session Recovery & WebGL Context Loss Safety

- [x] `ContextRecoveryManager.ts` — detects WebGL context loss (`webglcontextlost`), preserves state, and restores GPU buffers on `webglcontextrestored`
- [x] `tests/storybook-context-recovery.test.ts` — test suite simulating WebGL context loss and verifying recovery dispatch

---

## Phase 14 — WebXR Performance, GPU Caching & Memory Optimization ✅

> **Focus:** Eliminate frame-time spikes and memory allocation garbage collection during WebXR analytics sessions on Meta Quest standalone hardware. Implement dynamic canvas texture diff caching, sub-range GPU buffer updates, and an adaptive 90 FPS frame governor.

### Sprint 14.1 — Canvas Texture GPU Re-Upload Caching

- [x] `CanvasTextureCacheManager.ts` — dirty-rect and content hashing manager for `MovablePanel` and `HandWheelMenu` preventing unnecessary dynamic canvas texture GPU re-uploads during user interaction
- [x] `tests/canvas-texture-cache.test.ts` — test suite asserting canvas texture upload skip rate > 80% on unchanged UI frames

### Sprint 14.2 — Sub-Range GPU Buffer Updates for InstancedPointCloud

- [x] `InstancedPointCloud` partial buffer update methods (`updateSubRange(offset, count)`) allowing filtered and clustered point subsets to update GPU attribute sub-ranges without full geometry buffer rebuilds
- [x] `tests/subrange-adaptive-governor.test.ts` — test suite verifying partial GPU attribute buffer updates

### Sprint 14.3 — Adaptive WebXR Frame & Thermal Governor

- [x] `AdaptiveFrameGovernor.ts` — continuously monitors WebXR frame render time; dynamically scales particle counts, LOD culling distances, and shadow resolution when frame time breaches 11.1ms (90 FPS target on Quest 3S)
- [x] `tests/subrange-adaptive-governor.test.ts` — test suite simulating frame time spikes and verifying governor LOD scaling response

---

## Phase 15 — Collaborative Spatial Memory Palaces ✅

> **Focus:** Enable multi-analyst spatial collaboration. Synchronize active datasets, filter states, 3D selection highlights, hand avatars, and spatial pointers across WebRTC peer connections.

### Sprint 15.1 — Multi-User WebRTC Data Channel State Sync

- [x] `CollaborativeStateSync.ts` — P2P WebRTC data channel state synchronizer replicating active dataset selection, filter operations, and camera transform vectors
- [x] `tests/collaborative-sync.test.ts` — test suite verifying state broadcast and peer delta merging

### Sprint 15.2 — Peer Avatars & Synchronized Spatial Pointers

- [x] `PeerAvatarManager.ts` — renders lightweight headset & hand avatars for connected remote analysts with color-coded laser pointers and gaze target indicators
- [x] `tests/peer-avatars-annotations.test.ts` — test suite verifying peer avatar transform updates

### Sprint 15.3 — Shared Annotations & Co-Op Benchmark Sessions

- [x] `SharedAnnotationManager.ts` — synchronized 3D spatial pin drop annotations and collaborative benchmark session scoring
- [x] `tests/peer-avatars-annotations.test.ts` — test suite verifying annotation sync across peer sessions

---

## Phase 16 — Voice & Natural Language Spatial Query Engine ✅

> **Focus:** Enable hands-free natural language spatial interaction. Parse spoken voice commands into Nemosyne operations and generate Web Speech API audio narration for analytics discoveries.

### Sprint 16.1 — Web Speech API Natural Language Query Listener

- [x] `VoiceCommandListener.ts` — Web Speech API speech recognition engine parsing spoken voice phrases (*"filter revenue above 200"*, *"show graph view"*, *"reset layout"*) into executable Nemosyne `Operation` commands
- [x] `tests/voice-spatial-engine.test.ts` — test suite verifying intent classification and query parsing

### Sprint 16.2 — Diegetic Audio Feedback & Narration

- [x] `SpatialAudioNarrator.ts` — Web Speech API speech synthesis engine providing spoken audio narration for operation execution, anomaly alerts, and guided tour steps
- [x] `tests/voice-spatial-engine.test.ts` — test suite verifying audio narration queueing and speech synthesis options

---

## Phase 17 — Architectural Hardening & Structural Refactoring ✅

> **Focus:** Address structural debt, monolithic God objects, main-thread blocking operations, and network fragmentation identified in technical architecture critique.

### Sprint 17.1 — Decompose `World.ts` Monolith

- [x] `SceneGraphController.ts` — extract Three.js scene graph initialization, lighting, camera anchoring, and render loop setup
- [x] `WorkspaceManager.ts` — extract dataset loading, active layout switching, and artifact registration
- [x] `tests/world-controllers.test.ts` — test suite verifying decomposed scene graph & workspace controllers

### Sprint 17.2 — Web Worker Offloading for Heavy Computations

- [x] `CSVParserWorker.ts` — offload CSV/TSV parsing and type inference off the WebXR main render thread
- [x] `DracoSolverWorker.ts` — offload statistical fact extraction (`extractFacts`) and Genetic Algorithm constraint solving off the main render thread
- [x] `tests/worker-offloading.test.ts` — test suite verifying async worker message passing and result accuracy

### Sprint 17.3 — Unified WebRTC Networking & Binary Pose Streaming

- [x] `BinaryPoseSerializer.ts` — replace high-frequency 20Hz `JSON.stringify` camera pose broadcasts with compact 32-byte binary `Float32Array` buffers
- [x] `tests/binary-pose-governor-binding.test.ts` — test suite verifying binary pose serialization and state convergence

### Sprint 17.4 — Connect `AdaptiveFrameGovernor` to Scene Renderers

- [x] Bind `AdaptiveFrameGovernor` `_lodScaleFactor` directly to `InstancedPointCloud` instance counts (`applyLODScale()`)
- [x] `tests/binary-pose-governor-binding.test.ts` — test suite asserting active scene load shedding when governor throttles

---

## Phase 18 — Production Runtime Integration & Worker Hardening ✅

> **Focus:** Wire Phase 17 architectural abstractions into production runtime loops of `World.ts`, `Engine.ts`, `CollaborativeStateSync`, and `InstancedPointCloud`. Implement dedicated Web Workers via Blob URLs and binary pose channel transport.

### Sprint 18.1 — Wire `SceneGraphController` & `WorkspaceManager` into `World.ts`

- [x] Instantiate and delegate scene graph setup, camera positioning, torso updates, and dataset state to `SceneGraphController` and `WorkspaceManager` inside `World.ts`
- [x] `tests/production-runtime-wiring.test.ts` — test suite asserting `World.ts` delegates to sub-controllers

### Sprint 18.2 — Dedicated Web Workers (`Blob` URL Workers)

- [x] Implement true dedicated Web Workers using Blob URL constructors (`Worker`) in `CSVParserWorker.ts` and `DracoSolverWorker.ts`
- [x] `tests/production-runtime-wiring.test.ts` — test suite asserting off-thread message passing

### Sprint 18.3 — Binary WebRTC Pose Streaming Transport

- [x] Wire `BinaryPoseSerializer` into `CollaborativeStateSync.ts` to transmit 32-byte ArrayBuffer camera poses instead of JSON strings
- [x] `tests/production-runtime-wiring.test.ts` — test suite verifying ArrayBuffer transmission over WebRTC data channels

### Sprint 18.4 — Closed-Loop Adaptive Governor Animation Integration

- [x] Connect `AdaptiveFrameGovernor.recordFrame()` inside `Engine.ts` animation loop and push `lodScaleFactor` to active `InstancedPointCloud` instances
- [x] `tests/production-runtime-wiring.test.ts` — test suite asserting active frame time measurement and reactive point cloud scaling

---

## Phase 19 — Architectural Hardening & Zero-Copy Protocol ✅

> **Focus:** Address multi-user peer collision vulnerability in binary pose sync, eliminate per-frame GC allocations via static typed array views, and complete reactive governor event loops.

### Sprint 19.1 — Multi-User Binary Peer ID & Monotonic Sequence Tracking

- [x] Add numeric peer ID header and sequence validation to `BinaryPoseSerializer` and `CollaborativeStateSync.ts` to prevent remote peer state collisions in 3+ user rooms
- [x] Reuse static ArrayBuffer views to eliminate 3x object allocations per tick during 90Hz pose broadcasts
- [x] `tests/zero-copy-network-sync.test.ts` — test suite verifying peer ID demuxing and sequence drop protection

### Sprint 19.2 — Closed-Loop Governor Event Dispatch & Reactive Rendering

- [x] Dispatch `WorldTopics.PERFORMANCE_THROTTLE` events when `AdaptiveFrameGovernor` adjusts `_lodScaleFactor`
- [x] Bind `InstancedPointCloud` and layout particle instances to throttle events reactively
- [x] `tests/governor-event-loop.test.ts` — test suite asserting reactive scene load shedding under throttle events

### Sprint 19.3 — Delegate Workspace Node Lifecycle to WorkspaceManager

- [x] Delegate dataset node group mounting, layout group cleanup (`clearDataset()`), and artifact node registration to `WorkspaceManager`
- [x] `tests/workspace-node-lifecycle.test.ts` — test suite verifying workspace dataset node group delegation

---

## Phase 20 — Graphics Engine Optimization & 90 FPS WebXR Rendering ✅

> **Focus:** Optimize WebGL render pipeline for Meta Quest 3S (11.1ms / 90 FPS budget). Eliminate per-frame GC allocations, bypass static UI canvas texture re-uploads via DJB2 state hashing, enable Early-Z culling, and harden WebGL context loss recovery.

### Sprint 20.1 — Zero-Allocation Instanced GPU Buffer Pipeline

- [x] Eliminate per-frame object allocations in `InstancedPointCloud.setPoints()`; reuse static `InstancedBufferAttribute` typed arrays and update sub-ranges
- [x] Enable `depthWrite: true` and `depthTest: true` on instanced point materials to enable Meta Quest 3S TBDR Early-Z culling
- [x] Fix `DracoTopologyNode` mesh pool release/disposal lifecycle
- [x] `tests/zero-alloc-instanced-buffer.test.ts` — test suite verifying buffer re-use and sub-range update flags

### Sprint 20.2 — UI Canvas Texture Upload Bypassing

- [x] Integrate `CanvasTextureCacheManager` into `MovablePanel.render()` to compute DJB2 state hashes
- [x] Bypass `texture.needsUpdate = true` on static UI frames to eliminate 3-6ms GPU upload stalls
- [x] `tests/zero-alloc-instanced-buffer.test.ts` — test suite verifying texture upload bypass on unchanged UI state

### Sprint 20.3 — Robust WebGL Context Loss & GPU Buffer Recovery

- [x] Consolidate `webglcontextlost` and `webglcontextrestored` handling into `ContextRecoveryManager.ts`
- [x] Re-flag geometry buffer attributes dirty and force material re-compilation on context recovery
- [x] `tests/storybook-context-recovery.test.ts` — test suite verifying scene restoration after context loss

### Sprint 20.4 — Closed-Loop 90 FPS Governor Load Shedding

- [x] Measure frame deltas via `XRFrame` timestamps and push `lodScaleFactor` directly into `InstancedPointCloud.applyLODScale()` during `Engine._tick()`
- [x] `tests/production-runtime-wiring.test.ts` — test suite asserting reactive load shedding under GPU load

---

## Phase 21 — Rust/WASM Migration 🔄

> **Focus:** Migrate compute-sensitive subsystems from TypeScript into a Rust crate
> compiled to WebAssembly, keeping three.js as the WebGL/WebXR renderer. The full
> technical standards (ABI surface, memory model, command-buffer wire format,
> capability flags, instancing thresholds, bundle/profiling budgets) live in
> `.claude/plan.md` (working memory). **This phase is the single canonical record of
> migration status**; the per-sprint checkboxes there are not authoritative. The
> crate advertises exactly `CAP_DATASET_RUST | CAP_PARSER_RUST | CAP_OPERATIONS_RUST`
> (Phase-1 set); the `COMMAND_BUFFER requires SCENE_RUST` ordering invariant is
> encoded as a Rust test (#81).

### Sprint 21.1 — Tooling & foundation ✅

- [x] Rust toolchain (`wasm32-unknown-unknown` + `wasm-pack`), `wasm/Cargo.toml`, `vite-wasm-pack-plugin`
- [x] `lib.rs` health-check; `src/wasm/RuntimeBridge.ts` (load/init/`alloc`/`read_bytes`); `npm run wasm`

### Sprint 21.2 — Data layer in Rust ✅

- [x] Port `Dataset`/`ColumnType`/`Encodings`, CSV/JSON parsers, `DatasetOperations`, sample datasets, topology inference to `wasm/src/`
- [x] Wire behind `CAP_DATASET_RUST | CAP_PARSER_RUST | CAP_OPERATIONS_RUST` (`World.ts`, `FileLoader.ts`, `DataOperationController.ts`) with JS fallbacks; 30 Rust unit tests

### Sprint 21.3 — Scene graph & command buffers ⏳

- [ ] Implement Rust ECS (`Entity`/`Transform`/`LocalToWorld`/`MeshRef`/`MaterialRef`) + `CommandEncoder`
- [ ] JS `CommandApplier` consuming the packed stream; `DatumPlane`/`TechnoCoreNode`/`FarcasterPortal` + simple artefacts via Rust commands
- ⏳ **Deferred behind the B2 load-test gate** — no measured regression; the JS scalability layer already implements the spec instancing tiers. `CommandApplier`/opcode definitions exist but are dormant; `command_buffer_ptr` returns the `0` "not-implemented" sentinel (#81). Revisit after the user runs the load-test staircase (Quest or desktop `KeyT`/`Shift+T`) → `logs/loadtest-results.jsonl`.

### Sprint 21.4 — Draco layout engine in Rust 🔄

- [ ] Port `ConstraintEngine` facts/constraints; `VRTopologyTranslator` command-gen; `DracoTopologyNode` lifecycle; TDA export
- 🔄 **Partial** — `layout_grid_3d` / `layout_force_directed_3d` / radial-tree are in Rust and unit-tested; the Rust constraint solver, `VRTopologyTranslator` command-gen, and TDA export are **not** migrated. The `CAP_DRACO_RUST` bit stays reserved until the full subsystem is ported.

### Sprint 21.5 — Input & interaction state machine 🔲

- [ ] Port `HandGestureRecognizer`, `ControllerGestureMapper`, `InputRouter` intent dispatch, `DataOperations` interaction transforms, `AnalysisHistory` undo/redo to Rust (JS keeps WebXR pose polling + haptics/audio)

### Sprint 21.6 — Networking & live streams 🔲

- [ ] Move WebSocket state machine / message normalization, binary-payload parsing (MessagePack/Arrow IPC/FlatBuffers), and room/signalling state to Rust (JS keeps the actual WebSocket / `RTCDataChannel` objects)

### Sprint 21.7 — Polish, performance, test parity ⏳

- [ ] Port remaining utilities (`SeededRandom`, `PerformanceBudget`, `Telemetry`, `SessionStore`); profile Quest frame time; full integration-test parity; bundle-size budget (≤ 2.5 MB gzipped target)
- ⏳ **Pending** Sprints 21.3–21.6.

---

## Phase 22 — UX V2.0: Low-Strain Spatial Interface 🔄

> Driven by the VR UX audit (2026-08-10) + live-VR-testing findings (visual fatigue
> from neon-on-black, spatial clutter, glassmorphic text bleed-through). Goal: a
> calmer, more legible, ergonomically zoned interface without abandoning the
> memory-palace metaphor. Each sprint is a small, on-device-validatable PR.

### Sprint 22.1 — Convergence quick wins ✅

> PR (`feat/ux-v2-quick-wins`): four high-value, low-risk fixes surfaced by the audit.
> Gated to avoid regressions; perceptual changes flagged for on-device validation.

- ✅ **Panel-distance setting no longer a no-op.** `WorldSceneComposer.update()` now
  applies a `panelDistance` offset on top of torso tracking instead of overwriting a
  one-shot `position.z` write; `ComfortSettingsController.applyPanelDistance()` routes
  through `composer.setPanelDistance()` (legacy fallback for unit tests). Default
  `panelDistance = 0` preserves existing tests; production gets the real offset. **On-device
  validation needed:** dashboard moves ~1.35 m → ~2.55 m when the setting is applied.
- ✅ **Wheel-menu hover/click ray mismatch fixed.** `HandWheelMenu._updatePointerAngle()`
  / `_updateHover()` now use `input.pointers.getBestPointerRay()` (the same ray
  `handlePointerClick` uses) instead of the camera origin/world direction, so hover and
  click agree for hand-tracked users. No-ray → preserves the selected category's action
  visibility (no flicker).
- ✅ **Undo/Redo surfaced in the wheel menu.** New `Undo`/`Redo` items in the Ops
  category call `world.undoAnalysis()`/`redoAnalysis()` (safe no-ops when history is
  empty), giving controller-only VR users a path that doesn't require the two-handed
  rotate gestures or A/B-button knowledge. Live disabled affordance is a future enhancement
  (the wheel is built once at init; dynamic menu state needed).
- ✅ **Transient locomotion comfort vignette.** `Locomotion` now fades a peripheral
  vignette in while translating/turning/teleporting and out once still — **reduced-motion
  mode only**, so the static `vignette` setting remains the sole owner of vignette state
  when reduced-motion is off (no fighting the `ComfortSettingsController`).

### Sprint 22.2 — TDA on-demand, Draco/tour/WIMP polish, button-test coverage, Low-Strain presets ✅

> PR (`feat/ux-v2-sprint-22.2`): progressive-disclosure + low-strain color + WIMP
> best-practices + full button-surface test coverage. Perceptual changes flagged for
> on-device validation. Architectural items (3-tier zonation + wrist HUD, foveated
> rendering, gaze-driven scaling, frosted backings) stay phased to 22.3/22.4.

- ✅ **TDA on-demand (progressive disclosure).** The statistical lens — the
  `tda-summary-group` (persistence/mapper/betti planes) **and** the correlation matrix
  panel — is now **hidden by default** until explicitly requested, via
  `World._statisticalLensEnabled = false` (the visibility chokepoint
  `_setStatisticalLensVisible` gates both). A new **Views → Lens** wheel-menu item
  (`world._toggleStatisticalLens()`) is the explicit request path, supplementing the
  existing scoop-up gesture, TechnoCore cycle, and Settings toggle. `lensTDA` /
  `lensCorrelation` Settings sub-toggles stay `true` (they select *which* components show
  *when the lens is on* — flipping them false would suppress TDA even after an explicit
  toggle-on). **On-device validation owed:** TDA-on-demand feel (no auto-appear on load).
- ✅ **Draco diagnostic menu shorter.** `DracoDiagnosticHUD` height `850 → 640` and
  `worldSize[1]` `0.98 → 0.72` (~27% shorter visible frame); constraint rows scroll within
  the shorter window. Width unchanged. **On-device validation owed:** scroll readability.
- ✅ **Tour expanded.** `FIRST_DATASET_TOUR` grew from 13 → 19 stops (TDA lens, comfort
  settings, live stream, load test, theme preset, narrative timeline), with new
  `GuidedTourController` resolver/condition cases (`tda-lens`, `comfort-settings`,
  `load-test`, `narrative-timeline`). The card canvas is fixed-size; more steps = more
  pages, not a bigger window.
- ✅ **WIMP best-practices.** (a) New shared color-token module `src/vr/palette.ts`
  (`PALETTE` numeric hex tokens + `cssHex()`); `WorldTheme.neonMidnight` + the new presets
  and `MovablePanel.render` now source from it — **identical values, no perceptual
  change** to existing themes (other panels adopt incrementally in 22.3). (b) Unified the
  duplicated `TourStep`/`Tour` types into a single canonical source in the data layer
  (`DefaultTour.ts`); `GuidedTour.ts` and `GuidedTourController.ts` import + re-export.
  (c) Dead-code cleanup: removed unused `HandWheelMenu.isPointerInsideOpenZone` /
  `shouldCloseByPointer` (grep-verified zero callers).
- ✅ **Low-Strain + Muted theme presets.** Two new `WorldTheme.PRESETS`:
  `lowStrain` (dark-slate backdrop `0x12161a`, muted desaturated-teal point light, low-
  contrast grids — neon reserved for selection/hover) and `mutedProfessional` (neutral
  middle ground). `cyclePreset()` and the Views → Theme wheel item pick them up
  automatically. **On-device validation owed:** slate backdrop reads "calm"; selection
  neon still pops against it.
- ✅ **Full button-surface test coverage.** Filled the 7 known gaps with genuine dispatch
  tests (spies/stubs that record calls — no mocks of callback targets): new
  `wheel-menu-builder` (all 7 categories + ~50 items wired, Lens → `_toggleStatisticalLens`),
  `telemetry-panel` (privacy toggle + export), `load-test-panel` (6 size presets +
  start-full/stop/flush/download via the event bus), `session-roundtrip` (fake IndexedDB +
  real Dataset/AnalysisHistory roundtrip through `WorldSessionController` save/load/delete +
  debounced autosave); extended `settings-panel` (5 steppers + 3 choices + export-bundle),
  `movable-panel-scrollbar` (▲/▼/thumb hit-tests), `button-click-dispatch` (GuidedTour
  `< PREV` pill). +48 tests.

### Sprint 22.3 — Accessibility, onboarding last-mile & analysis completeness 🔲

> Evidence base: `docs/USER_STORIES_AND_UX_ANALYSIS.md` (29 user stories, gap/UX verdicts
> with file:line, verified 2026-08-11). This sprint absorbs the verified findings of two
> UI/UX review passes. Theme: **close the last mile** — wire the class-level plumbing that
> already exists into the surface where the user encounters it.

#### Text legibility & panel backings
- 🔲 Frosted/occluded panel backings (solid backings under glassmorphic panels so content
  doesn't bleed through palace geometry); dynamic panel opacity driven by gaze proximity.
- 🔲 Gaze-driven text scaling (subtended-angle-stable legibility at varying distances).
  (`textScale` already reaches the canvas font path — `MovablePanel.ts:360` — this adds
  distance-driven auto-scaling, not the base setting.)
- 🔲 Design-system color + typography convergence (palette/luminance tokens applied to
  all world-space panels, not just `MovablePanel`).
- 🔲 Destructive-action confirmation (reset/delete/clear) as a VR confirm step; loading
  indicator; collab error close-codes.

#### Accessibility (the critical color path)
- 🔲 **Colorblind data-encoding gap (US22, verified).** `categoricalColor()`
  (`src/data/Encodings.ts:13`) returns the raw `PALETTE`
  (`[0x00ffcc, 0xff0055, 0xffaa00, 0x00aaff, 0xff00ff, 0x88ff00]` — index 1 red + index 5
  green is a red-green confusion pair) and never applies a colorblind remap.
  `WorldTheme.applyColorblindMode()` only remaps environment (fog/ambient/point light/grid/
  particles); `ChartPlane.ts` has zero colorblind references; and `VRTopologyTranslator.ts`
  calls `categoricalColor()` at 5 sites (lines 242, 436, 624, 695, 759), so the *same*
  un-remapped palette colors the 3D palace crystals as well as 2D charts. **Also** the
  per-mode choice (deuteranopia/protanopia/tritanopia) is cosmetic: `MovablePanel.remapColor`
  only branches on the `highContrast` boolean, not per-mode, and `Accessibility.remapColor`
  maps only 4 hue families. Fix: thread the active `colorblindMode` into `categoricalColor()`
  (or a wrapper) so palace + chart data encoding respects the mode; make `remapColor`
  per-mode for deuteranopia/protanopia/tritanopia; switch the default palette to a
  colorblind-safe sequence (perceptual change to all scenes — confirm before shipping) OR
  keep the neon default and remap only when the mode is on. Tests asserting remap reaches
  both `ChartPlane` and `VRTopologyTranslator` output.
- 🔲 **Dwell threshold not user-adjustable (US23, verified).** The dwell chain is fully wired
  and ticking per frame (`SettingsPanel.dwellSelection` → `World.ts:1247` →
  `InputRouter.setDwellSelection` → `SelectionDispatcher`, 1200 ms) — but the threshold is
  fixed; `_dwellThreshold` plumbing exists with no UI. Fix: expose a dwell-delay stepper in
  the Accessibility section. (Dwell Select itself is **not** a defect — confirmed working.)
- 🔲 **Hand-wheel menu ignores dominant hand (US9, verified).** `WorldUIManager.ts:153`
  hardcodes `engine.input.hands[0]` while `WorldInputCoordinator.ts:215` correctly uses
  `hands[this.gestureRecognizer?.dominantHandIndex ?? 0]`. Fix: bind the wheel menu to
  `dominantHandIndex` like the rest of the input system. Low severity.
- 🔲 **Input parity matrix (verified gap).** No analytical task should depend on one physical
  ability. Build an explicit parity matrix (action × {hand, controller, keyboard, dwell}):
  select / filter / aggregate / sort / time-slice / undo / inspect. Dwell is wired
  (`SelectionDispatcher.ts`, 1200 ms) but not exercised across every action; verify and fill
  the unset cells. (The colorblind, dwell-delay, and dominant-hand items above are the first
  rows of this matrix.)

#### Onboarding last-mile (wire the praised-but-dead features)
- 🔲 **JIT gesture hints never instantiated in production (US11, verified).**
  `JITGestureHintManager` is a real class (ghost-hand wireframe + diegetic label + per-gesture
  cooldown + bob animation) but `new JITGestureHintManager` appears only in tests, never in
  `src/` (grep-confirmed). Fix: instantiate in `World`/`WorldUIManager`, call `setScene`, and
  drive hints from the gesture/interaction context. The "diegetic debounced onboarding"
  praised in review does not currently run.
- 🔲 **Frustration-response hint card never instantiated in production (US12, verified).**
  `FrustrationResponseManager` is a real class (novice 0.35 / intermediate 0.55 / expert 0.85
  thresholds, 10 s cooldown, 7 s visibility, pattern-specific tip card) but `new
  FrustrationResponseManager` appears only in tests, never in `src/` (grep-confirmed). The
  `UXFrustrationAnalyzer` computes a real 0–1 dissatisfaction score but it only reaches the
  manual review-bundle export — the in-VR hint never appears. Fix: instantiate the manager,
  feed it the analyzer score each frame, call `setUserMode` from the settings userMode, and
  parent the hint to `analystAnchor` (not a raw camera offset). **Correct the roadmap record**
  below (this line was previously marked `[x]` done — it is not).

#### Analysis completeness
- 🔲 **Aggregate operation is a visual placeholder (US5, verified).** `applyAggregate`
  (`DataOperations.ts:97-120`) hides all nodes and scales the first node by group count;
  its own comment says "In a full implementation this would spawn new aggregate meshes." A
  real `AGGREGATE_BARS` geometry builder exists unused in `VRTopologyTranslator.ts:714`.
  Fix: route the VR aggregate path through `AGGREGATE_BARS` (or grouped markers) so
  pinch-apart produces real per-group summaries instead of collapsing the palace to one node.
- 🔲 **Streamline/Geo layout honesty (US2, verified).** `StreamlineLayout` uses a synthetic
  procedural vector field rather than reading real `u/v/w` columns; `GeoSurfaceLayout` uses a
  fixed `heightScale` rather than dataset-normalized scaling. Fix: read the vector columns
  when present (synthetic fallback otherwise); normalize geo height to the data range.
- 🔲 **No first-class Compare operation (verified).** `DatasetOperations.ts` exports
  filter / sort / aggregate / cluster / hierarchical / dbscan / anomaly / slice — **no
  `compare`**; `DataOperations.computeOperationDataset` (`:210`) and `buildWasmOperationSpec`
  (`:293`) likewise have none. "Compare" is named in the conceptual loop
  (Orient / Probe / Query / **Compare** / Annotate / Share) but is not implemented. Add Compare
  as a first-class operation: group A vs group B, before vs after, selected vs population,
  representation A vs B, 2D vs 3D. Also valuable as a research condition.

#### Small fixes / dead-code
- 🔲 Remove dead declarations/code: `dwellEnabled`/`dwellDelayMs` aliases
  (`coordinators/types.ts:145-146`, real key is `dwellSelection`); `NetworkManager.broadcastCameraPose`
  (zero call sites); `HandWheelMenu` `openAngleThreshold`/`closeAngleThreshold` (stored but
  never read by visibility logic — either wire or remove); `PerformanceBudget.handTrackingMs`
  (declared, never checked — either check or remove).
- 🟡 **Panel declutter (verified): `PanelManager.hideAll()`/`showAll()` already exist**
  (`PanelManager.ts:182-191`). Wire a single user-facing "hide all panels / focus mode"
  affordance in the wheel menu if not already exposed; not an architecture gap.
- 🔲 Undo/Redo wheel-menu items: add a disabled affordance when the history stack is empty
  (`WheelMenuBuilder.ts:279-281` acknowledges the silent no-op).
- 🔲 **Dashboard wiring check (US10, UNCONFIRMED).** `WorldUIManager` constructs
  `DashboardManager` without calling `registerPanel`; verify whether `World.ts` wires chart
  panels in elsewhere. If not, the dashboard renders empty — wire it.
- 🔲 **Error-recovery UX messaging.** Engineering handles context loss / tracking loss /
  malformed CSV / network stalls, but user-facing recovery is raw ("WebXR input source
  disconnected"). Rewrite analyst-facing: "Hand tracking lost — your analysis is safe; switch
  to controller input or pause" / "Live stream interrupted — last update 14:32:08, 3,842
  records preserved." Principle: never make the user wonder whether their analysis was lost.

### Sprint 22.4 — Spatial zonation architecture 🔲

- 🔲 Three-tier zonation: Central Focus (active artefact) / Peripheral (secondary panels)
  / Wrist-Mounted HUD (ambient telemetry, always-within-glance).
- 🔲 Foveated rendering (WebXR `XRWebGLLayer` foveationLevel) + gaze-weighted LOD;
  diegetic-interface pass (more in-world artefacts, fewer floating overlays).
- 🔲 Declutter pass: collapse idle floating windows into the periphery/wrist tier;
  one-handed gesture path for primary actions (reduce two-handed reliance).
- 🔲 Settings panel reorder (comfort/legibility/zonation grouped); tour narration TTS
  polish; context-loss VR visibility (keep session + status panel on WebGL context loss);
  teleport reduced-motion fade + hand-grab damping.
- 🔲 **Four-tier instancing: reconcile spec vs. implementation (US21, verified).**
  `CLAUDE.md` migration standards document discrete bands (≤256 Mesh / 257–8,192
  InstancedMesh / 8,193–65,536 GPU point cloud / larger binned-LOD). The actual code is
  **two-tier** (small → individual `Mesh`; large >500 rows → `InstancedPointCloud` /
  cluster volume / aggregate bars) plus an `AdaptiveFrameGovernor` LOD scale; no `GL_POINTS`
  GPU point-cloud renderer distinct from `InstancedMesh` exists, and the 8,192 / 65,536
  bands are not separated. **Decision required:** (a) implement the `GL_POINTS` tier +
  band router (ties into Phase 21 WASM / the B2 command-buffer work, defer until load-test
  data says it's a measured regression), OR (b) correct `CLAUDE.md` to the two-tier reality
  (cheap, honest). Default to (b) unless 65k+ load-test data shows the middle band matters.

### Sprint 22.5 — Collaboration embodied presence 🔲 (new)

> The WebRTC mesh is real and shipped (multi-peer, token gate, standalone signalling). The
> embodied-presence stack is fully implemented and unit-tested but has **zero production
> call sites** — this sprint wires it.

- 🔲 **Wire `PeerAvatarManager`** (wireframe head + box hands + laser line) — currently
  never constructed; instantiate in the collaboration path, drive from remote peer state.
- 🔲 **Wire `CollaborativeStateSync`** (djb2 numeric peerId + sequence-drop) and
  `BinaryPoseSerializer` (40-byte ArrayBuffer) — replace the JSON `setLocalState({position,
  rotationY})` hot path with the binary serializer so avatars get full pose.
- 🔲 **Broadcast full quaternion pose** (current path sends `position` + `rotationY` only —
  no head orientation; even with avatars wired, orientation would be wrong). Remove the dead
  `broadcastCameraPose`.
- 🔲 Remote laser-pointer sync + gaze-target sync (optional follow-on).
- 🔲 (Future, by design) shared dataset state + synchronized operations — GETTING_STARTED
  notes "Sprint 10B.2"; still not built, recorded as future work, not a regression.

### Sprint 22.6 — Data/Draco correctness + architecture hygiene 🔲 (new)

> Evidence base: a second external review (architecture/research pass) verified against
> code 2026-08-11. **9 of 12 concrete claims confirmed**, 1 false (see "Not a defect"
> note below), 1 partly confirmed, 1 understated. Engineering items recorded here; research
> items in the next section.

- 🔲 **`_correlationMatrix` missing-value misalignment (P0 correctness, verified).**
  `ConstraintEngine._correlationMatrix` (`ConstraintEngine.ts:235-259`) filters each numeric
  column independently (`filter(!NaN)`) then pairs values by **index** `k` over
  `n = columns[0].length`. When missing values occur in different rows, the k-th valid value
  of column A is from a different row than the k-th valid value of column B → wrong
  correlation (and possible `NaN` when a shorter column is indexed past its length). It feeds
  the `prefer_beam_for_correlations` soft constraint (`:580`), so a stats bug becomes a
  **visualization-selection bug**. Fix: compute from **pairwise complete observations** per
  column pair; add a test with staggered NaN rows asserting the expected correlation.
- 🔲 **Confidence-bearing statistical facts.** Trend/seasonality are currently binary flags;
  upgrade to `{ signal, strength, sampleCount, method }` so Draco can reason about
  confidence rather than `trend=true`. (Temporal extraction lives in `ConstraintEngine.ts:274+`.)
- 🔲 **Stable `datumId` decoupling renderer from JS object identity.** `Dataset.ts:44-51`
  explicitly preserves row-object identity so `mesh.userData.row === dataset.rows[i]` matches
  after strip/clone. The renderer should not care whether a row was cloned by filter /
  serialization / WASM / a worker / persistence / collaboration. Give every datum a stable
  semantic ID; match meshes by `mesh.userData.datumId`. Pre-work for WASM + collab.
- 🔲 **`Dataset` immutability model — decide and document.** ARCHITECTURE calls `Dataset`
  "immutable" but `updateRows()` mutates the row store for live streams (verified). Choose
  **B** (mutable live dataset + immutable derived operations) for streams and document it
  precisely; fix the doc/impl contradiction.
- 🔲 **`World.ts` → composition root, not nervous system.** Now **1,784 lines** (verified);
  owns/references an enormous state surface. Target `World` as a thin composition root over
  Runtime / Workspace / DataSession / Input / Presentation / Persistence / Collaboration.
  Coordinators are extracted already; finish removing direct cross-subsystem state from `World`.
- 🔲 **Formalise dependency direction.** Add a hard rule to `ARCHITECTURE.md`: `data → analysis
  → representation → rendering → input`, never backward; `Dataset` must not import three.js;
  `Draco` must not import `World`; UI must not modify `Dataset` directly. More valuable than
  further class descriptions.
- 🔲 **Event-bus discipline.** Events for observation / telemetry / UI notification /
  decoupled cross-cutting concerns; **direct method calls** for commands / ownership /
  lifecycle / state transitions — so the call graph stays visible and debuggable.
- 🔲 **`updatables: unknown[]` → `Updatable[]` (verified).** `Engine.ts:46` is dynamically
  duck-typed (`has update()`). Type it as `Updatable[]` with an explicit
  `add`/`remove`/`dispose` lifecycle (the `Updatable` type already exists in the project).
- 🔲 **Align `three` / `@types/three` versions (verified).** `package.json` declares
  `three: ^0.168.0` vs `@types/three: ^0.185.4`; `tsconfig` maps `three` → `@types/three`,
  masked by `skipLibCheck: true`. Compiling against a different API surface than the runtime
  is risky for graphics code. Align versions or eliminate the explicit mismatch.
- 🔲 **Review `allowJs: true` (verified).** Source is TS-first now; make the boundary explicit
  (`src` = TS-only; tests/config = JS) rather than a broad compiler permission.
- 🔲 **Resolve `src/ai/` README staleness + AI-story inconsistency.** `README.md:74` says
  `ai/ # (planned)` but `src/ai/` already holds 6 real files (`NeuralConstraintPredictor`,
  `GestureClassifierModel`, `GestureModelStore`, `GestureTrainingWorker`,
  `VoiceCommandListener`, `DracoWorldModel`). Decide: keep AI emphasis with accurate status,
  or **remove the AI emphasis for now** (the symbolic Draco recommender is the more
  interesting, defensible story — don't dilute "transparent representation recommender" into
  "AI chooses your chart"). If a learned layer comes later, evaluate it against Draco.
- 🔲 **Separate semantic mark from visual skin.** Today spatial form and cyberpunk aesthetic
  are entangled. Split `NODE → {crystal, sphere, dot, column}` and `BEAM → {neon, neutral,
  high-contrast}` so the research question "does spatial form help?" can be answered
  independently of "does the aesthetic help?"
- 🔲 **Load-test: add transition metrics.** The `settleSec` mechanism exists (tests use 0);
  steady-state measurement excludes the most painful part of a dataset swap. Report
  dataset-transition p50/p95, worst stall, frames missed, GC pause, time-to-interactive
  alongside steady-state FPS — "can it move 8k → 65k without a perceptible freeze?"
- 🟢 **NOT a defect — live site is in sync (verified 2026-08-11).** An external review
  claimed `nemosyne.world` still serves the retired A-Frame/D3 page (ranked P0 #1). Verified
  FALSE: a fresh fetch of the live root shows "Built directly on three.js and WebXR", **zero**
  A-Frame/D3 mentions; `docs/index.html` matches. The review's crawler hit a stale cache.
  Do not chase — though **exposing build/commit metadata** on the site (no version/commit
  shown today) is a valid, cheap follow-up.

### Sprint 22.7 — Task-first workflow & Draco explainability 🔲 (new)

> Evidence base: a third external review (UX / user-journey pass, 47 sections) verified against
> code 2026-08-11 — **factually accurate, no false headlines** (unlike the architecture pass).
> Its thesis: Nemosyne has "a lot of implementation evidence, but almost no user evidence" and
> has "designed an interaction language before proving that users need to learn that language."
> Organizing frame: **Find → Understand → Prove → Share**. *Find* is strong; *Understand* is
> developing; *Prove* and *Share* are weak. This sprint holds the engineering items that move
> the product from interface-first toward task-first; the evidence/research items go under
> **Planned but not actioned → Research validation**.

- 🔲 **Draco "Why this view?" / "Explain this" (P0, verified missing).** There is **no**
  user-facing explainer. `DracoDiagnosticHUD` is a soft-constraint weight *tuner* for power
  users (renders LAYOUT/GEOM/BEHAV/COST/DELTA + `adjustWeight`), not an explainer. Add a
  compact "Why this palace?" panel: detected topology family, community count, edge density,
  anomalous hubs, and *why* the recommended layout was chosen (e.g. "force-directed preserves
  local connectivity while separating dense communities"). This turns Draco from invisible
  magic into explainable analytical assistance — and is research infrastructure (the
  explanation is a testable claim about what users trust). A universal **"Explain this"**
  command (select an artefact → "why is this here / what does its size mean / why are these
  nodes together / why is this an anomaly") bridges Draco, statistics, spatial semantics,
  accessibility, onboarding, and trust.
- 🔲 **Task-first onboarding: templates as the front door (P0).** The 6 analysis templates
  (`AnalysisTemplates.ts:27-82`, already wired to the wheel menu + `World.ts:676`) should
  become the entry point — not "Load Dataset" but "What are you trying to understand?" (find
  anomalies / understand relationships / explore change / compare groups / explore hierarchy)
  → template selects dataset + representation + interaction vocabulary + tour + theme. Make
  Draco operate at the UX level, not merely the rendering level. A guided **"Find the Fraud"
  investigation** (5 interactions: look around → select anomaly → pull nodes together →
  inspect → mark finding) teaches the system by solving a problem, not by touring components.
  ⚠️ A 19-stop tour is itself a diagnostic — if the system needs 19 instructional stops, the
  interaction model may be too dense; task-first onboarding is the counterweight, not a longer tour.
- 🔲 **Precision / detail transition (P0).** Formalise the hybrid principle **"use space for
  discovery, conventional representations for precision"** — a spatial → inspect → expand →
  2D detail card / table / chart path so the user never fights the spatial interface to read
  an exact number. `HolographicInspector` (hand-following diegetic slate) + `ChartPlanePanel`
  (`World.ts:853,862,871`) are the foundations; add an explicit precision view for long
  labels / many columns / exact numbers / side-by-side comparison. Do not try to beat 2D at
  value-reading; make the transition seamless instead.
- 🔲 **Investigation timeline / analytical narrative (P1, verified partial).** Session
  persistence is real (`WorldSessionController.ts:18-46` persists dataset / camera / history /
  settings / tour / theme / panel positions) — but persistence ≠ provenance. The returning
  analyst needs "what did I do last time?" as a user-facing narrative (filtered N → detected M
  anomalies → clustered into K groups → inspected row #X → added Y findings) with
  [Resume] / [Open Summary] / [Start Fresh], not just a restored state. Annotation + bookmark
  classes exist (`src/vr/interactions/SharedAnnotationManager.ts` — built, never instantiated,
  incl. WebRTC bookmark sync); wire them so a finding can be captured, annotated, and shared.
- 🔲 **Navigation-cost instrumentation (P0).** The premise relies on navigating space, but
  navigation can become the task. No evidence yet says how much time is spent analysing vs
  navigating. Instrument `analysis_time` vs `navigation_time`, `distance_travelled`,
  `orientation_recoveries`, `teleport_count`, `camera_rotation`, `time_to_target`,
  `time_not_facing_target`. Prerequisite metric for the spatial-advantage study; answers
  "does spatial navigation help or hurt?" (Existing telemetry + `UXFrustrationAnalyzer` are
  the plumbing; this adds the analysis-vs-navigation split.)
- 🟡 **Import framing — record correction.** The review frames data import as
  "developer-oriented (clone / npm / certs)" with no in-app flow. That is **inaccurate for the
  import step**: `src/ui/FileLoader.ts` is an in-app DOM CSV/JSON file-picker overlay
  (`World.ts:401`, WASM fast path) — the dev-orientation is real for *getting into VR*
  (clone / certs / Quest Browser), not for importing data once running. The CSV-first
  *journey* polish (drop → preview schema → confirm → "Analysing…" → Draco recommendation →
  enter palace) is still a valid onboarding follow-up, but the reviewer over-stated the gap.

---

## Planned but not actioned (audit 2026-08-10)

> Consolidated from a full audit of all plan docs + this roadmap against the
> codebase. These items are **recorded here as remaining work**; none are built.

### Deferred by design (consciously punted)

- Excel / Parquet importers (future plugin importers)
- Direct SQL / data-warehouse connectors
- Scientific user study vs 2D baseline
- Tutorial screencasts / screenshots
- Multi-user voice chat (voice-optional by intent)
- IWSDK hand/input helper spike (deferral gate met; spike not run)

### Research validation (from the architecture/research review, verified 2026-08-11)

> The strongest critique: engineering is now well ahead of empirical evidence. The
> bottleneck is **evidence, not features**. These are research-direction items, not
> engineering sprints.

- **2D-vs-VR experimental harness** — a reusable harness (dataset × task × 2D control ×
  desktop-3D × VR-3D × timer × answer capture × confidence × workload × interaction
  telemetry × analysis) to run studies: topology discovery, anomaly detection, temporal
  pattern recognition, quantitative comparison, memory/recall. The target result is a
  per-task matrix of where spatial representation wins/loses — not a blanket "VR beats 2D".
  (Supersedes the bare "Scientific user study vs 2D baseline" line above.)
- **Human-performance benchmark alongside the spec benchmark.** The golden-set test
  (`draco-recommender-quality.test.ts:33`, ≥80% topology/layout match) measures "did Draco
  choose what we expected", not "was the representation good". A human-performance benchmark
  (`dataset + task + representation → accuracy / time / workload / recall`) lets the system
  say "our expert prior was wrong" when users perform best on a non-Draco representation.
- **Semantic vs structural vs layout position discipline.** "near=similar, far=different,
  inside=cluster, connected=relationship" are hypotheses, not perceptual laws. The UI must
  distinguish position that encodes a data variable (semantic) from position that exposes
  topology (structural) from position that is merely algorithmic arrangement (layout), or the
  visualization can manufacture false inference (e.g. force-directed proximity ≠ semantic
  similarity). One of the deepest research problems here.
- **Evidence-informed Draco loop.** Evolve Draco from an expert-rule engine toward an
  empirically informed recommender: dataset → Draco → representation → human study →
  succeeds/fails → evidence store → Draco++. The hard rules encode a *human expert's* visual
  language today; the research contribution is data-semantics → spatial-representation
  learned from outcomes.
- **Hardware-validation matrix.** Turn "Quest compatible" into evidence: a per-headset
  (Desktop / Quest 3S / Quest 3 / other) × test (startup, hand tracking, controller, 1k/8k/
  65k/100k datasets, comfort, text readability, reduced motion) matrix with date + headset
  firmware + browser version on every result. The roadmap's on-device validation already
  lists the items; this formalises them as a repeatable matrix.
- **5-level evidence hierarchy — adopt project-wide (from the UX/user-journey review).**
  Label every feature/claim by evidence level: 🟢 Implemented (exists) → 🔵 Tested (automated
  behaviour correct) → 🟡 Usable (representative users complete the task) → 🟠 Useful (users
  perform better / derive value) → 🔴 Superior (controlled study shows a reproducible
  advantage over a credible baseline). Much of Nemosyne's documentation stops at 🟢/🔵 while
  its research ambitions require 🟡/🟠/🔴. Make the labelling explicit so the gap is visible,
  not hidden — "demonstrated vs validated" is the vocabulary.
- **5-study research programme (uses the harness + navigation-cost instrumentation above).**
  (1) **Learnability** — time to first successful operation, gesture-recognition errors, help
  requests, 24 h recall; (2) **Spatial advantage** — 2D dashboard vs desktop-3D vs VR-3D on
  topology tasks (bridge / cluster / path / anomaly / relationship); (3) **Precision penalty**
  — where 3D loses to 2D (rank / compare / estimate / read exact values), *just as important
  as proving advantages*; (4) **Metaphor comprehension** — give users the gestures
  (pinch / slice / scoop / rotate / push) without explanation, measure interpretation
  accuracy / confidence / learning time / retention (tests whether the physical language is
  actually intuitive — a publishable result in its own right); (5) **Memory** — 2D chart vs 3D
  imposed vs 3D navigable vs 3D user-manipulated, recall at 5 min / 24 h / 7 d (directly tests
  the memory-palace hypothesis). The flagship is a **"Find the Fraud"** between-subjects study
  (2D / Nemosyne desktop-3D / Nemosyne VR) measuring accuracy, time, navigation, interaction
  errors, confidence, recall, workload, plus one brutally simple question: "which
  representation helped you understand the data?"
- **UX-cost composite ("User Journey Score").** Per task: UX cost = learning + navigation +
  interaction + interpretation + evidence cost. Nemosyne currently concentrates on the middle
  (analysis cost); the surrounding costs are where the UX gaps live. Keep the underlying
  metrics visible — the composite is a diagnostic, not a vanity number.
- **UX frustration analyzer as signal, not conclusion.** `UXFrustrationAnalyzer` (wired via
  `Telemetry.ts:96`) detects patterns like `LONG_DWELL_HESITATION` — but long dwell can mean
  careful inspection / reading / interest, not frustration, and many gestures can mean
  engagement, not bad UX. Model `interaction signal → possible UX hypothesis → human
  validation`, not `signal → frustration score`. Treat on-device detection as triage for
  studies, never as a verdict.

### Blocked on the B2 load-test (real Quest data)

- WASM Sprints 21.3–21.7 (command-buffer decision deferred pending measurements)
- Quest GPU-memory + hand-tracking-latency probes — the PR #80 harness measures frame
  time (p50/p95/p99), dropped rate, JS heap, and `renderer.info` counts; GPU bytes and
  hand latency require a real headset. The harness is built + unit-tested but has **not
  yet been run** (`logs/loadtest-results.jsonl` does not exist).

### Aspirational gaps (never scoped into a phase)

- Shared links / shareable session URLs
- Connector API authentication

---


## Legend

- ✅ Complete
- 🔄 In progress
- ⏳ Deferred to future phase
- 🔲 Not started



## Current Status

> **Single source of truth for project state.** Any agent (Claude Code,
> Antigravity, any model) reads this block FIRST on pickup and updates it
> BEFORE stopping. Other docs (CLAUDE.md, .agents/, PROJECT.md, GATE_STATUS.md)
> point here — they do not duplicate state.

- **Last updated:** 2026-08-10 · Claude Code (glm-5.2) — merge policy LIVE + verified:
  direct push to main rejected by ruleset (tested); `approval-gate` required check on;
  `allow_auto_merge` on.
- **Phase / sprint:** Phase 20 ✅ complete; M1-M4 resume gate green AND CI-enforced.
  Phase 6 deferred pending remaining audit-finding triage.
- **Active branch:** `docs/roadmap-policy-live` (this status refresh). main = `ed40632`.
- **Working tree:** uncommitted on this branch — this status edit only (now must go
  via PR; direct push to main is blocked by the ruleset).
- **Last gate:** `tsc --noEmit` 0 errors · `vitest run --coverage` 1188 pass / 9 skip /
  0 fail (cov 83.47/70.55/77.56/85.6) · `cargo test` 28 pass / 0 fail (host) — 2026-08-10.
- **Merge policy (live):** main ruleset `id=20623327` — require PR + required checks
  `Rust unit tests (wasm/)` / `Node 20` / `Node 22` / `approval-gate`, no bypass (blocks
  direct push to main for everyone incl. admin, verified). `approval-gate.yml` passes
  immediately for owner-authored PRs (→ enable squash auto-merge on green); fails for
  everyone else until the owner APPROVES the current head (→ then auto-merge on green).
  `allow_auto_merge` enabled. New work must land via PR.
- **In progress / next:** (1) lint cleanup → flip lint to blocking; (2) WASM
  command-buffer: wire+reconcile or delete (audit B2) + enable JS bridge test
  (RuntimeBridge fetch-skip); (3) close network peer-impersonation; (4) binary-parser
  length-field bounds; (5) finish World.ts extraction; (6) test-quality cleanup.
- **Resolved this move:** audit B1 (CI gate) ✅ + merge policy (no direct push to main,
  owner auto-merge on green, others need owner approval); two Rust suite reds that B1
  surfaced — `data_operation` re-entrant `DATASET_REGISTRY` Mutex deadlock (fixed:
  apply inside lock, register after release) and `grid_layout` f32 equality assert
  (fixed: 1e-5 tol).
- **Blockers / open:** B2 (WASM command-buffer dormant/spec-drifted/untested) — decide
  before scaling further.
- **Resume pointers:** PR #62 (CI gate) + PR #63 (approval-gate) merged to main
  (`ed40632`); merge-policy ruleset `id=20623327` active;
  gate detail → `.agents/teamwork_preview_sub_orch_m1/GATE_STATUS.md`;
  test inventory → `TEST_READY.md`.

### How to update this block
1. On pickup: read this block first; read resume pointers only if you need detail.
2. Before stopping: refresh *every* bullet above with current truth (date, branch,
   tree state, gate result, next action, blockers). Keep it to ~10 lines.
3. Never let the bullets go stale — a stale "next" is worse than none.

---

# Nemosyne Roadmap

This roadmap is aligned with the upstream `nemosyne.world` 6-phase structure, adapted to the current three.js/WebXR runtime core.

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

- [x] `README.md`, `ARCHITECTURE_BRIDGE.md`, `docs/IDEOLOGY.md`, `docs/ARTEFACTS.md`, `docs/INTERACTIONS.md`, `docs/ARCHITECTURE.md`, `docs/GETTING_STARTED.md`.
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
- [ ] Optional multi-user collaborative memory palaces.
- [ ] Neural predictive layer for soft-constraint weight recommendation.
- [ ] Convergence with upstream A-Frame component framework where feasible.

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

*Status as of 2026-07-28. Written from a technical product lead / principal architect perspective after completing Phase 9 and running the full test suite (674 tests passing, 68 test files).*

### Goal delivery

The project’s core thesis — multi-dimensional datasets become interactive 3D memory palaces — is now **demonstrated end-to-end**. The constraint-driven Draco pipeline, artefact taxonomy, multi-modal input model, statistical aids, live connectors, and atmosphere layer all work together in a single WebXR/three.js runtime. Estimation: **~75 % of the foundational vision is shipped and tested**.

### Strengths

- **Architecture:** Clean separation between Engine, World, artifacts, UI, interactions, and data layers.
- **Test discipline:** 675+ Vitest tests make refactoring safe for a WebXR codebase.
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

### Comparison with similar efforts

| Comparable | Nemosyne advantage | Nemosyne gap |
|---|---|---|
| Virtualitics | Open architecture; stronger game/diegetic UX; artefact taxonomy | Enterprise polish, validated studies, connector library, SSO |
| Tableau/Power BI | Embodied interaction and spatial memory-palace metaphor | Chart grammar, broad sharing/export, ecosystem |
| A-Frame/three.js viz demos | Real analysis operations, undo/redo, live data, tests | Usually one-off scenes without an operation model |
| Observable / D3 / Plotly | Immersion and embodied gestures | Statistical modeling breadth, notebook provenance, shareability |

Positioning: Nemosyne is best understood as an **open, web-native, metaphor-first augmentation layer** for analysts who already use notebooks or BI tools, not as a direct replacement for them today.

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
- [ ] Convergence with upstream A-Frame component framework where feasible.
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

- [x] **`FrustrationResponseManager`** (`src/vr/ui/FrustrationResponseManager.ts`) — when `dissatisfactionScore > threshold`, surfaces a contextual diegetic hint card near the user's gaze target
- [x] **`GestureConfidenceHUD`** panel (`src/vr/ui/GestureConfidenceHUD.ts`) — per-gesture real-time confidence bar visualization
- [x] `tests/frustration-response.test.ts` — assert hint cards appear within 2 operations of threshold breach; assert threshold adapts to expert mode

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


## Legend

- ✅ Complete
- 🔄 In progress
- ⏳ Deferred to future phase



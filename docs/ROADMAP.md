## Current Status

> **Single source of truth for project state.** Read this block FIRST on pickup and
> update it BEFORE stopping. Other docs (CLAUDE.md, `.agents/`) point here — they do
> not duplicate state.


- **2026-08-18 — Sprint 22.3.1 (Adversarial hardening & last-mile closure) complete:**
  - **Unified system-toggle gate:** Extended `SystemGestureDetector.ts` to strictly track rising edges and prevent re-arming while gestures remain held across boundaries (e.g. initiating over panels or reach zones and dragging off); unified release-to-rearm invariants across hand pinches and controller grips.
  - **Adversarial regression suite:** Created `tests/adversarial-hardening.test.ts` covering remote authorization / observer message relay blocks, schema/payload sanity and clean disconnection handling, operation transform visual state & base-state history restoration, `ChartPlane` resource and texture disposal, and multi-modal controller/pinch precedence.
  - **Gates:** `tsc --noEmit` 0 errors · `eslint` 0 errors · `npm run test:coverage` 190/190 test files passed (1,365 passed / 26 skipped jsdom-WASM parity by design) · `cargo test` 84/84 passed · `npm run build` exit 0.

- **2026-08-18 — Sprint 22.3 (Accessibility, input correctness & analysis completeness) complete:**
  - **Input correctness fixes:** Synced `lastHandPinched` in `InputRouter.ts` to eliminate hand-pinch double-toggle / double-fire; updated `HandGestureRecognizer.ts` so single-hand gestures (swipe, slice, okSign) evaluate `dominant` and `nonDominant` poses according to `dominantHandIndex` rather than hardcoded array order; prevented `Locomotion.ts` hand-grab movement during two-handed system pinches; added symmetric `scoopDown` statistical lens toggle outside flight mode in `WorldInputCoordinator.ts`; eliminated the seated-height feedback loop in `Locomotion.ts` by deriving `targetY = seatedHeightOffset` directly.
  - **Accessibility & UI controls:** Added user-adjustable `dwellTimeMs` stepper (400ms–3000ms) to `SettingsPanel.ts` and forwarded delay to `SelectionDispatcher.ts` through `World.ts`; sanitized `AccessibilityOptions` to `dwellSelection` / `dwellTimeMs`.
  - **Analysis & layout honesty:** Upgraded `StreamlineLayout.ts` to read real `u/v/w` / `vx/vy/vz` vector column components when present on data rows; normalized elevation in `GeoSurfaceLayout.ts` against dataset min/max values; upgraded `applyAggregate` in `DataOperations.ts` to render multiple group markers across available nodes.
  - **Performance & budget:** Wired `snapshot.handTrackingMs` checks in `PerformanceBudget.ts`.
  - **Gates:** `tsc --noEmit` 0 errors · `eslint` 0 errors · `npm run test:coverage` 189/189 test files passed (1358 passed / 26 skipped jsdom-WASM parity by design) · `cargo test` 84/84 passed · `npm run build` exit 0.

- **2026-08-18 — Vision-alignment pass — governance docs retired + Gate-0 `src/ai/` cleanup:**
  Deleted the 3 superseded governance docs (`Nemosyne_Concept_Paper_v1.0.md`,
  `nemosyne-concept-paper-architecture.md`, `PRODUCT_ARCHITECTURE_AND_GOVERNANCE.md`) and repointed all
  live references (`README.md`, `docs/GETTING_STARTED.md`, `docs/CURATION_BRIEF.md`,
  `wasm/src/data/provenance.rs`, `docs/PROJECT_DOCS_INDEX.md`) to
  `docs/Nemosyne_Definitive_Vision_and_Roadmap.md`, which is now the sole governing spec. Deleted
  `src/ai/` in full (`DracoWorldModel`, `NeuralConstraintPredictor`, `VoiceCommandListener`) +
  `tests/ai-neural-predictor.test.ts`, and split `tests/candidate-carousel-draco-ga.test.ts` /
  `tests/voice-spatial-engine.test.ts` to keep the `RepresentationCarousel` / `SpatialAudioNarrator`
  tests — closes the P15 duplicate-Draco violation (Gate 0). Added the ROADMAP Gate-model crosswalk +
  canonical domain terms + stable-release definition (binding phase work to vision §13 Gates 0–7).
  CLAUDE.md intentionally left untouched.
- **2026-08-18 — Cleanup pass: dead-code retirement, Rust `draco_solve` cutover staged, lint cleared:**
  - **Retired the legacy `src/ai/Gesture*` trio** (`GestureClassifierModel.ts`, `GestureTrainingWorker.ts`,
    `GestureModelStore.ts`) + their tests, and added an explicit retirement note to **Phase 23** so two
    parallel ONNX-gesture systems cannot coexist at integration time — `modules/gesture-intelligence/`
    is now the sole gesture-intelligence surface. (The remaining `src/ai/` files —
    `NeuralConstraintPredictor`, `VoiceCommandListener`, `DracoWorldModel` — were later deleted in full
    in the 2026-08-18 vision-alignment pass; see the top Current Status entry.)
  - **Wired the shipped Rust `draco_solve` into `DracoTopologyNode`** behind an opt-in 6th constructor
    arg `useRustSolver` (default `false`). When true, `reSolveAndSynthesize` calls
    `RuntimeBridge.solveDraco(facts)` and builds the `SolverResult` from the Rust spec+cost while
    keeping the authoritative TS `DracoFacts`. The TS `ConstraintEngine` stays canonical — this is an
    explicit developer switch, **not** a runtime capability-routing branch; if the WASM runtime is
    uninitialised it **throws** rather than silently falling back. `adjustWeight` throws under the
    Rust path (per-weight tuning not in the current ABI). Cutover (flip default + delete TS path) staged
    as a follow-up. Covered by 5 new tests in `tests/draco-topology-node.test.ts` (mocked `solveDraco`).
  - **Walked back the "World Facade Simplification complete" claim** in the Current Status heading —
    retitle now reads "Full TypeScript Migration complete; World Facade decommission NOT complete",
    with an explicit note that the earlier heading overstated the work.
  - **Deleted `DracoSolverWorker`, `AnalysisStorybookExporter`, `ContextRecoveryManager`** + their
    tests (`worker-offloading.test.ts`, `storybook-context-recovery.test.ts`) — all built-but-never-
    wired classes with real test coverage. Updated the `DracoSolverWorker` inventory item to ✅.
  - **Cleared all 75 no-console/unused-var lint warnings in `src/`.** Added `caughtErrorsIgnorePattern:
    '^_'` to the eslint config (the existing `^_` convention for unused caught errors), file-level
    `eslint-disable no-console` for the two console-intercepting utilities (`RemoteDebugStreamer`,
    `VRConsole`), converted diagnostic `console.log` → `console.warn`, and prefixed/removed genuinely
    unused vars/imports.
  - **Gates:** `tsc --noEmit` 0 errors · `eslint src/` 0 warnings · `npm test` 1367 passed / 26 skipped ·
    `cargo test --manifest-path wasm/Cargo.toml` 84 passed. Working tree clean on this branch.
- **2026-08-18 — Standalone `modules/gesture-intelligence/` sprint complete (out-of-roadmap, architecturally separate):**
  Frozen 56-dim feature vector, heuristic + ONNX classifier with **honest provenance** (`source` = the path that produced the numbers;
  explicit `degradedReason`), biomechanical calibration (speed-EMA + sticky-band hysteresis), on-device personalization (threshold
  coord-search over replayed F1, adopt only on F1 gain), IndexedDB v2 persistence with visible memory fallback, and a
  capture→train→deploy pipeline (`CaptureRecorder` → `merge_corpus.ts` → `retrain.ts` → `export_onnx.py`). Trained on **synthetic**
  data: held-out accuracy 0.9111, macro-F1 0.9087, 24 KB ONNX, all 6 classes predicted; model-card sha256 verified on every `init()`.
  78/78 module tests green; module typecheck/lint/build clean; real onnxruntime-web integration passes headlessly in node. **NOT yet
  wired into the host** (`src/` never imports it). Added **Phase 23** below: host integration + per-user personalization + global opt-in
  capture→retrain loop (Tier A feature-only corpus; raw positions stay on-device) + central staged retrain + federated/drift research.
- **2026-08-18 — Phase 24 UX architecture planned (Analyst Cockpit & Interaction Hierarchy):**
  Cross-verified the 20-point UX architecture review against `src/vr/ui/*`, `InputRouter`, `SystemGestureDetector`,
  and the 2026-08-18 Quest telemetry. Findings: 4 parallel nav systems CONFIRMED, VRMenu 0.95m×1.45m with 29 buttons
  CONFIRMED, 57% both-pinch suppression CONFIRMED (logged but not user-visible), 0/41 S2 hits CONFIRMED, UX-001
  misattributed by the review (cold-start, not aim drift — that's UX-002), no developer mode exists, no panel role
  system, no NAVIGATE/INTERACT/TRANSFORM/OBSERVE FSM, replay fixture NOT yet built (22.10 🔲). Added **Phase 24**
  below: 9 sprints — 24.1 interaction-mode FSM + focus vocabulary (foundation, blocks the rest), 24.2 HandWheel
  three-level categorization + forgiving confirm (gaze+confirm for the 91–100% pointer-miss), 24.3 VRMenu
  decomposition into dataset-relevant contextual surfaces, 24.4 panel roles taxonomy + diagnostic mode separation +
  paging, 24.5 dashboard-as-workspace + transient context cards, 24.6 progressive disclosure as architecture
  (novice/analyst/researcher/developer), 24.7 both-pinch gesture ownership redesign (coupled to Phase 23.1 host
  wiring), 24.8 calm visual language + status strip + spotlight/context model, 24.9 UX-001..UX-012 as measurable
  acceptance gates (depends on the 22.10 replay fixture). Phase 24 absorbs/reframes incremental Phase 22 items
  (22.3 input-correctness, 22.4 zonation, 22.7 task-first, 22.10 inventory) into an architectural frame; grounded
  in Concept Paper principles P6/P7/P8/P9/P12 and frames the work as study-harness validity (paper Risk 4) not
  feature work.
- **Last updated:** 2026-08-18 — Phase 21.5 (Rust/WASM Draco Constraint Engine, Bayesian Evidence, Intent Compiler & Structure Discovery) complete:
  Ported the full Draco symbolic constraint engine to native Rust (`wasm/src/draco/`): 3,168-candidate combinatorial solver with 5 hard constraints
  and 20 weighted soft constraints (`solver.rs`), Bayesian empirical utility prior cost adjustment (`evidence.rs`), and complete type-safe
  `DracoSpec`/`DracoFacts`/`SolverResult` schema (`types.rs`). Implemented deterministic NL intent→AST compiler in Rust (`wasm/src/intent/compiler.rs`)
  supporting reset, anomaly detection, aggregation, between/comparison/in/eq filters, and clustering intents. Added canonical `StructureSet`
  generation from TDA Mapper graphs, persistence intervals, and cluster assignments (`wasm/src/data/structure_discovery.rs`). Exposed 5 new WASM
  ABI exports (`draco_solve`, `draco_evaluate_candidate`, `draco_adjust_evidence`, `intent_compile`, `atlas_discover_structures`) and wired typed
  TypeScript bridge methods in `src/wasm/RuntimeBridge.ts`. 83/83 Rust tests pass, all CI gates green.
  Phase 21.4 (Rust/WASM 3D Spatial Layout Simulation Engine) complete:
  Implemented full suite of computational 3D spatial layouts in Rust (`wasm/src/layouts/`): force-directed N-body graph physics (`force_directed.rs`),
  3D volumetric matrix packing (`grid.rs`), concentric conical trees (`radial_tree.rs`), multi-series temporal ribbon curves (`time_ribbon.rs`),
  geospatial room-scale projections (`geo_surface.rs`), and vector field streamline advection (`streamline.rs`).
  Exposed canonical WASM ABI layout exports in `wasm/src/lib.rs` and wired typed continuous `Float32Array` coordinate buffer bridges through
  `src/wasm/RuntimeBridge.ts` and `src/draco/layouts/`, eliminating intermediate `THREE.Vector3` object allocations per solve.
  Documentation Audit, Netlify Landing Fix & Canon Alignment complete:
  Fixed `docs/index.html` landing page on Netlify by replacing failing cross-origin iframes with a self-contained spatial runtime HUD,
  deleted 35 obsolete pre-generated `.html` twins, legacy study draft duplicates, and superseded sprint reports, and synchronized all canonical
  documents (`docs/ARCHITECTURE.md`, `docs/ANALYTICS.md`, `docs/INTERACTIONS.md`, `docs/PROJECT_DOCS_INDEX.md`, `AGENTS.md`) with the
  ground truth of the 100% pure TypeScript codebase and Rust WASM analytical kernel.
  Full TypeScript Migration complete; World Facade decommission NOT complete:
  Converted all 63 remaining JavaScript test suites and helpers in `tests/` to pure TypeScript (`.ts`), eliminating all `.js`
  files across `src/` and `tests/` (this part is done). Wired canonical domain coordinators and `WorldUIManager` behind the
  `World.ts` facade (presentation controllers decoupled; all 6 CI gates green). The 17 legacy `@deprecated` duplicate
  accessors on `World.ts` remain as a compatibility shim pending the `MIGRATION.md` removal deadline — **the facade
  decommission itself is NOT complete**: the coordinators are authoritative and the facade delegates to them, but the
  deprecated surface has not been deleted. (The earlier heading here claimed "World Facade Simplification complete",
  which overstated the work — only the coordinator wiring is complete, not the decommission.)
  World Facade Deprecation, Domain Boundaries & Architectural Invariants complete:
  Formalized `MIGRATION.md` register with facade deprecation timelines, added `@deprecated` JSDoc annotations across `World.ts`
  legacy getters, and implemented the automated architectural invariant suite in `tests/architectural-invariants.test.ts`
  (validating Atlas analytical independence without DOM/Three.js, standalone session restore without prior World references,
  and deterministic embodiment command reproducibility).
  Engine Lifecycle, Frame Budget Correctness, Typed EventBus & Invariants complete:
  Implemented explicit `EngineState` machine (`running | context_lost | paused | disposed`), unbinding and listener cleanup for `window.resize`,
  `sessionstart`, and `webglcontext` events on `Engine.dispose()`, clean VR button DOM element removal, `Set<FrameTask>` updatables deduplication,
  accurate performance budget measurement in `_tick()`, and generic compile-time event typing via `NemosyneEventMap` in `WorldEventBus.ts`.
  Validated with 0-leak disposal invariant test suite in `tests/engine-lifecycle.test.ts`.
  Connector In-Band Auth, Keepalive Reaper & Participant ID Sanitization complete:
  In-band authentication message support in `WebSocketAdapter.ts` (keeping tokens out of URL query strings), 30s automated
  ping/pong keepalive sweep and zombie socket reaper in `SignallingServer.mjs`, and strict participant ID input validation
  in `ExperimentRunner.ts` (`^[a-zA-Z0-9_-]{1,64}$`) preventing injection/traversal.
  Evidence-Informed Draco Recommender & Interactive Study Mode UI complete:
  Implemented `StudyModeModal.ts` and `StudyController.ts` validated in `tests/study-controller.test.ts` (VR & desktop trial HUD,
  real-time head-movement distance tracking, node selection routing, NASA-TLX workload survey, and session exports).
  Implemented `EvidenceStore.ts` and `EvidenceWeightedScorer.ts` validated in `tests/evidence-draco.test.ts` (empirical trial
  ingestion, composite human performance utility calculation, and Bayesian candidate re-ranking).
  CI Security & Workflow Hardening: GitHub Actions least-privilege token permissions (`permissions: contents: read`),
  automated Dependency Review action on PRs (`actions/dependency-review-action@v4`), and CodeQL SAST workflow (`codeql.yml`).
  Atlas 7 complete: Deterministic language and intent explanation layer implemented and validated in `tests/intent-compiler.test.ts`.
  Atlas 6 complete: Controlled experiment harness implemented and validated in `tests/study-harness.test.ts`.
  Collaboration Gateway Security & Architecture Hardening:
  HMAC-SHA256 cryptographically signed room tickets (`SignedTicket.ts`), rejection of unsigned/raw JSON tokens,
  in-band WebSocket authentication (credentials removed from URL query strings in `SignallingChannel.ts`),
  IP auth-failure throttling & brute-force defense, strict protocol schemas & capability-based authorization,
  server-authorized roles, dedicated `observerAuthToken`, scoped shared secrets, anti-CSWSH Origin enforcement,
  IP and peer rate limiting, room idle cleanup (`SignallingServerCore.ts`), ephemeral `sessionStorage` credentials
  (`NetworkManager.ts`), `/__signal` URL query matching fix (`vite.config.js`), orphaned second WebGL context eliminated
  (`SceneGraphController.ts`), and `IceVaultNode.ts` landmark wired in `WorldSceneComposer.ts` with comprehensive test coverage.
  Atlas 5 complete: end-to-end session-restore gate validated.
  Atlas 4 completion: rowIndices refactor, TDA panel click-to-navigate, full structure-handle lifecycle.
  Wave 6 via PR #130. UX & spatial 3D assets via PR #136; world-aware UX telemetry via PR #137.
- **In-Experience VR Session Exit Flow ✅:**
  - Added in-VR "Exit VR" (🚪) session termination triggers to `HandWheelMenu` (`panels` category) and `SettingsPanel` (`onExitVR`), calling `engine.exitVR()` (`session.end()`) to provide clean, self-contained return to 2D desktop mode without depending solely on Quest OS system-level menus.
- **Active sprint:** Multi-User Collaborative Exploration & Live Study Replication. Real-time peer avatar synchronization
  in controlled trials, observer trial monitoring HUD, and empirical data aggregation.
  Governing rules: no TS analytical production impl; no runtime choice between analytical impls; all
  research-relevant transforms through the versioned Rust kernel (provenance envelope on every result);
  use battle-tested Rust crates; saved-session compatibility breaks (kernel carries `kernelVersion`).
- **Wave 0 ✅ (security P0 + dead code + hygiene):** `RemoteDebugStreamer` gated to `import.meta.env.DEV`
  with a bounded/backoff retry queue; Vite dev POST endpoints (`/__remote-logs`, `/__loadtest-results`,
  `/__ux-trace`) bounded (body cap, timeout, rate limit, structural caps) and `/wasm` path-traversal
  fixed; `preview.host` limited to localhost; signalling uses constant-time token compare and the
  standalone server rejects open (no-token) mode by default; `FileLoader` adds a `file.size` pre-check
  before reading a file into memory. Deleted `tests/file-loader.test.js` + `tests/tda-mapper.test.js`
  (skip stubs) and the `src/vr/scalability/ObjectPool.ts` shim (4 e2e specs repointed to
  `src/utils/ObjectPool.ts`); untracked `.DS_Store` + `temp_phase23.md`; fixed committed `.gitignore`
  merge markers; added `docs:build` script and consolidated deploy on Netlify (removed `deploy:vercel`).
- **Wave 1 ✅ (Rust Analytical Kernel — canonical versioned ABI):** kernel `0.2.0`. New Rust modules:
  `provenance.rs` (envelope side-channel + `nemosyneNowMs` host-clock import), `fingerprint.rs`
  (canonical FNV-1a matching `DatasetSpace`'s UTF-16-code-unit algorithm, replacing the divergent
  `DefaultHasher`), `encodings.rs` (`inferEncodings` + topology-aware variant), `statistics.rs`
  (`Facts` with ndarray Pearson correlation). `operations_bridge.rs` rewritten: serialisable
  `Predicate` DSL (eq/ne/gt/gte/lt/lte/in/between/isnull + and/or/not, replacing the JS closure),
  `AggregateSpec` named aggregators (sum/mean/median/min/max/count/std/var; legacy sum-all-numeric kept),
  `Compare`, `anomaly_zscore` (population std, threshold default 3) + `anomaly_iqr` op-name alignment.
  `Dataset` round-trips edge `weight` + extra keys (`Edge` struct). New lib.rs exports:
  `kernel_version`, `kernel_provenance`, `dataset_fingerprint`, `data_infer_topology`,
  `data_infer_encodings`, `data_infer_schema`, `data_statistics`, `data_parse_arrow`,
  `data_compute_mapper_graph`, `data_compute_persistence_intervals`, `data_compute_betti0_curve`,
  `data_compute_radial_tree_3d`; `data_operation` now records provenance. Capability flags
  `CAP_TOPOLOGY_RUST|CAP_TDA_RUST|CAP_ENCODINGS_RUST|CAP_STATS_RUST` advertised (bits 10–13; `0x3c07`).
  `RuntimeBridge.ts` typed wrappers + `globalThis.nemosyneNowMs` install; `types.ts` extended
  (`Predicate`/`FilterSpec`/`Aggregator`/`AggregateSpec`/`CompareSpec`/`Facts`/`Provenance`/TDA types).
  Porting rule: Rust `#[test]` (61 pass) + `tests/wasm-runtime.test.ts` RuntimeBridge parity cases
  (26, run when the pkg is HTTP-served; skipped in plain jsdom by design). `eslint.config.js` now
  ignores generated `wasm/pkg/` + tooling `.claude/`. **Deferred:** isolation-forest anomaly
  (smartcore ensemble needs rand/getrandom wasm wiring — covered by iqr+zscore for now); linfa
  clustering swap (k_means/hierarchical/dbscan remain the hand-rolled-but-deterministic impls for
  now, seeded from the canonical fingerprint); byte-exact JS `JSON.stringify` number-format parity
  (ECMAScript exponent rules — landed in Wave 6 when `DatasetSpace` delegates fingerprint to the kernel).
- **Wave 2 ✅ (mandatory WASM, JS analytical fallback removed — kernel is the only analytical path):**
  No `src/` production code imports or calls any JS analytical module; no `if (caps & …)` routing remains
  (capability flags are telemetry-only). `DataOperationController._computeDataset` routes EVERY op through
  the kernel (`loadDatasetJson` → `runOperation` → `getDatasetJson`, handles destroyed in `finally`); the
  default filter threshold comes from `kernel.statistics` median (median computed in Rust — no JS stat);
  `apply`/`preview` abort cleanly on kernel failure (no JS fallback). `DataOperations.ts`: deleted
  `computeOperationDataset` + the `DatasetOperations` analytical imports; `buildWasmOperationSpec` → pure
  `toKernelSpec(operation, dataset, _original, medianOf?)` mapper covering all ops (filter/sort/aggregate/
  compare/cluster/hierarchical/density/anomaly/timeSlice; identity `slice` for unsupported shapes).
  `FileLoader.ts`: kernel-only `_parseViaKernel` (parse + topology + encodings via the kernel before
  releasing the handle); removed `parseCSV`/`parseJSON`/`inferTopology`/`inferEncodingsForTopology` JS paths.
  `World.start` surfaces a hard "analytical kernel unavailable" state (`_wasmUnavailable` + VRConsole error,
  no silent JS fallback); `_maybeLoadSampleFromWasm` lost the `CAP_DATASET_RUST` gate (sample *content* may
  still come from the static `SampleDatasets` data arrays when the kernel is absent — that is data, not
  analytics). `TDAPlanes.buildTDASummaryGroup` routes persistence/mapper/betti0 through the kernel
  (`bridge?` arg; `recompute()` no-ops when no bridge = the unavailable state, NOT a JS fallback); deleted
  the `TDAMapper` import. `WorldRendererLifecycle` gets a `getWasmBridge` option. `WasmRuntimeBridge` type
  extended with the lower-level kernel + TDA calls. Tests: new `tests/helpers/kernelMock.js` (test-only,
  delegates to the still-present JS modules — Wave 3 deletes those) lets World/controller/FileLoader
  integration tests exercise orchestration in plain jsdom; `live-preview.test.js` uses inline result
  Datasets (visual-marker tests, not analytics); `data-operation-controller.test.js` uses the mock bridge +
  a "kernel unavailable aborts cleanly" case. `timeSlice` now slices a window of the CURRENT transformed
  dataset (kernel `slice` runs against the current handle) — more correct than the old JS path which sliced
  the original and discarded prior ops.
- **Deferred to Wave 6 (carried from Wave 2/5) — RESOLVED in Wave 6:** chaining `build:wasm` into
  `build` (requires Netlify/CI Rust toolchain setup; still open); byte-exact JS `JSON.stringify`
  number-format parity (lands when `DatasetSpace` delegates fingerprint to the kernel) — done;
  `Dataset.rangeOf`/`cardinalityOf`/`fingerprint` confirmed renderer consumers and DatasetSpace routing
  through AtlasCore — done.
- **Wave 3 ✅ (delete orphaned JS analytical modules + tests):** `git rm`'d the 7 JS analytical modules
  (`DatasetOperations`/`Parsers`/`CSVDataParser`/`CSVParserWorker`/`ArrowBinaryParser`/`TopologyInference`/
  `analytics/TDAMapper`); split `Encodings.ts` (kept visual helpers, deleted `inferEncodings`); removed
  `Dataset.fromCSV`; inlined `normalize.inferType`; dropped the `VRTopologyTranslator.inferEncodings`
  fallback; rewrote `kernelMock.js` self-contained; deleted 8 JS tests + 2 topology-parity e2e (porting-rule
  coverage in Rust `#[test]`s + `wasm-runtime.test.ts`); converted ~12 e2e/integration tests. Honest flag:
  `CSVParserWorker` async-worker path removed (no kernel equivalent); underlying CSV parse covered by Rust.
  Full detail in commit 367cdcd + the sprint memory.
- **Wave 4 ✅ (AtlasCore + NemosyneSession — authoritative session + provenance ledger):** new
  `src/atlas/AtlasCore.ts` — the single analytical authority: owns the kernel handle + current
  `DatasetSpace` + `AnalysisResult` chain + `ResearchEvent` provenance ledger; SOLE caller of the kernel
  for the operation path (`runOperation`/`statistics`/`inferTopology`/`inferEncodings`/`datasetFingerprint`);
  reads `bridge.kernelProvenance()` after each kernel call and embeds it in every `AnalysisResult` +
  `ResearchEvent` (null-tolerated for the mock, never fabricated); `AnalysisHistory` retained as the
  undo/redo cursor alongside the ledger (intentional double-bookkeeping — unified in Wave 6 into a
  ledger-derived view). New
  `src/session/NemosyneSession.ts` — authoritative logical session: `serialize()`/`deserialize()`/
  `loadFromJSON()`, `schemaVersion 2`, persists `datasetVersion`/`datasetFingerprint`/`currentDataset`/
  `originalDataset`/`datasetSpace`/`analysisResults`/`eventLedger`/`analysisHistory` + presentation state.
  New `src/atlas/types.ts` — `AnalysisSpec`/`AnalysisResult`/`AtlasRecommendation`/`ResearchEvent`/
  `AtlasCoreState` per the governance contract. `DataOperationController` refactored to issue typed
  `AnalysisSpec` commands to AtlasCore (controller does visual + events only; ZERO direct bridge calls —
  grep-verified); `WorldSessionController` is now a thin save/load trigger delegating to `NemosyneSession`
  + `SessionStore` (snapshot authority moved off it). `World` owns one `AtlasCore` + one `NemosyneSession`;
  facade setters route through atlas; `undoAnalysis`/`redoAnalysis`/`_seekAnalysisHistory` consolidated
  through the controller (the HISTORY_SEEK listener restores); `_initWasmRuntime` → `atlas.setKernel`;
  `dispose()` disposes atlas.   `DatasetSpace.ts` exports `fnv1aHex`/`canonicalize` (reused by AtlasCore for
  `outputHash`/`stateHash`). `SessionStore` `schemaVersion 2` (rejects 1). **DEFERRED to Wave 6** with
  `TODO(Wave 6)` markers — **all RESOLVED in Wave 6:** route `FileLoader` parse, `World._maybeLoadSampleFromWasm`,
  and `TDAPlanes` through AtlasCore (they previously called the bridge directly — did NOT violate governing
  rules 1-3; the kernel did the work + emitted provenance). New tests `tests/atlas-core.test.ts` +
  `tests/nemosyne-session.test.ts`
  lock the ledger/round-trip/tamper contracts; all changed wirings updated, no assertions relaxed.
  Acceptance check: scene graph rebuildable from `NemosyneSession.serialize()`.
- **Model routing (2026-08-17, local/gitignored `.ai/model-routing/`, docs/config only — no gate):** local
  `model-routes.json` + `README.md` + `tool-mappings.md` standardizing provider selection across Claude
  Code / OpenCode / Antigravity — four groups (`ollama-cloud`/`google`/`opencode-go`/`opencode-zen`), a
  task-class → preferred/fallback routing table, switch triggers (429/capability/cost/context), and a
  decision procedure. Manifest only — harness dispatch unchanged. Motivating incident: an Ollama Cloud
  session 429 killed a Wave-4 sub-agent. `.ai/` is gitignored (like `.agents/`/`.claude/`); pointers in
  `AGENTS.md` + `CLAUDE.md`.
- **Last gate result (2026-08-17, Wave 6):** `cargo test` 67/67 pass (64 + 3 new fingerprint tests;
  run locally via a portable zig-cc linker shim — the stripped container has no gcc); `npm run wasm` exit 0
  (wasm-pack release → `wasm/pkg`); `cargo build --target wasm32-unknown-unknown` ok; `tsc --noEmit`
  clean; `eslint` 0 errors (pre-existing `no-console`/unused-var warnings only); `npm run test:all` green
  (Vitest 182 files passed / 1 skipped, 1,268 tests passed / 26 skipped — the wasm-runtime RuntimeBridge
  parity cases skip in plain jsdom by design; Rust `#[test]`s cover the same logic); `test:coverage`
  83.15/70.4/78.36/85.7 (thresholds 70/70/65/55); `npm run build` exit 0.
- **Wave 5 ✅ (Draco as pure embodiment consumer — facts supplied, not computed):** Draco performs NO
  dataset-derived statistical computation. `ConstraintEngine.extractFacts` + the analytical helpers
  (`_numericStats`/`_correlationMatrix`/`_temporalStats`/`_categoricalDistribution`/`_estimateOutlierCount`/
  `_estimateClusterCount`) DELETED from `src/draco/ConstraintEngine.ts`. New `FactProvider` interface in
  `src/draco/types.ts` (`facts(input): DracoFacts | null`); `ConstraintEngine.solve(input, facts?)` takes
  facts as INPUT — resolves `facts ?? factProvider?.facts(input) ?? null` and throws if none supplied
  (rule bodies unchanged — mechanical provider swap). `DracoTopologyNode` + `DracoSolverWorker` take an
  optional `FactProvider` (5th ctor arg / per-call request field). **AtlasCore is the Draco FactProvider:**
  `asFactProvider()` + `dracoFacts(input)` call `this.facts()` (kernel.statistics), map kernel `Facts` →
  `DracoFacts` via `mapKernelFactsToDraco` (pure shape mapping: stdDev=std, symmetric correlationMatrix
  from `kf.correlation` pairs, categoryDistribution fraction=count/total, outlierCount from primary
  numeric, trendDirection/seasonalityHint from `kf.temporalStats[0]`, cardinalityOfColor from
  `kf.categorical`); reads `bridge.kernelProvenance()` after the kernel call. `minimalDracoFacts`
  (schema-metadata only, NO stats) is the no-kernel fallback so the renderer shell mounts before
  `start()` loads wasm — NOT analytical. `World._initWasmRuntime` calls `_rebuildPalaceWithKernelFacts()`
  after `atlas.setKernel` to rebuild the palace with kernel facts in production. **Kernel `Facts` extended
  (Rust):** `ColumnStats` gained `skew`/`kurtosis`/`outlier_count` (`skew` + `kurtosis` via the
  battle-tested `statify` crate — rule 4, excess kurtosis, `unwrap_or(0.0)` on degenerate columns;
  `outlier_count` stays a hand-rolled MAD modified-Z heuristic, no surveyed crate ships it); new
  `TemporalStats` struct
  `{column,value_column,trend_direction,seasonality_hint,normalized_slope}` (least-squares slope +
  lag-autocorrelation > 0.5 → seasonalityHint); `Facts.temporal_stats` Vec. 3 new Rust `#[test]`s
  (skew/kurtosis symmetric ≈ 0, outlier_count flags extreme, temporal trend up). RuntimeBridge +
  `types.ts` extended; `kernelMock.js` canned facts now include the new fields. **World wiring:**
  `_doLoadDataset` now sets the atlas current dataset BEFORE building the Draco palace (so
  `atlas.inferEncodings` + `asFactProvider` see the new handle); encodings chain is
  `entry.encodings ?? kernelEncodings ?? getDefaultEncodings(...)`; `DracoTopologyNode` gets
  `atlas.asFactProvider()`. `WorldRendererLifecycle.rebuildDashboard` gets facts from `getAtlas()` →
  `atlas.dracoFacts(input)`, NOT `dracoNode.engine.extractFacts(dataset)`; falls back to dataset schema
  when no atlas. `VRTopologyTranslator` already consumed `dataInput.encodings ?? {}` (no own
  `inferEncodings` default — Wave 3 removed it); kernel encodings now wired through World. **TODO(Wave 5)
  resolution:** `Dataset.rangeOf`/`cardinalityOf`/`fingerprint` are RENDERER consumers
  (VRTopologyTranslator size scaling, LayoutBase, DatasetSpace normalization, SeededRandom seed) —
  embodiment logic, NOT analytical; the analytical consumer (`extractFacts`) is deleted. Comments updated
  to point at the kernel source (`ColumnStats`/`CategoricalStats.cardinality`/`dataset_fingerprint`) with
  `TODO(Wave 6)` for routing DatasetSpace through AtlasCore. **Test-only fact provider:**
  `tests/helpers/dracoFactsHelper.ts` keeps the former canned extractFacts logic so Draco RULE tests run
  in plain jsdom without the wasm pkg (NOT production code — no `src/` import; statistical parity covered
  by Rust `#[test]`s + `wasm-runtime.test.ts`). 15 test files updated to pass `makeFactProvider()` /
  `computeFacts` (threshold options mirror `ConstraintEngineOptions`). Governing rules grep-verified:
  no `if (caps & …)` routing in `src/`; no `extractFacts`/`_numericStats`/`_correlationMatrix`/
  `_temporalStats`/`_categoricalDistribution` in `src/draco/`; `VRTopologyTranslator` uses only
  `categoricalColor`/`numericColor`/`normalize` (three.js visual mapping, NOT analytical).
- **Wave 6 ✅ (all kernel call sites routed through AtlasCore + ledger-derived history + byte-exact
  number parity):** every production kernel call now goes through `AtlasCore` (the single analytical
  authority) — grep-verified: no `src/` code imports `RuntimeBridge` except `World._initWasmRuntime`
  (kernel bootstrap → `atlas.setKernel`) and `RuntimeBridge.ts` itself. `AtlasCore` gained `parseBytes`
  (parse + topology + encodings, transient handle destroyed in `finally`, throws on unavailable/rejected
  kernel — no JS fallback), `loadSample(key)` (null when kernel absent or key unknown → static
  `SampleDatasets` content is data, not analytics), and `computePersistenceIntervals`/`computeMapperGraph`/
  `computeBetti0Curve` via a `_tdaCall` transient-handle helper (reads `lastProvenance()`; TDA results are
  NOT ledger events). `FileLoader` dropped `wasmRuntime`/`setWasmRuntime`/`wasmCapabilities` for `atlas?:
  AtlasCore | null` (name-setting/validation/errors stay in the loader). `World` dropped `getWasmBridge`
  from `RendererLifecycleOptions`; `_maybeLoadSampleFromWasm` → `atlas.loadSample`; loader gets `atlas:`.
  `TDAPlanes.buildTDASummaryGroup` takes `atlas?` and routes recompute through it.
  **Double-bookkeeping collapsed:** `AnalysisHistory` is now a DERIVED VIEW (`_buildHistoryFromLedger`)
  rebuilt from the authoritative `ResearchEvent` ledger (replays load→reset, analysis/reset→push with
  `current`-tracked `before` datasets, undo/redo/seek→cursor moves; cache invalidated on every
  `_appendEvent`/`_resetState`/`restoreState`); `toState()` emits the derived snapshot and `restoreState()`
  ignores persisted history (ledger is authoritative); `undo`/`redo`/`seekHistory` read
  `this.analysisHistory`. **Number parity landed (deferred from Wave 1/2):** `fingerprint.rs.write_number`
  rewritten to the ECMAScript `Number::toString` algorithm (fixed for `-5 ≤ k ≤ 21`, exponential `d[.ddd]e±X`
  otherwise; `0`→`"0"`, non-finite→`"null"`) so `dataset_fingerprint` is byte-exact vs `JSON.stringify` —
  verified against real V8 ground truth via node.exe; 3 new Rust `#[test]`s (20-case ECMAScript table,
  zero/non-finite, dataset fingerprint matches JS FNV-1a). `DatasetSpace` constructor gained optional
  `sources?: { fingerprint?: string | null; ranges?: Record<string, DatasetSpaceNormalization> | null }`;
  `AtlasCore.datasetSpace` delegates fingerprint (`_kernelFingerprint`, kernel-direct to avoid the
  datasetFingerprint-getter recursion) + numeric ranges (`_kernelRanges` from `facts().numeric`) with
  `fnv1aHex`/`rangeOf` fallback when the kernel is absent (schema metadata, NOT analytical). Tests:
  `session-roundtrip.test.ts:91` migrated from a direct `analysisHistory.push` to a real `applyAnalysis`
  (toAnalysisSpec); `file-loader`/`world`/`world-coverage` wire kernels through AtlasCore; `tda-planes`
  adds an AtlasCore-routed recompute spy test; `world-renderer-lifecycle` drops `getWasmBridge`.
- **Atlas 2 ✅ (structure discovery — complete):** Three structure-discovery paths now produce
  provenance-bearing, stable-ID `StructureSet` results through `AtlasCore`:
  - `discoverMapperStructures` — Mapper graph nodes → `DiscoveredStructure[]` (kind `mapper-node`)
    with sorted row indices and stable `DatasetSpace` datum IDs.
  - `discoverPersistenceStructures` — persistence intervals → ranked structures (kind
    `persistent-component`) with birth/death evidence scores.
  - `discoverClusterStructures` — projects the kernel's existing k_means/hierarchical/dbscan ops
    (via `runOperation` + `_cluster` column) into `DiscoveredStructure[]` (kind `cluster`) grouped
    by label. Pure TS projection — the clustering math stays in Rust; no JS analytical impl.
  Structure IDs use a `canonicalParams()` serializer (recursively sorted keys) so semantically
  identical parameter objects produce identical IDs regardless of insertion order. Every
  `discover*` call pushes a `'structure'` `ResearchEvent` (new `ResearchEventKind`) carrying the
  full `StructureSet`; `AtlasCoreState.structures` is a derived field rebuilt from the ledger on
  `restoreState()` (ledger-authority pattern, mirroring `AnalysisHistory`). `NemosyneSession`
  serializes/deserializes structures transparently via `AtlasCoreState`. Focused tests cover
  cluster projection + determinism, canonical param identity, and ledger-rebuild on restore.
  `Dataset.rangeOf`/`cardinalityOf` `TODO(Wave 6)` markers resolved. **Deferred:** chaining
  `build:wasm` into `build` (Netlify/CI Rust toolchain) still open.
- **Deferred (storage hardening, target Wave 9 / Stable Alpha):** IndexedDB is the right base and already in
  use (`SessionStore.ts`), but the current shape is suboptimal at Nemosyne scale — one record = whole
  `NemosyneSession.serialize()` blob rewritten on every autosave (two full dataset copies + history → tens of
  MB per op); JSON-in-IDB (no structured-clone/typed-array/Arrow benefit); append-only `ResearchEvent` ledger
  rewritten in full; no `navigator.storage.persist()` (research sessions evictable, esp. Quest) or `.estimate()`
  quota guard. Plan: split the record to mirror the substrate — immutable original dataset stored once by
  content fingerprint (dedup across sessions; `DatasetSpace` already FNV-1a-fingerprints), append-only ledger
  in its own key/store, small mutable analysis-cursor + presentation state separate; store dataset bytes as
  Arrow/typed arrays via structured clone; call `storage.persist()` + `.estimate()`; consider OPFS for the large
  immutable dataset-bytes tier. Aligns with post-Wave-4 AtlasCore/DatasetSpace; not touched during Wave 5.
- **Atlas 3 initial slice ✅ (guidance layer):** `GuidanceEngine` (`src/atlas/GuidanceEngine.ts`)
  consumes `StructureSet` outputs and produces `AtlasRecommendation`s with:
  - Typed `AnalyticalAction` enum (`inspect-cluster`, `inspect-boundary`, `explore-region`,
    `compare-regions`, `investigate-anomaly`) replacing free-form `action: string`.
  - Structured `AnalyticalEvidence[]` (`{ type, value, source }`) referencing `DiscoveredStructure.id`s,
    replacing the single `evidence: string` summary (kept for backwards compat).
  - Propagated `provenance` from `StructureSet` into the recommendation.
  - `'pending'` decision state so freshly-generated recs don't need a fabricated decision.
  - `AtlasCore.generateRecommendation()` runs the engine over `this._structures`; convenience methods
    `acceptRecommendation()` / `rejectRecommendation()` / `overrideRecommendation()` record decisions.
  - Every recommendation decision appends a `'recommendation'` `ResearchEvent` with
    `recommendationDecision` populated — closing the audit-trail gap where `recordDecision` previously
    didn't touch the ledger.
  - Session serialization round-trips recommendations transparently via existing `AtlasCoreState`.
  Focused tests: cluster→`inspect-cluster`, persistence→`inspect-boundary`, ledger event verification,
  state restore round-trip, compare-regions dual-target, investigate-anomaly for DBSCAN noise,
  embodiment hint rule mapping.
- **Atlas 3 ✅ (guidance layer — complete):** All three guidance surfaces built and wired:
  - **Multi-structure rules:** `detectComparison` flags divergent cluster sizes (>15% relative gap)
    as `compare-regions` with dual `targetIds`; `detectAnomaly` flags DBSCAN noise (label -1) and
    low-persistence features as `investigate-anomaly`. Priority: anomaly → comparison → single-structure.
  - **VR UI:** `RecommendationPanel` (`src/vr/ui/RecommendationPanel.ts`) extends `MovablePanel`,
    renders action/rationale/evidence/confidence-bar/limitations/suggestedEmbodiment, with
    Accept/Reject/Override buttons (UV hit-test pattern). Wired into `WorldUIManager` (construct/
    register/hide), `World.ts` (facade + callbacks), `WheelMenuBuilder` (Guidance toggle).
  - **Draco embodiment wiring:** `EmbodimentHints.ts` maps `suggestedEmbodiment` → Draco
    soft-constraint reweighting (weight=100): `highlight-cluster`→cluster_volume+cluster_probe,
    `outlier-orb`→orb_for_outliers, `split-view`→fork_plane_for_tabular, etc. Triggered on
    `_acceptRecommendation()` via dynamic import (lazy-loaded chunk); `dracoNode.reSolveAndSynthesize()`
    rebuilds the VR artifact with biased constraints.
  - **Auto-generation trigger:** `_discoverStructuresAndRecommend(operation)` fires after every
    `OPERATION_APPLIED` event — discovers cluster structures after cluster ops, mapper+persistence
    structures after TDA ops, then calls `generateRecommendation()` and marks the panel dirty.
- **Next:** Atlas 6 — controlled experiment harness: study conditions, tasks, trials, outcomes,
  counterbalancing, and frozen configuration. Human-performance claims require controlled evidence;
  telemetry, unit tests, and benchmark utilities alone are not study evidence.
- **UX & Spatial 3D Assets ✅ (Blender MCP pipeline + 3D spatial UI housings):** Comprehensive review
  of VR UX completeness and coherence across panels, landmarks, and menus (`VRMenu` & `HandWheelMenu`).
  Created a suite of production-grade 3D WebXR assets via Blender 5.2 MCP (`SpatialPanelHousing.glb`,
  `HandWheelHub.glb`, `TechnoCoreMonolith.glb`, `FarcasterGate.glb`, `IceVaultGlyph.glb`, `SpatialActionPuck.glb`)
  in `public/models/ux/`. Implemented `src/vr/ui/SpatialAssetRegistry.ts` for caching, hierarchy cloning,
  and headless test fallbacks; enhanced `MovablePanel.ts` and `VRMenu.ts` with 3D beveled spatial housings
  (chamfered frame, grab handle bar, status LED jewel, dynamic `Screen_Face` UV mapping); enhanced
  `HandWheelMenu.ts` with the 3D `HandWheelHub` constellation palm dial socket. Tested via
  `tests/spatial-asset-registry.test.ts` (8 new tests).
- **World-Aware UX Telemetry & Diagnostics ✅:** Upgraded UX telemetry to be world-aware with
  `src/vr/trace/WorldSpatialContext.ts`. Classifies memory palace spatial zones (`CENTRAL_PLAZA`,
  `TECHNOCORE_SECTOR`, `FARCASTER_GATEWAY`, `ICE_VAULT_SECTOR`, `ANALYTICAL_GALLERY`), calculates
  landmark bearing/elevation, evaluates biomechanical reach zones (`SWEET_SPOT`, `NEAR_FIELD`,
  `EXTENDED`, `PERIPHERAL`), scores ergonomic health (0-100), and flags gesture troubleshooting reasons
  (`AIM_DRIFT_EXCESSIVE`, `NEAR_FIELD_TRACKING_JITTER`, `PERIPHERAL_CAMERA_BLINDSPOT`, `OUT_OF_REACH_ZONE`).
  Integrated into `UXTraceRecorder.ts`, live in-VR HUD `InputTelemetry.ts`, and offline analyzer
  `scripts/analyze-ux-trace.mjs`. Tested via `tests/world-spatial-context.test.ts` (6 new tests).
- **Next (UX track) — Sprint 22.10 🔲: UX Inventory Check & Qualitative-Telemetry Correlation.**
  Planned 2026-08-18 from the Meta Quest session log analysis (`logs/ux-trace.jsonl` +
  `logs/vr-remote-console.log`, two sessions 413 s + 202 s). Goal: make the three log streams
  joinable by `sid` (session manifest), fold perf + friction into the trace, add a canonical UX
  phenomenon vocabulary (UX-001…UX-012) that ties qualitative experience to telemetry signals,
  add an annotation/diary channel, and an analyzer that reproduces the findings mechanically.
  Acceptance gate: a 2026-08-18 replay fixture must reproduce the 156 s cold-start, 57 %
  both-pinch suppression, and 0-target-hits findings. See Sprint 22.10 below.

### Prior track (consolidated 2026-08-16)
- **Gate baseline:** typecheck passed; lint 0 errors (~204–205 warnings); full Vitest coverage 189 files
  / 1,333 tests / 84.38% statements in 267s; production build passed. Rust tests pass 32/32 using a
  user-space GCC/libc sysroot workaround (the environment lacks the normal system C linker/libc path);
  `cargo` is otherwise unavailable in some CI envs.
- **UX trace instrumentation (dev-only):** `UXTraceRecorder` (`src/vr/trace/`) correlates pinch edges,
  selection hit/miss, gestures, system toggles, wheel open/close, and tour steps with head-gaze target +
  pointer-ray drift at 5 Hz; streams to `/__ux-trace` → `logs/ux-trace.jsonl`; analyze with
  `scripts/analyze-ux-trace.mjs`. Auto-on in dev, self-disables on 404.
- **On-device rerun #2 (2026-08-15 15:24):** `logs/ux-trace.jsonl` captured only the meta record; root
  cause was `THREE.Sprite` interactables + a recorder raycaster missing `.camera`. Fixed: `_raycastTargets`
  sets `raycaster.camera` and filters null meshes; `_buildContext` degrades per-section with a one-time
  warn. Regression test 13/13.
- **System-toggle tuning (2026-08-16):** both-hand pinch requires a 400 ms hold, skips panel-targeted
  rays, 1 s cooldown. Quest logs: 161 pinch starts, correct handedness, reach-zone suppression, but 67
  toggles in ~40 s — selection/routing UX deferred to the architectural track.
- **Meta Quest session (2026-08-16 17:52–17:55 UTC):** native input-source fallback, poseable hands,
  both/single-hand gestures, dataset loading, reach-zone suppression; no remote-console errors;
  system-toggle over-triggering still observable; Accessibility recolor deferred to UX manual testing.
- **Active work (Phase 22.3):** input validation partial success; Tier B onboarding complete; Phase
  22.3.1 has observer relay filtering, renderer-lifecycle extraction, dashboard resource disposal,
  scene teardown, and remote annotation/bookmark delta schema hardening. Atlas 1 has a production-wired
  `DatasetSpace` foundation; structure discovery, analytical guidance, research context, and replay
  remain open for Stable Alpha. Phase 21.3 stays blocked from command-buffer rollout until the B2
  load-test staircase produces `logs/loadtest-results.jsonl`.
- **Atlas architecture boundary:** current Draco remains the v1 embodiment pipeline (`Dataset` facts →
  visual spec → VR artefact). Atlas 1 provides a renderer-independent `DatasetSpace` (stable datum IDs,
  content fingerprinting, normalization, JSON round-trip); provenance-bearing structures, analytical
  recommendations, and reproducible research sessions remain gaps.
- **Resume pointers:** validation → `docs/PHASE_22_3_VALIDATION_REPORT.md`; UX trace →
  `scripts/analyze-ux-trace.mjs` + `src/vr/trace/UXTraceRecorder.ts`; audit → `docs/AUDIT_PHASES_1_20.md`;
  product docs → `docs/PROJECT_DOCS_INDEX.md`; study package → `docs/study/README.md`; Phase 22.3 scope
  → §Sprint 22.3.

### How to update this block
1. On pickup: read this block first; jump to the cited sections for detail.
2. Before stopping: refresh every bullet with current truth.
3. Keep the block concise; move longer narrative to the relevant sections below.

---

## Gate model — alignment to the Definitive Vision

[`docs/Nemosyne_Definitive_Vision_and_Roadmap.md`](Nemosyne_Definitive_Vision_and_Roadmap.md) is the
governing product + implementation spec. The crosswalk below binds the existing phase work to the
vision's Gate 0–7 model (vision §13). ROADMAP retains phase work as implementation detail; the gates
are the authoritative capability progression.

### Canonical domain terms (vision §4, Gate-0 exit criteria)

- **Investigation** — the principal product object. Today: `NemosyneSession` + `AtlasCore` +
  `ResearchContext` together carry the seeds (analytical state, event ledger, presentation state).
  First-class Investigation aggregate = Gate 1.
- **Task** — the human purpose of the analysis (vision §4.2). Today: carried only as free-form
  session metadata / UI context. Typed Task/Hypothesis model = Gate 1.
- **Evidence** — observations, findings, annotations, decision context, provenance (vision §4.4).
  Today: `ResearchEvent` ledger + `EvidenceStore`/`EvidenceWeightedScorer`. First-class
  observation/finding/evidence-link model = Gate 4.
- **Representation** — the system's explicit answer to how the investigation should inhabit spatial
  form (vision §4.5). Today: `DracoSpec` + `VRTopologyTranslator`. Widened `RepresentationRequirements`
  + `SpatialStrategy` + rationale artifact = Gate 2.

### Phase → Gate crosswalk

| Gate | Objective | Phase work | Status |
|---|---|---|---|
| Gate 0 — Foundations | ambiguity removal, sole analytical authority, canonical names | Phase 21; dead-code retirements (2026-08-18); World facade decommission; `src/ai/` + governance-doc deletion (this pass) | 🟡 in progress (~80% after this pass) |
| Gate 1 — Understand | first-class Investigation | Atlas 5 foundation; Investigation aggregate **unstarted** | 🔲 |
| Gate 2 — Represent | explainable, research-safe representation | Rust `draco_solve` shipped + cutover staged (PR #168); `RepresentationRequirements`/`SpatialStrategy` widening + rationale artifact **unstarted** | 🔲 (foundation laid) |
| Gate 3 — Experience | coherent analyst cockpit | Phase 22 (partial); Phase 24 sprints 24.1–24.9 (all 🔲) | 🔲 |
| Gate 4 — Investigate | findings + evidence first-class | observation/finding/evidence-link model **unstarted** | 🔲 |
| Gate 5 — Reproduce | Memory Palace as investigation VCS | session restore ✅; semantic-replay test ✅; branch/compare/share/explain **unstarted** | 🟡 partial |
| Gate 6 — Study | scientific instrument | StudyModeModal/StudyController proto; unified treatment-freeze + Phase 23 capture **unstarted** | 🟡 partial |
| Gate 7 — Adaptive research | learning from evidence (post-stable) | deliberately out of stable scope (vision §15) | 🔲 (correctly deferred) |

### Sequencing

The vision's governing implementation strategy (§18): **Investigation trustworthy before
adaptive; interaction coherent before clever; representation explainable before evolutionary.**

---

## Stable-release definition

The stable release is the **smallest** system satisfying these property groups (vision §14 is
authoritative):

- **Analytical** — Rust/WASM kernel authoritative; kernel version + provenance recorded; analytical
  state deterministic and serializable.
- **Investigation** — Task/Hypothesis exists; Investigation is first-class; evidence + findings
  persistent; representation decisions explainable.
- **Spatial** — one coherent navigation model; contextual task surfaces; robust focus/confirmation;
  acceptable Quest interaction performance.
- **Research** — 2D control equivalent in task semantics; treatment variables freezable; observer
  non-mutating; telemetry + outcomes joinable.
- **Reproducibility** — session restore works; semantic replay works for supported scope;
  investigation packages identify kernel + schema versions.
- **Quality** — no lifecycle/resource leaks; collaboration security enforced; representative
  workloads meet frame budgets; UX acceptance gates pass.

See vision §14 for the authoritative text and §15 for what is explicitly out of stable scope
(evolutionary/Pareto Draco, neural Draco weight prediction, full gesture personalization loop,
federated learning, broad voice command system, adaptive representation search, speculative
Memory Palace world-building).

---

# Documentation architecture

The repository now follows a three-layer model:

1. Product governance and implementation — this roadmap and the engineering docs.
2. Study protocol and methodological governance — `docs/study/`.
3. Study operations and reproducibility — `docs/study/` consent, dictionary, and version files.

This split is deliberate. The layers are related but not interchangeable.

---

# Nemosyne Roadmap

### How to update this block
1. On pickup: read this block first; jump to the cited §Sprint 22.x for detail.
2. Before stopping: refresh every bullet with current truth (date, branch, tree, gate,
   next, blockers). **Hard cap ~30 lines** — move narrative into the sprint sections below.
3. A stale "next" is worse than none.

---

# Nemosyne Roadmap

This roadmap follows a phased structure adapted to the current three.js/WebXR runtime core.

### Completed phases — Phases 1–20 (archived)

> Phases 1–20 are **complete** and have been archived to
> [`docs/archive/ROADMAP_PHASES_1-20_COMPLETED.md`](archive/ROADMAP_PHASES_1-20_COMPLETED.md)
> (archived 2026-08-18). That file is the historical record of what was built; it is **not** a
> source of current status. The compact index below is for navigation only — see the archive for
> per-sprint detail, test names, and the **BUILT, NOT WIRED** audit notes preserved verbatim.

| Phase | Status | One-line record |
|-------|--------|-----------------|
| 1 — Foundation | ✅ | Git repo, three.js/WebXR runtime on Quest 3S, controller + hand input, Vitest. |
| 2 — Specification | ✅ | Draco-style constraint engine, topology facts, hard/soft scoring, JSON-serializable spec. |
| 3 — Core Framework | ✅ | `Dataset`, `VRTopologyTranslator`, DataCard, `MovablePanel`/`PanelManager`, live connectors, wheel menu, anchor-clustered HUD. |
| 4 — Examples & Documentation | ✅ | README, ARTEFACTS, INTERACTIONS, ARCHITECTURE, GETTING_STARTED, sample datasets. |
| 5 — Artefact Library Expansion | ✅ | Column/Orb/Token/Plinth/Beam/Trail/Ring/Field/Zone, geo + flow topologies, force/radial/time-ribbon layouts, TDA glyphs, data operations. |
| 6 — Real-World Deployments | ✅ | Vite build + Netlify, GitHub Actions CI, desktop fallback, Arrow/FlatBuffers/MessagePack serializers, multi-user (P10B), neural predictor (P11). |
| 7 — VR Comfort, Scalability & Metaphors | ✅ | Panel anchor ~0.55 m, body-locked wheel, selection feedback, `InstancedPointCloud`/`SpatialIndex`/`LODManager`, scale facts, 6 interaction metaphors. |
| 8 — Deeper Analytics & TDA | ✅ | Statistical facts, hierarchical/dbscan/k-means++ clustering, anomaly layer, 2D chart planes, TDA artefact factory. |
| 9 — Production Polish & Game-Inspired UX | ✅ | HolographicInspector, gaze tooltips, constellation menus, dashboard wall, teleport anchors, guided tour, dual-hand gestures, settings, atmosphere presets. |
| 9 Evaluation Checkpoint | ✅ | 2026-07-28 checkpoint: thesis demonstrated end-to-end; recorded critical gaps (hardware validation, broad ingestion, output/provenance, collaboration, accessibility, degradation, evidence of value). |
| 10 — Decision Gate | ✅ | Track A (validate & harden: Quest profiling, CSV import, session persistence, export/provenance, accessibility, telemetry, gesture coaching) + Track B (scale & collaborate: WebRTC, free panels, shared state, avatars, annotations, desktop companion). Deferred: SQL connectors, scientific user studies. |
| 11 — On-Device AI, Observability & Ergonomics | ✅ | Analyst torso anchor, dual vertical wheel menus, guided tour, `UXFrustrationAnalyzer`, dwell/gesture-confidence telemetry, `MeshPool` + time-sliced batching, 4-agent team. |
| 12 — AI Tuning, Gesture Validation & UX Loop | ✅ | Gesture fixtures + accuracy tests, Draco golden pairs + quality suite, AI module integration, usability feedback loop (wired in P22.3), UI polish, analyst benchmark suite. |
| 13 — Real-World Ingestion & Provenance | ✅ | CSV/TSV auto-inference + schema mapping, Arrow IPC parser, storybook export, WebGL context-loss recovery. |
| 14 — WebXR Performance & GPU Caching | ✅ | Canvas-texture GPU re-upload caching, sub-range `InstancedPointCloud` buffer updates, adaptive frame/thermal governor. |
| 15 — Collaborative Memory Palaces | ✅ | WebRTC state sync, peer avatars + spatial pointers, shared annotations + co-op benchmark. |
| 16 — Voice & NL Spatial Query | ✅ | Web Speech API command listener, diegetic audio narration. |
| 17 — Architectural Hardening | ✅ | `SceneGraphController`/`WorkspaceManager` extraction, web-worker offloading (built, not wired), binary pose streaming, governor scene binding. |
| 18 — Production Runtime & Worker Hardening | ✅ | Controller delegation into `World.ts`, Blob-URL workers, binary WebRTC pose transport, closed-loop governor integration. |
| 19 — Hardening & Zero-Copy Protocol | ✅ | Numeric peer ID + monotonic sequence tracking, static ArrayBuffer reuse, governor event dispatch, workspace node lifecycle. |
| 20 — Graphics Engine & 90 FPS | ✅ | Zero-allocation instanced GPU buffers, Early-Z culling, DJB2 canvas-texture upload bypass, robust WebGL context-loss recovery, closed-loop 90 FPS governor. |

> The **BUILT, NOT WIRED** audit notes from Phases 12.4 / 13.3 / 13.4 / 17.2 are preserved in the
> archive; their disposition is re-examined by the Phase 22.6 dead-code inventory and the Phase 24
> architectural plan. The live roadmap (Phases 21–24 + Atlas V5) is authoritative for what remains.

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

### Sprint 21.3 — Scene graph & command buffers 🔄

> **Started 2026-08-15.** Readiness and load-test evidence are in progress. Command-buffer
> rollout remains gated; no Rust scene graph or production command-buffer capability is
> claimed until the B2 staircase supplies measured results.

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

### Sprint 22.3 — Accessibility, onboarding last-mile & analysis completeness 🔄

> **Started 2026-08-15.** This sprint is active across input correctness, accessibility,
> and analysis completeness; onboarding wiring is complete. Items remain unchecked until implementation and
> targeted validation provide evidence; the Quest validation report is still pending.

> Evidence base: `docs/USER_STORIES_AND_UX_ANALYSIS.md` (29 user stories, gap/UX verdicts
> with file:line, verified 2026-08-11). This sprint absorbs the verified findings of two
> UI/UX review passes. Theme: **close the last mile** — wire the class-level plumbing that
> already exists into the surface where the user encounters it.

#### Interaction trace completeness
- 🔲 **Trace every touched target.** Extend `UXTraceRecorder` beyond nearest-target summaries to record all relevant ray intersections for panels, buttons, data elements, HUD/world-space objects, and empty space. Each interaction record should include ordered target identity/type, hit point and distance, visibility/context, active hand/pinch or gesture, routing decision, head-gaze and pointer-ray poses, and world-space target coordinates. Preserve stable IDs across frames where possible, avoid recording raw user-identifying content, and update the offline analyzer/tests to support target-level hit/miss, overlap, aim-drift, and gesture-to-target correlations.

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
- ✅ **Colorblind data encoding (US22, fixed in `7649446`).** `categoricalColor()` now selects
  an Okabe–Ito categorical palette when a colorblind mode is active; `VRTopologyTranslator` and
  `ChartPlane` receive the active mode while the legacy neon palette remains the default.
  Automated coverage verifies mode-specific categorical output. Shape/texture redundancy for
  categories beyond the palette length remains a follow-up.
- ✅ **Dwell threshold user-adjustable (US23, fixed).** Added `dwellTimeMs` stepper (400–3000ms) in `SettingsPanel.ts` and forwarded threshold from `SettingsMap` / `World.ts` to `SelectionDispatcher.ts`.
 - ✅ **Hand-wheel dominant-hand binding (US9, fixed in `7649446`).** `WorldUIManager` now
  obtains the wheel hand through the dominant-hand provider used by the input coordinator,
  with a right-hand fallback when no recognizer is available. Regression coverage verifies the
  supplied dominant hand is bound.
- 🔲 **Input parity matrix (verified gap).** No analytical task should depend on one physical
  ability. Build an explicit parity matrix (action × {hand, controller, keyboard, dwell}):
  select / filter / aggregate / sort / time-slice / undo / inspect. Dwell is wired
  (`SelectionDispatcher.ts`, 1200 ms) but not exercised across every action; verify and fill
  the unset cells. (The colorblind, dwell-delay, and dominant-hand items above are the first
  rows of this matrix.)
- [ ] Add tutorial screencasts or screenshots.

#### Input-correctness bugs (from the VR-UX project review, verified 2026-08-11)
> All net-new, grounded in code. These are concrete cells of the parity matrix above —
> interaction paths that fire wrong, twice, or on the wrong hand.

- ✅ **System-toggle tuning (P2, code complete; Quest evidence pending).** Both-hand pinch now requires a 400 ms hold, ignores panel-targeted rays, and has a 1 s cooldown. Reach-zone suppression remains active. Focused Quest validation must confirm deliberate-only toggles and improved panel selection.

- ✅ **Hand-pinch double-toggle / double-fire (P1, fixed).** `InputRouter.addHand` now synchronizes `lastHandPinched` so that fallback `onPinchStart` and polling loops do not double-toggle menus or fire duplicate selections in the same frame.
- ✅ **`HandGestureRecognizer` ignores `dominantHandIndex` for single-hand gestures (P2, fixed).** Single-hand gestures (swipe, slice, okSign) evaluate `dominant` and `nonDominant` poses according to `dominantHandIndex` rather than connection array order.
- ✅ **Hand-grab locomotion conflicts with the both-pinch system gesture (P2, fixed).** `_updateHandGrabMovement` in `Locomotion.ts` now aborts immediately when both hands are pinched, preventing world lurching during system gestures.
- ✅ **`scoopDown` is a dead-end outside flight mode (P2, fixed).** Added symmetric `else` branch in `WorldInputCoordinator.ts` toggling the statistical lens when not in flight mode.
- ✅ **Seated-height offset double-counts head height (P1, fixed).** `_applyComfortOffset` in `Locomotion.ts` now sets `targetY = this.seatedHeightOffset` directly without adding `camera.position.y`.

#### Onboarding last-mile (wire the praised-but-dead features)
- ✅ **JIT gesture hints wired in production (US11).** `AdaptiveAssistController` instantiates the manager, sets the scene, and drives hints from selection and gesture context. Targeted tests cover the coordinator; Quest validation remains pending.
- ✅ **Frustration-response hint card wired in production (US12).** `AdaptiveAssistController` instantiates the manager, feeds analyzer actions, applies user mode, and parents the UI to `analystAnchor`. Targeted tests cover the coordinator; Quest validation remains pending.

#### Analysis completeness
- ✅ **Aggregate operation visual representation (US5, fixed).** `applyAggregate` in `DataOperations.ts` maps and positions each unique aggregated row across representative node markers along an arc with proportional scaling.
- ✅ **Streamline/Geo layout honesty (US2, fixed).** `StreamlineLayout.ts` reads real `u/v/w` / `vx/vy/vz` vector column components when present; `GeoSurfaceLayout.ts` normalizes elevation against dataset min/max values.
- ✅ **First-class Compare operation (fixed in `7649446`).** `DatasetOperations.compare()` now
  produces a deterministic group-A/group-B numeric-mean summary with counts and differences;
  `computeOperationDataset()` exposes the default first-categorical-column path. The current
  implementation is a foundation for before/after, selected/population, and richer inferential
  comparisons; it is not a statistical significance test.

#### Small fixes / dead-code
- ✅ Cleaned up dead declarations/code: standardized `dwellSelection`/`dwellTimeMs` on `AccessibilityOptions`; wired `snapshot.handTrackingMs` in `PerformanceBudget.ts`.
- 🟡 **Panel declutter (verified): `PanelManager.hideAll()`/`showAll()` already exist**
  (`PanelManager.ts:182-191`). Wire a single user-facing "hide all panels / focus mode"
  affordance in the wheel menu if not already exposed; not an architecture gap.
- 🔲 Undo/Redo wheel-menu items: add a disabled affordance when the history stack is empty
  (`WheelMenuBuilder.ts:279-281` acknowledges the silent no-op).
- ✅ **Dashboard wiring check (US10, resolved).** `World.ts:_buildDashboard()` constructs
  chart panels, registers them with `DashboardManager`, and adds them to engine input after
  each dataset load. Remaining dashboard work is lifecycle disposal and accessibility redraw,
  tracked in Sprint 22.3.1.
- 🔲 **Error-recovery UX messaging.** Engineering handles context loss / tracking loss /
  malformed CSV / network stalls, but user-facing recovery is raw ("WebXR input source
  disconnected"). Rewrite analyst-facing: "Hand tracking lost — your analysis is safe; switch
  to controller input or pause" / "Live stream interrupted — last update 14:32:08, 3,842
  records preserved." Principle: never make the user wonder whether their analysis was lost.

### Sprint 22.3.1 — Adversarial hardening and last-mile closure 🔲

> **Added 2026-08-16 from security, graphics, and adversarial review.** This is the next
> implementation phase after the current wiring and tuning work. No item is complete until
> targeted tests and the relevant manual/Quest evidence exist.

- [x] **Inbound shared-state authorization:** signaling now carries the peer role, role changes cannot be smuggled through state payloads, and received shared-state deltas require the channel-bound peer ID plus participant role. Regression tests cover observer elevation and claimed-peer spoofing; manual/integration confirmation remains pending.
- [x] **Observer signalling relay restriction:** observers can relay only WebRTC `offer`/`answer`/`ice` messages; direct and broadcast application-state relays are blocked and covered by network regression tests. Manual/integration confirmation remains pending.
- 🟡 **Remote delta hardening:** annotation/bookmark schemas, payload size/count/rate bounds, and malformed removal/tour-step rejection are implemented and covered; manual/integration evidence remains.
- [x] **Compare completion:** explicit visual/history restore, dashboard `_difference` remapping, and one-numeric-column/fewer-than-two-group handling manually verified `PASS`; automated coverage remains deferred.
- 🟡 **Accessibility recolor:** runtime rebuild now updates existing Draco artefacts when colorblind mode changes; ChartPlane bars, lines, histograms, box plots, heatmaps, and dashboard panels use the safe palette. Deferred to the broader UX manual-testing effort.
- 🟡 **Dashboard lifecycle:** `WorldRendererLifecycle` now owns dashboard rebuild/update/disposal and calls `ChartPlane.dispose()` for textures, materials, geometry, and canvas resources. Targeted lifecycle evidence and full teardown validation remain.
- ✅ **Unified system-toggle gate:** Extended `SystemGestureDetector.ts` to strictly track rising edges and prevent re-arming while gestures remain held across boundaries; unified release-to-rearm invariants across hand pinches and controller grips.
- ✅ **Adversarial regression coverage:** Added `tests/adversarial-hardening.test.ts` covering remote authorization / observer message relay blocks, schema/payload sanity and clean disconnection handling, operation transform visual state & base-state history restoration, `ChartPlane` resource and texture disposal, and multi-modal controller/pinch precedence.

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
- 🔲 **Wire `AsymmetricDesktopCompanion` (verified sixth built-but-dead class).** A real
  spectator UI exists (2D overlay: view-follow, bookmark quick-jump, peer-presence metrics,
  comments) but `new AsymmetricDesktopCompanion` has **zero** call sites in `src/` (grep
  2026-08-11) — it is never instantiated, so the desktop-stakeholder path (persona P2) does
  not run. Instantiate in the collaboration path, drive from the live peer/camera state, and
  surface companion comments back into the VR analyst's view non-disruptively. Joins
  `JITGestureHintManager` / `FrustrationResponseManager` / `PeerAvatarManager` /
  `SharedAnnotationManager` / `CollaborativeStateSync` on the built-but-never-wired list.
- 🔲 **Collab moderation + reconnection-state.** The token gate is a shared secret, not strong
  auth (self-documented). No host moderation/kick — once joined, a peer cannot be removed.
  Single-user session persistence exists (`WorldSessionController` — dataset/camera/history/
  settings/tour), but **collab reconnection-state does not**: if a peer disconnects mid-session,
  whether they can rejoin the same analytical state (undo history, bookmarks, shared
  annotations) is unverified/unsupported. Add host kick + a rejoin-state-sync path (separate
  from the local IndexedDB save).
- 🔲 (Future, by design) shared dataset state + synchronized operations — GETTING_STARTED
  notes "Sprint 10B.2"; still not built, recorded as future work, not a regression.

### Sprint 22.6 — Data/Draco correctness + architecture hygiene 🔲 (new)

> Evidence base: a second external review (architecture/research pass) verified against
> code 2026-08-11. **9 of 12 concrete claims confirmed**, 1 false (see "Not a defect"
> note below), 1 partly confirmed, 1 understated. Engineering items recorded here; research
> items in the next section. This sprint is the first Atlas prerequisite slice: identity,
> provenance, dependency direction, mutation semantics, and ownership must be settled before
> introducing DatasetSpace or an analytical Draco API.

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
- 🟡 **`World.ts` → composition root, not nervous system.** Renderer lifecycle and scene teardown
  have been extracted, reducing direct renderer/dashboard ownership. The remaining target is a thin
  composition root over Runtime / Workspace / DataSession / Input / Presentation / Persistence /
  Collaboration; Atlas and logical-session boundaries are not implemented yet.
  Coordinators are extracted already; finish removing direct cross-subsystem state from `World`.
- [x] **Atlas 1 DatasetSpace foundation:** renderer-independent dataset snapshot with stable datum IDs,
  content fingerprinting, numeric normalization metadata, and JSON round-trip; `World` rebuilds the
  space at each dataset boundary. Structure discovery and Atlas guidance remain separate future slices.
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
- ✅ **`src/ai/` deleted in full (2026-08-18 vision-alignment pass).** The directory and its 3
  files (`NeuralConstraintPredictor`, `VoiceCommandListener`, `DracoWorldModel`) are gone; the
  stale `README.md:74` `ai/ # (planned)` sub-claim no longer exists (the README repo-layout entry
  was removed in the same pass). Closes the AI-story inconsistency: the symbolic Draco recommender
  is the defensible story, with no parallel "AI chooses your chart" surface diluting it. If a
  learned layer comes later, evaluate it against Draco per the vision (§15 places neural Draco
  weight prediction out of stable scope).
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

#### Data/Draco correctness (extended — Principal Architect review, verified 2026-08-11)
- 🔲 **`cluster`/`hierarchical`/`dbscan` mutate the input dataset's rows (P0, verified).**
  `DatasetOperations.ts:192-195, 359-362, 429-432` do `rows.map((r,i) => { r._cluster = …; return
  r; })` — a shallow `slice()` plus a write onto the *original* row objects, then wrap them in a
  "new" `Dataset`. The `_originalDataset` baseline is tainted with cluster labels, so
  reset/undo reverts to already-labeled data — silently breaking the immutability/reset contract.
  `anomaly` (`:538`) does it correctly with `({ ...r })`. Fix: spread-copy the row in all three.
  Distinct from the `updateRows` live-stream mutability decision above.
- 🔲 **Operation type drift: TS `'anomaly_iqr'` vs Rust `'anomaly'` (P1, verified).** TS
  `OperationName` (`types.ts:32`) carries `'anomaly_iqr'` while the Rust bridge produces
  `'anomaly'` (`operations_bridge.rs:29`). The TS type actively prevents sending the tag Rust
  expects. Align on one snake_case tag.
- 🔲 **`hasHighVariance` is always-true / `estimatedDensity` dead (P2, verified).** The
  `prefer_column_for_high_variance` soft constraint fires for almost every dataset, diluting
  Draco's discriminating power; `estimatedDensity` is computed but never read. Audit the
  predicate and either gate it honestly or remove the dead fact.

#### Architecture hygiene (extended — Principal Architect review, verified 2026-08-11)
- ✅ **`DracoSolverWorker` deleted 2026-08-18 (this pass).** It was never a real Web Worker
  (`setTimeout(…, 0)` on the main thread, a divergent `ConstraintEngine` singleton) and was
  never instantiated by production code. Weight adjustments route through
  `DracoTopologyNode.adjustWeight` as before. (Was P1, verified.)
- 🟡 **Rust `draco_solve` wired into `DracoTopologyNode` behind an opt-in flag (2026-08-18, this pass).**
  `DracoTopologyNode` takes a 6th constructor arg `useRustSolver` (default `false`). When true,
  `reSolveAndSynthesize` calls `RuntimeBridge.solveDraco(facts)` and builds the `SolverResult` from
  the Rust spec+cost while keeping the authoritative TS `DracoFacts` (the richer shape
  `VRTopologyTranslator` reads). The TS `ConstraintEngine` remains canonical. This is an explicit
  developer switch, **not** a runtime capability-routing branch (CLAUDE.md no-routing rule): if the
  WASM runtime is uninitialised, `solveDraco` returns null and the node **throws** rather than
  silently falling back. `adjustWeight` throws under the Rust path (per-weight tuning isn't exposed
  through the current ABI). **Cutover staged:** flip the default to `true` once the Rust path is
  validated end-to-end against the TS engine on real datasets, then delete the TS `ConstraintEngine`
  solve path. Covered by `tests/draco-topology-node.test.ts` (Rust path exercised via a mocked
  `solveDraco`; TS path unchanged).
- 🔲 **Capability flags duplicated across 4 files with no shared source (P1, verified).** The
  bitfield is re-declared in `wasm/src/lib.rs:293-306`, `World.ts:90`, `FileLoader.ts:18`, and
  `DataOperationController.ts:36` — only a comment keeps them in sync. Introduce a single
  `CapabilityFlag` source (Rust `const` + generated/checked TS mirror) so bit drift is caught.
- 🔲 **`analysisHistory` alias severed on session restore (P1, verified).**
  `WorldSessionController.ts:96` overwrites `World.analysisHistory` with a fresh object, but the
  controller's own `_analysisHistory` still points at the old array → undo/redo is stale after a
  restore. Re-bind the alias or route history access through one owner.
- 🔲 **`Encodings.ts` imports `three` (P1, verified) — the concrete dependency-direction
  violation.** `src/data/Encodings.ts:1-2` is the only `src/data/` file importing three.js; it
  pulls rendering types into the data layer. This is the live instance of the "Dataset must not
  import three.js" rule above. Extract the render-coupled bits (e.g. color → `THREE.Color`)
  into the representation layer.
- 🔲 **`CAP_OPERATIONS_RUST` over-promises (P2, verified).** The flag advertises 8 operations
  but `buildWasmOperationSpec` (`DataOperations.ts:293`) only routes 5 — filter/aggregate/anomaly
  never reach WASM. Align the flag with what is actually routed (honesty, matching #81's spirit).
- 🔲 **Other architecture-hygiene P2s (verified):** dead `WorkspaceManager` (zero callers);
  `registerFactories.ts` side-effect self-call; `layout_force_directed_3d` passes empty edges
  (and the layout exports are not in the JS interface); `UserModeController` emits a non-`WorldTopics`
  bus string; duplicated `EncodingMapping`; duplicated layout dispatch tables; duplicated
  command-buffer ABI constants; `VRTopologyTranslator` static mutable singletons; WASM module URL
  inconsistency (`/wasm/` vs `/wasm/pkg/`); two allocators with LIFO-only bump dealloc; no JSON
  error round-trip across the ABI; `WasmRuntimeBridge` interface is a subset of the real class;
  facade setter clones asymmetrically.

#### Dead-code inventory (extended — Technical-Debt audit, verified 2026-08-11)
> The six built-but-never-instantiated classes are already recorded (22.3 JIT/frustration, 22.5
> avatars/companion/annotations). The audit surfaced *additional* dead production code.

- ✅ **`src/ai/` deleted in full (2026-08-18 vision-alignment pass).** All 3 remaining
  `src/ai/*.ts` files (`NeuralConstraintPredictor`, `VoiceCommandListener`, `DracoWorldModel`)
  were deleted along with `tests/ai-neural-predictor.test.ts`; `tests/candidate-carousel-draco-ga.test.ts`
  and `tests/voice-spatial-engine.test.ts` were split to keep the `RepresentationCarousel` /
  `SpatialAudioNarrator` tests. None of the deleted files was imported anywhere in `src/` outside
  `src/ai/` itself (grep-confirmed zero); only tests referenced them. Closes the P15 duplicate-Draco
  violation (Gate 0).
- 🔲 **`src/data/serializers/` is production-unwired (P1, verified).** The barrel
  (`serializers/index.ts`) has zero production importers; `datasetToArrowIPC`/`arrowIPCToDataset`
  are never called in `src/` outside the directory. `@msgpack/msgpack` and `apache-arrow` are
  exercised only by tests, not the runtime. (`FlatBuffersSerializer` is misleadingly named — a
  hand-rolled row buffer with no FlatBuffers dependency.) Wire the chosen serialization path into
  the dataset/network flow, or delete the unused variants. (Phase 6 records these serializers as
  shipped — that line is stale relative to the runtime.)
- 🔲 **Duplicate `SharedAnnotationManager` with divergent `SpatialAnnotation` interfaces (P1,
  verified).** `src/network/SharedAnnotationManager.ts` (`{ authorPeerId, position, text,
  timestamp }`) and `src/vr/interactions/SharedAnnotationManager.ts` (`{ authorId, authorName,
  colorHex?, … }`) are two classes, same name, same concept, incompatible shapes — both
  built-but-dead. Consolidate into one shared type + one implementation.
- 🔲 **`IceVaultNode` and `GestureConfidenceHUD` are fully dead (P2, verified).** Zero importers
  in `src/` or `tests/` for either (`src/vr/artifacts/IceVaultNode.ts`, `src/vr/ui/GestureConfidenceHUD.ts`).
  Delete.
- 🔲 **`src/vr/scalability/ObjectPool.ts` is now a 1-line re-export shim (P2, verified).** The
  implementation moved to `src/utils/ObjectPool.ts`; the old path is kept only so 4 e2e specs
  still resolve. Update those imports to `utils/ObjectPool.ts` and delete the shim.
- 🔲 **Two legacy `.js` test stubs inflate the skip count (P2, verified).** `tests/file-loader.test.js`
  and `tests/tda-mapper.test.js` are `describe.skip` placeholders whose `.ts` replacements exist
  and run. Delete both.

#### Type-safety, structure & config debt (Technical-Debt audit, verified 2026-08-11)
- 🔲 **`TelemetryCollectorLike` interface gap drives the `as any` telemetry duck-typing (P1,
  verified).** The real `TelemetryCollector` implements `recordPanelAction`/`recordMenuAction`/
  `recordDwell`/`recordGestureConfidence` (`Telemetry.ts:169,177,192,200`) but the
  `TelemetryCollectorLike` interface (`coordinators/types.ts:541-552`) declares none of them, so
  callers duck-type through `as any` (`MovablePanel.ts:164,175,214,247,380`, `HandWheelMenu.ts:341`,
  `SelectionDispatcher.ts:99,113`, `WorldInputCoordinator.ts:104`) — ~13 of the 66 `any` casts
  trace to this single gap. Add the 4 methods (and `uiManager`/`panelManager`/`guidedTour` to
  `EngineLike`) and drop the casts.
- 🔲 **`coordinators/types.ts` is a 1066-line god-file (P1, verified).** ~75 exported interfaces
  spanning every layer (telemetry, panels, dashboard, wheel menu, themes, engine, input, hands,
  pointers, locomotion, network, scalability, live stream, comfort, accessibility) — the 2nd-
  largest `src/` file and a circular-import hub. Split by subdomain (`types/telemetry.ts`,
  `types/ui.ts`, `types/network.ts`, `types/scalability.ts`).
- 🔲 **Inconsistent coordinator lifecycle — 14 of 16 coordinators have no `dispose()` (P1,
  verified).** Only `SceneGraphController` and `WorldSessionController` define `dispose()`;
  `World.dispose()` cleans up coordinators via three ad-hoc conventions. `CollaborationCoordinator`
  registers 5 `addEventListener` handlers with no `removeEventListener`/`dispose` (relies on
  `NetworkManager` GC). Standardize a `dispose()` contract on a `Coordinator` base.
- 🔲 **`VRTopologyTranslator.ts` is 992 lines (P2, verified).** 3rd-largest `src/` file; holds the
  factory registry + per-topology synthesis for all 6 topologies. Split per-topology synthesis
  into `src/draco/layouts/*` siblings.
- 🔲 **`World.ts:498-500` casts the GuidedTour options bag to `as any` (P2, verified).** Slips
  `resolveTarget`/`checkCondition`/`onComplete`/`analystAnchor` past the typed
  `GuidedTourOptions` interface (with an eslint-disable). Extend the options type and drop the cast.
- 🔲 **`VRTopologyTranslator` hardcodes 9 palette hex literals (P2, verified).** `:64,78,234,245,
  394,480,507,618,626` use raw hex instead of `palette.ts`/`WorldTheme` tokens — design-system
  drift. Reference the shared tokens.
- 🔲 **Config/test debt (P2, verified):** `tsconfig` `noUnusedLocals`/`noUnusedParameters: false`
  masks the 186 lint warnings — fix warnings then flip both `true`; coverage thresholds
  (`vitest.config.js`) sit below the measured ~83%/70% baseline (tighten + track); 10 `console.log`
  in production `src/` (`EventBus.ts:106`, `LiveStreamCoordinator.ts:141`, `Engine.ts:394`,
  `Hands.ts:155,169,182,240,426`, `World.ts:722,1559`) — route through `TelemetryCollector`/
  `VRConsole` or gate behind debug; `RuntimeBridge.ts:15` lone `.js` import of a `.ts` module;
  e2e tier1 specs import source via `.js` (35) while tier2-4 use `.ts` (69) — normalize;
  `remote-debug-streamer.test.ts` is near-vacuous (asserts only no-throw, never verifies the
  stubbed `fetch`).
- 🟢 **`CommandApplier` is built-ahead scaffolding, not dead (verified).** It is instantiated
  only in tests and `RuntimeBridge.commandBufferPtr` honestly returns `0` ("dormant"). This is
  intentional per the **B2 command-buffer DEFER** decision above; the `COMMAND_BUFFER requires
  SCENE_RUST` ordering invariant lives as a Rust test. Do not chase — add a production
  integration test once `SCENE_RUST` lands.
- 🟢 **`ArrowBinaryParser` is "fake-Arrow" (known limitation, not a defect).** It parses flat
  `f64` triples, not real Apache Arrow IPC. Recorded as a known simplification; the real Arrow
  path is the unwired `serializers/` module above.

### Sprint 22.7 — Task-first workflow & Draco explainability 🔲 (new)

> Evidence base: a third external review (UX / user-journey pass, 47 sections) verified against
> code 2026-08-11 — **factually accurate, no false headlines** (unlike the architecture pass).
> Its thesis: Nemosyne has "a lot of implementation evidence, but almost no user evidence" and
> has "designed an interaction language before proving that users need to learn that language."
> Organizing frame: **Find → Understand → Prove → Share**. *Find* is strong; *Understand* is
> developing; *Prove* and *Share* are weak. This sprint holds the engineering items that move
> the product from interface-first toward task-first; the evidence/research items go under
> **Planned but not actioned → Research validation**. Atlas alignment: explainability must
> eventually consume a structured `Atlas` guidance object with target, action, rationale, evidence,
> and confidence; the current diagnostic HUD is not that API.

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
  *journey* polish (drop → preview schema → confirm → "Analysing…" → Atlas guidance →
  enter palace) is still a valid onboarding follow-up, but the reviewer over-stated the gap.

### Sprint 22.8 — Security & WASM robustness hardening 🔲 (new)

> Evidence base: a Security & Robustness project review (`.agents/team.json` reviewer persona),
> verified against code 2026-08-11. **No P0 / RCE found.** No glTF/OBJ mesh parser exists in the
> runtime, so there is no unsafe-mesh-parser attack surface. The findings are an impersonation
> vector in the signalling server, a WASM stack-overflow trap, and a dev-tooling break plus
> hardening items. All load-bearing claims independently re-verified (see PR body scorecard).

- ✅ **Signalling `from` spoof → impersonation + connection-disruption DoS (P1, fixed 2026-08-15).**
  `SignallingServerCore.isValidMessage` (`:50-57`) only checks that `from` is a string; it does
  not verify the value equals the authenticated `peerId`. `broadcast`/`sendTo` then use
  the authenticated `peerId` (`:143, :145`), ignoring client-supplied sender identities. Regression
  tests cover spoofed direct and broadcast messages in `tests/network.test.ts`.
- ✅ **WASM `leaves()` unbounded recursion → stack-overflow trap (P1, fixed 2026-08-15).**
  `wasm/src/data/operations.rs` now uses iterative traversal with an explicit stack. A 20,000-level
  merge-history regression test verifies deep chains without recursive stack growth.
- ✅ **CSV prototype-pollution header filtering (fixed in `7649446`).** `parseCSV()` now removes
  `__proto__`, `constructor`, and `prototype` headers while preserving value-column alignment.
- 🔲 **Vite dev/preview signalling is dead for parametrised clients (P2, verified — not a false
  positive).** `vite.config.js:74` does `if (request.url !== '/__signal') return;`, but a peer's
  upgrade URL is `/__signal?room=…&peer=…&token=…`, so the strict `!==` bails *before* the
  `new URL(...).searchParams` parse at `:76-79` ever runs. In dev/preview, multiplayer signalling
  silently never connects. Fix: parse the pathname (`new URL(request.url, …).pathname === '/__signal'`)
  before the query check.
- 🔲 **Other security/robustness P2s (verified):** WebRTC `payload.peerId` is trusted client-side
  with no cross-check against the signalling-authenticated identity; no per-peer rate limiting on
  the signalling server (a flood peer can exhaust the room);
  `wasm` `count * 12` `u32` multiplication can overflow on huge datasets without a checked mul;
  the WASM allocator panics on OOM (acceptable, but the panic should surface as a recoverable
  capability error, not an unrecoverable trap); `readF32`/`readU32` cache a `DataView` that goes
  stale after `memory.grow()` (cross-validated by 3 independent reviewers — Graphics, Security,
  Architect). Fix the DataView to re-derive after grow.
- 🟢 **No glTF/OBJ parser, no unsafe mesh-parser surface (verified).** The only binary parser is
  `ArrowBinaryParser` (flat `f64` triples — the "fake-Arrow" known limitation recorded in 22.6).
  Not a security defect.

### Sprint 22.9 — GPU resource lifecycle & per-frame allocation hygiene 🔲 (new)

> Evidence base: Expert Graphics Engineer project review + the orphaned-renderer finding from the
> Principal Architect review, verified against code 2026-08-11. Theme: **dispose everything you
> create, allocate nothing per frame.** The re-solve leak is the highest-impact item — on a live
  time-series it re-solves roughly every second, leaking materials + textures each time.

- 🔲 **`DracoTopologyNode.reSolveAndSynthesize` GPU leak — materials, textures, instance buffers
  (P1, verified).** On re-solve (`DracoTopologyNode.ts:38-50`), the old artifact group is
  released via `MeshPool.releaseGroup`, but `release`/`releaseGroup`/`clear`
  (`src/utils/ObjectPool.ts:96-110, 113-123, 126-133`) only ever dispose *custom geometry*
  (`mesh.geometry?.dispose?.()`) — they **never** call `material.dispose()` or
  `texture.dispose()`, and `clear()` disposes nothing. `VRTopologyTranslator.synthesizeArtifact`
  builds fresh materials + CanvasTextures (labels) each call. Worst case: live `TIME_SERIES`
  fallback re-solves every ~1 s → materials + label textures + `InstancedMesh` instance-attribute
  buffers leak each tick → VRAM OOM on Quest. (Note: `World.loadDataset` uses the correct
  `disposeObject` path — the leak is specific to the re-solve/re-weight path.) Fix: have
  `releaseGroup` dispose materials + textures (respecting shared-pool geometries), and make
  `clear()` a full teardown.
- 🔲 **Orphaned second `WebGLRenderer` (P0 architecture, verified).** `SceneGraphController.ts:47`
  unconditionally constructs `new THREE.WebGLRenderer({ antialias, alpha })`; `World.ts:206`
  constructs the controller with no `options.container`, so `renderer.domElement` is never
  appended (`:51-53` guard) and the renderer is never `.render()`'ed (Engine owns the real
  renderer at `Engine.ts:100`) nor `.dispose()`'d. This burns a WebGL context at startup — on
  Quest's tight context limit (~8–16) it risks later context-creation failures for nothing. Fix:
  construct the renderer lazily, or inject Engine's renderer; verify whether the controller's
  `scene`/`camera`/`analystAnchor` are actually wired into the render loop before removing.
- 🔲 **Stale `memoryView` after `memory.grow()` (P2, verified ×3 reviewers).**
  `RuntimeBridge` caches a typed-array view over the WASM `Memory`; after `memory.grow()` the
  backing buffer is replaced and the cached view detaches. Re-derive the view on grow. (Found
  independently by the Graphics, Security, and Architect reviewers — high confidence.)
- 🔲 **Per-frame allocations in hot paths (P2, verified).** `LODManager.isInGaze` allocates a
  `Vector3` per call (`:80-84`); `LODManager.isInFrustum` allocates a `Sphere` and holds dead
  `cullPositions`; `SpatialIndex.raycast` allocates inside the inner loop. Hoist to reused
  scratch members. Plus `Engine.dispose` listener cleanup is incomplete and `MeshPool.clear` is
  not a full dispose (see the leak item above).

### Sprint 22.10 — UX Inventory Check & Qualitative-Telemetry Correlation 🔲 (new)

> **Started 2026-08-18 (planning).** Theme: **tie qualitative human experience to telemetry so a
> researcher can cross-reference a diary note to hard data.** The runtime already records a rich
> correlated trace (`UXTraceRecorder` → `logs/ux-trace.jsonl`) and a console stream
> (`RemoteDebugStreamer` → `logs/vr-remote-console.log`), plus `logs/loadtest-results.jsonl`. But
> the three streams are **not joinable by session**, performance + frustration signals **do not
> reach the UX trace**, the hand-tracking cold-start is **only inferable from log spam**, and there
> is **no vocabulary** that maps "I couldn't grab the panel" to the records that prove it.
>
> Evidence base: the 2026-08-18 Meta Quest session (two sessions, 413 s + 202 s) in
> `logs/ux-trace.jsonl` + `logs/vr-remote-console.log`, analysed via
> `scripts/analyze-ux-trace.mjs`. Findings the inventory must reproduce mechanically: 156 s
> hand-tracking cold-start (S1); pointer ray hit nothing on 91–100 % of pinches; 57 % of S2
> pinch starts system-suppressed (both-pinch stealing intent while gazing at panels); 0 named-
> target hits across all 41 selections in S2; 5 + 10 frustration windows; ergonomic score 39/100
> (S1) with 74 % PERIPHERAL reach. Instrumentation inventory audit confirmed the gaps below.

#### UXI-1 — Session manifest & correlation key
- 🔲 **`session-manifest` record.** `UXTraceRecorder` emits one `session-manifest` record at
  start (and re-emits on dataset load) carrying: `sid`, `nemosyneSessionId` (from
  `NemosyneSession.sessionId`), `datasetName`, `datasetFingerprint`, `datasetVersion`,
  `topology`, `buildHash` (from `import.meta.env`/Vite define), `wasmCapabilities` (from
  `wasm.capabilities()`), `ua`, `startedAt`, `sampleHz`. This bridges the current gap where the
  UX trace `sid` and the `NemosyneSession.sessionId` are independent and never cross-referenced.
- 🔲 **`logs/session-manifest.jsonl`.** `vite.config.js` `uxTracePlugin` extracts
  `session-manifest` records and appends them to a dedicated manifest file (same bounded-POST
  path, one JSON line per manifest) so a session list is readable without scanning the full
  trace. Every existing record already carries `sid`, so all three log files become joinable by
  `sid` once the manifest exists.
- 🔲 **Manifest in the offline analyzer.** `scripts/analyze-ux-trace.mjs` reads the manifest
  first and prints a session header (dataset, topology, build, capability flags) per `sid`.

#### UXI-2 — Perf & friction folded into the trace
- 🔲 **`perf` trace records.** `Engine.ts` currently routes `PerformanceBudget` violations only
  to `console.warn` → remote logs. Add `recorder.recordPerf(violation)` so each violation
  becomes a `perf` record `{ type:'perf', id, severity, value, budget, frameMs }` correlated by
  `t` with the 5 Hz context stream. Also emit a periodic `perf` sample (1 Hz) carrying
  `AdaptiveFrameGovernor.lodScaleFactor` + `throttleCount` + `frameMs` (currently event-bus +
  in-VR panel only) so jank is visible in the trace, not just the console.
- 🔲 **`friction` trace records.** Consolidate the two `UXFrustrationAnalyzer` instances (one
  in `TelemetryCollector`, one wired via `AdaptiveAssistController`) to a single source and emit
  a `friction` record `{ type:'friction', pattern, severity, score, compactTrail }` whenever the
  analyzer raises a pattern. The trace then carries the on-device frustration verdict alongside
  the raw pinches it was derived from, so the offline analyzer doesn't re-derive it.
- 🔲 **Dead-flag cleanup.** `RAPID_SWIPE_VELOCITY`, `OCCLUSION_BY_PANEL` (in
  `WorldSpatialContext`), and `REPEATED_RESET` (in `UXFrustrationAnalyzer`) are declared in
  their type unions but never assigned. Either wire a detection for each or delete the enum
  members — do not leave dead vocabulary in the inventory.

#### UXI-3 — Explicit hand-tracking lifecycle + cold-start event
- 🔲 **`hands` lifecycle records.** `Hands.ts` currently surfaces cold-start only via
  `[HandPointer N] waiting for joints` log spam every 300 frames. Add
  `recorder.recordHands({ phase: 'connected'|'joints-valid'|'fallback'|'lost', hand, source,
  jointCount, ttfrMs })` so the trace carries a structured hand-availability timeline. Emit
  `hands.joints-valid` with `ttfrMs` = time from `session-manifest.start` to first
  `jointsValid && pose` for that hand — this is the mechanical signal for UX-001.
- 🔲 **Time-to-first-pinch metric.** Record `tFirstPinch` per session in the manifest; the
  analyzer reports `tFirstPinch − start` and flags > 10 s (the 2026-08-18 S1 value was 165 s).

#### UXI-4 — UX phenomenon inventory (the vocabulary)
> The canonical enumerated list a researcher correlates against. Each phenomenon has a stable ID,
> a human-readable description of the qualitative experience, the telemetry signals that evidence
> it, and a derivation rule the analyzer implements. The IDs are stable across versions — fields
> may grow but IDs do not renumber.

| ID | Phenomenon | Qualitative experience | Telemetry signals | Derivation (per session) |
|----|------------|------------------------|-------------------|--------------------------|
| UX-001 | Hand-tracking cold-start | "My hands didn't appear for ages at the start" | `hands` lifecycle records; first `pinch.t`; `[HandPointer] waiting for joints` log lines | `tFirstJointsValid − session.start`; flag if > 10 s; severity by duration |
| UX-002 | Pointer-ray aim drift | "I was looking at the panel but my pinch hit nothing" | `context.ctx.ptr.driftDeg`; `pinch.ctx.ptr.target=null` | share of context samples with `driftDeg > 28` (matches `AIM_DRIFT_EXCESSIVE`); pinches with `ptr.target=null` |
| UX-003 | Both-pinch intent stolen | "I tried to select with both hands and the menu kept opening" | `pinch.gating=system-suppressed` with `ctx.gaze.kind∈{panel,hud}`; `system.kind=both-pinch` | count of suppressed-while-gazing-panel; ratio `system-suppressed / select` pinch starts |
| UX-004 | Target acquisition failure | "I couldn't hit the button/panel I wanted" | `selection.hit=callback-only` with `ctx.gaze.target` set; absence of `hit∈{scene,hud}` | session-level scene/hud hit count; per-window `≥3 callback-only while gazing at panel` |
| UX-005 | Peripheral reach / camera blindspot | "Hands lost tracking when I reached out to the side" | `context.ctx.world.ergonomics[].reachZone=PERIPHERAL`; `PERIPHERAL_CAMERA_BLINDSPOT` flag | share of context samples PERIPHERAL; flag counts |
| UX-006 | Sustained frustration burst | "I kept trying and nothing worked" | `friction` records; frustration windows (≥2 ineffective inputs in 3 s) | window count + longest window length + peak `friction.score` |
| UX-007 | Frame-budget breach / jank | "It stuttered or felt janky" | `perf` records; `[PerformanceBudget] critical/warning` log lines | critical/warning counts; max `frameMs`; `lodScaleFactor` trajectory |
| UX-008 | Dataset load crash | "It crashed when I loaded/switched data" | `[World] loading dataset` followed within 2 s by `[ERROR]` or `[Nemosyne] startup error` | error within 2 s of a load event, joined by `sid+t` to the trace |
| UX-009 | Live-stream reconnect flapping | "The live feed kept dropping" | `[LiveStreamCoordinator] live stream error` → `connected` cycles | error→connected cycle count; max gap |
| UX-010 | Tour drop-off | "I didn't finish the tour" | `tour` records: last `step < total` and `active` flips false early | final `step/total < 1` and last active step < total−1 |
| UX-011 | Wheel-menu stuck open | "The menu wouldn't close" | `wheel` open/close records | `opens ≠ closes` and session ends in `open` |
| UX-012 | Gesture misfire | "It fired the wrong gesture / misfired" | `gesture.isMisfire=true`; `gesture.confidence < 0.6` | misfire count + per-gesture-name breakdown |

- 🔲 **`docs/UX_INVENTORY.md`** — checked-in canonical version of the table above, with one
  paragraph per phenomenon defining the derivation precisely (thresholds, window sizes, severity
  bands). The analyzer loads from this spec so the docs and the code cannot drift.

#### UXI-5 — Qualitative annotation channel
- 🔲 **`annotation` trace records.** A dev-only in-VR "mark moment" affordance (grip + trigger
  hold, surfaced in `HandWheelMenu` as "Mark UX moment") emits
  `recorder.recordAnnotation({ note, phenomenonId?, severity? })`. If the on-device keyboard is
  unavailable, the record stores an auto-generated timestamped placeholder and the researcher
  fills the note offline against `sid + t`.
- 🔲 **Offline session diary.** `scripts/ux-inventory-report.mjs` accepts an optional
  `--diary sessions/<sid>.md` (free-form markdown with `@t <seconds> <phenomenon-id> <note>`
  lines) and joins each note to the trace window ±2 s, emitting the note inline beside the
  matching telemetry in the report. This is the qualitative→quantitative bridge: a human writes
  "at 165 s my hands finally appeared" and the report shows the `hands.joints-valid` record at
  t=165.2 s alongside it.
- 🔲 **No PII.** Annotations are local/dev-only (same self-disable-on-404 path as the rest of
  the trace); the diary file is gitignored. Record only the note text the researcher types —
  never auto-capture speech or identifiable content (matches the existing `UXTraceRecorder`
  privacy stance).

#### UXI-6 — Correlated offline analyzer
- 🔲 **`scripts/ux-inventory-report.mjs`.** Reads `logs/session-manifest.jsonl`,
  `logs/ux-trace.jsonl`, `logs/vr-remote-console.log`, `logs/loadtest-results.jsonl`, and the
  optional diary. Produces, per `sid`: (a) the manifest header; (b) the **inventory checklist** —
  every UX-00x phenomenon → `occurred: yes/no`, evidence counts, time windows, severity; (c)
  cross-log correlations (e.g. UX-008 joining a `[World] loading dataset` console line to the
  trace `t` and the resulting `[ERROR]`); (d) inline diary annotations. Output is markdown +
  a machine-readable `logs/ux-inventory-<sid>.json`.
- 🔲 **`scripts/analyze-ux-trace.mjs` delegation.** The existing analyzer keeps its
  pinch/selection/drift/frustration-window tables; the new report builds on top of it (imports
  the derivation helpers) rather than duplicating them. One command, one source of truth for
  each derivation rule.

#### UXI-7 — Tests & validation against the recorded session
- 🔲 **Derivation unit tests.** `tests/ux-inventory.test.ts` — synthetic traces exercising each
  phenomenon's derivation rule (cold-start duration, suppression-while-gazing ratio, target-
  acquisition failure, etc.).
- 🔲 **Replay fixture from 2026-08-18.** Check in a redacted slice of the real session
  (`tests/fixtures/ux-trace-2026-08-18.jsonl`, the two `sid`s) and assert the analyzer reproduces
  the findings above: UX-001 occurred (156 s), UX-003 occurred (57 % suppressed in S2), UX-004
  occurred (0 scene/hud hits in S2), UX-005 occurred (74 % PERIPHERAL in S1), UX-006 occurred
  (5 + 10 windows). This is the acceptance gate — the inventory must mechanically reproduce what
  the manual analysis found.
- 🔲 **Privacy redaction helper.** `scripts/redact-ux-trace.mjs` strips any `annotation.note`
  and hashes `ua` before a fixture is checked in, so real-session fixtures can be committed
  without leaking researcher notes or device fingerprints.

#### Sequencing
```
UXI-1 (manifest)  →  UXI-6 (analyzer needs the manifest to join logs)
UXI-2 (perf/friction into trace)  →  UXI-6 (analyzer derives UX-006/UX-007 from these)
UXI-3 (hands lifecycle)  →  UXI-4 UX-001 derivation  →  UXI-7 replay assertion
UXI-4 (vocabulary)  ←  UXI-5 (annotation phenomenonId references the vocabulary IDs)
UXI-5 (annotation)  →  UXI-6 (diary join)
UXI-7 is the gate: the 2026-08-18 replay must reproduce the manual findings.
```

> **Non-goal:** automated UX verdicts. Consistent with the existing caveat (§Planned but not
> actioned → "UX frustration analyzer as signal, not conclusion"), the inventory is **triage for
> studies, never a verdict**. It surfaces evidence for a human researcher; it does not score UX
> quality. The `friction` records and phenomenon occurrences are hypotheses to validate, not
> conclusions.

---

## Phase 23 — Gesture Intelligence: Host Integration & Global Model Improvement 🔲 (new)

> Source: the out-of-roadmap sprint that shipped `modules/gesture-intelligence/` on
> 2026-08-18. That module is **architecturally separate** (never imported by `src/`,
> never run through the root test suite) and is **complete and green**: frozen 56-dim
> feature vector, heuristic + ONNX classifier with honest provenance, biomechanical
> calibration, on-device personalization (threshold coord-search over replayed F1),
> and a capture→train→deploy pipeline. Trained on **synthetic** data only: held-out
> accuracy 0.9111, macro-F1 0.9087, 24 KB ONNX, all 6 classes predicted. **Not yet
> wired into the host.** This phase wires it in and builds the global learning loop.
> See `modules/gesture-intelligence/SPRINT.md` + `README.md` for the frozen contract.
>
> **Legacy `src/ai/Gesture*` retired 2026-08-18 (this pass).** The three pre-existing
> gesture prototypes — `src/ai/GestureClassifierModel.ts`, `GestureTrainingWorker.ts`,
> `GestureModelStore.ts` — plus their tests were **deleted** before Phase 23 wiring begins.
> They were never imported by production `src/` (grep-confirmed zero), overlapped the
> new module's contract (ONNX bridge + IndexedDB persistence + personalization), and
> leaving both in place would have produced two parallel ONNX-gesture systems at
> integration time. The frozen contract in `modules/gesture-intelligence/` is now the
> **sole** gesture-intelligence surface; Sprint 23.1 wires the host to that module,
> not to anything in `src/ai/`. **The entire `src/ai/` directory was deleted in the
> 2026-08-18 vision-alignment pass** (`NeuralConstraintPredictor`, `VoiceCommandListener`,
> `DracoWorldModel` + their tests) — closing the P15 duplicate-Draco violation (Gate 0).

### Architectural direction

```text
Host hand input (Controllers/Hands)
        │  (adapter lives in src/; module stays host-agnostic)
        ▼
GestureEngine (modules/gesture-intelligence)
   ├─ heuristic classify (sync, every frame)
   ├─ neural classify (ONNX, debounced; honest source: onnx|heuristic)
   ├─ personalizer (on-device threshold tuning, adopt only on F1 gain)
   └─ persistence (StoredProfile in IndexedDB)
        │
        ▼
InputRouter gesture dispatch → MetaphorActions / DataOperations
        │
        ▼ (opt-in, consent-gated)
Tier A feature corpus  ──▶  global ingest  ──▶  central retrain (CI)
(56-dim features only;       (pseudonymous,      user-disjoint eval,
 raw positions stay on        rate-capped,        staged deploy via
 device)                      quota, erasure)     asset replacement +
                                                  sha256/version verify
```

The frozen feature spec (`FEATURE_DIM=56`, `GESTURE_CLASSES` order, ONNX
`[1,56]→[1,6]`) is **not** edited by any sprint below; global retraining changes
weights only. Gesture recognition is an input/interaction layer — it is **never**
routed through the Rust analytical kernel's provenance envelope.

### Sprint 23.1 — Host integration & gesture dispatch 🔲

- **Wire host hand input → engine.** `InputRouter.ts` / `Controllers.ts` /
  `Hands.ts` call `GestureEngine.recordSample` per frame with a `HandSample`
  (`{hand, position: Vec3, pinched, timestamp}`). The three.js-space → engine-`Vec3`
  adapter lives in `src/` (the module never imports `src/`).
- **Inject the ONNX bridge.** `createNeuralClassifier({ modelUrl, modelCard,
  ortFactory: createOrtFactory(ort) })` using the shipped
  `modules/gesture-intelligence/assets/*`; bundle via Vite (copy into
  `src/assets/gesture/` or import from the module). `ort.env.wasm.wasmPaths`
  points at a bundled, **no-CDN** wasm path (avoids CORP/COEP; matches the demo).
- **Gesture dispatch.** Map `ClassificationResult.gesture` → `MetaphorActions` /
  `DataOperations` triggers (e.g. `pinchTogether`→aggregate, `scoopUp`→rising
  filter, `pushForward`→push/inspect, `bothPinched`→commit). Reuse the existing
  `InputRouter` precedence model — never bypass it.
- **Honest provenance surfacing.** Pipe `result.provenance.{source, modelVersion,
  latencyMs, degradedReason}` into `Telemetry` + an in-VR HUD toggle (reuse
  `VRConsole`/`DashboardManager`). No silent fallback: a degraded neural path
  must be visible.
- **Calibration seeding.** Load `StoredProfile` from `SessionStore`/IndexedDB on
  `Engine.init`; persist on personalization adoption.
- **Gates.** New `tests/gesture-integration.test.ts` (InputRouter→engine→dispatch
  end-to-end with stub controllers); root + module gates green; no `src/`
  analytical routing.
- **Exit.** 6 gestures dispatched in-VR with honest provenance; heuristic-only
  path works when ONNX is unavailable.

### Sprint 23.2 — In-experience capture & per-user personalization loop 🔲

- **Capture UI.** In `HandWheelMenu` / `SettingsPanel`: arm a label, perform the
  gesture, stop → `CaptureRecorder`. Store raw JSONL to `SessionStore` keyed by
  `profileId/gesture/captured_<ts>`.
- **Feedback buttons.** Confirm ✓ / correct ✗ per detected gesture →
  `engine.reportFeedback`. Every 8 confirms → `personalizer.optimize()` →
  adopt **only if** `replayF1After > replayF1Before` → persist `StoredProfile`.
  Show the threshold change to the user (signal, not silent verdict — matches
  the §Planned-but-not-actioned UX-frustration caveat).
- **Personalization provenance.** Stamp `replayF1Before/After` + the threshold
  delta into `Telemetry` so a human can audit which threshold changed and why.
- **Local retrain stub.** A "Retrain on my captures" button (dev/power-user only)
  exports the local IndexedDB corpus to `training/_output/captured/<profileId>/`
  and triggers `retrain.ts` in dev. Production users cannot run python — this is
  a researcher path, not a release commitment.
- **Gates.** `tests/gesture-personalization.test.ts` (capture round-trip,
  feedback→adopt→persist, no-improvement→no-adopt).
- **Exit.** A user can capture, correct, and have their own thresholds retune
  within a session, persisted across sessions.

### Sprint 23.3 — Global capture pipeline (opt-in, privacy-preserving upload) 🔲

> Goal: crowd-source labeled captures from all consenting users into a central
> corpus at global scale **without shipping raw biometric data unredacted**.

- **Consent gate.** Capture upload is **OFF by default**; an explicit toggle in
  `SettingsPanel` writes `gestureCaptureConsent` to `SessionStore`. No capture
  leaves the device without it. The consent UI states exactly what is uploaded.
- **Tier A — feature-only corpus (default for opt-in).** Upload
  `{features: number[56], label, confirmed, modelVersion, profileHash}` rows.
  `extract_features.ts` runs **on-device**, so raw hand positions never leave the
  headset. This is the retraining substrate the MLP already consumes via
  `exportCorpus()`.
- **Tier B — raw trajectory corpus (research mode, second explicit consent).**
  For richer future models (CNN/LSTM needing the raw window). Gated, capped,
  signed, time-boxed. Default OFF.
- **Pseudonymous identity.** `profileHash = sha256(consentToken + deviceSalt)` —
  rotatable, never the raw Quest device ID. Per-profile quota so one user cannot
  dominate the corpus. Right-to-erasure via a `deleteMyCaptures(profileHash)`
  endpoint.
- **Upload transport.** Batched, retry-with-backoff POST to a production ingest
  service (Netlify function or separate worker — **not** the Vite dev plugin).
  Dedup by `(profileHash, featuresHash, modelVersion)`; server-side rate limit +
  size cap, reusing Wave 0 bounding rules.
- **Provenance per row.** `modelVersion` that produced the gesture + `confirmed`
  flag, so retraining distinguishes user-endorsed labels from detector outputs.
- **Gates.** `tests/gesture-upload.test.ts` (consent gating, redaction, dedup,
  quota); security review (new attack surface → auth, rate limit, payload cap,
  no PII).
- **Exit.** Opt-in users contribute feature-level labeled rows to a central
  corpus; raw positions never leave the device under Tier A.

### Sprint 23.4 — Central retraining service & staged model deployment 🔲

- **Central training job (CI/CD, not on headsets).** Scheduled + on-trigger:
  pull the merged corpus → `merge_corpus.ts` → `train.py` → `export_onnx.py` →
  enforce the bar (acc ≥ 0.90, macro-F1 ≥ 0.85, all 6 classes) → candidate
  `gesture_classifier.onnx` + `model_card.json` with bumped `version` + sha256.
- **User-disjoint evaluation.** Hold-out split by `profileHash`, never by row,
  so the test set is user-disjoint. A candidate must beat the incumbent on the
  held-out user-disjoint set (not just the global held-out) — prevents overfitting
  to high-volume users. Report per-class F1 + confusion + regression vs incumbent.
- **Staged deployment.** Candidate → **shadow** (serve both, log disagreements,
  no dispatch change) → **canary** (small % of users) → **full rollout**. Deploy =
  replacing the two asset files + bumping `model_card.json.version`; the bridge
  verifies sha256 + version on next init.
- **Model-card transparency.** Every shipped card carries `metrics` + `samples`
  + `confusion`; users can inspect which model version recognizes their gestures
  and its measured accuracy. Optional: sign `sha256` with an org key so a swapped
  JSON cannot authorize a tampered model.
- **Rollback.** Revert to the previous asset pair (kept in `assets/archive/`).
- **Gates.** Training reproducibility (same corpus + seed → same weights);
  user-disjoint eval gate; staged-rollout telemetry; rollback drill.
- **Exit.** Improved models ship to all users via asset replacement, with
  user-disjoint evaluation and staged rollout — no code changes.

### Sprint 23.5 — Federated learning & drift monitoring 🔲 (research; longer-term)

- **Federated threshold tuning (cheap, privacy-friendly, in scope).** The
  personalizer already runs on-device; aggregate **anonymous threshold-improvement
  deltas** across users (not raw data) to set a better global default calibration.
- **Federated weight updates (research only, not a commitment).** On-device
  fine-tuning of the MLP is out of scope for the frozen contract; a future spec
  would re-open the ONNX to accept per-user LoRA-style adapters — requires
  orchestrator sign-off on the contract. Proposed, not committed.
- **Drift monitoring.** Track per-user `confirm`/`correct` ratio and
  `replayF1After` over time; a falling ratio signals the shipped model is drifting
  from real-world gestures and triggers retrain. Aggregate anonymous drift
  telemetry to prioritize corpus collection for under-performing classes (the
  known first target: synthetic idle↔pushForward confusion, driven by retracting
  pushForward trajectories with near-zero net displacement).
- **Heuristic vs. neural A/B.** The engine already reports `source`; compare
  correction rates between `source:'onnx'` and `source:'heuristic'` sessions to
  decide where the neural path is worth its latency.
- **Gates.** Drift dashboard (offline analyzer over the corpus); a
  federated-threshold aggregation job; ethics review (global model from
  user-derived biometric features → consent, erasure, opt-out, transparency).
- **Exit.** The global model improves from real-world usage without centralizing
  raw data; drift is monitored; the loop is auditable end-to-end.

### Cross-cutting invariants (all 23.x sprints)

- The frozen feature spec is not edited without orchestrator sign-off; global
  retraining changes **weights only**, never the contract.
- Honest provenance end-to-end: `source` = the path that produced the numbers;
  `degradedReason` explicit; `modelVersion` surfaced to users; no fabricated
  confidence.
- No `src/` production code chooses between analytical paths — gesture recognition
  is input/interaction, never routed through the Rust analytical kernel's
  provenance envelope.
- The module stays architecturally separate: host wiring imports from the
  module; the module never imports `src/`. Root `vitest.config.js` `exclude`
  keeps the module out of the host test suite; module gates run independently.
- Consent is the foundation of the global loop: capture upload OFF by default;
  raw positions never leave the device under Tier A; right-to-erasure is a hard
  requirement, not a stretch goal.
- The shipped model is trained on **synthetic** data; real-world accuracy will be
  worse until real captures flow through 23.3→23.4. Do not claim production-grade
  accuracy until the user-disjoint eval gate (23.4) passes on real captures.

### Sequencing

```text
23.1 (host wiring)  →  23.2 (capture + personalization)  →  23.3 (global upload)
                                                                │
                                                                ▼
                                       23.5 (federated/drift) ← 23.4 (central retrain + staged deploy)
```

23.1 and 23.2 are independently shippable user-facing wins (gestures work in-VR;
per-user tuning). 23.3 is the privacy prerequisite for any global model. 23.4
makes the global loop real. 23.5 is research-grade and must not block 23.1–23.4.

---

## Phase 24 — UX Architecture: Analyst Cockpit & Interaction Hierarchy 🔲 (new)

> Source: the 2026-08-18 UX architecture review (20-point proposal), cross-verified against
> the codebase (`WorldUIManager`, `PanelManager`, `MovablePanel`, `HandWheelMenu`, `VRMenu`,
> `DashboardManager`, `SettingsPanel`, `VRConsole`, `InputRouter`, `SystemGestureDetector`) and
> the 2026-08-18 Meta Quest session telemetry (`logs/ux-trace.jsonl`, `logs/vr-remote-console.log`).
> Theme: **stop adding panels; establish one interaction hierarchy so the existing UI primitives
> become an analyst cockpit.** The thesis is that almost every primitive needed already exists —
> HandWheel, PanelManager, DashboardManager, MovablePanel, narrative state, UX telemetry — what's
> missing is a stricter interaction hierarchy. The best UX refactor may delete panels rather than
> add them.

> Relationship to existing phases: this phase **absorbs and reframes** incremental Phase 22 items
> (22.3 input-correctness, 22.4 zonation, 22.7 task-first, 22.10 inventory) into an architectural
> frame; it does not duplicate them. It is coupled to **Phase 23** gesture intelligence: 24.7
> (both-pinch ownership) and 23.1 (host wiring) share the `InputRouter` gesture dispatch surface.
> It is grounded in the **Concept Paper** principles: semantic honesty (P6), human agency &
> reversibility (P8), research observability by design (P9), 2D as a legitimate partner (P7),
> stable means testable not proven (P12). Framing: these fixes are **study-harness validity work**
> for the flagship 2D-vs-VR `Find the Fraud` comparison (Concept Paper Risk 4: study contamination),
> not feature work — the uncontrolled interaction model is a confound that must be removed before
> the comparison is fair.

### Architectural direction

```text
                    NEMOSYNE UX
                        │
          ┌─────────────┼─────────────┐
          │             │             │
       NAVIGATE       WORK          OBSERVE
       HandWheel    Dashboard       World
          │             │             │
      ┌───┼───┐      ┌───┼───┐       │
    Data View Study  Task Context  Evidence
                    Panels Cards   Layer
                       │
                 Contextual Actions

Interaction State Machine (one authoritative mode at a time)
   NAVIGATE | INTERACT | TRANSFORM | OBSERVE   (visible to the user)
        │
   ├── gaze
   ├── pointer
   ├── pinch
   ├── grab
   └── keyboard/controller
```

Three navigation verbs: **Navigate → Wheel, Work → Panel, Observe → World, Recall → Workspace.**
The launcher ring becomes a secondary "open tools" affordance, not a competing navigation tree.
The dashboard becomes a workspace, not a menu. Panels become task surfaces, not navigation surfaces.

### Sprint 24.1 — Interaction state machine & focus vocabulary 🔲 (foundation; blocks 24.2–24.7)

> The missing abstraction. Every interactive surface should share one interaction vocabulary
> and one authoritative mode. Today `InputRouter` uses ad hoc hover/focus logic and many
> components implement their own local interaction behaviour. This is the structural fix that
> makes every other sprint cheaper.

- **Interaction-mode FSM.** Introduce an explicit `InteractionMode = NAVIGATE | INTERACT | TRANSFORM | OBSERVE` state machine in `InputRouter` (or a new `InteractionModeController`). One mode active at a time; the current mode is **visible** to the user (compact status strip or HUD chip). Mode transitions are explicit and reversible (Concept Paper P8). This is the UX analogue of the paper's authority-separation principle (Risk 2): no competing sources of interaction truth.
- **Focus state abstraction.** A shared `FocusState = idle | focused | hovered | armed | confirmed | disabled | busy` vocabulary every interactive surface reports. Today many components implement their own local interaction behaviour — replace with one shared contract so wheel, panels, and world objects share the same semantics.
- **Both-pinch mode awareness (hook).** `SystemGestureDetector.bothPinched` must not silently suppress (current 57% S2 suppression). The mode FSM owns both-pinch semantics: in `NAVIGATE` it could mean world-transform; in `INTERACT` it means commit; the user sees a mode chip, not a silent swallow. Full redesign in 24.7; this sprint adds the mode-aware hook.
- **Absorbs 22.3 input-correctness bugs.** The double-toggle/double-fire (`Hands.ts:285` + `InputRouter.ts:329-335`), the `HandGestureRecognizer` dominant-hand index bug, the hand-grab/both-pinch locomotion conflict, and `scoopDown`'s dead-end else branch are all symptoms of no shared interaction grammar. The FSM + focus vocabulary fixes the class of bug, not each instance.
- **Gates.** `tests/interaction-mode.test.ts` (mode transitions, reversibility, no silent suppression); the FSM is telemetry-instrumented (mode transitions emit trace records for the UXI-7 replay fixture).
- **Exit.** One authoritative interaction mode at a time, visible to the user; every interactive surface shares one focus vocabulary; the 22.3 input-correctness class is resolved structurally.

### Sprint 24.2 — HandWheel as primary navigation: three-level categorization & forgiving confirm 🔲

- **Three-level wheel.** Re-categorize the wheel around analyst intent: top-level categories `ANALYSE | VIEW | DATA | STUDY | COLLABORATE | SYSTEM`; selecting a category reveals its contextual actions. Panels become task surfaces, not navigation surfaces. The launcher ring becomes a secondary "open tools" affordance, not another competing navigation tree.
- **Forgiving confirm.** Replace the ray-intersection-fires-action model with `REST → CATEGORY FOCUS → ACTION CONFIRM`. A hovered action shows stronger scale, larger hit target, directional highlight, label expansion, optional 100–150 ms dwell highlight; selection requires an **explicit pinch/trigger**. The menu never punishes an accidental ray intersection. (Note: the 2026-08-18 review's "fires immediately on hit" claim was verified **misleading** — `HandWheelMenu` already requires pinch; the real issue is discoverability + the 91–100% pointer miss rate, not accidental fire. This sprint makes the wheel forgiving against the observed pointer-acquisition failure.)
- **Gaze + confirm.** The telemetry says the pointer ray misses 91–100% of the time in S1. Add a `gaze target + hand intent` path: look at `Analyse` → it enlarges → pinch anywhere / thumbstick confirm. Precision should increase confidence, not determine success. This is net-new input redundancy (Concept Paper P8 agency), not a regression to fix.
- **Absorbs 22.1 wheel hover/click work + 22.3 dominant-hand binding.** The 22.1 hover/click ray-mismatch fix stays; this sprint adds the three-level re-categorization and the confirm-state machine on top.
- **Gates.** `tests/handwheel-confirm.test.ts` (REST→FOCUS→CONFIRM, no action on ray-only intersection, gaze+confirm path); on-device validation that the wheel is usable under the observed pointer-miss conditions.
- **Exit.** The wheel is the one primary navigation surface; it works under pointer failure via gaze+confirm; no accidental fires.

### Sprint 24.3 — VRMenu decomposition into task-oriented contextual surfaces 🔲

> The clearest concrete UX smell: a 0.95m × 1.45m panel with 29 buttons mixing analytical
> operations, portal toggle, live connection controls, sources, and datasets. A desktop
> command palette pasted into a spatial environment.

- **Decompose by intent, not by feature.** Replace the single VRMenu with task-oriented contextual surfaces: `Data` (load/switch/live-source/connect), `Analyse` (filter/compare/cluster/anomalies/aggregate/time-slice), `View` (topology/layout/lens/reset), `Study` (start/pause/mark/record/export), `Portals`. Critically: **do not show all of these at once.** The current dataset's topology determines which actions are available (e.g. `GRAPH` → find communities/detect anomalies/compare groups; `TIME_SERIES` → different actions). This is semantic relevance, not feature completeness.
- **Retire VRMenu-as-primary.** VRMenu becomes one of several contextual task surfaces (or is deleted) once the wheel (24.2) + context cards (24.5) cover its capabilities. The launcher ring already opens panels individually; the wall-of-buttons is no longer the navigation tree.
- **Absorbs 22.7 task-first onboarding.** The 6 analysis templates (`AnalysisTemplates.ts`) become the front door: "What are you trying to understand?" → template selects dataset + representation + interaction vocabulary + tour + theme. A guided "Find the Fraud" investigation (5 interactions) replaces the 19-stop tour as the onboarding path — a 19-stop tour is itself a diagnostic that the interaction model is too dense.
- **Gates.** `tests/vrmenu-decomposition.test.ts` (each intent surface exposes only dataset-relevant actions; no capability is lost vs the 29-button wall); on-device validation that the contextual menus feel relevant, not sparse.
- **Exit.** No 0.95m × 1.45m command wall; analyst thinks "investigate this dataset" not "access the sixth button in the stack."

### Sprint 24.4 — Panel roles taxonomy + diagnostic mode separation 🔲

- **Panel roles.** Introduce `type PanelRole = 'workspace' | 'task' | 'context' | 'diagnostic' | 'transient' | 'system'`. `PanelManager` enforces UX rules per role: e.g. at most two `task` panels open simultaneously; `diagnostic` panels hidden outside developer mode; `transient` cards auto-dismiss. Mapping: Dataset inspector → task, Recommendation → task, Settings → system, Narrative strip → context, MiniOverview → context, Console → diagnostic, Performance → diagnostic, Network → diagnostic, Dashboard → workspace, Interaction Coach → transient.
- **Diagnostic UI mode separation.** `RESEARCH MODE` (diagnostic panels disabled), `ANALYST MODE` (diagnostic panels hidden by default), `DEVELOPER MODE` (diagnostic panels available). Today `WorldUIManager` makes VRConsole/Performance/Network/LoadTest first-class residents — appropriate for development, not for research participants. The VRConsole especially should not compete with the visualization. (Note: no developer mode exists today — `userMode` has novice/intermediate/expert only; this sprint adds the mode separation that 24.6 builds on.)
- **Replace scrollbars with paging.** The 2D-scrollbar-on-3D-surface is the wrong metaphor. For dense analytical content use `PAGE 1/4 [prev][next]` (spatial stability), or swipe/thumbstick-scroll/grab-and-drag. `MovablePanel`'s custom scrollbar is clever but desktop DNA in VR.
- **Absorbs 22.4 spatial zonation + 22.6 panel declutter.** The three-tier zonation (Central Focus / Peripheral / Wrist HUD) maps onto panel roles (task/context/diagnostic). The "hide all panels / focus mode" affordance (22.6) is the `workspace` role's minimize-all.
- **Gates.** `tests/panel-roles.test.ts` (role enforcement, max-two-task rule, diagnostic hidden in research mode); on-device validation that the clutter is genuinely reduced.
- **Exit.** Panels have explicit roles; the manager enforces layout rules; diagnostic UI disappears from the analyst's normal world.

### Sprint 24.5 — Dashboard-as-workspace + transient context cards 🔲

- **Dashboard = workspace, not menu.** `DashboardManager`'s semicircular workspace becomes the persistent workspace: narrative strip (top), evidence/recommendation (sides), main view (center), mini-map/dataset (lower). Contains only things relevant to the current session. The wheel opens tools; the dashboard is where the analyst works.
- **Transient context cards.** A new ephemeral surface for meaningful moments: dataset loaded → card `[SALES_Q4 · 18,420 rows · GRAPH] [Inspect][Analyse][Save]`; recommendation available → card `[Atlas found a high-confidence community] [View][Explain][Ignore]`. Auto-dismiss. Dramatically reduces the need for permanent panels.
- **Absorbs 22.5 dashboard lifecycle + 22.7 precision/detail transition.** The dashboard lifecycle disposal (22.5) and the spatial→inspect→expand→2D-detail-card path (22.7) are the workspace's content + handoff; context cards are the transient layer above.
- **Gates.** `tests/context-cards.test.ts` (card lifecycle, auto-dismiss, action dispatch); on-device validation that cards reduce permanent-panel count.
- **Exit.** The dashboard is a coherent workspace; transient cards replace several permanent panels.

### Sprint 24.6 — Progressive disclosure as architecture (novice/analyst/researcher/developer) 🔲

> The `userMode = novice` setting is an excellent foothold. This sprint turns it from a cosmetic
> role-based UI into genuine progressive disclosure as architecture.

- **Four real UI profiles.** Novice (Load/Explore/Analyse/Explain/Undo/Help), Analyst (analysis operators/views/history/evidence/study tools), Researcher (provenance/experiment controls/observation/annotation/counterbalancing/telemetry/export), Developer (performance/console/network/load-test/WASM). Each profile gates which panels, wheel categories, and actions are visible — not cosmetic, structural. The system-toggle and diagnostic panels (24.4) follow the profile.
- **Replace "Settings" with "Experience".** The current Settings panel is a configuration warehouse (feedback/gesture/telemetry/colorblind/contrast/text/collaboration/userMode/snap/vignette/seated/panelDistance/motion/miniOverview/presence). Restructure as `EXPERIENCE → Comfort | Interaction | Accessibility | Collaboration` with advanced/system settings hidden under `Advanced`. A novice never sees `strictBudget` or `telemetryEnabled` without reason.
- **Gates.** `tests/progressive-disclosure.test.ts` (per-profile visibility rules, no capability lost vs current, novice never sees developer surfaces); on-device validation with novice + analyst participants.
- **Exit.** The same runtime presents a calibrated surface to each role; progressive disclosure is structural, not cosmetic.

### Sprint 24.7 — Both-pinch gesture ownership redesign + input redundancy 🔲 (coupled to Phase 23.1)

> The 57% S2 suppression is a gesture conflict, not a microinteraction problem. The system has
> overlapping meanings for pinch/both-pinch/menu/selection/panel-interaction. A user shouldn't have
> to understand the gesture state machine to use the application.

- **Explicit gesture ownership.** At any moment one authoritative interaction mode (from 24.1) owns both-pinch: in `WORLD/NAVIGATE` it could mean two-hand transform; in `PANEL/INTERACT` it means commit. The system never silently suppresses and leaves the user wondering whether their hands malfunctioned — a subtle feedback cue (`⊙ selection mode` / `↔ two-hand transform`) is visible.
- **Coupled to Phase 23.1 host wiring.** The `GestureEngine` from `modules/gesture-intelligence` dispatches gestures through the same `InputRouter` precedence model. Both-pinch is one gesture among six; the mode FSM resolves its meaning. The gesture-intelligence honest-provenance (`source`, `degradedReason`) surfaces in the status strip (24.8).
- **Input redundancy (accessibility).** Every important action has at least two input paths (gesture + controller, or gaze + gesture). Critical tasks work without precision pointing — directly addresses the 91–100% pointer-target failure. Builds the 22.3 input-parity matrix as a real enforced contract, not a checklist.
- **Absorbs 22.3 hand-grab/both-pinch conflict + scoopDown dead-end.** The locomotion world-grab taking the first pinched hand with no `bothPinched` awareness, and `scoopDown` having no `else` branch, are both symptoms of no gesture ownership. The mode FSM resolves the class.
- **Gates.** `tests/gesture-ownership.test.ts` (mode-dependent both-pinch semantics, no silent suppression, redundancy contract per action); on-device validation that both-pinch feels intentional, not stolen.
- **Exit.** Both-pinch has one meaning per mode, visible to the user; every critical action has a non-precision input path.

### Sprint 24.8 — Calm visual language + status strip + spotlight/context model 🔲

- **Semantic color roles.** Establish `neutral | accent | success | warning | danger | analysis | observation` and constrain the palette. Today the wheel cycles six vivid colors and panels use cyan/magenta/high-contrast framing — if everything glows, nothing has priority. The visual world stays expressive; the UI becomes calmer. Builds on the 22.2 `palette.ts` tokens + 22.2 low-strain/muted presets.
- **Status strip ("what am I doing?").** A compact persistent strip answering: What am I looking at? What is selected? What mode am I in? What just happened? What can I do next? Example: `GRAPH / 18,420 nodes · MODE: ANALYSE · FOCUS: COMMUNITY 7 · ACTION: COMPARE`. More valuable than another permanent panel; helps observational research because session replays become easier to interpret (Concept Paper P9).
- **Spotlight + context model.** Redesign the presentation hierarchy around one dominant object: `PRIMARY VIEW ★ analyst focus / secondary contextual UI / tertiary tools + transient controls`. Today dashboard+wheel+mini-overview+peer-HUD+console+metrics+panel+settings+narrative all fight for visual bandwidth. The system is capable of doing much too much simultaneously.
- **Absorbs 22.4 three-tier zonation + 22.7 navigation-cost instrumentation.** The zonation is the spatial realization of spotlight/context; the navigation-cost instrumentation (analysis_time vs navigation_time) measures whether the spotlight model actually helps.
- **Gates.** `tests/status-strip.test.ts` (strip content reflects mode/focus/action/last-event); on-device validation that the calmer palette + spotlight model reduces visual-bandwidth contention.
- **Exit.** The UI has one dominant focus, a calm palette, and a persistent "what am I doing?" answer.

### Sprint 24.9 — UX acceptance gates (UX-001..UX-012 as quality gates) 🔲 (depends on 22.10 replay fixture)

> Turns UX into an engineering discipline. The UXI proposal already identifies the phenomena
> and proposes stable IDs. This sprint makes them acceptance criteria, not merely analytics.

- **Depends on Phase 22.10 replay fixture.** The 2026-08-18 replay fixture (`tests/fixtures/ux-trace-2026-08-18.jsonl`) must exist and the analyzer must mechanically reproduce the manual findings before any gate is enforced. Without the fixture, every "fix" is unfalsifiable (Concept Paper P12: stable means testable, not proven). This is the prerequisite the 2026-08-18 review's implied safety net does not yet exist.
- **Per-phenomenon targets.** Convert each UX-00x into a measurable gate. Examples: `UX-004 target acquisition failure → < 5% failed target acquisitions before calling the interaction model stable`; `UX-003 both-pinch stolen → < 10% suppressed-while-gazing ratio`; `UX-001 cold-start → < 10s tFirstJointsValid`. Targets are proposed, tuned against the replay fixture + future sessions, and recorded in `docs/UX_INVENTORY.md` (from 22.10).
- **Correction note (UX-001 misattribution).** The 2026-08-18 review misattributed UX-001 as "pointer aim drift"; UX-001 is **hand-tracking cold-start** (aim drift is UX-002). The gate for UX-001 is cold-start time, not aim drift. Any fix targeting "aim drift" will not move the UX-001 gate.
- **Gate enforcement.** The gates are CI checks over the replay analyzer output: a candidate build must not regress any phenomenon below its target. New sessions extend the fixture set; targets tighten as real-session evidence accumulates.
- **Signal, not verdict.** Consistent with the Concept Paper + the 22.10 non-goal: the gates are triage for study validity, not a UX quality score. A build passing the gates is not "proven good UX" — it is "not regressing against measured friction."
- **Exit.** UX-001..UX-012 are measurable engineering gates; a build cannot ship if it regresses measured friction; the fixture set grows with each session.

### Cross-cutting invariants (all 24.x sprints)

- **One navigation model.** The HandWheel is the primary navigation surface; the launcher ring is secondary; the dashboard is a workspace; panels are task surfaces. No competing navigation trees.
- **One interaction grammar.** The mode FSM + focus vocabulary are the single source of interaction truth. No component implements its own local interaction semantics.
- **No silent suppression.** Any gesture the system swallows is surfaced to the user with a visible mode cue. Both-pinch, system-toggle, and dwell all obey this.
- **Signal, not conclusion.** UX telemetry + acceptance gates are triage for study validity, not a UX quality verdict (Concept Paper P12, 22.10 non-goal).
- **2D is a partner, not a loser.** Per Concept Paper P7: UX fixes are framed as removing VR friction so the 2D-vs-VR comparison is fair, not as proving VR superiority. The precision/detail transition (24.5) must not degrade the 2D handoff path.
- **Delete, don't add.** The best UX refactor may delete several panels rather than build several more. Each sprint's exit criterion includes a net panel-count reduction or a role reclassification, not new permanent surfaces.
- **Study-harness validity first.** The interaction FSM (24.1), both-pinch ownership (24.7), and the replay fixture (22.10 → 24.9) are prerequisites for the flagship 2D-vs-VR study (Concept Paper Risk 4). They are not feature work; they are confound removal.

### Sequencing

```text
22.10 (replay fixture) ──▶ 24.9 (acceptance gates depend on the fixture)
24.1 (FSM + focus vocab) ──▶ 24.2 (wheel confirm) ──▶ 24.3 (VRMenu decompose)
        │                          │
        ▼                          ▼
24.7 (both-pinch ownership) ◀── coupled ──▶ 23.1 (gesture host wiring)
        │
        ▼
24.4 (panel roles + diagnostic modes) ──▶ 24.5 (dashboard + context cards)
        │                                        │
        ▼                                        ▼
24.6 (progressive disclosure)              24.8 (calm visual + status strip)
```

24.1 is the foundation — it blocks 24.2/24.3/24.7. 24.7 and 23.1 are coupled (same `InputRouter` surface). 24.9 depends on the 22.10 replay fixture. 24.4/24.5/24.6/24.8 are independently shippable once 24.1 lands. The architecture proposal's "P0 interaction model / P1 friction fixes / P1 VRMenu / P2 progressive disclosure / P2 acceptance gates" priority order is preserved: 24.1 is the P0 the proposal names as the biggest UX improvement available.

> **Non-goal:** a prettier dashboard. The proposal's own strongest recommendation: do not
> redesign Nemosyne as a prettier dashboard — design it as an analyst cockpit with one primary
> focus, one navigation model, and temporary tools that appear when needed. Several panels should
> disappear rather than new ones appear.

---

## Atlas V5 — Spatial Analytical Intelligence (proposed)

> Source: `docs/Atlas upgrade of Draco Recommender.md`. This is a roadmap alignment and
> migration plan, not a claim that the target architecture exists. The current Draco v1
> embodiment path remains supported while the boundaries below are established.

### Architectural direction

```text
Dataset -> analytical model -> DatasetSpace -> discovered structures
        -> ResearchContext -> Atlas -> VR semantic embodiment
```

- `DatasetSpace` owns a persistent, renderer-independent spatial representation of the complete
  dataset, with stable datum IDs, content-based dataset identity, spatial provenance, algorithm
  versions, parameters, normalization, distance metric, and seed.
- Structure discovery owns first-class regions, clusters, anomalies, trajectories, and
  neighbourhood relationships. A row label or renderer group is not sufficient evidence.
- `Atlas` is the new analytical guidance layer above the current constraint solver. It must
  expose a target, analytical action, rationale, evidence, confidence, and accept/reject/override
  state. It must not be implemented by renaming `DracoSpec`.
- Statistical calculations are Rust/WASM provider work, not a second TypeScript formula stack.
  Prefer maintained crates (`ndarray`, `nalgebra`, `statrs`, `rand_chacha`, `petgraph`, `rstar`/
  `kiddo`, `geo`) behind versioned `AnalysisSpec`/`AnalysisResult` contracts. Published methods,
  fixture datasets, and independent R/Python implementations validate the Rust providers; they
  are not runtime dependencies. In-house implementations require a documented method with
  numerical conformance tests and no suitable maintained crate.
- VR translates analytical commands into embodiment; analytical layers must not depend on
  Three.js object identity, WebXR state, or renderer lifecycle.
- Research sessions must distinguish dataset transformations, navigation, observations,
  recommendation decisions, and interventions before the system makes reproducibility claims.

### Atlas MVP feature slice

> The first Atlas slice is one complete, reproducible full-dataset analysis loop, not a second
> rendering stack or a collection of disconnected visual features.

```text
CSV/JSON -> schema preview -> DatasetModel -> DatasetSpace -> structures
          -> Rust statistical analysis -> Atlas guidance -> Draco VR embodiment
          -> canonical 2D precision handoff -> finding -> replay bundle
```

- **P0 Dataset foundation:** stable datum IDs, content hashing, feature roles, relationship
  model, explicit missingness policy, immutable DatasetSpace versions, and full-dataset coverage.
- **P0 Spatial analysis:** deterministic PCA or MDS baseline, neighbourhood graph, one named
  structure provider, spatial provenance, and visible distinction between semantic, structural,
  and layout position.
- **P0 Statistical provider:** Rust/WASM `AnalysisSpec`/`AnalysisResult` contracts, robust
  descriptive summaries, diagnostics, deterministic scaling, and schema-compatible JS fallback.
- **P0 Atlas guidance:** target, analytical action, rationale, evidence, confidence, limitations,
  provenance, and accept/reject/override state. Guidance must be testable without WebXR.
- **P0 Embodiment:** Draco v1 renders the complete DatasetSpace through an adapter; it does not
  own statistical truth or replace the whole dataset with a recommended subset.
- **P0 Precision handoff:** canonical 2D provides exact values, filters, comparisons, intervals,
  and export while preserving dataset, structure, selection, and provenance IDs.
- **P0 Replay:** research context, commands, guidance decisions, observations, provider versions,
  seeds, and resulting state hashes are persisted in a replayable session bundle.

### Atlas feature priorities

**P1 — Credible research release**

- Compare as a first-class operation: group A/B, before/after, selected/population, and condition
  comparison with declared estimand, missing-data policy, and uncertainty method.
- Task-first workflows for anomaly, comparison, relationship, hierarchy, and temporal analysis.
- Evidence and explanation panel exposing method, parameters, diagnostics, evidence level, and
  "why this?" rationale.
- Progressive computation from schema and identity to coarse space, neighbourhoods, structures,
  local statistics, and guidance without blocking the render loop.
- Research context, observation capture, typed event ledger, observer permissions, and replay.
- Accessibility parity across hand, controller, dwell, and 2D paths, including color-safe encoding,
  adjustable dwell, text scaling, reduced motion, and tracking-loss recovery.
- Rust/JS conformance fixtures covering missingness, ties, degenerate inputs, seeds, tolerances,
  provider fallback, and resource limits.

**P2 — Evidence-dependent extensions**

- Sensitivity analysis across embeddings, seeds, normalization, and structure parameters.
- Advanced graph, temporal, spatial, and TDA structure providers.
- Optional natural-language Atlas requests and evidence-grounded explanations.
- Collaborative research state, observer mode, and intervention workflows.
- Confirmatory protocol mode with frozen estimands, multiplicity policy, participant-level
  inference, and independent analysis bundles.

**Explicit non-goals**

- Desktop 3D as a product or study condition.
- Replacing Draco v1 with a new renderer.
- Expanding Draco visual-metaphor rules as the primary analytical strategy.
- LLM-owned statistics, confidence, clustering, evidence, or recommendations.
- Claims that attractive scenes, telemetry, benchmarks, or unit tests demonstrate user benefit.

### Atlas MVP exit criteria

- The same complete reference dataset produces equivalent DatasetSpace coordinates, IDs,
  neighbourhoods, and named structures across repeated runs.
- Rust/WASM and JS providers conform to the same result schema and declared numerical tolerances.
- Every displayed structure and guidance result exposes method, parameters, provenance, diagnostics,
  and evidence status.
- A researcher can inspect a full dataset in VR, verify exact values in canonical 2D, record a
  finding, save the state, and replay it without WebXR or network access.
- No Atlas domain, analysis, or spatial module imports Three.js, WebXR, or `World`.

### Migration sequence and gates

1. **Atlas 0 — Freeze Draco v1.** Do not add more visual-metaphor rules to
   `ConstraintEngine`. Document and test the existing facts/spec/translator contract.
2. **Atlas 1 — DatasetSpace foundation.** Add a renderer-independent model with stable datum IDs,
   content-based fingerprinting, explicit normalization and deterministic embedding metadata.
   Gate: a complete reference dataset round-trips without Draco or VR.
3. **Atlas 2 — Structure discovery.** Convert clustering/TDA outputs into provenance-bearing,
   stable-ID structures with membership and evidence. Gate: cluster counts come from named,
   parameterized procedures rather than heuristics, and outputs are reproducible.
4. **Atlas 3 — Analytical guidance.** Introduce `Atlas` above Draco v1 and connect
  research context to evidence-backed analytical actions. Gate: every recommendation is
  inspectable, rejectable, overrideable, and independently testable without rendering.
5. **Atlas 4 — Semantic VR embodiment.** Map analytical targets to testable VR commands for
   navigation, isolation, slicing, inspection, comparison, and reset. Gate: commands operate on
   analytical IDs and preserve provenance rather than mutating Three.js state directly.
6. **Atlas 5 — Research context and replay.** Extend session persistence with DatasetSpace,
   structures, research context, recommendation history, observations, interventions, and spatial
   state. Gate: a session can be restored from serialized state without manual reconstruction.
   **Status:** complete ✅ — `ResearchContext` (studyId/researchQuestion/hypothesis/
   variablesOfInterest/observerMode) round-trips through the schemaVersion-2 JSON;
   `recordObservation`/`recordIntervention` populate the ledger's observation/intervention fields;
   restore path re-solves the artefact, re-applies the operation transform, recomputes TDA, and
   rebuilds structure handles. End-to-end gate validated in `tests/world.test.js`: a session seeded
   with structures (cluster analysis + accepted recommendation), research context, observations,
   interventions, and spatial state (camera + panel pose) restores into a FRESH World with the VR
   scene (artefact nodeMeshes + structure-ID handles + TDA recompute) rebuilt with no manual
   reconstruction; structures/decisions/ledger round-trip via the authoritative ledger.
7. **Atlas 6 — Controlled experiment harness.** Add study conditions, tasks, trials, outcomes,
   counterbalancing, and frozen configuration. Gate: human-performance claims require controlled
   evidence; telemetry, unit tests, and benchmark utilities alone are not study evidence.
8. **Atlas 7 — Optional language layer.** Add intent parsing and explanations only after the
   deterministic analytical API exists. An LLM may interpret or explain, never authoritatively
   compute evidence, clustering, confidence, or recommendations.

### Current non-goals

- Do not claim that current `Dataset`, `TDAMapper`, `WorldSessionController`, `UXTraceRecorder`,
  or `BenchmarkSession` already implement DatasetSpace, full provenance, research replay, or
  validated user benefit.
- Do not couple DatasetSpace to Three.js, WebXR, or current mesh `userData.row` references.
- Do not enable Atlas work by expanding the existing visual rule vocabulary or by promoting
  current heuristic `clusterCount` into analytical structure evidence.
- Do not make collaboration, observer mode, or an LLM part of the first DatasetSpace slice
  without explicit event, permission, and reproducibility schemas.

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
  VR × timer × answer capture × confidence × workload × interaction
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
- **Research direction:** the active Stable Alpha study is a bounded, preregistered 2D-versus-VR
  crossover using one frozen task and implementation bundle. Its outcomes, estimands, exclusions,
  and missing-data rules belong to `docs/study/`, not this roadmap. Learnability, memory, metaphor,
  and broader topology questions are deferred research hypotheses, not release commitments.
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

- `Current work` = actively being implemented or validated.
- `Planned` = approved next work with a defined exit condition.
- `Deferred` = intentionally not active; promotion requires a decision.
- `Proposed` = architecture direction without implementation commitment.

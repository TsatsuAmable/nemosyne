## Current Status

> **Single source of truth for project state.** Read this block FIRST on pickup and
> update it BEFORE stopping. Other docs (CLAUDE.md, `.agents/`) point here — they do
> not duplicate state.


- **Last updated:** 2026-08-17 — Atlas 4 initial slice: `VRCommand` type + `VRCommandExecutor`
  coordinator that resolves `targetIds` → `rowIndices` via `DiscoveredStructure`, executes
  embodiment actions (isolate/navigate/inspect/compare/reset) with ledger-tracked provenance
  (`'embodiment'` `ResearchEventKind`). Atlas 3 guidance layer complete. Atlas 2 structure
  discovery complete. Wave 6 merged via PR #130. Wave 5 + statify via PR #128; Wave 4 via PR #127.
- **Active sprint:** Atlas 4 — continue semantic VR embodiment: per-structure InPlaceHandles,
  TDA panel structure-ID addressing, refactor `DataOperations.applyX` to accept rowIndices.
  Rust/WASM remains the canonical analytical engine with no JS fallback.
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
- **Next:** Atlas 4 — continue semantic VR embodiment: per-structure InPlaceHandles, TDA panel
  structure-ID addressing, refactor `DataOperations.applyX` to accept `rowIndices` instead of
  full datasets. Then gate Atlas 5 on validated embodiment commands.

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

- [x] `README.md`, `docs/ARTEFACTS.md`, `docs/INTERACTIONS.md`, `docs/ARCHITECTURE.md`, `docs/GETTING_STARTED.md`.
- [x] Complete `docs/ROADMAP.md` and keep it current.
- [x] Expand built-in sample datasets (financial, geospatial, process-flow).

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

> **Audit note (2026-08-14, resolved 2026-08-16):** Components in this sprint were initially **built** (classes + unit tests complete) but not wired. `AdaptiveAssistController` now mounts and drives the three assist surfaces in production; Quest usability validation remains pending. See `docs/AUDIT_PHASES_1_20.md` for the historical baseline.

- [x] **`FrustrationResponseManager`** (`src/vr/ui/FrustrationResponseManager.ts`) — **WIRED in Phase 22.3.** `AdaptiveAssistController` feeds analyzer actions, applies user mode, and parents the card to `analystAnchor`.
- [x] **`GestureConfidenceHUD`** (`src/vr/ui/GestureConfidenceHUD.ts`) — **WIRED in Phase 22.3.** `AdaptiveAssistController` instantiates, registers, and disposes the per-gesture confidence panel.
- [x] **`JITGestureHintManager`** (`src/vr/ui/JITGestureHintManager.ts`) — **WIRED in Phase 22.3.** `AdaptiveAssistController` sets the scene and drives diegetic hints from gesture and selection context.
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

> **Audit note (2026-08-14):** `AnalysisStorybookExporter.ts` class is **BUILT, NOT WIRED.** Export functionality is implemented in `TelemetryPanel.ts` instead; the class is never instantiated. Decision: either wire the class into TelemetryPanel or consolidate export logic into a single path. For now, export works via TelemetryPanel (not misleading, but terminology "Storybook" vs. "Telemetry" should be clarified).

- [x] `AnalysisStorybookExporter.ts` — **BUILT, NOT WIRED.** Packages session state, dataset snapshot, camera poses, selected filters, annotations, and tour checkpoints into a downloadable JSON/HTML bundle (class complete, tests pass, never instantiated)
- [x] `TelemetryPanel.ts` — export functionality actively used; exports raw telemetry + session context as JSON
- [x] `tests/storybook-context-recovery.test.ts` — test suite verifying storybook bundle serialization

### Sprint 13.4 — Session Recovery & WebGL Context Loss Safety

> **Audit note (2026-08-14):** `ContextRecoveryManager.ts` is **BUILT, NOT WIRED.** WebGL context loss handling exists in `Engine.ts` directly (`contextlost`/`contextrestored` listeners) rather than delegated to the manager.

- [x] `ContextRecoveryManager.ts` — **BUILT, NOT WIRED.** Class complete; detects WebGL context loss, preserves state, restores GPU buffers (never instantiated; logic lives in `Engine.ts`)
- [x] `Engine.ts` — `contextlost`/`contextrestored` event listeners active; context loss recovery working in production
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

> **Audit note (2026-08-14):** Worker classes are **BUILT, NOT WIRED.** Both classes are complete with tests, but the main-thread parsing/solving paths remain active. Workers are never instantiated. Decision: main-thread performance is acceptable for current datasets (100k points load in <200ms); worker offloading can be revisited if main-thread blocking becomes critical. For now, the built workers serve as a reference implementation.

- [x] `CSVParserWorker.ts` — **BUILT, NOT WIRED.** Class complete; would offload CSV/TSV parsing and type inference off the WebXR main render thread (never instantiated; main-thread parser in `FileLoader.ts` used instead)
- [x] `DracoSolverWorker.ts` — **BUILT, NOT WIRED.** Class complete; would offload statistical fact extraction and Genetic Algorithm constraint solving (never instantiated; main-thread solver in `DracoTopologyNode.ts` used instead)
- [x] `tests/worker-offloading.test.ts` — test suite verifying async worker message passing and result accuracy

### Sprint 17.3 — Unified WebRTC Networking & Binary Pose Streaming

- [x] `BinaryPoseSerializer.ts` — **WIRED.** Used in `CollaborativeStateSync.ts`; replaces high-frequency 20Hz `JSON.stringify` camera pose broadcasts with compact 32-byte binary `Float32Array` buffers
- [x] `tests/binary-pose-governor-binding.test.ts` — test suite verifying binary pose serialization and state convergence

### Sprint 17.4 — Connect `AdaptiveFrameGovernor` to Scene Renderers

- [x] Bind `AdaptiveFrameGovernor` `_lodScaleFactor` directly to `InstancedPointCloud` instance counts (`applyLODScale()`)
- [x] **WIRED.** Governor instantiated in `Engine.ts:82`, actively adjusts LOD during render loop
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
- 🔲 **Dwell threshold not user-adjustable (US23, verified).** The dwell chain is fully wired
  and ticking per frame (`SettingsPanel.dwellSelection` → `World.ts:1247` →
  `InputRouter.setDwellSelection` → `SelectionDispatcher`, 1200 ms) — but the threshold is
  fixed; `_dwellThreshold` plumbing exists with no UI. Fix: expose a dwell-delay stepper in
  the Accessibility section. (Dwell Select itself is **not** a defect — confirmed working.)
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

- 🔲 **Hand-pinch double-toggle / double-fire (P1, verified).** `HandPointer._doUpdate`
  synchronously calls `this.onPinchStart(this)` on pinch-start (`Hands.ts:285`), and
  `InputRouter.addHand` wires that fallback to `handWheelMenu.toggle()` (menu hand) or
  `dispatcher.triggerSelect()` (non-menu hand) (`InputRouter.ts:153-161`). Then in the *same*
  `update()` frame, `_pollSelection` detects the same edge (`pinched && !wasPinched`) and
  toggles the menu again (`:329-335`) or calls `machine.press(hand)` (`:337-338`). Net effect:
  the menu hand opens **and** closes in one frame → the wheel menu appears non-responsive to
  pinch; the non-menu hand fires `triggerSelect` twice (double selection, double audio/haptic).
  Controller path is unaffected (no `selectstart` → no `onSelect`). Fix: suppress the
  `onPinchStart` fallback when the polling path is active (or remove the fallback — the comment
  at `:33-34` says polling is primary).
- 🔲 **`HandGestureRecognizer` ignores `dominantHandIndex` for single-hand gestures (P2,
  verified).** `setHands()` derives `dominantHandIndex` from handedness (`:114-125`) but
  `update()` uses array order `poses[0]`/`poses[1]` (`:146-147`) and swipe/slice track only
  `poses[0]` (`:332-342`); `okSign` checks `l.pinched && !r.pinched` (`:346-350`). On Quest the
  hand-array order follows XR input-source *connection* order, not handedness, so single-hand
  gestures fire on the wrong hand or not at all if hands connect as [left, right]. Distinct from
  the US9 wheel-menu item (which is `WorldUIManager` hardcoding `hands[0]`) — here the
  recognizer's own classification ignores the index it computed. Fix: use
  `poses[this.dominantHandIndex]`/`poses[this.nonDominantHandIndex]` in `update()`.
- 🔲 **Hand-grab locomotion conflicts with the both-pinch system gesture (P2, verified).**
  `_updateHandGrabMovement` (`Locomotion.ts:644-680`) takes the first pinched hand for
  world-grab with no awareness of `SystemGestureDetector.bothPinched` (selection is suppressed
  during both-pinch at `InputRouter.ts:321-325`, but locomotion is not). Recalling the launcher
  via the system toggle lurches the world proportionally to hand movement during the hold. Fix:
  skip `_updateHandGrabMovement` when both hands are pinched.
- 🔲 **`scoopDown` is a dead-end outside flight mode (P2, verified).** `scoopUp` toggles the
  statistical lens when not in flight, but `scoopDown` has no `else` branch
  (`WorldInputCoordinator.ts:166-171`) — the inverse gesture has no inverse action, forcing menu
  navigation (Views → Lens) to disable the lens. The recognizer classifies both symmetrically.
  Fix: add an `else` calling `onToggleStatisticalLens` (true toggle pair).
- 🔲 **Seated-height offset double-counts head height (P1, verified medium-confidence — needs
  in-headset).** `_applyComfortOffset` sets `cameraGroup.position.y = camera.position.y +
  seatedHeightOffset` (`Locomotion.ts:375`), but `camera` is a child of `cameraGroup`
  (`Engine.ts:94`) → `camera.position.y` is re-derived after the group moves, forming a feedback
  loop. At equilibrium the offset has zero net effect and the lerp (`:380`) causes visible
  vertical jitter. The same `+ camera.position.y` pattern in `_warpTo:636` is harmless only
  because teleport is one-shot. Fix: `cameraGroup.position.y = seatedHeightOffset` (drop the
  `camera.position.y` term). Confirm the matrix update order in-headset before shipping.

#### Onboarding last-mile (wire the praised-but-dead features)
- ✅ **JIT gesture hints wired in production (US11).** `AdaptiveAssistController` instantiates the manager, sets the scene, and drives hints from selection and gesture context. Targeted tests cover the coordinator; Quest validation remains pending.
- ✅ **Frustration-response hint card wired in production (US12).** `AdaptiveAssistController` instantiates the manager, feeds analyzer actions, applies user mode, and parents the UI to `analystAnchor`. Targeted tests cover the coordinator; Quest validation remains pending.

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
- ✅ **First-class Compare operation (fixed in `7649446`).** `DatasetOperations.compare()` now
  produces a deterministic group-A/group-B numeric-mean summary with counts and differences;
  `computeOperationDataset()` exposes the default first-categorical-column path. The current
  implementation is a foundation for before/after, selected/population, and richer inferential
  comparisons; it is not a statistical significance test.

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
- 🔲 **Unified system-toggle gate:** apply dwell, cooldown, panel targeting, and release semantics consistently to hand pinches and controller grips; prevent re-arming while a gesture remains held.
- 🔲 **Adversarial regression coverage:** add tests for remote authorization/schema abuse, Compare rendering/history, existing-scene recoloring, chart disposal, and controller/pinch precedence.

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
- 🔲 **`DracoSolverWorker` is not a real Web Worker (P1, verified).** `DracoSolverWorker.ts:29`
  runs `this._engine.solve()` inside `setTimeout(…, 0)` on the main thread (the docstring claims
  it "offloads … off the WebXR main render thread" — misleading), and `:21` holds a *separate*
  `ConstraintEngine` singleton from `DracoTopologyNode`'s (`DracoTopologyNode.ts:29`). Adjusting
  a weight through the worker therefore blocks XR frames and mutates a divergent engine. Either
  make it a real `Worker` (post `dataInput`, receive `SolverResult`) or delete it and route
  weight adjustments through `DracoTopologyNode.adjustWeight`.
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

- 🔲 **`src/ai/` entire module is production-unwired — 740 lines (P1, verified).** None of the 6
  `src/ai/*.ts` files (`NeuralConstraintPredictor`, `GestureClassifierModel`, `GestureModelStore`,
  `GestureTrainingWorker`, `VoiceCommandListener`, `DracoWorldModel`) is imported anywhere in
  `src/` outside `src/ai/` itself (grep-confirmed zero); only tests reference them. This upgrades
  the existing "src/ai/ README staleness" item: the whole AI subsystem is built and unit-tested
  but never wired into `World`/`Engine`/any coordinator. Decide: wire + integration-test, or
  delete (the symbolic Draco recommender is the defensible story — see the README item above).
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

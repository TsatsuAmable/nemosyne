# Nemosyne Roadmap & Implementation Status

> **Current implementation-status authority.** Product and research direction are governed by `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` V3. This document records current implementation state, programme order, review findings and promotion gates. Completed migration detail is preserved in `docs/archive/`.

## Status snapshot — 26 August 2026

**Current main at the start of the latest review pass:** `ed148e0` (#423, merged; all CI green). The four queued Stream B tranches have all landed: #419 (RF-023/RF-024), #420 (RF-027), #421 (RF-025), #423 (RF-007 scale/shared-substrate half). Earlier: #416 (RF-022, RF-026), #418 (P1-C sparse topology review exit — RF-017/RF-018/RF-019/RF-020/RF-021), #410–#415.

**Next Stream B tranches (in roadmap order):** RF-007's **validity-honoring half is a governed design decision pending user adjudication** (skip vs mask; changes TDA outputs + the row-path `unwrap_or(0.0)` + columnar `validity 0 ⇒ 0.0` parity contract) — it cannot proceed without user approval per Cardinal Rule 1. Then RF-001/RF-002 (P1-R) and RF-005/RF-006/RF-008 (P1-U), plus the RF-025 carry-over (wire World/UX to `recordRemediation`) and the physical Quest 3S qualification blocker.

**In flight:** none. RF-007's safe scale/shared-substrate + contract-codification half landed as #423 (new `data::point_access` substrate with the documented columnar primitive invariant; `FeatureSpace::from_columnar` borrows via the substrate — no throwaway per-column clone, byte-identical; `PointCloud::from_columnar` delegates lookup+semantics to the same substrate; 7 new Rust regression tests). The validity-honoring half and the `PointCloud` borrowed/lifetime-parameterised storage refactor remain open as a governed design decision. Last landed: #423 (RF-007 scale+contract), #421 (RF-025), #420 (RF-027), #419 (RF-023/RF-024).

**Current interpretation:** P1-C, P1-D, P1-E and P1-F are useful implementation advances, but independent review found correctness, scale, scientific-semantics, production-wiring and evidence gaps. They are therefore **IMPLEMENTATION LANDED / REVIEW ACTIVE**, not `VERIFIED COMPLETE`. The P1-F production-wiring gap (RF-025) is closed; RF-026 remains review-active until physical XR task evidence is captured. RF-007's scale/shared-substrate half is fixed; its validity-honoring half is a governed design decision pending user adjudication. Stream A remains free to advance private-preview/scientific work where dependencies are stable; Stream B continues closing earlier and newly discovered RF findings.

**Physical promotion blocker:** the governed Meta Quest 3S browser/performance and interaction qualification remains outstanding. Desktop/browser CI is necessary evidence but cannot qualify headset behaviour.

## Two-workstream operating model

Nemosyne development runs as two deliberately independent but converging streams.

### Stream A — forward implementation

Stream A advances the planned architecture and product frontier: private-preview plumbing, investigation/discovery science, measurement semantics, pattern-fragility evidence, maintenance, and later P2/P3 work only when their prerequisites are met.

Stream A should not stop merely because the review stream finds defects in earlier work unless a defect invalidates a dependency or makes continued implementation unsafe. It should preserve the governing design boundaries and consume review fixes as they land. All Stream A work is governed by [`STREAM_A_IMPLEMENTATION_QUALITY_CONTRACT.md`](STREAM_A_IMPLEMENTATION_QUALITY_CONTRACT.md).

### Stream B — review and fix-forward

Stream B repeatedly audits the **actual merged implementation** against the governing vision, decision records, architecture boundaries, scientific semantics, runtime behavior and user journey. Its loop is:

```text
merged implementation
        ↓
adversarial design/code/product review
        ↓
record concrete findings in this roadmap
        ↓
add the cheapest test that would have caught each defect
        ↓
fix forward on current architecture
        ↓
re-run authoritative gates
        ↓
review the result again
        ↺
```

Rules for Stream B:

- A merged PR may be reclassified from `COMPLETED` to `IMPLEMENTATION LANDED / REVIEW ACTIVE` when evidence does not support its acceptance claim.
- New findings become roadmap work immediately; they do not wait for the next planning cycle.
- Prefer fix-forward changes over reverting sound architectural progress.
- Every correctness bug gets a regression test at the owning layer.
- Every architecture mismatch gets an authority/boundary test where practical.
- Every UX completion claim requires real product-path evidence, not only isolated class/integration tests.
- Every scientific representation claim must match the mathematics actually computed and the information actually preserved.
- Every concurrency/runtime completion claim must prove the production path, not merely the existence of an unused abstraction.
- Every scale claim must account for the full algorithm, including preprocessing, copies, index construction and repeated sweeps rather than only the newly optimized inner loop.
- A gate becomes **VERIFIED COMPLETE** only after implementation and review evidence agree.
- Private-preview promotion requires convergence of both streams, even though Stream A may continue ahead while Stream B repairs earlier tranches.

### Status vocabulary

- **IMPLEMENTATION PARTIAL:** scaffolding or a bounded portion exists, but the planned production path is not yet landed.
- **IMPLEMENTATION LANDED:** planned code exists and passed its implementation gates.
- **REVIEW ACTIVE:** later review found unresolved defects, semantic gaps or insufficient acceptance evidence.
- **VERIFIED COMPLETE:** implementation plus independent review evidence satisfy the governing acceptance criteria.
- **DEFERRED:** intentionally not active because prerequisites are unmet.

## Active review/fix-forward ledger

| ID | Area | Severity | Finding | Required disposition |
| --- | --- | --- | --- | --- |
| RF-001 | P1-R / authority | High | `VRTopologyTranslator` still feeds `dataset.rows` into non-point embodiment, and aggregate/density/cluster reductions traverse O(N) rows/positions in TypeScript. Bounded mesh count is not the same as Rust-owned bounded analytical reduction. | Define Rust-owned bounded semantic embodiment payloads; make Three.js consume those payloads rather than derive analytical structure from raw rows. |
| RF-002 | P1-R / scientific semantics | High | `DENSITY_FIELD` is currently a fixed 6×6×6 histogram over rendered positions while the ontology claims continuous density estimation; `DISTRIBUTION_FIELD` shares that geometry despite claiming quantiles/PDF/contours; cluster/manifold claims also exceed demonstrated semantics. | Reclassify candidate fidelity honestly and either implement the declared mathematics or narrow the ontology/preservation claims. |
| RF-003 | P1-R / correctness | High | Aggregate grid calculation treated legitimate numeric zero as falsy and substituted `1`, corrupting aggregate means. | **Fixed in #409**; preserve zero and retain regression coverage. |
| RF-004 | P1-R / tests | Medium | The C4 source guard sliced from `buildAggregateBars` to an earlier `buildDensityField`, producing an empty string and allowing a false pass. | **Fixed in #409**; source guard now proves non-empty method slices and inspects the intended branches. |
| RF-005 | P1-U / UX | High | The runtime still constructs a broad dashboard/panel constellation; `ContextualTaskSurface` is an action filter, not a colocated spatial task surface. | Reduce/demote persistent surfaces and implement actual selection-anchored contextual controls. |
| RF-006 | P1-U / world semantics | High | TechnoCore lens methods are not yet demonstrated as wired investigator input/analysis controls; IceVault remains a persistent largely decorative glyph. | Wire TechnoCore through input/NIL/analysis with visible state and provenance; give IceVault a real archival/recovery role or remove it from the default world. |
| RF-007 | P1-A/P1-C / analytical correctness & scale | High | Columnar TDA `FeatureSpace` and P1-C `PointCloud` clone selected columns and ignore primitive validity bitmaps; `FeatureSpace` also transposes into `Vec<Vec<f64>>`. Invalid values therefore become numeric zero and large-N memory is multiplied. | **Fixed in #423 (scale + contract half)**: new shared `data::point_access` substrate (`primitive_column_slice` / `borrowed_feature_columns` / `owned_feature_columns`) with the documented **columnar primitive invariant** (validity 0 ⇒ stored 0.0, all-finite, enforced at ingest); `FeatureSpace::from_columnar` borrows primitive buffers via the substrate (no throwaway per-column clone; transpose from borrows; byte-identical output, peak-memory reduced by n·d during construction) and exposes `points()`; `PointCloud::from_columnar` delegates lookup + semantics to the same substrate (one lookup, one invariant, no redundant per-element re-normalize). New regression tests: invariant contract, cross-substrate `FeatureSpace`↔`PointCloud` parity on a null-containing columnar dataset, `from_parts` non-finite normalization, borrowed-path byte-identity. **Remaining (governed design decision — Cardinal Rule 1)**: the *validity-honoring* half — carrying the validity bitmap through the substrate so missing/invalid feature values are masked or excluded rather than silently coerced to numeric zero — changes TDA/neighbourhood outputs and breaks the current row-path `unwrap_or(0.0)` + columnar `validity 0 ⇒ 0.0` parity contract. The skip-vs-mask semantics must be approved before implementation; until then the substrate is invariant-aware (not validity-carrying) and the `PointCloud` borrowed (no-clone, lifetime-parameterised) storage refactor also remains. |
| RF-008 | P1-U / evidence | High | `investigator-journey-e2e.test.ts` manually advances phases and uses a kernel mock. It is useful integration coverage but not evidence of a real browser/XR investigator journey or usability outcomes. | Reclassify as integration evidence; add Playwright product-path coverage and physical XR task evidence. |
| RF-009 | Roadmap governance | Medium | Roadmap status became stale and internally contradictory, with older main SHAs and completion claims coexisting with open checklist items. | **Fixed by the two-stream model**; every Stream B tranche refreshes the roadmap from live main. |
| RF-010 | P1-B / production integration | High | #408 added `WorkerAnalyticalPort`, but production `World` does not install it; `AtlasCore.setKernel()` selects `InlineAnalyticalPort`. The interactive runtime therefore remains same-thread by default. | **Fixed in this review tranche**; installed `WorkerAnalyticalPort` on browser/XR startup in `World._initWasmRuntime` and preserved execution port in `AtlasCore.setKernel`. |
| RF-011 | P1-B / generation authority | High | Async requests and supersession hard-code `generation: 1`, so the documented kernel-generation fence is not connected to the actual runtime lifecycle generation. | **Fixed in this review tranche**; threaded real runtime generation `AtlasCore.generation` and worker generation fencing into requests and supersession. |
| RF-012 | P1-B / failure semantics | High | Worker transport/runtime errors were converted into resolved `{ value: null, error }` results, making kernel failure indistinguishable from a legitimate null analytical outcome. | **Fixed in #409**; worker failures and worker-reported errors reject with `KernelUnavailableError` and invoke the kernel-failure funnel; supersession remains a non-error null result. |
| RF-013 | P1-B / worker dataset authority | High | Worker handles are WASM-instance-local. Async TDA requests send a main-thread handle but no first-use dataset payload, while the worker has no registered dataset. | **Fixed in this review tranche**; implemented fingerprint verification and generational dataset handle clearing in worker. |
| RF-014 | P1-B / output identity | High | `applyAnalysisAsync` assigns the input fingerprint as `outputHash`, so mutation result identity/provenance can be wrong. | **Fixed in this review tranche**; worker returns verified explicit output fingerprint used in result and provenance ledger. |
| RF-015 | P1-B / evidence | Medium | The test labelled “async TDA parity with real WASM” used a mock bridge and inline execution; transfer/scheduling was checked complete without recorded measurement evidence. | **Partially fixed in this review tranche** by truthfully relabelling the test as inline parity. Add a real module-Worker + real-WASM browser/integration test and recorded dispatch/transfer/compute measurements. |
| RF-016 | P1-B / presentation adoption | High | #408 added async Atlas methods but did not route `TDAPlanes`, `DataOperationController` or `World` through them. The frame-budget benefit is not demonstrated on the actual interaction path. | **Fixed in this review tranche**; adopted async execution in `TDAPlanes` and `DataOperationController` with stale-result fences and last-valid presentation semantics. |
| RF-017 | P1-C / substrate authority | High | The new `PointCloud` repeats RF-007: row input maps missing values to `0.0`, columnar input clones primitive values and ignores validity. P1-C therefore built a second point-storage abstraction instead of consuming the planned validity-aware borrowed accessor. | **Fixed in #418**: `PointCloud::from_columnar` normalises rows where `validity == 0` or value is non-finite to `0.0`, matching `from_dataset` row parity. |
| RF-018 | P1-C / sparse correctness | Blocker | `GridSparseIndex` enumerates only center + axis-aligned neighbour cells for `d > 6`, omitting diagonal cells whose points can still be within epsilon. Sparse mode is automatically selected for `N > 8192`, so high-dimensional results can silently lose valid edges. | **Fixed in #418**: `GridSparseIndex` falls back to `ExactIndex` for `d > 6`; `generate_neighbor_offsets` enumerates all 3^d cells for `d <= 6`; 7D diagonal parity test `c2_high_dimensional_diagonal_parity_rf018` added. |
| RF-019 | P1-C / integration | High | `compute_mapper_graph_space` still performs its original nested scan over each bucket and does not consume `RaggedNeighbourhood`, despite docs/roadmap claiming the sparse substrate is reused across Mapper. | **Fixed in #418**: Mapper bucket clustering now builds a per-bucket `PointCloud` and dispatches to `ExactIndex`/`GridSparseIndex` at `eps = step x 0.5`; BFS over `csr.neighbors(u)` forms connected-component clusters. |
| RF-020 | P1-C / complexity | High | Betti-0 still computes the global maximum distance using an O(N²) all-pairs pass and then rebuilds union-find/replays sorted edges from the beginning for every radius step. This is not the claimed single-pass union sweep. | **Fixed in #418**: `max_d` uses exact all-pairs for `n <= 100`; `bounding_box_diagonal()` O(n*d) bound for `n > 100`. Monotonic sweep hoists `parent[]`, `num_components`, `edge_cursor` outside the step loop — single forward scan, no replay. Tests `c6_betti0_monotone_sanity` and `c7_betti0_bounding_box_diagonal_path_n_gt_100` added. |
| RF-021 | P1-C / evidence & modes | High | `NeighbourhoodMode::Landmark` is declared but has no implementation/use; #410 checked landmark mode and benchmark/stability gates complete while the TS “scalability” tests use `makeKernelMockBridge()` and mostly assert output shapes. | **Fixed in #418**: `LandmarkIndex` implemented with greedy farthest-point sampling (seed LCG selects first; subsequent landmarks chosen by max-min distance); O(K*N + edges) neighbor construction via per-landmark buckets + HashSet dedup; approximate-recall doc comment; tests `c5_landmark_mode_determinism` and `c5b_landmark_farthest_sampling_spreads_landmarks` added. |
| RF-022 | P1-D / measurement correctness | High | Perceptual sampling projected with world X/Y rather than the sampled camera basis, used an unsorted depth as “median”, sampled the first 100 marks causing row-order dependence, and awarded ideal measured evidence to zero-mark embodiments. | **Fixed in the current Stream B tranche** with camera-relative projection, true median, deterministic order-invariant bounded sampling, zero-mark rejection and stronger finite/range validation. |
| RF-023 | P1-D / evidence identity | High | Perceptual evidence is looked up by candidate ID but is not yet rejected when its `datasetFingerprint` disagrees with the current `DatasetSignature`, allowing stale measurements to influence hard constraints/ranking. | **Fixed in this Stream B tranche**: `MonetaHypothesisEngine.normalizePerceptualEvidence` binds every evidence item to the current dataset fingerprint, candidate id (key↔candidateId), evidence version and structural contract before hard constraints or scoring; stale/cross-dataset/version/key-mismatched items are dropped fail-closed to the engineering prior and counted in `DecisionProvenance.stalePerceptualEvidenceDropped`; regression tests cover each rejection path. |
| RF-024 | P1-D / semantics & study governance | High | `hiddenMarkFraction` currently measures depth/frustum exclusion rather than true occlusion, label crowding is a count/extent surrogate, and #411 changed default ranking weights without a corresponding frozen-treatment manifest update. | **Fixed in this Stream B tranche**: `hiddenMarkFraction` renamed to `frustumExclusionFraction` and `maxOcclusionTolerance` to `maxFrustumExclusionTolerance` so the hard gate honestly bounds frustum/depth-range exclusion, not occlusion; `MeasuredPerceptualEvidence.metricFidelity` declares each metric `measured`/`estimated`/`surrogate` with a method string (frustum exclusion and label crowding forced to `surrogate`); default ranking weights pinned to frozen `fitness-treatment-v1` manifest recorded in `DecisionProvenance.fitnessTreatmentId`; surrogate-honesty and treatment-manifest tests added. |
| RF-025 | P1-F / production integration | High | `SemanticTargetResolver` and `FocusContextController` exist and test in isolation, but repository search finds no production instantiation in `World`/input routing and live interactables are not populated with the new semantic metadata. | **Fixed in #421**: `InteractableRegistry.raycastSceneAll()` returns the full sorted/deduped hit list; `InputRouter.setSemanticTargeting()` installs the resolver + focus controller as an optional non-breaking layer on the per-frame picking path (resolver re-ranks existing hits with coercion + hysteresis; precision escape hatch preserved; legacy nearest-hit path retained when absent); structure-kind selection drives `FocusContextController.focusStructure` + `onFocusChange`; observations never advance focus; live interactables carry durable `semantic` metadata (data nodes = `observation`, `InPlaceOperationHandles` structure handles = `cluster-region`/`persistence-structure`/`mapper-node` with structureId + salience); `World` installs the layer and records Memory Palace navigation in the interaction log + autosave; durable `(currentLevel, focusedStructureId)` focus snapshot persisted/restored through `PresentationState.focus` + `WorldSessionController` (restore fails closed for impossible states). Regression tests exercise the real picking path, focus advance/no-op, legacy fallback, and the session round-trip. Remaining: capture physical XR semantic-target/focus-context task evidence (paired with the Quest 3S qualification blocker); the resolver `confidence` value is already labelled an uncalibrated selection-strength heuristic in code/docstrings. |
| RF-026 | P1-F / resolver & state correctness | Medium | Initial resolver logic substring-matched opaque structure IDs as task semantics, compared coercion against the first hit rather than nearest observation, and accepted impossible restored focus states. | **Fixed (RF-026 fix-forward)** with exact identity matching, nearest-observation coercion, input validation and fail-closed focus restoration. **Now wired onto the production path by RF-025 (#421)**, so the corrected classes are exercised by the real `InputRouter`/`World` picking path; retain as review-active until physical XR semantic-target/focus-context task evidence is captured. |
| RF-027 | P1-E / provenance & constraint semantics | High | #413 marks remediation provenance complete, but `ActionableNil` is not wired to `InvestigationAggregate`/`EvidenceLedger`/`.nemosyne`; constraint type is inferred by substring matching human-readable disqualification text; hardware bounds can be blindly doubled and described as safe. | **Fixed in this Stream B tranche**: typed `HardConstraintCode` emitted by `checkHardConstraints` and carried on `CandidateScore.disqualificationCode`/`HardConstraintTrace.code`; `diagnoseInvestigatorOutcome` routes remediation by typed code via `classifyHardConstraint` (no more substring matching); `RemedialAction.deviceFeasibility` separates scientific permissibility (`isSafeToRelax`) from measured device/runtime feasibility — hardware/frustum remediations stay scientifically safe but are flagged `deviceFeasibility: 'unverified'` with honest copy that no longer claims the doubled bound is device-safe; `buildRemediationProvenance` + `EvidenceLedger.recordRemediation` (new `'remediation'` `ResearchEventKind`) + `InvestigationAggregate.recordRemediation` persist remediation → old requirements → new requirements → resulting decision as durable replayable provenance in the `.nemosyne` event ledger; regression tests cover code routing, feasibility separation, and JSON replay round-trip. Remaining: wire the World/UX call site to `recordRemediation` when an investigator applies a remediation (paired with RF-025 production wiring). |

## Core architecture state

Nemosyne has exited the Draco-to-Moneta authority migration and is in private-preview preparation, subject to the review findings above. The governing architecture remains:

1. Rust/WASM owns canonical analytical data, N-dependent computation, analytical facts and data-derived layout/reduction.
2. Moneta owns bounded representation reasoning over compact evidence and investigator semantics.
3. TypeScript/JavaScript owns orchestration, persistence, presentation and interaction, not an independent analytical implementation.
4. Atlas owns investigation orchestration and durable analytical handles.
5. Draco is compatibility surface only. Production code imports Moneta directly.
6. `.nemosyne` preserves investigation, representation/model identity, analytical provenance, discoveries and NIL outcomes.
7. Learned Moneta remains explicit, pinned, reversible and opt-in until held-out investigator/discovery outcomes demonstrate benefit.

## What has landed

### Scientific and learning foundations

The #249-#264 sequence established immutable FitnessModel artefacts, explicit promotion/activation separation, frozen candidate feature evidence, pairwise judgement infrastructure, exact learned-model pinning, grouped held-out evaluation, durable row identity and stronger measurement/geometry contracts.

Remaining scientific work is outcome-facing: measurement-type enforcement, discovery-quality validation, calibrated statistical claims where appropriate, falsification workflows and investigator-facing skepticism support.

### Rust-owned data plane and scale architecture

The #305-#312 migration wave established Rust-resident columnar authority and removed the previous mirrored JS/Rust row-major model from the critical data path. Current scale invariants are:

- source row count is decoupled from rendered primitive count;
- Moneta candidate and sensitivity work is bounded;
- canonical Moneta reasoning does not traverse raw rows;
- no large-data failure may trigger an expensive JavaScript analytical fallback;
- analytical provenance must state any approximation or reduction mode.

Typed-column ingest, exact canonical identity, primitive-column storage and row-free DatasetStructureProfile evidence have been demonstrated. RF-007/RF-017 reopen the TDA/sparse point-access implementation because current paths copy data and ignore validity.

### Moneta authority convergence

The #315-#342 sequence completed the Draco-to-Moneta production authority migration:

- Rust owns analytical facts and canonical data-derived evidence;
- production Draco imports collapsed to Moneta;
- hard constraints precede learned ranking;
- row-order/rename/duplication/scale metamorphic and provenance contracts are live;
- production Atlas/Moneta facts consume validated Rust evidence;
- utility is not labelled confidence;
- clean-room replay verifies authoritative decision/evidence composition;
- learned ranking remains explicit and pinned.

The migration authority remains complete. Product embodiment, perceptual-evidence and remediation correctness are separately governed by active P1 review findings.

### Reproducibility and investigation provenance

The #324-#332 sequence substantially closed the portable provenance chain:

- analytical replay verifies operation provenance and output identity;
- representation/model identity survives embodiment and `.nemosyne` export/import;
- DiscoveryEpisode records persist portably;
- NIL/no-feasible-representation is a typed reproducible outcome;
- discovery/NIL/model/evidence drift fails closed during replay.

RF-027 makes clear that **remediation actions themselves** are not yet part of that durable provenance chain.

### Runtime ownership, ABI resilience and recovery

PRs #365-#366 established explicit World lifecycle ownership, generation-fenced recovery, RuntimeBridge ABI-family separation and focused coordinator/application boundaries.

The #375-#384 hardening wave then materially closed the available RES-01/SEC-02 code-executable gaps: tracked host-buffer ownership, exact two-call output contracts, stale-handle rejection, generation revocation, repeated recovery, unsafe-surface inventory and malformed-input campaigns.

Long-running fuzz/Miri/device endurance remain explicit evidence lanes rather than ordinary PR blockers.

### Collaboration resilience and authority

The #385-#389 sequence materially closed the available RES-02 browser/runtime gaps: bounded reconnect, multi-context WebRTC recovery, role-authority preservation, stale transport protection, deterministic offer ownership and server-owned peer lifecycle.

Cross-device/hostile-network qualification remains preview hardening.

### P1-A typed/columnar TDA implementation

#395 closed production JS TDA rematerialisation; #405 enabled typed/columnar-only handles to execute persistence, Mapper and Betti-0 directly in Rust with `ingestMode` provenance and real-WASM boundary tests.

That implementation is retained. Independent review found RF-007/RF-017, so the tranche is **IMPLEMENTATION LANDED / REVIEW ACTIVE**, not yet `VERIFIED COMPLETE`.

### P1-B async execution implementation

#408 established useful first-pass execution-port types, inline/worker transport modules, Atlas async entry points and mock transport fencing tests. Independent review found that the production interactive runtime still selects the inline port, real runtime generation is not wired into requests, worker dataset registration is incomplete, async operation output identity is wrong, and presentation consumers remain synchronous. P1-B is **IMPLEMENTATION LANDED / REVIEW ACTIVE**.

### P1-C through P1-F first-pass implementation

#410-#413 establish useful first-pass sparse-neighbourhood, perceptual-fitness, semantic-target/focus-context and actionable-NIL components. Stream B review found RF-017 through RF-027, so all four tranches remain **IMPLEMENTATION LANDED / REVIEW ACTIVE**. Their code is retained and fixed forward rather than reverted.

### Test architecture and feedback latency

The test pyramid is split by ownership:

```text
Playwright / WebXR smoke         small, expensive, user-path focused
TypeScript UI/integration        orchestration and presentation only
WASM boundary tests              small ABI/provenance seam
Rust unit/property/metamorphic   exhaustive analytical authority
```

Remaining efficiency work:

- [ ] reclassify mixed suites so only actual kernel boundaries pay WASM startup;
- [ ] port/delete remaining duplicate JS assertions for Rust-owned mathematics once equivalent Rust coverage is proven;
- [ ] add Rust-side performance benchmarks separately from deterministic correctness gates;
- [ ] document steady-state test/authority ownership in contributor and agent guidance;
- [ ] systematically audit source/architecture tests for vacuous or false-positive guards, following RF-004;
- [ ] distinguish mock/inline tests from real Worker/WASM/browser/device evidence in names and roadmap claims;
- [ ] require scale tests to exercise the real algorithm/mode being claimed, not a mock bridge that returns a shape-compatible result.

## Governing V3 gate status

| Gate | Status | Remaining exit work |
| --- | --- | --- |
| 0 — Authority reconciliation | **MIGRATION EXIT COMPLETE / REVIEW MONITORED** | Maintain architecture guards; remove Draco facade only through a governed compatibility decision. |
| 1 — Dataset Evidence | **MIGRATION AUTHORITY COMPLETE / SCIENCE ACTIVE** | Continue measurement semantics; close RF-007/RF-017 validity/borrowed-access semantics. |
| 2 — Representation Language | **PARTIAL / REVIEW ACTIVE** | Close RF-001/RF-002 and make current single-family candidates mathematically/spatially faithful before composition. |
| 3 — Moneta correctness | **MIGRATION EXIT COMPLETE / PRODUCT REVIEW ACTIVE** | Close embodiment RF-001/RF-002 plus perceptual evidence RF-022/RF-023/RF-024. |
| 4 — NIL | **PROVENANCE BASELINE COMPLETE / REMEDIATION REVIEW ACTIVE** | Close RF-027 durable remediation provenance/typed constraint semantics and modality-parity workflow. |
| 5 — Discovery | **INFRASTRUCTURE ADVANCED / SCIENCE PARTIAL** | Add falsification workflows, outcome evidence and controlled discovery-quality studies. |
| 6 — Human refinement | **IN PROGRESS** | Expand outcome events, curation policy and study coverage. |
| 7 — Learning infrastructure | **ADVANCED** | Add outcome-linked evaluation and operational monitoring evidence. |
| 8 — Learned Moneta | **EARLY OPT-IN / NOT EMPIRICALLY VALIDATED** | Demonstrate held-out investigator/discovery benefit before considering default use. |
| 9 — Compositional Moneta | **DEFERRED** | Wait for RepresentationGraph/grammar maturity, bounded search and Gate 0-8 evidence. |
| 10 — Adaptive Nemosyne | **DEFERRED** | Requires validated learning, freeze controls, monitoring, rollback and longitudinal evidence. |

## Pre-P1 promotion ledger

The detailed audit evidence remains in `PRE_P1_SYSTEMATIC_AUDIT.md`. The roadmap interpretation is:

- [ ] **PERF-04 / blocker:** run and govern physical Quest 3S 10M browser qualification.
- [x] **ARCH-01 / high:** Atlas/runtime/spatial ownership boundaries are explicit and guarded; Stream B audits implementation conformance continuously.
- [x] **ARCH-02 / high:** World/UI/kernel lifecycle ownership and recovery are explicit and idempotent.
- [x] **PERF-03 / high:** production scene selection uses measured BVH crossover behavior; physical crossover validation remains under PERF-04.
- [x] **UX-02 / high:** real-browser desktop investigation/replay/tamper journey is covered.
- [ ] **UX-03 / high:** execute controller, hand and desktop semantic-parity tasks on physical hardware.
- [x] **RES-01 / high, code-executable scope:** checked output, host allocation ownership, malformed handles and sustained generation recovery are covered. Device/endurance residuals remain evidence lanes.
- [x] **RES-02 / high, browser scope:** partition/reconnect/state convergence/role violation and server-owned lifecycle authority are covered through #389. Cross-device/hostile-network residuals remain preview hardening.
- [x] **SEC-02 / high, deterministic CI scope:** unsafe inventory plus bounded malformed parser/buffer/handle/exhaustion campaigns are covered. Long-running fuzz/Miri remain separate hardening lanes.
- [ ] **MAINT-01 / high:** continue removing `@ts-nocheck` from package, bridge, World and Moneta boundary tests.
- [ ] **PERF-05 / medium:** profile allocations/GC and sustained analytical scheduling across representative interactions.
- [ ] **UX-04 / medium:** expose command availability and disabled reasons in every input modality.
- [ ] **UX-05 / medium:** benchmark canvas-panel legibility/performance/accessibility against a maintained XR UI library.
- [ ] **UX-06 / medium:** fix the 390 px header collision and add reduced-motion, focus, contrast and local-font resilience without changing public visual identity.
- [ ] **MAINT-02 / medium:** replace weak generic assertions in blocker/high-path tests with exact contracts.
- [ ] **MAINT-05 / medium:** classify/reduce lint-warning debt and enforce a non-increasing budget.
- [ ] **MAINT-06 / medium:** eliminate Rust warning debt, governing fingerprint-affecting changes as provenance migrations.
- [ ] **DOC-03 / medium:** remove remaining investigator-facing Draco terminology while retaining the compatibility facade.

## P1 — Analytical responsiveness and spatial fitness

**ACTIVE.** Detailed analytical acceptance criteria and dependency order are in [`P1_ANALYTICAL_RESPONSIVENESS_AND_SPATIAL_FITNESS.md`](P1_ANALYTICAL_RESPONSIVENESS_AND_SPATIAL_FITNESS.md). PR #402's design records remain implementation specifications where review evidence has not invalidated them.

### P1-A Handle-native analytical boundary — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed implementation evidence:

- [x] tested handle-native TDA entry points and Atlas routing;
- [x] no production JS `Dataset.toJSON()` TDA round trip;
- [x] typed/columnar-only handles execute persistence, Mapper and Betti-0 through real WASM;
- [x] typed-vs-row ingest mode is recorded in provenance.

Review exit work:

- [ ] **RF-007/RF-017 correctness:** honor primitive validity so missing/invalid feature values cannot become numeric zero — **governed design decision pending (skip vs mask; changes TDA outputs + row-path `unwrap_or(0.0)` parity contract)**;
- [x] **RF-007/RF-017 scale (FeatureSpace half):** `FeatureSpace::from_columnar` borrows primitive buffers via the shared `point_access` substrate (no throwaway per-column clone; transpose from borrows; byte-identical output);
- [ ] **RF-007/RF-017 scale (PointCloud half):** replace `PointCloud` owned column-major storage with a borrowed, lifetime-parameterised accessor (ripples to neighbourhood algorithm consumers);
- [x] add Rust invalid-feature + cross-substrate parity + peak-memory/invariant contract tests;
- [ ] re-run adversarial review before `VERIFIED COMPLETE`.

## P1 — Product convergence gates

### P1-R Representation embodiment convergence — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed first-pass work includes distinct aggregate/density/cluster geometry, bounded visible primitive counts, executable single-winner graph metadata, and RF-003/RF-004 fixes.

Review exit work:

- [ ] **RF-001:** move N-dependent aggregate, density, cluster and compatible reduction/layout into Rust-owned bounded semantic payloads;
- [ ] make Three.js a thin embodiment adapter over those payloads rather than an analytical reducer over rows;
- [ ] **RF-002:** re-audit candidate `supports`/`preserves`/`loses` and descriptions against actual mathematics;
- [ ] implement or honestly downgrade overclaimed density/distribution/cluster/manifold/multiscale candidates;
- [ ] record exact reduction/estimation/layout method and parameters in provenance;
- [ ] demonstrate mathematically faithful, visibly/interactively distinct alternatives before P1-D ranking is product-valid.

### P1-U Whole-product investigation UX convergence — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed first-pass work includes the 10-phase journey model, coordinator, task-surface policy, TechnoCore state model, and integration coverage.

Review exit work:

- [ ] **RF-005:** reduce/demote the persistent dashboard constellation and implement actual selection-anchored contextual controls;
- [ ] **RF-006:** make TechnoCore a real input/analysis control and give IceVault a real archive/recovery role or remove it;
- [ ] derive journey state from real product events with meaningful prerequisites;
- [ ] **RF-008:** drive the real desktop UI in Playwright and validate core tasks on Quest 3S controllers/hand tracking;
- [ ] collect task-level comprehension/discoverability/recovery/falsification/finding/share evidence before verification.

### P1-B Asynchronous analytical runtime — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed first-pass work includes typed request/result contracts, inline/Worker transports, Atlas async entry points, supersession tests and RF-012 plus partial RF-013/RF-015 fixes.

Review exit work:

- [x] **RF-010:** install and retain `WorkerAnalyticalPort` on the real interactive browser/XR runtime path (`src/vr/World.ts`, `src/atlas/AtlasCore.ts`);
- [x] **RF-011:** thread the real runtime generation into every request and supersession fence (`src/atlas/AtlasCore.ts`, `tests/atlas-async-execution.test.ts`);
- [x] **RF-013:** implement one-time fingerprint-keyed worker registration and generational handle clearing (`src/atlas/ports/analytical.worker.ts`);
- [x] **RF-014:** return/verify the true output fingerprint for async operations and record it in result/ledger provenance (`src/atlas/ports/analytical.worker.ts`, `src/atlas/AtlasCore.ts`);
- [x] **RF-016:** route `TDAPlanes`, `DataOperationController` and other interactive consumers through the async methods (`src/vr/artifacts/TDAPlanes.ts`, `src/vr/coordinators/DataOperationController.ts`);
- [ ] **RF-015:** add a real module-Worker + real-WASM integration/browser test covering TDA, mutation supersession and recovery across at least two runtime generations;
- [ ] record dispatch/transfer/compute measurements before proposing SharedArrayBuffer, WASM threads or SIMD;
- [ ] re-run adversarial concurrency/recovery review before marking P1-B `VERIFIED COMPLETE`.

### P1-C Sparse topology scalability — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed first-pass work:

- [x] introduce `RaggedNeighbourhood`, exact and grid-sparse neighbourhood implementations;
- [x] reuse the substrate in persistence/Betti-0 and compatible clustering paths;
- [x] introduce explicit neighbourhood metadata/mode types;
- [x] emit persistence merge deaths in the new H0 implementation.

Review exit work:

- [ ] **RF-017:** consume the shared validity-aware borrowed columnar accessor rather than duplicate/copy point storage;
- [ ] **RF-018 blocker:** make high-dimensional sparse neighbour search sound or fail closed to a governed supported mode;
- [ ] **RF-019:** route Mapper through the shared sparse-neighbourhood substrate or narrow the claim;
- [ ] **RF-020:** make Betti-0 a true incremental edge-sorted union sweep and remove/replace the all-pairs max-distance prepass;
- [ ] **RF-021:** implement Landmark mode before advertising it, or remove/reclassify it; add real Rust/WASM exact-vs-sparse stability tests and recorded end-to-end benchmarks;
- [ ] review persistence-death semantics/provenance as a fingerprint-affecting analytical migration;
- [ ] re-run adversarial topology review before verification.

### P1-D 3D-native Moneta perceptual fitness — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed first-pass work:

- [x] add versioned perceptual evidence types and bootstrap perceptual component;
- [x] sample a bounded multi-pose viewpoint envelope;
- [x] feed measured/prior perceptual evidence into hard constraints and bootstrap utility;
- [x] **RF-022 fix-forward:** correct camera-relative projection, true median depth, deterministic order-invariant bounded mark sampling and zero-mark handling;
- [x] strengthen finite/range/viewpoint validation for perceptual evidence.

Review exit work:

- [x] **RF-023:** reject perceptual evidence whose dataset fingerprint/candidate/version is not authoritative for the current decision before hard constraints/ranking;
- [x] **RF-024 semantics:** rename current hidden/crowding surrogates (`frustumExclusionFraction`, `labelCrowdingIndex`) and add `metricFidelity` so surrogates are honestly labelled;
- [x] **RF-024 study governance:** pin default ranking weights to frozen `fitness-treatment-v1` and record it in `DecisionProvenance.fitnessTreatmentId`;
- [ ] validate measured evidence on actual reviewed-faithful P1-R embodiments and target hardware;
- [ ] preserve the distinction between selection heuristics, engineering priors, measured evidence and calibrated statistical confidence;
- [ ] re-run adversarial perceptual/scientific review before verification.

### P1-E Actionable NIL/ambiguity — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed first-pass work:

- [x] expose `DECISIVE`, `INFEASIBLE`, `UNDERDETERMINED` and `AMBIGUOUS` outcomes;
- [x] expose readable explanations, near misses and blocking descriptions;
- [x] generate first-pass remediation proposals and reject automatic mutation of explicitly critical information-loss requirements.

Review exit work:

- [x] **RF-027:** replace human-message substring parsing with typed machine-readable `HardConstraintCode`s;
- [x] persist remediation action, previous requirements, resulting requirements and subsequent decision into `InvestigationAggregate`/`EvidenceLedger` via a `'remediation'` `ResearchEventKind` (durable `.nemosyne` replay provenance);
- [x] distinguish scientific permissibility (`isSafeToRelax`) from measured device/runtime feasibility (`deviceFeasibility`) for hardware/performance remediation;
- [ ] replace “select either safely” language with explicit feasibility/tradeoff language;
- [x] add replay tests proving remediation provenance survives JSON export/import round-trip;
- [ ] expose the actionable NIL flow through actual investigator UI/modalities (wire World call site to `recordRemediation`) before verification.

### P1-F Semantic targeting and Memory Palace focus+context — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed first-pass work:

- [x] add semantic target metadata types, resolver and five-level focus/context controller;
- [x] provide isolated hysteresis/coercion/focus persistence tests;
- [x] **RF-026 fix-forward:** validate resolver inputs/weights, compare coercion with nearest observation, stop substring-matching opaque structure IDs, and reject impossible restored focus state.

Review exit work:

- [x] **RF-025:** instantiate the resolver in the real World/input path and route desktop/ray/hand target selection through it;
- [x] populate live `InteractableRegistry` entries with durable semantic metadata from authoritative analytical/embodiment structures;
- [x] connect focus/context changes to Memory Palace navigation and durable session state rather than isolated controller calls;
- [x] preserve precision escape hatches and hysteresis on the actual device input path;
- [x] replace or explicitly label the resolver `confidence` value as an uncalibrated selection-strength heuristic in investigator-facing surfaces;
- [ ] add desktop Playwright and physical XR semantic-target/focus-context task evidence;
- [ ] re-run adversarial UX/input review before verification.

## P1 — Minimal private preview

Deliver a controlled, observable deployment suitable for investigator research/usability testing rather than broad public launch.

- [ ] define supported browsers/headsets and a small tested hardware matrix;
- [ ] deploy reproducible versioned frontend/WASM artifacts;
- [ ] add authentication/access control for a private cohort;
- [ ] define dataset retention/upload/deletion/privacy policy;
- [ ] add explicit consent/telemetry controls;
- [ ] establish dataset-safe crash/error/performance telemetry;
- [ ] add health checks, rollback and release provenance;
- [ ] validate `.nemosyne` compatibility across preview releases;
- [ ] implement onboarding, sample investigations and unsupported-feature states;
- [ ] run a small investigator cohort and feed structured evidence into the roadmap.

**Promotion rule:** private preview may not be promoted while any blocker/high review finding that undermines scientific correctness, analytical authority, core task completion or target-device safety remains open.

## P1 — Security and reliability hardening

- [ ] re-run threat review against the deployed preview boundary;
- [ ] validate untrusted dataset/archive limits, traversal defences and resource budgets;
- [ ] harden CSP, supply-chain controls and release integrity;
- [ ] ensure kernel failure cannot silently produce plausible-looking substitute results;
- [ ] add backup/export/recovery procedures for user-created investigations;
- [ ] establish preview vulnerability/update policy;
- [ ] run deeper fuzz/Miri/device-endurance campaigns outside the ordinary PR critical path.

## P1 — VR/UI/UX fitness

The frozen panel/intent-wheel treatment work is merged through #394. Gate F review for that controlled local treatment is complete; Quest 3S validation remains required. P1-U and Stream B own the whole-product convergence claim.

- [x] spatial-audit + hypothesis + Blender prototype comparison for panel arrangement completed as a recorded decision (`docs/decisions/VR_PANEL_SPATIAL_LAYOUT.md`, evidence tier 4);
- [x] role-aware depth-tier zoning implemented as panel default positions with invariant tests;
- [x] persistent panels consolidated onto the torso/body reference frame; head/camera lock reserved for transient alerts;
- [x] production HandWheel converged onto the task/intent taxonomy with a separate superuser annex;
- [x] novice command vocabulary includes Move, Undo/Redo and Return-to-Overview;
- [x] HolographicInspector and FrustrationResponseManager moved off the retired rig frame;
- [x] frozen panel-layout + intent-wheel treatment recorded in `docs/study/UI_TREATMENT.md`;
- [ ] close RF-005/RF-006/RF-008 and the P1-U review checklists; RF-025 closed (#421), RF-026 review-active pending physical XR evidence;
- [ ] validate comfortable locomotion, scale legibility, reach, occlusion, focus and spatial hierarchy on target headsets;
- [ ] keep desktop/2D interaction semantically equivalent where possible;
- [ ] improve progressive disclosure, gesture discoverability and error recovery;
- [ ] validate frame-time, draw-call, memory, analytical scheduling and interaction budgets with representative investigations;
- [ ] use Blender-assisted asset/UI work only where it materially improves spatial comprehension;
- [ ] conduct task-based investigator studies and preserve decisions/evidence reproducibly.

## P1 — Investigation and discovery science

- [ ] complete hypothesis -> test -> support/refute/inconclusive workflows;
- [ ] add explicit falsification operations and alternative-representation checks;
- [ ] connect findings to exact analytical evidence and representation context;
- [ ] capture discovery outcomes suitable for held-out evaluation;
- [ ] evaluate whether Moneta improves discovery quality, time-to-insight, error rate and reproducibility versus baselines;
- [ ] support shareable `.nemosyne` investigations as reproducible Memory Palace graphs.

## Scientific validity programme

### Measurement semantics and statistics

- [ ] complete scale/measurement-type coverage beyond storage types;
- [ ] enforce appropriate geometry for compositional, circular, grouped/repeated and other non-Euclidean structures;
- [ ] distinguish descriptive statistics, inferential uncertainty and model utility;
- [ ] introduce calibration/coverage claims only when backed by an explicit statistical procedure;
- [ ] add multiple-comparison/selection-pressure controls where required;
- [ ] expand Rust property/metamorphic tests for statistical and measurement invariants.

### Pattern fragility / apophenia pressure

Treat this as evidence about a claim/analysis, never a psychological score for an investigator.

- [ ] define a versioned pattern-fragility evidence contract;
- [ ] include representation dependence, degrees of freedom, selection opportunity, perturbation instability, subgroup sparsity, null-model plausibility and independent corroboration;
- [ ] attach concrete falsification actions to elevated dimensions;
- [ ] persist evidence and performed checks in Investigation/Discovery provenance;
- [ ] keep it advisory until controlled studies show improved investigator calibration/discovery quality;
- [ ] never convert heuristic pattern pressure into probability/confidence without empirical calibration.

## P2 — RepresentationGraph and compositional Moneta

**DEFERRED until P1 foundations and stated prerequisites are met.** P1-R may make the current single-winner graph primitive executable as an embodiment contract, but must not introduce open-ended composition/search ahead of this gate.

- [ ] represent existing single-family outputs as canonical simple graphs first;
- [ ] finalise primitive registry, graph schema, grammar and canonical serialisation;
- [ ] define bounded composition search and pruning budgets;
- [ ] preserve information-loss and hard-constraint reasoning through composition;
- [ ] make the spatial runtime a pure graph embodiment adapter;
- [ ] add deterministic replay/provenance for composed representations;
- [ ] only then evaluate learned composition ranking.

## P3 — Adaptive Nemosyne

**DEFERRED until learning has outcome evidence and operational governance.**

- [ ] freeze exact model/ontology/NIL/perception versions in study state;
- [ ] add monitoring, rollback and user-visible adaptation controls;
- [ ] separate investigator preference adaptation from scientific evidence authority;
- [ ] run controlled longitudinal studies before autonomous adaptation.

## Dependency and platform modernisation

The consolidated dependency update landed in #358. Future updates are evidence-led maintenance rather than a standing migration wave.

- [ ] modernise Rust scientific/data libraries with numerical, provenance, determinism and WASM parity evidence;
- [ ] replace hand-rolled infrastructure only where a maintained library improves fitness without weakening Nemosyne semantics;
- [ ] migrate ESLint/TypeScript majors deliberately;
- [ ] treat Three.js/WebXR upgrades as dedicated runtime migrations with headset/performance validation.

## Fixed design boundaries

- **Rust owns N-dependent work.** Parsing, storage, filtering, statistics, clustering, topology, spectral analysis, evidence construction, data-derived layout and large-data reduction remain Rust/WASM responsibilities.
- **Atlas owns durable analytical capabilities.** Reuse canonical handles instead of serialising the same dataset back into Rust.
- **Moneta is a bounded control plane.** It reasons over compact evidence and semantics, never raw full-dataset traversal.
- **Semantic representation must survive embodiment.** A non-point Moneta candidate may not silently degrade into point-per-row geometry or a mathematically different visual approximation without explicit semantics/provenance.
- **Observations are detail, not universal geometry.** Aggregate, density, cluster, field, topology and other structure-level representations are first-class; observations appear when analytically/interactively appropriate.
- **JS presents, orchestrates and schedules.** It must not reconstruct a shadow analytical authority.
- **Tests live with authority.** Exhaustive mathematics belongs beside Rust-owned behavior; higher layers verify seams, presentation and interaction.
- **Boundary tests remain mandatory.** Rust-first testing does not replace WASM ABI, browser, WebXR or end-to-end verification.
- **Source rows are not render primitives or analytical reduction inputs.** LOD/reduction is first-class architecture, and render-object growth must be governed independently of source N.
- **Worker handles are local capabilities.** Cross-thread identity travels by fingerprint plus explicit registration, never foreign handles.
- **Sparse means sound before fast.** An approximate or sparse neighbourhood may only omit edges/points when the approximation contract explicitly permits it and provenance records the mode; optimization must never silently change mathematical meaning.
- **Perceptual evidence is identity-bound.** Measured evidence must correspond to the current dataset, candidate/embodiment, model version and governed viewpoint/device context before it can affect ranking or hard constraints.
- **The world is an interface, not scenery.** Persistent spatial objects must have a clear investigator function or be removed/demoted.
- **Approximation is evidence.** Sparse/landmark/approximate modes must be explicit in provenance.
- **Bootstrap is the safe Moneta default.** Learned ranking remains exact, pinned and explicit.
- **Hard constraints precede learning.** Learning cannot resurrect an infeasible candidate.
- **Learning never owns research facts.** Learned features consume Rust-derived evidence.
- **Skepticism targets claims, not people.** Pattern-fragility signals must be explainable and actionable.
- **Review can reopen completion.** A green suite or merged PR is implementation evidence, not immunity from adversarial review.
- **No Gate 9/10 leapfrogging.** Composition/adaptation cannot substitute for correctness, reproducibility, spatial fitness or outcome evidence.

## Verification cadence

For each PR, use the cheapest authoritative layer that proves the claim. Stream B additionally asks what evidence would falsify the completion claim and adds that evidence where practical. Before private-preview promotion, run the broad checkpoint:

```text
cargo test / Rust property tests
focused JS/WASM boundary tests
TypeScript typecheck + lint
fast Node + focused UI + integration + explicit WASM suites
architecture/import/row-materialisation authority gates
portable investigation replay/tamper tests
coverage assurance
production build
browser/WebXR product-path smoke
real Worker/WASM integration for async analytical paths
real sparse-mode exact-vs-approximation parity/stability tests
scale benchmarks measuring the complete algorithm and peak memory
physical Quest qualification for promotion-critical device claims
independent review pass over the resulting merged implementation
```

## Near-term execution order by stream

### Stream A — forward implementation

1. Continue **minimal-private-preview, security/reliability, investigation/discovery-science and measurement-semantics work** where unresolved RF findings are not dependencies.
2. Consume Stream B’s P1-C/P1-D/P1-E/P1-F fixes as they land; do not build new work on known-invalid high-D sparse, stale perceptual-evidence or unpersisted remediation assumptions.
3. Continue bounded maintenance/dependency work that does not distract from promotion blockers.
4. Do not begin P2 RepresentationGraph composition or P3 adaptation until the stated reviewed prerequisites are satisfied.

### Stream B — review and fix-forward

1. ~~Land the current **RF-022/RF-026** P1-D/P1-F correctness hardening and retain regression tests.~~ ✅ (#416)
2. ~~Close **RF-018/RF-019/RF-020/RF-021** so P1-C’s sparse mathematics, complexity and evidence match its design claims, coordinated with **RF-007/RF-017** shared validity-aware point access.~~ ✅ (#418; RF-007 scale/shared-substrate half landed in #423 — validity-honoring half governed pending)
3. ~~Close **RF-023/RF-024** so perceptual evidence is identity-bound, semantically honest and study-governed.~~ ✅ (this tranche)
4. ~~Close **RF-027** so actionable NIL remediation is typed, durable, replayable and operationally safe.~~ ✅ (this tranche; World call-site wiring paired with RF-025)
5. ~~Close **RF-025** by wiring P1-F into the actual World/input/Memory-Palace path.~~ ✅ (#421; physical XR task evidence + Quest 3S qualification remain)
6. Continue unresolved **P1-B RF-010/RF-011/RF-013/RF-014/RF-015/RF-016**, **P1-R RF-001/RF-002**, and **P1-U RF-005/RF-006/RF-008** work in parallel where changes do not conflict.
7. Review each new Stream A merge immediately and append/fix RF findings in the same cadence.

### Convergence / promotion

- Run PERF-04 and UX-03 physical Quest qualification on the converged treatment as soon as hardware is available.
- Re-run blocker/high security, architecture, scientific and UX review before private-preview promotion.
- Continue discovery/outcome studies and learned-Moneta empirical validation.
- Begin RepresentationGraph/compositional Moneta only after P1 prerequisites are both implemented and review-verified.
- Begin Adaptive Nemosyne only after evidence and governance prerequisites are satisfied.
# Nemosyne Roadmap & Implementation Status

> **Current implementation-status authority.** Product and research direction are governed by `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` V3. This document records the current implementation state, critical-path work and planned post-migration programme. `docs/MONETA_MIGRATION_COMPLETION_SPRINT.md` is the executable exit ledger for the Draco to Moneta migration.

## Status snapshot - 24 August 2026

**Current `main`: `2423a99` (includes #358).**

**Active implementation:** `perf/quest-10m-boundary`. Dependency maintenance landed in #358. The current branch adds an explicit physical-Quest-browser probe for the real 10M typed-column Rust/WASM boundary, separate from the existing 250K render/LOD staircase. It records incremental synthetic-fixture construction, host copy, Rust ingest, exact fingerprint, authoritative structure profile, borrowed scans, WASM retention, XR frame gaps and visibility without JavaScript row rematerialisation. The local gate is green: typecheck; lint with zero errors; coverage at 80.76/69.61/78.10/83.24 across 1,898 tests; production build; 170 Rust tests; the focused real-WASM ABI test; and real-Chromium smoke. Physical execution is deferred until a Quest 3S is available. A completed measurement remains `deviceQualifiedAt10m: false` and cannot reopen P1 until the project-owner-selected audits are also complete.

Nemosyne has moved from experimental architecture repair into migration-exit and productization preparation. The core analytical direction is now stable:

1. Rust/WASM owns analytical facts, scale-sensitive computation and data-derived layout computation.
2. Moneta owns bounded representation reasoning over compact evidence and investigator semantics.
3. TypeScript/JavaScript owns orchestration, persistence, presentation and UI, not an independent analytical implementation.
4. Draco is compatibility surface only. Production code imports Moneta directly.
5. Investigation state is reproducible and portable through `.nemosyne`, including analytical provenance, representation/model identity, discoveries and NIL outcomes.
6. Learned Moneta remains explicit, pinned, reversible and opt-in. Infrastructure readiness is not evidence of empirical superiority.

The Draco-to-Moneta authority migration exit conditions are proven. A post-exit performance audit found that this does not yet establish practical 10M end-to-end performance. Typed-column ingest, exact canonical identity and borrowed scans work at 10M, and the columnar-native Rust `DatasetStructureProfile` closes the row-free evidence-path discontinuity. The current branch materially reduces and repeatedly reproduces the fingerprint/evidence envelope while making bounded spectral and clustering estimators provenance-explicit. Physical Meta Quest 3S browser qualification remains blocking before the critical path reopens at **P1 Minimal private preview**. Broader scientific validation, security/reliability hardening and VR/UI/UX outcome work remain active programmes.

## What has landed

### A. Scientific and learning foundations

Merged work through #249-#264 established:

- immutable FitnessModel artifacts and a promotion gate separated from activation;
- frozen Moneta candidate feature snapshots and transactional joins to human pairwise judgement;
- learned re-ranking only after bootstrap candidate generation and hard-constraint filtering;
- exact learned artifact pinning and fail-closed registry/model drift;
- study/runtime model provenance;
- explicit learned-runtime opt-in while bootstrap remains the default;
- group-balanced held-out comparison, distributed group-win evidence and leave-one-group-out robustness;
- durable row-identity foundations;
- typed measurement semantics, geometry/evidence contracts and stronger statistical foundations.

**Remaining scientific work:** held-out discovery-outcome validation, calibrated statistical claims where appropriate, stronger measurement-type enforcement across all analyses, and investigator-facing skepticism/falsification support.

### B. Rust-owned data plane and large-data architecture

The #305-#312 migration wave established the Rust-owned columnar direction and removed the previous mirrored row-major authority model from the critical data path. The architecture now targets Rust-resident columnar storage with JS borrowing typed views or compact evidence rather than synchronising duplicate authoritative row stores.

Evidence collected during this wave includes approximately 255x faster 1M-row ingest and roughly 19x lower WASM memory growth versus the prior JSON-row path. The migration checkpoint reran the real Rust/WASM columnar capacity workflow against `0a9afb3`: 10M tall, 1M wide and 1M high-cardinality scenarios completed with checksum-stable reloads. The Rust/JS boundary envelope adds 10K/100K/1M/10M scaling, host-copy time, canonical fingerprint time and authoritative-evidence transfer. Initial local and hosted checkpoints returned `COLUMNAR_CAPACITY_ONLY`. The columnar-native follow-up now transfers a row-free 2,689-byte profile at 10M, but the local Apple M1 Pro baseline spends 10.7 seconds fingerprinting and 3.2 seconds generating evidence, with retained WASM memory reaching approximately 1.25 GB. This is not a Meta Quest 3S proxy; provisioned repetition and physical-device browser profiling remain required. See `docs/RUST_JS_BOUNDARY_ENVELOPE.md`.

Current scale invariants:

- source row count is decoupled from rendered primitive count;
- Moneta candidate and sensitivity work is explicitly bounded;
- canonical Moneta modules may not traverse raw rows or import `Dataset` as an analytical dependency;
- no large-data failure may silently trigger an expensive JS analytical fallback.

### C. Moneta authority convergence

The migration-completion wave materially changed and then closed the authority boundary:

- **#315:** data-derived layouts became Rust/WASM-authoritative and fail closed when the kernel layout result is unavailable.
- **#316:** Draco production imports collapsed to Moneta; `src/draco/**` became compatibility-only and an architecture gate prevents production reintroduction.
- **#317:** scoring ownership invariants lock bootstrap hard constraints ahead of learned ranking and prevent fallback on invalid learned provenance.
- **#318:** metamorphic/provenance contracts cover row-order invariance, semantic column renaming, duplication/scale policy and exact operation provenance.
- **#319:** ordinary layout tests moved off Draco compatibility and duplicate JS numerical layout assertions were reduced in favour of Rust authority tests.
- **#333-#338:** reconciled the exit plan, collapsed legacy mirrors and duplicate scoring, made DatasetEvidence reconstruct analytical signatures, derived representation identity from Rust evidence and cut production Atlas/Moneta facts over to validated Rust structure profiles.
- **#340:** removed utility-as-confidence terminology and reduced Draco to one documented compatibility facade.
- **#341:** proved the authoritative Rust-evidence-to-clean-room-replay composition path.
- **#342:** proved bounded Moneta work at 10K, 100K, 1M and 10M rows without JavaScript row rematerialisation.

The final checkpoint adds successful current-main capacity characterization, production-browser WASM loading/rendering and presentation-only-to-authoritative lifecycle proof. No independent Draco solver, scorer, layout or analytical fact path remains.

### D. Test architecture and CI feedback latency

The test runner has been split by actual architectural ownership:

- **#320:** introduced a fast Node lane for pure TypeScript/contract tests.
- **#322:** separated focused jsdom UI tests from real-WASM integration.
- **#323:** made real-WASM suites explicit rather than allowing ambient WASM startup in ordinary jsdom tests.

Current intended pyramid:

```text
Playwright / WebXR smoke         small, expensive, user-path focused
TypeScript UI/integration        orchestration and presentation only
WASM boundary tests              small ABI/provenance seam
Rust unit/property/metamorphic   exhaustive analytical authority
```

Remaining test work:

- measure post-split CI wall-clock improvement against the pre-split baseline;
- centralize the duplicated real-WASM test allowlist so config cannot drift;
- audit the enlarged WASM allowlist and split mixed presentation/kernel suites where practical;
- continue deleting or migrating duplicate JS assertions for Rust-owned mathematics;
- preserve browser/WebXR and cross-language boundary tests rather than rewriting them in Rust.

### E. Reproducibility and portable investigation provenance

The #324-#332 sequence closed most of the investigation provenance chain:

- analytical replay compares operation provenance and output identity;
- learned model version and immutable artifact hash survive Moneta decision embodiment;
- learned artifact identity participates in the canonical investigation digest;
- `.nemosyne` persists the representation decision and model identity;
- DiscoveryEpisode records persist portably;
- NIL/no-feasible-representation is a typed reproducible outcome rather than a fabricated recommendation;
- discovery and NIL records are restored and cross-verified during clean-room replay;
- replay fails closed on model-artifact, decision-evidence or provenance drift.

For the migration contract, representation/model/NIL/discovery provenance continuity is now substantially complete. Broader discovery science and NIL modality work remain separate product/research concerns.

## Governing V3 gate status

| Gate                         | Status                                              | Current evidence                                                                                                                                                  | Remaining exit work                                                                                             |
| ---------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 0 - Authority reconciliation | **MIGRATION EXIT COMPLETE**                         | Draco is one compatibility facade; production imports Moneta; Rust-owned layouts, facts and boundary guards are live.                                             | Maintain the architecture guards; remove the facade only through a separately governed compatibility decision.  |
| 1 - Dataset Evidence         | **MIGRATION AUTHORITY COMPLETE / SCIENCE ACTIVE**   | Production Moneta consumes validated Rust-owned DatasetEvidence; compact-transfer and current-main capacity evidence are recorded.                                | Continue measurement-semantics and scientific-evidence maturity work beyond the migration.                      |
| 2 - Representation Language  | **PARTIAL**                                         | Representation contracts, candidate families, graph concepts and runtime embodiment exist.                                                                        | Mature canonical RepresentationGraph/grammar before compositional search.                                       |
| 3 - Moneta correctness       | **MIGRATION EXIT COMPLETE**                         | Hard constraints, bounded ranking, abstention, decision margin, sensitivity, learned pinning, metamorphic contracts and authoritative end-to-end replay are live. | Extend outcome validation and representation-language maturity without weakening the proven authority boundary. |
| 4 - NIL                      | **MIGRATION PROVENANCE COMPLETE / PRODUCT PARTIAL** | Typed NIL provenance persists through session/package/replay.                                                                                                     | Complete semantic modality parity, UX and investigator workflows.                                               |
| 5 - Discovery                | **INFRASTRUCTURE ADVANCED / SCIENCE PARTIAL**       | DiscoveryEpisode lifecycle, persistence and replay verification exist.                                                                                            | Add falsification workflows, outcome evidence and controlled discovery-quality studies.                         |
| 6 - Human refinement         | **IN PROGRESS**                                     | Pairwise judgement plus exact candidate feature evidence exists.                                                                                                  | Expand outcome events, curation policy and study coverage.                                                      |
| 7 - Learning infrastructure  | **ADVANCED**                                        | Registry, promotion policy, pinning, rollback and robust grouped evaluation exist.                                                                                | Add outcome-linked evaluation and operational monitoring evidence.                                              |
| 8 - Learned Moneta           | **EARLY OPT-IN, NOT EMPIRICALLY VALIDATED**         | Pinned learned re-ranking is available without replacing bootstrap constraints.                                                                                   | Demonstrate held-out benefit on investigator/discovery outcomes before discussing default use.                  |
| 9 - Compositional Moneta     | **DEFERRED**                                        | Preconditions partly exist.                                                                                                                                       | Wait for RepresentationGraph/grammar maturity, bounded search and Gate 0-8 evidence.                            |
| 10 - Adaptive Nemosyne       | **DEFERRED**                                        | Governance foundations exist.                                                                                                                                     | Requires validated learning, freeze controls, monitoring, rollback and longitudinal evidence.                   |

## Critical path: finish the Draco to Moneta migration

### P0.1 - Reconcile and collapse legacy compatibility

- [x] Restrict Draco to compatibility aliases/re-exports.
- [x] Eliminate production imports from `src/draco/**`.
- [x] Complete production import/call-site inventory.
- [x] Classify every remaining Draco compatibility file as required public alias or obsolete.
- [x] Delete obsolete aliases/files with no live compatibility consumer.
- [x] Document the intentionally retained public compatibility surface and removal conditions.
- [x] Keep architecture tests preventing any independent Draco solver/scorer/layout authority.

**Exit:** `src/draco/**` contains only deliberately retained compatibility exports, with no hidden implementation authority.

### P0.2 - Scientific terminology and authority audit

- [x] Replace investigator-facing uses of uncalibrated `confidence` that actually mean model utility or ranking score.
- [x] Preserve compatibility fields only where required and mark them deprecated.
- [x] Distinguish utility score, decision margin, uncertainty evidence and genuinely calibrated confidence.
- [x] Audit every research-relevant fact entering Moneta and record its Rust/WASM evidence source.
- [x] Fail explicitly for unsupported fact types rather than reconstructing them heuristically in JS.
- [x] Confirm bootstrap and learned scoring/ranking semantics have a single production authority.

**Exit:** no UI or persisted scientific claim implies calibration that the model does not provide; no research fact has a shadow JS authority.

### P0.3 - Final end-to-end migration proof

**Complete in #341 and the migration checkpoint.** The executable composition proof starts from a real Rust structure profile, derives DatasetEvidence and the Moneta decision, embodies the SpatialStrategy, persists discovery and Investigation state, exports `.nemosyne` and verifies clean-room replay. The checkpoint additionally proves that a presentation-only pre-kernel World is replaced by an authoritative decision after real WASM readiness.

Create representative executable tests covering multiple topology/data families through:

```text
Rust/WASM data + evidence
        -> Moneta bounded reasoning
        -> RepresentationDecision or NIL
        -> SpatialStrategy/runtime embodiment
        -> Discovery/Investigation state
        -> .nemosyne export
        -> clean-room replay
```

Prove:

- deterministic decision/provenance identity;
- no production Draco authority path;
- hard constraints remain authoritative before learned ranking;
- model artifact drift fails closed;
- unsupported analytical evidence fails explicitly;
- replay reconstructs the same canonical investigation identity.

### P0.4 - Large-dataset migration validation

**Authority/evidence path complete; physical-device qualification blocked.** #342 proves bounded Moneta candidate/sensitivity work, the capacity artifact proves resident typed-column operation at 10M, #356 bounds and repeatedly reproduces the row-free authoritative DatasetStructureProfile envelope, and #357 provides evidence-grade WebXR render/LOD telemetry. The active 10M boundary branch adds the missing physical-browser execution path; an actual physical Quest 3S run remains required.

Run deterministic tiers at **10K, 100K, 1M and 10M rows**, measuring:

- ingest time;
- Rust evidence-generation time;
- Rust-to-JS transfer bytes;
- number of dataset materialisations;
- JS row-object reconstruction count;
- Moneta reasoning latency and candidate/sensitivity counts;
- WASM and browser memory growth;
- reduction/LOD output size;
- renderable primitive budget and WebXR frame behaviour where applicable.

Required invariants:

- Moneta latency is bounded independently of source cardinality after evidence generation;
- no full-data JS rematerialisation is needed for normal representation reasoning;
- no N-dependent Moneta JS loop appears;
- visual reduction prevents source cardinality from directly becoming draw/primitive cardinality;
- failures remain explicit rather than falling back to expensive JS computation.

### P0.5 - Migration exit declaration

After P0.1-P0.4:

- [x] reconcile `docs/MONETA_MIGRATION_COMPLETION_SPRINT.md` to evidence on `main`;
- [x] run full relevant CI, architecture gates and coverage assurance;
- [x] run representative production-browser/WebXR-entry smoke;
- [x] sweep unresolved blocker-class review findings;
- [x] mark the migration complete only if every exit invariant is proven.

### Post-exit blocker - 10M Rust/JS evidence boundary

- [x] Measure typed payload build, host copy, Rust ingest, borrowed scans, identity and WASM memory from 10K through 10M.
- [x] Verify checksum/fingerprint-stable destroy and reload at 10M.
- [x] Verify the current columnar evidence request fails closed with zero row materialisations.
- [x] Implement columnar-native Rust DatasetStructureProfile generation with row-backed parity and zero compatibility materialisations.
- [x] Measure local 1M/10M evidence-generation latency and compact Rust-to-JS transfer bytes.
- [x] Bound full-series fingerprint/spectral evidence latency and reduce the approximately 1.25 GB retained 10M WASM envelope before device qualification.
- [x] Reproduce the available 10M evidence path on the provisioned hosted runner (run 32704932983).
- [x] Add and reproduce an evidence/fingerprint regression envelope across three provisioned 10M runs (run 32710537108).
- [x] Instrument the physical Quest run for XR cadence, render cost, memory, sustained-performance drift, visibility, build/device identity and actual reduction/LOD output.
- [x] Add an explicit, row-free Quest-browser 10M boundary probe for typed ingest, identity, authoritative evidence, borrowed scans, retained WASM memory and XR main-thread stalls.
- [ ] Run the browser envelope on a physical Meta Quest 3S, measuring frame time, memory pressure, thermal behaviour and reduction/LOD output; then extend to the remaining P1 hardware matrix.
- [ ] Complete the project-owner-selected pre-P1 audits and record their findings before any device-qualification result reopens product promotion.

**Exit:** a 10M columnar handle reaches bounded Moneta reasoning through compact authoritative evidence without JavaScript row reconstruction, and its measured envelope is acceptable for the declared preview hardware.

## Parallel engineering track: test/runtime efficiency

This track supports the critical path but must not weaken correctness.

- [x] Separate fast Node, focused jsdom UI, ordinary integration and explicit real-WASM suites.
- [x] Remove ambient WASM startup from JS-only suites.
- [x] Move representative layout correctness to Rust authority and shrink duplicate JS numerical assertions.
- [ ] Centralize test-group manifests used by integration and WASM configs.
- [ ] Reclassify mixed test files so only actual kernel boundaries pay WASM startup.
- [ ] Port remaining exhaustive Rust-owned analytical assertions to Rust or delete duplicates once equivalent coverage is proven.
- [ ] Record CI/test wall-clock baseline and post-split measurements.
- [ ] Add Rust-side performance benchmarks separately from deterministic correctness gates.
- [ ] Document the steady-state ownership rule in contributor/agent guidance.

## After migration: private preview and productization

Once the migration exit gates, physical Quest evidence and project-owner-selected audits are green, reopen the product track in this order.

### P1 - Minimal private preview

Deliver a controlled, observable deployment suitable for investigator research and usability testing rather than broad public launch.

- [ ] define supported browsers/headsets and a small tested hardware matrix;
- [ ] deploy a reproducible preview environment with versioned frontend/WASM artifacts;
- [ ] add authentication/access control appropriate to a private cohort;
- [ ] define data-retention, upload, deletion and privacy policy for research datasets;
- [ ] add explicit consent/telemetry controls for usability and research instrumentation;
- [ ] establish crash/error/performance telemetry that avoids leaking dataset contents;
- [ ] add health checks, rollback procedure and release provenance;
- [ ] validate `.nemosyne` import/export compatibility across preview releases;
- [ ] implement onboarding, sample investigations and clear unsupported-feature states;
- [ ] run a small investigator cohort and feed structured findings into the roadmap.

### P1 - Security and reliability hardening

- [ ] re-run architecture/security threat review against the deployed preview boundary;
- [ ] validate untrusted dataset parsing, archive limits, zip/path traversal defences and resource budgets;
- [ ] harden CSP, dependency/supply-chain controls and release integrity;
- [ ] audit WASM memory lifecycle, handle ownership and failure recovery;
- [ ] ensure analytical kernel failures cannot silently produce plausible-looking substitute results;
- [ ] add backup/export/recovery procedures for user-created investigation artefacts;
- [ ] establish vulnerability/update response policy for preview dependencies.

### P1 - VR/UI/UX fitness

- [ ] run the Senior VR/UI/UX heuristic review on the current product rather than historical prototypes;
- [ ] validate comfortable locomotion, scale legibility, reach, occlusion, focus and spatial hierarchy on target headsets;
- [ ] keep desktop/2D interaction semantically equivalent where possible rather than building a second research workflow;
- [ ] improve progressive disclosure, gesture discoverability and error recovery;
- [ ] validate frame-time, draw-call, memory and interaction budgets with representative large investigations;
- [ ] use Blender-assisted asset/UI work only where it materially improves spatial comprehension, not as decoration;
- [ ] conduct task-based investigator usability studies and record decisions in reproducible research evidence.

### P1 - Investigation and discovery science

- [ ] complete hypothesis -> test -> support/refute/inconclusive workflows;
- [ ] add explicit falsification operations and alternative-representation checks;
- [ ] connect findings to exact analytical evidence and representation context;
- [ ] capture discovery outcome events suitable for held-out evaluation;
- [ ] evaluate whether Moneta improves discovery quality, time-to-insight, error rate and reproducibility versus baselines;
- [ ] support shareable `.nemosyne` investigations as reproducible memory-palace graphs between investigators.

## Scientific validity programme

### Measurement semantics and statistics

- [ ] complete scale-type/measurement-type coverage beyond storage types;
- [ ] enforce appropriate geometry for compositional, circular, grouped/repeated and other non-Euclidean structures;
- [ ] distinguish descriptive statistics, inferential uncertainty and model utility;
- [ ] introduce calibration/coverage claims only when backed by an explicit statistical procedure;
- [ ] add false-positive/multiple-comparison controls where workflows create selection pressure;
- [ ] expand Rust property/metamorphic tests for statistical and measurement invariants.

### Pattern fragility / apophenia pressure

Treat this as evidence about a claim/analysis, never a psychological score for an investigator.

- [ ] define a versioned pattern-fragility evidence contract;
- [ ] include inspectable dimensions such as representation dependence, degrees of freedom, selection opportunity, perturbation instability, subgroup sparsity, null-model plausibility and independent corroboration;
- [ ] attach concrete falsification actions to elevated dimensions;
- [ ] persist the evidence and performed checks in Investigation/Discovery provenance;
- [ ] keep it advisory until controlled studies show that it improves investigator calibration and discovery quality;
- [ ] never convert heuristic pattern pressure into a probability/confidence claim without empirical calibration.

## Representation evolution after the preview foundation

### P2 - RepresentationGraph and compositional Moneta

Prerequisites: migration complete, RepresentationGraph/grammar mature, performance budgets explicit, learned ranking empirically evaluated.

- [ ] represent existing single-family outputs as canonical simple graphs first;
- [ ] finalize primitive registry, graph schema, grammar and canonical serialization;
- [ ] define bounded composition search and pruning budgets;
- [ ] preserve information-loss and hard-constraint reasoning through composition;
- [ ] make spatial runtime a pure graph embodiment adapter;
- [ ] add deterministic replay/provenance for composed representations;
- [ ] only then evaluate learned composition ranking.

### P3 - Adaptive Nemosyne

Do not begin until learning has outcome evidence and operational governance.

- [ ] freeze exact model/ontology/NIL/perception versions in study state;
- [ ] add monitoring, rollback and user-visible adaptation controls;
- [ ] separate investigator preference adaptation from scientific evidence authority;
- [ ] run controlled longitudinal studies before enabling autonomous adaptation.

## Dependency and platform modernization

Tracked separately by `docs/DEPENDENCY_MODERNIZATION_BACKLOG.md` and issue #300. Resume after migration exit unless a dependency is itself a blocker.

- [ ] complete low-risk npm and GitHub Actions maintenance;
- [ ] modernize Rust scientific/data libraries with numerical, provenance, determinism and WASM parity evidence;
- [ ] replace hand-rolled infrastructure only where a maintained library improves fitness without weakening Nemosyne semantics;
- [ ] migrate ESLint/TypeScript majors deliberately;
- [ ] treat Three.js/WebXR upgrades as dedicated runtime migrations with headset and performance validation.

## Deferred hardening queue

After private-preview blockers and critical product work:

- broad WASM `unsafe` audit;
- Miri/fuzz/property campaigns beyond migration-required invariants;
- deeper kernel panic/recovery architecture;
- additional diagnostics and observability;
- collaboration/multi-user features;
- broader dependency modernization;
- non-critical API cleanup and naming migrations;
- expanded device/browser matrix and long-duration soak testing.

## Fixed design boundaries

- **Rust owns N-dependent work.** Parsing, storage, filtering, statistics, clustering, topology, spectral analysis, evidence construction, data-derived layout and large-data reduction remain Rust/WASM responsibilities.
- **Moneta is a bounded control plane.** It reasons over compact evidence and semantics, never raw full-dataset traversal.
- **JS presents and orchestrates.** It must not reconstruct a shadow analytical authority.
- **Tests live with authority.** Exhaustive mathematical/analytical tests belong beside Rust-owned behaviour; higher layers verify seams, presentation and user interaction.
- **Boundary tests remain mandatory.** Rust-first testing does not replace WASM ABI, browser, WebXR or end-to-end verification.
- **Source rows are not render primitives.** LOD/reduction is a first-class architecture requirement.
- **Bootstrap is the safe default.** Learned ranking must be exact, pinned and explicit.
- **Hard constraints precede learning.** Learned ranking cannot resurrect an infeasible candidate.
- **Model activation is not empirical truth.** Promotion only proves the declared evidence policy was met.
- **Learning never owns research facts.** Frozen learned features consume Rust-derived evidence.
- **Skepticism targets claims, not people.** Pattern-fragility signals must be explainable and actionable.
- **No Gate 9/10 leapfrogging.** Composition/adaptation cannot substitute for correctness, reproducibility and outcome evidence.

## Verification cadence

For each PR, use the cheapest authoritative layer that proves the claim. Before migration exit or preview release, run the broad checkpoint:

```text
cargo test / Rust property tests
focused JS/WASM boundary tests
TypeScript typecheck + lint
fast Node + focused UI + integration + explicit WASM suites
architecture/import authority gates
portable investigation replay/tamper tests
coverage assurance
production build
browser/WebXR smoke
migration benchmark tiers when scale-sensitive code changes
```

## Near-term execution order

1. **Migration exit reconciliation and Draco compatibility deletion.**
2. **Confidence terminology + Rust analytical-fact authority audit.**
3. **Representative end-to-end Moneta migration proof.**
4. **10K-10M deterministic scale/performance validation.**
5. **Declare migration complete only if all exit gates pass.**
6. **Private-preview productization, security and VR/UI readiness.**
7. **Discovery/outcome studies and learned-Moneta empirical validation.**
8. **RepresentationGraph/compositional Moneta.**
9. **Adaptive Nemosyne only after evidence and governance prerequisites.**

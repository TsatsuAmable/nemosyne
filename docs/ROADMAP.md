# Nemosyne Roadmap & Implementation Status

> **Current implementation-status authority.** Product and research direction are governed by `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` V3. This document records the current implementation state and planned programme. Completed migration detail is preserved in `docs/archive/`.

## Status snapshot - 24 August 2026

**Current `main`: `205c81f` (includes #362). Active fix branch: `fix/ci-gate-enforcement`.**

**Next checkpoint:** merge the CI-integrity follow-up discovered while closing the [pre-P1 systematic audit](PRE_P1_SYSTEMATIC_AUDIT.md). PR #362 landed the audit, but owner auto-approval merged it before its checks completed. The follow-up makes approval read-only and runs a repository-owned zero-finding CodeQL SARIF gate because GitHub code scanning is not enabled. Physical execution remains deferred until a Quest 3S is available; even a completed measurement remains `deviceQualifiedAt10m: false` until governed review.

**Last gate:** the audit baseline is green on 24 August 2026 — typecheck; lint (0 errors, 170
recorded warnings); coverage (310 files, 1,903 tests); production build; 170 Rust tests; real
Chromium prebuilt-bundle smoke; 8/8 hygiene dimensions; workflow YAML; active documentation links
and desktop/mobile public-page inspection. The #362 hosted core, Rust and Chromium jobs also passed
after the premature merge. The follow-up's focused workflow regression (4 tests), typecheck, lint
and YAML parse pass locally; its hosted gate and final Pages publication remain pending.

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

## Completed P0 migration programme (archived)

The Draco-to-Moneta authority migration, scientific terminology audit, authoritative end-to-end
composition/replay proof and row-free 10M Rust/JS boundary implementation are complete. The detailed
exit ledger is preserved in
[archive/MONETA_MIGRATION_COMPLETION_SPRINT_2026-08-24.md](archive/MONETA_MIGRATION_COMPLETION_SPRINT_2026-08-24.md).

Two promotion gates remain outside the completed migration programme:

- [ ] Run the instrumented browser envelope on a physical Meta Quest 3S and govern the result.
- [ ] Close or explicitly accept every blocker/high finding in
      [PRE_P1_SYSTEMATIC_AUDIT.md](PRE_P1_SYSTEMATIC_AUDIT.md).

**Exit for product promotion:** the 10M evidence envelope is acceptable for the declared preview
hardware and every pre-P1 risk has a recorded disposition.

## Parallel engineering track: test/runtime efficiency

This track supports the critical path but must not weaken correctness.

- [x] Separate fast Node, focused jsdom UI, ordinary integration and explicit real-WASM suites.
- [x] Remove ambient WASM startup from JS-only suites.
- [x] Move representative layout correctness to Rust authority and shrink duplicate JS numerical assertions.
- [x] Centralize test-group manifests used by integration and WASM configs.
- [ ] Reclassify mixed test files so only actual kernel boundaries pay WASM startup.
- [ ] Port remaining exhaustive Rust-owned analytical assertions to Rust or delete duplicates once equivalent coverage is proven.
- [x] Record the local lane baseline in the pre-P1 audit; add hosted critical-path comparison after this PR.
- [ ] Add Rust-side performance benchmarks separately from deterministic correctness gates.
- [ ] Document the steady-state ownership rule in contributor/agent guidance.

## After migration: private preview and productization

Once the migration exit gates, physical Quest evidence and project-owner-selected audits are green, reopen the product track in this order.

### Pre-P1 audit implementation backlog

The full evidence and dispositions are in
[PRE_P1_SYSTEMATIC_AUDIT.md](PRE_P1_SYSTEMATIC_AUDIT.md). This is the live implementation queue:

- [ ] **PERF-04 / blocker:** run and govern the physical Quest 3S 10M browser qualification.
- [ ] **ARCH-01 / high:** split `World`, `RuntimeBridge`, coordinator contracts, Atlas orchestration and topology embodiment along lifecycle/authority seams.
- [ ] **ARCH-02 / high:** add explicit idempotent UI/world ownership, disposal and recreation contracts.
- [ ] **PERF-03 / high:** benchmark and wire one production spatial accelerator; delete the redundant built-only index.
- [ ] **UX-02 / high:** implement a real-browser load → Moneta/NIL → investigation → export → replay journey.
- [ ] **UX-03 / high:** execute controller, hand and desktop semantic-parity tasks on physical hardware.
- [ ] **RES-01 / high:** inject kernel/ABI failure and prove bounded cleanup plus recoverable UX.
- [ ] **RES-02 / high:** qualify two-browser collaboration across partition, reconnect and role violations.
- [ ] **SEC-02 / high:** inventory Rust `unsafe` and fuzz malformed ABI buffers, handles and exhaustion.
- [ ] **MAINT-01 / high:** remove `@ts-nocheck` from package, bridge, World and Moneta boundary tests first.
- [ ] **PERF-05 / medium:** profile allocations and GC across representative sustained interactions.
- [ ] **UX-04 / medium:** expose command availability and disabled reasons in every input modality.
- [ ] **UX-05 / medium:** benchmark canvas-panel legibility/performance/accessibility against a maintained XR UI library.
- [ ] **UX-06 / medium:** fix the 390 px header collision and add design-approved reduced-motion, focus, contrast and local-font resilience without changing the public visual identity.
- [ ] **SEC-03 / low:** review duplicate Cargo transitive majors during Rust modernization.
- [ ] **MAINT-02 / medium:** replace weak generic assertions in blocker/high-path tests with exact contracts.
- [ ] **MAINT-05 / medium:** classify and reduce the 170-warning lint baseline, then enforce a non-increasing budget.
- [ ] **MAINT-06 / medium:** eliminate Rust deprecation/dead-code/unused-unsafe warning debt, governing any fingerprint change as a versioned provenance migration.
- [ ] **DOC-03 / medium:** remove remaining investigator-facing Draco-era terminology while retaining the governed compatibility facade.

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

The consolidated dependency update landed in #358; its completed plan is archived. Future updates
are evidence-led maintenance rather than a standing migration wave.

- [x] complete the consolidated npm, Cargo and GitHub Actions maintenance in #358;
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

1. Close this systematic audit through local/hosted CI and Pages publication.
2. Run physical Quest 3S 10M and interaction qualification when hardware is available.
3. Implement the audit's P1-high lifecycle, browser-journey, security and spatial-query work.
4. Reopen the minimal private-preview decision only after blockers/high findings are governed.
5. Continue discovery/outcome studies and learned-Moneta empirical validation.
6. Begin RepresentationGraph/compositional Moneta only after its stated prerequisites.
7. Begin Adaptive Nemosyne only after evidence and governance prerequisites.

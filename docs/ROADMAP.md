# Nemosyne Roadmap & Implementation Status

> **Current implementation-status authority.** Product and research direction are governed by `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` V3. This document records current implementation state, programme order and promotion gates. Completed migration detail is preserved in `docs/archive/`.

## Status snapshot — 25 August 2026

**Current main:** includes merged PR #389, completing the collaboration signalling-authority follow-up to #388.

**Active development wave:** P1 analytical responsiveness and spatial fitness. See [`P1_ANALYTICAL_RESPONSIVENESS_AND_SPATIAL_FITNESS.md`](P1_ANALYTICAL_RESPONSIVENESS_AND_SPATIAL_FITNESS.md).

**Physical promotion blocker:** the governed Meta Quest 3S browser/performance and interaction qualification remains outstanding. Desktop/browser CI is necessary evidence but cannot qualify headset behaviour.

Nemosyne has exited the Draco-to-Moneta authority migration and is now in **private-preview preparation**. The core architecture is stable:

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

The #305-#312 migration wave established Rust-resident columnar authority and removed the previous mirrored row-major model from the critical data path. Current scale invariants are:

- source row count is decoupled from rendered primitive count;
- Moneta candidate and sensitivity work is bounded;
- canonical Moneta modules do not traverse raw rows;
- no large-data failure may trigger an expensive JavaScript analytical fallback;
- analytical provenance must state any approximation or reduction mode.

Typed-column ingest, exact canonical identity, borrowed primitive scans and row-free DatasetStructureProfile evidence have been demonstrated at large scale. Physical Quest qualification remains necessary before turning those host-side measurements into a preview hardware claim.

### Moneta authority convergence

The #315-#342 sequence completed production authority convergence:

- Rust owns data-derived layouts and analytical facts;
- production Draco imports collapsed to Moneta;
- hard constraints precede learned ranking;
- row-order/rename/duplication/scale metamorphic and provenance contracts are live;
- production Atlas/Moneta facts consume validated Rust evidence;
- utility is not labelled confidence;
- clean-room replay verifies authoritative decision/evidence composition;
- bounded Moneta work is proven through 10M-row evidence inputs without JavaScript row rematerialisation.

No independent production Draco solver, scorer, layout or analytical fact path remains.

### Reproducibility and investigation provenance

The #324-#332 sequence substantially closed the portable provenance chain:

- analytical replay verifies operation provenance and output identity;
- representation/model identity survives embodiment and `.nemosyne` export/import;
- DiscoveryEpisode records persist portably;
- NIL/no-feasible-representation is a typed reproducible outcome;
- discovery/NIL/model/evidence drift fails closed during replay.

Broader discovery science and investigator-facing NIL workflows remain P1 work.

### Runtime ownership, ABI resilience and recovery

PRs #365-#366 established explicit World lifecycle ownership, generation-fenced recovery, RuntimeBridge ABI-family separation and focused coordinator/application boundaries.

The #375-#384 hardening wave then materially closed the available RES-01/SEC-02 code-executable gaps:

- Rust-tracked host-buffer ownership replaced unsafe caller-fabricated deallocation metadata;
- production bridges use tracked host allocations;
- two-call output contracts are atomic and exact-length checked;
- raw host-facing ranges fail closed unless owned;
- stale dataset handles cannot regain authority after destroy or runtime recovery;
- dataset registry storage scales with live datasets rather than lifetime churn;
- runtime generations revoke old analytical capabilities and provenance;
- repeated real-WASM recovery cycles prove cleanup and stale-capability rejection;
- the Rust `unsafe` surface is inventoried and frozen;
- deterministic malformed parser/buffer/handle/exhaustion corpora are covered.

Long-running fuzz/Miri/device endurance remain explicit hardening evidence lanes rather than ordinary PR blockers.

### Collaboration resilience and authority

The #385-#389 sequence materially closed the available RES-02 browser/runtime gaps:

- signalling reconnect uses bounded backoff with queued negotiation recovery;
- two real Chromium contexts prove partition, WebRTC re-establishment and state convergence;
- observer mutation denial survives reconnect/channel replacement;
- signalling-issued role authority survives RTC churn;
- stale transport callbacks cannot erase newer transports;
- deterministic offer ownership avoids reconnect glare;
- join/leave lifecycle authority is server-owned;
- malformed or forged peer lifecycle messages fail closed.

Cross-device/hostile-network qualification remains a preview-hardening concern, not an excuse to weaken the now-proven browser authority contracts.

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
- [ ] document steady-state test/authority ownership in contributor and agent guidance.

## Governing V3 gate status

| Gate | Status | Remaining exit work |
| --- | --- | --- |
| 0 — Authority reconciliation | **MIGRATION EXIT COMPLETE** | Maintain architecture guards; remove Draco facade only through a governed compatibility decision. |
| 1 — Dataset Evidence | **MIGRATION AUTHORITY COMPLETE / SCIENCE ACTIVE** | Continue measurement semantics and evidence maturity. |
| 2 — Representation Language | **PARTIAL** | Mature canonical RepresentationGraph/grammar before compositional search. |
| 3 — Moneta correctness | **MIGRATION EXIT COMPLETE** | Add outcome validation and embodied perceptual fitness without weakening authority boundaries. |
| 4 — NIL | **PROVENANCE COMPLETE / PRODUCT PARTIAL** | Complete actionable modality-parity UX and investigator workflows. |
| 5 — Discovery | **INFRASTRUCTURE ADVANCED / SCIENCE PARTIAL** | Add falsification workflows, outcome evidence and controlled discovery-quality studies. |
| 6 — Human refinement | **IN PROGRESS** | Expand outcome events, curation policy and study coverage. |
| 7 — Learning infrastructure | **ADVANCED** | Add outcome-linked evaluation and operational monitoring evidence. |
| 8 — Learned Moneta | **EARLY OPT-IN / NOT EMPIRICALLY VALIDATED** | Demonstrate held-out investigator/discovery benefit before considering default use. |
| 9 — Compositional Moneta | **DEFERRED** | Wait for RepresentationGraph/grammar maturity, bounded search and Gate 0-8 evidence. |
| 10 — Adaptive Nemosyne | **DEFERRED** | Requires validated learning, freeze controls, monitoring, rollback and longitudinal evidence. |

## Pre-P1 promotion ledger

The detailed audit evidence remains in `PRE_P1_SYSTEMATIC_AUDIT.md`. The roadmap interpretation is:

- [ ] **PERF-04 / blocker:** run and govern physical Quest 3S 10M browser qualification.
- [x] **ARCH-01 / high:** Atlas/runtime/spatial ownership boundaries are explicit and guarded.
- [x] **ARCH-02 / high:** World/UI/kernel lifecycle ownership and recovery are explicit and idempotent.
- [x] **PERF-03 / high:** production scene selection uses measured BVH crossover behaviour; physical crossover validation remains under PERF-04.
- [x] **UX-02 / high:** real-browser desktop investigation/replay/tamper journey is covered.
- [ ] **UX-03 / high:** execute controller, hand and desktop semantic-parity tasks on physical hardware.
- [x] **RES-01 / high, code-executable scope:** checked output, host allocation ownership, malformed handles and sustained generation recovery are covered. Device/endurance residuals remain evidence lanes.
- [x] **RES-02 / high, browser scope:** partition/reconnect/state convergence/role violation and server-owned lifecycle authority are covered through #389. Cross-device/hostile-network residuals remain preview hardening.
- [x] **SEC-02 / high, deterministic CI scope:** unsafe inventory plus bounded malformed parser/buffer/handle/exhaustion campaigns are covered. Long-running fuzz/Miri remain separate hardening lanes.
- [ ] **MAINT-01 / high:** continue removing `@ts-nocheck` from package, bridge, World and Moneta boundary tests; #388 started the highest-value runtime boundary.
- [ ] **PERF-05 / medium:** profile allocations/GC and sustained analytical scheduling across representative interactions.
- [ ] **UX-04 / medium:** expose command availability and disabled reasons in every input modality.
- [ ] **UX-05 / medium:** benchmark canvas-panel legibility/performance/accessibility against a maintained XR UI library.
- [ ] **UX-06 / medium:** fix the 390 px header collision and add reduced-motion, focus, contrast and local-font resilience without changing public visual identity.
- [ ] **MAINT-02 / medium:** replace weak generic assertions in blocker/high-path tests with exact contracts.
- [ ] **MAINT-05 / medium:** classify/reduce lint-warning debt and enforce a non-increasing budget.
- [ ] **MAINT-06 / medium:** eliminate Rust warning debt, governing fingerprint-affecting changes as provenance migrations.
- [ ] **DOC-03 / medium:** remove remaining investigator-facing Draco terminology while retaining the compatibility facade.

## P1 — Analytical responsiveness and spatial fitness

**ACTIVE.** Detailed acceptance criteria and dependency order are in [`P1_ANALYTICAL_RESPONSIVENESS_AND_SPATIAL_FITNESS.md`](P1_ANALYTICAL_RESPONSIVENESS_AND_SPATIAL_FITNESS.md).

### P1-A Handle-native analytical boundary

- [x] establish tested handle-native TDA adapter entry points;
- [ ] route Atlas TDA through the durable current Rust handle;
- [ ] remove production TDA `Dataset.toJSON()` round trips;
- [ ] move TDA filter construction from JS raw rows to Rust column access;
- [ ] prove supported TDA works without row rematerialisation.

### P1-B Asynchronous analytical runtime

- [ ] define request/version/cancellation contracts;
- [ ] isolate expensive analysis behind a dedicated Web Worker;
- [ ] reject stale results after dataset/kernel/session generation changes;
- [ ] preserve fail-closed kernel recovery across the worker boundary;
- [ ] measure transfer/scheduling before considering shared memory;
- [ ] add SharedArrayBuffer/WASM threads/SIMD only where profiling demonstrates value.

### P1-C Sparse topology scalability

- [ ] replace repeated all-pairs/bucket-pair work with a reusable sparse-neighbourhood substrate;
- [ ] reuse it across Mapper, H0/Betti-0 and compatible clustering paths;
- [ ] introduce governed exact/sparse/landmark modes with explicit provenance;
- [ ] validate approximation/stability against exact small-data references;
- [ ] benchmark scale separately from deterministic correctness gates.

### P1-D 3D-native Moneta perceptual fitness

- [ ] activate existing occlusion/cognitive-load candidate priors;
- [ ] add versioned measured perceptual evidence for actual embodiments;
- [ ] include projected overlap, hidden-mark fraction, glyph size, crowding, depth ambiguity, spatial extent and viewpoint travel;
- [ ] evaluate stability over a bounded nearby-view envelope;
- [ ] preserve the distinction between measured evidence, engineering priors and statistical confidence.

### P1-E Actionable NIL/ambiguity

- [ ] distinguish `INFEASIBLE`, `UNDERDETERMINED` and `AMBIGUOUS` investigator states;
- [ ] surface machine traces and readable explanations;
- [ ] expose near misses and exact blocking requirements;
- [ ] offer evidence-supported remediation without silently relaxing scientific constraints;
- [ ] persist remediation and resulting decisions into investigation provenance.

### P1-F Semantic targeting and Memory Palace focus+context

- [ ] resolve hand/ray intent against analytical structures rather than arbitrary geometry alone;
- [ ] add salience/confidence ranking plus hysteresis and precision escape hatches;
- [ ] support observation, cluster/region, Mapper, persistence and investigation-artifact targets;
- [ ] use the hierarchy investigation -> dataset -> structure -> region/cluster -> observation for semantic zoom;
- [ ] preserve stable spatial identity while representation resolution changes.

## P1 — Minimal private preview

Deliver a controlled, observable deployment suitable for investigator research/usability testing rather than broad public launch.

- [ ] define supported browsers/headsets and a small tested hardware matrix;
- [ ] deploy reproducible versioned frontend/WASM artefacts;
- [ ] add authentication/access control for a private cohort;
- [ ] define dataset retention/upload/deletion/privacy policy;
- [ ] add explicit consent/telemetry controls;
- [ ] establish dataset-safe crash/error/performance telemetry;
- [ ] add health checks, rollback and release provenance;
- [ ] validate `.nemosyne` compatibility across preview releases;
- [ ] implement onboarding, sample investigations and unsupported-feature states;
- [ ] run a small investigator cohort and feed structured evidence into the roadmap.

## P1 — Security and reliability hardening

- [ ] re-run threat review against the deployed preview boundary;
- [ ] validate untrusted dataset/archive limits, traversal defences and resource budgets;
- [ ] harden CSP, supply-chain controls and release integrity;
- [ ] ensure kernel failure cannot silently produce plausible-looking substitute results;
- [ ] add backup/export/recovery procedures for user-created investigations;
- [ ] establish preview vulnerability/update policy;
- [ ] run deeper fuzz/Miri/device-endurance campaigns outside the ordinary PR critical path.

## P1 — VR/UI/UX fitness

- [ ] run the Senior VR/UI/UX heuristic review on the current product;
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

**DEFERRED until P1 foundations and stated prerequisites are met.**

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
- **JS presents, orchestrates and schedules.** It must not reconstruct a shadow analytical authority.
- **Tests live with authority.** Exhaustive mathematics belongs beside Rust-owned behaviour; higher layers verify seams, presentation and interaction.
- **Boundary tests remain mandatory.** Rust-first testing does not replace WASM ABI, browser, WebXR or end-to-end verification.
- **Source rows are not render primitives.** LOD/reduction is first-class architecture.
- **Approximation is evidence.** Sparse/landmark/approximate modes must be explicit in provenance.
- **Bootstrap is the safe Moneta default.** Learned ranking remains exact, pinned and explicit.
- **Hard constraints precede learning.** Learning cannot resurrect an infeasible candidate.
- **Learning never owns research facts.** Learned features consume Rust-derived evidence.
- **Skepticism targets claims, not people.** Pattern-fragility signals must be explainable and actionable.
- **No Gate 9/10 leapfrogging.** Composition/adaptation cannot substitute for correctness, reproducibility, spatial fitness or outcome evidence.

## Verification cadence

For each PR, use the cheapest authoritative layer that proves the claim. Before private-preview promotion, run the broad checkpoint:

```text
cargo test / Rust property tests
focused JS/WASM boundary tests
TypeScript typecheck + lint
fast Node + focused UI + integration + explicit WASM suites
architecture/import/row-materialisation authority gates
portable investigation replay/tamper tests
coverage assurance
production build
browser/WebXR smoke
scale benchmarks when scale-sensitive code changes
physical Quest qualification for promotion-critical device claims
```

## Near-term execution order

1. Land the handle-native TDA seam and route Atlas TDA through its durable Rust dataset handle.
2. Remove JavaScript raw-row/filter preprocessing from production TDA and prove row-free execution.
3. Add the asynchronous analytical execution boundary with version fencing and cancellation; measure transfer cost before shared memory.
4. Replace quadratic topology hot paths with a reusable sparse-neighbourhood strategy and explicit approximation provenance.
5. Add 3D-native Moneta perceptual fitness.
6. Complete actionable NIL/ambiguity/remediation workflows.
7. Add semantic target resolution and Memory Palace focus+context hierarchy.
8. Continue bounded MAINT-01 typing cleanup in parallel where it does not distract from the critical path.
9. Run PERF-04 and UX-03 physical Quest qualification as soon as hardware is available.
10. Govern every remaining blocker/high audit finding and reopen the minimal-private-preview promotion decision.
11. Continue discovery/outcome studies and learned-Moneta empirical validation.
12. Begin RepresentationGraph/compositional Moneta only after P1 prerequisites are satisfied.
13. Begin Adaptive Nemosyne only after evidence and governance prerequisites are satisfied.

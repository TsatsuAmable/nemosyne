# Nemosyne Roadmap & Implementation Status

> **Current implementation-status authority.** Product and research direction are governed by `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` V3. This document records current implementation state, programme order, review findings and promotion gates. Completed migration detail is preserved in `docs/archive/`.

## Status snapshot — 26 August 2026

**Current main at the start of this review/fix-forward tranche:** `dce68a4`, through #407. #405 landed the typed/columnar TDA implementation, #406 landed the first representation-embodiment pass, and #407 landed the first whole-product journey/coordinator pass.

**Current interpretation:** those PRs are useful implementation advances, but merge/completion claims are not treated as irreversible. Adversarial review of live `main` found correctness, authority, semantic-fidelity and UX-evidence gaps in all three areas. P1-A, P1-R and P1-U therefore remain active in the review/fix-forward stream even while the forward implementation stream proceeds into P1-B/P1-C.

**Physical promotion blocker:** the governed Meta Quest 3S browser/performance and interaction qualification remains outstanding. Desktop/browser CI is necessary evidence but cannot qualify headset behaviour.

## Two-workstream operating model

Nemosyne development now runs as two deliberately independent but converging streams.

### Stream A — forward implementation

Stream A advances the planned architecture and product frontier: P1-B asynchronous execution, P1-C sparse topology, P1-D perceptual fitness, P1-E actionable NIL, P1-F semantic targeting/Memory Palace focus+context, private-preview plumbing and later scientific/product work.

Stream A should not stop merely because the review stream finds defects in earlier work unless the defect invalidates a dependency or makes continued implementation unsafe. It should preserve the governing design boundaries and consume review fixes as they land.

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
- A gate becomes **VERIFIED COMPLETE** only after implementation and review evidence agree.
- Private-preview promotion requires convergence of both streams, even though Stream A may continue ahead while Stream B repairs earlier tranches.

### Status vocabulary

- **IMPLEMENTATION LANDED:** planned code exists and passed its implementation gates.
- **REVIEW ACTIVE:** later review found unresolved defects, semantic gaps or insufficient acceptance evidence.
- **VERIFIED COMPLETE:** implementation plus independent review evidence satisfy the governing acceptance criteria.
- **DEFERRED:** intentionally not active because prerequisites are unmet.

## Active review/fix-forward ledger

| ID | Area | Severity | Finding | Required disposition |
| --- | --- | --- | --- | --- |
| RF-001 | P1-R / authority | High | `VRTopologyTranslator` still feeds `dataset.rows` into non-point embodiment, and aggregate/density/cluster reductions traverse O(N) rows/positions in TypeScript. Bounded mesh count is not the same as Rust-owned bounded analytical reduction. | Define Rust-owned bounded semantic embodiment payloads; make Three.js consume those payloads rather than derive analytical structure from raw rows. |
| RF-002 | P1-R / scientific semantics | High | `DENSITY_FIELD` is currently a fixed 6×6×6 histogram over rendered positions while the ontology claims continuous density estimation; `DISTRIBUTION_FIELD` shares that geometry despite claiming quantiles/PDF/contours; cluster/manifold claims also exceed demonstrated semantics. | Reclassify candidate fidelity honestly and either implement the declared mathematics or narrow the ontology/preservation claims. |
| RF-003 | P1-R / correctness | High | Aggregate grid calculation treated legitimate numeric zero as falsy and substituted `1`, corrupting aggregate means. | **Fixed in this review tranche**; preserve zero and add regression coverage. |
| RF-004 | P1-R / tests | Medium | The C4 source guard sliced from `buildAggregateBars` to an earlier `buildDensityField`, producing an empty string and allowing a false pass. | **Fixed in this review tranche**; assert method ordering and inspect all three non-point method bodies. |
| RF-005 | P1-U / UX | High | The runtime still constructs a broad dashboard/panel constellation; `ContextualTaskSurface` is an action filter, not a colocated spatial task surface. | Reduce/demote persistent surfaces and implement actual selection-anchored contextual controls. |
| RF-006 | P1-U / world semantics | High | TechnoCore lens methods are not yet demonstrated as wired investigator input/analysis controls; IceVault remains a persistent largely decorative glyph. | Wire TechnoCore through input/NIL/analysis with visible state and provenance; give IceVault a real archival/recovery role or remove it from the default world. |
| RF-007 | P1-A / analytical correctness & scale | High | Columnar TDA `FeatureSpace` clones selected columns, transposes them into `Vec<Vec<f64>>`, and does not honor primitive validity bitmaps, causing invalid values to enter topology as numeric zero. | Make columnar TDA validity-aware and move to borrowed/column-oriented access with bounded scratch memory; add invalid-data and memory/scale contracts. |
| RF-008 | P1-U / evidence | High | `investigator-journey-e2e.test.ts` manually advances phases and uses a kernel mock. It is valuable integration coverage but not evidence of a real browser/XR end-to-end investigator journey or usability outcomes. | Reclassify the test as integration evidence; add Playwright product-path journey coverage and physical XR task evidence. |
| RF-009 | Roadmap governance | Medium | Roadmap status had become stale and internally contradictory, with older main SHAs and completion claims coexisting with open checklist items. | **Fixed by this operating-model update**; future review findings update the roadmap in the same tranche. |

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

Typed-column ingest, exact canonical identity, primitive-column storage and row-free DatasetStructureProfile evidence have been demonstrated. RF-007 reopens the TDA accessor implementation because its current columnar path rebuilds a full numeric row-major point matrix internally and ignores validity bitmaps.

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

The migration authority remains complete. Product embodiment correctness is separately governed by P1-R and RF-001/RF-002.

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

The #375-#384 hardening wave then materially closed the available RES-01/SEC-02 code-executable gaps: tracked host-buffer ownership, exact two-call output contracts, stale-handle rejection, generation revocation, repeated recovery, unsafe-surface inventory and malformed-input campaigns.

Long-running fuzz/Miri/device endurance remain explicit evidence lanes rather than ordinary PR blockers.

### Collaboration resilience and authority

The #385-#389 sequence materially closed the available RES-02 browser/runtime gaps: bounded reconnect, multi-context WebRTC recovery, role-authority preservation, stale transport protection, deterministic offer ownership and server-owned peer lifecycle.

Cross-device/hostile-network qualification remains preview hardening.

### P1-A typed/columnar TDA implementation

#395 closed production JS TDA rematerialisation; #405 then enabled typed/columnar-only handles to execute persistence, Mapper and Betti-0 directly in Rust with `ingestMode` provenance and real-WASM boundary tests.

That implementation is retained. Independent review found RF-007, so the tranche is **IMPLEMENTATION LANDED / REVIEW ACTIVE**, not yet `VERIFIED COMPLETE`.

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
- [ ] systematically audit source/architecture tests for vacuous or false-positive guards, following RF-004.

## Governing V3 gate status

| Gate | Status | Remaining exit work |
| --- | --- | --- |
| 0 — Authority reconciliation | **MIGRATION EXIT COMPLETE / REVIEW MONITORED** | Maintain architecture guards; remove Draco facade only through a governed compatibility decision. |
| 1 — Dataset Evidence | **MIGRATION AUTHORITY COMPLETE / SCIENCE ACTIVE** | Continue measurement semantics and evidence maturity; close RF-007 validity semantics for TDA access. |
| 2 — Representation Language | **PARTIAL / REVIEW ACTIVE** | Make current single-family candidates mathematically and spatially faithful before compositional search. |
| 3 — Moneta correctness | **MIGRATION EXIT COMPLETE / PRODUCT EMBODIMENT REVIEW ACTIVE** | Close RF-001/RF-002, then add outcome validation and embodied perceptual fitness. |
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
- [x] **ARCH-01 / high:** Atlas/runtime/spatial ownership boundaries are explicit and guarded; Stream B now also audits implementation conformance to those boundaries.
- [x] **ARCH-02 / high:** World/UI/kernel lifecycle ownership and recovery are explicit and idempotent.
- [x] **PERF-03 / high:** production scene selection uses measured BVH crossover behaviour; physical crossover validation remains under PERF-04.
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
- [ ] **MAINT-02 / medium:** replace weak generic assertions in blocker/high-path tests with exact contracts; RF-004 is the first newly identified case.
- [ ] **MAINT-05 / medium:** classify/reduce lint-warning debt and enforce a non-increasing budget.
- [ ] **MAINT-06 / medium:** eliminate Rust warning debt, governing fingerprint-affecting changes as provenance migrations.
- [ ] **DOC-03 / medium:** remove remaining investigator-facing Draco terminology while retaining the compatibility facade.

## P1 — Analytical responsiveness and spatial fitness

**ACTIVE.** Detailed analytical acceptance criteria and dependency order are in [`P1_ANALYTICAL_RESPONSIVENESS_AND_SPATIAL_FITNESS.md`](P1_ANALYTICAL_RESPONSIVENESS_AND_SPATIAL_FITNESS.md). PR #402's design records remain implementation specifications where review evidence has not invalidated them.

### P1-A Handle-native analytical boundary — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed implementation evidence:

- [x] establish tested handle-native TDA adapter entry points;
- [x] route Atlas TDA through the durable current Rust handle;
- [x] reject non-current TDA datasets before serialisation/transient reload;
- [x] remove production TDA `Dataset.toJSON()` round trips;
- [x] move TDA filter construction from JS raw-row traversal into Rust;
- [x] typed/columnar-only handles execute persistence, Mapper and Betti-0 through real WASM;
- [x] record typed-vs-row ingest mode in provenance.

Review exit work:

- [ ] **RF-007 correctness:** honor primitive validity bitmaps so missing/invalid feature values are not silently treated as numeric zero;
- [ ] **RF-007 scale:** replace full selected-column cloning plus `Vec<Vec<f64>>` transpose with a borrowed/column-oriented analytical accessor and bounded scratch memory;
- [ ] add Rust + real-WASM regression tests covering invalid features, row-index semantics and large-N memory behavior;
- [ ] re-run adversarial review before marking P1-A `VERIFIED COMPLETE`.

## P1 — Product convergence gates

### P1-R Representation embodiment convergence — IMPLEMENTATION LANDED / REVIEW ACTIVE

Goal: a Moneta semantic decision must survive translation into a genuinely corresponding spatial representation. Individual observations are one possible detail primitive, not the universal renderer output.

Landed first-pass work:

- [x] audit and enumerate current Moneta semantic candidates;
- [x] remove explicit silent point-cloud fallback from aggregate/density/cluster geometry branches;
- [x] add visibly distinct aggregate pillars, density voxels and cluster-volume meshes;
- [x] bound visible aggregate/density/cluster mesh counts independently of source row count;
- [x] make the current single-winner RepresentationGraph primitive executable without enabling P2 composition;
- [x] add first-pass architecture/integration tests for distinct geometry and bounded visible primitive counts;
- [x] **RF-003:** preserve legitimate zero values in aggregate calculations and add regression coverage;
- [x] **RF-004:** repair the vacuous source guard so it actually inspects cluster, density and aggregate implementations.

Review exit work:

- [ ] **RF-001:** move N-dependent aggregate, density, cluster and compatible reduction/layout work out of TypeScript into Rust-owned bounded semantic payloads;
- [ ] make `VRTopologyTranslator`/Three.js an embodiment adapter over bounded semantic payloads rather than an analytical reducer over `dataset.rows`;
- [ ] **RF-002:** re-audit every candidate's declared `supports`, `preserves`, `loses`, scale limits and description against the mathematics actually computed;
- [ ] implement or honestly downgrade `DENSITY_FIELD`, `DISTRIBUTION_FIELD`, `CLUSTER_REGIONS`, `MANIFOLD_EMBEDDING`, `MULTISCALE_FIELD` and any other overclaimed candidate;
- [ ] require provenance to record the exact reduction/estimation/layout method and parameters the investigator is seeing;
- [ ] add mathematical/property/metamorphic tests at the Rust authority layer, leaving TypeScript tests to verify payload-to-geometry embodiment;
- [ ] demonstrate at least two analytically plausible alternatives that are both mathematically faithful and visibly/interactively distinct;
- [ ] re-run adversarial representation review before allowing P1-D to treat these alternatives as product-valid ranking targets.

### P1-U Whole-product investigation UX convergence — IMPLEMENTATION LANDED / REVIEW ACTIVE

Goal: the interface behaves as one sparse spatial investigation environment rather than a collection of locally improved panels, widgets and point clouds.

Landed first-pass work:

- [x] define the canonical 10-phase investigator journey;
- [x] add `InvestigatorJourneyCoordinator` and journey-phase telemetry;
- [x] document the intended whole-product spatial hierarchy;
- [x] expose task/topology filtering in `ContextualTaskSurface`;
- [x] define TechnoCore lens/activity states in code;
- [x] retain the frozen panel/intent-wheel treatment and progressive-disclosure foundations;
- [x] add an integration test exercising subsystem APIs across the 10 journey phases.

Review exit work:

- [ ] **RF-005:** reduce, merge, lazy-load or demote persistent UI so the default analyst experience no longer boots a floating-dashboard archipelago;
- [ ] implement a real contextual task surface spatially colocated with the selected semantic structure, using `ContextualTaskSurface` as policy rather than treating the policy object as the UI itself;
- [ ] **RF-006:** wire TechnoCore selection/manipulation through the shared semantic input language into real analytical/view actions, with persistent visible mode state and undo/recovery;
- [ ] give IceVault a concrete archive/frozen-state/recovery function or remove it from the default persistent scene;
- [ ] derive journey state from real product events and enforce meaningful phase prerequisites instead of relying on manual test transitions;
- [ ] **RF-008:** reclassify the existing journey test as subsystem integration evidence and add Playwright coverage that drives the actual desktop UI through a representative investigation;
- [ ] validate the same core tasks on Quest 3S controllers and hand tracking, preserving semantic parity while allowing modality-appropriate mechanics;
- [ ] collect task-level evidence for orientation, discoverability, recovery, falsification, finding capture and share/replay before P1-U can become `VERIFIED COMPLETE`.

### P1-B Asynchronous analytical runtime — STREAM A ACTIVE NEXT

- [ ] define request/version/cancellation contracts;
- [ ] isolate expensive analysis behind a dedicated Web Worker;
- [ ] reject stale results after dataset/kernel/session generation changes;
- [ ] preserve fail-closed kernel recovery across the worker boundary;
- [ ] measure transfer/scheduling before considering shared memory;
- [ ] add SharedArrayBuffer/WASM threads/SIMD only where profiling demonstrates value.

Stream A may implement P1-B while Stream B closes P1-A/R/U findings. Any worker design must preserve fixes made by Stream B and must not duplicate analytical authority.

### P1-C Sparse topology scalability — STREAM A QUEUED

- [ ] replace repeated all-pairs/bucket-pair work with a reusable sparse-neighbourhood substrate;
- [ ] reuse it across Mapper, H0/Betti-0 and compatible clustering paths;
- [ ] introduce governed exact/sparse/landmark modes with explicit provenance;
- [ ] validate approximation/stability against exact small-data references;
- [ ] benchmark scale separately from deterministic correctness gates;
- [ ] integrate with the validity-aware borrowed columnar accessor produced by RF-007 rather than building a second point-storage abstraction.

### P1-D 3D-native Moneta perceptual fitness

P1-D design work may proceed, but default ranking must not treat an embodiment as product-valid until the relevant P1-R review criteria are closed.

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
- [ ] close RF-005/RF-006/RF-008 and the P1-U review checklist;
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
- **Observations are detail, not universal geometry.** At investigation scale, aggregate, density, cluster, field, topology and other structure-level representations are first-class; individual observations appear when analytically or interactively appropriate.
- **JS presents, orchestrates and schedules.** It must not reconstruct a shadow analytical authority.
- **Tests live with authority.** Exhaustive mathematics belongs beside Rust-owned behavior; higher layers verify seams, presentation and interaction.
- **Boundary tests remain mandatory.** Rust-first testing does not replace WASM ABI, browser, WebXR or end-to-end verification.
- **Source rows are not render primitives or analytical reduction inputs.** LOD/reduction is first-class architecture, and render-object growth must be governed independently of source N.
- **The world is an interface, not scenery.** Persistent spatial objects, including TechnoCore and IceVault, must have a clear investigator function or be removed/demoted.
- **Approximation is evidence.** Sparse/landmark/approximate modes must be explicit in provenance.
- **Bootstrap is the safe Moneta default.** Learned ranking remains exact, pinned and explicit.
- **Hard constraints precede learning.** Learning cannot resurrect an infeasible candidate.
- **Learning never owns research facts.** Learned features consume Rust-derived evidence.
- **Skepticism targets claims, not people.** Pattern-fragility signals must be explainable and actionable.
- **Review can reopen completion.** A green test suite or merged PR is implementation evidence, not immunity from later adversarial review.
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
scale benchmarks when scale-sensitive code changes
physical Quest qualification for promotion-critical device claims
independent review pass over the resulting merged implementation
```

## Near-term execution order by stream

### Stream A — forward implementation

1. **P1-B:** implement the asynchronous analytical execution contract, generation/version/fingerprint fencing and Worker isolation; measure transport cost before shared memory.
2. **P1-C:** implement the reusable sparse-neighbourhood substrate and governed exact/sparse modes, consuming the corrected P1-A accessor rather than introducing another data representation.
3. Continue **P1-D design/measurement infrastructure**, but gate default ranking changes on reviewed-faithful P1-R embodiments.
4. Implement **P1-E actionable NIL/ambiguity** and **P1-F semantic targeting/Memory Palace focus+context** where dependencies are stable.
5. Continue bounded preview/security/maintenance plumbing that does not depend on unresolved review findings.

### Stream B — review and fix-forward

1. Land RF-003/RF-004 regression fixes and this roadmap/governance update.
2. Close **RF-007**: validity-aware, borrowed/column-oriented TDA access with scale evidence.
3. Close **RF-001/RF-002**: Rust-owned semantic embodiment payloads and honest candidate semantics/provenance.
4. Close **RF-005/RF-006/RF-008**: actual sparse whole-product UI convergence, functional world objects and real product-path evidence.
5. Re-review P1-B/P1-C as Stream A lands them; add new RF items immediately when implementation diverges from design.
6. Re-review P1-D/E/F in the same way rather than assuming acceptance because implementation tests are green.

### Convergence / promotion

- Run PERF-04 and UX-03 physical Quest qualification on the converged treatment as soon as hardware is available.
- Re-run blocker/high security, architecture, scientific and UX review before private-preview promotion.
- Continue discovery/outcome studies and learned-Moneta empirical validation.
- Begin RepresentationGraph/compositional Moneta only after P1 prerequisites are both implemented and review-verified.
- Begin Adaptive Nemosyne only after evidence and governance prerequisites are satisfied.

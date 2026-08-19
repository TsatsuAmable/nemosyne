# Nemosyne Roadmap & Implementation Gates

## Current Status

> **Single source of truth for project state.** Read this block FIRST on pickup and
> update it BEFORE stopping. Other docs (CLAUDE.md, `.agents/`) point here — they do
> not duplicate state.

- **2026-08-19 — Project Realignment, Standardization Review & Domain Aggregate Architecture:**
  - **Vision Alignment:** Fully synchronized project direction with the governing [Nemosyne_Definitive_Vision_and_Roadmap.md](Nemosyne_Definitive_Vision_and_Roadmap.md) and codified the **Vision Alignment Cardinal Rule** across agent guides.
  - **Investigation Domain Aggregate Refactor:** Decomposed `AtlasCore` into an Application Service coordinator managing an authoritative `InvestigationAggregate` (`AnalyticalState`, `EvidenceLedger`, `RepresentationState`, `DecisionHistory`, `ResearchContext`, `InvestigationGraph`) under `src/atlas/domain/`.
  - **Explicit Kernel State & Fallback Elimination:** Formalized `KernelState` (`UNINITIALIZED | INITIALIZING | READY | UNAVAILABLE`) and `KernelUnavailableError`, strictly eliminating any silent JS calculation fallback.
  - **Event-Sourced Architectural Principle:** Codified the law of *Single Authoritative State & Event-Sourced Determinism* ($\text{Authoritative Investigation} = \text{InvestigationCommand}[] + \text{ImmutableDatasetRef} + \text{Manifest}$; materialized state is disposable cache; Memory Palace is pure spatial projection).
  - **Dev Server Modularization:** Decomposed monolithic `vite.config.js` into dedicated TypeScript plugins under `dev/` composed by a clean `vite.config.ts`.
  - **Standardization & OSS Adoption Review:** Published [docs/STANDARDIZATION_REVIEW.md](STANDARDIZATION_REVIEW.md) specifying a structured library adoption plan across 13 subsystem domains to eliminate **~8,440 lines of boilerplate** (<45 kB footprint).
  - **Engine Architecture Invariant:** Reaffirmed Three.js 0.168.0 and Rust WASM as our core foundation; rejected engine rewrites.
  - **Developer Explainer Guide:** Published [docs/DEVELOPER_EXPLAINER.md](DEVELOPER_EXPLAINER.md) detailing architecture, data lifecycles, and runbooks.
  - **Next Planned Work:**
    - *Sprint 27.1 — Subsystem Modularization & Strict Contract Boundaries:* Formalize typed barrel exports across `src/investigation/`, `src/atlas/`, `src/representation/`, `src/study/`, `src/network/`, `src/perception/`, `src/vr/`, and `src/session/`.
  - **Gates:** `tsc --noEmit` 0 errors · `eslint` 0 errors · `npm test` 219/219 test files passed (1,462 passed / 26 skipped jsdom-WASM parity by design) · `cargo test` 85/85 passed · `npm run build` exit 0.

---

## Gate Model — Alignment to the Definitive Vision

The Nemosyne implementation roadmap is organized by architectural gates defined in [Nemosyne_Definitive_Vision_and_Roadmap.md](Nemosyne_Definitive_Vision_and_Roadmap.md) (§13), enforcing the core product thesis:

> **An analytical investigation is something a human does through data, representations, actions, observations and decisions. Nemosyne preserves that whole process, not merely the resulting visualization.**

```text
                                GATES OVERVIEW
┌─────────────────────────────────────────────────────────────────────────────┐
│ Gate 0: Foundations & Ambiguity Removal  (Terms, Rust kernel, Module bounds)│
│ Gate 1: Understand                       (First-class Investigation Entity) │
│ Gate 2: Represent                        (Constraint Arbiter, SpatialStrategy)
│ Gate 3: Experience                       (Analyst Cockpit, Interaction FSM) │
│ Gate 4: Investigate                      (Evidence Ledger, Findings, Annot) │
│ Gate 5: Reproduce                        (Investigation DAG, .nemosyne Pkg) │
│ Gate 6: Study                            (2D vs VR Instrument, Data Exporter)
│ Gate 7: Adaptive Research                (Post-Release Evidence Loops)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Canonical Domain Vocabulary (Vision §4)

| Canonical Term | Governing Definition | Owner Subsystem |
|---|---|---|
| **Investigation** | The central product object. Persistent, versionable graph of questions, dataset versions, analytical operations, evidence ledger, observations, findings, representation history, decisions, and conclusions. | `investigation/` |
| **Task / Hypothesis** | The human analytical purpose (anomaly isolation, cluster inspection, temporal drift, comparison). | `investigation/` |
| **Analytical State** | Authoritative state of analysis computed deterministically by the Rust/WASM kernel. | `atlas/` (orchestrator), Rust kernel (computation) |
| **Evidence** | Attributable observations, findings, annotations, decision contexts, and analytical proofs (not raw telemetry). | `investigation/` |
| **Representation** | The explicit spatial strategy (`SpatialStrategy`) satisfying analytical requirements and constraints. | `representation/` (Draco) |
| **Session** | Execution context carrying presentation state, temporary UI, and peer presence (reconstructible derived view). | `spatial-runtime/` |
| **Memory Palace** | Persistent spatial projection of an Investigation; reconstructible from semantic state and representation inputs. | `spatial-runtime/` |
| **Study** | Controlled experimental container defining treatment boundaries, conditions (2D vs VR), tasks, and protocol. | `research-harness/` |

---

### Core Architectural Principle: Single Authoritative State & Event-Sourced Determinism

> **Architectural Law:** Only ONE state representation is authoritative. Everything else must be strictly derivable and disposable.

To eliminate state divergence, race conditions, and trust ambiguities across the 12+ historic state surfaces (`_current`, `_original`, `_results`, `_ledger`, `_structures`, `_activeRecommendation`, `_decisionHistory`, `AnalysisHistory`, `DatasetSpace`, `NemosyneSession`, collaborative binary state, Three.js scene graph), Nemosyne defines:

$$\mathbf{Authoritative\ Investigation} = \mathbf{InvestigationCommand}[] + \mathbf{ImmutableDatasetRef} + \mathbf{EnvironmentManifest}$$

```text
       Authoritative Event Log: InvestigationCommand[] + Immutable Dataset
                                      │
                                      ▼
             Deterministic Replay Engine (Rust/WASM Kernel)
                                      │
                      ┌───────────────┴───────────────┐
                      ▼                               ▼
        Authoritative Analytical State     Representation Decision
       (Computed Tables, Metrics, TDA)    (Draco Constraints, SpatialStrategy)
                      │                               │
                      └───────────────┬───────────────┘
                                      ▼
                        Semantic Memory Palace Projection
                    (Ephemeral Disposable Scene Graph / VR UI)
```

1. **Materialized State as Disposable Cache:** Computed analytical tables, structure sets, UI panel states, and Three.js meshes are non-authoritative caches. They can be dropped and rebuilt from the command log at any time without data loss.
2. **Deterministic Replay Guarantee:** $\text{Replay}(\text{Command Log}) \longrightarrow \text{Same Analytical State} \longrightarrow \text{Same Representation Decision} \longrightarrow \text{Same Semantic World}$.
3. **Memory Palace as Pure Spatial Projection:** The Memory Palace is never an independently serialized 3D scene; it is a live spatial projection of the event-sourced investigation.

#### Implementation Target Points

| Implementation Milestone | Target Phase / Sprint | Deliverable & Acceptance Guarantee |
|---|---|---|
| **Domain Aggregate Isolation** | **Sprint 27.1 / Gate 1** | `InvestigationAggregate` encapsulates all sub-states; `AnalysisHistory` and `DatasetSpace` are purely derived read-only views. |
| **Pure Strategy Solvers** | **Sprint 27.2 / Gate 2** | Draco `SpatialStrategy` formulated as a pure deterministic function of `(InvestigationState, EnvironmentManifest)`. |
| **Headless Replay & `.nemosyne`** | **Sprint 27.3 / Gate 5** | `.nemosyne` packages store only `(DatasetBytes, CommandLog, Manifest)`; headless tests verify bit-for-bit palace reconstruction. |
| **Frozen Study Telemetry** | **Gate 6 / Study** | Experimental trial replay guarantees exact state matching across 2D control and VR experimental conditions. |

---

## Architectural Gates & Deliverables

### Gate 0 — Foundations & Ambiguity Removal ✅ (Baseline Complete)
- **Objective:** Create one unambiguous architecture, enforce Rust/WASM as the sole analytical authority, and remove competing models.
- **Key Status:**
  - ✅ Retired legacy `src/ai/` prototypes (`DracoWorldModel`, `NeuralConstraintPredictor`, `VoiceCommandListener`).
  - ✅ Rust/WASM kernel `v0.2.0` established as sole production analytical authority (85 Rust tests, 0 JS formula fallbacks).
  - ✅ AtlasCore established as single analytical coordinator (`src/atlas/AtlasCore.ts`).
  - ✅ 100% pure TypeScript codebase (`src/` and `tests/`) with zero compilation errors.
- **Exit Criteria Met:** No duplicate analytical or Draco engines coexist; WASM kernel unavailability produces an explicit degraded state rather than a silent JS calculation fallback.

### Gate 1 — Understand 🔄 (In Progress — Sprint 27.1 & 27.3)
- **Objective:** Create a first-class `Investigation` domain aggregate and decouple analytical meaning from rendering.
- **Deliverables:**
  - [x] Initial `InvestigationBranchManager.ts` DAG support.
  - [ ] Formal `Investigation` domain aggregate with explicit Task/Hypothesis model, immutable dataset references, and analytical state linkage.
  - [ ] Deterministic investigation serialization and deserialization independent of Three.js.
- **Exit Criteria:** An analyst can initialize an Investigation, execute analytical operations, save it, and reopen it in a headless environment with identical analytical state.

### Gate 2 — Represent 🔄 (In Progress — Sprint 27.2)
- **Objective:** Make representation selection explicit, explainable, and research-safe.
- **Deliverables:**
  - [x] Rust WASM 3D layouts (`force_directed`, `grid`, `time_ribbon`, `geo_surface`, `streamline`, `radial_tree`).
  - [x] Draco constraint solver in Rust (`wasm/src/draco/solver.rs`) and TypeScript `FactProvider` pattern.
  - [x] `DracoExplainerPanel.ts` plain-English representation rationale.
  - [x] Position semantics discipline (`SEMANTIC`, `STRUCTURAL`, `ALGORITHMIC_LAYOUT`).
  - [ ] Formal `RepresentationRequirements` schema and Atlas Constraint Arbiter.
  - [ ] Hierarchical `SpatialStrategy` decomposable type.
- **Exit Criteria:** Given identical Investigation state and frozen study inputs, Draco produces identical spatial strategies with machine-readable explanations of why alternatives were rejected.

### Gate 3 — Experience 🔄 (Analyst Cockpit Baseline Complete, Need to Revisit)
- **Objective:** Deliver a coherent, low-strain analyst cockpit in VR and 2D.
- **Deliverables:**
  - [x] Authoritative 4-mode `InteractionModeController.ts` (`NAVIGATE | INTERACT | TRANSFORM | OBSERVE`).
  - [x] Unified `FocusState` vocabulary (`idle`, `focused`, `hovered`, `armed`, `confirmed`, `disabled`, `busy`).
  - [x] 3-level forgiving `HandWheelCategorizer.ts` with gaze+confirm target acquisition.
  - [x] Intent-based `ContextualTaskSurface.ts` and `PanelRolesManager.ts` (max 2 task panels rule).
  - [x] `TransientContextCards.ts` for auto-dismissing notifications.
  - [x] `ProgressiveDisclosure.ts` gating (`NOVICE | ANALYST | RESEARCHER | DEVELOPER`).
  - [x] Mode-aware `GestureOwnershipManager.ts` eliminating silent both-pinch suppression.
  - [x] Semantic `StatusStripController.ts` and `UXAcceptanceGate.ts` evaluation suite.
- **Exit Criteria NOT Met Need to revisit:** A novice can complete the primary investigation journey without encountering pointer aim-drift frustration or gesture collisions.

### Gate 4 — Investigate 🔄 (Sprint 27.3)
- **Objective:** Make findings, observations, and human decisions first-class research evidence.
- **Deliverables:**
  - [x] Initial `ResearchEvent` ledger in AtlasCore.
  - [ ] First-class `Observation`, `Finding`, and `Annotation` entity models.
  - [ ] In-VR "Mark Moment" evidence capture workflow.
  - [ ] Evidence-to-analysis linking and explainability views.
- **Exit Criteria:** A saved Investigation can explain what was discovered, when, where in space, and by which analytical and human actions.

### Gate 5 — Reproduce 🔄 (Sprint 27.2 & 27.3)
- **Objective:** Turn the Memory Palace into investigation version control with portable `.nemosyne` packages.
- **Deliverables:**
  - [x] `InvestigationBranchManager.ts` branch forking and history diffing.
  - [x] `ShareableSessionURL.ts` state serialization.
  - [ ] `.nemosyne` ZIP package schema with integrity manifests (dataset fingerprint, kernel version, ABI, graph hash).
  - [ ] Memory Palace regeneration from semantic state without requiring cached scene geometry.
  - [ ] 3-level reproducibility verification (Semantic, Analytical, Spatial).
- **Exit Criteria:** A `.nemosyne` package shared between independent runtime instances regenerates the identical analytical state and spatial Memory Palace.

### Gate 6 — Study ✅ (Empirical Study Engine Complete)
- **Objective:** Make the system scientifically usable as a controlled research instrument.
- **Deliverables:**
  - [x] `StudyHarness.ts` randomized crossover trial runner (`2D_CONTROL` vs `VR_EXPERIMENTAL`).
  - [x] `Counterbalancer.ts` Latin-square trial sequencing.
  - [x] `StudyStatisticalAnalyzer.ts` computing two-sample t-tests, degrees of freedom, p-values, and Cohen's d effect sizes.
  - [x] `StudyDataExporter.ts` research publication CSV exports.
  - [x] `QuestFieldTrialSuite.ts` automated on-device hardware envelope validation.
- **Exit Criteria Met:** Synthetic and live trial batches produce joined telemetry, condition, observer, and outcome records with frozen treatment variables.

### Gate 7 — Adaptive Research ⏳ (Post-Stable Release)
- **Objective:** Learn from empirical human evidence without self-reinforcing bias.
- **Deliverables:**
  - [x] `DracoEmpiricalTuner.ts` layout utility prior weight adjustment from study accuracy and NASA-TLX workload.
  - [x] `GestureRetrainService.ts` user-disjoint evaluation and staged deployment.
  - [ ] Federated learning and drift monitoring across multi-site deployments (deferred post-public release).
- **Exit Criteria:** Adaptive updates demonstrably improve task completion without invalidating experimental protocols.

---

## Active & Upcoming Sprints: Limited Public Testing Release

```mermaid
graph TD
    S1["Sprint 27.1: Modularization & Contracts"] --> S2["Sprint 27.2: OSS Libraries & .nemosyne Pkg"]
    S2 --> S3["Sprint 27.3: Investigation Graph Spine"]
    S3 --> S4["Sprint 27.4: Public Testing Polish & Resilience"]
    S4 --> S5["Sprint 27.5: Security & Network Hardening"]
    S5 --> S6["Sprint 27.6: Reliability & Frame Budgets"]
    S6 --> PR["LIMITED PUBLIC TESTING RELEASE"]
```

### Sprint 27.1 — Subsystem Modularization & Strict Contract Boundaries
- **Goal:** Cleanly separate the 8 principal subsystems, establish barrel exports, and eliminate circular dependencies and direct internal state mutations.
- **Scope:**
  - Define explicit module boundaries for `src/investigation/`, `src/atlas/`, `src/representation/`, `src/study/`, `src/network/`, `src/perception/`, `src/vr/`, and `src/session/`.
  - Introduce typed public API interfaces (`index.ts`) per module.
  - Expand `tests/architectural-invariants.test.ts` to assert that no module imports private internals of another module.
- **Exit Gate:** `tsc --noEmit` 0 errors, `eslint` 0 errors, architectural invariant suite passes.

### Sprint 27.2 — Core Open Source Library Adoption (Phase 1 Foundation)
- **Goal:** Import trusted, mature OSS libraries with tree-shaken named imports to replace hand-rolled code and simplify long-term maintenance ([`docs/STANDARDIZATION_REVIEW.md`](STANDARDIZATION_REVIEW.md)).
- **Scope:**
  - **Schema Validation (`valibot` / `zod`):** Add schema validation for `.nemosyne` package manifests, signed tickets, and study trial configs (<1.8 kB tree-shaken).
  - **Zero-Dependency Packaging (`fflate`):** Implement `.nemosyne` ZIP package archiving and streaming decompression in browser/node (~7.8 kB).
  - **Spatial Raycasting Acceleration (`three-mesh-bvh`):** Accelerate spatial indexing and gaze/pointer hit-testing for 100k node point clouds with 10x-100x speedups (~11 kB).
  - **Smooth Spatial Animation (`@tweenjs/tween.js`):** Standardize camera transitions, panel docking, and landmark zooms with deterministic easing curves (~3.6 kB).
  - **Rust Kernel Scientific Standardizations (`petgraph` + `statrs`):** Standardize graph structures and exact probability distribution tests (t-test, Wilcoxon, CDFs) in `wasm/Cargo.toml`.
  - **Colorimetry & CVD Accessibility (`colord`):** Perceptually uniform Oklch palettes and automated color vision deficiency compliance (<1.6 kB).
  - **Typed Event Dispatch (`nanoevents`):** Zero-overhead 100-byte typed event dispatcher.
- **Exit Gate:** Package creation and unpack tests pass; raycast latency on 50k nodes is <2ms; `cargo test` passes with extended numerical fixtures.

### Sprint 27.3 — Investigation Aggregate, Typed Graph Spine & Vertical Slice Invariant (Gate 1 & Gate 5)
- **Goal:** Implement the authoritative `Investigation` domain aggregate, typed lineage graph, and the end-to-end "golden path" vertical slice test.
- **Scope:**
  - Create `Investigation` aggregate owning task, dataset reference, operation chain, evidence ledger, observations, findings, and provenance.
  - Define versioned node and edge vocabulary (`motivates`, `uses-dataset`, `produces`, `observes`, `supports`, `branches-from`).
  - Wire `.nemosyne` package export and import to reconstruct investigations from the typed graph.
  - **Canonical Vertical Slice Invariant Test (`tests/golden-path-vertical-slice.test.ts`):** Assert that a complete investigation survives the entire system without semantic drift across fixed hash checkpoints:
    $$\text{Known Dataset Fixture} \longrightarrow \text{Dataset Fingerprint} \longrightarrow \text{Kernel Result Hashes} \longrightarrow \text{Atlas Event Ledger}$$
    $$\longrightarrow \text{Draco Recommendation} \longrightarrow \text{Representation Manifest} \longrightarrow \text{Observation} \longrightarrow \text{Finding}$$
    $$\longrightarrow \text{.nemosyne Package Export} \longrightarrow \text{Clean-Room Replay Verification}$$
- **Exit Gate:** Vertical slice invariant test passes with 100% deterministic hash parity; replay test suite verifies complete semantic reconstruction across clean environments.

### Sprint 27.4 — Diegetic Spatial UI, Gesture Tracking & Crash Resilience (Phase 3 Modernization)
- **Goal:** Modernize spatial UX, replace canvas bitmap blitting, streamline gesture classification, and harden error boundaries.
- **Scope:**
  - **MSDF Vector UI & Menus (`three-mesh-ui`):** Replace Canvas 2D bitmap texture uploads with fragment-shader MSDF vector text and Flexbox 3D layouts, saving ~45 MB GPU heap memory on Quest 3S.
  - **1-Shot Spatial Gesture Recognizer (`$3D` + `onnxruntime-web/wasm`):** Adopt geometric template matching for 1-shot user gesture definitions, retiring brittle angle heuristics.
  - **WebGL Context Loss & Recovery:** Implement auto-recovery and scene state restoration on `webglcontextlost` / `webglcontextrestored`.
  - **Diegetic Error Boundaries:** Replace abrupt console errors with graceful, user-facing recovery cards and reload triggers in VR.
  - **Selective Quest MR Adapter (`iwsdk`):** Lazy-load optional spatial anchoring and MR passthrough composition on Meta Quest Browser.
- **Exit Gate:** Simulating WebGL context loss restores state within 1 second; zero unhandled exceptions reach top-level window; text remains pin-sharp at glancing angles in VR.

### Sprint 27.5 — Security, Input Sanitization & Network Hardening
- **Goal:** Ensure safe operation during public preview testing.
- **Scope:**
  - **Turnkey WebRTC Signalling (`peerjs-server` / `y-webrtc`):** Standardize peer room brokering, eliminating ~900 lines of custom server code while maintaining zero vendor lock-in.
  - **File Size & Schema Enforcement:** Reject malicious or oversized CSV/JSON/Arrow uploads before memory allocation.
  - **Collaboration Security:** Enforce in-band HMAC-SHA256 signed ticket verification, IP auth rate limiting, and room idle reaping.
  - **Privacy & Telemetry Consent:** Guarantee opt-in consent for telemetry, pseudonymous hashing, and GDPR right-to-erasure deletion hooks.
- **Exit Gate:** Adversarial security test suite passes 100%.

### Sprint 27.6 — Reliability, Memory Leak Prevention, Quest 3S Frame Budget & CI Gate Hardening
- **Goal:** Guarantee rock-solid 72 Hz / 90 Hz rendering on Meta Quest 3S hardware and enforce blocking CI system-level verification before Stable Alpha.
- **Scope:**
  - **Zero-Allocation Hot Loops:** Eliminate per-frame scratch object allocations in `three-mesh-bvh`, `LODManager`, and `InputRouter`.
  - **GPU Resource Lifecycle:** Ensure 100% disposal of geometries, materials, and textures on palace rebuilds.
  - **Automated Memory Profiling:** Run automated 4-tier E2E suites verifying JS heap stays <250 MB and 0 memory leaks occur over 1-hour sessions.
  - **CI Gate Promotion (Golden Path Smoke):** Promote Playwright load smoke / golden path system test (`npm run test:smoke`) from informational to a **strictly blocking CI gate** (`.github/workflows/ci.yml`), guaranteeing production bundle boot and WebGL initialization pass before any merge.
- **Exit Gate:** `npm run test:e2e:tier4` scenario 3 passes with zero memory leaks; frame time P95 <= 13.88 ms on Quest 3S; blocking CI smoke gate passes green.

---

## Historical Archive References

Completed phases and sprint details from earlier project iterations are preserved in:
- [docs/archive/ROADMAP_PHASES_21-26_COMPLETED.md](archive/ROADMAP_PHASES_21-26_COMPLETED.md) — Phases 21–26 (Rust WASM Kernel, UX V2.0, Gesture Intelligence, Cockpit FSM, Quest Hardware Envelopes, Empirical Recommender Tuning).
- [docs/archive/ROADMAP_PHASES_1-20_COMPLETED.md](archive/ROADMAP_PHASES_1-20_COMPLETED.md) — Phases 1–20 (Foundations, Spec, Artefact Library, Scaling, Analytics, Collaboration Scaffolding, Graphics Engine).
- [docs/archive/ROADMAP_HISTORY.md](archive/ROADMAP_HISTORY.md) — Comprehensive archive index and superseded planning models.

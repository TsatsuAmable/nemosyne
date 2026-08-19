# Completed Roadmap Archive: Phases 21–26 & Waves 0–6

> **Archived Historical Document.** This document captures completed work from Phases 21 through 26 and Waves 0 through 6 (August 2026). It is preserved for auditability and historical context. Do not use this document to determine active project status or future sprint commitments.
>
> The governing product and implementation specification is [`../Nemosyne_Definitive_Vision_and_Roadmap.md`](../Nemosyne_Definitive_Vision_and_Roadmap.md).
> The active, forward-looking roadmap is [`../ROADMAP.md`](../ROADMAP.md).

---

## Summary Index of Completed Phases & Waves

| Phase / Wave | Title / Focus | Completion Summary | Key Deliverables & Test Suites |
|---|---|---|---|
| **Wave 0** | Security P0, Dead Code & Hygiene | Dev endpoints bounded, path traversal resolved, constant-time tokens, file size limits. | `RemoteDebugStreamer`, `FileLoader` size checks, Netlify CI consolidation. |
| **Wave 1** | Rust Analytical Kernel ABI (`v0.2.0`) | Deterministic computational substrate: FNV-1a UTF-16 fingerprinting, predicate DSL, statistics, TDA Mapper. | `wasm/src/data/`, `wasm/src/provenance.rs`, `RuntimeBridge.ts` wrappers (85 Rust tests). |
| **Wave 2** | Mandatory WASM Analytical Cutover | JS analytical fallback eliminated; Rust kernel established as sole analytical authority. | `DataOperationController._computeDataset` kernel routing, hard "WASM unavailable" state. |
| **Wave 3** | Orphaned JS Analytical Module Cleanup | Deleted 7 legacy JS analytical engines (`DatasetOperations`, `CSVDataParser`, `TDAMapper`, etc.). | Commit `367cdcd`, clean separation of visual helpers vs computation. |
| **Wave 4** | AtlasCore & NemosyneSession | Single analytical authority owning kernel handle, DatasetSpace, AnalysisResult chain, and provenance ledger. | `src/atlas/AtlasCore.ts`, `src/session/NemosyneSession.ts` (`tests/atlas-core.test.ts`). |
| **Wave 5** | Draco as Pure Embodiment Consumer | Draco performs zero statistical extraction; AtlasCore acts as authoritative `FactProvider`. | `src/draco/ConstraintEngine.ts`, `FactProvider` interface (`tests/evidence-draco.test.ts`). |
| **Wave 6** | Full AtlasCore Routing & Number Parity | All production kernel calls routed via AtlasCore; ledger-derived history; ECMAScript number stringification. | `fingerprint.rs` ECMAScript parity, `_tdaCall` transient handles, clean disposal. |
| **Phase 21** | Rust/WASM Migration | 3D spatial layout simulation (force-directed, grid, time ribbon, geo surface, streamline) & Draco solver in WASM. | `wasm/src/layouts/`, `wasm/src/draco/solver.rs`, continuous Float32Array coordinate bridges. |
| **Phase 22** | UX V2.0: Low-Strain Spatial Interface | TDA glyphs, accessibility steppers, embodied peer avatars, binary quaternion pose, GPU resource disposal. | `ObjectPool` teardown, zero-allocation hot paths, `StatusStripController`. |
| **Phase 23** | Gesture Intelligence & Retraining | 56-dim feature vector, heuristic+ONNX classifier, on-device threshold tuning, consent-gated upload pipeline. | `modules/gesture-intelligence/`, `GestureIntelligenceAdapter`, `GestureRetrainService`. |
| **Phase 24** | Analyst Cockpit & Interaction Hierarchy | InteractionMode FSM (`NAVIGATE/INTERACT/TRANSFORM/OBSERVE`), forgiving 3-level HandWheel, contextual panels. | `InteractionModeController`, `HandWheelCategorizer`, `PanelRolesManager`, `TransientContextCards`. |
| **Phase 25** | Multimodal Perception & On-Device Trials | Quest 3S hardware envelope validation (<13.88ms frame time, <250MB heap), aim-drift mitigation. | `QuestFieldTrialSuite`, `UXHypothesisTriageEngine`, `PositionSemanticClassifier`. |
| **Phase 26** | Empirical Recommender Tuning & Study Eval | 2D-vs-VR statistical analyzer (t-tests, Cohen's d, NASA-TLX), empirical Draco utility tuner. | `StudyStatisticalAnalyzer`, `DracoEmpiricalTuner`, `InvestigationBranchManager`. |

---

## Detailed Sprint & Wave Completion Logs

### Sprint 26.2: Evidence-Informed Draco Recommender Adaptive Loop
- **Empirical Recommender Tuner:** Implemented `DracoEmpiricalTuner` (`src/draco/evidence/DracoEmpiricalTuner.ts`) connecting empirical study trial outcomes (accuracy, completion duration, and NASA-TLX workload) directly to Draco layout utility weights and topology preference costs.
- **Adaptive Preference Scoring:** Promotes spatial representations demonstrating statistically superior task performance while penalizing configurations with high cognitive workload.
- **Unit Test Suite:** Added `tests/draco-empirical-tuner.test.ts` testing empirical weight adjustments, topology preference tuning, and solver override weight synthesis.
- **Gates:** `tsc --noEmit` 0 errors · `eslint` 0 errors · `npm test` 217/217 test files passed (1,444 passed / 26 skipped jsdom-WASM parity by design) · `cargo test` 85/85 passed · `npm run build` exit 0.

### Sprint 26.1: Semantic vs. Structural Position Discipline & Disambiguation Engine
- **Position Semantics Classifier:** Implemented `PositionSemanticsEngine` (`src/draco/PositionSemantics.ts`) distinguishing `SEMANTIC` (coordinates directly map geographic/temporal/vector variables), `STRUCTURAL` (coordinates expose topological graph edges/clusters), and `ALGORITHMIC_LAYOUT` (procedural grid/ring spacing with no semantic distance equivalence).
- **Diegetic Proximity Warning System:** Adds structured warnings to HUD tooltips preventing analysts from falsely assuming that geometric proximity in force-directed graphs or procedural grids implies underlying attribute similarity.
- **Unit Test Suite:** Added `tests/position-semantics-discipline.test.ts` testing layout classification, badge color assignment, and HUD warning formatting.

### Milestone 25.3: 2D-vs-VR Statistical Analysis Engine & Empirical Study Evaluation
- **Empirical Statistical Analyzer:** Implemented `StudyStatisticalAnalyzer` (`src/study/StudyStatisticalAnalyzer.ts`) computing two-sample t-tests, degrees of freedom, p-value estimates via standard Abramowitz-Stegun error function approximation, and Cohen's d effect sizes across task completion duration, anomaly isolation accuracy, F1 score, confidence, and NASA-TLX workload scores.
- **Structured Markdown Report Synthesis:** Synthesizes structured outcome markdown tables comparing 2D desktop controls vs. VR experimental conditions conforming to `docs/study/ANALYSIS_PLAN.md`.
- **Unit Test Suite:** Added `tests/study-statistical-analyzer.test.ts` verifying two-sample t-tests, Cohen's d effect magnitude classifications, and experiment evaluation reporting.

### Milestone 25.2: Quest 3S On-Device Field Trial Suite Execution
- **Automated Field Trial Suite:** Implemented `QuestFieldTrialSuite` (`src/vr/scalability/QuestFieldTrialSuite.ts`) automating multi-stage load-test probe execution across dataset scales (1k, 5k, 20k, 50k, 100k nodes) validating Quest 3S physical compute envelopes (72 Hz / 13.88ms frame budget, <5% dropped frames, <250 MB heap).
- **Audit Certificate Generator:** Generates verifiable field trial compliance certificates with deterministic hashes for research publication bundles.
- **Unit Test Suite:** Added `tests/quest-field-trial-suite.test.ts` testing multi-stage execution, hardware envelope validation, and budget violation reporting.

### Sprint 25.1: Quest Spatial Tracking & Aim-Drift Ergonomics Hardening
- **Aim-Drift Mitigation:** Mitigated pointer ray precision loss by pairing coarse gaze targeting with explicit pinch and dwell confirmation.
- **Biomechanical Zoning:** Enhanced `WorldSpatialContext.ts` with ergonomic reach classification (`SWEET_SPOT`, `NEAR_FIELD`, `EXTENDED`, `PERIPHERAL`).

### Sprint 24.1 through 24.9: Analyst Cockpit & Interaction Hierarchy
- **Sprint 24.1 (Interaction Mode FSM):** Authoritative `NAVIGATE | INTERACT | TRANSFORM | OBSERVE` modes in `InteractionModeController.ts`; unified `FocusState` vocabulary.
- **Sprint 24.2 (HandWheel Categorization):** Analyst-intent categories (`ANALYSE | VIEW | DATA | STUDY | COLLABORATE | SYSTEM`) and gaze+confirm state machine in `HandWheelCategorization.ts`.
- **Sprint 24.3 (Task Surface Decomposition):** `ContextualTaskSurface.ts` filtering actions dynamically by topology, replacing monolithic 29-button menu walls.
- **Sprint 24.4 (Panel Roles Taxonomy):** Enforced `workspace | task | context | diagnostic | transient | system` roles, max 2 task panels rule, and diagnostic gating to `DEVELOPER` mode.
- **Sprint 24.5 (Transient Context Cards):** Ephemeral cards (`TransientContextCards.ts`) for dataset loaded, recommendation, and drift alerts.
- **Sprint 24.6 (Progressive Disclosure):** Profiles (`NOVICE | ANALYST | RESEARCHER | DEVELOPER`) in `ProgressiveDisclosure.ts`.
- **Sprint 24.7 (Gesture Ownership Redesign):** Contextual both-pinch resolution in `GestureOwnershipManager.ts` with zero silent suppression.
- **Sprint 24.8 (Calm Visual Language & Status Strip):** Semantic palette and persistent status strip in `StatusStripController.ts`.
- **Sprint 24.9 (UX Acceptance Quality Gates):** Quantitative CI quality gate evaluator (`UXAcceptanceGate.ts`) tracking UX-001 through UX-012.

### Sprints 23.1 through 23.5: Gesture Intelligence & Lifecycle
- **Sprint 23.1 (Host Integration):** `GestureIntelligenceAdapter.ts` translating Three.js hand tracking into `HandSample` records for `@nemosyne/gesture-intelligence`.
- **Sprint 23.2 (Personalization Loop):** In-experience capture and closed-loop threshold coordinate-search optimization.
- **Sprint 23.3 (Global Capture Pipeline):** Consent-gated upload pipeline with Tier A (56-dim feature only, zero raw biometric coordinates) and rotatable pseudonymous hashes.
- **Sprint 23.4 (Retraining Service):** Central training pipeline with user-disjoint evaluation splits.
- **Sprint 23.5 (Drift Monitoring):** Anonymous heuristic vs ONNX divergence tracking and drift alerts.

### Waves 0 through 6: Rust Analytical Kernel, AtlasCore & Session Provenance
- **Wave 0:** Security hardening, bounded dev endpoints, path traversal fix, constant-time token compare.
- **Wave 1:** Canonical versioned ABI (`v0.2.0`), FNV-1a UTF-16 code unit fingerprinting, Predicate DSL, ndarray correlation.
- **Wave 2:** Complete cutover to Rust kernel for all analytical operations.
- **Wave 3:** Deletion of orphaned JS analytical modules.
- **Wave 4:** `AtlasCore.ts` single analytical authority and `NemosyneSession.ts` schema v2 session serialization.
- **Wave 5:** Draco transformed into pure embodiment consumer; AtlasCore as `FactProvider`.
- **Wave 6:** All kernel call sites routed through AtlasCore; ledger-derived history; ECMAScript number stringification parity.

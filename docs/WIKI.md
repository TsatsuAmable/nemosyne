# Nemosyne — Comprehensive Codebase Wiki & Symbol Index

**Purpose:** Complete reference dictionary of all primary classes, modules, interfaces, coordinators, and functions across the Nemosyne repository.

---

## 1. Subsystem Index

- [Data & Analytical Substrate](#1-data--analytical-substrate)
- [Draco Representation & Layout Engine](#2-draco-representation--layout-engine)
- [Atlas & Investigation State](#3-atlas--investigation-state)
- [Spatial Runtime & VR Cockpit (Phase 24)](#4-spatial-runtime--vr-cockpit-phase-24)
- [Input, Gestures & Locomotion](#5-input-gestures--locomotion)
- [Session, Replay & Version Control](#6-session-replay--version-control)
- [Research Harness & Study Protocol](#7-research-harness--study-protocol)
- [Collaboration & Networking](#8-collaboration--networking)
- [Scalability & Performance](#9-scalability--performance)

---

## 1. Data & Analytical Substrate

### Classes & Modules
- **`Dataset`** (`src/data/Dataset.ts`): Primary in-memory analytical tabular structure. Owns columns, rows, metadata, and computes content-addressed FNV-1a fingerprints.
- **`DataOperationController`** (`src/vr/coordinators/DataOperationController.ts`): Analytical UI coordinator dispatching operations (`filter`, `sort`, `kmeans`, `dbscan`, `hierarchical`, `anomaly`, `slice`, `aggregate`) through `AtlasCore` to the Rust WASM kernel.
- **`AnalysisHistory`** (`src/data/AnalysisHistory.ts`): Reversible operation frame stack recording transformation parameters and row counts.
- **`PositionSemanticClassifier`** (`src/data/PositionSemanticClassifier.ts`): Categorizes spatial coordinates into `SEMANTIC`, `STRUCTURAL`, and `LAYOUT` roles to prevent false perceptual inferences.
- **`FileLoader`** (`src/data/FileLoader.ts`): Ingests CSV, JSON, and Arrow binary ArrayBuffers and routes parsing directly through `AtlasCore.parseBytes()` to native Rust WASM parsers (`wasm/src/data/parsers.rs`).

---

## 2. Draco Representation & Layout Engine

### Classes & Modules
- **`ConstraintEngine`** (`src/draco/ConstraintEngine.ts`): Symbolic constraint recommender. Extracts dataset facts, evaluates hard/soft constraints across 3,168 candidate specifications, and yields min-cost spatial representations.
- **`EvidenceInformedRecommender`** (`src/draco/EvidenceInformedRecommender.ts`): Empirically informed feedback loop that updates Draco prior weights based on human study outcome success rates.
- **`VRTopologyTranslator`** (`src/draco/VRTopologyTranslator.ts`): Synthesizes Three.js visual artifacts (`GRID_3D`, `FORCE_DIRECTED_3D`, `RADIAL_ORBITAL`, `TIME_SERIES_RIBBON`, `VECTOR_STREAMLINE`, `GEOSPATIAL_SURFACE`, `CLUSTER_VOLUME`, `AGGREGATE_BARS`).
- **Layouts** (`src/draco/layouts/*`): `GridLayout3D`, `ForceDirected3D`, `RadialTreeLayout`, `TimeSeriesRibbonLayout`, `StreamlineLayout`, `GeoSurfaceLayout`.

---

## 3. Atlas & Investigation State

### Classes & Modules
- **`AtlasCore`** (`src/atlas/AtlasCore.ts`): Master Application Service coordinator orchestrating the `InvestigationAggregate` domain model with the Rust/WASM analytical kernel, WorldEventBus, and GuidanceEngine.
- **`InvestigationAggregate`** (`src/atlas/domain/InvestigationAggregate.ts`): Domain aggregate root encapsulating `AnalyticalState`, `EvidenceLedger`, `RepresentationState`, `DecisionHistory`, `ResearchContext`, and `InvestigationGraph`.
- **`EvidenceLedger`** (`src/atlas/domain/EvidenceLedger.ts`): Authoritative append-only provenance event stream, storing and linking first-class `Observation`, `Finding`, and `Annotation` entities to dataset versions and analytical transformations.
- **`InvestigationGraph`** (`src/atlas/domain/InvestigationGraph.ts`): Directed Acyclic Graph (DAG) spine maintaining typed investigation nodes, branch forks, and evidence edges.
- **`DatasetSpace`** (`src/atlas/DatasetSpace.ts`): Renderer-independent spatial representation with stable datum IDs, spatial provenance, and distance metrics.
- **`GuidanceEngine`** (`src/atlas/GuidanceEngine.ts`): Generates explainable recommendations exposing target, analytical action, rationale, evidence, and confidence.

---

## 4. Spatial Runtime & VR Cockpit (Phase 24)

### Classes & Modules
- **`StatusStripController`** (`src/vr/ui/StatusStripController.ts`): 1-line persistent context strip (`TOPOLOGY · MODE · FOCUS · ACTION`) with calm semantic color roles.
- **`HandWheelCategorizer`** (`src/vr/ui/HandWheelCategorization.ts`): 3-level intent categorizer (`ANALYSE | VIEW | DATA | STUDY | COLLABORATE | SYSTEM`) with gaze acquisition and pinch confirmation.
- **`ContextualTaskSurface`** (`src/vr/ui/ContextualTaskSurface.ts`): Filters active analytical tools matched to dataset topology.
- **`PanelRolesManager`** (`src/vr/ui/PanelRolesManager.ts`): Manages spatial role taxonomy (`workspace`, `task`, `context`, `diagnostic`, `transient`, `system`) and caps concurrent task panels to max 2.
- **`TransientContextCardManager`** (`src/vr/ui/TransientContextCards.ts`): Spawns ephemeral auto-dismissing feedback cards.
- **`ProgressiveDisclosureController`** (`src/vr/ui/ProgressiveDisclosure.ts`): 4-tier capability profiles (`NOVICE | ANALYST | RESEARCHER | DEVELOPER`).
- **`MovablePanel`** (`src/vr/ui/MovablePanel.ts`): Base class for draggable, depth-clamped, text-scaled canvas UI panels in 3D space.

---

## 5. Input, Gestures & Locomotion

### Classes & Modules
- **`PointerRayFilter`** (`src/vr/input/PointerRayFilter.ts`): Speed-adaptive 1-Euro smoothing filter over 3D ray origins and directions; eliminates hand tremor and aim-drift during long-range pointing on Quest 3S.
- **`MarkMomentAction`** (`src/vr/interactions/MarkMomentAction.ts`): In-VR spatial evidence capture workflow recording camera pose, dataset state, and focal cluster into an `Observation`.
- **`InteractionModeController`** (`src/vr/input/InteractionModeController.ts`): Governs authoritative interaction states (`NAVIGATE | INTERACT | TRANSFORM | OBSERVE`).
- **`GestureOwnershipManager`** (`src/vr/input/GestureOwnershipManager.ts`): Routes both-pinch gestures contextually with zero silent suppression and enforces $\ge 2$ input modalities per operation.
- **`HandGestureRecognizer`** (`src/vr/interactions/HandGestureRecognizer.ts`): Dual-hand pinch, slice, scoop, push, and rotate gesture detector.
- **`SelectionDispatcher`** (`src/vr/input/SelectionDispatcher.ts`): Coordinates raycasts, hover states, and per-frame dwell selection countdown.
- **`Locomotion`** (`src/vr/navigation/Locomotion.ts`): Parabolic arc teleportation preview, snap turn, ground movement, and flight.

---

## 6. Session, Replay & Version Control

### Classes & Modules
- **`NemosynePackageManager`** (`src/session/NemosynePackage.ts`): `.nemosyne` ZIP package archiver and extractor with `valibot` schema-validated integrity manifests.
- **`InvestigationReplayRunner`** (`src/session/InvestigationReplayRunner.ts`): Clean-room headless replay and verification engine asserting bit-for-bit analytical and evidence parity without WebGL or DOM.
- **`InvestigationBranchManager`** (`src/session/InvestigationBranchManager.ts`): Directed Acyclic Graph (DAG) for investigation version control, branch forks, and operation diffing.
- **`WorldSessionController`** (`src/session/WorldSessionController.ts`): SchemaVersion-2 IndexedDB session persistence and state restore.
- **`ShareableSessionURL`** (`src/session/ShareableSessionURL.ts`): Encodes and decodes self-contained, URL-safe session states.

---

## 7. Research Harness & Study Protocol

### Classes & Modules
- **`StudyTrialExecutionHarness`** (`src/study/StudyHarness.ts`): Executes 2D-vs-VR crossover trials capturing timers, correctness, confidence, and NASA-TLX workload.
- **`EvidenceHierarchyRegistry`** (`src/types/EvidenceHierarchy.ts`): Enforces 5-level evidence tracking (🟢 `IMPLEMENTED` → 🔵 `TESTED` → 🟡 `USABLE` → 🟠 `USEFUL` → 🔴 `SUPERIOR`).
- **`UXHypothesisTriageEngine`** (`src/vr/trace/UXHypothesisTriage.ts`): Produces non-dogmatic dual hypotheses and observational checks for interaction signals.
- **`UXAcceptanceGateEvaluator`** (`src/vr/trace/UXAcceptanceGate.ts`): CI quality gate evaluator for `UX-001` through `UX-004`.
- **`StudyDataExporter`** (`src/study/StudyDataExporter.ts`): Exports structured research bundles and standard statistical analysis CSVs.

---

## 8. Collaboration & Networking

### Classes & Modules
- **`NetworkManager`** (`src/network/NetworkManager.ts`): WebRTC mesh coordinator with per-peer data channels and token gating.
- **`SignallingServerCore`** (`src/network/SignallingServerCore.ts`): Standalone WebSockets signalling hub.
- **`ConnectorAuthManager`** (`src/network/ConnectorAuth.ts`): Token authorization, scope gating (`READ_DATASET | WRITE_DATASET | STREAM_TELEMETRY | ADMIN`), and rate limiting.
- **`PeerPresenceHUD`** (`src/vr/ui/PeerPresenceHUD.ts`): Live 2D canvas radar showing peer positions, names, and direction arrows.

---

## 9. Scalability & Performance

### Classes & Modules
- **`InstancedPointCloud`** (`src/vr/scalability/InstancedPointCloud.ts`): Single draw-call GPU instanced mesh for rendering 100k+ points at high frame rates.
- **`SpatialIndex`** (`src/vr/scalability/SpatialIndex.ts`): Uniform grid 3D-DDA fast raycaster.
- **`LODManager`** (`src/vr/scalability/LODManager.ts`): Distance, frustum, and gaze cone level-of-detail culling.
- **`AdaptiveFrameGovernor`** (`src/vr/scalability/AdaptiveFrameGovernor.ts`): Dynamically scales rendering density to protect frame budgets.
- **`QuestProbeAnalyzer`** (`src/vr/scalability/QuestProbeAnalyzer.ts`): Evaluates on-device load-test probe logs against Quest spatial compute budgets.

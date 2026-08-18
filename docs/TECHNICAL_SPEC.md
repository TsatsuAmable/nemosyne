# Nemosyne — Technical Specification Document

**Version:** 5.0 (Governing Technical Architecture)  
**Date:** 18 August 2026  
**Language Stack:** 100% Pure TypeScript (`src/`, `tests/`), Rust/WASM (`wasm/src/`), Three.js (0.168.0 pinned), WebXR Device API.

---

## 1. System Overview & Invariant Pipeline

Nemosyne executes a deterministic, reproducible spatial investigation pipeline:

```text
CSV/JSON Ingestion ──▶ WASM Fast Parser ──▶ Dataset (FNV-1a Fingerprint)
                                                    │
                                                    ▼
Research Context ─────▶ Atlas Core ────────▶ Rust Analytical Kernel
                                                    │
                                                    ▼
Representation Requirements ───────────────▶ Draco Solver (3,168 specs)
                                                    │
                                                    ▼
Position Semantic Classifier ──────────────▶ Spatial Strategy
                                                    │
                                                    ▼
Spatial Runtime (Three.js/WebXR) ──────────▶ Analyst Cockpit (FSM)
                                                    │
                                                    ▼
Human Actions / Telemetry ─────────────────▶ Evidence Ledger & Study Exporter
```

---

## 2. Subsystem Architecture

### 2.1 Rust/WASM Computational Kernel (`wasm/src/`)
- **Memory Model:** Shared linear WebAssembly buffer using zero-copy byte offsets `(ptr, len)`.
- **Determinism:** PRNG seeded from dataset content hash (`rand_chacha`).
- **Mathematical Capabilities:**
  - **Statistics (`statistics.rs`):** Skew, kurtosis, variance, entropy, Pearson correlation with NaN handling.
  - **Operations (`operations.rs`):** k-means++, DBSCAN, single/complete/average agglomerative clustering, IQR/Z-score anomaly detection, filter, sort, slice.
  - **Topological Data Analysis (`topology.rs`):** TDA Mapper graph, 1D-persistence barcode intervals, Betti-0 radius sample curves.

### 2.2 Atlas State & Investigation Graph (`src/atlas/`, `src/session/`)
- **State Ownership:** Authoritative holder of active dataset, operation chain, and discovered structures.
- **Investigation DAG:** [`InvestigationBranchManager.ts`](file:///Users/tsatsuamable/Documents/nemosyne/src/session/InvestigationBranchManager.ts) supports branching, fork history, and cross-branch operation diffing.

### 2.3 Draco Constraint Solver & Position Semantics (`src/draco/`, `src/data/`)
- **Spec Search Space:** Evaluates 3,168 candidate visual specifications scored across weighted soft constraints.
- **Position Classification:** [`PositionSemanticClassifier.ts`](file:///Users/tsatsuamable/Documents/nemosyne/src/data/PositionSemanticClassifier.ts) categorizes coordinates into `SEMANTIC`, `STRUCTURAL`, and `LAYOUT` to prevent false perceptual inferences.
- **Empirical Recommender Loop:** [`EvidenceInformedRecommender.ts`](file:///Users/tsatsuamable/Documents/nemosyne/src/draco/EvidenceInformedRecommender.ts) adjusts rule prior weights based on human task success and perceived workload.

### 2.4 Analyst Cockpit & Interaction Architecture (`src/vr/`)
- **Authoritative Interaction FSM:** Governed by [`InteractionModeController.ts`](file:///Users/tsatsuamable/Documents/nemosyne/src/vr/input/InteractionModeController.ts) (`NAVIGATE | INTERACT | TRANSFORM | OBSERVE`).
- **Shared Focus Vocabulary:** `idle`, `focused`, `hovered`, `armed`, `confirmed`, `disabled`, `busy`.
- **Navigation:** Three-level [`HandWheelCategorizer.ts`](file:///Users/tsatsuamable/Documents/nemosyne/src/vr/ui/HandWheelCategorization.ts) organizing 6 categories (`ANALYSE | VIEW | DATA | STUDY | COLLABORATE | SYSTEM`) with gaze intent acquisition and pinch confirmation.
- **Spatial Panel Roles:** [`PanelRolesManager.ts`](file:///Users/tsatsuamable/Documents/nemosyne/src/vr/ui/PanelRolesManager.ts) enforces `workspace`, `task`, `context`, `diagnostic`, `transient`, `system` with a max-2 simultaneous task panel limit.
- **Visual Hierarchy:** [`StatusStripController.ts`](file:///Users/tsatsuamable/Documents/nemosyne/src/vr/ui/StatusStripController.ts) provides a 1-line context answer (`TOPOLOGY · MODE · FOCUS · ACTION`) and calm semantic colors.

### 2.5 Research Harness & Study Protocol (`src/study/`, `src/types/`)
- **2D vs VR Crossover Harness:** [`StudyHarness.ts`](file:///Users/tsatsuamable/Documents/nemosyne/src/study/StudyHarness.ts) logs ground-truth correctness, completion time, Likert confidence, and NASA-TLX workload scores.
- **5-Level Evidence Hierarchy:** [`EvidenceHierarchy.ts`](file:///Users/tsatsuamable/Documents/nemosyne/src/types/EvidenceHierarchy.ts) (🟢 `IMPLEMENTED` → 🔵 `TESTED` → 🟡 `USABLE` → 🟠 `USEFUL` → 🔴 `SUPERIOR`).
- **UX Hypothesis Triage:** [`UXHypothesisTriage.ts`](file:///Users/tsatsuamable/Documents/nemosyne/src/vr/trace/UXHypothesisTriage.ts) generates non-dogmatic dual hypotheses (confusion vs inspection; threshold issue vs enthusiasm) and observational verification checks.

---

## 3. Hardware & Performance Budgets

| Target Headset | Target Frame Rate | Max P95 Frame Time | Max Dropped Rate | Max JS Heap |
|---|---|---|---|---|
| **Meta Quest 3S** | 72 FPS | 13.88 ms | $\le 5\%$ | 250 MB |
| **Meta Quest 3** | 90 FPS | 11.11 ms | $\le 3\%$ | 350 MB |
| **Desktop Emulator** | 60/120 FPS | 16.66 ms / 8.33 ms | $\le 1\%$ | 500 MB |

---

## 4. Security & Network Protocols
- **WebRTC Mesh:** Peer-to-peer data channels with token authentication (`NEMOSYNE_SIGNAL_TOKEN`).
- **Connector Authentication:** Bearer token validation, permission scopes (`READ_DATASET | WRITE_DATASET | STREAM_TELEMETRY | ADMIN`), and 1-second sliding-window rate-limiting in [`ConnectorAuth.ts`](file:///Users/tsatsuamable/Documents/nemosyne/src/network/ConnectorAuth.ts).
- **Privacy Guarantee:** Local-only telemetry with zero external network tracking without explicit participant opt-in consent.

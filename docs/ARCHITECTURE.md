# Nemosyne Technical Architecture & Modular Subsystems Specification

**Governing Spec Reference:** [Nemosyne Definitive Vision & Roadmap](Nemosyne_Definitive_Vision_and_Roadmap.md) (§5, §7, Principles P1–P25)  
**Status:** Canonical Technical Reference  
**Last Updated:** 19 August 2026

---

## 1. Executive Architecture & Core Product Thesis

Nemosyne is built around one governing product thesis:

> **An analytical investigation is something a human does through data, representations, actions, observations and decisions. Nemosyne preserves that whole process, not merely the resulting visualization.**

To achieve this, the architecture maintains a strict separation between **Analytical Truth**, **Semantic Meaning**, **Spatial Representation**, and **Execution Session**:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. RUST / WASM ANALYTICAL KERNEL                                            │
│    Deterministic computational substrate (parsing, stats, TDA, layouts)    │
└──────────────────────────────────────▲──────────────────────────────────────┘
                                       │ ABI (ptr, len, handles, provenance)
┌──────────────────────────────────────┴──────────────────────────────────────┐
│ 2. INVESTIGATION (The Semantic Spine)                                       │
│    Canonical persistent domain object: Task, DatasetVersion, OperationChain,│
│    EvidenceLedger, Observations, Findings, Decisions, Conclusion, Provenance│
└──────────────────────────────────────▲──────────────────────────────────────┘
                                       │ Public Semantic Contracts
┌──────────────────────────────────────┴──────────────────────────────────────┐
│ 3. ATLAS & REPRESENTATION (DRACO)                                           │
│    Orchestration layer: Structure discovery, constraint arbitration, and   │
│    explainable SpatialStrategy selection.                                   │
└──────────────────────────────────────▲──────────────────────────────────────┘
                                       │ SpatialStrategy & Semantic Commands
┌──────────────────────────────────────┴──────────────────────────────────────┐
│ 4. SPATIAL RUNTIME & MEMORY PALACE                                          │
│    WebXR/Three.js embodiment: 4-mode FSM, HandWheel, contextual panels,     │
│    spatial assets, and reconstructible Memory Palace spatial projection.    │
└──────────────────────────────────────▲──────────────────────────────────────┘
                                       │ Attributable Observations / Interventions
┌──────────────────────────────────────┴──────────────────────────────────────┐
│ 5. RESEARCH HARNESS & COLLABORATION ENVELOPE                                │
│    Wraps the product: 2D-vs-VR treatment boundaries, observer stream,       │
│    authenticated peer coordination (never an alternate state authority).   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Canonical Dependency Direction & Boundaries

```text
                    APPLICATION / COMPOSITION ROOT
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
       RESEARCH HARNESS   COLLABORATION   SPATIAL RUNTIME
              │                │                │
              └────────────────┼────────────────┘
                               ▼
                    ATLAS / REPRESENTATION
                         │           │
                         │           ▼
                         │        DRACO
                         │
                         ▼
                    INVESTIGATION
                         │
                       ports
                         │
                         ▼
                    RUST/WASM KERNEL
```

### Strict Boundary Rules (Principles P1–P25):
1. **P2. Sole Analytical Authority:** All research-relevant analytical calculations occur in the versioned Rust/WASM kernel. No JavaScript analytical formula may coexist as an alternative path.
2. **P3. Investigation Owns Meaning:** The `Investigation` aggregate is the sole owner of persistent analytical state, evidence linkage, investigation history, and provenance. Atlas orchestrates but does not own.
3. **P4. Draco Consumes Facts:** Draco does not compute raw-data statistics; it evaluates constraints over validated facts and requirements supplied by Atlas.
4. **P5. Rendering Primitives are Not Authorities:** Crystals, Beams, Orbs, Plinths, and Three.js object graphs are transient visual projections, never semantic identifiers.
5. **P18. One Authority Per Kind of Truth:**
   - Analytical computation → **Rust/WASM Kernel**
   - Investigation meaning & provenance → **Investigation**
   - Analytical orchestration → **Atlas**
   - Representation strategy → **Draco / Representation**
   - Spatial embodiment → **Spatial Runtime**
   - Experimental treatment → **Research Harness**
   - Network admission & protocol → **Collaboration**
   - Perceptual interpretations → **Perception**
6. **P20. No Silent Fallbacks:** When a module (e.g. WASM or WebXR) is unavailable, it enters an explicit degraded state rather than silently substituting a secondary calculation or state model.

---

## 3. The 8 Principal Subsystems

Nemosyne is modularized by **semantic ownership**. Each major subsystem has a defined responsibility, a public contract, an owned class of state or behaviour, and explicit boundaries that prevent it from becoming an alternate authority.

### 3.1 `investigation` — The Persistent Analytical Model
- **Ownership:** Owns the persistent investigation aggregate, question/hypothesis, dataset references, immutable analytical states, operation history DAG, evidence ledger, observations, findings, annotations, analyst decisions, and conclusion.
- **Key Boundary:** Does **not** import Three.js, WebXR, WebSockets, or UI components. Callers interact through semantic commands (`ApplyOperation`, `RecordObservation`, `RecordFinding`, `ForkBranch`) and queries.
- **Key Classes:** `InvestigationAggregate`, `InvestigationGraph`, `InvestigationBranchManager`, `EvidenceLedger` (`Observation`, `Finding`, `Annotation`), `AnalyticalState`, `RepresentationState`, `DecisionHistory`, `ResearchContext`.

### 3.2 `atlas` — Analytical Application Orchestrator
- **Ownership:** Owns the application-level orchestration between the Investigation, the Rust/WASM kernel, structure discovery, and representation requirements. Exposes the Constraint Arbiter.
- **Key Boundary:** Does **not** render scenes, own Three.js state, or define domain truth independently of the Investigation and kernel contracts.
- **Key Classes:** `AtlasCore`, `DatasetSpace`, `GuidanceEngine`, `StructureDiscovery`.

### 3.3 `representation` (Draco) — Spatial Strategy Engine
- **Ownership:** Owns representation requirements, constraints, candidate visual strategies, recommender explanations, and the Draco embodiment adapter.
- **Key Boundary:** Consumes facts; does not compute raw data statistics or mutate Three.js objects directly.
- **Key Classes:** `ConstraintEngine`, `DracoTopologyNode`, `VRTopologyTranslator`, `PositionSemanticsEngine`, `DracoExplainerPanel`, `DracoEmpiricalTuner`.

### 3.4 `research-harness` — Experimental Study Instrument
- **Ownership:** Owns study protocol, treatment configuration (2D control vs VR experimental), participant session identity, Latin-square counterbalancing, observer instrumentation, trial lifecycles, and publication data export.
- **Key Boundary:** Wraps the product and must not silently become part of the participant's treatment unless explicitly specified in a protocol.
- **Key Classes:** `StudyHarness`, `ExperimentRunner`, `Counterbalancer`, `StudyStatisticalAnalyzer`, `StudyDataExporter`, `FrozenStudyConfig`.

### 3.5 `collaboration` — Authenticated Transport & Peer Coordination
- **Ownership:** Owns WebRTC/WebSocket transport, HMAC-SHA256 signed room tickets, presence synchronization, binary quaternion camera poses, and spectator observer streams.
- **Key Boundary:** Delivers authenticated, attributable commands to the owning subsystem; does not mutate Investigation or Atlas internals directly.
- **Key Classes:** `NetworkManager`, `SignedTicket`, `BinaryPoseSerializer`, `PeerAvatarManager`, `SignallingServerCore`.

### 3.6 `perception` — Interaction Signal Interpretation
- **Ownership:** Interprets raw human interaction signals (hand poses, gestures, gaze dwell, voice intent) into non-mutating observations or attributable candidate commands.
- **Key Boundary:** Produces observations only (`PerceptionObservation`). State changes require explicit domain commands.
- **Key Classes:** `GestureIntelligenceAdapter`, `GestureEngine` (`modules/gesture-intelligence`), `GestureRetrainService`, `InputTelemetry`.

### 3.7 `spatial-runtime` & Memory Palace — Spatial Embodiment
- **Ownership:** Owns WebXR/Three.js rendering, the 4-mode interaction FSM (`NAVIGATE | INTERACT | TRANSFORM | OBSERVE`), forgiving HandWheel navigation, contextual task surfaces, transient cards, pointer aim-drift & micro-jitter filtering, spatial assets, in-VR Mark Moment capture, and the reconstructible Memory Palace projection.
- **Key Boundary:** Spatial state is derived execution state. If discarded, it can be 100% reconstructed from the Investigation and representation manifest.
- **Key Classes:** `Engine`, `World`, `PointerRayFilter`, `MarkMomentAction`, `InteractionModeController`, `HandWheelCategorizer`, `ContextualTaskSurface`, `PanelRolesManager`, `TransientContextCardManager`, `SpatialAssetRegistry`.

### 3.8 `persistence` — Investigation Packages & Containers
- **Ownership:** Owns serialization formats, `.nemosyne` container package format (ZIP containing manifest, graph, kernel provenance, dataset, and evidence), schema migration, clean-room headless replay, and integrity verification.
- **Key Boundary:** Serializes and reconstructs the Investigation through its public API without inventing domain semantics.
- **Key Classes:** `NemosyneSession`, `NemosynePackageManager`, `InvestigationReplayRunner`, `ShareableSessionURL`, `PackageManifest`, `PackageIntegrityVerifier`.

---

## 4. Open Source Ecosystem & Maintenance Footprint Reduction

Per [OSS_MIGRATION_PROPOSAL.md](OSS_MIGRATION_PROPOSAL.md), Nemosyne adopts trusted, mature open-source libraries to replace hand-rolled code:

| Component / Need | Adopted OSS Library | Purpose / Benefit |
|---|---|---|
| **Boundary Schema Validation** | `zod` / `valibot` | Type-safe runtime validation for `.nemosyne` manifests, signed tickets, and study trial configs. |
| **Package Archiving** | `fflate` | Ultra-fast, zero-dependency ZIP compression/decompression for `.nemosyne` investigation packages. |
| **Spatial Raycasting** | `three-mesh-bvh` | BVH spatial indexing accelerating laser and gaze intersection on 100k-vertex point clouds (<2ms latency). |
| **Motion & Transitions** | `@tweenjs/tween.js` | Deterministic camera locomotion, panel docking, and landmark spotlight zooms. |
| **Scientific Math (Rust)** | `statrs`, `petgraph`, `ndarray` | Validated statistical distributions, graph algorithms, and matrix linear algebra in WebAssembly. |

---

## 5. Public API Contracts & Interaction FSM

```text
               INTERACTION STATE MACHINE (InteractionModeController)
               
                 ┌───────────────┐
                 │   NAVIGATE    │ (World locomotion, HandWheel browsing)
                 └───────┬───────┘
                         │
          ┌──────────────┼──────────────┐
          ▼                             ▼
   ┌──────────────┐              ┌──────────────┐
   │   INTERACT   │              │  TRANSFORM   │
   │ (Panel click,│              │ (Palace scale│
   │  node focus) │              │  & rotation) │
   └──────┬───────┘              └──────┬───────┘
          │                             │
          └──────────────┬──────────────┘
                         ▼
                 ┌───────────────┐
                 │    OBSERVE    │ (Deep inspection, mark moment, evidence)
                 └───────────────┘
```

All UI surfaces implement the unified `FocusState` vocabulary:
`idle → focused → hovered → armed → confirmed → disabled | busy`

---

## 6. Testing, Invariants & Verification Matrix

The repository enforces architectural integrity via automated suites:
- **`tests/architectural-invariants.test.ts`:** Asserts analytical independence (AtlasCore operates without DOM/Three.js) and session restore determinism.
- **`tests/adversarial-hardening.test.ts`:** Validates network authorization, signed ticket tampering rejection, and input sanitization.
- **`tests/engine-lifecycle.test.ts`:** Validates zero-leak WebGL disposal and resource cleanup.
- **`tests/quest-field-trial-suite.test.ts`:** Enforces Quest 3S hardware envelopes only when every configured stage supplies declared, active on-device WebXR measurements; simulated qualification evidence is rejected.

To verify the entire system against CI gates:
```bash
npm run typecheck       # tsc --noEmit
npm run lint            # ESLint static analysis
cargo test --manifest-path wasm/Cargo.toml  # Rust unit tests
npm test                # Vitest JS/TS unit tests
npm run build           # Vite production bundle
```

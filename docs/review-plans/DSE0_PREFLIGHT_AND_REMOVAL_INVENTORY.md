# DSE0 — Reduction Preflight, Caller Inventory, and Direct-Compile Plan

**Status:** Implementation Preflight / Authoritative Review Plan  
**Date:** 2026-10-04  
**Governing authority:** [RFC 0012](../rfcs/0012-minimum-nemosyne-architecture.md), [ADR-0013](../architecture/decisions/0013-minimum-nemosyne-architecture.md)  
**Execution authority:** [ROADMAP.md](../ROADMAP.md)  

---

## 1. Executive Summary and DSE0 Scope

Following the approval of RFC 0012 and ADR-0013, Nemosyne consolidates its production architecture into four core subsystems:
1. **Data and evidence runtime** (Rust/WASM analytical authority)
2. **Investigation** (single authoritative `InvestigationAggregate` / `AtlasCore` facade)
3. **Representation compiler** (deterministic evidence-bound composition, admission, spatial plan compilation)
4. **Presentation and input** (modality-independent scene/lifecycle owner, desktop/WebXR adapters, NIL boundary)

**DSE0** delivers the mandatory preflight obligations before executable deletions begin in DSE1:
- An exhaustive inventory of live callers, exports, and test suites for all candidate removals;
- Explicit selection of two governed analytical phenomena for the minimum loop;
- Direct deterministic compile path specification (bypassing compulsory neural advice and runtime search);
- Production falsifiers establishing $N$-independent cardinality bounds and clean admission gates.

---

## 2. Removal and Consolidation Inventory

### 2.1 Target 1: `SemanticEmbodimentGraphV1` (Duplicate Semantic Truth)
- **Status:** RETIRE production duplication. Canonical `SemanticSnapshotV1` owns grounded semantics.
- **Source Files:**
  - `src/moneta/representation/SemanticEmbodimentGraphV1.ts`
  - `src/moneta/representation/ComposedRepresentationValidation.ts`
  - `src/moneta/representation/index.ts` (public barrel export)
- **Direct Callers:**
  - `ComposedRepresentationValidation.ts`: validates node types (`concept`, `observation`, `structure`) and edge relationships.
- **Test Dependencies:**
  - `tests/composed-representation-validation.test.ts`: exercises validation rules on graph instances.
  - `tests/moneta-semantic-prerequisites.test.ts`: checks graph construction prerequisites.
- **Migration Plan:**
  - Retain read-only decoder for legacy package compatibility.
  - Remove mutable graph instantiation from active representation compilation paths.
  - Map validation rules directly onto `SemanticSnapshotV1.body`.

### 2.2 Target 2: Mandatory `FullMonetaEngine.synthesizeOrAdapt` Coordination
- **Status:** MERGE into unified representation compiler request path; retire redundant coordinator.
- **Source Files:**
  - `src/moneta/adaptation/FullMonetaEngine.ts`
  - `src/moneta/adaptation/index.ts`
- **Direct Callers:**
  - `src/atlas/domain/InvestigationAggregate.ts`: lines 970 (`synthesizeOrAdapt`) and 1026 (`explainFullMonetaDecision`).
  - `src/atlas/AtlasCore.ts`: facades `InvestigationAggregate.adaptRepresentation`.
- **Test Dependencies:**
  - `tests/full-moneta-adaptive-intelligence.test.ts`
  - `tests/fm6-r6-human-refinement-qualification.test.ts`
  - `tests/fm7-r7-search-synthesis-qualification.test.ts`
- **Migration Plan:**
  - Introduce `compileDirectEmbodimentPlan()` in representation compiler subsystem.
  - Update `InvestigationAggregate.adaptRepresentation()` to support direct deterministic compilation mode as default.
  - Retain `FullMonetaEngine` methods as secondary research harness entry points until full caller migration.

### 2.3 Target 3: Compulsory `FormaSystem1Proposer` Inference on Default Path
- **Status:** REMOVE from default execution; keep as optional, explicitly requested acceleration.
- **Source Files:**
  - `src/moneta/forma/FormaSystem1Proposer.ts`
- **Direct Callers:**
  - `FullMonetaEngine.ts`: line 172 (`new FormaSystem1Proposer(...)`), line 195 (`generateProposals(...)`).
- **Test Dependencies:**
  - `tests/forma-system1-proposer.test.ts`
  - `tests/fm5-system1-pairwise-benchmark.test.ts`
- **Migration Plan:**
  - When no advice artifact is supplied and advisory assistance is not requested by the investigator, the compiler skips `FormaSystem1Proposer` entirely.
  - Consumed advice identity is recorded in provenance *only* when advice was actually applied.

### 2.4 Target 4: Interactive Evolutionary Population Search (`RepresentationSearchEngine.search`)
- **Status:** MOVE evolutionary search outside the interactive browser loop; retain deterministic baseline enumeration.
- **Source Files:**
  - `src/moneta/search/RepresentationSearchEngine.ts`
  - `src/moneta/search/RepresentationGenomeHandoff.ts`
- **Direct Callers:**
  - `FullMonetaEngine.ts`: line 205 (`RepresentationSearchEngine.search(...)`).
- **Test Dependencies:**
  - `tests/representation-search-engine.test.ts`
  - `tests/fm7-r7-search-synthesis-qualification.test.ts`
- **Migration Plan:**
  - Interactive compiler selects from the deterministic candidate grammar enumeration without spawning multi-generation populations.
  - Offline search engines output versioned `RepresentationGraph` or candidate packages which the product compiler validates through normal admission gates.

### 2.5 Target 5: Speculative `DATASET` Primitive and Separate Subject Registry
- **Status:** DELETE from implementation proposals.
- **Rationale:** The canonical dataset fingerprint (SHA-256) already uniquely and immutably identifies the subject. Adding a secondary `DATASET` visual primitive or `DatasetSubjectRefV1` registry creates redundant indirection without improving scientific invariants.

---

## 3. Direct Deterministic Compilation Path (DSE1 Specification)

### 3.1 Selected Analytical Phenomena
For the initial complete DSE1 grounded loop, two complementary governed analytical phenomena are selected:
1. **Phenomenon 1 (Statistical Distribution)**: 1D continuous density / histogram estimation computed by Rust analytical kernel.
   - Grounded representation: Bounded density profile / frequency envelope.
   - Scientific purpose: Characterize variable dispersion, skewness, and modality.
2. **Phenomenon 2 (Topological Clustering)**: 2D/3D spatial cluster centroids and boundary hulls computed via Rust spatial reduction.
   - Grounded representation: Coordinated cluster boundary glyphs with semantic density anchors.
   - Scientific purpose: Identify partitioning, sub-population separation, and cluster relationships.

### 3.2 Direct Compilation Call Path

```text
[Dataset] 
   │
   ▼ (Rust analytical execution via Worker port)
[AnalysisResult records + EvidenceLedger]
   │
   ▼ (Deterministic reduction & normalization)
[SemanticSnapshotV1 (Grounded facts only)]
   │
   ▼ (Evidence-bound deterministic composition)
[ComposedRepresentationPlan (Deterministic baseline)]
   │
   ▼ (Obligation & resource budget admission check)
[Admitted SpatialEmbodimentPlanV1 + Reverse Explanation]
   │
   ▼
[Desktop / WebXR Scene Presentation]
```

### 3.3 Core Invariants of the Direct Path
1. **Deterministic Execution**: Given identical `Dataset` and `CommittedInvestigationContextV2`, the compilation produces bitwise identical `SpatialEmbodimentPlanV1` and explanation text.
2. **Zero Neural Overhead**: No ONNX models are instantiated; no network requests are dispatched; no random seeds are consumed.
3. **$N$-Independent Scene Cardinality**: The number of rendered visual primitives (spatial meshes, coordinate anchors, text labels) is strictly bounded by the semantic resolution budget, regardless of whether $N=10^2$ or $N=10^6$ rows.

---

## 4. Production Falsifiers Protocol for DSE0/DSE1

| ID | Invariant Attacked | Falsifying Condition | Test Verification |
| --- | --- | --- | --- |
| **FAL-DSE0-1** | Direct compile autonomy | Compilation fails or attempts to load ONNX/System-1 when advisory options are omitted. | Direct compile unit test without model files in runtime path. |
| **FAL-DSE0-2** | Search population isolation | Representation compilation execution time scales with evolutionary `maxGenerations` or `populationSize`. | Timing assertion verifying $O(1)$ latency across generation parameters in direct mode. |
| **FAL-DSE0-3** | Bounded scene cardinality ($N$-independence) | Rendered primitive count or vertex buffer transfer increases linearly with row count $N$. | Benchmark test comparing $N=100$ vs. $N=50,000$ row datasets under identical budget. |
| **FAL-DSE0-4** | Reverse explanation accuracy | Admitted plan fails to provide verifiable references to the originating Rust analytical result IDs. | Assertion that every visual node cites its authoritative `evidenceReference`. |
| **FAL-DSE0-5** | Dual-epistemic separation | Conjectural elements appear in admitted plan when `epistemicPurpose` is `GROUNDED_ANALYSIS`. | Admission check rejects ungrounded primitives during exploratory mode mismatch. |

---

## 5. Next Execution Steps (DSE1 Tranche)

1. Implement `compileDirectEmbodimentPlan()` in representation compiler subsystem.
2. Wire direct deterministic compile path into `InvestigationAggregate` / `AtlasCore`.
3. Build DSE1 qualification battery exercising falsifiers `FAL-DSE0-1` through `FAL-DSE0-5`.
4. Validate that existing smoke and journey tests continue to pass with direct compilation active.

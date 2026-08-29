# P1 Analytical Responsiveness & Spatial Fitness

Status: **ACTIVE**

This programme converts the post-Moneta migration architecture into a private-preview-capable spatial analytical runtime. It does not reopen the completed Draco-to-Moneta authority migration and it does not pull RepresentationGraph/compositional Moneta forward from P2.

## Governing objective

Nemosyne must remain analytically authoritative, spatially useful and interaction-responsive at representative investigation scale.

The dependency order is intentional:

1. remove redundant dataset materialisation at analytical boundaries;
2. isolate expensive analytical execution from the XR/main thread;
3. bound topology algorithms at large N;
4. converge dataset-level representation onto Rust-owned bounded semantic embodiment payloads rather than row-first geometry;
5. make Moneta evaluate the perceptual fitness of those real embodied representations;
6. turn NIL/ambiguity into actionable investigator workflows;
7. resolve imprecise spatial intent against analytical structures;
8. use the same semantic hierarchy for Memory Palace focus+context and progressive observation disclosure;
9. validate the complete representation + interaction result on physical target hardware.

## Fixed boundaries

- Rust/WASM owns N-dependent analytical computation, canonical dataset storage, data-derived evidence and data-derived semantic representation payloads.
- Atlas owns durable analytical handles and investigation orchestration.
- TypeScript/JavaScript owns presentation, interaction and scheduling, not a shadow analytical implementation.
- Moneta remains a bounded control plane over compact evidence.
- Source rows are not render primitives and must not be routinely rematerialised to perform analysis.
- **Non-observation representations are payload-first.** Three.js must not receive/traverse raw dataset rows to construct aggregate, density, distribution, cluster, field or other dataset-level analytical representations.
- **Observation marks are deliberate detail.** Point-per-observation geometry is valid only when Moneta selects observation-level representation or explicit progressive disclosure/drill-down requests it.
- Expensive analytical work must not be allowed to stall XR frame delivery.
- Approximation must be explicit, versioned and provenance-visible.
- Shared memory, WASM threads and SIMD are optimisations to justify with measurements, not architectural prerequisites.

## P1-A — Handle-native analytical boundary

Goal: analytical calls operate against the canonical Rust dataset capability rather than serialising the current JavaScript `Dataset` back through JSON.

### Work

- [x] Add handle-native TDA methods to `RustAnalyticalEvidenceAdapter` while retaining transient `DatasetJSON` wrappers temporarily for compatibility.
- [x] Add a regression contract proving handle-native TDA does not call `loadDatasetJson` and does not destroy the caller-owned handle.
- [ ] Route `AtlasCore.computePersistenceIntervals`, `computeMapperGraph` and `computeBetti0Curve` through the durable current analytical handle.
- [ ] Reject or explicitly load non-current datasets instead of silently analysing the wrong handle.
- [ ] Remove `Dataset.toJSON()` from the production TDA path.
- [ ] Move TDA filter construction to Rust-owned column access so `TDAPlanes` no longer maps `dataset.rows` into `filterValues`.
- [ ] Add an architecture/source contract forbidding production TDA from reintroducing `Dataset.toJSON()` or raw-row filter construction.
- [ ] Prove the current typed/columnar ingest path can execute supported TDA operations without row rematerialisation.

### Exit

For the current Atlas dataset, persistence, Mapper and Betti-0 execute against one durable Rust capability with no JS dataset serialisation and no JS raw-row analytical preprocessing.

## P1-B — Asynchronous analytical runtime

Goal: analytical latency cannot consume the XR/main-thread frame budget.

### Work

- [ ] Define an `AnalyticalExecutionPort` with request id, dataset generation/version, operation identity and cancellation/supersession semantics.
- [ ] Move scale-sensitive analytical execution behind a dedicated Web Worker boundary.
- [ ] Keep canonical dataset ownership inside the analytical runtime. Do not create a second mirrored authoritative dataset store in the UI thread.
- [ ] Return compact results/evidence and transferable buffers where appropriate.
- [ ] Fence responses by request id plus dataset generation/version so stale work cannot update the current investigation.
- [ ] Cancel or supersede obsolete work when the dataset/session/kernel generation changes.
- [ ] Preserve existing fail-closed kernel invalidation/recovery behaviour across the worker boundary.
- [ ] Measure scheduling, transfer and compute time independently.
- [ ] Introduce `SharedArrayBuffer`/shared WASM memory only if transfer/copy cost is a demonstrated bottleneck.
- [ ] Introduce WASM SIMD only for profiled hot kernels with deterministic/parity evidence.

### Exit

Representative expensive analysis can run while the main/XR thread remains responsive, stale analytical results cannot commit, and worker failure cannot produce a JavaScript analytical fallback.

## P1-C — Sparse topology scalability

Goal: remove repeated quadratic distance work from the large-N topology path while preserving inspectable approximation semantics.

The current implementation is not a generic full Vietoris-Rips complex. Mapper and H0/Betti-0 already exist. The actual scalability problem is repeated all-pairs or bucket-pair distance work.

### Work

- [ ] Introduce a reusable Rust sparse-neighbourhood representation suitable for supported topology and clustering kernels.
- [ ] Reuse the neighbourhood substrate across Mapper, H0 persistence/Betti-0 and other compatible analyses rather than rebuilding pairwise relationships repeatedly.
- [ ] Add governed exact/sparse/landmark modes with explicit scale thresholds.
- [ ] Evaluate approximate-nearest-neighbour or landmark sampling only where determinism, WASM fitness and reproducibility are acceptable.
- [ ] Record exact/sparse/approximate mode, parameters, sample/landmark identity and implementation version in provenance.
- [ ] Compare sparse/approximate results with exact small-data reference results using stability/error contracts.
- [ ] Add Rust performance benchmarks separate from deterministic correctness gates.
- [ ] Characterise 10K, 100K, 1M and, where semantically sensible, 10M behaviour without pretending every topology operation is meaningful at every scale.

### Exit

Topology cost is bounded by an explicit governed strategy rather than an accidental all-pairs path, with approximation visible in provenance and validated against reference cases.

## P1-R — Semantic embodiment convergence — RF-001 / RF-002

Goal: make Nemosyne visualise dataset-level analytical structure rather than treating observations as the universal rendering substrate.

**Detailed executable plan:** [`roadmap/P1_R_SEMANTIC_EMBODIMENT_CONVERGENCE.md`](roadmap/P1_R_SEMANTIC_EMBODIMENT_CONVERGENCE.md).

The current defect is architectural, not cosmetic: Moneta can choose dataset-level semantic candidates, but `VRTopologyTranslator` still extracts `dataset.rows`, and `ScalableTopologyEmbodiment` / `TopologyLayoutEmbodiment` derive several non-point representations from rows or row-derived positions in TypeScript. RF-001 owns that authority breach. RF-002 owns the resulting scientific-fidelity mismatch where candidate labels can exceed the mathematics actually rendered.

### Governing invariant

For every non-observation representation:

```text
Rust canonical dataset
  → Rust analytical representation builder
    → bounded/versioned SemanticEmbodimentPayload
      → WASM/Worker transport
        → thin Three.js embodiment adapter
```

Raw rows may cross into presentation only for an explicitly selected observation-level representation or a bounded progressive-disclosure/drill-down request.

### Work

- [ ] **R0 — inventory/falsifier:** classify every production candidate as observation-level, valid dataset-level, row-derived dataset-level, semantically overclaimed or unreachable; add an authority test that detects raw-row construction of non-observation representations.
- [ ] **R1 — payload contract:** define a versioned discriminated Rust-owned semantic payload envelope with representation-specific payload types, canonical identity, analytical method/parameters, approximation mode, information-preservation/loss contract, stable semantic IDs and hard size bounds.
- [ ] **R2 — Rust builders:** migrate aggregate, distribution, density, cluster and then structural/temporal families in vertical slices; each candidate is computed from the canonical Rust dataset capability and named only as strongly as its implemented mathematics supports.
- [ ] **R3 — production cutover:** make handle-native payload generation the real Worker/WASM path; prohibit JS row-reduction fallback; fence payloads by dataset/decision/generation identity and propagate typed refusal/failure.
- [ ] **R4 — thin renderer adapters:** replace row-first translation with payload-first dispatch; keep geometry/material/hit-target construction in small representation-specific adapters and forbid analytical regrouping/estimation/inference there.
- [ ] **R5 — progressive disclosure:** implement the hierarchy `dataset representation → semantic region/group → observation subset → exact datum`, revealing points only when observation identity/detail is requested.
- [ ] **R6 — ontology/fidelity:** reconcile every `RepresentationCandidate` description, `supports`/`preserves`/`loses`, scale envelope and candidate→payload compatibility with the mathematics actually implemented; split candidates that currently share geometry despite different statistical meaning.
- [ ] **R7 — evidence:** prove candidate→payload→artifact identity through the production path, source-N independence for bounded representations, transfer/render complexity, visually distinct dataset-level fixtures and re-bound P1-D perceptual evidence.

### Implementation order

Start with the simplest high-value vertical slices rather than building an abstract framework with no product consumer:

1. R0 production inventory/falsifier + minimal R1 envelope;
2. aggregate payload, ABI and renderer cutover;
3. truthful distribution representation;
4. truthful density representation;
5. cluster regions from authoritative cluster evidence;
6. structural/temporal families in bounded slices;
7. progressive observation drill-down;
8. final ontology/fidelity and product/performance review.

Do not create a monolithic semantic-payload god module or replace `VRTopologyTranslator` with another giant renderer class. The common envelope should remain small while analytical builders and renderer adapters are representation-specific.

### Exit

RF-001 and RF-002 can close only when non-observation representations no longer depend on raw-row analytical construction in JavaScript; their candidate labels match the actual mathematics; bounded semantic payloads cross the Rust/WASM/Worker boundary; Three.js is presentation-only; and point-per-observation geometry appears only for explicit observation-level intent/detail. Product evidence must show visibly distinct dataset-level representations and preserve semantic identity through drill-down.

## P1-D — 3D-native Moneta perceptual fitness

Goal: Moneta evaluates the fitness of the actual spatial embodiment, not only dataset/schema/task compatibility.

P1-D must evaluate the **P1-R-converged semantic embodiment**, not a row/point substitute standing in for the chosen semantic candidate.

### Work

- [ ] Activate existing candidate `occlusionResistance` and `cognitiveLoad` metadata as explicit priors rather than dormant fields.
- [ ] Define a versioned `PerceptualFitnessEvidence` contract.
- [ ] Measure view/device-dependent evidence such as projected overlap, hidden-mark fraction, projected glyph size, label crowding, depth-order ambiguity, spatial extent and required viewpoint travel.
- [ ] Evaluate representation stability across a bounded nearby-view envelope rather than one privileged camera pose.
- [ ] Keep measured perceptual evidence distinct from engineering priors.
- [ ] Feed perceptual evidence into Moneta ranking without relabelling utility as probability/confidence.
- [ ] Preserve hard information-loss and hardware constraints ahead of perceptual preference scoring.
- [ ] Persist exact perceptual-model/version/device assumptions in decision provenance.
- [ ] Key perceptual evidence to the actual semantic payload/candidate/embodiment identity so evidence from a materially different point representation cannot score a field/region/aggregate candidate.
- [ ] Calibrate thresholds on physical target hardware before treating them as promotion evidence.

### Exit

Two otherwise analytically similar candidates can be ranked differently because their actual P1-R-converged 3D embodiments have measurably different perceptual fitness, and that reasoning is inspectable.

## P1-E — Actionable NIL, ambiguity and uncertainty

Goal: abstention becomes a useful investigator conversation rather than a blank analytical wall.

### Work

- [ ] Present `INFEASIBLE`, `UNDERDETERMINED` and `AMBIGUOUS` as distinct states.
- [ ] Translate hard-constraint traces into investigator-readable reasons without losing the machine-readable trace.
- [ ] Surface ranked near-miss representations and the exact requirements preventing them from being feasible.
- [ ] Offer only evidence-supported remedial actions.
- [ ] Permit explicit relaxation of non-scientific preferences while refusing silent relaxation of critical information-preservation requirements.
- [ ] Persist investigator remediation choices and resulting decisions into `.nemosyne` provenance.
- [ ] Connect elevated pattern-fragility dimensions to concrete falsification actions where applicable.
- [ ] Use bootstrap/perturbation/subsampling stability for topology uncertainty where appropriate; do not claim generic conformal confidence for unsupported objects.

### Exit

A NIL/ambiguous outcome tells the investigator what failed, why it failed, what evidence supports that conclusion and which safe next actions are available.

## P1-F — Semantic target resolution and Memory Palace focus+context

Goal: imprecise embodied input resolves to meaningful analytical structures, and the same semantic hierarchy supports macro-to-micro spatial investigation.

### Work

- [ ] Introduce a semantic target resolver between raw hand/ray intent and analytical interaction.
- [ ] Rank nearby geometry against Atlas/Moneta structures using distance, salience, current task/context and confidence.
- [ ] Add hysteresis so assistance is stable rather than cursor-snapping unpredictably.
- [ ] Support semantic targets including observations, clusters/regions, Mapper nodes, persistence structures and investigation artefacts.
- [ ] Preserve manual precision escape hatches for expert interaction.
- [ ] Define the focus+context hierarchy: investigation -> dataset -> structure -> region/cluster -> observation.
- [ ] Keep stable spatial identity/anchors while changing representation resolution with distance, gaze, focus and explicit drill-down.
- [ ] Use aggregate/topological landmarks at distance and reveal observations only at appropriate detail through P1-R progressive disclosure.
- [ ] Preserve semantic parity for desktop controls where possible.
- [ ] Persist semantic selections/navigation state only where required for reproducible investigation meaning.

### Exit

Investigators can move from a global dataset-level spatial representation to analytical structures and individual observations without losing spatial context, and imprecise VR intent preferentially resolves to semantically meaningful targets.

## Physical qualification gate

PERF-04 and UX-03 remain promotion gates and are not replaced by desktop/browser CI.

When a physical Quest 3S is available:

- [ ] run the governed 10M browser envelope;
- [ ] execute controller, hand and desktop semantic-parity tasks;
- [ ] measure frame time, draw calls, retained memory, analytical scheduling and interaction latency across the P1-R-converged representation treatment;
- [ ] validate perceptual thresholds, occlusion/crowding assumptions, progressive disclosure and semantic-target assistance;
- [ ] record device/browser/runtime versions and governed dispositions;
- [ ] reopen the minimal-private-preview promotion decision only when remaining blocker/high findings are accepted or closed.

## Explicit non-goals for this P1 programme

- introducing Clingo/ASP as Moneta's runtime solver;
- replacing a nonexistent full-Rips implementation;
- treating alpha complexes as a generic high-dimensional large-N solution;
- enabling full shared-memory/multithreaded WASM before simpler worker isolation is measured;
- pulling RepresentationGraph/compositional search forward from P2;
- enabling adaptive/learned behaviour by default without held-out outcome evidence;
- treating point marks as forbidden: they remain the correct representation when observation identity/detail is the analytical task.

## Verification cadence

Each tranche should use the cheapest authoritative evidence that proves its claim:

- Rust unit/property/metamorphic tests for analytical kernels and semantic representation builders;
- mathematical/reference fixtures for candidate fidelity;
- focused adapter/ABI tests for Rust/JS boundary ownership and semantic payload serialization;
- source/architecture contracts preventing analytical fallback, non-observation row traversal or row rematerialisation;
- real-WASM tests for handle generation, payload identity, provenance and failure recovery;
- browser tests for worker scheduling/stale-result rejection and candidate→payload→artifact identity;
- scale evidence showing bounded payload/render element growth for dataset-level representations;
- frame/performance instrumentation for interaction responsiveness;
- P1-D perceptual evidence over the actual P1-R embodiment;
- physical Quest evidence for promotion-critical device claims.

Do not make ordinary PR CI depend on long-running performance campaigns. Keep deterministic correctness gates fast and run scale/device characterisation as explicit evidence lanes.

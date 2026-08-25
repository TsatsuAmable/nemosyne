# P1 Analytical Responsiveness & Spatial Fitness

Status: **ACTIVE**

This programme converts the post-Moneta migration architecture into a private-preview-capable spatial analytical runtime. It does not reopen the completed Draco-to-Moneta authority migration and it does not pull RepresentationGraph/compositional Moneta forward from P2.

## Governing objective

Nemosyne must remain analytically authoritative, spatially useful and interaction-responsive at representative investigation scale.

The dependency order is intentional:

1. remove redundant dataset materialisation at analytical boundaries;
2. isolate expensive analytical execution from the XR/main thread;
3. bound topology algorithms at large N;
4. make Moneta evaluate embodied 3D perceptual fitness;
5. turn NIL/ambiguity into actionable investigator workflows;
6. resolve imprecise spatial intent against analytical structures;
7. use the same semantic hierarchy for Memory Palace focus+context;
8. validate the complete result on physical target hardware.

## Fixed boundaries

- Rust/WASM owns N-dependent analytical computation, canonical dataset storage and data-derived evidence.
- Atlas owns durable analytical handles and investigation orchestration.
- TypeScript/JavaScript owns presentation, interaction and scheduling, not a shadow analytical implementation.
- Moneta remains a bounded control plane over compact evidence.
- Source rows are not render primitives and must not be routinely rematerialised to perform analysis.
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

## P1-D — 3D-native Moneta perceptual fitness

Goal: Moneta evaluates the fitness of the actual spatial embodiment, not only dataset/schema/task compatibility.

### Work

- [ ] Activate existing candidate `occlusionResistance` and `cognitiveLoad` metadata as explicit priors rather than dormant fields.
- [ ] Define a versioned `PerceptualFitnessEvidence` contract.
- [ ] Measure view/device-dependent evidence such as projected overlap, hidden-mark fraction, projected glyph size, label crowding, depth-order ambiguity, spatial extent and required viewpoint travel.
- [ ] Evaluate representation stability across a bounded nearby-view envelope rather than one privileged camera pose.
- [ ] Keep measured perceptual evidence distinct from engineering priors.
- [ ] Feed perceptual evidence into Moneta ranking without relabelling utility as probability/confidence.
- [ ] Preserve hard information-loss and hardware constraints ahead of perceptual preference scoring.
- [ ] Persist exact perceptual-model/version/device assumptions in decision provenance.
- [ ] Calibrate thresholds on physical target hardware before treating them as promotion evidence.

### Exit

Two otherwise analytically similar candidates can be ranked differently because their actual 3D embodiments have measurably different perceptual fitness, and that reasoning is inspectable.

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
- [ ] Use aggregate/topological landmarks at distance and reveal observations only at appropriate detail.
- [ ] Preserve semantic parity for desktop controls where possible.
- [ ] Persist semantic selections/navigation state only where required for reproducible investigation meaning.

### Exit

Investigators can move from a global spatial overview to analytical structures and individual observations without losing spatial context, and imprecise VR intent preferentially resolves to semantically meaningful targets.

## Physical qualification gate

PERF-04 and UX-03 remain promotion gates and are not replaced by desktop/browser CI.

When a physical Quest 3S is available:

- [ ] run the governed 10M browser envelope;
- [ ] execute controller, hand and desktop semantic-parity tasks;
- [ ] measure frame time, draw calls, retained memory, analytical scheduling and interaction latency;
- [ ] validate perceptual thresholds, occlusion/crowding assumptions and semantic-target assistance;
- [ ] record device/browser/runtime versions and governed dispositions;
- [ ] reopen the minimal-private-preview promotion decision only when remaining blocker/high findings are accepted or closed.

## Explicit non-goals for this P1 programme

- introducing Clingo/ASP as Moneta's runtime solver;
- replacing a nonexistent full-Rips implementation;
- treating alpha complexes as a generic high-dimensional large-N solution;
- enabling full shared-memory/multithreaded WASM before simpler worker isolation is measured;
- pulling RepresentationGraph/compositional search forward from P2;
- enabling adaptive/learned behaviour by default without held-out outcome evidence.

## Verification cadence

Each tranche should use the cheapest authoritative evidence that proves its claim:

- Rust unit/property/metamorphic tests for analytical kernels;
- focused adapter/ABI tests for Rust/JS boundary ownership;
- source/architecture contracts preventing analytical fallback or row rematerialisation;
- real-WASM tests for handle generation, provenance and failure recovery;
- browser tests for worker scheduling/stale-result rejection;
- frame/performance instrumentation for interaction responsiveness;
- physical Quest evidence for promotion-critical device claims.

Do not make ordinary PR CI depend on long-running performance campaigns. Keep deterministic correctness gates fast and run scale/device characterisation as explicit evidence lanes.

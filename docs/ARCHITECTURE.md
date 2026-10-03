# Nemosyne architecture

**Status:** current technical reference
**Updated:** 29 September 2026
**Governing specification:** [Nemosyne Definitive Vision and Roadmap V3.1](Nemosyne_Definitive_Vision_and_Roadmap.md)

## Authority model

Nemosyne is an investigation system, not a scene graph with analytical helpers. Each kind of truth
has one owner:

| Concern                                                | Authority                                      | Must not do                                             |
| ------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------- |
| Analytical facts, identity and N-dependent computation | Rust/WASM kernel in `wasm/`                    | Fall back to JavaScript calculations                    |
| Investigation meaning and provenance                   | Investigation domain under `src/atlas/domain/` | Depend on Three.js, WebXR or transport state            |
| Application orchestration                              | `AtlasCore` and coordinators                   | Invent analytical facts                                 |
| Representation reasoning                               | Moneta under `src/moneta/`                     | Traverse raw full datasets or bypass hard constraints   |
| Spatial/desktop embodiment                             | three.js runtime under `src/vr/` and `src/ui/` | Become a semantic or analytical authority               |
| Persistence and replay                                 | `src/session/`                                 | Accept model, evidence or identity drift silently       |
| Study treatment                                        | `src/study/`                                   | Leak instrumentation across frozen treatment boundaries |
| Collaboration                                          | `src/network/`                                 | Mutate domain state outside attributable commands       |

The governed runtime chain is:

```text
typed input
  → RuntimeBridge handle
  → Rust-owned canonical identity and DatasetStructureProfile
  → validated compact DatasetEvidence
  → bounded Moneta RepresentationDecision or NIL
  → SpatialStrategy embodiment in desktop/WebXR
  → Observation/Finding/Discovery provenance
  → .nemosyne package and clean-room replay
```

If the kernel is unavailable or unready, the system enters `KernelUnavailable`. Capability flags are
telemetry, never permission to route analytical work elsewhere.

## Runtime composition

`src/main.ts` constructs `World`, the application composition root. `World` coordinates these main
owners:

- `Engine`: renderer, camera rig, update loop, WebXR lifecycle and shared input router;
- `RuntimeBridge`: typed ABI over Rust dataset handles and compact outputs;
- `AtlasCore`: investigation-oriented orchestration and kernel evidence access;
- Moneta representation modules: evidence validation, feasibility, bounded ranking, abstention,
  sensitivity and model provenance;
- `WorldUIManager`, input and renderer coordinators: presentation and interaction lifecycles;
- `NemosyneSession` and replay: portable logical state and integrity verification;
- study, telemetry and collaboration services: observational envelopes around the same product state.

`World.ts` remains an oversized composition root. Its planned split must follow lifecycle and
authority seams; moving methods into arbitrary files would not reduce coupling.

## Rust/WASM boundary

The crate in `wasm/` uses integer handles and `(ptr, len)` transfers. Large datasets remain in
Rust-owned columnar storage. TypeScript may borrow typed views or receive compact evidence and render
buffers; it may not reconstruct a shadow row-major analytical store for normal representation
reasoning.

Data-derived layouts are Rust-owned. TypeScript layouts may exist only for presentation-only geometry
whose coordinates do not assert facts about data.

## Representation boundary

Moneta consumes `DatasetEvidence`, investigator semantics and explicit model artifacts. Bootstrap
hard constraints execute before optional learned re-ranking. Every decision records its fitness model
version and artifact hash where applicable. When no candidate is feasible, Moneta emits a typed NIL
outcome rather than fabricating a recommendation.

The dataset-first representation boundary is layered rather than collapsed into one renderer-facing
specification. The canonical Full-Moneta target architecture is
[`FULL_MONETA_SEMANTIC_EMBODIMENT_ARCHITECTURE_PLAN.md`](architecture/FULL_MONETA_SEMANTIC_EMBODIMENT_ARCHITECTURE_PLAN.md). It consolidates the human-grounded Forma knowledge/feedback loop, semantic resolution, perspective, System-1/System-2 roles and machine-addressable build lanes.

```text
Rust/WASM DatasetEvidence + governed semantic payloads
  -> SemanticEmbodimentGraphV1
       evidence-bound semantic world: objects, abstraction/refinement and information contracts
  -> RepresentationGraph
       Moneta-owned compositional representation hypothesis and coordination policy
  -> Moneta Forma semantic-to-perceptual compiler
       typed perceptual bindings + behaviour/interaction policy
  -> PerceptualEmbodimentPlan (planned)
       modality-independent terminal embodiment contract
       -> SpatialEmbodimentPlanV1
       -> visual/audio/haptic/behaviour backends as qualified
  -> desktop / WebXR runtime
```

`SemanticEmbodimentGraphV1` is therefore semantic truth, despite the word "Embodiment" in its name;
new rendering/audio/haptic state must not accrete there. `SpatialEmbodimentPlanV1` remains a valid
spatial backend rather than the terminal embodiment ontology.

`RepresentationGraphAdapter` currently preserves compatibility with the fixed-candidate architecture,
and `RepresentationGraphRuntimeAdapter` intentionally fails closed unless exactly one primitive is
renderable. Those are migration constraints, not the final compositional design. The planned expansion
is governed by `roadmap/P1_MCR_COMPOSITIONAL_REPRESENTATION_EXPANSION.md`: it must reuse the existing
graph/semantic/spatial contracts, add the explicit semantic-to-perceptual seam before MCR2 hardens,
preserve UXR lifecycle/detail authorities, and qualify multi-element composition without allowing any
perceptual channel to invent analytical meaning.

A future `RepresentationGenome` may encode candidate representation/spatial choices for the separate
laboratory synthesis/search programme. It is not a runtime or analytical authority. Nemosyne must not
introduce a duplicate genome contract before the laboratory interface is versioned and promoted.

`src/draco/` is a bounded compatibility re-export barrel (`src/draco/index.ts` only — "Backwards
compatibility re-export for the legacy `src/draco` path"; the deep mirrors were collapsed in the
Draco compatibility exit). Production imports must resolve directly through `src/moneta/`. The Rust
ABI retains the `draco_solve`/`draco_evaluate_candidate` export names and the
`pub use moneta as draco` alias for compatibility; names do not confer independent authority.

## Planned FM5 System-1 / System-2 boundary

FM5 introduces learned **advice**, not a new truth authority. The governing design is
[`MONETA_SYSTEM1_SYSTEM2_ONNX_ARCHITECTURE.md`](architecture/MONETA_SYSTEM1_SYSTEM2_ONNX_ARCHITECTURE.md).

The planned split is:

```text
physical input
  -> System-1 perception cues
    -> deterministic InteractionIntent resolver
      -> NIL

governed evidence + investigation intent/perspective + qualified Forma knowledge features
  -> System-1 Forma proposal (retrieval/ranking only)
    -> Moneta System-2 hard constraints / evidence / reasoning / synthesis/search
      -> RepresentationGraph candidate
        -> deterministic Forma admission/compiler
          -> PerceptualEmbodimentPlan
```

System-1 perception must not emit domain commands directly. System-1 Forma proposal models must not
traverse raw datasets, serve as the durable store of metaphor knowledge, or bypass hard constraints/evidence admission. Human-grounded metaphor knowledge lives in versioned rules/templates/cases; System-1 may distil/retrieve from it. System-2 remains explicit Moneta
reasoning/synthesis/search and has no ONNX requirement. ONNX is a qualified deployment format for small learned
specialists where it demonstrates value; transparent deterministic or linear baselines remain valid
implementations. Exact model/runtime/feature identity is pinned for research treatment and replay.
## Investigation and persistence

Investigation state records analytical operations, observations, findings, annotations, decisions,
discoveries and evidence links. `.nemosyne` is a bounded ZIP package containing the manifest,
dataset, command log and optional representation/discovery/NIL provenance. Import validates paths,
schema, entry count, compressed size, streaming decompression budgets and declared provenance before
replay.

## Embodiment and input

Desktop, controller and hand input converge through shared semantic dispatch. The analyst anchor
provides a stable frame for body-relative UI; data artefacts remain world-relative where appropriate.
Panels and the HandWheel are views over application state. Their visibility, focus and feedback must
not own command availability or domain meaning.

Source row count is decoupled from rendered primitive count through reduction, LOD and instancing.
Physical Quest performance remains an empirical gate.

## Verification layers

| Layer                                | Responsibility                                                 |
| ------------------------------------ | -------------------------------------------------------------- |
| Rust unit/property/metamorphic tests | Analytical correctness, determinism and invariants             |
| Fast Node tests                      | Pure contracts and architecture guards                         |
| UI/integration tests                 | Orchestration and presentation behaviour                       |
| Explicit WASM tests                  | ABI, evidence and provenance seams                             |
| Playwright smoke/journeys            | Real production bundle and visible browser workflows           |
| Physical-device qualification        | WebXR cadence, memory, thermals, input and sustained usability |

The required PR gate is typecheck → lint → coverage → production build, plus Rust tests and Chromium
smoke. Scale-sensitive changes also run the relevant benchmark evidence workflow.

## Known architecture debt

The current governed queue is in [ROADMAP.md](ROADMAP.md) and the evidence behind it is in
[PRE_P1_SYSTEMATIC_AUDIT.md](PRE_P1_SYSTEMATIC_AUDIT.md). The leading items are composition-root
decomposition, explicit UI/world disposal ownership, production spatial acceleration, real-browser
investigation journeys, Rust/ABI adversarial campaigns and physical Quest qualification.

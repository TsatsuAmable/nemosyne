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

[RFC 0012](rfcs/0012-minimum-nemosyne-architecture.md) proposes the minimum product architecture:
data/evidence runtime, Investigation, a combined Moneta/Forma compiler, and presentation/input.
It identifies explicit removals and keeps learned/search producers optional or offline. This proposed
scope reduction does not yet change deployed ownership or accepted public contracts.

Moneta consumes `DatasetEvidence`, investigator semantics and explicit model artifacts. Bootstrap
hard constraints execute before optional learned re-ranking. Every decision records its fitness model
version and artifact hash where applicable. When no candidate is feasible, Moneta emits a typed NIL
outcome rather than fabricating a recommendation.

The dataset-first representation boundary is layered rather than collapsed into one renderer-facing
specification. The canonical Full-Moneta target architecture is
[`FULL_MONETA_SEMANTIC_EMBODIMENT_ARCHITECTURE_PLAN.md`](architecture/FULL_MONETA_SEMANTIC_EMBODIMENT_ARCHITECTURE_PLAN.md). The detailed proposed ADAPT decision is
[`MONETA_DATASET_FIRST_SEMANTIC_EMBODIMENT.md`](architecture/MONETA_DATASET_FIRST_SEMANTIC_EMBODIMENT.md): Dataset is the stable semantic subject, governed semantic structures form its body, Moneta proposes their composition, and Forma compiles a bounded intent-dependent working set. A Dataset is not another renderer primitive and a label, shell or row layout is not a dataset body. ERA-ASTRA1's [`ARCHITECTURE_2027_REVIEW.md`](architecture/ARCHITECTURE_2027_REVIEW.md) adjudicates the target against current source topology; its accepted corrections are folded into the target plan and roadmap rather than forming a second architecture.

```text
Rust/WASM analytical outputs + governed evidence receipts
  -> decision-independent semantic snapshot
       evidence-bound entities/properties/relations + coverage/refusal/limitations
       [SemanticEmbodimentGraphV1 remains a compatibility projection until versioned migration]
  -> stable Dataset subject + evidence-bearing semantic structures
  + committed Investigation intent/perspective/branch context
  -> Moneta RepresentationGraph + fixed semantic obligations
       compositional representation proposal under pinned policy
  -> Moneta Forma admission / deterministic compilation
       typed perceptual bindings + scoped qualification + execution purpose
  -> immutable admitted result / PerceptualEmbodimentPlan
       exact explanation/replay identity
       -> SpatialEmbodimentPlanV1 first
       -> visual/audio/haptic/behaviour backends only as qualified
  -> context-checked desktop / WebXR adoption
```

The stable Dataset subject is a deterministic projection of canonical dataset identity, not a new
analytical record. The exact public-format placement requires the FM-DSE schema preflight: either a
small subject reference beside the existing closed snapshot or an honestly versioned future snapshot.
Existing V1 bytes and identity must not drift. A meaningful dataset body contains at least one
evidence-bearing semantic structure or an explicit unavailable/refused state; decorative framing alone
does not qualify.

Default overview complexity is bounded by the admitted semantic working set, not by source row count.
Point-per-observation geometry is permitted only for explicit observation intent or bounded semantic
detail. Resource adaptation selects among admitted semantic-resolution variants and must refuse rather
than remove mandatory meaning or grounded/conjectural disclosure.

Claim-bearing and exploratory-abductive operation share this subject and compiler. Grounded bindings
reverse-resolve to authoritative evidence; conjectural bindings reverse-resolve to the exact proposal,
assumptions and generator lineage. Every data-bearing perceptual property must additionally resolve
through its plan element, Forma binding, representation primitive, semantic property, Dataset subject,
committed context, limitations and version identities. Human critiques create attributable alternatives
through Investigation/Road Not Taken; they do not mutate the original representation or automatically
update a production prior.

`SemanticEmbodimentGraphV1` currently carries evidence-bound semantic information but is also decision-coupled. It must **not** be silently reinterpreted as the final upstream truth identity. Accepted A27-0 and RFC 0010 established the decision-independent snapshot boundary while preserving V1 as a legacy/compatibility projection; any Dataset-subject or multi-dataset schema extension must now version that boundary explicitly rather than mutate it. New rendering/audio/haptic state must not accrete in either semantic form. `SpatialEmbodimentPlanV1` remains a valid spatial backend rather than the terminal embodiment ontology.

`RepresentationGraphAdapter` currently preserves compatibility with the fixed-candidate architecture,
and `RepresentationGraphRuntimeAdapter` intentionally fails closed unless exactly one primitive is
renderable. Those are migration constraints, not the final compositional design. The planned expansion
is governed by `roadmap/P1_MCR_COMPOSITIONAL_REPRESENTATION_EXPANSION.md`: it must reuse the existing
graph/semantic/spatial contracts, add the explicit semantic-to-perceptual seam before MCR2 hardens,
preserve UXR lifecycle/detail authorities, and qualify multi-element composition without allowing any
perceptual channel to invent analytical meaning.

A `RepresentationGenome` may encode candidate representation/spatial choices for the separate
laboratory synthesis/search programme. It is not a runtime or analytical authority. Dataset identity,
facts, receipts, epistemic status and fixed obligations are not genes. System-1, System-2, bounded search,
human proposals and external genomes are peer proposal sources; every candidate crosses the same Forma
admission/explanation/resource boundary.

The former `src/draco/` compatibility barrel and the legacy `draco_solve` / `draco_evaluate_candidate`
/ `draco_adjust_evidence` WASM ABI aliases were fully retired (alias retirement, #1031/#1032): no
`src/draco` tree, `draco_*` kernel export, or `DRACO_RUST` capability remains. Production imports
resolve directly through `src/moneta/` and the kernel ABI exposes only the `moneta_*` contract names;
`ERR_0301_NO_VALID_DRACO_SPEC` survives solely as a retired-but-reserved error code for persisted
archives. Historical compatibility contracts are archived under `docs/archive/DRACO_COMPAT_INVENTORY.md`.

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


## Dual persistence and replay contract

Persistence must distinguish the **identity of a generated representation** from the **ability to rerun its generator**.

Claim-bearing and research-treatment paths keep the existing fail-closed replay contract: authoritative input/evidence identity, committed investigation context, model/policy/schema artifacts and relevant parameters are pinned so that the governed semantic decision can be reproduced to the required evidence tier.

Exploratory/abductive paths may intentionally use adaptive or evolving inference that cannot promise exact future regeneration. Those paths remain admissible only if they cannot masquerade as claim-bearing evidence and if the Memory Palace persists the materialised result itself.

A future versioned persistence contract should therefore support the equivalent of these declared policies without prematurely freezing these names:

- **EXACT_REPLAY** — generation identity is pinned and rerunnable;
- **MATERIALIZED_PRESERVATION** — the experienced semantic/perceptual artefact is canonical for revisit, while rerunning the generator is not promised;
- **DERIVED_REINTERPRETATION** — a new model/policy intentionally derives a new perspective from an older captured state without overwriting it.

A durable perceptual snapshot must be sufficient to reconstruct what the researcher actually encountered, including the admitted semantic/perceptual graph or equivalent materialised scene, investigation/perspective context, spatial/view state needed for meaningful revisit, epistemic status of represented elements, uncertainty, annotations, alternatives, and all provenance that was available at capture time.

At minimum the semantic layer must distinguish OBSERVED, DERIVED, IMPUTED, HYPOTHESIZED and COUNTERFACTUAL content. Renderers may encode those states perceptually but may not erase or upgrade them.

This relaxes **generator reproducibility only for explicitly exploratory perception**. It does not relax Rust/WASM analytical authority, evidence admission, scientific claim provenance, study freezes or exact historical replay where those contracts apply.

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

# Full Moneta Semantic Embodiment Architecture Plan

**Status:** architecture preflight and implementation map  
**Date:** 3 October 2026  
**Governing vision:** [`Nemosyne_Definitive_Vision_and_Roadmap.md`](../Nemosyne_Definitive_Vision_and_Roadmap.md)  
**Vision clarification:** [`SEMANTIC_EMBODIMENT_VISION_CLARIFICATION.md`](../SEMANTIC_EMBODIMENT_VISION_CLARIFICATION.md)  
**Live sequencing authority:** [`ROADMAP.md`](../ROADMAP.md)  
**Current composition programme:** [`P1_MCR_COMPOSITIONAL_REPRESENTATION_EXPANSION.md`](../roadmap/P1_MCR_COMPOSITIONAL_REPRESENTATION_EXPANSION.md)  
**System-1 decision:** [`MONETA_SYSTEM1_SYSTEM2_ONNX_ARCHITECTURE.md`](MONETA_SYSTEM1_SYSTEM2_ONNX_ARCHITECTURE.md)  
**Device/performance programme:** [`QUEST3_SOC_ARCHITECTURE_PERFORMANCE_REPORT.md`](QUEST3_SOC_ARCHITECTURE_PERFORMANCE_REPORT.md)  
**Native TypeScript experiment:** [`SCRIPTC_NATIVE_TYPESCRIPT_EVALUATION.md`](../roadmap/SCRIPTC_NATIVE_TYPESCRIPT_EVALUATION.md)

## 1. Decision

Full Moneta should be built as a governed **semantic-to-perceptual system**.

The target is not merely:

```text
dataset -> chart/layout -> 3D renderer
```

The target is:

```text
dataset
  -> authoritative analytical evidence
  -> semantic world model
  -> representation hypothesis
  -> semantic-to-perceptual compilation (Moneta Forma)
  -> coordinated perceptual channels
  -> interaction + perturbation
  -> observation / hypothesis / validation
  -> evidence + human judgement
```

Three-dimensional geometry remains important, but becomes one backend of a broader perceptual embodiment architecture alongside motion, sound, haptics and semantically meaningful interaction.

**Moneta Forma** is a responsibility, not a new truth authority. It compiles already-governed semantic and representation decisions into perceptual form. Rust/WASM retains analytical authority; Moneta System-2 retains representation/admissibility authority; NIL retains semantic interaction authority.

## 2. Target architecture

```text
                         Rust / WASM
                 analytical truth + evidence
                              |
                              v
                  DatasetEvidence / receipts
                              |
                              v
               SemanticEmbodimentGraph
               "what the dataset means"
                              |
                              v
                    RepresentationGraph
              "what meaning to expose together"
                              |
                              v
                    MONETA FORMA COMPILER
              "how humans should perceive it"
                              |
             +----------------+----------------+
             |                |                |
             v                v                v
      PerceptualBinding   BehaviourPlan   InteractionPlan
             |                |                |
             +-------+--------+----------------+
                     |
                     v
              PerceptualEmbodimentPlan
              /       |       |       \
             v        v       v        v
          Spatial   Visual   Audio   Haptic
           Plan      Plan    Plan     Plan
             \        |       |       /
              +-------+-------+------+
                      |
                      v
              desktop / WebXR runtime
                      |
                      v
          inspect / manipulate / perturb
                      |
                      v
           observations + provenance
```

A representation may use one channel or several. The compiler must be able to abstain when no mapping is justified, and every mapping must be reversible to the semantic source and evidence that justified it.

## 3. Current implementation inventory and gaps

### 3.1 Structures that already exist and should survive

| Existing structure | Current role | Architectural disposition |
| --- | --- | --- |
| `DatasetEvidence` + governed receipts | Evidence-bearing analytical facts | **Keep.** This is the upstream truth substrate. |
| `SemanticEmbodimentGraphV1` | Dataset-level semantic nodes, abstraction/refinement, preservation/loss and evidence references | **Keep but clarify.** It is the semantic-world graph, not the perceptual embodiment itself. |
| `RepresentationGraph` | Moneta-owned compositional hypothesis over semantic objects | **Keep and evolve.** It is the right seam for deciding what meanings coexist. |
| `SpatialEmbodimentPlanV1` | Spatial presentation phenotype | **Keep as a backend plan.** It must stop being treated as the terminal embodiment abstraction. |
| `ComposedRepresentationValidation` | First-slice cross-contract legality | **Keep and expand.** It becomes one validator inside a richer semantic/perceptual admission layer. |
| `SemanticDetailTransition` / semantic drill-down | Dataset -> region/substructure -> bounded observations | **Keep.** Reuse stable identity/refinement rather than inventing another detail protocol. |
| `SensitivityAnalysis` / `StabilityCertificate` | Analytical perturbation/stability evidence | **Keep.** These feed perceptual perturbation, but are not themselves display semantics. |
| `PerceptualFitnessSampler` | Viewpoint/geometry-oriented spatial fitness evidence | **Keep but narrow its claim.** It is one visual/spatial fitness instrument, not general perceptual fitness. |
| NIL / `InteractionIntent` | Modality-independent semantic command boundary | **Keep.** All embodied interaction resolves through this boundary. |
| `LearnedMonetaRuntime` / model registry | Bounded learned ranking after hard constraints | **Keep.** It becomes an advisory proposal path for richer representation/embodiment candidates. |

### 3.2 Existing structures whose names or responsibilities are currently ambiguous

#### `SemanticEmbodimentGraphV1`

The contract contains semantic identity and information contracts, but almost no actual perceptual embodiment. The name can therefore mislead implementers into putting rendering choices there.

**Clarification:** treat it as the canonical **semantic-world graph**. Do not move geometry, colour, sound, haptic or animation parameters into it.

Its optional `presentationHints` are a boundary leak. New work should not expand them. Forma should consume semantic facts and representation policy instead. A V2 may remove or tightly type the hint surface.

#### `SemanticEmbodimentPayloadV1`

This is a Rust-owned family-specific analytical payload envelope, not the same abstraction as `SemanticEmbodimentGraphV1`. Its vocabulary also does not line up perfectly with the graph vocabulary: e.g. payload families include `AGGREGATE`, `FIELD`, `HIERARCHICAL`, `FREQUENCY`, while the graph has a different set of semantic kinds.

**Gap:** there is no single normalized semantic vocabulary/adapter that makes all governed analytical families become coherent graph nodes and relations.

**Action:** introduce a versioned semantic ontology/normalization layer before broad Forma compilation. Do not solve the mismatch with ad-hoc renderer conditionals.

#### `RepresentationGraph`

This is the correct representation-authority boundary, but it still contains presentation leakage:

- `visualEncoding: Record<string, string>`;
- string `layoutPolicy`, `scalePolicy`, `interactionPolicy`, `detailPolicy`;
- compatibility-era geometry assumptions.

**Action:** preserve V1 for compatibility, but define typed representation-to-perceptual bindings rather than growing `visualEncoding` strings.

#### `RepresentationDecision.DecisionEmbodiment`

This remains a single-winner compatibility object composed of layout, geometry, behaviour, interaction and `SpatialStrategy`.

**Clarification:** this is not the future Forma contract. It becomes a compatibility projection from a governed representation/perceptual plan until downstream consumers migrate.

#### `RepresentationCandidate` / `RepresentationFamily`

These remain useful fixed baselines and candidate seeds.

**Clarification:** they are not the terminal ontology. FM7 search must operate over governed semantic/perceptual grammar rather than merely inventing more enum members.

#### `RepresentationGraphRuntimeAdapter`

Its fail-closed single-renderable-primitive rule is correct for the current runtime.

**Gap:** production cannot yet embody a true multi-primitive representation. MCR3 must replace this limitation with an explicit multi-element runtime path rather than flattening.

### 3.3 Missing structures

The following do **not** currently exist as first-class governed contracts:

1. **`PerceptualEmbodimentPlan`** — a modality-independent terminal plan above spatial/audio/haptic backends.
2. **`PerceptualBinding`** — typed semantic-property -> perceptual-channel mappings with transforms, units/ranges, fidelity, evidence, version and explanation.
3. **Perceptual channel ontology/registry** — position, distance, scale, containment, colour, texture, motion, rhythm, pitch, timbre, haptic intensity, resistance, etc., with capability/contraindication metadata.
4. **Behaviour grammar** — governed dynamic semantics such as flow, attraction, repulsion, oscillation, instability, propagation, decay and transition.
5. **Cross-modal composition/admission rules** — redundancy, conflict, masking, overload and accessibility/fallback rules.
6. **Semantic sonification contract** — current product sound is interaction feedback; governed data sonification was correctly archived and must be redesigned.
7. **Semantic haptic contract** — interaction haptics exist, but data-bearing haptics do not.
8. **Perturbation-response presentation contract** — analytical perturbation exists, but no contract says how changed semantics should become changed perceptual state.
9. **Metaphor/template contract** — no governed reusable description for terrain, river, mechanism, swarm, constellation, memory palace, datumplane, embodied traversal, etc.
10. **Reverse explanation index** — no general way to ask why an object is positioned, moving, coloured, sounding or responding as it does and trace that property back to semantic/evidence identity.
11. **General semantic-to-perceptual compiler** — MCR already records the narrower missing semantic-to-spatial compiler; the intended seam should now be widened before MCR2 implementation hardens it.

## 4. New contracts

### 4.1 `PerceptualBindingV1`

A binding should express **meaning**, not renderer instructions.

Conceptual schema:

```text
PerceptualBindingV1
  id
  semanticSource
    semanticNodeId
    semanticProperty / relation
    evidenceRefs[]
  channel
    modality
    property
  mapping
    transformId + version
    domain / range
    units
    monotonicity / topology constraints
  fidelity
    DIRECT | DERIVED | SURROGATE | EXPERIMENTAL
  limitations[]
  fallbackBindingIds[]
  explanation
  provenance
```

Examples:

```text
uncertainty -> motion.instability
periodicity -> audio.rhythm
causal direction -> spatial.direction + motion.flow
hierarchy -> spatial.containment
magnitude -> spatial.scale
provenance path -> traversable trajectory
```

A mapping is admitted only if its semantic source exists and its transform is valid for the source's measurement/topological properties. Cyclic hue, for example, must not silently be treated as a linear axis.

### 4.2 `PerceptualEmbodimentPlanV1`

This becomes Forma's terminal compilation product:

```text
PerceptualEmbodimentPlanV1
  plan identity + dataset/decision/provenance
  bindings[]
  spatialPlan?
  visualPlan?
  audioPlan?
  hapticPlan?
  behaviourPlan?
  interactionPlan?
  explanationIndex
  resourceBudget
  accessibility/fallback policy
```

`SpatialEmbodimentPlanV1` remains valid as the spatial backend and can be nested/referenced rather than replaced immediately.

### 4.3 Behaviour plan

Dynamic semantics need a typed description distinct from geometry:

```text
BehaviourRule
  semantic source
  trigger / state
  behaviour primitive
  parameters
  transition policy
  provenance
```

Initial primitives should remain small and deterministic: `FLOW`, `OSCILLATE`, `PULSE`, `ATTRACT`, `REPEL`, `DIFFUSE`, `DECAY`, `TRANSITION`, `STABILISE`.

The renderer executes these behaviours; it does not infer why they exist.

### 4.4 Perturbation-response contract

Analytical perturbation remains upstream authority. Forma receives a before/after semantic delta and compiles it into perceptual transitions:

```text
PerturbationRun
  -> evidence-bound semantic delta
  -> affected PerceptualBinding ids
  -> transition plan
  -> user-visible response
```

The result should make it possible to perceive what moves, breaks, remains stable or changes character without treating animation itself as evidence.

### 4.5 Metaphor templates

A metaphor is a reusable composition recipe over governed bindings, not a bespoke renderer.

Example families:

- terrain / landscape;
- river / flow system;
- mechanism / machine;
- swarm / ecosystem;
- constellation;
- city / architecture;
- memory palace;
- datumplane / datasphere;
- embodied traversal / agent path.

Each template declares:

- semantic preconditions;
- allowed binding families;
- forbidden implications;
- interaction affordances;
- accessibility/fallback alternatives;
- evaluation history.

Templates begin hand-authored and deterministic. FM7 may later search or recombine them.

## 5. Moneta Forma compiler stages

Forma should be implemented as explicit, inspectable stages:

1. **Normalize semantics** — reconcile governed Rust payloads into semantic graph nodes/relations.
2. **Select relevant semantics** — System-2 uses evidence + investigation intent to decide what deserves perceptual existence.
3. **Propose representation structure** — build/validate `RepresentationGraph`.
4. **Generate candidate perceptual bindings** — deterministic registry/templates first.
5. **Admit bindings** — reject mappings that violate scale/topology, evidence, accessibility or resource constraints.
6. **Compose channels** — coordinate visual/spatial/audio/haptic/behaviour without conflict or unnecessary duplication.
7. **Compile backend plans** — emit spatial/audio/haptic/behaviour/runtime plans.
8. **Attach explanation/provenance** — every output property points backward to representation + semantic + evidence identity.
9. **Evaluate perceptual fitness** — use geometry/device instruments plus human evidence where claims require it.
10. **ABSTAIN / simplify / provide alternatives** — no justified binding is a valid outcome.

This compiler is deterministic/reference-capable before any learned proposal path is allowed to influence it.

## 6. System-1 revision

The existing System-1/System-2 split remains valid. What changes is the object that the representation specialist proposes.

### 6.1 System-1 Perception: keep

The object-centric perception model still fits:

```text
hand / gaze / object / runtime features
  -> bounded InteractionCueSet
  -> deterministic resolver
  -> InteractionIntent
  -> NIL
```

It should continue to prioritize direct manipulation and target/intent cues over a large named-gesture vocabulary.

The archived `MultimodalPerceptionEngine` and `GeometricGestureRecognizer` remain archived. Future cue contracts inherit none of their heuristic confidence/action semantics.

### 6.2 System-1 Representation becomes System-1 Forma Proposal

The current idea of a small representation proposal/ranking model remains useful, but the target must evolve from "which chart/layout candidate?" to:

```text
governed semantic features
+ InvestigationIntent
+ device/perceptual budget
+ candidate template/binding features
  -> bounded FormaProposalSet
  -> System-2 admission/reasoning/search
```

A `FormaProposalSet` may propose:

- relevant representation primitives;
- metaphor/template IDs;
- perceptual binding IDs;
- channel allocation preferences;
- search ordering;
- simplification/fallback candidates.

It may **not** invent semantic facts, admit evidence, choose final mappings, or directly create runtime plans.

### 6.3 Do not add a third learned model by default

Perceptual-channel allocation should first be deterministic and policy-driven. If later evidence shows that channel/template proposal is a genuine prediction problem, it can become another head/artifact behind the same System-1 contract. Avoid model proliferation before a measurable task exists.

### 6.4 Training sequence

FM5 training should remain based on governed known-answer controls, System-2/reference search outcomes, synthetic/metamorphic cases and existing admissible evidence.

FM6 introduces human judgement/discovery outcomes.

A useful FM5 task becomes **distillation from the deterministic Forma/System-2 pipeline**: predict which bindings/templates are worth evaluating first, while final admission remains explicit.

## 7. Scriptc and other runtime improvements

### 7.1 scriptc

scriptc is **not part of semantic authority** and should no longer be mentally attached to Full Moneta merely because it sits near FM5 experiments.

Keep the existing bounded evaluation, but classify it as a **Runtime & Device Efficiency** experiment:

- T0-T2 remain safe compiler/tooling characterization.
- T3 may compile a provider-neutral System-1/experiment sidecar only if that deployment topology actually exists and parity + startup/RSS/latency justify it.
- It must not become the WebXR renderer, Rust analytical kernel, or semantic compiler authority.
- Browser/Quest adoption requires a real native-host architecture, which is a MAC-Q5-level escape hatch, not a prerequisite.
- T4 remains useful for frequently spawned CLI/worker utilities when measured startup/RSS cost warrants it.

No Full Moneta capability is blocked on scriptc.

### 7.2 Quest/runtime performance

The Quest programme remains compatible with semantic embodiment if optimization preserves meaning.

The runtime contract should gain a **semantic/perceptual budget**:

```text
device capability + current load
  -> resource budget
  -> perceptual plan simplification
  -> same semantic claims, lower richness
```

This is the FM4 "stickman <-> Mona Lisa" rule. Lower hardware budget may reduce element count, animation richness, audio polyphony, haptic detail or semantic depth, but may not substitute different analytical truth.

Existing MAC-Q0..Q5 work remains useful: instancing, culling, buffer/data movement, worker scheduling, adaptive detail and device measurement are implementation means under this invariant.

### 7.3 Other architectural improvements already planned

Retain and integrate:

- Rust/WASM sole analytical authority;
- governed evidence receipts/replay;
- claim-bound metric admissibility and explicit ABSTAIN;
- bounded semantic detail rather than raw-row fallbacks;
- Memory Palace as investigation/reasoning embodiment;
- Road Not Taken as inspectable alternative representations;
- TechnoCore as reverse-explanation surface;
- Evidence/Ice Vault as reproducible checkpoints;
- Farcaster as meaningful context/branch navigation;
- sparse Datum Plane / Datasphere product identity;
- compositional representation before evolutionary search;
- physical Quest qualification for device-specific claims;
- adversarial review and RFL as falsification/support loops, not truth authorities.

## 8. Migration sequence to Full Moneta

### FM0 — Trustworthy semantic substrate

**Goal:** evidence, semantic identity and replay survive end to end.

Required before Forma promotion:

- finish P1-TEC evidence identity/admissibility closure;
- ensure semantic nodes can carry/resolve governed evidence references;
- normalize the semantic vocabulary across payload families and graph nodes;
- fail closed on unsupported/missing semantics.

### FM1 — Question-aware semantic selection

**Goal:** investigation intent controls which semantic structures are relevant.

- bind `InvestigationIntent` / ResearchContext into representation reasoning;
- preserve intent in replay/provenance;
- Memory Palace and TechnoCore expose question -> representation linkage.

### FM2 — Alternatives and challenge

**Goal:** representation hypotheses become inspectable alternatives.

- Road Not Taken over RepresentationGraph identities;
- semantic correspondence across alternatives;
- branch/revisit/refutation;
- perturbation requests become explicit investigation operations.

### FM3 — Moneta Forma foundation

**Goal:** first production semantic-to-perceptual compilation.

Replace the old narrow MCR2 goal with:

1. define `PerceptualBindingV1` and channel registry;
2. define `PerceptualEmbodimentPlanV1`;
3. implement deterministic/reference Forma compiler;
4. treat `SpatialEmbodimentPlanV1` as the first backend;
5. implement true multi-element runtime (MCR3);
6. implement composed interaction/detail semantics (MCR4);
7. add reverse explanation;
8. qualify at least one representation containing two governed semantic phenomena;
9. optionally add one deliberately narrow governed audio or haptic mapping only after the channel contract exists.

**Exit:** a researcher can inspect why each embodied property exists and at least one composed representation survives interaction/detail/lifecycle without semantic drift.

### FM4 — Resolution-adaptive semantic embodiment

**Goal:** the same semantic world can be rendered with different perceptual richness.

- resource/perceptual budgets;
- deterministic simplification;
- semantic continuity across reconstruction/eviction;
- cross-modal fallback;
- information-loss inspection;
- Quest/device evidence.

### FM5 — Intuitive / System-1-assisted Forma

**Goal:** small models reduce proposal/interaction latency without acquiring authority.

- System-1 common artifact/runtime contract;
- object-centric perception cue model;
- `FormaProposalSet` specialist;
- deterministic proposal resolver/admission;
- System-2 remains final authority;
- scriptc only if measured as a useful runtime/tooling optimization.

### FM6 — Human-refined embodiment

**Goal:** validated human outcomes improve priors.

Learn from:

- comprehension;
- error detection;
- discovery support;
- recall;
- calibration;
- task time;
- explicit preference only where preference is the target.

Do not train "looks impressive" into an epistemic criterion.

### FM7 — Searching semantic embodiment

**Goal:** search a bounded semantic/perceptual grammar.

- template/binding composition;
- RepresentationGenome adapter only after production contracts stabilize;
- inspectable Pareto alternatives;
- lineage and Road Not Taken;
- learned heuristics may order search but not change admissibility.

### FM8 — Full Moneta

**Goal:** evidence, intent, semantic world, Forma, interaction, alternatives, adaptive resolution, learned proposal, search and human refinement form one coherent instrument.

The integration test is product-level: the user can move from dataset -> embodied understanding -> perturb/challenge -> evidence-backed conclusion while every perceptual claim remains explainable and replayable.

## 9. Thematic, machine-addressable work lanes

These lanes are durable **product/architecture themes**, independent of machine or model. A machine is assigned to a lane/tranche; it does not own the lane permanently.

| Lane | Theme | Main scope | Typical roadmap increments | Primary surfaces |
| --- | --- | --- | --- | --- |
| **L0 — Truth & Evidence** | Make semantic claims trustworthy | analytical evidence, receipts, admissibility, semantic normalization, replay | FM0, cross-cutting | Rust/WASM evidence, P1-TEC, evidence contracts, semantic graph evidence binding |
| **L1 — Investigation & Alternatives** | Make Moneta respond to the researcher's question and preserve reasoning | intent/context, Memory Palace, Road Not Taken, Challenge, TechnoCore, branching | FM1-FM2 | Atlas/investigation, NIL orchestration, representation decision provenance, memory/product projections |
| **L2 — Forma & Semantic Embodiment** | Turn governed meaning into perceptual form | RepresentationGraph, bindings, Forma compiler, perceptual plan, spatial/audio/haptic/behaviour backends, explanation | FM3-FM4 | `src/moneta/representation`, embodiment compiler, spatial runtime interfaces, MCR |
| **L3 — Intuitive Interaction & Reflexes** | Make interaction fast and natural without hidden authority | object-centric perception, gaze/voice cue contracts, deterministic resolvers, System-1 runtime | FM5 | System-1 contracts/models, input/perception adapters, NIL boundary |
| **L4 — Runtime & Device Efficiency** | Make the same semantics run efficiently on constrained hardware | Quest performance, worker isolation, resource budgets, adaptive richness, scriptc experiments | FM4-FM5 cross-cutting | WebXR/Three.js runtime, workers, device profiles, benchmarks, scriptc |
| **L5 — Learning & Search** | Improve proposal/search from governed outcomes | PT9 learning, human-refined priors, RepresentationGenome adapter, bounded grammar/search | FM6-FM7 | fitness/model registry, search laboratory, nemosyne-data interfaces |
| **L6 — Product Validation & Integration** | Prove that the instrument improves understanding and remains coherent | user/device studies, semantic-fidelity tests, multimodal experiments, FM STOP reviews, Full Moneta integration | FM3-FM8 | study harness, UXR, E2E/Playwright/IWER, physical Quest, research protocols |

### Lane dependency spine

```text
L0 Truth & Evidence
      |
      +------> L1 Investigation & Alternatives
      |               |
      |               +------> L2 Forma & Embodiment
      |                              |
      |                              +------> L3 Reflexes
      |                              |
      |                              +------> L4 Runtime
      |                              |
      |                              +------> L5 Learning/Search
      |                                             |
      +---------------------------------------------+
                            |
                            v
                   L6 Product Validation
```

This is not a global serialization diagram. Work may proceed concurrently whenever file/authority surfaces are disjoint and prerequisites for that tranche are already satisfied.

### Current recruit mapping

Current machines should be treated as assignments, not ownership:

- **Claude / Millhouse:** default to **L0 Truth & Evidence** while P1-TEC is active; move to dependency-safe L2/L5 implementation only when L0 work is blocked or complete.
- **OpenCode + Jev / Millhouse:** default to **L1 Investigation & Alternatives**, then L2 Forma slices that do not collide with L0.
- **ChatGPT / Mac:** default to **L3 + L4 experimental/preflight work**: System-1 contracts, model experiments, Quest/device benchmarking and scriptc evaluation.
- **Antigravity / Mac:** default to **L2/L6 architecture, adversarial review and validation feeder work**, or a separately leased implementation tranche when explicitly assigned.

A worker that finishes a tranche immediately selects the highest-priority eligible item in its lane after refreshing `main` and checking leases/PR surfaces.

## 10. First implementation tranches created by this plan

### L0-SEM-NORM — semantic vocabulary normalization

Inventory `SemanticEmbodimentPayloadV1`, cluster/graph payloads, `SemanticEmbodimentGraphV1` and RepresentationGraph kind compatibility. Define the canonical semantic vocabulary/adapter and migration rule. Do not rename public contracts gratuitously.

**Exit:** every production semantic family maps deterministically into a versioned graph vocabulary or explicitly refuses.

### L2-FORMA-0 — Forma contract preflight

Define only contracts and validators:

- `PerceptualChannelId`;
- `PerceptualBindingV1`;
- `PerceptualEmbodimentPlanV1`;
- backend-plan references;
- fidelity/provenance/explanation requirements;
- bounds and fail-closed validation.

No renderer implementation.

### L2-FORMA-1 — spatial backend compiler

Refactor MCR2 into the first Forma backend:

```text
SemanticEmbodimentGraph + RepresentationGraph
  -> admitted PerceptualBinding[]
  -> PerceptualEmbodimentPlan
  -> SpatialEmbodimentPlanV1
```

Use deterministic reference mappings only.

### L2-FORMA-2 — multi-element runtime

Execute existing MCR3 with the new top-level plan. Preserve independent lifecycle/identity per element.

### L2-FORMA-3 — behaviour + perturbation

Add deterministic behaviour rules and semantic-delta -> perceptual-transition plumbing. Connect existing perturbation/stability evidence without letting presentation infer analytical results.

### L2-FORMA-4 — explanation / TechnoCore

Implement reverse lookup from visible/audible/haptic property -> binding -> representation primitive -> semantic node -> evidence/provenance.

### L2-FORMA-5 — first non-visual channel experiment

Only after Forma contracts exist, implement one narrow governed sonification or haptic mapping with a simpler visual control and explicit STOP criterion.

### L3-S1-FORMA — revised System-1 proposal experiment

Replace legacy fixed-layout proposal targets with bounded Forma proposal features. Compare deterministic/linear baseline with tiny nonlinear candidate only after FM3 contracts stabilize.

### L4-RUNTIME-BUDGET — semantic/perceptual resource budget

Unify FM4 adaptive richness with Quest MAC-Q work. Prove that device adaptation changes richness/cost rather than meaning.

### L4-SCRIPTC — scriptc bounded continuation

Run T0-T2 now if useful; T3 only against an actual sidecar/tool target and only after differential parity. Never make scriptc a Full Moneta dependency.

### L6-EMBODIMENT-STUDY — semantic embodiment study harness

Compare:

1. conventional representation;
2. arbitrary 3D encoding;
3. semantically congruent embodiment;
4. interactive/multimodal embodiment.

Include deliberately misleading mappings as adversarial controls. Measure comprehension, error detection, recall, confidence calibration, task time and transfer.

## 11. Collision boundaries for parallel machines

The following remain exclusive/shared seams:

- `docs/ROADMAP.md`;
- `governance/*.json` and generated projections;
- evidence authority contracts;
- `SemanticEmbodimentGraph`, `RepresentationGraph`, `PerceptualEmbodimentPlan` schema files while being versioned;
- persistence/replay format changes;
- shared test-group configuration.

Machines may work in parallel around these seams when they use isolated adapters, fixtures, research harnesses or backend implementations. Contract/schema changes land first, then dependent lanes refresh from main.

Every machine-facing tranche must state:

- lane ID;
- exact roadmap tranche ID;
- base SHA;
- expected touched paths;
- exclusive seams, if any;
- prerequisite PRs;
- exit test/evidence;
- STOP conditions.

## 12. Architectural invariants

1. Rust/WASM remains the sole analytical authority.
2. Semantic-world contracts contain meaning, not rendering state.
3. RepresentationGraph decides what semantic phenomena to expose and coordinate.
4. Forma decides how admitted semantics become perceptual form; it cannot invent analytical facts.
5. SpatialEmbodimentPlan is one backend, not the whole embodiment ontology.
6. Every perceptual degree of freedom that carries data has a typed semantic binding.
7. Every binding is explainable and reversible to evidence/provenance.
8. Dynamic behaviour carries declared semantics or is decorative and excluded from analytical interpretation.
9. Perturbation animation visualizes an upstream semantic delta; animation is never evidence by itself.
10. System-1 is advisory. System-2 hard constraints/admissibility remain final.
11. Device adaptation may reduce richness, never change scientific meaning silently.
12. Search/learning optimize only inside admitted semantic/perceptual space.
13. Missing criteria produce ABSTAIN or a simpler mapping, not improvised certainty.
14. Human evidence is required for claims about comprehension, usefulness, comfort or cognitive benefit.

## 13. Immediate roadmap action

Before MCR2 implementation is promoted:

1. land this architecture decision;
2. run **L0-SEM-NORM** and **L2-FORMA-0** as architecture/contracts work;
3. revise MCR2 to compile semantic -> perceptual -> spatial rather than semantic -> spatial directly;
4. update FM5 System-1 proposal features to target Forma candidates;
5. move scriptc under the L4 runtime experiment classification;
6. dispatch machines by the lane table above, using lease/file-surface collision rules;
7. review at FM3 STOP and again before FM7 search.

This is an evolution of the existing architecture, not a rewrite. The existing evidence, semantic graph, RepresentationGraph, spatial plan, NIL, learning and device-performance work remain useful. The missing piece is the explicit **semantic-to-perceptual layer** that makes them converge on the product thesis.

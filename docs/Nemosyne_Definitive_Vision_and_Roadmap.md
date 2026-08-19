# Nemosyne: Definitive Product Vision, Principles, Architecture and Implementation Roadmap

**Status:** Governing product and implementation specification  
**Date:** 18 August 2026  
**Source basis:** current `docs/ROADMAP.md`, `docs/nemosyne-concept-paper-architecture.md`, current repository architecture, recent UX analysis, research-harness work, and prior architecture/security/code reviews.

---

## 1. Executive definition

Nemosyne is a **spatial investigation environment for analytical reasoning and controlled study of human interaction with analytical representations**.

It is not primarily:

- a VR dashboard;
- an AI visualisation generator;
- a data-science notebook rendered in three dimensions;
- a generic collaborative VR application; or
- a recommender wrapped in a virtual world.

Its distinctive proposition is the complete loop:

> **Nemosyne captures an analytical question, helps construct and inspect an investigation, chooses or exposes spatial representations appropriate to that investigation, records the evidence and reasoning that follow, and makes the resulting investigation reproducible and experimentally studyable.**

The central product object is therefore the **Investigation**, not the dataset, session, dashboard, or VR scene.

---

# 2. Vision

## 2.1 Product vision

Nemosyne should allow an analyst to move through a repeatable cycle:

```text
QUESTION / HYPOTHESIS
        ↓
     DATASET
        ↓
   INVESTIGATION
        ↓
  ANALYTICAL STATE
        ↓
 REPRESENTATION NEEDS
        ↓
 SPATIAL REPRESENTATION
        ↓
   HUMAN INSPECTION
        ↓
 OBSERVATION / EVIDENCE
        ↓
   DECISION / FINDING
        ↓
   CONCLUSION
        ↓
   REPLAY / BRANCH / SHARE
```

The system should remember the reasoning, not merely the final picture.

A saved Nemosyne investigation should answer:

- What question was being investigated?
- Which dataset version was used?
- What operations were performed, in what order?
- What computational methods and kernel versions produced the results?
- What representation was used, and why?
- What did the analyst inspect?
- What evidence was recorded?
- What was concluded?
- Which parts were human decisions and which were system recommendations?
- Can another researcher reproduce the same analytical state and representation?

## 2.2 Research vision

Nemosyne should make it possible to study not only whether a person reaches the correct analytical result, but **how spatial representation and interaction affect the reasoning process**.

The Research Harness therefore surrounds the product rather than becoming the product. Research controls must be able to freeze or vary:

- representation;
- assistance;
- interaction mode;
- task order;
- explanation behaviour;
- personalization;
- perception/ML models;
- collaboration state; and
- other treatment variables.

A research result must be attributable to an explicit experimental condition.

## 2.3 Long-term vision

The mature Nemosyne system becomes a **spatial version-control system for analytical investigations**:

```text
Investigation A
   ├── operation 1
   ├── operation 2
   ├── observation
   │
   ├── Branch B
   │     └── alternate representation
   │
   └── Branch C
         └── alternate hypothesis
```

The **Investigation is the canonical record**. The Memory Palace is one persistent spatial projection of that record, not a second state model and not the authoritative place where investigation state lives.

A useful distinction is:

```text
Investigation
    = what happened, what was known, what was decided, and why

Representation
    = how that investigation is spatially expressed

Memory Palace
    = the persistent spatial projection of the investigation's
      analytical history, evidence and reasoning
```

The same Investigation must therefore be capable of supporting more than one representation, replaying without depending on a previously rendered scene, and being inspected outside VR without losing its semantic meaning.

---

# 3. What Nemosyne is trying to achieve

Nemosyne has four mutually reinforcing goals.

### Goal A: analytical truth

The system must produce deterministic, versioned computational results through the canonical Rust/WASM kernel.

### Goal B: meaningful representation

The system must connect analytical state and human task to an explicit representation strategy without conflating analytical semantics with rendering implementation.

### Goal C: human reasoning evidence

The system must capture the human actions, observations and decisions necessary to understand how a finding was reached.

### Goal D: scientific reproducibility

An investigation must be serializable, replayable, branchable and suitable for controlled experimentation.

These goals are inseparable. A spectacular VR representation that cannot be reproduced is not enough. A perfect analytical result that nobody can understand or interact with is not enough. A study that cannot attribute its treatment variables is not enough.

---

# 4. Core product model

The following domain objects are canonical.

## 4.1 Investigation

The principal product object.

```text
Investigation
 ├─ investigationId
 ├─ task
 ├─ hypothesis / question
 ├─ datasetRef
 ├─ datasetVersion
 ├─ analyticalState
 ├─ operationChain
 ├─ evidenceLedger
 ├─ observations
 ├─ findings
 ├─ representationHistory
 ├─ analystDecisions
 ├─ conclusion
 └─ provenance
```

An Investigation is a persistent, versionable graph that preserves alternative reasoning paths.

**Boundary:** callers interact with an Investigation through semantic commands and queries. They do not mutate its internal collections, ledger or state objects directly.

## 4.2 Task / hypothesis

The representation system must understand the human purpose of the analysis.

Examples:

- find anomalies;
- compare groups;
- trace influence;
- understand communities;
- inspect temporal change;
- investigate a hypothesis;
- identify an unexpected structure.

Dataset topology alone is insufficient to determine the best representation.

## 4.3 Analytical state

The current authoritative state of analysis, including dataset version, operation chain, results and kernel provenance.

Atlas owns this state. The Rust kernel computes it.

## 4.4 Evidence

Evidence is not merely telemetry.

Evidence includes:

- computed result;
- observation target;
- analytical finding;
- user annotation;
- representation state;
- decision context;
- provenance;
- supporting interaction evidence.

## 4.5 Representation

A representation is the system's explicit answer to:

> How should this investigation inhabit spatial/visual form for the current analytical purpose?

It is distinct from rendering primitives.

## 4.6 Session

A session is an execution context for an investigation.

It carries:

- presentation state;
- active interaction state;
- collaboration state;
- current spatial arrangement;
- temporary UI state.

Session is not the authoritative analytical model.

**Boundary:** session state may reference or request changes to an Investigation, but it must not become a second owner of analytical truth. Persisted scene state, UI state, peer presence and temporary interaction state are reconstructible execution state, not an alternative investigation ledger.

## 4.7 Study

A Study contains controlled investigations across participants, conditions and tasks.

It defines the experimental treatment boundary.

---

# 5. The governing conceptual architecture

Nemosyne is modular by **semantic ownership**, not merely by code organisation. Each major subsystem has a defined responsibility, a public contract, an owned class of state or behaviour, and explicit boundaries that prevent it from becoming an alternate authority.

The canonical dependency direction is:

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

The direction is intentional:

- The **Application / Composition Root** wires modules together but owns no domain meaning.
- The **Research Harness** constrains and observes the product without becoming part of the treatment unless explicitly configured by a study.
- **Collaboration** transports authenticated, attributable commands and observations but does not own the state those commands change.
- The **Spatial Runtime** turns semantic representation strategies into an interactive world but does not compute analytical truth.
- **Atlas** orchestrates analytical operations and representation decisions around the Investigation.
- **Representation / Draco** determines how valid analytical meaning should inhabit space.
- The **Investigation** owns the canonical semantic state and provenance of the investigation.
- The **Rust/WASM Kernel** is the canonical computational authority.

### 5.1 Investigation

The Investigation is the canonical persistent domain object and the semantic spine of Nemosyne.

```text
Investigation
├── question / task / hypothesis
├── dataset reference + version
├── analytical state
├── operation history
├── evidence
├── observations
├── findings
├── decisions
├── representation history
├── conclusion
└── provenance
```

It answers:

> **What happened in this investigation, what was known, what was observed, what was decided, and why?**

The Investigation is versionable and graph-structured so that alternative reasoning paths can be preserved without mutating their parents.

**Boundary:** callers interact with an Investigation through semantic commands and queries. They do not mutate its internal collections, graph, ledger or state objects directly.

**Boundary:** the Investigation domain depends on semantic contracts and value types, not directly on Three.js, WebXR, WebRTC, UI implementation or a concrete Rust/WASM implementation. Adapters invert those infrastructure dependencies where required.

### 5.2 Atlas

Atlas is the **application/service orchestration layer** around the Investigation. It connects the Investigation to the kernel, structure discovery and representation requirements.

```text
Atlas
├── analytical orchestration
├── kernel invocation
├── structure discovery
├── constraint arbitration
├── representation orchestration
└── evidence / provenance coordination
```

Atlas may coordinate changes to the Investigation, but it is not a second owner of persistent investigation state.

**Boundary:** Atlas does not render scenes, own Three.js state, or define domain truth independently of the Investigation and kernel contracts.

### 5.3 Representation / Draco

Representation is one semantic module rather than a parallel architecture built around Draco alone.

```text
representation/
├── requirements
├── constraints
├── strategy
├── recommender
├── provenance
└── draco-adapter
```

The distinction is:

```text
Investigation asks:
    What do I need to understand?

Representation asks:
    What spatial strategy satisfies those needs?

Spatial Runtime asks:
    How do I embody that strategy as an interactive world?
```

Draco consumes validated facts, representation requirements and experimental constraints. It does not compute raw-data truth or directly manipulate the scene.

### 5.4 Research Harness

The Research Harness is a separate module because its unusual responsibility is to control and observe the product **without silently becoming part of the treatment**.

```text
research-harness/
├── study protocol
├── treatment configuration
├── participant / session study identity
├── observer instrumentation
├── trial lifecycle
└── outcome export
```

It depends on public product contracts. The product must remain capable of operating without research machinery except where a study explicitly requires it.

### 5.5 Collaboration

Collaboration owns transport and peer coordination:

```text
CollaborationGateway
├── connect
├── authenticate
├── presence
├── command transport
└── observer stream
```

**Boundary:** collaboration may deliver an authenticated, attributable semantic command to the owning subsystem, but it must not mutate Investigation internals directly.

**Boundary:** network roles are not themselves research authority. A peer's effective role must resolve through authentication and study policy before a state-changing command is accepted.

### 5.6 Perception

Perception interprets interaction signals and remains deliberately observational.

```text
Perception
    ↓
PerceptionObservation
    ↓
EvidenceCandidate / InteractionCommand
```

and never:

```text
Perception
    ↓
Direct Investigation mutation
```

Gesture Intelligence follows the same boundary: it may classify or score interaction input, but the host determines whether the resulting interpretation becomes an attributable command.

### 5.7 Spatial Runtime and Memory Palace

The Spatial Runtime is one substantial module whose purpose is to turn semantic spatial state into an interactive world.

```text
spatial-runtime/
├── engine
├── webxr
├── interaction
├── navigation
├── UI
├── artefacts
└── rendering
```

The Memory Palace is the persistent spatial projection produced by this runtime from Investigation state and representation strategy. It may be discarded and reconstructed without changing the Investigation.

**Boundary:** spatial state is derived execution state. It must never become an alternate source of analytical truth or provenance.

### 5.8 Persistence

Persistence owns durable representations and storage mechanics:

```text
persistence/
├── Investigation serialization
├── .nemosyne package format
├── storage adapters
├── schema migration
└── integrity / compatibility checks
```

Persistence serializes and reconstructs the Investigation through its public contract. Persisted JSON, IndexedDB records, caches and exported packages are representations of state, not independent authorities.

### 5.9 Modularity

A module is justified when it has a coherent responsibility, a public contract and explicit ownership of state or behaviour. The repository structure may evolve, but internal implementation details must not become cross-module dependencies.

Each principal module should expose, as appropriate:

```text
public API
semantic contracts
lifecycle contract
failure / degraded-mode contract
tests
architectural invariants
```

The `gesture-intelligence` module is the model for this approach: isolation is valuable because the subsystem is independently understandable, testable and replaceable.

**Boundary rule:** a module may depend on another module's public contract, but never on its internal state.

Architectural tests should enforce the dependency graph and forbidden direct mutations rather than relying on documentation alone.

---

# 6. Architectural principles

These are product-level rules, not implementation preferences. Together they define the boundaries that make Nemosyne easier to reason about, test and evolve.

## P1. Human task before dataset topology

Representation is chosen in response to analytical purpose and human task, not solely to whether a dataset is a graph, time series, table, geo field, etc.

## P2. Rust is the sole production analytical authority

All research-relevant analytical transforms occur through the versioned Rust/WASM kernel. No production TypeScript analytical implementation may coexist as an alternative path.

## P3. Investigation owns persistent analytical meaning and provenance

The Investigation is the sole owner of persistent analytical state, evidence linkage, investigation history and the authoritative provenance ledger.

Atlas orchestrates changes to the Investigation and connects it to computation and representation, but it must not become a second owner of that state.

## P4. Draco consumes facts and requirements; it does not invent analytical truth

Draco does not compute raw-data statistics or redefine domain semantics. It chooses among valid representation strategies based on Atlas-supplied requirements and evidence.

## P5. Rendering primitives are implementation details

Crystal, Plinth, Orb, Beam, Column, ChartPlane and similar constructs must never become semantic authorities.

## P6. Recommendation is not prescription

The system may recommend a representation, but the provenance model must distinguish:

```text
system recommendation
researcher choice
participant choice
fixed experimental treatment
randomized treatment
```

## P7. Every recommendation must be explainable

A representation decision must be able to answer:

```text
why this representation?
what evidence supported it?
what constraints excluded alternatives?
how confident is the recommendation?
```

## P8. Human evidence is first-class

Observation, annotation and analyst decisions are durable research evidence, not debug metadata.

## P9. Adaptive behaviour must be experimentally controllable

Any system behaviour that can alter task experience must be freezeable by the Research Harness.

## P10. Determinism is a research feature

Same dataset version + same kernel version + same analysis specification + same representation inputs must produce the same result.

## P11. Replay means semantic replay

Replay must reproduce the analytical and representational sequence, not merely move objects around in the scene.

## P12. Progressive disclosure is architectural

The interface must expose different capability layers according to user role and task rather than presenting the complete toolset to everybody.

## P13. UX quality is measurable but not self-validating

UX telemetry identifies evidence and hypotheses. It does not itself constitute a scientific conclusion.

## P14. Research instrumentation wraps the treatment

Study instrumentation must not unintentionally become part of the participant's treatment.

## P15. One canonical concept, one canonical name

There must not be two meanings for Atlas, Draco, Memory Palace, or similar names in live and dormant subsystems.

## P16. Build less, integrate more

A new subsystem is not considered complete until it is integrated into an end-to-end user capability and its provenance, failure mode and lifecycle are tested.

## P17. Modules are semantic boundaries, not folder boundaries

A major subsystem is a module when it has a coherent responsibility, a public contract and explicit ownership of state or behaviour. Internal implementation details must not become cross-system dependencies.

A module should expose:

```text
public API
domain contracts
lifecycle contract
failure contract
tests
architectural invariants
```

The `gesture-intelligence` module is the model for this approach: isolation is valuable because it makes the subsystem independently understandable, testable and replaceable.

## P18. One authority per kind of truth

Every important class of state has one canonical owner:

```text
analytical computation      → Rust/WASM kernel
investigation meaning/state → Investigation
analytical orchestration    → Atlas
representation strategy     → Draco / Representation
spatial embodiment          → Spatial Runtime
experimental treatment      → Research Harness
network admission/protocol  → Collaboration
perceptual observations     → Perception
```

Other modules may consume, project or request changes through public interfaces, but must not create competing authoritative copies.

## P19. Modules communicate through semantic contracts

Cross-module communication should use commands, domain objects and events whose meaning is independent of rendering or transport.

A module must not reach through another module's internals to mutate state. Network messages, Three.js objects, database records and UI widgets are implementation details at the boundary.

## P20. No alternate authority hidden behind fallback behaviour

A degraded or unavailable module must fail explicitly or enter a defined degraded mode. It must not silently substitute a second implementation of analytical or research-relevant behaviour.

In particular, Rust/WASM unavailability must not silently select a parallel analytical implementation.

## P21. Observation is not mutation

Perception, telemetry, observers and diagnostic systems may observe the system, but must not mutate authoritative Investigation state unless an explicit, attributable command passes through the owning API.

This distinction applies equally to:

```text
perception → observation
observer    → observation
telemetry   → measurement
participant → command
system      → recommendation
```

These are different semantic acts and must remain distinguishable in the model.

## P22. The composition root owns wiring, not domain meaning

Application startup may compose modules, configure dependencies and connect adapters. It must not become another semantic authority.

The application entry point should answer:

> Which modules are present, how are they connected, and under which configuration?

It should not answer:

> What does an Investigation mean?

## P23. Boundaries are testable

Every architectural boundary should have at least one executable invariant covering:

- allowed dependency direction;
- forbidden direct mutation;
- serialization/reconstruction expectations;
- failure/degraded behaviour;
- research treatment classification where applicable.

Architecture is therefore enforced by code and tests, not documentation alone.

## P24. The Investigation Graph is the semantic spine

Persistent analytical state, evidence, representation history, branching and reproducibility should be expressible through the typed Investigation Graph. Spatial scenes, session UI state and other materializations are projections of that graph, not parallel models.

## P25. A reproducible artefact must be regenerable

A shared Investigation must contain enough authoritative information to reconstruct its Memory Palace without depending on an opaque scene snapshot. Cached geometry may accelerate opening, but reproducibility is defined by reconstruction from semantic state and versioned representation inputs.

---

# 7. Analytical architecture

## 7.1 Rust/WASM kernel

The kernel is the deterministic computational substrate.

Responsibilities include:

- parsing and canonical dataset representation;
- schema and topology inference;
- statistics;
- analytical operations;
- TDA computations;
- analytical layouts;
- canonical fingerprints;
- provenance envelope generation;
- kernel versioning.

The implementation direction already reflects this model through mandatory WASM analytical execution, typed RuntimeBridge wrappers, kernel provenance and a versioned ABI.

## 7.2 Atlas

Atlas is the semantic orchestration layer above the kernel and the principal coordinator between the Investigation, computation and representation subsystems.

Atlas should not become a second domain model. The **Investigation is the canonical persistent research object**; Atlas provides the application-level operations that advance it, query it and connect it to the kernel and representation system.

Atlas therefore exposes and coordinates four areas of responsibility without claiming ownership of their persistent state:

### Analytical State coordination

```text
current dataset
operation chain
analysis results
state hashes
```

These are owned by the Investigation and computed or verified by the kernel where appropriate.

### Evidence Ledger coordination

```text
observations
findings
annotations
evidence links
analyst decisions
```

The authoritative ledger belongs to the Investigation. Atlas is responsible for applying valid commands and connecting evidence to analytical results.

### Constraint Arbiter

Hard constraints that must be respected by representation search:

- analytical validity;
- semantic correctness;
- accessibility;
- safety;
- experimental controls;
- study-specific restrictions.

### Representation Requirements

A structured output such as:

```text
RepresentationRequirements
 ├─ topology requirements
 ├─ analytical purpose
 ├─ semantic mappings
 ├─ required detail
 ├─ inspection requirements
 ├─ interaction requirements
 ├─ navigation constraints
 └─ study constraints
```

The updated roadmap correctly prioritizes the constraint-arbiter half before advanced search.

**Boundary:** Atlas may decide that a representation is required or may ask Draco to produce candidates, but Atlas does not render scenes and Draco does not own analytical truth.

## 7.3 Draco

Draco is a representation strategy engine.

Its stable abstraction should be broader than today's `DracoSpec`, but should remain decomposable:

```text
SpatialStrategy
 ├─ world type
 ├─ spatial strategy
 ├─ parameters
 ├─ layout strategy
 ├─ interaction strategy
 └─ detail strategy
```

Do not turn this into one giant representation object containing every rendering decision.

## 7.4 Spatial Runtime

The Spatial Runtime is the spatial embodiment module. It translates representation strategies into:

- scene graph;
- spatial assets;
- panels;
- input;
- navigation;
- world-space feedback;
- WebXR lifecycle.

**Boundary:** the Spatial Runtime consumes semantic representation commands and emits interaction observations/commands. It must not compute research-relevant analytical results, invent analytical semantics, or mutate Investigation state directly.

The runtime may maintain transient spatial state, but that state must be reconstructible from the authoritative Investigation plus representation/session state.

## 7.5 Module boundaries

The principal modules should be treated as independently reasoned subsystems:

```text
modules/
├── investigation/
├── atlas/
├── representation/
├── research-harness/
├── collaboration/
├── perception/
├── spatial-runtime/
├── persistence/
└── gesture-intelligence/
```

These names describe semantic ownership, not necessarily the final repository layout. A module may contain several implementation packages.

### Investigation

Owns the persistent analytical investigation model:

```text
question / task
dataset reference
analytical state
operation chain
evidence
observations
findings
decisions
representation history
conclusion
provenance
```

It does not import Three.js, WebXR, WebRTC or UI implementation.

### Atlas

Owns analytical application orchestration and the bridge between the Investigation, kernel and representation requirements.

It does not become the owner of rendering state.

### Representation / Draco

Owns representation requirements, constraints, candidate strategies and recommendation explanations.

It does not compute domain truth or directly manipulate the scene.

### Research Harness

Owns study protocol, treatment configuration, participant/session study identity, observer instrumentation and outcome export.

It wraps the product and must not become part of the participant's treatment unless explicitly specified.

### Collaboration

Owns transport, authentication, room membership, role enforcement, peer protocol and remote command delivery.

It may deliver an attributable command to the owning subsystem, but it must not mutate Investigation internals directly.

### Perception

Owns perceptual interpretation such as gesture, gaze, voice or interaction confidence.

It produces observations or evidence candidates. It never becomes an analytical authority.

### Spatial Runtime

Owns Three.js/WebXR embodiment, interaction surfaces, locomotion, scene lifecycle and transient spatial state.

### Persistence

Owns serialization formats, storage adapters, schema migration and package integrity. It does not reinterpret domain semantics.

A persistence adapter serializes and reconstructs an Investigation through its public contract. Persisted JSON, IndexedDB records and exported packages are representations of state, not independent authorities.

### Gesture Intelligence

Remains a pluggable perception subsystem. Its model lifecycle, feature schema, inference behaviour and provenance remain independently testable from the host runtime.

The critical rule is:

> **A module may depend on another module's public contract, but never on its internal state.**

---

# 8. Definitive UX model

The current roadmap's Phase 24 is accepted as the governing interaction architecture.

The user should perceive four conceptual surfaces:

```text
NAVIGATE → Hand Wheel
WORK     → Dashboard / task panels
OBSERVE  → World / representation
ANNOTATE → transient evidence tools
```

## 8.1 One primary navigation system

Hand Wheel is the primary navigation mechanism.

It should organize capabilities around:

```text
ANALYSE
VIEW
DATA
STUDY
COLLABORATE
SYSTEM
```

## 8.2 Dashboard = workspace

The dashboard is persistent working space, not a menu.

## 8.3 Panels = task surfaces

Panels should be:

- contextual;
- task-focused;
- role-aware;
- limited in simultaneous count.

Introduce panel roles:

```text
workspace
task
context
diagnostic
transient
system
```

## 8.4 Context cards = transient feedback

Important events should produce small, ephemeral affordances rather than forcing permanent panels open.

## 8.5 Interaction state machine

All interactive surfaces should share:

```text
idle
  ↓
focused
  ↓
armed
  ↓
confirmed
```

And the system-level modes should become:

```text
NAVIGATE
INTERACT
TRANSFORM
OBSERVE
```

Gesture ownership must be explicit.

## 8.6 Gaze + confirm

Because actual Quest telemetry showed severe pointer-target acquisition failure, important actions must not depend exclusively on precise ray intersection.

The preferred pattern is:

```text
gaze / coarse focus
        +
explicit confirm
```

rather than precision ray targeting as the only route.

## 8.7 Progressive disclosure

Four UX profiles are the canonical direction:

```text
Novice
Analyst
Researcher
Developer
```

Developer diagnostics must not compete with normal research use.

---

# 9. Research architecture

## 9.1 Experimental treatment boundary

Every feature capable of altering user experience must be classified:

| Capability | Controlled? | Logged? | Free during study? |
|---|---:|---:|---:|
| Representation | yes | yes | protocol-defined |
| Adaptive assistance | yes | yes | protocol-defined |
| Gesture classifier | yes | yes | protocol-defined |
| Personalization | yes | yes | protocol-defined |
| Explanations | yes | yes | protocol-defined |
| Collaboration | yes | yes | protocol-defined |
| Feedback modalities | yes | yes | protocol-defined |

A frozen study package must be able to guarantee that these treatment variables cannot drift between participants.

## 9.2 Two-condition study model

The current direction is a **2D versus VR** comparison.

The canonical 2D control is not a throwaway fallback. It is one half of the experiment and requires equivalent task fidelity, task semantics and instrumentation.

## 9.3 Observer role

Observers are part of the research instrumentation boundary and must remain non-mutating unless explicitly permitted by protocol.

**Boundary:** collaboration transport does not determine research authority. A peer's network role must resolve to an explicit study role and treatment policy before a state-changing command is accepted. Observer traffic can record or inspect, but cannot silently become a second path for changing Investigation state.

## 9.4 UX phenomenon vocabulary

UX-001 through UX-012 should be treated as stable evidence vocabulary, not automatic verdicts.

The replay fixture and derivation tests become the canonical acceptance mechanism for the inventory.

---

# 10. Memory Palace and Investigation Package

The **Memory Palace is a persistent spatial projection of the Investigation**, not the Investigation itself.

It is the spatial expression of the investigation's analytical history, evidence, representation choices and reasoning. The palace may persist as a user-facing artefact, but the authoritative state remains in the Investigation model and its provenance graph.

The fundamental relationship is:

```text
Investigation
    ↓
semantic state + history + evidence
    ↓
Representation Strategy
    ↓
Memory Palace / Spatial Projection
```

The inverse path is not authoritative:

```text
Memory Palace
      ✕
      ↓
does not become analytical truth
```

A renderer can therefore be replaced, a scene can be discarded, or a representation can be regenerated without changing what the Investigation means.

## 10.1 Investigation Graph as the canonical structure

The Investigation has a typed graph representation that is durable independently of any spatial renderer. The graph is the semantic spine of the Memory Palace and the basis for replay, branching, comparison and sharing.

A minimum conceptual graph is:

```text
Question / Hypothesis
        │
        ▼
DatasetVersion
        │
        ▼
AnalysisOperation
        │
        ▼
AnalysisResult
        │
        ├──────────────► Representation
        │                     │
        │                     ▼
        └──────────────► Observation
                              │
                              ▼
                            Finding
                              │
                              ▼
                            Decision
                              │
                              ▼
                           Conclusion
```

The graph must use an explicit, versioned node and edge vocabulary rather than an unrestricted generic graph. Relationships such as `motivates`, `uses-dataset`, `produces`, `informs`, `observes`, `supports`, `leads-to`, `branches-from` and `contradicts` are semantic facts and therefore belong to the Investigation model, not to the rendering layer.

A branch preserves lineage without mutating its parent:

```text
                    Analysis A
                       │
                ┌──────┴──────┐
                ▼             ▼
        Representation A   Representation B
                │             │
                ▼             ▼
           Observation A   Observation B
                │             │
                └──────┬──────┘
                       ▼
                    Finding
```

The graph therefore preserves alternative reasoning paths rather than only the final successful path.

**Design boundary:** graph identity and spatial identity are separate. An Investigation node has stable semantic identity; a Three.js object is only one temporary spatial projection of that node. The same semantic entity may have multiple spatial projections across representations, branches, sessions and devices.

**Design boundary:** the graph is authoritative for investigation meaning. Analytical materializations, representation manifests, spatial geometry, UI state and cached scene data are derived views. None may become an alternate source of truth.

## 10.2 What the Memory Palace should represent

The spatial projection should make investigation history perceivable:

```text
DatasetVersion
      ↓
AnalysisOperation
      ↓
AnalyticalState
      ↓
Observation
      ↓
Finding
      ↓
Representation
      ↓
Decision
      ↓
Conclusion
```

Spatial location, structure and artefact identity may encode useful semantic relationships, but those mappings must remain explicit and provenance-backed. Rendering primitives are not semantic authorities.

## 10.3 Required verbs

### Resume

Restore the Investigation and construct the appropriate spatial projection.

### Replay

Reconstruct the semantic analytical and representation sequence, then render it.

Replay must not depend on serializing or replaying Three.js object transforms alone.

### Branch

Fork an Investigation from a known semantic state without mutating the parent.

A branch is a new Investigation lineage, not a copied scene.

### Compare

Compare branches, representations, evidence or conclusions.

### Share

Export a portable, provenance-complete Investigation Package and, where useful, its spatial representation manifest.

### Explain

Reveal the evidence, analytical operations, representation rationale and human decisions associated with a state or spatial artefact.

## 10.4 Investigation Package and `.nemosyne`

A Nemosyne Investigation Package is the portable representation of an Investigation suitable for reopening, sharing, branching, comparison and reproducibility.

The package is authoritative for the investigation's **semantic state and provenance**. The Memory Palace contained or reconstructed from the package is a reproducible projection, not an independent source of truth.

The initial physical format may be a versioned container such as `.nemosyne`, for example:

```text
investigation.nemosyne
├── manifest.json
├── investigation/
│   ├── graph.json
│   └── state.json
├── dataset/
│   └── data.arrow              # when embedding is permitted
├── provenance/
│   ├── kernel.json
│   └── operations.json
├── representation/
│   └── strategy.json
├── evidence/
│   ├── observations.json
│   ├── findings.json
│   └── annotations.json
├── branches/
│   └── ...
└── assets/
    └── ...
```

The exact physical layout is an implementation detail. The logical contract is not.

The package manifest should identify, at minimum:

```text
packageId
schemaVersion
createdAt
investigationId

datasetFingerprint
graphFingerprint
analysisStateHash
representationHash

kernelVersion
kernelAbiVersion
nemosyneVersion

parentPackageId
branchId

integrityManifest
```

Where data or assets are not embedded, the package must record stable references and sufficient integrity/provenance information to identify what was required for reconstruction.

### Three levels of reproducibility

**Level 1 — Semantic**

Another investigator can inspect the same investigation graph:

```text
question
→ analysis
→ representation
→ observation
→ finding
→ conclusion
```

**Level 2 — Analytical**

Another investigator can reproduce the same analytical results from the same dataset version and computational inputs.

The package therefore records, where relevant:

```text
dataset fingerprint
operation chain
kernel version
ABI version
operation parameters
random seeds
normalisation rules
missing-value policies
```

**Level 3 — Spatial**

A compatible Nemosyne runtime can reconstruct the Memory Palace from semantic state and representation inputs.

The package records the representation strategy rather than relying on final mesh coordinates:

```text
Representation
├── strategy
├── semantic mappings
├── layout algorithm
├── parameters
├── interaction strategy
├── detail policy
└── representation provenance
```

The runtime then regenerates the world.

A spatial cache may be included to accelerate opening, but it is explicitly non-authoritative:

```text
authoritative
─────────────
Investigation Graph
Analytical State
Representation Strategy
Provenance

 derived
────────
Memory Palace geometry
GPU resources
cached layouts
textures
UI positions
```

## 10.5 Design boundaries

- The Memory Palace does not own analytical truth.
- Three.js object identity does not define Investigation identity.
- Scene transforms are not a substitute for analytical provenance.
- Spatial artefacts reference semantic Investigation IDs rather than becoming identifiers of analytical facts.
- A saved Investigation remains meaningful without opening VR.
- A representation can be regenerated from the Investigation and representation manifest.
- Multiple representations can exist for the same Investigation, especially for research comparison.
- Research replay distinguishes semantic replay from visual replay.
- A `.nemosyne` package is a portable investigation artefact, not merely a scene export.
- Package integrity, schema compatibility and reconstruction requirements are explicit and testable.

The branch model and package schema must therefore be defined at the Investigation level before implementation. They are not merely scene-serialization features.

---

# 11. Perception and ML

Perception interprets human input. It must not become an analytical authority.

It may provide:

```text
gesture candidates
gaze state
hand availability
voice intent
interaction confidence
```

It must not directly mutate Atlas or Investigation state.

**Boundary:** perception produces observations or evidence candidates. Any state-changing action must be converted into an explicit command owned by the relevant domain module and recorded as attributable provenance.

Every ML-mediated decision should expose:

```text
modelVersion
featureSchema
confidence
source
personalizationState
fallback/degradedReason
```

For research builds, perception models and personalization must be freezeable.

The current standalone gesture-intelligence module remains experimental until it is integrated behind these rules and evaluated with real, non-synthetic study data.

---

# 12. Evidence and adaptation loop

The long-term learning loop is:

```text
Representation
     ↓
Human interaction
     ↓
Observed evidence
     ↓
Research outcome
     ↓
Evidence model
     ↓
Future recommendation
```

But this must not become naive self-reinforcement.

The system must distinguish:

```text
exploration data
training data
validation data
holdout evaluation data
production recommendation data
```

Live recommendations must not simply reinforce their own previous selections.

Advanced adaptive Draco is therefore beyond stable release and remains gated on the Research Harness and constraint arbiter.

---

# 13. Definitive implementation roadmap

The roadmap is now organized by product capability and architectural gates, while retaining the project's existing phase work as implementation detail.

## Gate 0 — Foundations and ambiguity removal

### Objective
Create one unambiguous architecture and remove competing meanings.

### Work
- retire or explicitly quarantine obsolete `src/ai` Draco designs;
- complete World facade decommission;
- establish Investigation terminology;
- define Task/Hypothesis domain model;
- establish experiment treatment-boundary model;
- align roadmap, concept paper and architecture docs;
- preserve Rust/WASM as the sole analytical authority;
- define module ownership and public contracts for the principal subsystems;
- establish forbidden dependency directions and architectural boundary tests.

### Exit criteria
- no unresolved duplicate analytical or Draco implementations;
- Investigation, Task, Evidence, Representation are canonical domain terms;
- each principal subsystem has an explicit owner and public contract;
- no module directly mutates another module's authoritative state;
- architecture dependency checks pass.

---

## Gate 1 — Understand

### Objective
Create a first-class Investigation.

### Work
- Investigation aggregate;
- Task/Hypothesis model;
- dataset/version reference;
- analytical state linkage;
- initial evidence ledger;
- Atlas state integration;
- deterministic investigation serialization.

### Exit criteria
A user can create an Investigation and reopen it with identical analytical state.

---

## Gate 2 — Represent

### Objective
Make representation selection explicit, explainable and research-safe.

### Work
- Atlas constraint arbiter;
- RepresentationRequirements;
- widened hierarchical SpatialStrategy type;
- Draco consumes Atlas requirements and kernel facts;
- recommendation rationale;
- confidence/uncertainty;
- explicit system-versus-human representation provenance.

### Exit criteria
Given identical Investigation state and frozen inputs, Draco produces identical representation strategy plus a machine-readable explanation of why alternatives were rejected or ranked lower.

---

## Gate 3 — Experience

### Objective
Deliver a coherent analyst cockpit.

### Work
- Phase 24.1 interaction FSM and focus vocabulary;
- Phase 24.2 forgiving HandWheel;
- Phase 24.3 contextual VRMenu decomposition;
- Phase 24.4 panel-role taxonomy and diagnostic separation;
- Phase 24.5 dashboard-as-workspace and transient context cards;
- Phase 24.6 progressive disclosure;
- Phase 24.7 gesture ownership and both-pinch redesign;
- Phase 24.8 visual hierarchy and status strip;
- Phase 24.9 UX acceptance gates.

### Exit criteria
A novice can complete the primary investigation journey without understanding the internal UI architecture.

---

## Gate 4 — Investigate

### Objective
Make findings and evidence first-class.

### Work
- observation model;
- finding model;
- annotation / mark-moment workflow;
- evidence-to-analysis links;
- representation rationale persistence;
- human decision provenance;
- explainability views.

### Exit criteria
A saved Investigation can explain what was discovered, where, when and by which analytical and human actions.

---

## Gate 5 — Reproduce

### Objective
Turn the Memory Palace into investigation version control.

### Work
- replay;
- branch;
- compare branches;
- portable investigation package;
- `.nemosyne` package schema and manifest;
- provenance-complete sharing;
- semantic replay tests;
- Memory Palace regeneration from Investigation state;
- representation manifests decoupled from scene object identity;
- branch/compare semantics defined at the Investigation level;
- integrity and compatibility checks for shared packages.

### Exit criteria
A replay from a clean environment reconstructs the same analytical state and representation sequence, including kernel/version provenance, and a shared `.nemosyne` package can regenerate the Memory Palace without requiring the original scene snapshot.

---

## Gate 6 — Study

### Objective
Make the system scientifically usable as an instrument.

### Work
- canonical 2D control;
- 2D versus VR treatment package;
- counterbalancing;
- observer modes;
- consent;
- outcome schema;
- session manifest;
- correlated UX traces;
- frozen adaptive features;
- study package integrity and versioning.

### Exit criteria
A synthetic multi-participant run produces correctly joined telemetry, intervention, condition, representation, observer and outcome records, with treatment variables frozen.

---

## Gate 7 — Adaptive research

### Objective
Only after the stable instrument is valid, begin learning from evidence.

### Work
- empirical Draco weighting;
- holdout evaluation;
- perception/ML host integration;
- optional personalization;
- staged retraining;
- drift monitoring;
- federated research if justified.

### Exit criteria
Adaptive changes demonstrably improve outcomes without invalidating the experimental protocol.

This gate is **post-stable-release research**, not a prerequisite for the stable product.

---

# 14. Stable-release definition

A stable Nemosyne release is not “all planned features implemented.”

It is the smallest system that satisfies these properties:

It is the smallest system that satisfies these properties:

### Analytical
- Rust/WASM kernel is authoritative;
- kernel version and provenance are recorded;
- analytical state is deterministic and serializable.

### Investigation
- Task/Hypothesis exists;
- Investigation is first-class;
- evidence and findings are persistent;
- representation decisions are explainable.

### Spatial
- one coherent navigation model;
- contextual task surfaces;
- robust focus/confirmation model;
- acceptable Quest interaction performance.

### Research
- 2D control is equivalent in task semantics;
- study treatment variables can be frozen;
- observer role is non-mutating;
- telemetry and outcomes are joinable.

### Reproducibility
- session restore works;
- semantic replay works for the supported scope;
- the Investigation Graph is the canonical persisted semantic model;
- `.nemosyne` packages identify dataset, graph, kernel, ABI, schema and representation versions;
- a supported package can regenerate its Memory Palace without relying on cached scene geometry.

### Quality
- principal module boundaries are enforced by tests;
- lifecycle/resource leaks are absent;
- collaboration security controls are enforced;
- representative workloads meet frame budgets;
- UX acceptance gates pass.

---

# 15. Interim deployment modes

Nemosyne may be deployed before full productization, but deployment mode must be explicit.

### Public Research Preview

A bounded public or invitation-only preview may expose the supported investigation journey to real users for usability evidence and continued research. It is not equivalent to the stable product and must use a documented capability manifest, privacy/telemetry policy and security posture appropriate for untrusted users.

The preview should prefer local-first analytical execution and expose only capabilities that are sufficiently understood to produce interpretable evidence. Experimental subsystems may remain disabled or isolated.

A preview user's feedback should be reproducible where possible through an exported `.nemosyne` package plus explicit diagnostics and UX evidence, subject to the user's data-sharing choices.

### Productization

Full productization is a subsequent concern, not a reason to weaken the research instrument. Productization adds guarantees around:

```text
identity and access
privacy and data lifecycle
reliability and recovery
compatibility and performance
release management
support and observability
schema migration
upgrade / rollback
user documentation
```

These concerns should surround the Investigation architecture rather than introduce alternative authorities inside it.

---

# 16. Explicitly out of stable scope

The following should not delay the stable instrument unless research evidence makes them essential:

- evolutionary/Pareto Draco search;
- neural Draco weight prediction;
- full gesture-intelligence personalization loop;
- federated learning;
- broad voice command system;
- open-ended adaptive representation search;
- elaborate multi-user social features beyond the study requirements;
- speculative Memory Palace world-building unrelated to investigation replay.

These remain valuable research directions, not release blockers.

---

# 17. Decision framework for future work

Every proposed feature must answer these questions before implementation:

1. **Which human investigation problem does this solve?**
2. **Which canonical domain object owns it?**
3. **Does it change analytical truth, representation, interaction, or research treatment?**
4. **Does it introduce a second implementation of an existing capability?**
5. **Can a study freeze or vary it?**
6. **Can its behaviour be reproduced?**
7. **Can its decisions be explained?**
8. **What is its failure mode?**
9. **What evidence will prove it works?**
10. **What existing concept becomes simpler because this feature exists?**
11. **Which module owns the feature, and which module boundaries must remain unchanged?**

If the feature cannot answer these questions, it should not enter the core roadmap.

---

# 18. Definition of done for architecture

A subsystem is not complete when its code and unit tests exist.

It is complete when:

```text
code
  ↓
unit tests
  ↓
integration path
  ↓
end-to-end capability
  ↓
provenance
  ↓
failure handling
  ↓
research treatment classification
  ↓
UX evidence
  ↓
documentation alignment
  ↓
architectural boundary checks
```

This directly addresses the project's recurring build-then-strand pattern. A subsystem is not finished if it works only by reaching around another module's contract or by creating a second source of truth.

---

# 19. Final product thesis

Nemosyne should be built around one simple idea:

> **An analytical investigation is something a human does through data, representations, actions, observations and decisions. Nemosyne should preserve that whole process, not merely the resulting visualization.**

From that thesis the architecture follows naturally:

```text
Rust Kernel
    = what is computationally true

Investigation
    = the canonical record of what happened, what was known,
      what was observed, and what was decided

Atlas
    = how the application advances and interrogates that investigation

Draco / Representation
    = how the investigation should inhabit space

Spatial Runtime
    = how that representation becomes an interactive human experience

Evidence / Observation
    = what the human or system actually observed, with provenance

Memory Palace
    = a persistent spatial projection of the investigation,
      not an alternative state model

Research Harness
    = the controlled envelope in which the process is studied

Collaboration
    = how authorised peers exchange attributable commands and observations

Perception
    = how human interaction is interpreted without becoming an authority
```

The governing implementation strategy is therefore:

> **Make the Investigation trustworthy before making it adaptive. Make the interaction coherent before making it clever. Make the representation explainable before making it evolutionary.**

That is the shortest path from the current codebase to a distinctive, scientifically credible Nemosyne.

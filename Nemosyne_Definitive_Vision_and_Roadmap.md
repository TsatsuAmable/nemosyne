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

The Memory Palace is therefore not simply a saved VR room. It is a spatial projection of investigation history, evidence and reasoning.

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

An Investigation is persistent and versionable.

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

## 4.7 Study

A Study contains controlled investigations across participants, conditions and tasks.

It defines the experimental treatment boundary.

---

# 5. The governing conceptual architecture

```text
                           RESEARCH HARNESS
                controlled experiment + observation
                                │
                                │ wraps, does not own
                                ▼
                        ┌─────────────────┐
                        │  INVESTIGATION  │
                        └───────┬─────────┘
                                │
                 ┌──────────────┼──────────────┐
                 │                             │
                 ▼                             ▼
          TASK / HYPOTHESIS              DATASET VERSION
                 │                             │
                 └──────────────┬──────────────┘
                                ▼
                         ┌─────────────┐
                         │    ATLAS    │
                         │ what matters│
                         │ what happened│
                         │ evidence     │
                         │ provenance   │
                         └──────┬──────┘
                                │ requirements
                                ▼
                         ┌─────────────┐
                         │   DRACO     │
                         │ how it should│
                         │ inhabit space│
                         └──────┬──────┘
                                │ strategy
                                ▼
                       ┌─────────────────┐
                       │ SPATIAL RUNTIME │
                       │ three.js/WebXR  │
                       └──────┬──────────┘
                              │
                       HUMAN INTERACTION
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
          OBSERVATIONS                 PERCEPTION / ML
                │                           │
                └─────────────┬─────────────┘
                              ▼
                           EVIDENCE
                              │
                              ▼
                         INVESTIGATION
```

The Rust analytical kernel sits underneath Atlas as the canonical computational authority.

The Memory Palace is a persistent spatial projection of Investigation state and history, not an alternative state model.

---

# 6. Architectural principles

These are product-level rules, not implementation preferences.

## P1. Human task before dataset topology

Representation is chosen in response to analytical purpose and human task, not solely to whether a dataset is a graph, time series, table, geo field, etc.

## P2. Rust is the sole production analytical authority

All research-relevant analytical transforms occur through the versioned Rust/WASM kernel. No production TypeScript analytical implementation may coexist as an alternative path.

## P3. Atlas owns analytical state and provenance

Atlas is the sole owner of current analytical state, evidence linkage and the investigation ledger.

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

The current project has already moved the system strongly in this direction, including mandatory WASM analytical execution, typed RuntimeBridge wrappers, kernel provenance and versioned ABI.

## 7.2 Atlas

Atlas is the semantic authority above the kernel.

It should eventually contain four explicit areas:

### Analytical State

```text
current dataset
operation chain
analysis results
state hashes
```

### Evidence Ledger

```text
observations
findings
annotations
evidence links
analyst decisions
```

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

The Spatial Runtime translates representation strategies into:

- scene graph;
- spatial assets;
- panels;
- input;
- navigation;
- world-space feedback;
- WebXR lifecycle.

It must not mutate analytical truth directly.

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

## 9.4 UX phenomenon vocabulary

UX-001 through UX-012 should be treated as stable evidence vocabulary, not automatic verdicts.

The replay fixture and derivation tests become the canonical acceptance mechanism for the inventory.

---

# 10. Memory Palace

Memory Palace is the spatial projection of the Investigation Graph.

It should eventually represent:

```text
DatasetVersion
      ↓
AnalysisOperation
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

## Required verbs

### Resume
Restore investigation state.

### Replay
Reconstruct the exact analytical and representation sequence.

### Branch
Fork an investigation without mutating its parent.

### Compare
Compare two branches, representations or conclusions.

### Share
Export a portable, provenance-complete investigation package.

### Explain
Reveal the reasoning and evidence behind a state or representation.

The branch model must be defined before implementation. It is not simply another serialization feature.

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

It must not directly mutate Atlas state.

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
- preserve Rust/WASM as the sole analytical authority.

### Exit criteria
- no unresolved duplicate analytical or Draco implementations;
- Investigation, Task, Evidence, Representation are canonical domain terms;
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
- provenance-complete sharing;
- semantic replay tests.

### Exit criteria
A replay from a clean environment reconstructs the same analytical state and representation sequence, including kernel/version provenance.

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
- investigation packages identify kernel and schema versions.

### Quality
- lifecycle/resource leaks are absent;
- collaboration security controls are enforced;
- representative workloads meet frame budgets;
- UX acceptance gates pass.

---

# 15. Explicitly out of stable scope

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

# 16. Decision framework for future work

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

If the feature cannot answer these questions, it should not enter the core roadmap.

---

# 17. Definition of done for architecture

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
```

This directly addresses the project's recurring build-then-strand pattern.

---

# 18. Final product thesis

Nemosyne should be built around one simple idea:

> **An analytical investigation is something a human does through data, representations, actions, observations and decisions. Nemosyne should preserve that whole process, not merely the resulting visualization.**

From that thesis the architecture follows naturally:

```text
Rust Kernel
    = what is computationally true

Atlas
    = what the investigation knows and why

Draco
    = how the investigation should inhabit space

Spatial Runtime
    = how the human experiences that representation

Evidence / Observation
    = what the human actually did and discovered

Memory Palace
    = the spatial history of the investigation

Research Harness
    = the controlled envelope in which the process is studied
```

The governing implementation strategy is therefore:

> **Make the Investigation trustworthy before making it adaptive. Make the interaction coherent before making it clever. Make the representation explainable before making it evolutionary.**

That is the shortest path from the current codebase to a distinctive, scientifically credible Nemosyne.

# Paper 01 Concept — Nemosyne Core Principles

**Working title:** **Nemosyne: Principles for Spatial, Reproducible, Human-Governed Scientific Discovery**  
**Paper type:** exploratory systems / design-principles / research-agenda paper.  
**Status:** concept and evidence plan, not manuscript.  
**Tracking:** #648.

## 1. One-sentence thesis

Immersive analytics becomes more scientifically useful when spatial representation, interaction and adaptation are treated not as presentation conveniences but as **governed hypotheses inside a reproducible human reasoning process**, with analytical authority, abstention and provenance preserved by architecture.

## 2. Why this should be the first paper

Nemosyne already contains several ideas that are difficult to explain responsibly through a feature list:

- the system is not intended to be a 3D scatterplot viewer;
- Moneta is not intended to be an oracle that chooses a pretty visualization;
- XR gestures are not intended to bypass domain semantics;
- the Memory Palace is not intended to be decorative spatial history;
- adaptive models are not intended to silently rewrite research conditions;
- provenance is not intended to be bolted on after an insight is found.

These principles constrain the implementation and create testable research questions. Publishing them first gives later empirical papers a clear theoretical and system context, while allowing the community to challenge the assumptions before Nemosyne accumulates a large evaluation literature of its own.

## 3. Primary research question

> **What design and architectural principles are required for an immersive analytical environment to support adaptive spatial representation while preserving scientific authority, human judgement and reproducibility?**

Supporting questions:

1. How should analytical computation, representation reasoning, interaction semantics, discovery meaning and learning authority be separated so that adaptation cannot silently change scientific meaning?
2. How should an immersive system represent datasets as meaningful structures rather than treating individual observations as the universal rendering primitive?
3. How should a representation recommender expose infeasibility, alternatives and provenance rather than fabricate a result when evidence is insufficient?
4. How can interaction remain modality-independent and replayable across desktop, controller, hand tracking and future inputs?
5. What must be persisted so an investigation can be reopened and defended after software, models or representations evolve?
6. Which claims are architectural hypotheses versus empirically demonstrated human benefits?

## 4. Proposed contributions

The paper should claim a **coherent design framework and instantiated prototype architecture**, not proven improvement in scientific discovery.

### C1 — Discovery-centred system objective

Define Nemosyne's target outcome as a progression:

```text
Notice
  -> Question
    -> Hypothesis
      -> Investigation
        -> Understanding
          -> Validation
            -> Discovery
```

A session is successful to the extent that it supports meaningful, defensible understanding and preserves the reasoning/evidence path, not merely because it produces engagement or an attractive spatial scene.

### C2 — Five separate semantic authorities

Describe the explicit separation of:

| Authority | Governing question | Nemosyne owner |
|---|---|---|
| Analytical | What can be established from the data? | Rust/WASM analytical kernel |
| Representation | What can be expressed spatially/perceptually, and which representation is fit? | Representation contracts / Moneta |
| Interaction | What does the researcher mean to do? | Perception → InteractionIntent → NIL |
| Discovery | What was noticed, investigated, understood and established? | Investigation / Evidence |
| Learning | What did researchers teach Nemosyne about useful representation or interaction? | Judgement / learning / model registry |

The architectural hypothesis is that keeping these authorities separate reduces silent semantic drift as the system becomes adaptive.

### C3 — Dataset-level semantic embodiment

State the principle that a dataset-level representation should be generated from authoritative analytical structure rather than by styling or rearranging source rows in the renderer.

Canonical target path:

```text
canonical dataset
  -> analytical evidence / governed representation builder
    -> bounded semantic payload
      -> spatial embodiment
        -> progressive disclosure to observations when requested
```

Point-per-observation geometry remains valid when the analytical task genuinely concerns observations. It is not the universal fallback.

### C4 — Abstention before fabrication

If no representation satisfies hard scientific/preservation constraints, Moneta should produce an inspectable NIL/infeasible/ambiguous outcome rather than silently substitute a convenient layout.

This paper can present this as a research/design principle and show the implemented typed-NIL path. Later Moneta papers should evaluate whether abstention improves analytical outcomes.

### C5 — Modality-independent semantic interaction

Define the interaction path:

```text
physical input
  -> perception
    -> InteractionIntent
      -> NIL
        -> investigation / Atlas
          -> semantic operation
```

This separates how an action was expressed from what the action means, supporting desktop/XR parity, replay, accessibility, future input modalities and frozen research treatments.

### C6 — Provenance and investigation as first-class architecture

Present `.nemosyne`, the evidence ledger, replay identity, investigation branching and the Memory Palace graph as mechanisms for retaining the relationship between:

- dataset identity;
- commands/interaction semantics;
- analytical evidence;
- representation/model identity;
- hypotheses and alternatives;
- findings and interpretations;
- validation/discovery state.

The design goal is not merely audit logging: the reasoning history should itself be navigable and challengeable.

### C7 — Adaptive Product Mode, freezeable Research Mode

Adaptive models can improve the product only if the system can also freeze or explicitly treat them as experimental variables. Relevant identities include dataset, kernel, representation ontology, Moneta/FitnessModel, NIL, gesture/perception model, seeds, build and runtime configuration.

This is a core bridge between an adaptive product and reproducible HCI/scientific studies.

### C8 — Bootstrap candidates are not the final representation theory

Present the current bounded Moneta candidate set as an engineering/product bootstrap. The long-term research direction is:

```text
DatasetEvidence
+ InvestigationIntent
+ ResearcherContext
+ RepresentationOntology
        ↓
RepresentationGraph candidate/composition generation
        ↓
Moneta / FitnessModel search
        ↓
inspectable representation hypotheses
        ↓
human investigation + evidence + judgement
        ↓
validated learned priors
```

The paper should describe this as a research agenda, not as an implemented capability.

## 5. Candidate core principles

A compact principles section could use the following ten statements.

1. **Optimise for defensible discovery, not immersion for its own sake.**
2. **Keep scientific and adaptive authorities explicit and non-overlapping.**
3. **Represent dataset structure, not merely collections of rendered observations.**
4. **Prefer abstention and explanation to fabricated certainty.**
5. **Treat representation choice as an inspectable hypothesis.**
6. **Separate physical input from semantic analytical intent.**
7. **Make provenance and replay part of the investigation model.**
8. **Keep the human able to inspect, challenge, override and branch.**
9. **Permit product adaptation while making research conditions freezeable.**
10. **Treat fixed representations as a bootstrap toward governed compositional representation search.**

These are candidate wording. Each principle must be checked against related work before being framed as novel.

## 6. Claim / evidence matrix

The most important protection against overclaiming is to make the evidence boundary visible in the manuscript.

| Proposed paper statement | Current evidence class | Safe wording for Paper 01 | Evidence needed for stronger wording |
|---|---|---|---|
| Nemosyne implements a multi-stage discovery lifecycle | `IMPLEMENTED` / partial `SOFTWARE_VERIFIED` | "The prototype operationalises a Notice→…→Discovery investigation state model." | Human study showing the lifecycle improves reasoning/discovery |
| Analytical and representation authority are separated | `IMPLEMENTED` + architecture tests | "The architecture separates analytical evidence from representation reasoning and presentation." | Independent artifact audit / broader production evidence if claiming robustness |
| Dataset-level semantic representations exist | `SOFTWARE_VERIFIED` for current completed families | "The prototype includes bounded dataset-level aggregate/distribution/density/cluster/relationship representations." | Comparative human evidence for usefulness |
| Moneta can abstain instead of fabricating a representation | `IMPLEMENTED`; exact-head hardening currently in #647 | "The system defines typed no-feasible-candidate outcomes and does not require a fabricated fallback." | Evaluation of abstention quality and downstream human effects |
| NIL supports modality-independent semantics | `IMPLEMENTED` / product-path evidence for current tasks | "Current desktop and XR actions can dispatch through shared semantic intent paths." | Comprehensive cross-device equivalence/usability study |
| `.nemosyne` preserves investigations for replay | `SOFTWARE_VERIFIED` within current supported boundaries | "The prototype persists a reproducible investigation package with explicit runtime/historical provenance boundaries." | Cross-version replication / independent artifact validation |
| Memory Palace improves sensemaking | `PROPOSED` as outcome claim | **Do not claim.** Describe the graph/projection and hypothesis. | Controlled human study |
| Nemosyne helps researchers discover things they would otherwise miss | `PROPOSED` | **Do not claim.** State this as the north-star hypothesis. | Formal comparative study with defensible discovery outcomes |
| XR is superior to desktop for Nemosyne | `PROPOSED` / not established | **Do not claim.** Treat platform value as empirical. | Controlled comparison by task/data class |
| Moneta chooses the "best" representation | not supported | **Do not claim.** Use "feasible/ranked hypothesis" language. | Defined target utility + strong held-out evaluation; even then avoid universal "best" |
| Full compositional Moneta exists | `PROPOSED` | Present as future research architecture. | P2 implementation/evaluation |

## 7. Related-work map

Paper 01 should organise related work by problem, not by institution.

### 7.1 Immersive analytics

Use Dwyer et al. (2018), Skarbez et al. (2019), DashSpace and subsequent immersive-analytics work to establish the field, known opportunities and unresolved questions around embodied data analysis.

**Nemosyne distinction to investigate:** scientific investigation/reproducibility plus adaptive representation is the centre, rather than collaboration, immersive presentation or one fixed 3D analytical technique.

### 7.2 Visual analytics and semantic interaction

Use Endert/Fiaux/North and related visual-analytics work on sensemaking, direct/semantic interaction and human-in-the-loop model steering.

**Nemosyne distinction to investigate:** one modality-independent intent/provenance language spanning a persistent investigation architecture, rather than interaction solely as model steering.

### 7.3 Grammars and automated visualization design

Use Vega-Lite, Draco/Draco 2, VizML and later visualization-recommendation literature.

**Nemosyne distinction to investigate:** spatial representation hypotheses constrained by authoritative dataset evidence, preservation/loss contracts, actual embodiment fitness, abstention and investigation context, with an eventual compositional `RepresentationGraph`.

### 7.4 Provenance and reproducible analysis

A dedicated literature review is still required here. Search visual analytics provenance, computational notebooks, workflow provenance, analytic trails, branching histories and reproducible interactive analysis. This is a likely source of important prior art for Memory Palace and `.nemosyne` claims.

### 7.5 Human-AI scientific discovery

A dedicated literature review is also required. Distinguish Nemosyne from autonomous discovery systems: the intended role is to generate/compare representation hypotheses while leaving scientific interpretation and evidential judgement inspectable and human-governed.

## 8. Paper outline

### Abstract

Problem → design thesis → Nemosyne framework → implemented prototype scope → research agenda → explicit statement that human discovery benefit remains to be tested.

### 1. Introduction

- immersive systems create new representational and interaction possibilities;
- adaptive AI creates new risks of semantic drift and opaque guidance;
- scientific investigation requires evidence, alternatives, provenance and reproducibility;
- Nemosyne asks what architecture is required if all three are treated as one problem.

End with 3–4 precise contributions, not a feature inventory.

### 2. Related Work

- immersive analytics;
- visual analytics / semantic interaction;
- visualization grammars and recommendation;
- provenance/reproducibility;
- human-AI scientific reasoning.

### 3. Research Problem and Design Requirements

Motivate failure modes:

- point-first rendering masquerading as dataset representation;
- duplicated analytical authority in UI code;
- recommendation without abstention;
- input-specific semantic commands;
- adaptive models changing experimental conditions;
- provenance as afterthought;
- immersive novelty being mistaken for analytical benefit.

### 4. Nemosyne Principles

Present the ten principles with rationale and links to prior work.

### 5. Architecture Instantiation

Explain the current prototype:

- Rust/WASM analytical authority;
- representation contracts + Moneta;
- Atlas/investigation;
- NIL;
- spatial runtime;
- evidence/provenance;
- Product vs Research Mode.

The architecture section should remain understandable without repository-internal acronyms; introduce subsystem names only after the concepts.

### 6. Worked Investigation

Use one or two public/known-answer datasets to walk through:

```text
load
→ authoritative evidence
→ representation proposal / possible abstention
→ spatial investigation
→ semantic drill-down
→ question/hypothesis
→ compare/challenge
→ understanding/validation
→ preserve/reopen
```

This is a **demonstration of the architecture**, not a user-study result.

### 7. Falsifiable Research Agenda

Turn the principles into experiments:

- when do dataset-level spatial representations outperform observation-first views?
- does explicit abstention reduce misleading analytical action?
- does explanation of rejected alternatives improve calibrated reliance on Moneta?
- does Memory Palace improve provenance comprehension or investigation resumption?
- does semantic interaction parity improve transfer across desktop/XR?
- which task/data classes benefit from immersive embodiment?
- can learned representation ranking generalise across users/datasets/tasks without contaminating analytical authority?
- can compositional representation search produce useful representations that fixed catalogues miss?

### 8. Limitations and Threats

Must include:

- current prototype maturity;
- limited physical-device/human evidence;
- possible XR novelty/engagement confounds;
- challenge of defining "discovery" and comparing discovery quality;
- selection/post-selection effects;
- researcher degrees of freedom;
- representation search-space bias;
- model/interaction adaptation as experimental confounds;
- hardware/platform dependence;
- single-project/single-builder origin and heavy AI-assisted implementation;
- potential mismatch between architectural cleanliness and actual human utility.

### 9. Conclusion

Return to the proposition: spatial analytical systems should treat representation and interaction choices as governed parts of scientific reasoning, then invite empirical falsification of that proposition.

## 9. Figure plan

**Figure 1 — The Nemosyne investigation loop**  
Notice → Question → Hypothesis → Investigation → Understanding → Validation → Discovery, with evidence/provenance accumulating rather than disappearing between stages.

**Figure 2 — Five authorities**  
A clean architecture diagram showing analytical, representation, interaction, discovery and learning boundaries plus the product/runtime planes that may transport but not redefine them.

**Figure 3 — Truthful representation path**  
Canonical dataset → authoritative evidence → semantic representation payload → spatial embodiment → progressive observation drill-down.

**Figure 4 — Moneta decision model**  
Evidence/intent/context → hard constraints → feasible candidates / NIL → fitness ranking → selected and rejected alternatives → provenance.

**Figure 5 — Investigation graph / Memory Palace**  
Question/hypothesis/evidence/finding/discovery nodes with branch and replay relations. Label the current implementation boundary versus intended richer spatial projection.

**Figure 6 — Bootstrap to Full Moneta**  
Current fixed candidate ranking on the left; future RepresentationOntology + RepresentationGraph + bounded compositional search on the right.

**Optional Figure 7 — Evidence ladder**  
Proposed → implemented → software verified → device observed → human observed → experimentally supported → replicated.

## 10. Candidate abstract skeleton

Do not finalise this until the literature review is complete, but the paper should roughly make this argument:

> Immersive analytics systems increasingly combine spatial interaction, automated analysis and adaptive guidance, yet these capabilities can blur the boundary between analytical evidence, representation choice, interaction semantics and human interpretation. We present Nemosyne, an exploratory architecture and research programme for spatial scientific investigation built around explicit semantic authorities, dataset-level representation, abstention-aware representation reasoning, modality-independent interaction, reproducible investigation provenance and freezeable adaptive components. We describe the design principles, their instantiation in a WebXR/Rust-WASM prototype, and a worked investigation demonstrating how representation proposals and analytical actions remain attributable. Rather than claiming that immersion or adaptive representation improves discovery by construction, we derive a falsifiable research agenda for evaluating when these mechanisms improve, distort or fail scientific sensemaking.

This is an **argument skeleton**, not final abstract wording.

## 11. What not to put in Paper 01

- detailed PT0–PT10 engineering chronology;
- CI architecture, agent workflow and individual PR history except where methodological provenance requires it;
- claims that Quest performance is solved without physical evidence;
- detailed gesture-model training results that do not yet exist;
- claims about full RepresentationGraph/compositional search as implemented;
- every Nemosyne feature;
- marketing language such as "revolutionary", "natural", "zero learning curve" or "best representation" unless converted into testable hypotheses;
- a giant architecture diagram containing every class/module;
- user-value/PMF claims as substitutes for academic outcome measures.

## 12. Pre-submission evidence package

Minimum package for a credible exploratory systems paper:

1. immutable Nemosyne code snapshot;
2. immutable `nemosyne-data` corpus revision;
3. reproducible build/runtime instructions;
4. two or more worked cases with known analytical expectations;
5. exported `.nemosyne` investigation examples;
6. exact representation/model/kernel provenance for those cases;
7. screenshots/video from desktop and XR product paths where relevant;
8. claim ledger showing evidence class for every contribution statement;
9. related-work bibliography with explicit influence/contrast mapping;
10. limitations/adversarial review record.

## 13. Suggested title alternatives

- **Nemosyne: A Research Architecture for Reproducible Immersive Scientific Discovery**
- **Beyond 3D Data Views: Principles for Human-Governed Adaptive Immersive Analytics**
- **Representations as Hypotheses: A Reproducible Architecture for Immersive Scientific Sensemaking**
- **Nemosyne: Separating Evidence, Representation, Interaction and Learning in Immersive Analytics**

The first working title is the broadest and safest until the novelty review tells us which principle is strongest.

## 14. Next writing steps

1. complete provenance/related-work audit;
2. write a 1–2 page extended argument using sections 1–4 above;
3. freeze 2–4 representative system walkthroughs from current main after the active hardening branch lands;
4. generate the six core figures from the canonical V3 contracts;
5. perform an academic adversarial review asking whether each principle is novel, merely good engineering, or already established in prior work;
6. revise the contribution statement around the strongest surviving novelty;
7. only then expand into the full manuscript.

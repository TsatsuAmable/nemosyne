# Nemosyne — Definitive Product Vision, Principles, Architecture and Implementation Roadmap

**Revision:** V3.1 — Discovery-Centric, Human-Refined, Compositional and Skeptical Representation Intelligence  
**Date:** 25 August 2026  
**Status:** Governing product, research and architecture specification  
**Supersedes:** all earlier Definitive Vision and Roadmap revisions

---

# 1. Executive definition

Nemosyne is a **research instrument for helping researchers develop meaningful, potentially novel understanding of datasets they already care about**.

The central question is not whether VR is better than 2D, and it is not whether an algorithm can automatically select the best visualisation. The governing question is:

> **Can Nemosyne help a researcher familiar with a specific dataset discover relationships, structures, anomalies, patterns or interpretations that are genuinely useful and meaningful to their research, including understanding they would not otherwise have appreciated?**

VR is one possible embodiment. Moneta, Rust analytics, gesture recognition and the Spatial Runtime are components of a larger discovery system, not products in isolation.

Nemosyne must make not only a preferred interpretation visible, but also the **argument around that interpretation**: relevant evidence, plausible alternatives, uncertainty, instability, rejected hypotheses, branch points and the path by which a conclusion was reached.

The defining product posture is therefore:

> **Nemosyne is not a machine for making patterns compelling. It is a research instrument for making competing interpretations inspectable, testable, falsifiable and reproducible.**

```text
DATASET
  ↓
ANALYTICAL EVIDENCE
  ↓
REPRESENTATION HYPOTHESES
  ↓
SPATIAL / INTERACTIVE EMBODIMENT
  ↓
RESEARCHER EXPLORATION
  ↓
OBSERVATION
  ↓
QUESTION / HYPOTHESIS
  ↓
CHALLENGE / ALTERNATIVE / ANALYTICAL TEST
  ↓
MEANINGFUL UNDERSTANDING
  ↓
SUPPORTED / REFUTED / INCONCLUSIVE FINDING
  ↓
HUMAN JUDGEMENT + EVIDENCE
  ↓
IMPROVED REPRESENTATION PRIORS
```

The long-term destination is a **human-refined, empirically validated, compositional representation and discovery system** whose initial heuristics progressively become evidence-based priors.

---

# 2. The conceptual leap

The current generation is useful bootstrap infrastructure:

```text
dataset → DatasetSignature → Moneta → predefined candidates → heuristic fitness → winner
```

It is not the permanent architecture.

The target is:

```text
dataset
  ↓
Rust analytical evidence
  ↓
DatasetEvidence + InvestigationIntent + ResearcherContext
  ↓
RepresentationOntology
  ↓
candidate / composition generation
  ↓
FitnessModel
  ↓
representation hypotheses
  ↓
researcher interaction
  ↓
DiscoveryEpisode
  ↓
challenge + analytical verification
  ↓
evidence + human judgement
  ↓
model learning
  ↓
new prior
```

The initial heuristics are not Nemosyne's theory of useful representation. They are the first prior.

A mature Nemosyne must support both **selection** and **counterfactual inspection**. The researcher must be able to ask not only “what do you recommend?” but also “what did you nearly recommend?”, “why did you reject it?”, “what changes if the assumptions change?” and “what evidence could falsify what I think I see?”.

---

# 3. Product thesis and meaningful discovery

Nemosyne succeeds when a researcher can move from:

> “I know this dataset.”

into:

> “I understand something important about this dataset that I did not previously appreciate, I can explain why I believe it, I know what would weaken that belief, and Nemosyne preserves the evidence and reasoning that led there.”

The discovery lifecycle is explicit:

1. **Notice** — something appears interesting. A notice is not a finding.
2. **Question** — the researcher asks what it may mean.
3. **Hypothesis** — a testable proposition is formed.
4. **Investigation** — filtering, comparison, alternate representations and analytical operations are used.
5. **Challenge** — the researcher seeks instability, counterexamples, alternative explanations, perturbation sensitivity or evidence that would falsify the hypothesis.
6. **Understanding** — an interpretation relevant to the research context develops.
7. **Validation** — the interpretation survives appropriate analytical scrutiny.
8. **Discovery** — meaningful understanding is recorded with evidence and provenance.

`DiscoveryEpisode` is therefore a first-class domain object:

```text
DiscoveryEpisode
├── discoveryId
├── investigationId
├── datasetFingerprint
├── notice
├── hypothesis
├── explorationPath
├── analyticalTests[]
├── evidence[]
├── conclusion
├── validationStatus
├── representationContext
├── interactionContext
├── researcherJudgement
└── provenance
```

Validation states include `UNTESTED`, `UNDER_INVESTIGATION`, `SUPPORTED`, `REFUTED`, `INCONCLUSIVE`, and `EXTERNALLY_VALIDATED`.

## 3.1 Productive ambiguity and negative capability

Unresolved states are not product failures.

Nemosyne MUST allow researchers to remain in uncertainty when the evidence does not justify a single answer. An investigation may retain competing hypotheses or representations without forcing premature resolution. `AMBIGUOUS`, `UNDERDETERMINED`, `INFEASIBLE`, `INCONCLUSIVE` and `REFUTED` are meaningful epistemic states and must remain inspectable in the investigation history.

A refuted hypothesis is not deleted. It becomes evidence about the reasoning path and may prevent later investigators from repeating the same false trail.

## 3.2 Skepticism as an interaction capability

Any materially interesting pattern should have a coherent route to:

- inspect the evidence behind it;
- compare a plausible alternative representation;
- inspect sensitivity or stability where meaningful;
- seek counterexamples or contradictory evidence;
- state or inspect a falsifier;
- run an analytical test;
- record support, refutation or inconclusive status.

The system should make **trying to break a pattern** almost as accessible as revealing it.

---

# 4. Five distinct ontologies

Nemosyne MUST keep five kinds of knowledge separate.

## 4.1 Analytical Ontology

**Question:** What structures can be reliably established about the dataset?  
**Authority:** Rust/WASM.

Examples include distributions, clusters, density, anomalies, dependencies, temporal structure, spectral structure, manifold structure, topology, stability and multiscale properties.

## 4.2 Representation Ontology

**Question:** What structures can Nemosyne express spatially and perceptually?  
**Authority:** Representation subsystem / Moneta contracts.

Examples include point identity, density fields, clusters, trajectories, graphs, hierarchy, distributions, manifolds, spectral fields, uncertainty, stability, annotation, comparison, aggregation, detail expansion, sonification and haptic encodings where scientifically appropriate.

## 4.3 Interaction Ontology

**Question:** What meaningful operations can a researcher perform?  
**Authority:** Nemosyne Interaction Language (NIL), Investigation and Atlas.

Examples: `SELECT`, `FILTER`, `ISOLATE`, `COMPARE`, `EXPAND`, `COLLAPSE`, `FOCUS`, `SHOW`, `HIDE`, `OVERLAY`, `REMAP`, `ANALYSE`, `QUESTION`, `HYPOTHESISE`, `TEST`, `ANNOTATE`, `CONCLUDE`, `PREFER`, `REJECT`, `ADJUST_WEIGHT`, `REQUEST_ALTERNATIVE`, `EXPLAIN`.

## 4.4 Discovery Ontology

**Question:** What did the researcher notice, investigate, challenge, understand and establish?  
**Authority:** Investigation / Evidence.

## 4.5 Learning Ontology

**Question:** What did researchers collectively teach Nemosyne about useful representation?  
**Authority:** Judgement and Fitness Model infrastructure.

No module may silently become a second authority for another ontology.

---

# 5. Target system architecture

```text
                         DATASET
                            │
                            ▼
                    ┌───────────────┐
                    │ Rust/WASM     │
                    │ Analytical    │
                    │ Kernel        │
                    └───────┬───────┘
                            ▼
                    DATASET EVIDENCE
                            │
                 ┌──────────┴──────────┐
                 ▼                     ▼
         Investigation Intent    Researcher Context
                 └──────────┬──────────┘
                            ▼
                 ┌─────────────────────┐
                 │ Representation      │
                 │ Ontology            │
                 └──────────┬──────────┘
                            ▼
                 ┌─────────────────────┐
                 │ Moneta              │
                 │ Fitness Model       │
                 │ Search / Composer   │
                 │ Explanation         │
                 └──────────┬──────────┘
                            ▼
                   RepresentationGraph
                            │
                            ▼
                 ┌─────────────────────┐
                 │ Spatial Runtime     │
                 │ 2D / VR / other    │
                 └──────────┬──────────┘
                            ▼
                 ┌─────────────────────┐
                 │ Perception /        │
                 │ Gesture Intelligence│
                 └──────────┬──────────┘
                            ▼
                           NIL
                            │
                            ▼
                       RESEARCHER
                            │
          Observe / Compare / Challenge / Investigate
                            │
                            ▼
                    DiscoveryEpisode
                            │
                            ▼
                    Analytical Tests
                            │
                            ▼
                       Evidence
                            │
                            ▼
                  Human Judgement Data
                            │
                            ▼
                    Training Pipeline
                            │
                            ▼
                    Model Registry
                            │
                            ▼
                   New Moneta Prior
```

The architectural backbone is:

```text
Rust:          What can we establish about the data?
Moneta:        How might we represent those facts to make useful structure discoverable?
NIL:           What does the researcher want to do with that representation?
Investigation: What happened, what did the researcher think, challenge and establish?
```

---

# 6. Canonical ownership rules

| Truth / state | Canonical owner |
|---|---|
| Raw analytical computation | Rust/WASM |
| Analytical result provenance | Rust/WASM + Investigation |
| Investigation meaning | Investigation |
| Analytical orchestration | Atlas |
| Representation ontology/contracts | Representation module |
| Representation hypothesis / fitness | Moneta |
| Spatial embodiment | Spatial Runtime |
| Interaction interpretation | Perception / Gesture Intelligence |
| Semantic interaction commands | NIL |
| Human observation / discovery | Investigation / Evidence |
| Research treatment | Research Harness |
| Durable package | Persistence |
| Network transport | Collaboration |
| Learned population prior | Fitness Learning / Model Registry |

**Hard invariant:** compatibility layers may adapt contracts, but they may not retain independent reasoning or state authority.

The same rule applies to future autonomous agents, generative representation systems and multimodal models. They may propose intents, hypotheses, candidate RepresentationGraphs or judgements; they may not silently become analytical or investigation authority.

---

# 7. Rust/WASM as the Dataset Evidence Engine

Rust MUST NOT become the Moneta learner. Its job is to establish trustworthy analytical facts.

```text
DatasetEvidence
├── schema
├── cardinality
├── dimensionality
├── distributions[]
├── densityProfiles[]
├── clusters[]
├── anomalies[]
├── dependencies[]
├── temporalStructures[]
├── spectralStructures[]
├── manifoldProperties[]
├── topologicalProperties[]
├── scaleProperties[]
└── uncertainty[]
```

Every evidence item records method, parameters, result, uncertainty where meaningful, kernel version, determinism, provenance and limitations. Seeds, algorithm versions, numerical tolerances, missing-data policy and normalisation are explicit.

Priority expansion order is descriptive statistics, distributions, density, clustering, anomaly detection, dependency/correlation, temporal analysis, spectral analysis, dimensional/manifold structure, topology, then multiscale structure.

Where Nemosyne exposes perturbation, resampling or approximation, the analytical method, perturbation model, approximation mode, sample, seed, limits and stability result must be explicit. **Stability is not statistical confidence** and must never be labelled as such.

---

# 8. Representation Ontology and RepresentationGraph

A representation becomes a structured graph rather than a single candidate name.

```text
RepresentationGraph
├── primitives[]
├── semanticMappings[]
├── layoutPolicy
├── scalePolicy
├── interactionPolicy
├── detailPolicy
├── constraints[]
├── fitnessModelVersion
└── provenance
```

Initial primitives may include point identity, density, field, cluster, trajectory, hierarchy, graph, matrix, manifold, distribution, temporal encoding, spectral encoding, uncertainty, annotation, comparison, aggregation, filtering, expansion and multiscale navigation.

Each primitive specifies semantic inputs, visual encoding, interaction affordances, analytical dependencies, parameters, fitness features, limitations and provenance.

The ontology MUST be versioned and extensible. A new primitive must be addable without redesigning Moneta.

## 8.1 Comparison and counterfactual representation

A RepresentationGraph must be able to evolve toward deliberate comparison compositions in which more than one representation hypothesis can be inspected together.

The target UX supports:

- overlay where semantic correspondence is strong;
- side-by-side spatial comparison where representations differ structurally;
- linked selection across alternative representations;
- branch creation from an alternative representation;
- explicit display of why alternatives were rejected;
- unresolved alternatives when no decisive winner is justified.

Utility margin must not be turned into arbitrary geometric distance unless that encoding is explicitly defined.

## 8.2 Multimodal representation

Audio and haptic channels may eventually become representation primitives when they encode data or analytical evidence rather than atmosphere. Such mappings must be inspectable, versioned, reversible and research-freezeable.

Examples include temporal rate to rhythm, scalar magnitude to pitch range, periodicity to repeated motifs, density to haptic or audio texture, and explicit threshold events to haptic feedback.

---

# 9. Moneta: from recommender to representation compiler

Moneta consumes:

```text
DatasetEvidence
+ InvestigationIntent
+ ResearcherContext
+ FitnessModel
+ RepresentationOntology
```

and produces:

```text
RepresentationGraph
+ InteractionPlan
+ Explanation
+ FitnessEvidence
```

Moneta is a **hypothesis engine and decision-support system**, not an oracle.

The bootstrap stage remains deterministic, but heuristic weights and metadata MUST be labelled as heuristic priors, never as empirically validated truth. `confidence` terminology MUST NOT be used for uncalibrated heuristic utility.

A decision may be `DECISIVE`, `AMBIGUOUS`, `INFEASIBLE` or `UNDERDETERMINED`. Moneta must be able to abstain rather than manufacture a winner.

A representation decision exposes its winner, alternatives, utility/fitness dimensions, margin, constraints, sensitivity to weight perturbation, model version and provenance.

The Fitness Model is explicit, versioned and replaceable:

```text
FitnessModel
├── dimensions
├── weights
├── interactionTerms
├── contextualModifiers
├── constraints
├── aggregationPolicy
├── modelVersion
├── trainingProvenance
└── validationMetrics
```

Candidate dimensions include structural alignment, task alignment, information preservation, perceptual recoverability, scale suitability, density handling, occlusion, interaction cost, cognitive load, discovery affordance, researcher preference and empirical prior. These dimensions are hypotheses, not permanent truths.

## 9.1 Explainability and the road not taken

Moneta explanation is not limited to a prose justification for the winner. A mature explanation surface should answer:

1. What analytical evidence mattered?
2. What hard constraints were active?
3. What tradeoffs dominated the fitness result?
4. What was the runner-up or other near-miss representation?
5. Why was it rejected?
6. How sensitive is the result to declared perturbations or weight changes?
7. Is the result decisive, ambiguous, infeasible or underdetermined?

Rejected alternatives are counterfactual evidence, not UI debris.

Moneta evolves through these stages:

0. bootstrap heuristics;
1. human-adjustable fitness;
2. structured judgement;
3. aggregated human prior;
4. contextual model;
5. validated fitness;
6. compositional search;
7. explicitly controlled adaptive representation intelligence.

Open-ended generative geometry is not a shortcut around stage 6. If generative systems are introduced later, they must propose ontology-valid RepresentationGraphs which deterministic semantic, analytical and feasibility constraints can inspect and reject.

---

# 10. Human judgement and Fitness Learning

Nemosyne maintains separate learning datasets for:

1. **Preference data** (`A > B`);
2. **Fitness-adjustment data** (for example, increase density importance);
3. **Discovery-outcome data** linking representation → observation → hypothesis → analytical test → supported/refuted conclusion.

Discovery outcomes are the strongest eventual learning signal.

A `RepresentationJudgement` records researcher context, dataset fingerprint, task, discovery objective, compared representations, preference, absolute score when present, weight adjustments, reason, discovery outcome, model versions, kernel version and provenance.

The system MUST NOT learn solely from acceptance of its own recommendations. The learning pipeline therefore supports controlled alternative exposure, randomisation where appropriate, held-out researchers, held-out datasets, model versioning and offline evaluation.

Transparent preference/ranking/Bayesian/boosted/contextual models are preferred before neural models. CNNs or other neural architectures are introduced only when evidence demonstrates advantage. Contextual bandits are an eventual option, not an immediate architecture shortcut.

## 10.1 Epistemic separation of behavioural signals

Nemosyne MUST keep the following distinct:

- **recommendation**: what Moneta predicts may be useful;
- **preference**: what a researcher says they prefer;
- **attention**: what attracts or retains gaze or interaction;
- **convergence**: what multiple investigators or models independently select or conclude;
- **analytical evidence**: what Rust/WASM establishes under explicit methods;
- **validation**: what survives appropriate scrutiny.

Preference is not truth. Attention is not insight. Convergence is not peer review. Stability is not confidence. None of these signals may silently be promoted into another category.

Human preference between a current and candidate model may become structured judgement data, but it MUST NOT directly promote a model. Promotion remains governed by declared holdout evidence, evaluation policy, robustness and registry governance.

---

# 11. Model Registry and reproducibility

Every investigation references exact versions of analytical, representation, fitness, interaction and perception models.

```text
ModelRegistry
├── fitness/
├── representation/
├── perception/
├── analytical/
└── interaction/
```

Nemosyne has two modes:

**Deterministic research mode:** freezes dataset, Rust kernel, analytical parameters, Moneta model, Representation Ontology, fitness weights, NIL version, perception model, gesture model and random seeds.

**Adaptive exploration mode:** approved models may evolve, but history remains immutable. An investigation created under model v17 remains tied to v17 and is never silently reinterpreted using v18.

Every research-relevant result identifies dataset fingerprint, kernel version and parameters, ontology version, RepresentationGraph, Moneta/FitnessModel version, fitness weights, NIL version, perception/gesture versions, random seeds, interaction event stream and investigation version. Learned models additionally identify training dataset/code versions, feature schema, aggregation method, validation partition, evaluation metrics and model artifact hash.

A canonical digest establishes tamper-evident identity and replay relationships; it does not by itself prove that a source dataset is truthful, a method scientifically appropriate or a conclusion valid.

Future proof systems, including zero-knowledge or federated mechanisms, may strengthen privacy or trust under specific threat models. They are research-horizon capabilities and must not be confused with the scientific validity of an investigation.

---

# 12. Nemosyne Interaction Language (NIL)

**Interaction semantics are independent of input modality.**

```text
hand / controller / mouse / gaze / voice / agent
             ↓
         perception / intent proposal
             ↓
      InteractionIntent
             ↓
            NIL
             ↓
    Investigation / Atlas
             ↓
      semantic operation
```

A physical gesture is not authoritative state. It produces a candidate semantic intent.

Core NIL vocabulary covers navigation (`FOCUS`, `ZOOM`, `EXPAND`, `COLLAPSE`, `RETURN`), dataset manipulation (`SELECT`, `FILTER`, `ISOLATE`, `GROUP`, `COMPARE`, `JOIN`, `SPLIT`), representation (`SHOW`, `HIDE`, `REPLACE`, `OVERLAY`, `ENCODE`, `REMAP`, `EXPAND_DETAIL`, `CHANGE_SCALE`), analysis (`CLUSTER`, `CORRELATE`, `ANOMALY`, `DISTRIBUTE`, `PROJECT`, `TRANSFORM`, `SPECTRAL_ANALYSE`, `TRACE`), investigation (`OBSERVE`, `QUESTION`, `HYPOTHESISE`, `TEST`, `SUPPORT`, `REFUTE`, `ANNOTATE`, `CONCLUDE`) and representation intelligence (`PREFER`, `REJECT`, `COMPARE`, `ADJUST_WEIGHT`, `REQUEST_ALTERNATIVE`, `EXPLAIN`).

The same semantic investigation must be replayable across VR, desktop, future modalities, agents and accessibility interfaces.

Agents, if introduced, MUST act through attributable semantic intents or domain contracts. They do not receive a privileged path around Rust analytical authority, NIL semantics, Investigation provenance or research freeze controls.

---

# 13. Perception and Gesture Intelligence

Perception answers **what the researcher physically did**. NIL answers **what the action means**. Atlas/Investigation answers **what that semantic action should do**.

Gesture/ONNX models expose model version, feature schema, calibrated confidence, latency, source, personalisation state and fallback reason. They are freezeable for research and never mutate authoritative investigation state directly.

Biosignals such as gaze, pupillometry or future physiological measures may be useful research covariates or accessibility inputs. They MUST NOT be treated by default as evidence of insight, truth, scientific importance or representation quality.

---

# 14. Research safeguards

Nemosyne distinguishes `PRODUCT MODE` from `RESEARCH MODE`.

Product mode may adapt. Research mode must be freezeable.

A study can freeze representation, Moneta, FitnessModel, RepresentationOntology, NIL, perception, gesture, analytical methods and Rust kernel, or explicitly declare which components are adaptive. No adaptation may occur silently.

The 2D-vs-VR study remains one controlled experiment inside the broader research programme. Its clean first question is:

> **Given equivalent analytical semantics and representation content, does spatial embodiment improve meaningful dataset discovery?**

Dataset, analytical methods, representation semantics, task, evidence availability and analytical verification should be held constant while embodiment varies. Later experiments can compare fixed versus Moneta-selected representation, then bootstrap versus human-refined versus validated adaptive Moneta.

## 14.1 Research-facing UI safeguards

The interface must make experimental conditions and epistemic states visible without turning the world into a dashboard.

Research-relevant modes require explicit entry, continuous state indication and explicit exit. Model A/B comparison, frozen treatment, approximation mode, branch replay and adaptive operation may not become invisible modes.

User preference, model version, perception model, gesture model, analytical approximation, randomisation and treatment allocation must remain attributable in the investigation record where relevant.

---

# 15. Module architecture

The target repository is decomposed into independently owned, testable modules with explicit public contracts.

| Module | Responsibility | Exit criterion |
|---|---|---|
| Rust/WASM | Dataset Evidence Engine | Every Moneta input is typed, provenance-bearing evidence |
| Representation Ontology | Primitive registry, grammar, RepresentationGraph | Representations are compositions of primitives |
| Moneta | Fitness, search/composition, abstention, explanation | Generates/scores/explains hypotheses without fixed candidate authority |
| Human Judgement | Preference, weight and discovery-outcome evidence | Reproducible training dataset export |
| Fitness Learning | Transparent learned priors and evaluation | Learned model scientifically comparable with bootstrap |
| NIL | Semantic command language | Same investigation semantics across modalities |
| Perception / Gesture | Physical input → NIL intent | Enable/disable/freeze without semantic-state changes |
| Investigation | DiscoveryEpisode, evidence, branches and reasoning history | Discovery replay/audit independent of renderer |
| Atlas | Orchestrate discovery loop | Coordinates dataset → evidence → representation → interaction → verification → finding |
| Spatial Runtime | Embody RepresentationGraphs | Renders arbitrary valid graphs in 2D/VR/other modes |
| Research Harness | Freeze/vary intelligence and treatment | Any subsystem independently controllable in experiments |
| Persistence | Complete discovery and learning provenance | `.nemosyne` reconstructs analytical/discovery history |
| UI / Analyst Cockpit | Expose reasoning, alternatives, challenge and recovery controls | Researchers can understand/challenge Moneta and recover orientation |
| Collaboration | Shared discovery and peer review transport | No competing state authority |
| CI / Testing | Software + methodological integrity | Detects analytical, representation, replay, provenance and boundary regressions |

A module may depend on another module's **public contract**, never its internal state. Architecture tests enforce forbidden dependencies and duplicate authority.

## 15.1 Memory Palace as the investigation graph

The Memory Palace is conceptually and structurally the graph of investigation meaning rather than a decorative room containing data.

It may embody:

```text
Investigation
├── dataset / representation states
├── observations
│   └── questions
│       └── hypotheses
│           ├── tests
│           │   ├── evidence
│           │   └── outcomes
│           └── alternative hypotheses
├── branch points
├── findings
├── refuted / inconclusive paths
└── frozen checkpoints / related investigations
```

The live data world and the investigation graph are views over the same semantic investigation. The renderer must not become a second source of investigation history.

The graph should support route knowledge, branch comparison, replay, shared-ancestor context and stable semantic identities. It is the natural substrate for future cross-investigation comparison and collaboration.

## 15.2 Sparse cyberspace and functional world objects

Nemosyne's spatial identity is a **sparse cyberspace research environment in which the data receives the dominant visual and cognitive contrast**.

Every persistent world object MUST primarily serve at least one function:

- orient;
- operate;
- explain;
- remember;
- navigate;
- coordinate;
- preserve comfort or safety.

Objects without a functional role should be removed rather than decorated.

The target functional landmarks are:

- **Datum Plane**: spatial zero, horizon, scale and grounding reference;
- **TechnoCore**: epistemic instrument hub for lenses, Moneta explanation, alternatives, challenge/stability and provenance;
- **Evidence Vault / Ice Vault**: frozen checkpoints, DiscoveryEpisodes, replay, study freeze and `.nemosyne` package operations;
- **Farcaster Portals**: meaningful context travel such as branch, saved investigation, collaborator frame, overview/detail and return, not hidden ordinary analysis operations;
- **Beacons and Threads**: observations/findings and reasoning relationships.

The TechnoCore should remain a recognizable world landmark but may project or be summoned into a near-field manipulable instrument. Researchers should not be forced to walk to a distant landmark for routine epistemic actions.

---

# 16. Implementation gates

Implementation proceeds in this order. Gate numbers in older roadmaps are historical and must not be confused with V3 gates.

## Gate 0 — Authority reconciliation

- eliminate competing Draco/Moneta authorities;
- establish Rust analytical authority;
- establish Moneta representation authority;
- establish Investigation semantic authority;
- convert `src/draco/` into compatibility adapters only or remove it;
- add architecture tests preventing new representation scoring outside Moneta.

## Gate 1 — Dataset Evidence

- typed Rust evidence;
- provenance-bearing derived facts;
- deterministic replay;
- explicit uncertainty, approximation and stability provenance where meaningful.

## Gate 2 — Representation Language

- primitive registry;
- RepresentationGraph;
- composition grammar;
- ontology versioning;
- comparison/counterfactual composition semantics.

## Gate 3 — Moneta correctness

- complete requirement/scoring coverage;
- explicit FitnessModel;
- utility terminology;
- abstention;
- explanation;
- sensitivity analysis;
- alternatives / near-miss reasoning;
- metamorphic tests.

## Gate 4 — NIL

- semantic commands;
- modality independence;
- replay.

## Gate 5 — Discovery and skeptical investigation

- DiscoveryEpisode;
- hypothesis lifecycle;
- evidence linkage;
- validation;
- challenge/falsification workflow;
- stability/counterexample/alternative-representation paths;
- branch and reasoning history.

## Gate 6 — Human refinement

- realtime weight editing;
- pairwise preference;
- judgement provenance;
- controlled alternative exposure.

## Gate 7 — Learning infrastructure

- judgement store;
- curation;
- training/holdout separation;
- model registry.

## Gate 8 — Learned Moneta

- transparent ranking/contextual model;
- validation against bootstrap heuristics;
- no direct promotion from individual preference or engagement.

## Gate 9 — Compositional Moneta

- representation search;
- multiscale composition;
- hybrid representations;
- small deliberate comparison compositions before open-ended generation.

## Gate 10 — Adaptive Nemosyne

- controlled online adaptation;
- exploration/exploitation;
- rollback;
- monitoring.

---

# 17. Parallel implementation strategy

After Gate 0 establishes authority boundaries, work SHOULD run in parallel where dependencies permit.

```text
                 Gate 0: Authority reconciliation
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   Dataset Evidence     Representation        Investigation /
      (Rust)              Ontology              Discovery
          │                   │                   │
          └────────────┬──────┘                   │
                       ▼                          ▼
                    Moneta                       NIL
                       │                          │
          ┌────────────┼────────────┐             │
          ▼            ▼            ▼             ▼
      Spatial       Analyst      Research      Perception /
      Runtime       Cockpit      Harness       Gesture
          │            │            │             │
          └────────────┴──────┬─────┴─────────────┘
                              ▼
                       Human Judgement
                              │
                              ▼
                       Fitness Learning
                              │
                              ▼
                     Adaptive Nemosyne
```

Persistence and CI evolve continuously across every wave. Collaboration proceeds after semantic command/event contracts are stable enough to transport without owning domain state.

Full open-ended compositional search, generative geometry, federated learning, biosignal-conditioned models and autonomous multi-agent investigation MUST NOT be pulled into early gates merely because the architecture can imagine them.

---

# 18. Immediate implementation priorities

The first code tranche is deliberately correctness-first rather than model-complexity-first:

1. **Gate 0 / authority:** remove or quarantine independent Draco scoring/constraint authority; preserve only compatibility adapters where required.
2. **Moneta semantics:** replace uncalibrated `confidence` with `utilityScore`/`fitnessScore`; explicitly model decision status and abstention.
3. **Requirement coverage:** every public representation requirement must have a defined constraint/scoring/evidence/test effect.
4. **Fitness correctness:** active weights must normalise to 1.0 and every active component must contribute; maximum achievable utility must be testable.
5. **Sensitivity:** record winner/runner-up/margin and deterministic weight-perturbation sensitivity.
6. **Analytical provenance:** every derived structural fact used by Moneta carries method/version/parameters/seed/normalisation/missing-data/sampling provenance.
7. **Representation language:** introduce `RepresentationGraph` and primitive contracts without forcing the renderer migration into the same change.
8. **Metamorphic testing:** row shuffle must not change decisions; column renaming must not change decisions unless semantic metadata changes; duplicated observations must affect density/scale in defined ways.
9. **Research safety:** freeze Moneta out of experiments unless the protocol explicitly varies it; 2D and VR treatments share semantic representation contracts.
10. **Investigator-facing epistemics:** surface alternatives, decision status, actionable ambiguity, stability and falsification routes without presenting them as statistical confidence.
11. **Spatial UX coherence:** preserve a sparse data-first world, simplify the novice interaction vocabulary, give every persistent world object a functional role and make the TechnoCore a manipulable epistemic instrument rather than decorative set dressing.
12. **Discovery validation:** run bounded investigator studies before expanding learned or compositional complexity, using supported/refuted/inconclusive outcomes rather than preference alone.

Do not jump directly to a neural Moneta. The immediate bottleneck is evidence, representation, interaction and discovery architecture.

---

# 19. Evaluation

The primary outcome is **meaningful discovery**. A useful discovery is assessed for novelty relative to stated prior understanding, relevance to the research question, analytical support, articulability, reproducibility/defensibility and independent or subsequent validation where feasible.

Secondary outcomes include time to discovery, useful hypotheses, false discoveries, verification rate, challenge rate, counterexample use, branch creation, representation switches, interaction cost, cognitive load, confidence calibration and retention.

Interaction telemetry is evidence, not ground truth. Novelty is not truth. Attention is not usefulness. Consensus is not validation. A pattern becomes a finding only through investigation and validation.

UX evaluation additionally asks whether a researcher can explain:

- what they are looking at;
- why the representation was proposed;
- what alternative was plausible;
- what changed after an operation;
- what evidence supports a finding;
- what would weaken or falsify it;
- where the reasoning path forked;
- how to return to an earlier state.

---

# 20. Non-negotiable boundaries

- Do not train from raw production logs; create curated, versioned judgement datasets.
- Do not treat Moneta recommendations as ground truth.
- Do not equate interaction or attention with usefulness.
- Do not equate convergence or consensus with validation.
- Do not present stability, heuristic utility or engagement as calibrated statistical confidence.
- Do not make learned preferences permanent rules; they are priors.
- Do not let individual preference directly promote a learned model.
- Do not let adaptive systems silently change research conditions.
- Do not allow the Representation Ontology to collapse into a permanent static enum.
- Do not let generative systems bypass RepresentationGraph semantics and hard constraints.
- Do not let NIL become device-specific event handlers.
- Do not put representation reasoning into Rust; Rust establishes analytical evidence.
- Do not let agents bypass Rust analytical authority, NIL or Investigation provenance.
- Do not let Moneta become a black box.
- Do not preserve Draco as a competing authority.
- Do not use portals, landmarks or world objects as decorative substitutes for clear semantic interaction.
- Do not erase refuted or inconclusive reasoning paths from the investigation graph.
- Do not preserve obsolete code or documentation merely for familiarity; archive historical material where useful, otherwise delete it after migration and tests prove no live dependency remains.

---

# 21. Definition of architectural maturity

Nemosyne reaches the intended destination when:

```text
Rust                 establishes analytical evidence
Representation       defines what can be expressed
Moneta                constructs representation hypotheses
NIL                   defines meaningful interaction
Spatial Runtime       embodies hypotheses
Perception            translates human action into semantic intent
Investigation         preserves research meaning and reasoning branches
Discovery             captures meaningful understanding and challenge outcomes
Judgement             captures what researchers teach the system
Fitness Learning      converts evidence into improved priors
Model Registry        preserves reproducibility
Research Harness      makes adaptive layers experimentally controllable
```

The system can then evolve without changing its fundamental architecture.

## 21.1 Definition of experience maturity

The user experience is mature when a researcher can, without understanding the internal module architecture:

1. identify the dataset and current representation;
2. inspect a datum or meaningful structure;
3. perform, preview and undo an operation;
4. ask why a representation was chosen;
5. compare a plausible alternative;
6. challenge an attractive pattern;
7. record an observation and hypothesis;
8. run an analytical test;
9. distinguish supported, refuted and inconclusive outcomes;
10. recover the path to a finding;
11. branch from an earlier point;
12. collaborate without losing attribution;
13. freeze, export and replay the investigation;
14. move between VR and desktop without changing semantic meaning.

---

# 22. Final product vision

Nemosyne is not fundamentally a VR visualisation system, visualisation recommender, analytics package, gesture interface, neural network or chart generator.

It is:

> **A research instrument that connects trustworthy analytical computation, compositional representation, embodied interaction, human judgement and scientific evidence into a progressively improving system for discovering meaningful structure in datasets.**

The governing principle is:

> **Nemosyne must not encode a fixed theory of what constitutes a useful representation. It must provide an explicit, inspectable mechanism through which analytical evidence, human judgement, competing representations, skeptical investigation and validated discovery outcomes progressively refine that theory.**

Its spatial embodiment should make the **data** the dominant object, the **investigation** a navigable graph of reasoning, and the **interface** a restrained set of functional instruments.

The system should help a researcher remember not merely what looked interesting, but **where the evidence was, where the argument forked, what failed, what survived and why the conclusion is believed**.

**The destination is a reproducible system that becomes progressively better at helping researchers discover things that matter without becoming progressively better at persuading them of things that do not.**
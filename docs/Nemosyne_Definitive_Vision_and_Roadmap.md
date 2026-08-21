# Nemosyne — Definitive Product Vision, Principles, Architecture and Implementation Roadmap

**Revision:** V3 — Discovery-Centric, Human-Refined, Compositional Representation Intelligence  
**Date:** 21 August 2026  
**Status:** Governing product, research and architecture specification  
**Supersedes:** all earlier Definitive Vision and Roadmap revisions

---

# 1. Executive definition

Nemosyne is a **research instrument for helping researchers develop meaningful, potentially novel understanding of datasets they already care about**.

The central question is not whether VR is better than 2D, and it is not whether an algorithm can automatically select the best visualisation. The governing question is:

> **Can Nemosyne help a researcher familiar with a specific dataset discover relationships, structures, anomalies, patterns or interpretations that are genuinely useful and meaningful to their research, including understanding they would not otherwise have appreciated?**

VR is one possible embodiment. Moneta, Rust analytics, gesture recognition and the Spatial Runtime are components of a larger discovery system, not products in isolation.

```text
DATASET
  ↓
ANALYTICAL EVIDENCE
  ↓
REPRESENTATION HYPOTHESIS
  ↓
SPATIAL / INTERACTIVE EMBODIMENT
  ↓
RESEARCHER EXPLORATION
  ↓
OBSERVATION
  ↓
HYPOTHESIS
  ↓
ANALYTICAL INVESTIGATION
  ↓
MEANINGFUL UNDERSTANDING
  ↓
VALIDATED FINDING
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
analytical verification
  ↓
evidence + human judgement
  ↓
model learning
  ↓
new prior
```

The initial heuristics are not Nemosyne's theory of useful representation. They are the first prior.

---

# 3. Product thesis and meaningful discovery

Nemosyne succeeds when a researcher can move from:

> “I know this dataset.”

into:

> “I understand something important about this dataset that I did not previously appreciate, I can explain why I believe it, and Nemosyne preserves the evidence and reasoning that led there.”

The discovery lifecycle is explicit:

1. **Notice** — something appears interesting. A notice is not a finding.
2. **Question** — the researcher asks what it may mean.
3. **Hypothesis** — a testable proposition is formed.
4. **Investigation** — filtering, comparison, alternate representations and analytical operations are used.
5. **Understanding** — an interpretation relevant to the research context develops.
6. **Validation** — the interpretation survives appropriate analytical scrutiny.
7. **Discovery** — meaningful understanding is recorded with evidence and provenance.

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

---

# 4. Five distinct ontologies

Nemosyne MUST keep five kinds of knowledge separate.

## 4.1 Analytical Ontology

**Question:** What structures can be reliably established about the dataset?  
**Authority:** Rust/WASM.

Examples include distributions, clusters, density, anomalies, dependencies, temporal structure, spectral structure, manifold structure, topology and multiscale properties.

## 4.2 Representation Ontology

**Question:** What structures can Nemosyne express spatially and perceptually?  
**Authority:** Representation subsystem / Moneta contracts.

Examples include point identity, density fields, clusters, trajectories, graphs, hierarchy, distributions, manifolds, spectral fields, uncertainty, annotation, comparison, aggregation and detail expansion.

## 4.3 Interaction Ontology

**Question:** What meaningful operations can a researcher perform?  
**Authority:** Nemosyne Interaction Language (NIL), Investigation and Atlas.

Examples: `SELECT`, `FILTER`, `ISOLATE`, `COMPARE`, `EXPAND`, `COLLAPSE`, `FOCUS`, `SHOW`, `HIDE`, `OVERLAY`, `REMAP`, `ANALYSE`, `QUESTION`, `HYPOTHESISE`, `TEST`, `ANNOTATE`, `CONCLUDE`, `PREFER`, `REJECT`, `ADJUST_WEIGHT`, `REQUEST_ALTERNATIVE`, `EXPLAIN`.

## 4.4 Discovery Ontology

**Question:** What did the researcher notice, investigate, understand and establish?  
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
              Observe / Refine / Investigate
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
Investigation: What happened, what did the researcher think, and what was established?
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

Moneta evolves through these stages:

0. bootstrap heuristics;
1. human-adjustable fitness;
2. structured judgement;
3. aggregated human prior;
4. contextual model;
5. validated fitness;
6. compositional search;
7. explicitly controlled adaptive representation intelligence.

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

---

# 12. Nemosyne Interaction Language (NIL)

**Interaction semantics are independent of input modality.**

```text
hand / controller / mouse / gaze / voice
             ↓
         perception
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

---

# 13. Perception and Gesture Intelligence

Perception answers **what the researcher physically did**. NIL answers **what the action means**. Atlas/Investigation answers **what that semantic action should do**.

Gesture/ONNX models expose model version, feature schema, calibrated confidence, latency, source, personalisation state and fallback reason. They are freezeable for research and never mutate authoritative investigation state directly.

---

# 14. Research safeguards

Nemosyne distinguishes `PRODUCT MODE` from `RESEARCH MODE`.

Product mode may adapt. Research mode must be freezeable.

A study can freeze representation, Moneta, FitnessModel, RepresentationOntology, NIL, perception, gesture, analytical methods and Rust kernel, or explicitly declare which components are adaptive. No adaptation may occur silently.

The 2D-vs-VR study remains one controlled experiment inside the broader research programme. Its clean first question is:

> **Given equivalent analytical semantics and representation content, does spatial embodiment improve meaningful dataset discovery?**

Dataset, analytical methods, representation semantics, task, evidence availability and analytical verification should be held constant while embodiment varies. Later experiments can compare fixed versus Moneta-selected representation, then bootstrap versus human-refined versus validated adaptive Moneta.

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
| Investigation | DiscoveryEpisode, evidence and reasoning history | Discovery replay/audit independent of renderer |
| Atlas | Orchestrate discovery loop | Coordinates dataset → evidence → representation → interaction → verification → finding |
| Spatial Runtime | Embody RepresentationGraphs | Renders arbitrary valid graphs in 2D/VR/other modes |
| Research Harness | Freeze/vary intelligence and treatment | Any subsystem independently controllable in experiments |
| Persistence | Complete discovery and learning provenance | `.nemosyne` reconstructs analytical/discovery history |
| UI / Analyst Cockpit | Expose reasoning and challenge controls | Researchers can understand/challenge Moneta |
| Collaboration | Shared discovery and peer review transport | No competing state authority |
| CI / Testing | Software + methodological integrity | Detects analytical, representation, replay, provenance and boundary regressions |

A module may depend on another module's **public contract**, never its internal state. Architecture tests enforce forbidden dependencies and duplicate authority.

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
- deterministic replay.

## Gate 2 — Representation Language

- primitive registry;
- RepresentationGraph;
- composition grammar;
- ontology versioning.

## Gate 3 — Moneta correctness

- complete requirement/scoring coverage;
- explicit FitnessModel;
- utility terminology;
- abstention;
- explanation;
- sensitivity analysis;
- metamorphic tests.

## Gate 4 — NIL

- semantic commands;
- modality independence;
- replay.

## Gate 5 — Discovery

- DiscoveryEpisode;
- hypothesis lifecycle;
- evidence linkage;
- validation.

## Gate 6 — Human refinement

- realtime weight editing;
- pairwise preference;
- judgement provenance.

## Gate 7 — Learning infrastructure

- judgement store;
- curation;
- training/holdout separation;
- model registry.

## Gate 8 — Learned Moneta

- transparent ranking/contextual model;
- validation against bootstrap heuristics.

## Gate 9 — Compositional Moneta

- representation search;
- multiscale composition;
- hybrid representations.

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

Do not jump directly to a neural Moneta. The immediate bottleneck is evidence, representation and interaction architecture.

---

# 19. Evaluation

The primary outcome is **meaningful discovery**. A useful discovery is assessed for novelty relative to stated prior understanding, relevance to the research question, analytical support, articulability, reproducibility/defensibility and independent or subsequent validation where feasible.

Secondary outcomes include time to discovery, useful hypotheses, false discoveries, verification rate, representation switches, interaction cost, cognitive load, confidence calibration and retention.

Interaction telemetry is evidence, not ground truth. Novelty is not truth. A pattern becomes a finding only through investigation and validation.

---

# 20. Non-negotiable boundaries

- Do not train from raw production logs; create curated, versioned judgement datasets.
- Do not treat Moneta recommendations as ground truth.
- Do not equate interaction with usefulness.
- Do not make learned preferences permanent rules; they are priors.
- Do not let adaptive systems silently change research conditions.
- Do not allow the Representation Ontology to collapse into a permanent static enum.
- Do not let NIL become device-specific event handlers.
- Do not put representation reasoning into Rust; Rust establishes analytical evidence.
- Do not let Moneta become a black box.
- Do not preserve Draco as a competing authority.
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
Investigation         preserves research meaning
Discovery             captures meaningful understanding
Judgement             captures what researchers teach the system
Fitness Learning      converts evidence into improved priors
Model Registry        preserves reproducibility
Research Harness      makes adaptive layers experimentally controllable
```

The system can then evolve without changing its fundamental architecture.

---

# 22. Final product vision

Nemosyne is not fundamentally a VR visualisation system, visualisation recommender, analytics package, gesture interface, neural network or chart generator.

It is:

> **A research instrument that connects trustworthy analytical computation, compositional representation, embodied interaction, human judgement and scientific evidence into a progressively improving system for discovering meaningful structure in datasets.**

The governing principle is:

> **Nemosyne must not encode a fixed theory of what constitutes a useful representation. It must provide an explicit, inspectable mechanism through which analytical evidence, human judgement, interaction experience and validated discovery outcomes progressively refine that theory.**

**The destination is a reproducible system that becomes progressively better at helping researchers discover things that matter.**

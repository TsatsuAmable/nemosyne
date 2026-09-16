# Nemosyne — Definitive Product Vision, Principles, Architecture and Implementation Roadmap

**Revision:** V3.1 — Evidence-Governed, Human-Refined, Compositional Representation Intelligence
**Date:** 16 September 2026
**Status:** Governing product, research and architecture specification
**Supersedes:** V3 and all earlier Definitive Vision and Roadmap revisions
**Live execution authority:** [`ROADMAP.md`](ROADMAP.md)

**V3.1 consolidation:** the destination established by V3 is unchanged. This revision incorporates the epistemic-governance, evidence-admissibility, benchmark-authority and evidence-tier principles established through the Moneta evidence protocol, MonetaBench/XR experimental work and recursive adversarial research programme. It also removes stale embedded execution sequencing: this document governs what Nemosyne is becoming and the constraints on that destination; `ROADMAP.md` governs current order and completion status.

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
hard representation feasibility
  ↓
evidence admissibility / claim authority
  ↓
multi-objective fitness + inspectable alternatives
  ↓
representation hypotheses / RepresentationGraph
  ↓
researcher interaction
  ↓
DiscoveryEpisode
  ↓
analytical verification
  ↓
evidence + human judgement
  ↓
governed model learning
  ↓
new prior
```

The initial heuristics are not Nemosyne's theory of useful representation. They are the first prior. Scientific validity is not another fitness dimension: **evidence disposition constrains what utility, preference, performance or resource objectives are permitted to authorise**. Non-promotable candidates may remain visible to bounded diagnostic, falsification, explanation or human-study selection paths, but they may not be silently promoted into a chosen representation, positive learning signal or adaptive policy. No evolutionary search, learned ranker, LLM committee, human-preference model or resource governor may bypass that boundary.

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

## 4.6 Cross-cutting Epistemic Governance

Epistemic governance is **not a sixth ontology**. It governs what evidence permits Nemosyne to claim across all five ontologies.

**Question:** What evidence is admissible for this claim, what can it establish, and where must Nemosyne abstain or defer to human/domain judgement?
**Authority:** versioned evidence protocols, research/experimental harnesses and the canonical owner of the underlying scientific semantics; human or domain-expert judgement remains terminal where the claim is not mechanically adjudicable.

It governs:

- claim class and scope;
- evidence tier and provenance;
- measurement-scale and inference legality;
- benchmark/oracle strength;
- uncertainty, calibration and perturbation/stability requirements;
- whether machine evidence can only falsify or may support promotion;
- when attributable physical-device or human evidence is indispensable;
- abstention, replication and change-control requirements.

Its constitutional rule is:

> **Scientific validity is a feasibility constraint, not a soft objective.**

A candidate that violates a hard scientific or evidential constraint cannot compensate with visual appeal, preference, speed, lower resource cost or aggregate fitness.

No module may silently become a second authority for another ontology, and no evidence-producing subsystem may silently upgrade the authority of its own output.

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
                 │ Search / Composer   │
                 │ candidate generation│
                 └──────────┬──────────┘
                            ▼
                 representation candidates
                            │
                            ▼
                 ┌─────────────────────┐
                 │ Epistemic / Evidence│
                 │ Disposition         │
                 └──────────┬──────────┘
                            │
             ┌──────────────┼──────────────────┐
             │              │                  │
             ▼              ▼                  ▼
      INVALID /       REQUIRES-HUMAN        ELIGIBLE
      ABSTAIN /             │                  │
      FALSIFY-ONLY          ▼                  │
             │       bounded study            │
             │       selection + S5           │
             │              │                  │
             │       re-adjudication           │
             │              └──────────────┐   │
             ▼                             ▼   ▼
      bounded diagnostic          ┌─────────────────────┐
      ranking / explanation       │ Moneta              │
      / falsification only        │ Multi-objective     │
      (no promotion/render)       │ Fitness / Decision  │
                                  │ Explanation         │
                                  └──────────┬──────────┘
                                             ▼
                                   RepresentationGraph(s)
                                   + inspectable alternatives
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
                 claim-appropriate validation
                            │
                            ▼
                  Human Judgement Data
                            │
                            ▼
                  Governed Training Pipeline
                            │
                            ▼
                    Model Registry
                            │
                            ▼
                   New Moneta Prior
```

The two Moneta boxes are one representation authority shown at two stages of its pipeline: Moneta generates hypotheses under the Representation Ontology and later evaluates candidates subject to their evidence disposition. The evidence-disposition boundary is cross-cutting governance rather than an alternative analytical or representation authority. `INVALID` candidates are rejected. `ABSTAIN` and `MACHINE-FALSIFICATION-ONLY` candidates may retain bounded diagnostic scores, ranked near-miss explanations or falsification results, but cannot yield a chosen/rendered representation or positive promotion signal. `REQUIRES-HUMAN` candidates may enter a bounded, non-promoting study-selection path; attributable human evidence is then fed back through re-adjudication. `ELIGIBLE` candidates may enter ordinary multi-objective decision evaluation. Rust/WASM remains authoritative for analytical facts, and human/domain evidence remains authoritative for human-dependent claims.

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
| Claim/evidence admissibility | Versioned evidence protocols + Research Harness; human/domain judgement where required |
| Benchmark/oracle strength | Governed benchmark/corpus contract |
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

and, after claim-appropriate evidence admissibility, produces:

```text
EvidenceDisposition
+ RepresentationGraph / inspectable alternative set
+ InteractionPlan
+ Explanation
+ FitnessEvidence
```

The intended Full-Moneta ordering is disposition-aware:

```text
candidate generation / RepresentationGraph search
  -> hard representation feasibility
  -> evidence disposition
       INVALID -> reject
       ABSTAIN -> preserve bounded ranked near-misses / explanation; no promotion or rendering
       MACHINE-FALSIFICATION-ONLY -> falsification evidence only
       REQUIRES-HUMAN -> bounded study-candidate selection -> S5 human evidence -> re-adjudicate
       ELIGIBLE -> structure-preservation / task / resource / stability objectives
                    -> Pareto set or otherwise inspectable alternatives
                    -> representation decision
  -> claim-appropriate learning evidence
```

The gate therefore separates **promotion authority** from the ability to inspect, explain, falsify or collect missing evidence. A candidate does not need to be promotable to remain scientifically useful. Conversely, a diagnostic score, near-miss rank or study selection does not upgrade evidential authority.

Scalar ranking may be used where scientifically and operationally justified, including bounded diagnostic ranking of non-promotable candidates, but a universal scalar winner is **not** the constitutional architecture. Objectives that encode materially different concerns should remain inspectable rather than being silently collapsed merely for optimiser convenience.

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

Measurement-scale legality, compositional/simplex semantics where applicable, selection-aware calibration for post-search inferential claims, claim-appropriate high-dimensional stability evidence, benchmark-oracle authority and required human validation are **not tradeable fitness dimensions**. They sit outside the utility function as admissibility constraints.

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

Discovery outcomes are the strongest eventual learning signal, but only after their claim class and validation authority are preserved. Preference or acceptance can teach Moneta what people tend to choose; it cannot promote scientifically inadmissible candidates or convert perceptual preference into analytical truth.

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

## 14.1 Evidence authority ladder

Nemosyne distinguishes evidence by what it can establish, not merely by how much of it exists. The experimental programme currently uses this general ladder:

- **S0 — pure/unit simulation:** mathematical and semantic invariants;
- **S1 — browser/WebXR simulation:** API, lifecycle, interaction-contract and fault behaviour;
- **S2 — device-profile simulation:** declared runtime/input/device envelopes, not physical performance;
- **S3 — calibrated surrogate:** synthetic host constraints calibrated against physical observations;
- **S4 — physical device:** runtime, frame pacing, thermal, tracking and device behaviour;
- **S5 — human/device study:** usability, comfort, discoverability, perceptual meaning and other human-dependent outcomes.

A lower tier may falsify a candidate when the failure is within its authority. **It may not promote a claim whose truth requires a higher tier.** Simulation is therefore an attention-saving falsification instrument, not a replacement oracle for physical or human evidence.

Evidence dispositions are routing decisions, not a single pass/fail bit:

| Disposition | Permitted consequence |
|---|---|
| `INVALID` | Reject the evidence/candidate for the governed claim. |
| `ABSTAIN` | Preserve bounded diagnostics, ranked near-misses and remediation/explanation evidence; do not choose or render a representation as scientifically admitted. |
| `MACHINE-FALSIFICATION-ONLY` | Use machine evidence to reject pathology within the benchmark's authority; do not crown a preferred representation. |
| `REQUIRES-HUMAN` | Select bounded candidates for an attributable human/device study where appropriate, then re-adjudicate with the resulting evidence; do not promote beforehand. |
| `ELIGIBLE` | Candidate may proceed to later multi-objective evaluation; eligibility alone does not mean correct, optimal, novel or production-ready. |

## 14.2 Benchmark and oracle authority

Known-structure and benchmark corpora MUST declare what their oracle can establish. Exact-generative structure may establish preservation or destruction of planted structure. Diagnostic families may expose pathologies. Labelled/task corpora may establish bounded task correctness. Human-preference corpora may establish prior preference evidence.

No benchmark family, candidate generator or evaluator may silently promote itself into an oracle for open-ended discovery quality, perceptual legibility or the universally "best" representation. Where the claim depends on a human perceiving, understanding or discovering meaning, attributable human evidence remains required.

The persistent scientific contract for Full Moneta is [`research/MONETA_EVIDENCE_PROTOCOL.md`](research/MONETA_EVIDENCE_PROTOCOL.md). The experimental evidence tiers and calibration boundary are documented under [`research/XR_EXPERIMENTAL_ENGINE.md`](research/XR_EXPERIMENTAL_ENGINE.md) and related research contracts.

## 14.3 Adversarial cognitive machines

Independent models and research committees may search prior art, challenge framing, generate alternatives, propose falsifiers, attack evidence and identify overlooked failure modes. They are **critics and experiment generators, not authorities by consensus**.

For consequential disputes, disagreement SHOULD become a decisive test, benchmark, simulation, counterexample or bounded competing implementation where possible. Mechanically judgeable questions terminate in evidence. Questions of scientific meaning, epistemic authority or product values that cannot be mechanically resolved terminate in attributable human/project-owner or appropriate domain-expert judgement. The number or confidence of agreeing models does not create authority.

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
| Research Harness / Evidence Protocols | Freeze/vary intelligence and treatment; enforce claim class, evidence admissibility, oracle strength and tier identity | Any subsystem independently controllable; evidence remains correctly classified and no optimiser/reviewer bypasses claim-appropriate constraints |
| Persistence | Complete discovery and learning provenance | `.nemosyne` reconstructs analytical/discovery history |
| UI / Analyst Cockpit | Expose reasoning and challenge controls | Researchers can understand/challenge Moneta |
| Collaboration | Shared discovery and peer review transport | No competing state authority |
| CI / Testing | Software + methodological integrity | Detects analytical, representation, replay, provenance and boundary regressions |

A module may depend on another module's **public contract**, never its internal state. Architecture tests enforce forbidden dependencies and duplicate authority.

---

# 16. Dependency model and live execution authority

This document no longer embeds a numbered implementation schedule. The V3 gate list was useful during early authority reconciliation, but it became stale as evidence exposed prerequisites in UX, runtime efficiency, production learning, human validation and scientific admissibility.

The durable **dependency model** is:

```text
authority + analytical/provenance foundations
  -> usable semantic investigation workflow
  -> bounded, meaning-preserving runtime and evidence infrastructure
  -> claim-appropriate simulator / device / human validation
  -> governed learning evidence
  -> private-preview discovery/product learning
  -> RepresentationOntology / RepresentationGraph compositional search
  -> validated adaptive representation intelligence
```

This is a dependency graph, not a rigid calendar. Work may be refined, split, deferred or reordered when new evidence changes prerequisites, provided the constitutional boundaries in this document remain intact.

[`ROADMAP.md`](ROADMAP.md) is the sole authority for **what happens next, what is currently complete and which integration seam is active**. Programme plans may specify their own bounded evidence contracts but do not supersede the live roadmap.

---

# 17. Recursive adversarial and experimental method

Nemosyne's development method mirrors its scientific intent: consequential claims should survive active attempts to falsify them before they become authority.

The preferred loop is:

```text
vision + roadmap
  -> claim / invariant / failure modes
  -> prior-art assimilation where relevant
  -> independent challenge / materially different alternatives
  -> disagreement -> decisive test, benchmark or bounded competing implementation
  -> implementation / experiment
  -> attributable empirical evidence
  -> adversarial attack on the result
  -> promote, revise, abstain or reject
```

The purpose of adversarial committees is to improve the rate at which correct decisions and defects are discovered, not to create ceremony. Reviewer routing, latency thresholds, model allocation and merge mechanics are operational concerns owned by the roadmap and engineering policy. They are deliberately not constitutional product doctrine.

MonetaBench, known-structure campaigns and the XR Experimental Engine are likewise **falsification and evidence infrastructure, not substitute scientific authorities**. Failed candidates and rejected alternatives remain useful evidence and SHOULD be retained with provenance where they inform future search or guard against repeated mistakes.

---

# 18. Strategic frontier to Full Moneta

Do not jump directly to a neural or fully adaptive Moneta. The enduring prerequisites are more important than model complexity:

1. researchers can understand and operate the investigation workflow well enough that interface friction is not the dominant confounder;
2. analytical and representation state remains authoritative, reconstructable and provenance-bearing while spatial projections and resources remain disposable and bounded;
3. simulator, device and human evidence retains explicit tier/claim authority;
4. Moneta candidate evidence receives a governed disposition before any optimisation is allowed to authorise promotion; non-promoting diagnostic or study-selection evaluation remains possible where the disposition permits it;
5. known-structure, metamorphic and adversarial campaigns actively seek counterexamples rather than only confirming expected winners;
6. human-dependent perceptual/discovery claims remain open until attributable human evidence exists;
7. governed learning uses held-out evaluation, model/version identity and reproducible provenance;
8. compositional search preserves alternatives and cannot learn around hard evidence constraints.

The current transition from product/UX/runtime qualification into learned Moneta, private-preview learning and compositional Full Moneta is tracked only in [`ROADMAP.md`](ROADMAP.md). The definitive vision specifies what those stages must preserve, not their volatile tranche numbers.

---

# 19. Evaluation

The primary outcome is **meaningful discovery**. A useful discovery is assessed for novelty relative to stated prior understanding, relevance to the research question, analytical support, articulability, reproducibility/defensibility and independent or subsequent validation where feasible.

Secondary outcomes include time to discovery, useful hypotheses, false discoveries, verification rate, representation switches, interaction cost, cognitive load, confidence calibration and retention.

Interaction telemetry is evidence, not ground truth. Novelty is not truth. A pattern becomes a finding only through investigation and validation.

Every consequential evaluation claim SHOULD identify the population/context, claim class, evidence tier, governing metric or decision rule, provenance, uncertainty and limitations. Evidence presence is not evidence sufficiency: promotion requires the authority appropriate to the claim.

---

# 20. Non-negotiable boundaries

- Do not trade scientific validity against utility, preference, performance or resource cost; validity is a feasibility boundary.
- Do not let an evolutionary optimiser, learned ranker, LLM committee, human-preference model or resource governor bypass evidence disposition when authorising promotion, rendering, learning or adaptation; bounded diagnostic/study routing does not constitute promotion.
- Do not let lower-tier simulation promote physical-device or human claims that require higher-tier evidence.
- Do not let a benchmark, candidate generator or evaluator self-assign stronger oracle authority than its governed contract permits.
- Do not resolve scientific truth, epistemic authority or product values by model vote.
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
Epistemic Governance governs what the available evidence permits Nemosyne to claim
Representation       defines what can be expressed
Moneta                constructs representation hypotheses among admissible candidates
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

> **A research instrument that connects trustworthy analytical computation, evidence-governed compositional representation, embodied interaction, human judgement and scientific evidence into a progressively improving system for discovering meaningful structure in datasets.**

The governing principle is:

> **Nemosyne must not encode a fixed theory of what constitutes a useful representation. It must provide an explicit, inspectable mechanism through which admissible analytical evidence, human judgement, interaction experience and validated discovery outcomes progressively refine that theory, while preserving hard scientific constraints that learning is not permitted to optimise away.**

**The destination is a reproducible system that becomes progressively better at helping researchers discover things that matter.**

---

# Appendix A. Governing user experience and semantic-efficiency doctrine

**Incorporated:** 6 September 2026  
**Detailed normative companion:** [`NEMOSYNE_USER_EXPERIENCE_DESIGN_DOCTRINE.md`](NEMOSYNE_USER_EXPERIENCE_DESIGN_DOCTRINE.md)

Nemosyne is a research instrument, not a game, movie or virtual showroom. Its user experience must optimise for **investigable meaning rather than visual abundance**.

The governing UX question is:

> **What is the cheapest perceptually effective representation that preserves the information the researcher needs to understand, challenge and investigate the data?**

These product-level requirements remain governing under the V3.1 vision.

## A.1 Semantic fidelity precedes scene fidelity

A representation is not better because it renders more rows, objects or polygons. It is better when it preserves the analytical structure, uncertainty, provenance, important exceptions and relevant alternatives needed for the investigation while minimising unnecessary perceptual and computational cost.

The required priority order is:

1. semantic fidelity;
2. perceptual legibility;
3. natural and predictable interaction;
4. responsive, comfortable frame pacing;
5. computational and memory economy;
6. visual richness only where it improves understanding, orientation or confidence.

Decorative fidelity MUST NOT consume resources needed for the first five goals.

## A.2 Dataset scale MUST be decoupled from live scene scale

The full authoritative dataset may remain resident or addressable through Atlas and Rust/WASM without becoming an equivalent population of live scene objects.

The target architecture is:

```text
authoritative dataset
  -> analytical hierarchy
  -> representation hierarchy
  -> intent-dependent perceptual working set
  -> small interactive scene projection
```

Millions of rows may legitimately become thousands of analytical aggregates, hundreds of visible semantic structures, tens of high-detail structures and only a few actively manipulated objects, provided the abstraction preserves the information required for the current investigation.

## A.3 Semantic level of detail is a first-class representation primitive

Nemosyne MUST support progressive semantic resolution, not merely graphical polygon LOD. A structure may move between population, subpopulation, distribution, group and individual-observation levels according to researcher intent, focus, uncertainty, anomaly importance, comparison context, investigation history and available resource headroom.

The researcher must be able to expand detail and collapse back to a cheaper abstraction without losing investigation meaning or provenance.

## A.4 Full Moneta should optimise information preservation under perceptual and resource budgets

Moneta's long-term role is broader than selecting a named layout. It should evolve toward an adaptive semantic compression and embodiment engine that determines:

- what structure must remain explicit;
- what may be safely aggregated or summarised;
- what uncertainty and exceptions must survive abstraction;
- what semantic detail is sufficient for the current task;
- which representation best preserves relevant relationships;
- when to refine, collapse, stream, cache or evict detail;
- how to spend available hardware headroom without changing analytical truth.

Moneta MUST abstain or narrow scope rather than silently destroy meaning to satisfy a resource budget.

## A.5 Progressive crystallisation SHOULD replace monolithic loading

Large investigations should become useful progressively:

```text
open
  -> inspect schema and metadata
  -> establish coarse analytical summaries
  -> show a meaningful initial representation
  -> stream and refine additional evidence
  -> expose deeper detail and alternatives
```

Nemosyne SHOULD prioritise the earliest useful answer over the earliest complete answer when provisional state and provenance remain explicit.

## A.6 Spatial objects are disposable projections; semantic investigation state is durable

A Three.js object, GPU buffer, texture, label, BVH or UI surface MUST NOT be the sole owner of scientifically meaningful state.

If presentation resources are evicted, the investigation must remain reconstructable from durable semantic state, including dataset identity, analytical evidence, Moneta decision, RepresentationGraph, abstraction level, findings, evidence, relevant alternatives and replay provenance.

This separation allows WebGL, WebGPU, future WebXR renderers or native clients to embody the same investigation without changing its scientific meaning.

## A.7 Resource use MUST remain bounded over long sessions

Nemosyne SHOULD manage presentation and analytical resources through a bounded lifecycle such as:

```text
ACTIVE -> WARM -> COLD -> EVICTED
```

Cleanup must be incremental where possible. Pools and caches must remain bounded. Steady-state XR paths should minimise avoidable allocations before relying on garbage collection or disposal.

Long-session quality is a product property. Frame-time tails, dropped frames, JS heap, Worker/WASM capacity, GPU resources, scene-object counts, cache growth and interaction latency should remain stable over time.

## A.8 Hardware headroom expands capability, not baseline usability

Quest 3S-class standalone hardware is an efficiency crucible, not the definition of Nemosyne's maximum scale.

The weakest supported hardware should receive the same core semantic and interaction-quality contract. Stronger hardware should turn surplus capacity into a larger resident working set, deeper semantic detail, more comparisons, faster refinement, more prefetched alternatives and longer stable sessions.

Higher-end hardware MUST NOT be required merely to recover responsiveness lost to avoidable baseline inefficiency.

## A.9 Rendering technology is subordinate to measured UX

Nemosyne SHOULD use batching, instancing, culling, foveation, multiview, bounded label density and GPU-side presentation work when they measurably improve the target experience.

WebGL/WebXR remains valid while it provides the best supported measured result. WebGPU should be adopted where real-device evidence demonstrates better frame stability, resource use, memory behaviour, compute-assisted presentation or scale.

The analytical authority boundary remains:

> **Rust/WASM decides what the data means. GPU computation may accelerate how that meaning becomes visible.**

## A.10 Experience invariants govern optimisation

Across hardware classes and dataset sizes Nemosyne MUST protect:

1. trustworthy meaning;
2. natural and predictable interaction;
3. perceptually immediate acknowledgement of user intent;
4. stable session quality over time.

When resource pressure rises, Nemosyne should first reduce background work, speculative prefetch, distant update frequency, redundant semantic detail and cold resident resources. It should protect interaction fidelity, frame pacing, semantic truth and perceptual legibility before decorative richness.

The implementation test for future world-building and performance work is:

> **Does this change make Nemosyne better at retaining and exposing meaning, or does it merely make the virtual world more elaborate?**

If the answer is primarily the latter, it should not receive the resource budget.

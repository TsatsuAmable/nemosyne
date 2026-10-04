# Full Moneta Architecture — Human-Grounded Semantic Embodiment

**Proposed scope reduction:** [RFC 0012](../rfcs/0012-minimum-nemosyne-architecture.md) recommends four
product subsystems and explicit removal, consolidation and externalization of planned mechanisms.
Its scope decisions are proposed for owner review; existing accepted contracts remain governing.
The capabilities below are a target catalogue, not a requirement to build every listed service,
runtime, model or abstraction. RFC 0012 supplies the proposed minimum delivery and conditional gates.

**Status:** canonical Full-Moneta target architecture / implementation map  
**Date:** 3 October 2026  
**Governing vision:** [`Nemosyne_Definitive_Vision_and_Roadmap.md`](../Nemosyne_Definitive_Vision_and_Roadmap.md)  
**Live execution authority:** [`ROADMAP.md`](../ROADMAP.md)  
**Current technical reference:** [`ARCHITECTURE.md`](../ARCHITECTURE.md)  
**Scientific admissibility:** [`MONETA_EVIDENCE_PROTOCOL.md`](../research/MONETA_EVIDENCE_PROTOCOL.md)
**Architecture 2027 adjudication:** [`ARCHITECTURE_2027_REVIEW.md`](ARCHITECTURE_2027_REVIEW.md) — accepted integration corrections are incorporated here; the review is not a second target architecture.

This document is the **single target-architecture synthesis for Full Moneta**. It consolidates the destination previously spread across the dataset-first semantic-embodiment design, MCR authority/schema work, compositional-representation plan, System-1/System-2 design, Full-Moneta capability ladder, UX doctrine, evidence protocol, Quest/runtime work, ScriptC evaluation and the product metaphors in the interaction specifications.

Those documents remain useful as detailed rationale, historical decision records and specialist implementation plans. Where they describe the **Full-Moneta target architecture** differently from this document, this document is the integration reference. The Definitive Vision remains the higher product/research authority and `ROADMAP.md` remains the only authority for current sequencing and completion claims.

---

## 1. Problem and product thesis

Nemosyne exists to help humans extract meaningful understanding from datasets whose scale, dimensionality and machine-generated analytical output can exceed comfortable human symbolic reasoning.

The long-term pressure is an asymmetry:

~~~text
machine capacity to generate / analyse information   ↑↑↑
human deliberate attention and abstract reasoning   ~ bounded
~~~

The product therefore should not optimise for showing the most data, the most geometry or the most sophisticated model. It should optimise for **decision-relevant semantic information acquired per unit of human cognitive effort**, while keeping every consequential claim inspectable and reversible to evidence.

The Full-Moneta transformation is:

~~~text
dataset
  -> authoritative analytical evidence
  -> governed semantic world
  -> investigation perspective / intent
  -> representation hypothesis
  -> human-grounded semantic-to-perceptual compilation
  -> coordinated perceptual world
  -> inspect / manipulate / perturb / compare
  -> observation / hypothesis / validation
  -> human judgement + evidence
  -> durable representation knowledge
  -> better future proposals
~~~

This is stronger than “3D data visualisation”.

**Moneta Forma is a semantic-to-perceptual compiler.** Its purpose is to give important dataset semantics a perceptual body through spatial form, visual properties, motion, sound, interaction and, where justified, haptics or other channels.

The Datum Plane / Datasphere inspiration is therefore functional rather than decorative: Nemosyne should make machine-scale information inhabitable at human scale.

---


### 1.1 Exploratory perception is a first-class product mode

Full Moneta must support a second useful contract alongside claim-bearing reproducible analysis: **exploratory abductive perception**.

Large real datasets may be incomplete, damaged, sparsely captured or missing the very structure a researcher is trying to understand. A semantic model may nevertheless infer plausible continuations or missing relations from the constraints imposed by what remains. Full Moneta should be able to embody those possibilities without pretending they were observed.

This creates a hard architectural distinction:

~~~text
CLAIM-BEARING PATH
governed evidence
  -> pinned model/policy/context
  -> admitted representation
  -> exact replay contract
  -> validation / claim

EXPLORATORY ABDUCTIVE PATH
partial governed evidence
  + learned priors / adaptive model state
  -> one or more plausible completions
  -> explicit IMPUTED / HYPOTHESIZED / COUNTERFACTUAL semantics
  -> perceptual embodiment
  -> materialised Memory Palace snapshot
  -> later comparison / challenge / possible validation
~~~

The exploratory path may evolve between T1 and T2. A different later representation is not automatically a defect. The invariant is that P1 is not silently rewritten by P2 and that neither can hide which parts were observed, derived or conjectural.

#### Consequences for Memory Palace

Memory Palace is not only a command-log/replay projection. It must be capable of preserving a **materialised perceptual-epistemic artefact**. The minimum durable content is the representation/semantic structure actually experienced, epistemic typing, uncertainty, investigation/perspective/branch context, annotations, salient spatial/view organisation, alternatives and generator provenance when available.

This yields two independent capabilities:

- **generation reproducibility**: recreate the result by rerunning the same governed generator;
- **representation persistence**: faithfully revisit the captured result even if the generator later changes or no longer exists.

Scientific/research paths normally require generation reproducibility. Exploratory discovery may proceed with representation persistence alone, provided the output remains clearly non-authoritative until independently validated.

#### Consequences for learning and System-1/System-2

The architecture must no longer assume that all adaptive model change is forbidden merely because exact rerun would change. Online or continual adaptation can be investigated for the exploratory lane if:

1. it cannot modify authoritative Rust/WASM evidence;
2. claim-bearing and Research Mode paths remain freezeable/pinnable;
3. every generated completion is epistemically typed and provenance-bearing;
4. the resulting scene is materialised into Memory Palace when retained;
5. later model states create new palace states rather than rewriting old ones;
6. promotion into scientific evidence still passes the normal evidence protocol.

This is an architectural permission to experiment, not a mandate to introduce uncontrolled online learning.

## 2. Constitutional invariants

These rules constrain every implementation tranche.

1. **Rust/WASM is the sole analytical authority.** No perceptual, learned, TypeScript or LLM subsystem may invent analytical facts.
2. **Scientific validity is a feasibility constraint.** Evidence admission happens before preference, beauty, speed, resource cost or learned utility may promote a representation.
3. **Semantic truth and human meaning are distinct authorities.** Machines may establish data semantics under governed analytical contracts; claims that a perceptual mapping communicates meaning to humans require attributable human/domain evidence.
4. **Human feedback cannot override analytical truth.** A user may reject or replace an embodiment, perspective or metaphor; they may not make an unsupported analytical claim true by preference.
5. **Perspective is not truth.** Different perspectives may foreground different supported semantics over the same dataset while preserving one analytical substrate.
6. **Representation richness may change; semantic obligation may not.** The “stickman ↔ Mona Lisa” continuum may add detail and sensory richness, but every admitted resolution must preserve its declared core meaning.
7. **Every data-bearing perceptual degree of freedom has a typed semantic binding.** If size, distance, colour, motion, pitch, resistance or another property carries data, its meaning is explicit.
8. **Explainability is structural, not prose decoration.** Every embodied property must reverse-resolve to its perceptual binding, representation primitive, semantic source, evidence and version.
9. **The deterministic compiler remains the admission boundary.** Learned models and LLMs may retrieve, rank, propose or synthesize candidates; they do not directly author an admitted runtime plan.
10. **System-1 is advisory intuition, not the metaphor compiler authority.**
11. **System-2 may reason and synthesize, but still submits candidates to explicit Forma admission.**
12. **A world model is not a prerequisite.** Introduce one only if later bounded search/synthesis experiments show a concrete advantage that simpler rules, cases and models cannot provide.
13. **Human meaning evidence is scoped.** A mapping may be useful for a task, domain, population or investigator without becoming a universal law of perception.
14. **Telemetry is not meaning.** Clicks, dwell time and reuse may inform preference/search cost; they do not establish that the intended semantics were understood.
15. **Device adaptation may reduce richness, never silently change the scientific story.**
16. **Missing criteria produce ABSTAIN, simplification or an inspectable alternative, not fabricated certainty.**
17. **Dataset is the semantic subject, not a renderer primitive.** A dataset body must contain evidence-bearing structure or an explicit unavailable/refused state; a shell, label or row layout does not qualify.
18. **Overview cost is bounded by semantic working-set complexity, not source row count.** Observation marks require explicit observation intent or bounded refinement.
19. **Every representation remains inspectable and teachable.** Reverse explanation, typed critique and alternative instantiation are required interfaces, not optional UI decoration.
20. **Search and evolution optimize only inside admitted meaning.** Dataset identity, analytical facts, evidence, epistemic status and fixed obligations are not genes or tradeable objectives.

---

## 3. Authority model

Full Moneta preserves the five ontologies in the Definitive Vision. The new architecture refines their interfaces rather than inventing a competing ontology.

| Concern | Canonical authority | Full-Moneta role |
| --- | --- | --- |
| Analytical facts | Rust/WASM + governed evidence | Establish what can legitimately be said about the dataset. |
| Representation | Moneta / RepresentationGraph | Decide which supported semantic phenomena should be exposed and coordinated. |
| Perceptual embodiment | Moneta Forma under Representation authority | Compile admitted representation semantics into perceptual channels without changing their meaning. |
| Interaction | NIL + Investigation/Atlas | Convert input modalities into attributable semantic operations. |
| Discovery | Investigation / Evidence | Record what the researcher noticed, tested and established. |
| Learning | Judgement / model registry / Forma knowledge | Retain scoped knowledge about useful representation and improve proposal priors. |
| Human perceptual meaning | Attributable humans / domain experts / controlled studies | Establish whether an embodiment communicates the intended semantics for its declared scope. |
| Runtime | Spatial/desktop/XR runtime | Execute plans; never infer analytical or semantic meaning. |

The **Forma Knowledge Base** introduced below is durable representation knowledge, not an analytical authority. Its entries carry provenance, scope and evidence basis and are always downstream of the evidence gate.

### 3.1 Dataset subject, semantic body and working set

The detailed dataset-first ADAPT design is
[`MONETA_DATASET_FIRST_SEMANTIC_EMBODIMENT.md`](MONETA_DATASET_FIRST_SEMANTIC_EMBODIMENT.md).
It clarifies three terms that the rest of this architecture relies on:

- the **Dataset subject** is stable identity projected from the canonical dataset fingerprint;
- the **semantic body** is a composition of governed semantic structures beneath that subject;
- the **semantic working set** is the bounded subset admitted for the current purpose, intent, perspective and device/perceptual budget.

Representation primitives are techniques applied to the Dataset subject; they do not include a
universal `DATASET` shape. Perceptual geometry is a phenotype. The same subject may therefore support
multiple grounded perspectives and exploratory conjectural alternatives without changing analytical
identity. Multi-dataset comparison composes independently admitted subjects/plans and must preserve each
dataset's fingerprint, evidence, selection, refinement and replay identity.

This separation is also the primary architectural response to QCA0. Renderer-level triangle, batching,
culling and allocation improvements remain useful, but the default overview must first stop scaling its
live representation with source N. Physical Quest and attributable human evidence remain required before
performance or comprehension claims close.

---

## 4. Target architecture

~~~text
                           DATASET
                              |
                              v
                     Rust / WASM kernel
                  analytical truth + evidence
                              |
                              v
                 DatasetEvidence / receipts
                              |
                              v
               SemanticGraphNormalizer
                              |
                              v
              SemanticEmbodimentGraphV1
                 "what is supported"
                              |
                 +------------+------------+
                 |                         |
                 v                         v
         InvestigationIntent       InvestigationPerspective
                 |                         |
                 +------------+------------+
                              |
                              v
                    RepresentationGraph
               "what meaning to foreground"
                              |
              +---------------+----------------+
              |                                |
              v                                v
       Forma Knowledge Base             System-2 reasoning
  rules/templates/cases/failures      analogy / synthesis / search
              |                                |
              +---------------+----------------+
                              |
                              v
                    System-1 proposal
              fast retrieval / ranking
                    (advisory only)
                              |
                              v
                    MONETA FORMA
          deterministic admission + compilation
                              |
          +-------------------+-------------------+
          |                   |                   |
          v                   v                   v
  PerceptualBinding[]    BehaviourPlan      InteractionPlan
          |                   |                   |
          +-------------------+-------------------+
                              |
                              v
               PerceptualEmbodimentPlan
            /          |          |          \
           v           v          v           v
        Spatial      Visual     Audio       Haptic
         plan         plan       plan         plan
            \          |          |          /
             +----------+----------+---------+
                              |
                              v
                   desktop / WebXR runtime
                              |
                              v
                         RESEARCHER
            inspect / manipulate / perturb / compare
                              |
                    +---------+---------+
                    |                   |
                    v                   v
            Forma explanation      observation /
             + critique UI          investigation
                    |                   |
                    v                   v
            EmbodimentCritique   HumanMeaningJudgment
                    |                   |
                    +---------+---------+
                              |
                              v
                  study / evidence routing
                              |
                              v
                    governed retention
                              |
                              v
                   Forma Knowledge Base
                              |
                     proposal learning
                              |
                              +----> next investigation
~~~

`RepresentationGenome` and evolutionary/search machinery enter only after these contracts are stable. Search generates ordinary candidate graphs/bindings/templates and remains downstream of the same evidence/admission machinery.

---

## 5. Current implementation: keep, clarify, or retire as target abstraction

### 5.1 Keep

| Existing structure | Current role | Full-Moneta disposition |
| --- | --- | --- |
| `DatasetEvidence` + governed receipts | Evidence-bearing analytical facts | **Keep.** Upstream truth substrate. |
| `SemanticEmbodimentGraphV1` | Dataset-level semantic nodes, abstraction/refinement, preservation/loss and evidence refs | **Keep, clarify.** This is the semantic-world graph despite its name. |
| `RepresentationGraph` | Compositional representation hypothesis | **Keep, evolve.** Correct authority boundary for what meanings coexist. |
| `SpatialEmbodimentPlanV1` | Spatial presentation phenotype | **Keep as first backend.** It is not the terminal embodiment ontology. |
| `ComposedRepresentationValidation` | Cross-contract legality | **Keep and broaden** into Forma admission. |
| semantic detail / `SemanticDetailTransition` | Dataset -> structure -> bounded observations | **Keep.** Reuse stable identity and refinement. |
| `SensitivityAnalysis` / `StabilityCertificate` | Perturbation/stability evidence | **Keep.** Feed semantic deltas; never become animation authority. |
| `PerceptualFitnessSampler` | Viewpoint/geometry spatial fitness | **Keep, narrow claim.** It is not generic human-perceptual evidence. |
| NIL / `InteractionIntent` | Modality-independent semantic command boundary | **Keep.** All embodied interaction resolves here. |
| `LearnedMonetaRuntime` + model registry | Bounded learned ranking | **Keep as proposal infrastructure.** Never bypass System-2/Forma admission. |
| Investigation / Memory Palace projection | Reasoning/history | **Keep and extend** with perspective, embodiment, critique and learning lineage. |
| TechnoCore | Explanation/challenge surface | **Keep and converge** on Forma explanation/critique. |
| Road Not Taken | Alternative representation reasoning | **Keep and extend** to human-proposed embodiment alternatives. |
| Farcaster | Semantic/context navigation | **Keep, redefine carefully** as a projection for branch/perspective transitions, not a truth-changing operation. |

### 5.2 Existing structures whose target meaning must be clarified

#### `SemanticEmbodimentGraphV1`

It contains semantic identity and information contracts, not perceptual embodiment.

**Rule:** do not add geometry, colour, sound, haptic or animation state here. Its optional `presentationHints` are compatibility leakage and must not become a shadow Forma API.

#### `SemanticEmbodimentPayloadV1`

This is a Rust-owned family-specific analytical envelope. Its semantic families do not perfectly align with `SemanticEmbodimentGraphV1` kinds.

**Gap:** no single normalized semantic vocabulary/adapter currently turns all governed analytical families into coherent semantic nodes/relations.

This is the purpose of **L0-SEM-NORM-A**.

#### `RepresentationGraph`

It is the correct representation authority but retains compatibility-era presentation leakage such as loose `visualEncoding` and string policies.

**Rule:** keep V1 compatibility, but future perceptual semantics move into typed Forma contracts.

#### `RepresentationDecision.DecisionEmbodiment` and fixed candidate/family enums

These remain useful compatibility projections and deterministic baselines. They are not the terminal Full-Moneta representation language.

#### `RepresentationGraphRuntimeAdapter`

Its current fail-closed one-renderable-primitive rule is correct. MCR3 replaces this only through an explicit multi-element runtime.

---

## 6. New first-class contracts

The architecture should add a small set of durable contracts rather than hide new semantics in renderer options. **Do not freeze the names below as thirteen independent persistent objects before A27-0 settles semantic snapshot identity, fixed-obligation ownership, admission/use semantics and replay/version compatibility.** Prefer subordinate immutable values inside existing owners over new registries/services.

### 6.1 `InvestigationPerspectiveV1`

A perspective describes **which supported semantics the investigator wants foregrounded**, not a new analytical truth.

Conceptually:

~~~text
InvestigationPerspectiveV1
  id
  investigationIntentRef
  foregroundSemanticKinds[]
  foregroundVariables[]
  comparisonFrame?
  temporalWindow?
  viewpointPurpose
  heldConstant[]
  provenance
~~~

Examples: temporal, causal, uncertainty, provenance, population, anomaly, comparison.

A Farcaster may embody transition between perspectives or branches, but the portal is presentation. Perspective is a versioned value embedded in **committed Investigation context**, not a separate mutable authority. A field that changes the analyzed population or requests new computation is a governed analytical derivation, not merely a view preference.

### 6.2 `SemanticObligationV1`

This encodes the stickman/Mona-Lisa invariant.

~~~text
SemanticObligationV1
  semanticSource
  class:
    MUST_PRESERVE
    PROGRESSIVE
    OPTIONAL
  taskScope
  minimumPerceptualRequirement?
  evidenceRefs[]
~~~

Moneta derives the fixed obligation set from the evidence-bound semantic snapshot plus committed investigation context under pinned policy **before candidate comparison**. Forma may satisfy or refuse those obligations; neither a candidate nor a resource broker may weaken `MUST_PRESERVE` merely to make a plan fit.

### 6.3 `PerceptualChannelSpecV1`

A registry entry describes a perceptual channel and the constraints under which it may carry semantics.

Initial channel families may include:

- spatial: position, distance, direction, containment, topology;
- visual: scale, colour, opacity, texture, shape;
- motion: velocity, periodicity, instability, flow, transition;
- audio: pitch, rhythm, timbre, spatial location, event cue;
- haptic: pulse, resistance, intensity, texture, where device evidence permits;
- interaction: selectable, movable, separable, traversable, deformable operations whose semantics are explicit.

Each channel records capability, accessibility/fallback properties, contraindications and resource cost class. Start this as a **closed, versioned compiler capability table**, not a new mutable registry/service. Mechanical channel capability is not evidence that a mapping is meaningful.

### 6.4 `PerceptualBindingV1`

A binding expresses meaning, not renderer instructions.

~~~text
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
    order / topology constraints
  fidelity
    DIRECT | DERIVED | SURROGATE | EXPERIMENTAL
  semanticObligationRef?
  limitations[]
  fallbackBindingIds[]
  explanation
  provenance
~~~

Examples:

~~~text
hierarchy         -> spatial.containment
periodicity       -> motion.orbit
periodicity       -> audio.rhythm
uncertainty       -> spatial.envelope
causal direction  -> motion.flow
provenance        -> traversable.path
anomaly intensity -> visual.heat
~~~

The compiler may admit multiple candidate bindings for the same semantic property. Human evidence determines which communicate meaning well in a declared scope.

### 6.5 `BehaviourRuleV1` / `BehaviourPlanV1`

Dynamic semantics are distinct from geometry.

Initial deterministic primitives should stay small: `FLOW`, `OSCILLATE`, `PULSE`, `ATTRACT`, `REPEL`, `DIFFUSE`, `DECAY`, `TRANSITION` and `STABILISE`.

A behaviour rule binds an upstream semantic state/delta to a declared dynamic property. Decorative animation must be explicitly non-analytical.

### 6.6 `SemanticResolutionProfileV1`

A representation/metaphor can have several richness levels while preserving its obligations.

~~~text
SemanticResolutionProfileV1
  metaphor / representation identity
  obligations[]
  variants[]
    R0 sparse
    R1 ordinary
    R2 rich
    R3 extended multimodal
  informationAddedByVariant[]
  informationOmittedByVariant[]
  resourceEnvelope
~~~

An admitted lower-resolution variant must preserve every `MUST_PRESERVE` obligation in a perceptually recoverable form. Higher resolution may add supported semantics; it must not contradict the lower level.

### 6.7 `PerceptualEmbodimentPlanV1`

This is Forma's terminal compilation product.

~~~text
PerceptualEmbodimentPlanV1
  plan identity
  dataset / investigation / perspective
  representationGraphRef
  semanticObligations[]
  bindings[]
  spatialPlan?
  visualPlan?
  audioPlan?
  hapticPlan?
  behaviourPlan?
  interactionPlan?
  explanationIndex
  resolutionProfile
  resourceBudget
  accessibility / fallback policy
  provenance
~~~

`SpatialEmbodimentPlanV1` remains the first qualified backend and can be nested/referenced rather than replaced immediately. The durable admission result must pin the semantic snapshot, committed context, representation proposal/decision, fixed obligations, knowledge manifest, compiler/transform versions, evidence requirement profiles and permitted execution purpose; a parsed plan is not an approval token.

---

## 7. The human-grounded metaphor knowledge layer

The most important addition beyond the previous architecture is that **Forma must be capable before it is knowledgeable**.

The compiler can be built deterministically. Knowledge of what metaphors actually communicate to humans must grow through prior art, domain convention, explicit human critique and controlled evidence.

That knowledge must not live only inside model weights.

### 7.1 `FormaKnowledgeBaseV1` as a pinned knowledge view

Use one versioned, queryable **knowledge view/manifest**, but keep distinct record authorities and write permissions. The manifest may index rules, templates, cases, contraindications, human judgments and study results; it must not become a mutable source-of-truth copy of those authorities. A local manifest plus typed indexes is sufficient initially.

~~~text
FormaKnowledgeBaseV1
  mappingRules[]
  metaphorTemplates[]
  metaphorCases[]
  contraindications[]
  humanJudgments[]
  studyResults[]
  source / version / promotion history
~~~

Every entry has:

- semantic/task/domain scope;
- evidence basis;
- provenance;
- limitations;
- qualification attached to a versioned **claim + scope + use**, with explicit supersession/retraction lineage;
- no uncalibrated universal “confidence” scalar and no template-wide status that silently strengthens weaker evidence.

Possible evidence bases include `PRIOR_ART`, `DOMAIN_CONVENTION`, `HUMAN_JUDGMENT`, `CONTROLLED_STUDY` and `LEARNED_PRIOR`. Original human judgments and study results remain in their existing custody; cases and the knowledge manifest reference them. A learned prior never promotes itself.

### 7.2 `MetaphorTemplateV1`

A metaphor template is a reusable compositional recipe over typed bindings, not a bespoke renderer.

Candidate families include:

- terrain / landscape;
- river / flow system;
- mechanism / machine;
- swarm / ecosystem;
- constellation;
- city / architecture;
- memory palace;
- datumplane / datasphere;
- embodied traversal / agent path.

Each declares semantic preconditions, supported binding families, forbidden implications, interaction affordances, resolution variants, accessibility fallbacks and evaluation history.

A template name has no scientific authority. It is shorthand for a set of inspectable mappings.

### 7.3 `MetaphorCaseV1`

Cases are the durable memory through which human expertise accumulates.

~~~text
MetaphorCaseV1
  semanticSituation
    dataset / semantic family
    measurement / topology properties
    investigation intent
    perspective
    domain
  embodiment
    templateRef
    perceptualBindings[]
    interactionBindings[]
    resolutionProfile
  semanticObligations[]
  humanContext
    population / expertise / accessibility scope
  evidenceBasis[]
  critiques[]
  judgments[]
  rejectedAlternatives[]
  contraindications[]
  outcome
  provenance
~~~

Successful and failed cases are equally valuable. A failure such as “vibration was interpreted as temporal change rather than uncertainty” becomes a reusable contraindication rather than disappearing.

### 7.4 `EmbodimentCritiqueV1`

This records a human proposal to modify a specific mapping or composition.

Example:

~~~text
targetBinding: anomaly_strength -> audio.pitch
proposal:      anomaly_strength -> visual.heat
reason:        "I need spatial comparison across regions"
scope:         this task / this dataset family
author:        attributable human
status:        proposed / instantiated / rejected / retained
~~~

Natural-language input may be parsed by an LLM into this structure, but the parsed structure is not the human judgment until the human confirms it.

### 7.5 `HumanMeaningJudgmentV1`

This records whether the human actually recovered the intended meaning.

It should distinguish:

- intended semantic meaning;
- perceived meaning;
- task/comprehension outcome;
- mapping preference;
- misleading implication;
- accessibility/comfort issue;
- scope/population/domain;
- representation + binding + version identity.

A preference (“I like B”) and a meaning judgment (“I understood B as uncertainty”) are not the same evidence.

---

## 8. Human feedback is part of the architecture, not an end-stage study

The core loop is:

~~~text
Forma compiles an embodiment
        |
        v
human experiences it
        |
        v
TechnoCore / explanation:
"this motion encodes instability"
        |
        v
human critiques:
"use a heat overlay instead"
        |
        v
EmbodimentCritiqueV1
        |
        v
Road Not Taken instantiates alternative
        |
        v
compare / perturb / use
        |
        v
HumanMeaningJudgmentV1
        |
        v
claim-appropriate study/evidence routing
        |
        v
retain / reject / narrow scope
        |
        v
MetaphorCaseV1 / knowledge-base update
~~~

This unifies product concepts that previously looked separate:

- **TechnoCore** explains bindings, evidence, alternatives and limitations and becomes the natural critique entry point.
- **Road Not Taken** materializes human- or machine-proposed alternative embodiments rather than silently replacing the current world.
- **Farcaster** transitions between perspectives/branches while preserving dataset identity.
- **Memory Palace** retains the reasoning, critique, branch, outcome and eventual learning lineage.
- **Challenge** drives perturbation/falsification of both analytical claims and representation assumptions.
- **Evidence Vault** freezes representation, model, ontology, perspective and feedback state for replay.

Human feedback should be capturable as soon as FM3 representations exist, even though **adaptive learning from it does not begin until FM6 governance is ready**.

---

## 9. Metaphor generation: rules, System-1, System-2 and world models

### 9.1 Deterministic rules are the foundation

Forma's admission/compiler path should initially be deterministic and inspectable.

Rules are appropriate for:

- measurement-scale legality;
- order/topology preservation;
- semantic obligations;
- evidence/provenance requirements;
- channel compatibility;
- accessibility fallback requirements;
- known contraindications;
- resource bounds;
- “no semantic source, no data-bearing perceptual property”.

Rules tell Forma what it **may** do. They do not by themselves tell us what humans will find meaningful.

### 9.2 System-1 is fast retrieval and proposal

System-1 should not be the metaphor compiler. Its job is skilled intuition:

> Given this semantic situation, perspective and budget, which known templates/cases/bindings are worth trying first?

~~~text
semantic signature
+ InvestigationIntent
+ InvestigationPerspective
+ semantic obligations
+ domain / human context
+ channel availability
+ device budget
+ Forma Knowledge Base features
    -> FormaProposalSetV1
~~~

`FormaProposalSetV1` may contain:

- case IDs;
- template IDs;
- binding IDs;
- resolution-variant IDs;
- candidate ordering;
- search hints;
- `ABSTAIN`.

Start with deterministic nearest-case/rule retrieval and the existing transparent linear ranker. A tiny ONNX model is justified only if it measurably reduces proposal/search cost or improves useful candidate coverage.

System-1 never emits arbitrary renderer parameters, scientific claims or an admitted `PerceptualEmbodimentPlan`.

### 9.3 System-2 is reasoning and novel synthesis

When the knowledge base has no adequate case, System-2 may construct explicit analogies and candidate metaphors.

Its output is still structured:

~~~text
target semantic structure
  -> proposed source-domain metaphor
  -> explicit relation-by-relation mapping
  -> predicted benefits / risks
  -> candidate bindings / template
  -> Forma admission
~~~

An LLM can be useful here because analogy and human-cultural metaphor knowledge are broad and language-rich. It remains a **candidate synthesizer**, not the authority on meaning.

Human review and subsequent evidence decide whether the synthesis becomes durable knowledge.

### 9.4 World model: defer

A general world model is not required to build useful Forma.

Consider one only in FM7+ if experiments show that richer dynamic metaphor search needs predictive environmental/affordance simulation that:

- bounded rules + case memory + System-2 synthesis cannot provide;
- can remain provenance-bearing;
- improves human outcomes measurably;
- does not create an opaque semantic authority.

Until then, a world model would add opacity and training cost before we know the task that needs it.

### 9.5 Long-term learning architecture

The durable asset is therefore the **Forma Knowledge Base**, not any particular model.

Models can be retrained, replaced or removed while human-grounded cases, failures, scopes and evidence remain.

~~~text
human/domain knowledge
      -> durable cases + rules + evidence
      -> deterministic retrieval baseline
      -> optional System-1 distillation
      -> System-2 synthesis when needed
      -> human evaluation
      -> better durable knowledge
~~~

---

## 10. Perspectives and Farcasters

The same governed semantic world may support multiple useful perspectives.

~~~text
same SemanticEmbodimentGraph
       |
       +-> temporal perspective
       +-> uncertainty perspective
       +-> causal perspective
       +-> population perspective
       +-> provenance perspective
       +-> anomaly perspective
~~~

A perspective selects and foregrounds supported semantics. It does not change the evidence.

A representation then embodies that perspective. Two representations may differ because they foreground different questions, not because one has changed the dataset.

Farcaster therefore should evolve toward an **embodied transition between semantically named contexts**:

- perspective A -> perspective B;
- current branch -> alternative branch;
- overview -> semantic-resolution detail;
- current investigation -> saved/related investigation;
- local frame -> collaborator frame.

The destination and semantic consequence must be visible before traversal. Ordinary analytical operations remain NIL commands, not portal side effects.

---

## 11. Stickman ↔ Mona Lisa: semantic resolution

Full Moneta requires semantic level of detail, not merely polygon LOD.

The invariant is:

~~~text
core semantic obligations(R0)
  must survive in R1
  must survive in R2
  must survive in R3
~~~

Higher resolution may reveal additional supported structure. Lower resolution may aggregate or omit progressive/optional detail. No level may silently invert, erase or fabricate a `MUST_PRESERVE` semantic obligation.

Example:

~~~text
MUST_PRESERVE
  two principal groups
  group B is less stable
  one anomaly region exists

PROGRESSIVE
  within-group substructure
  uncertainty envelope
  provenance trails
  individual observations

OPTIONAL
  non-data decorative detail
~~~

The human criterion is not merely information-theoretic equivalence. If the low-resolution embodiment technically contains the semantics but users systematically fail to perceive the intended meaning, the resolution has failed its human meaning claim.

This is where FM4 resource adaptation and L6 human validation meet.

---

## 12. Moneta Forma compiler pipeline

Forma should be implemented as explicit, testable stages.

1. **Normalize semantics** — governed payloads -> canonical semantic graph vocabulary.
2. **Bind investigation context** — intent + perspective + researcher/domain context.
3. **Derive semantic obligations** — determine what must survive for the current task.
4. **Construct/validate RepresentationGraph** — select the supported semantic phenomena to expose.
5. **Retrieve knowledge** — deterministic rules/templates/cases from the Forma Knowledge Base.
6. **Propose candidates** — System-1 ranking and, when necessary, System-2 synthesis.
7. **Admit perceptual bindings** — reject mappings violating evidence, measurement/topology, known contraindications, accessibility or resource constraints.
8. **Choose semantic resolution** — preserve obligations under the current perceptual/device budget.
9. **Compose channels** — avoid contradiction, masking, overload and unnecessary duplication.
10. **Compile backend plans** — spatial first; audio/haptic/behaviour only as qualified.
11. **Attach explanation/provenance** — every embodied property becomes reverse-queryable.
12. **Execute** — runtime performs the plan without semantic inference.
13. **Perturb / compare / critique** — changes produce explicit branches/deltas, not silent mutation.
14. **Capture human meaning evidence** — critique/judgment remains scoped and attributable.
15. **Retain cautiously** — qualified cases/rules improve future retrieval/proposal.

At every stage, `ABSTAIN` or a simpler representation is a valid result.

---

## 13. Perturbation as sensory interrogation

Perturbation remains analytically upstream.

~~~text
PerturbationRun
  -> evidence-bound semantic delta
  -> affected semantic obligations / bindings
  -> perceptual transition plan
  -> human-visible response
~~~

The user may therefore see, hear or manipulate what moves, breaks, remains stable or changes character when assumptions or data change.

Animation is never evidence by itself. It is a presentation of an upstream semantic delta.

The explanation path must answer:

> Why did this object move/change/sound different?

with the exact perturbation, semantic delta, binding and evidence chain.

---

## 14. Multimodal backends

### Spatial/visual

First production backend. Reuse `SpatialEmbodimentPlanV1` and existing UXR resource/lifecycle machinery.

### Audio

The archived spatial-audio prototype is not a foundation. New semantic sonification begins only through typed Forma bindings with mapping provenance, listener-frame authority, accessibility policy and human evaluation.

### Haptics

Interaction feedback may remain operational. Data-bearing haptics require a separate semantic binding and physical-device qualification.

### Voice

Voice is primarily an input modality through NIL and an explanation/conversation surface. It does not become a second semantic authority.

### Behaviour/motion

Motion may carry semantics only through declared behaviour rules. Decorative animation stays distinguishable from analytical meaning.

---

## 15. System-1 architecture revision

The existing System-1/System-2 split survives.

### System-1 perception

~~~text
hand / gaze / object / runtime features
  -> bounded InteractionCueSet
  -> deterministic resolver
  -> InteractionIntent
  -> NIL
~~~

Prioritize direct manipulation and object/context cues. The archived heuristic multimodal engine and gesture recognizer remain archived.

### System-1 Forma proposal

~~~text
governed semantic + intent + perspective + case/template features
  -> bounded FormaProposalSetV1
  -> System-2 / Forma admission
~~~

FM5 training may distil from deterministic Forma/System-2 outcomes. FM6 may add governed human outcome evidence.

Do not add separate neural models merely because another subproblem can be phrased as classification. Start with deterministic baselines and demonstrate a measurable prediction problem first.

---

## 16. Runtime, Quest and ScriptC

### Quest/runtime

The runtime gets a semantic/perceptual budget:

~~~text
device capability + current load
  -> resource / perceptual budget
  -> resolution variant + channel simplification
  -> same semantic obligations, lower or higher richness
~~~

Existing MAC-Q work on instancing, culling, transfer, workers, adaptive detail and measurement remains valid under this invariant.

Physical Quest evidence is required for device-specific cadence, memory, thermal, input or comfort claims.

### ScriptC

ScriptC is a bounded **L4 Runtime & Device Efficiency** experiment.

- T0-T2 may characterize deterministic TypeScript utilities.
- T3 exists only if a real native sidecar/tool topology and measured benefit exist.
- It is not a Full-Moneta dependency.
- It does not become the WebXR renderer, analytical kernel or Forma authority.
- Browser/Quest native adoption requires a separately justified native-host architecture.

---

## 17. Product surfaces under the architecture

| Product concept | Architectural role |
| --- | --- |
| **Data World / Datasphere** | Executed PerceptualEmbodimentPlan; dataset/evidence remain protagonist. |
| **TechnoCore** | Explain, challenge and critique current semantic/perceptual decisions. |
| **Road Not Taken** | Inspect and instantiate alternative RepresentationGraph / Forma plans, including human suggestions. |
| **Memory Palace** | Durable investigation, branch, representation, critique, outcome and learning lineage. |
| **Farcaster** | Embodied navigation between declared perspectives, branches, detail contexts and saved/peer frames. |
| **Challenge** | Perturbation, counterexample and falsification workflow. |
| **Evidence / Ice Vault** | Freeze/replay exact semantic, representation, perspective, model and embodiment state. |
| **NIL** | Single semantic action language across input modalities. |
| **System-1** | Fast proposal/reflex assistance only. |
| **System-2 / Moneta** | Explicit reasoning, alternatives, analogy/search and final representation authority under evidence gates. |
| **Forma Knowledge Base** | Durable, human-grounded knowledge about representation mappings; never analytical truth. |

---

## 18. Thematic implementation lanes

The lanes are durable product/architecture themes. Machines claim concrete tranches and file surfaces; no machine owns a lane.

| Lane | Theme | Scope |
| --- | --- | --- |
| **L0 — Truth & Evidence** | Make semantic claims trustworthy | Rust/WASM evidence, admissibility, semantic normalization, replay, evidence binding. |
| **L1 — Investigation, Perspective & Alternatives** | Preserve the researcher's question and viewpoint | InvestigationIntent, `InvestigationPerspectiveV1`, Memory Palace, Road Not Taken, Challenge, Farcaster semantics, branching. |
| **L2 — Forma & Semantic Embodiment** | Compile governed meaning into perceptual form | RepresentationGraph, Forma contracts/compiler, perceptual bindings, metaphor templates/cases schema, behaviour, explanation, spatial/multimodal backends. |
| **L3 — Intuitive Interaction & Reflexes** | Reduce interaction/proposal latency without hidden authority | object-centric perception, gaze/voice cue contracts, deterministic resolvers, System-1 Forma proposal. |
| **L4 — Runtime & Device Efficiency** | Preserve meaning under constrained hardware | Quest performance, resource/perceptual budgets, workers, adaptive semantic resolution, ScriptC experiments. |
| **L5 — Human-Grounded Learning & Search** | Turn validated experience into better future proposals | Forma knowledge promotion, FM6 learning, System-1 distillation, RepresentationGenome/search, System-2 synthesis experiments, optional later world-model research. |
| **L6 — Product Validation & Integration** | Test whether humans actually recover meaning | semantic-fidelity studies, human meaning judgments, multimodal studies, device evidence, STOP reviews, FM8 integration. |

Dependency spine:

~~~text
L0 Truth/Evidence
   |
   +--> L1 Intent/Perspective/Alternatives
   |          |
   |          +--> L2 Forma/Core Embodiment
   |                    |
   |                    +--> L3 Reflexes
   |                    +--> L4 Runtime
   |                    +--> L5 Learning/Search
   |                              |
   +------------------------------+
                  |
                  v
            L6 Validation
~~~

This is not a global serialization barrier. Parallel work is permitted when prerequisites are satisfied and authority/file surfaces are disjoint.

---

## 19. Roadmap tranches

These are the implementation-sized units the live roadmap should schedule. This plan owns the ladder definitions; the live `docs/ROADMAP.md` schedules only the current slice, so a rung absent from the roadmap is unscheduled, not retired. ERA-ASTRA1 requires one authority/version decision before durable Forma schemas freeze.

### FM-DSE — dataset-first semantic embodiment programme

FM-DSE applies the landed L0-L6 foundations to the Dataset as a stable semantic subject and uses the
resulting bounded semantic working set as the primary architectural performance intervention. Its
detailed contracts, research questions, success criteria, falsifiers and verification matrix are in
[`MONETA_DATASET_FIRST_SEMANTIC_EMBODIMENT.md`](MONETA_DATASET_FIRST_SEMANTIC_EMBODIMENT.md).

Under proposed RFC 0012 its initial sequence is DSE0 -> DSE1 -> DSE2/DSE3, with DSE6
qualification beginning at DSE1. DSE4/DSE5 are conditional. The retained capability definitions are:

1. **DSE0:** removal/caller inventory, owner decision, necessary subject contract preflight and production falsifiers;
2. **DSE1:** stable subject plus grounded multi-phenomenon bounded overview and complete reverse explanation;
3. **DSE2:** reversible semantic refinement and obligation-preserving resource variants;
4. **DSE3:** dual-mode product loop, typed critique, alternatives and durable feedback lineage;
5. **DSE4:** independent multi-dataset comparison without fingerprint/evidence collision;
6. **DSE5:** System-1/System-2/search/genome integration through the same admission boundary;
7. **DSE6:** exact-head Quest and scoped human qualification.

The tranches deliberately cross-reference rather than replace the FM ladder: DSE0 inherits FM0
evidence authority; DSE1 applies FM1 and FM3 to the stable Dataset subject; DSE2 applies FM4 semantic
resolution; DSE3 joins FM1/FM2 actions to FM6-governed critique and learning evidence; DSE5 consumes
FM5 advice and FM7 synthesis; and DSE6 supplies dataset-first evidence toward the open FM3/FM4/FM8
human/device exits. The detailed design contains the per-increment FM0-FM8 gap and success map.

No downstream qualification substitutes for an earlier authority gate. In particular, FM5-FM7
mechanics do not by themselves prove dataset-body usefulness, scientific binding or physical fitness.
QCA renderer experiments remain subordinate controlled comparisons rather than the definition of the
product representation.

### A27-0 — authority/version decision

Resolve decision-independent semantic snapshot identity, fixed-obligation ownership, admission-versus-use semantics, replay/version compatibility and typed refusal taxonomy. This is a bounded documentation/RFC seam, not an implementation sprint.

**Exit:** accepted decision/RFC where required, with an explicit input tuple, version boundary, compatibility/adaptation rule and refusal table. STOP rather than silently replacing accepted Rust/WASM, evidence or NIL authority.

### L0-SEM-NORM-A — semantic snapshot normalization

Normalize authoritative family outputs into a **decision-independent semantic snapshot** while preserving family-specific typed leaves, evidence/profile identity, missing/refused/approximate state and limitations. Do not strengthen vocabulary merely to make enums align.

**Exit:** the same analytical snapshot survives two decisions/perspectives; missing, retracted or wrong-profile evidence refuses; every supported family maps explicitly and unsupported families remain unavailable rather than guessed.

### L1-PERSPECTIVE-0 — investigation perspective contract

Embed versioned perspective in committed Investigation context and define its relation to InvestigationIntent, representation decisions, replay and Farcaster projection. Distinguish foregrounding from operations that change the analyzed population or require new computation.

**Exit:** draft perspective changes do not mutate history; commit/revisit/branch restores exact context; two foregrounding perspectives can share one evidence snapshot; filtering/recomputation crosses the governed analytical path.

### L2-FORMA-0 + bounded KB0 — minimum admission/compiler contracts

After A27-0, define the smallest durable contract set needed for one static slice:

- fixed semantic obligations owned by the Moneta decision context;
- typed perceptual channels/bindings as subordinate immutable values;
- immutable admission/result and plan identity;
- exact semantic snapshot/context/proposal/evidence/knowledge/compiler pinning;
- typed refusal and execution-purpose semantics, including restricted study use;
- reverse explanation requirements;
- a pinned Forma knowledge manifest over distinct rule, judgment, study and promotion authorities;
- deterministic seed recipes/templates with scoped qualification and contraindications.

No renderer implementation, learned model, mutable knowledge service or duplicate judgment/study store.

**Exit:** untrusted decoding and unsupported mappings fail closed; candidates cannot weaken obligations or choose weaker evidence profiles; study-only eligibility cannot become production promotion; the manifest retains provenance without becoming a second authority.

### L2-FORMA-1 — first static production vertical slice

Implement one deterministic admission/compiler path from authoritative semantic snapshot + committed context + RepresentationGraph + pinned knowledge manifest to a spatial backend. Include **exact capture/replay, reverse explanation and non-adaptive critique/meaning capture in this first usable slice** rather than postponing provenance until later MCR stages.

Use deterministic reference mappings only. Persist selected proposal/result identities; replay must not rerun mutable retrieval or synthesis.

**Exit:** the same supported semantic snapshot can compile into at least two valid spatial phenotypes without changing analytical identity; evidence substitution/version drift refuses; every data-bearing property reverse-resolves to its binding/claim/evidence; a confirmed human feedback record binds the exact plan/binding/context without updating production priors.

### L2-FORMA-2 — multi-element runtime

Execute existing MCR3 through the new plan. Preserve stable identity/lifecycle per element.

### L2-FORMA-3 — optional behaviour + perturbation

Add deterministic BehaviourRule/Plan contracts and semantic-delta -> perceptual-transition plumbing **only when a demonstrated product/research question requires dynamic semantics**. Generic behaviour is not a prerequisite for explanation, replay or human feedback.

### L2-FORMA-4 — explanation + critique expansion

The minimum reverse explanation and non-adaptive feedback contract lands in L2-FORMA-1. This tranche expands the product surface and structured alternative workflow:

~~~text
perceptual property
 -> binding
 -> representation primitive
 -> semantic node
 -> evidence

human comment
 -> proposed EmbodimentCritiqueV1
 -> human confirmation
 -> alternative branch
~~~

TechnoCore is the primary product surface.

### FM6 / Forma knowledge — feedback/study expansion, still non-adaptive (formerly L2-FORMA-5)

Expand attributable critique/judgment capture, frozen treatment/exposure metadata and purpose-restricted study routing against exact plan/binding/context versions. The first vertical slice already supports minimum capture. Do **not** update production priors automatically.

### L4-RUNTIME-BUDGET — stickman/Mona-Lisa broker

Select only among **admitted, applicable plan variants** under device/perceptual budgets. Preserve fixed obligations, reject stale-context adoption and explicitly refuse when a mandatory semantic obligation has no qualified fallback. A global R0→R3 richness ladder is not itself proof of semantic preservation.

### L3-S1-FORMA — System-1 metaphor retrieval/proposal

Baseline first:

1. deterministic rule/case retrieval;
2. transparent linear ranking;
3. tiny nonlinear/ONNX candidate only if justified.

Output only `FormaProposalSetV1`.

### L6-EMBODIMENT-STUDY — human semantic-fidelity harness

Compare at minimum:

1. conventional representation;
2. arbitrary spatial/3D encoding;
3. semantically congruent embodiment;
4. interactive/multimodal embodiment.

Include deliberately misleading mappings as adversarial controls. Measure intended-vs-perceived meaning, comprehension, error detection, recall, confidence calibration, task time and transfer.

### L5-FORMA-KNOWLEDGE-1 — governed retention

At FM6, convert qualified human outcomes into scoped knowledge-base updates and proposal-learning data. Keep preference, meaning, discovery outcome and scientific validation separate.

### L5-FORMA-SYNTH-1 — System-2 metaphor synthesis

At FM7, when case retrieval cannot supply an adequate candidate, generate explicit analogical mappings and submit them to ordinary Forma admission + human evaluation.

### L5-FORMA-SEARCH — bounded search / RepresentationGenome

Search the stabilized representation/perceptual grammar. Preserve lineage and Road Not Taken alternatives. Learned heuristics may order search but never change admissibility.

### L5-WORLD-MODEL-EXPERIMENT — optional, evidence-triggered only

Do not schedule by default. Trigger only if FM7 demonstrates a specific dynamic-metaphor synthesis problem that bounded rules, cases, search and System-2 reasoning cannot solve.

---

## 20. Capability ladder to Full Moneta

| Increment | Capability |
| --- | --- |
| **FM0 — Trustworthy** | Evidence/semantic identity survive end to end; semantic vocabulary normalizes. |
| **FM1 — Question/Perspective-Aware** | Intent and perspective legitimately foreground different supported semantics. |
| **FM2 — Alternative-Aware** | Road Not Taken, branch, compare, challenge and Farcaster context changes are inspectable and replayable. |
| **FM3 — Forma Foundation** | Deterministic semantic-to-perceptual compiler, multi-element spatial embodiment, explanation, critique capture and first human-meaning evidence. |
| **FM4 — Resolution-Adaptive** | Stickman ↔ Mona Lisa semantic resolution under device/perceptual budgets without semantic drift. |
| **FM5 — Intuitive** | System-1 retrieves/ranks useful known metaphors and interaction cues cheaply, without authority. |
| **FM6 — Human-Refined** | Qualified human meaning/discovery evidence becomes scoped durable Forma knowledge and learned proposal priors. |
| **FM7 — Searching/Synthesizing** | Moneta searches the governed grammar and System-2 may synthesize novel explicit metaphors; optional world-model research only if justified. |
| **FM8 — Full Moneta** | Evidence, intent, perspective, human-grounded metaphor knowledge, adaptive resolution, proposal intelligence, search and product surfaces operate as one inspectable instrument. |

---

## 21. Machine dispatch

Current assignments are operational snapshots, not ownership.

- **Claude / Millhouse:** default L0 Truth & Evidence until active evidence closure is complete; then dependency-safe L5 or L2 work.
- **OpenCode + Jev / Millhouse:** default L1 Investigation/Perspective/Alternatives; then dependency-safe L2 slices.
- **ChatGPT / Mac:** L3/L4 experimental and preflight work: System-1 contracts/benchmarks, Quest/device budgets, ScriptC.
- **Antigravity / Mac:** L2/L6 architecture, contract/adversarial review and validation feeder work; implementation only under an explicit non-colliding lease.

Every machine tranche states lane, tranche ID, base SHA, touched paths, exclusive seams, prerequisites, exit evidence and STOP conditions.

Shared schema files, `docs/ROADMAP.md`, governance projections, evidence authority contracts and replay formats remain exclusive/serialized seams.

---

## 22. Verification strategy

### Machine-verifiable

- schema/bounds validation;
- semantic identity and evidence preservation;
- deterministic replay;
- mapping legality;
- topology/measurement-scale constraints;
- semantic-obligation preservation across resolution variants;
- backend parity;
- resource bounds;
- perturbation delta provenance;
- exact explanation reverse links;
- System-1 proposal provenance and ABSTAIN;
- no raw-row/renderer analytical fallback.

### Human-required

Machine evidence may falsify many bad embodiments, but it cannot by itself establish:

- that a metaphor communicates the intended meaning;
- that a perspective is useful;
- that a multimodal mapping improves comprehension;
- that a low-resolution embodiment preserves perceived meaning;
- that a representation improves discovery;
- comfort/accessibility claims requiring human/device evidence.

Those remain `REQUIRES-HUMAN` until attributable evidence exists.

---

## 23. Decisions made by this architecture

1. Full Moneta is a **human-grounded semantic-to-perceptual system**, not a 3D chart selector.
2. Moneta Forma is a deterministic, governed compiler/admission layer beneath representation reasoning.
3. `SpatialEmbodimentPlanV1` is retained as the first backend.
4. Human metaphor expertise is exposed through a **versioned pinned Forma knowledge view/manifest** over separately governed rules, cases, judgments, studies and promotion decisions; it is not solely model weights and not a new monolithic truth authority.
5. Rules and cases bootstrap the metaphor compiler.
6. System-1 is a fast case/template/binding proposer, not the compiler authority.
7. System-2/LLM reasoning is the appropriate place for novel analogical synthesis, still downstream of evidence and upstream of deterministic admission.
8. A general world model is deferred and evidence-triggered.
9. Explanation and structured human critique are core Forma interfaces.
10. Minimum explanation, exact plan/context replay identity and non-adaptive human feedback ship with the first usable FM3 Forma slice; adaptive learning from that feedback begins only under FM6 governance.
11. Perspective is first-class investigation context and must not be confused with truth.
12. Farcasters project perspective/branch/context transitions; they do not own semantics.
13. Stickman ↔ Mona Lisa becomes a semantic-obligation invariant over a **set of admitted applicable variants**, not a universal linear R0→R3 quality ladder; human recoverability remains an empirical claim.
14. Search/evolution operates only after the representation/perceptual grammar is stable.
15. ScriptC remains a runtime optimization experiment, never a Full-Moneta dependency.

---

## 24. Immediate build order

The shortest architecture-safe path from the current repository is:

~~~text
A27-0 authority/version decision
   |
   +--> L0-SEM-NORM-A
   |
   +--> L1-PERSPECTIVE-0
   |
   +--> L2-FORMA-0 + bounded KB0
           |
           +--> L2-FORMA-1 static production slice
           |       + explanation
           |       + exact capture/replay
           |       + non-adaptive human feedback
           |
           +--> L2-FORMA-2 / MCR3-4 multi-element runtime
                   |
                   +--> optional L2-FORMA-3 behavior/modalities
                   +--> L4-RUNTIME-BUDGET
                   +--> L3-S1-FORMA

L6 protocol/control design begins alongside L2 contracts,
then supplies human/device evidence at each applicable promotion.

L2/L6 qualified outcomes
   |
   +--> L5-FORMA-KNOWLEDGE-1 (FM6)
           |
           +--> L5-FORMA-SYNTH-1 / SEARCH (FM7)
~~~

The first implementation work should therefore **not** be a neural metaphor generator or world model.

First settle the A27-0 identity/admission/version seam. Then build decision-independent semantic normalization, committed perspective, fixed obligations/bindings, a pinned knowledge manifest and one static production compiler slice with explanation/replay/feedback. That creates a stable language in which humans, deterministic rules, System-1, System-2 and later search can contribute without becoming competing authorities.

The architectural destination is then straightforward:

> **Machine-scale semantic structure is compressed into human-scale perceptual experience; humans can inspect, critique and teach the mappings; the system retains that expertise with scope and evidence; and every representation remains reversible to the data and reasoning that gave it meaning.**

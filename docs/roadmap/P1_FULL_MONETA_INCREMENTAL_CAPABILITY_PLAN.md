# P1-FM — Incremental Full Moneta Capability Plan

**Status:** PROPOSED CANONICAL CAPABILITY LADDER / SYNC TARGET FOR `docs/ROADMAP.md`  
**Established:** 29 September 2026  
**Governing vision:** `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` V3.1  
**Live execution authority:** `docs/ROADMAP.md`  
**Representation architecture:** `docs/roadmap/P1_MCR_COMPOSITIONAL_REPRESENTATION_EXPANSION.md`  
**Product/UX doctrine:** `docs/Nemosyne_UX_Flow_and_Spatial_Interface_Design_Spec.md` and `docs/Nemosyne_VR_UI_Design_System_and_Agent_Spec.md`  
**Scientific admissibility:** `docs/research/MONETA_EVIDENCE_PROTOCOL.md`

## 1. Purpose

Full Moneta should not arrive as one large architectural reveal after a long chain of invisible subsystem work.

Nemosyne is a product and a research instrument. The product should become observably more capable at each step toward Full Moneta so that researchers can use the new capability, we can measure what changed, and the programme can STOP, CONTINUE or REVISE before investing in the next layer.

This plan therefore reorganises the existing TEC, MCR, PT9/PT10, UXR and future representation-algorithm work around **vertical capability increments**.

Each increment must deliver both:

1. a new bounded form of representation intelligence; and
2. a researcher-visible product experience that can be tested.

The underlying specialist workstreams remain authoritative for their contracts. This plan is the integration spine that says when their work becomes a meaningful product capability.

## 2. Product principle

The governing progression is:

| Increment | Nemosyne becomes | Researcher-visible capability |
|---|---|---|
| FM0 | Trustworthy | Representation decisions are provenance-complete, replayable and bound to one analytical authority. |
| FM1 | Question-aware | Different research questions and hypotheses can legitimately produce different representation decisions for the same dataset. |
| FM2 | Alternative-aware | Researchers can inspect, compare, challenge, reject and branch from meaningful representation alternatives. |
| FM3 | Compositional | Several governed semantic phenomena can coexist in one representation. |
| FM4 | Resolution-adaptive | The same semantic meaning can be embodied at different levels of richness according to hardware and perceptual budget: the “stickman ↔ Mona Lisa” principle. |
| FM5 | Intuitive / System-1-assisted | A small fast model can propose representation/composition decisions from typed intent and evidence without becoming analytical authority. |
| FM6 | Human-refined | Researcher judgement and validated discovery outcomes improve future representation priors through governed learning. |
| FM7 | Searching | Moneta searches a bounded representation grammar rather than choosing only from a fixed catalogue. |
| FM8 | Full Moneta | Evidence, intent, context, learned priors, search and hardware budget jointly produce inspectable adaptive representations under explicit scientific constraints. |

Advancement between increments is evidence-driven, not automatic.

## 3. Product-experience recovery rule

A technically correct Full Moneta that feels like a conventional analytics dashboard has missed part of the Nemosyne thesis.

The earlier product vision contained spatial and epistemic ideas that have become quieter while architecture, evidence governance and runtime work took priority. They are not automatically valid merely because they are evocative, but they deserve implementation and user testing where they can carry real semantic or cognitive value.

The following are therefore restored as explicit product-development threads:

- **Memory Palace:** spatial embodiment of investigation history and reasoning, not a decorative alternate world.
- **Road Not Taken:** inspectable counterfactual representation alternatives, including runner-up/sibling paths and eventually evolutionary lineage.
- **Challenge / Falsification:** make “try to break this pattern” a first-class interaction beside “show me this pattern”.
- **Spatial epistemology:** position, connection, enclosure, scale, motion and other spatial relations may encode meaning only when the mapping is explicit, governed and inspectable.
- **TechnoCore:** the coherent world instrument for asking how Nemosyne is seeing the dataset, including explanation, alternatives, stability and provenance.
- **Evidence Vault / Ice Vault:** frozen evidence, reproducible investigation states and return points.
- **Farcaster portals:** meaningful navigation between branches, investigations, detail levels and collaborator frames, never arbitrary operation buttons.
- **Branching and visible refutation:** disproven or abandoned paths remain part of the reasoning history rather than disappearing.
- **Collaboration and peer challenge:** shared focus, attributed counter-hypotheses, independent branches and convergence without treating consensus as truth.
- **Sonification and haptics as representation channels:** analytically justified, versioned and inspectable mappings rather than atmosphere.
- **Voice and multimodal equivalence:** voice may accelerate semantic interaction, while NIL remains the authority.
- **Cross-investigation recurrence:** repeated structures/findings may be surfaced as recurrence/resonance while remaining distinct from validation.
- **Sparse cyberspace / datum-plane identity:** preserve the sense of inhabiting an instrument rather than surrounding the researcher with generic panels.

Every recovered feature must earn its place through usability, comprehension, discovery or research value. Decorative complexity is not a success criterion.

## 4. Capability increments

### FM0 — Trustworthy Moneta

**Product promise:** “When Nemosyne says why this representation exists, the chain of evidence and authority is inspectable and replayable.”

This is the current frontier.

Required implementation:

- close RFC 0009 analytical authority-path defect #834;
- complete governed evidence consumer binding;
- preserve Rust-issued dataset/kernel/profile identities;
- explicitly migrate legacy evidence aliases rather than inferring identity from format;
- qualify governed export → replay → production consumption;
- keep synchronous snapshot serialization free of hidden live analytical acquisition.

Researcher-visible experience:

- TechnoCore explanation/provenance view reflects the same governed identity used by the decision;
- Evidence Vault exports/reopens the same evidence-bearing investigation;
- failures distinguish damaged evidence, incompatible evidence, unavailable authority and unsupported policy rather than collapsing them into generic errors.

**Exit:** a representation decision and its evidence can be exported, clean-room replayed and inspected without invoking a second analytical authority or silently substituting identity.

**STOP/REVISE question:** Is evidence governance understandable enough that it increases trust rather than merely adding internal machinery?

### FM1 — Question-Aware Moneta

**Product promise:** “Nemosyne represents the dataset in relation to what I am trying to understand.”

Required implementation:

- define canonical versioned `InvestigationIntent`;
- connect existing `ResearchContext` fields such as research question, hypothesis, variables of interest and current task to Moneta;
- make intent/context explicit inputs to representation requirements and decisions;
- persist intent/context hashes and versions in decision provenance;
- replay the exact intent/context that framed a decision;
- add known-answer and metamorphic tests showing that relevant intent changes may change the representation while irrelevant wording changes do not rewrite analytical truth.

Researcher-visible experience:

- the EXPLORE/ASK phase visibly affects representation reasoning;
- TechnoCore can answer “why this representation for this question?”;
- changing the question can produce a new preview without destroying the previous state;
- Memory Palace records the question/hypothesis context under which a representation was chosen.

**Exit:** at least two materially different research intents over the same governed dataset produce appropriately different, provenance-bearing representation decisions or an explicit decision not to change.

**STOP/REVISE question:** Does question-awareness improve usefulness, or does it merely cause unstable representation churn?

### FM2 — Alternative-Aware Moneta / Road Not Taken

**Product promise:** “I can see what Nemosyne nearly chose, compare it, challenge it and continue from it.”

Required implementation:

- promote alternatives from passive `RejectedAlternative` metadata into bounded inspectable candidate identities;
- preserve shared semantic anchors across current and alternative representations;
- add NIL/product actions for REQUEST_ALTERNATIVE, COMPARE, PREFER, REJECT and EXPLAIN through the existing authority paths;
- persist alternative identity and branch lineage;
- distinguish `AMBIGUOUS`, `ABSTAIN`, near-miss and eligible alternatives;
- prevent non-promotable alternatives from becoming active merely because the UI displays them.

Researcher-visible experience:

- implement the canonical **Road Not Taken** flow;
- summon runner-up or meaningful alternatives from TechnoCore;
- side-by-side, bounded overlay or carefully controlled morph where semantic correspondence permits;
- synchronized selection of corresponding semantic objects;
- branch the investigation from an alternative;
- preserve preference as `RepresentationJudgement`, not truth;
- display ambiguous candidates with equal visual authority rather than cosmetically crowning one.

Memory Palace extension:

- representation branches become visible reasoning paths;
- abandoned/refuted alternatives remain inspectable;
- “show path” can explain how the current branch diverged.

**Exit:** a researcher can compare at least two evidence-bound representation alternatives, preserve semantic correspondence, choose or defer without losing provenance, and replay either branch.

**STOP/REVISE question:** Are alternatives genuinely useful hypotheses about the data, or merely different-looking layouts?

### FM3 — Compositional Moneta

**Product promise:** “Nemosyne can express several relevant structures together instead of forcing me to choose one representation family.”

Required implementation:

- advance P1-MCR MCR2 general semantic-to-spatial compiler;
- MCR3 multi-element runtime and lifecycle;
- MCR4 composed interaction/detail semantics;
- initially use a small qualified composition grammar rather than open-ended generation;
- prove evidence-bound semantic identity across every primitive;
- support deterministic/reference composition before search.

Researcher-visible experience:

- one world can coordinate, for example, distribution + clusters + uncertainty or temporal structure + anomalies;
- semantic relations determine meaningful spatial coordination;
- detail on one phenomenon does not destroy siblings;
- Compare and Challenge can operate across the composition;
- TechnoCore explains the composition as a set of claims/phenomena, not as a single named chart.

Spatial epistemology checkpoint:

- explicitly test which spatial relations users actually understand as intended;
- reject attractive mappings that imply unsupported analytical relationships.

**Exit:** at least one production-reachable representation contains two or more independently governed semantic phenomena with preserved evidence identity and usable composed interaction.

**STOP/REVISE question:** Does composition improve understanding, or does it increase cognitive clutter?

### FM4 — Resolution-Adaptive Moneta / Stickman ↔ Mona Lisa

**Product promise:** “The same investigation remains meaningful on constrained and powerful hardware, while stronger hardware exposes more useful semantic depth.”

Required implementation:

- formalise a semantic-resolution contract distinct from polygon LOD;
- define hardware/perceptual capability budgets for CPU, GPU, memory, analytical residency, model residency and scene complexity;
- extend SpatialEmbodimentPlan to express phenotype/resource intent without mutating analytical semantics;
- generate multiple valid phenotypes from the same semantic graph;
- use UXR2/UXR3 lifecycle/admission/eviction machinery;
- implement progressive crystallisation and reversible semantic refinement/collapse;
- qualify cross-hardware equivalence.

Researcher-visible experience:

- Quest-class hardware may receive a sparse “stickman” embodiment;
- stronger PC/XR hardware may receive “Mona Lisa” semantic richness;
- both preserve core claims, evidence, exceptions, uncertainty and investigation identity;
- additional compute buys simultaneous structures, deeper detail, richer comparisons and prefetch rather than decorative polygons;
- researchers can inspect what was aggregated or omitted.

Memory Palace / world behaviour:

- investigation history remains durable even if spatial objects are evicted;
- returning to a prior locus reconstructs the semantic state under the current hardware budget.

**Exit:** one governed investigation runs at two materially different resource budgets with different spatial richness while preserving the same core semantic/evidence identity and explicit information-loss contract.

**STOP/REVISE question:** Does adaptive resolution preserve meaning well enough that hardware differences feel like depth differences rather than different scientific stories?

### FM5 — Intuitive Moneta / System-1 Decision Driver

**Product promise:** “Nemosyne can form fast, context-sensitive representation proposals without waiting for heavyweight deliberation.”

Required implementation:

- define a provider-neutral typed System-1 proposal interface;
- inputs are governed evidence references, investigation intent, researcher context, ontology/version and available budgets;
- outputs are structured proposal distributions, candidate/composition suggestions, escalation and ABSTAIN, not free-form authority;
- pin model artifact/runtime/tokenizer/prompt-template/input hashes and decoding configuration;
- persist the exact proposal used by Moneta;
- replay uses the recorded proposal rather than rerunning inference;
- fresh inference is an audit/alternative-generation action;
- qualify small downloadable/local models where possible;
- test Quest-resident model footprint/latency alongside Nemosyne.

Researcher-visible experience:

- representation suggestions react quickly to natural-language/task intent;
- TechnoCore exposes that a proposal came from a System-1 driver and shows its status as advice, not analytical evidence;
- “why?” and “show alternatives” remain available;
- if the model is unavailable, Nemosyne falls back to declared deterministic/reference behaviour or abstains according to the contract.

**Exit:** the System-1 driver measurably improves proposal latency, useful candidate coverage or task alignment on a bounded evaluation without weakening replay, provenance or evidence gates.

**STOP/REVISE question:** Does this model provide real decision value over deterministic Moneta, especially on-device, or is it complexity without benefit?

### FM6 — Human-Refined Moneta

**Product promise:** “Nemosyne learns from what researchers actually found useful and defensible, not merely from what they clicked.”

Required implementation:

- PT9 curated learning corpus from pairwise judgement, feature snapshots and discovery outcomes;
- preserve telemetry vs research evidence vs training-data boundaries;
- researcher/dataset-disjoint holdouts where appropriate;
- transparent baseline model before opaque alternatives;
- explicit promotion/rollback through Model Registry;
- preserve evidence disposition as a hard gate;
- distinguish preference learning from discovery-outcome learning.

Researcher-visible experience:

- researchers can prefer/reject/rate alternatives and explain why;
- validated DiscoveryEpisodes can be linked to the representation that framed them;
- adaptive Product Mode may use promoted priors;
- Research Mode can freeze the prior/model version;
- TechnoCore exposes when a learned prior influenced a decision.

Memory Palace extension:

- discovery outcomes become visible learning evidence links without turning a popular path into scientific truth;
- repeated successful/refuted representation patterns can be inspected historically.

**Exit:** a promoted learned prior is reproducibly better than the bootstrap baseline on its declared held-out objectives while maintaining known-answer, abstention, stability and evidence constraints.

**STOP/REVISE question:** Is learning improving discovery support rather than merely reproducing user preference?

### FM7 — Searching Moneta

**Product promise:** “Nemosyne can construct and search new bounded representation hypotheses rather than selecting only from a hand-authored catalogue.”

Required implementation:

- formal representation objective model covering task relevance, information preservation, perceptual recoverability, interaction cost, resource cost, stability and explicit loss;
- bounded RepresentationGraph grammar;
- deterministic reference composer as the first baseline;
- multi-objective search preserving Pareto/inspectable alternatives;
- System-1 proposals may seed/prune search but cannot bypass evidence gates;
- preserve lineage, failure reasons, evidence and model/protocol versions;
- evolutionary/adversarial laboratory work may improve search or the representation algorithm only through the MCR7 governed handoff.

Researcher-visible experience:

- “Road Not Taken” can show true search siblings/ancestors rather than only fixed catalogue runners-up;
- TechnoCore can expose why a composition was generated and which objectives trade off;
- the user may request “simpler”, “show more uncertainty”, “preserve temporal structure”, or other governed adjustments without directly editing an opaque score;
- candidate lineage can appear in Memory Palace where it helps reasoning.

**Exit:** Moneta generates at least one useful admissible representation outside the original fixed candidate catalogue, with inspectable lineage and no analytical-authority leakage.

**STOP/REVISE question:** Is search discovering useful representational hypotheses, or only producing combinatorial novelty?

### FM8 — Full Moneta / Controlled Adaptive Representation Intelligence

**Product promise:** “Nemosyne progressively becomes better at helping researchers discover meaningful structure while remaining inspectable, reproducible and scientifically constrained.”

Required integration:

- trustworthy governed evidence;
- question/context-aware representation;
- inspectable alternatives;
- compositional representation;
- hardware-adaptive semantic resolution;
- qualified System-1 proposal assistance where justified;
- learned priors;
- bounded search/synthesis;
- controlled adaptation with immutable history and Research Mode freezing;
- human/device evidence for human-dependent claims.

Researcher-visible experience:

- the complete investigation loop feels spatial, skeptical and recoverable;
- representations can adapt without destroying orientation or provenance;
- alternatives and refutations remain visible;
- Memory Palace provides durable cognitive geography of the investigation;
- Evidence Vault provides reproducible checkpoints;
- Farcasters move between meaningful contexts;
- TechnoCore acts as the instrument for interrogating Moneta itself;
- richer hardware deepens the world without changing its truth;
- collaboration can surface independently recurring discoveries without treating convergence as authority.

**Exit:** the system satisfies the V3.1 architectural maturity definition and has human evidence that the integrated product supports meaningful dataset investigation under clearly scoped claims.

## 5. Cross-cutting recovered product threads

The following threads are intentionally **not** separate end-of-road epics. They enter as soon as their supporting capability exists and are repeatedly tested.

| Product thread | First increment | Later maturation |
|---|---|---|
| Memory Palace | FM1 | FM2 branch/alternative paths; FM6 learning/outcome history; FM7 search lineage |
| Road Not Taken | FM2 | FM7 true search/evolutionary siblings |
| Challenge/falsification | FM1/FM2 | FM3 composed challenge; FM6 learning from supported/refuted outcomes |
| TechnoCore | FM0 | progressively gains intent, alternatives, composition, learning and search explanation |
| Evidence Vault | FM0 | snapshots of composed/adaptive worlds and model-frozen research states |
| Farcasters | FM2 | branches, saved investigations, collaborator frames, related investigations |
| Spatial epistemology | FM3 | FM4 hardware-dependent semantic depth; FM7 generated representation grammar |
| Branch/revisit | FM1 | FM2 alternative branches and FM6 discovery-outcome history |
| Collaboration/peer challenge | FM2+ | evaluate when shared investigation state is stable enough; no consensus-as-truth |
| Sonification/haptics | FM3+ | treat as versioned representation primitives where evidence/user testing supports them |
| Voice | FM1+ | semantic input accelerator through NIL, never a parallel command authority |
| Cross-investigation recurrence | FM6+ | surface recurrence/resonance distinctly from validation or truth |
| Sparse cyberspace identity | all | preserve visual/product identity while every persistent object earns its volume |

## 6. Workstream mapping

The capability ladder does not replace specialist programmes.

- **P1-TEC** supplies trustworthy evidence closure for FM0 and remains a hard boundary for later promotion.
- **P1-MCR** supplies composition/compiler/runtime machinery for FM3 and parts of FM4/FM7.
- **P1-UXR** supplies bounded runtime, device and human evidence needed throughout.
- **PT9** supplies FM6 learning-evidence and promotion infrastructure.
- **PT10 / P1-WQ** supplies real researcher/product/discovery evidence.
- **Future MCI work** supplies FM1 intent/context integration.
- **Future HSR work** supplies FM4 hardware-adaptive semantic resolution.
- **Future System-1 work** supplies FM5 proposal assistance.
- **Future representation-algorithm/search work** supplies FM7.
- **Evolutionary/adversarial laboratory work** improves representation/search algorithms downstream of governed production contracts rather than becoming a second production authority.

## 7. Increment rhythm

Every increment follows the same loop:

1. pre-implementation adversarial review identifies the most dangerous assumptions;
2. implement the smallest production-reachable capability;
3. expose it through an actual researcher journey;
4. run known-answer/metamorphic/software falsifiers;
5. gather the highest evidence tier available for the claim;
6. perform post-implementation adversarial review;
7. assess the product experience, including whether the feature is understandable and worth its complexity;
8. choose STOP, CONTINUE or REVISE;
9. update the roadmap only with evidence actually established.

A capability increment may be revised or stopped even if its underlying engineering works.

## 8. Sequencing and parallelism

The ladder describes **promotion order**, not a ban on preparatory parallel work.

Safe examples of early work include:

- FM1 contract design while TEC implementation closes;
- FM2 UX prototypes using existing fixed alternatives;
- FM4 semantic-resolution research using hand-authored graphs;
- FM5 System-1 model experiments outside the production authority path;
- FM7 evolutionary/search experiments in the laboratory;
- Memory Palace/TechnoCore/Farcaster interaction studies that do not claim scientific or physical-device success.

Production promotion must still respect the live integration rules in `docs/ROADMAP.md`.

## 9. Immediate roadmap sync

At establishment, the current programme position is:

- **FM0 ACTIVE**, because P1-TEC/RFC 0009 remains open and #834 is the immediate bounded authority-path fix-forward.
- **FM1 READY FOR CONTRACT/PRE-WORK**, but production promotion follows the relevant TEC closure.
- **FM2 product/UX pre-work may reuse existing alternative metadata and existing Memory Palace/TechnoCore infrastructure without claiming completion.**
- **FM3 maps to existing P1-MCR MCR2-MCR4.**
- **FM4-FM7 are named future capability increments and should be decomposed only as each preceding increment supplies evidence about what is actually needed.**
- **FM8 is a destination, not a single implementation tranche.**

The roadmap should track the **next capability gain** as well as the next engineering ticket.

## 10. Product success criterion

The programme should repeatedly ask:

> Did this increment make Nemosyne better at helping a researcher notice, question, challenge, understand, validate, remember or communicate something meaningful about their data?

Green CI, elegant architecture, lower latency, richer geometry and more sophisticated models are supporting evidence. None is the product outcome by itself.


## 11. Legacy, dormant and post-Full-Moneta disposition register

Full Moneta development must not accumulate a second hidden architecture from prototypes, compatibility shims and superseded experiments. The following register records current disposition candidates. These are planning classifications, not proof that deletion is safe; removal requires a fresh import/reachability/test audit.

### 11.1 Prefer deletion after bounded reachability confirmation

| Surface | Current evidence | Planned disposition |
|---|---|---|
| `src/draco/**` compatibility facade | Production imports are already forbidden and `docs/DRACO_COMPAT_INVENTORY.md` records no production consumers. | Migrate the remaining intentional compatibility tests/callers, retain at most one compatibility-contract test for the declared window, then delete the Draco facade under an explicit breaking-change decision. |
| `src/network/CollaborativeStateSync.ts` | Production-capability registry explicitly marks it superseded by `NetworkManager` + `CollaborationCoordinator`. | Delete after legacy-test migration. Do not allow it to become a second collaboration-state authority. |
| `src/network/SharedAnnotationManager.ts` | Registry marks the network copy superseded by the live VR interaction annotation authority. | Delete the superseded network implementation after callers/tests are migrated; preserve only the canonical annotation authority. |
| `src/session/ShareableSessionURL.ts` | Registry marks it a legacy lightweight URL prototype; governed `.nemosyne` packaging is the portable-investigation path. | Delete unless a new, explicitly scoped “lightweight view link” product requirement is approved with clear non-authoritative semantics. |
| `src/data/serializers/FlatBuffersSerializer.ts` | It is not FlatBuffers interoperability; it is a hand-rolled row buffer and is development-only. | Prefer deletion. If a real bounded binary dataset/message format is later needed, name and specify it truthfully or adopt the actual standard. |
| deprecated representation/hash aliases | `FAMILY_TO_LAYOUTS`, `LAYOUT_TO_FAMILY`, `RepresentationDecision.confidence/confidenceScore`, `fnv1aHex`, `datasetContentHashHex` remain migration aliases. | Retire before FM1/FM3/F6 code can accidentally build new semantics on misleading names. Preserve persisted-format compatibility at the boundary rather than preserving ambiguous internal vocabulary indefinitely. |

### 11.2 Re-evaluate before either deletion or promotion

| Surface | Why it matters | Re-evaluation point |
|---|---|---|
| `MemoryPalaceController` | The current authoring controller is not a production consumer and uses placeholder/random IDs, default provenance and heuristic `confidence/relevance`. The bounded production Memory Palace projection is separate and valid. | **FM1-FM2:** do not reactivate this controller as-is. Either delete it and author directly through Investigation/NIL/Discovery authorities, or replace it with a thin authority-preserving controller. |
| `MovablePanel` legacy canvas substrate | UXR1 moved the normal analyst path to UIKit/SpatialPanel, but the legacy base, tests and compatibility vocabulary remain. | Run one fresh reachability/inheritance audit after current physical-validation dependencies settle. Delete the substrate if no unique supported/diagnostic surface still requires it; retain only deliberately isolated diagnostic use if necessary. |
| `ColorPaletteEngine` | Standalone unused experiment, but colour/CVD accessibility is genuinely relevant to representation semantics and user testing. | **FM3-FM4:** extract any valuable perceptual/accessibility tests or algorithms into the canonical encoding/representation path, then delete the standalone engine unless it becomes that authority. |
| `SpatialAudioSynthesizer` | Implemented and tested but not production-composed. Sonification has renewed product relevance as a possible representation channel. | **FM3+ product experiment:** evaluate a small number of analytically justified sonification mappings. Promote through RepresentationGraph/SpatialEmbodimentPlan or archive/delete if user evidence is weak. |
| `MultimodalPerceptionEngine` | Explicitly development-only; its gaze + gesture + voice fusion maps directly to future multimodal/NIL ambitions. | **FM5 or earlier UX experiment:** preserve as a laboratory specimen, but do not promote its current heuristic confidence thresholds as calibrated truth. Replace with governed perception contracts if evidence supports multimodal fusion. |
| live-stream / River-Tethys-style experience | Live ingest is experimental-production, while the richer spatial-stream metaphor largely faded from the product foreground. | Re-evaluate after core question-aware/compositional investigation is useful. A live stream should earn a semantic representation rather than become ambient spectacle. |
| collaboration substrate | Network/signalling code is substantial and experimental-production, but full peer-challenge experience is not yet product-qualified. | **FM2+ / private preview:** preserve the secure transport, but test whether shared focus, branch comparison and peer challenge provide enough research value to justify the operational surface. |

### 11.3 Park explicitly for post-Full-Moneta or evidence-triggered reconsideration

| Surface / idea | Disposition |
|---|---|
| Rust scene command buffer (`CommandApplier` + `wasm/src/command_buffer.rs`) | Dormant provisional renderer-control ABI. Keep development-only or archive it until measured headset/runtime evidence shows that Rust-owned scene command production solves a real bottleneck. It must not create a second representation/spatial authority merely for performance. |
| richer “River Tethys”, “Zones of Thought”, ICE and other literary world metaphors | Treat as a design-idea library. Reintroduce only when a metaphor carries a tested semantic/navigation function. Do not restore them as scenery. |
| Gaussian splatting, biosignal salience, federated cross-investigation learning and similar speculative representation/learning ideas | Post-Full-Moneta research candidates unless a nearer capability increment produces a concrete requirement. They must not distract from establishing a useful reference representation algorithm and human discovery evidence. |
| generative/neural representation model beyond qualified System-1 proposal assistance | Post-FM7 candidate. Require evidence that bounded transparent composition/search is insufficient before introducing a harder-to-inspect generative authority. |
| autonomous representation/research sub-agents | Laboratory/post-FM candidate. Agents may generate hypotheses/falsifiers/search proposals, but no consensus or autonomy may substitute for evidence authority or attributable researcher judgement. |

### 11.4 Cleanup cadence

At every FM increment STOP review:

1. inventory code newly made obsolete by the increment;
2. identify compatibility shims whose declared window has expired;
3. remove duplicated/superseded authorities rather than leaving them dormant on the import surface;
4. archive useful historical design material instead of keeping executable prototypes merely as memory;
5. keep future experiments behind explicit development/laboratory capability classifications;
6. promote a dormant idea only through the same evidence and product-value process as a new feature.

The goal is not maximal deletion. It is a repository in which **live code means live intent, archived code means historical intent, and future experiments cannot be mistaken for product authority**.

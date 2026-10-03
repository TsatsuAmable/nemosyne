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

## 3.1 Architecture-preflight rule

Do not create a standing architecture programme. Use a compact preflight only when the next implementation tranche crosses a durable authority, identity, persistence, learning, distributed-state or search seam that would be expensive to reverse after code lands.

A preflight is triggered **immediately before its implementation frontier**, not months in advance. It should normally produce one short ADR/design note that states:

- authority/ownership boundaries;
- durable identities and versioned contracts;
- data/control flow and replay implications;
- failure/refusal behaviour;
- migration/compatibility consequences;
- the smallest competing alternatives worth preserving;
- executable falsifiers or evidence that can reverse the decision.

Stop the preflight once the implementation boundary is unambiguous. Reuse existing architecture instead of restating it. Routine feature work and already-designed seams do not require another preflight.

Current triggers:

| Trigger | Fires before | Minimum decision required |
| --- | --- | --- |
| **AP-INV — Investigation graph / branching** | first FM1 implementation that persists versioned intent, and before FM2 branch activation | canonical investigation node/edge identity; immutable history vs working state; branch/merge/revisit semantics; representation correspondence; Memory Palace/Farcaster projections; replay rules |
| **AP-SEMRES — Semantic resolution / budget broker** | first FM4 adaptive-resolution implementation | semantic invariants; degradable dimensions; explicit information-loss contract; capability/resource budget vocabulary; admission/eviction/reconstruction ownership; phenotype negotiation |
| **AP-LEARN — Learning-evidence architecture** | PT9/FM6 corpus construction or outcome-attribution implementation | preference vs discovery-outcome evidence; legitimate targets; attribution/credit; leakage and feedback-loop controls; grouping/holdouts; promotion/decay/rollback |
| **AP-SEARCH — Representation search/synthesis** | first FM7 grammar/search implementation | grammar authority; search-state/lineage identity; objective vector; constraint/admission boundary; Pareto semantics; budget/stopping rules; deterministic baseline; MCR7 genome handoff |
| **AP-COLLAB — Collaboration / recurrence** | first FM6+ shared-branch or cross-investigation recurrence implementation | shared/private state; attribution; conflict semantics; permissions; recurrence/similarity identity; explicit rule that convergence/retrieval is not scientific validation |

FM0/P1-TEC and MCR0-MCR7 do **not** receive new general preflights merely because they are consequential: they already have substantial governing architecture. Use focused design review only if implementation exposes a new seam not covered by those contracts.

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

**Architecture preflight:** trigger **AP-INV** before the first implementation that makes intent/branch state durable. The resulting contract must also govern FM2 rather than allowing FM1 and FM2 to invent separate history models.

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

**Architecture preflight:** trigger **AP-SEMRES** immediately before adaptive semantic-resolution implementation. Ordinary renderer LOD work does not satisfy this decision.

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

**Product promise:** “Nemosyne can form fast, context-sensitive representation proposals and infer bounded interaction intent without waiting for heavyweight deliberation.”

**Architecture decision:** [MONETA_SYSTEM1_SYSTEM2_ONNX_ARCHITECTURE.md](../architecture/MONETA_SYSTEM1_SYSTEM2_ONNX_ARCHITECTURE.md) defines the FM5 authority split, ONNX scope, runtime contract, training/evaluation requirements and implementation tranches.

Required implementation:

- define one provider-neutral, typed System-1 model/artifact contract with explicit feature schema, calibration state, ABSTAIN, runtime provider and content-addressed provenance;
- implement two independently promotable specialist lanes rather than one fused model:
  - **object-centric perception**, producing typed physical interaction cues that a deterministic resolver converts to `InteractionIntent -> NIL`;
  - **representation proposal**, producing bounded candidate/composition advice from governed Moneta features and intent;
- keep named symbolic gesture recognition experimental rather than a core command vocabulary;
- retain the current transparent learned ranker as the representation baseline; require ONNX only when a nonlinear candidate demonstrates bounded benefit;
- keep System-2 Moneta explicit: hard constraints, evidence admission, alternatives, challenge, search and final `RepresentationDecision` remain outside ONNX authority;
- persist the exact System-1 result consumed by the product; replay uses the recorded result rather than silently rerunning mutable inference;
- qualify ONNX Runtime Web WASM as the baseline small-model execution path, with WebGPU used only after feature detection and target-device measurement;
- keep inference off the XR render critical path and reject stale results;
- generalize useful PT7/PT8 lineage, evaluation, promotion and rollback machinery without coupling all System-1 artifacts to the gesture or FitnessModel schemas;
- freeze exact System-1 model/runtime/feature identities in Research Mode;
- test Quest/browser and desktop latency, memory, thermal and failure envelopes.

Researcher-visible experience:

- representation suggestions react quickly to typed task/intent context;
- direct manipulation remains primary, while object/context-aware perception may reduce targeting/commit friction without requiring memorized gestures;
- TechnoCore exposes when a proposal came from System-1 and presents it as advice rather than analytical evidence;
- “why?”, “show alternatives”, deterministic fallback and explicit ABSTAIN remain available;
- if a learned perception or representation model fails its qualification, the corresponding deterministic/reference path remains usable.

**Exit:** at least one bounded System-1 lane demonstrates measurable value over its deterministic/reference baseline on held-out and target-device evaluation, while the other lane has an explicit CONTINUE/REVISE/STOP disposition; replay, provenance, NIL semantics and Moneta hard/evidence constraints remain intact.

**STOP/REVISE question:** Do small learned reflexes reduce interaction/search cost enough to justify their runtime, data and governance complexity, or should Nemosyne remain deterministic at that seam?
### FM6 — Human-Refined Moneta

**Architecture preflight:** trigger **AP-LEARN** before PT9/FM6 builds a new learning corpus or attributes discovery outcomes to representations. Trigger **AP-COLLAB** separately only when shared-branch/cross-investigation recurrence implementation reaches the frontier.

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

**Architecture preflight:** trigger **AP-SEARCH** before implementing the grammar/search loop. MCR7 defines the production handoff seam but does not by itself define the search architecture.

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

### 5.1 Staged feature and legacy-code schedule

Recovered product ideas and dormant/legacy code are assigned to the increment where they become meaningful. This avoids both extremes: postponing the product experience until FM8, or reviving prototypes before their governing semantics exist.

| Increment | Product features to implement / test | Legacy or dormant code decision | Evidence question before promotion |
|---|---|---|---|
| **FM0 — Trustworthy** | TechnoCore provenance/explanation; Evidence Vault governed freeze/export/reopen; explicit failure/recovery states; sparse world hierarchy remains intact. | **FM0-CLEAN:** finish the declared Draco compatibility exit where safe; remove/retire misleading evidence/hash aliases that can contaminate new work; decide/delete legacy `ShareableSessionURL` in favour of governed `.nemosyne` portability; delete or truthfully rename the hand-rolled `FlatBuffersSerializer` if no real product consumer remains. | Can a researcher inspect, preserve and replay the reason a representation exists without encountering a second authority or misleading legacy vocabulary? |
| **FM1 — Question-Aware** | Memory Palace records question/hypothesis/task context; TechnoCore answers “why this for this question?”; branch/revisit from investigation state; first bounded voice-to-NIL intent-entry experiment where useful. | **FM1-MEM RESOLVED (PR #855, merged 1 October 2026 at `a55edaf`):** the dormant `MemoryPalaceController` was retired in full — the 405-line class deleted from the executable tree with its barrel export line, never reactivated or replaced, so no random-ID/placeholder-provenance authoring path can return through it. The alias-removal clause of this row remains open and owner-gated (RFC 0007). | Does intent meaningfully improve representation choice and does the researcher understand the connection between question, representation and investigation history? |
| **FM2 — Alternative-Aware** | Full Road Not Taken flow; ghost/side-by-side alternatives; synchronized semantic selection; representation branching; Farcaster navigation between branches/saved states; visible refutation; first collaboration/peer-challenge pilot. | **FM2-COLLAB-CLEAN:** delete superseded `CollaborativeStateSync` and network `SharedAnnotationManager` after test/caller migration; preserve only NetworkManager/CollaborationCoordinator and canonical annotation authority. | Are alternatives and branches cognitively useful rather than decorative, and does collaboration add genuine challenge/comparison value? |
| **FM3 — Compositional** | Spatial epistemology becomes explicit and testable; composed Challenge flow; sonification/haptics experiments as versioned representation channels; optional live-stream/River-Tethys prototype only where a governed live semantic structure exists. | **FM3-PERCEPT:** re-evaluate `ColorPaletteEngine`; absorb useful CVD/perceptual logic into the canonical representation/encoding path or delete it. Re-evaluate `SpatialAudioSynthesizer`; promote through RepresentationGraph/SpatialEmbodimentPlan or archive/delete. | Do multiple simultaneous semantic structures and multimodal encodings improve understanding without inventing relationships or overwhelming the user? |
| **FM4 — Resolution-Adaptive** | Stickman ↔ Mona Lisa semantic resolution; progressive crystallisation; preserved spatial memory across eviction/reconstruction; explicit information-loss inspection; sparse cyberspace visual identity across hardware classes. | **FM4-UI-CLEAN:** audit and retire the remaining `MovablePanel` canvas substrate once physical/diagnostic dependencies permit. **Rust scene command buffer remains dormant** unless measured device evidence shows a real bottleneck that the existing renderer cannot solve. | Does hardware adaptation alter richness rather than meaning, and can the user retain orientation and comprehension across resolution changes? |
| **FM5 — System-1 / Intuitive** | Qualified representation proposal reflex plus object-centric interaction cues; voice/gaze remain modality inputs through NIL; named gestures are experimental; fast “why / alternatives / simplify” interactions. | **FM5-PERCEPTION:** replace the `MultimodalPerceptionEngine` string-action/heuristic-confidence prototype with typed cue contracts or archive it. Follow the [System-1/System-2 ONNX architecture](../architecture/MONETA_SYSTEM1_SYSTEM2_ONNX_ARCHITECTURE.md). | Do small learned reflexes improve responsiveness, targeting or candidate coverage enough to justify their complexity while preserving replay and explicit authority boundaries? |
| **FM6 — Human-Refined** | Researcher preference + validated discovery outcome learning; Memory Palace shows outcome/learning lineage; cross-investigation recurrence/resonance prototype; collaboration matures toward independent-convergence views without consensus-as-truth. | Keep learning/study infrastructure development-only until promoted artifacts and evidence contracts justify runtime composition. Do **not** promote federated learning merely because multiple investigations now exist. | Is learning improving discovery support rather than reinforcing popularity, salience or researcher-specific habits? |
| **FM7 — Searching** | Generated representation hypotheses; true Road Not Taken search siblings/ancestors; inspectable Pareto trade-offs; Memory Palace search lineage where useful; evolutionary/adversarial improvement through the governed MCR7 handoff. | Reassess whether a larger generative/neural representation model is needed. Prefer transparent bounded search unless evidence shows it is insufficient. Autonomous representation agents remain laboratory-only. | Is search producing useful new representation hypotheses rather than combinatorial novelty, and can researchers understand why they exist? |
| **FM8 — Integrated Full Moneta** | Coherent end-to-end product experience: Memory Palace, TechnoCore, Vault, Farcasters, challenge, alternatives, adaptive resolution, qualified multimodality, collaboration and recurrence operate as one instrument rather than separate demos. | Final compatibility/prototype purge. Any live experimental surface must have a declared production owner, evidence basis and user journey, otherwise archive/remove it. | Does the integrated instrument improve meaningful investigation under scoped human evidence, and which features deserve to survive as permanent product identity? |
| **Post-FM / evidence-triggered** | Revisit richer literary metaphors, Gaussian splatting, biosignal salience, federated cross-investigation learning, larger generative representation models and autonomous research/representation agents only against concrete product/research needs. | Keep outside production imports until an FM8/post-FM research proposal supplies a governing question, authority boundary, falsifiers and value criterion. | Does the idea solve an observed limitation of Full Moneta, or merely add novelty? |

### 5.2 Named cleanup / re-evaluation packages

These packages are deliberately attached to capability milestones rather than scheduled as one giant repository-cleanup epic:

- **FM0-CLEAN — Compatibility and misleading-vocabulary retirement:** Draco facade, obsolete portable/share prototypes, misleading serializer naming/implementation and migration aliases that threaten new authority/provenance work. **Partially executed:** share-link prototype and `src/session/ShareableSessionURL.ts` retired by PR #855, the false FlatBuffers serializer `src/data/serializers/FlatBuffersSerializer.ts` retired by CMS-2 (PR #890) with its bounds coverage migrated to the canonical Arrow/MessagePack paths; the Draco facade is absent from the executable tree. Remaining and owner-gated: the deprecated representation/hash alias retirement (RFC 0007; S13/ERA-AG4).
- **FM1-MEM — Memory-authoring authority reconciliation:** replace or remove the dormant Memory Palace authoring controller before question-aware reasoning begins to depend on it. **EXECUTED (PR #855, merged 1 October 2026 at `a55edaf`):** the dormant `MemoryPalaceController` was removed in full (the 405-line class plus its barrel export line), not reactivated, and had no dedicated test or registry entry of its own at deletion time.
- **FM2-COLLAB-CLEAN — Collaboration authority convergence:** remove superseded collaboration-state and annotation implementations before peer-challenge becomes a product capability. **EXECUTED (CMS-4, PR #895, merged `main@7129c3f2` 3 October 2026):** `src/network/CollaborativeStateSync.ts` and the network-barrel `src/network/SharedAnnotationManager.ts` plus both `legacy-*` registry entries deleted; the canonical `NetworkManager`/`CollaborationCoordinator` and the VR interaction annotation authority remain untouched.
- **FM3-PERCEPT — Representation-channel consolidation:** decide whether palette/CVD and spatial-audio experiments become governed representation primitives or leave the executable product tree. **RESOLVED — both halves (3 October 2026):** palette/CVD ABSORB-then-DELETE by CMS-5 (decision PR #892, execution PR #894 — WCAG contrast helpers absorbed into the canonical tokens authority, engine + `colord` dependency deleted); spatial-audio ARCHIVE by FM3-PERCEPT (decision PR #898, execution PR #899, audit record `docs/review-plans/FM3_PERCEPT_SPATIAL_AUDIO_AUDIT_2026-10-03.md` — Synthesizer + Narrator + the dead `vr/audio` barrel deleted, live `SelectionFeedback` untouched).
- **FM4-UI-CLEAN — Legacy spatial-panel retirement:** eliminate the old canvas-panel substrate once remaining diagnostic/physical-evidence dependencies are exhausted. **EXECUTED (PR #897, merged `main@9fca179e` 3 October 2026, census §S3 package):** `MovablePanel` + `CanvasTextureCacheManager` + the substrate-comparison benchmark deleted; `MovablePanelOptions` replaced by substrate-neutral `PanelOptions`; surviving coverage re-hosted on the live `SpatialPanel`/`WorkspaceSurfaceManager` surfaces.
- **FM5-PERCEPTION — Multimodal authority decision:** replace the heuristic perception prototype with a governed NIL-facing implementation or archive it. **RESOLVED — ARCHIVE (CMS-6, decision PR #893, execution PR #896 at `main@51395b09`, 3 October 2026):** the heuristic engine + gesture recognizer are deleted; the future FM5 perception surface is governed, inheriting only the documented typed cue contracts C1–C5 (`docs/review-plans/CMS6_MULTIMODAL_PERCEPTION_AUDIT_2026-10-02.md`).
- **FM8-CLEAN — Final prototype/compatibility purge:** no dormant executable subsystem survives Full Moneta merely because it once had tests.

Cleanup packages may run earlier when a fresh reachability audit proves they are non-colliding and safe, but they must be completed no later than the named increment's STOP review.

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
| `src/network/CollaborativeStateSync.ts` | Production-capability registry explicitly marks it superseded by `NetworkManager` + `CollaborationCoordinator`. | **RETIRED (CMS-4, PR #895, 3 October 2026):** deleted in full together with its two `legacy-*` registry entries, after the census §S1 prerequisite was satisfied by re-homing the sequence/channel-binding falsifiers onto the production `NetworkManager` path. |
| `src/network/SharedAnnotationManager.ts` | Registry marks the network copy superseded by the live VR interaction annotation authority. | **RETIRED (CMS-4, PR #895, 3 October 2026):** the network-barrel copy is deleted; the canonical `src/vr/interactions/SharedAnnotationManager.ts` remains the untouched authority. |
| `src/session/ShareableSessionURL.ts` | Registry marks it a legacy lightweight URL prototype; governed `.nemosyne` packaging is the portable-investigation path. | **RETIRED (PR #855, 1 October 2026, FM0-CLEAN line item):** deleted in full (class, dedicated test, `shareable-session-url` registry entry); no lightweight view-link requirement was raised, and governed `.nemosyne` packaging remains the portable path. |
| `src/data/serializers/FlatBuffersSerializer.ts` | It is not FlatBuffers interoperability; it is a hand-rolled row buffer and is development-only. | **RETIRED (CMS-2, PR #890, 2 October 2026):** deleted in full — it was never FlatBuffers interoperability and had zero production reachability; the valuable length-field-bounds behaviour was re-pinned against the canonical Arrow/MessagePack surfaces and the `flatbuffers-prototype` registry entry removed. |
| deprecated representation/hash aliases | `FAMILY_TO_LAYOUTS`, `LAYOUT_TO_FAMILY`, `RepresentationDecision.confidence/confidenceScore`, `fnv1aHex`, `datasetContentHashHex` remain migration aliases. | Retire before FM1/FM3/F6 code can accidentally build new semantics on misleading names. Preserve persisted-format compatibility at the boundary rather than preserving ambiguous internal vocabulary indefinitely. |

### 11.2 Re-evaluate before either deletion or promotion

| Surface | Why it matters | Re-evaluation point |
|---|---|---|
| `MemoryPalaceController` | The current authoring controller is not a production consumer and uses placeholder/random IDs, default provenance and heuristic `confidence/relevance`. The bounded production Memory Palace projection is separate and valid. | **RESOLVED (FM1-MEM, PR #855, 1 October 2026):** the 405-line class was deleted in full from the executable tree (its barrel export removed with it), alongside `ShareableSessionURL` — no reactivation, no replacement controller; authoring returns through the Investigation/NIL/Discovery authorities if ever needed, and the bounded production Memory Palace projection remains separate and valid. |
| `MovablePanel` legacy canvas substrate | UXR1 moved the normal analyst path to UIKit/SpatialPanel, but the legacy base, tests and compatibility vocabulary remain. | **RESOLVED (FM4-UI-CLEAN, PR #897, 3 October 2026, census §S3 package):** deleted in full with `CanvasTextureCacheManager` and its fixture/benchmark test rent; surviving coverage re-hosted on the live `SpatialPanel`/`WorkspaceSurfaceManager` surfaces with the substrate-neutral `PanelOptions` type. |
| `ColorPaletteEngine` | Standalone unused experiment, but colour/CVD accessibility is genuinely relevant to representation semantics and user testing. | **RESOLVED (CMS-5, decision PR #892 + execution PR #894, 2–3 October 2026):** ABSORB-then-DELETE as decided — a dependency-free WCAG relative-luminance/contrast helper was absorbed into the canonical `src/vr/ui-system/tokens.ts` with AA-clearance pins on real rendered token pairs, then the engine, its test, the `colord` dependency and its registry entry were deleted; the CVD simulation was deliberately unreplaced (decision record `docs/review-plans/CMS5_PALETTE_CVD_DECISION_2026-10-02.md`). |
| `SpatialAudioSynthesizer` | Implemented and tested but not production-composed. Sonification has renewed product relevance as a possible representation channel. | **RESOLVED (FM3-PERCEPT, ARCHIVE, 3 October 2026 — audit record `docs/review-plans/FM3_PERCEPT_SPATIAL_AUDIO_AUDIT_2026-10-03.md`):** the synthesizer, `SpatialAudioNarrator` and the zero-importer `vr/audio` barrel are deleted with their 2 fixture test suites (6 its, all dies-with-surface incl. 5 `expect(not.toThrow())`/constructor-default vacuities); no user evidence existed and the hand-set unprovenanced mappings are exactly what a governed sonification must regenerate. The live `SelectionFeedback` path is untouched. A future FM3 sonification lane inherits nothing and must pin the audit §6 contract (listener-frame authority, authored-position encoding, versioned mappings with provenance, no fabricated certainty, gesture-gated AudioContext lifecycle). |
| `MultimodalPerceptionEngine` | Explicitly development-only; its gaze + gesture + voice fusion maps directly to future multimodal/NIL ambitions. | **RESOLVED (CMS-6, decision PR #893 + execution PR #896, 2–3 October 2026): ARCHIVE** — the heuristic engine (`MultimodalPerceptionEnvelope`) and `GeometricGestureRecognizer` are deleted (audit record `docs/review-plans/CMS6_MULTIMODAL_PERCEPTION_AUDIT_2026-10-02.md`); the future FM5 perception surface is governed, inheriting only the documented typed cue contracts C1–C5, never the heuristic confidence thresholds. |
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

# Nemosyne Publication Roadmap

**Status:** planning document.  
**Tracking:** #648.  
**Principle:** papers are derived from demonstrated research contributions, not from the number of implemented features.

## 1. Programme strategy

Nemosyne spans immersive analytics, visualization/visual analytics, HCI/XR, intelligent user interfaces, scientific computing, reproducibility and human-AI scientific discovery. Trying to publish the whole system as one enormous paper would blur the research questions and make evidence requirements unmanageable.

The publication programme therefore separates the work into a sequence of papers, each with:

- one primary research question;
- a bounded contribution bundle;
- an explicit evidence threshold;
- a related-work community that can fairly review it;
- a statement of what the paper does **not** claim.

Paper 1 establishes the intellectual framework. Later papers test the framework's technical and empirical propositions.

## 2. Paper sequence

### P0 — Nemosyne core principles and research agenda

**Working title:** *Nemosyne: Principles for Spatial, Reproducible, Human-Governed Scientific Discovery*

**Primary question:** What architectural and interaction principles are required for an immersive analytical environment to support adaptive spatial representation while preserving scientific authority, human judgement and reproducibility?

**Contribution type:** exploratory system/vision/design-principles paper with implemented prototype evidence.

**Current readiness:** high enough to draft now. Nemosyne has substantial architecture, representation, provenance, interaction and replay machinery, but does not yet have the human-outcome evidence required to claim improved scientific discovery.

**Required before submission:**

- focused related-work review;
- stable system snapshot/release identifier;
- architecture diagrams generated from current contracts rather than obsolete documents;
- 2–4 bounded worked examples using known-answer/public datasets;
- claim/evidence matrix;
- screenshots/video from the real product path;
- limitations and non-claims;
- explicit AI-assisted-development disclosure aligned with venue policy.

**Candidate venues:** IEEE VIS (preferred full/vision/systems framing when the 2027 call is available); CHI for a design/HCI framing if the paper develops a sufficiently strong HCI contribution; workshops/position venues for early feedback where this does not compromise later archival originality.

### P1 — Truthful dataset-level semantic embodiment

**Working title:** *From Analytical Evidence to Spatial Representation: Authority-Preserving Dataset-Level Embodiment for Immersive Analytics*

**Primary question:** Can an immersive analytics architecture render dataset-level structures through bounded semantic representation payloads without treating observations as the universal geometry substrate or moving analytical authority into the presentation layer?

**Potential contributions:**

- analytical-authority boundary between Rust/WASM evidence and presentation;
- typed/versioned semantic embodiment payloads;
- distribution, density, aggregate, cluster and source-authoritative graph families;
- progressive disclosure from dataset structure to exact observation;
- refusal/fail-closed contracts when a representation cannot truthfully be produced;
- resource bounds independent of raw source N for bounded families.

**Evidence required:** known-answer and metamorphic correctness; reference-method comparisons; end-to-end candidate→payload→artifact provenance; scale/resource measurements; visual examples; comparison against the prior point-first/row-first architecture.

**Likely venue family:** IEEE VIS/TVCG; EuroVis; immersive-analytics workshops as pre-paper feedback.

### P2 — Moneta: abstention-aware representation intelligence

**Working title:** *Moneta: Evidence-Constrained and Abstention-Aware Representation Recommendation for Immersive Analysis*

**Primary question:** Can representation recommendation use analytical evidence, preservation constraints, task/context and perceptual fitness while refusing unsupported choices and remaining inspectable?

**Potential contributions:**

- hard feasibility constraints before preference scoring;
- typed NIL/abstention and near-miss explanation;
- explicit information-loss/preservation contracts;
- measurement-aware evidence rather than storage-type heuristics;
- perceptual fitness tied to the actual spatial embodiment;
- stability under perturbation as evidence separate from probabilistic confidence;
- provenance of candidate, model, evidence and rejected alternatives.

**Baselines/related systems to consider:** heuristic recommendation; Draco/Draco 2 constraint modelling; VizML-style learned recommendation where methodologically appropriate; ablations of evidence classes.

**Evidence required:** held-out datasets/tasks/users as appropriate; known-answer cases; perturbation/stability testing; calibration of any probabilistic outputs; abstention utility/error analysis; human/expert judgement if claims extend beyond computational consistency.

**Likely venue family:** IEEE VIS/TVCG; ACM IUI; CHI if the main contribution becomes mixed-initiative human-AI interaction.

### P3 — Memory Palace and reproducible spatial investigation

**Working title:** *A Spatial Investigation Graph for Reproducible Analytical Sensemaking*

**Primary question:** Does representing hypotheses, evidence, branches, findings and provenance as a persistent navigable investigation graph improve analytical continuity or evidential comprehension relative to conventional history/provenance interfaces?

**Potential contributions:**

- Memory Palace as graph rather than decorative spatial metaphor;
- branching/non-destructive investigation state;
- `DiscoveryEpisode` and evidence-ledger integration;
- replay and `.nemosyne` portability;
- focus+context navigation between investigation, dataset, structure and observation.

**Evidence required:** formal human study with a credible baseline; measures such as provenance comprehension, branch recovery, task resumption, reasoning recall, error detection or ability to defend a conclusion. Qualitative sensemaking evidence should complement, not replace, task outcomes.

**Likely venue family:** CHI; IEEE VIS; CSCW only if collaboration becomes central.

### P4 — Modality-independent analytical interaction

**Working title:** *One Semantic Action Language Across Desktop and XR: Modality-Independent Interaction for Reproducible Immersive Analytics*

**Primary question:** Can controller, hand, direct-touch, ray and desktop interactions share one semantic intent layer without losing usability while improving replay/accessibility/research-treatment equivalence?

**Potential contributions:**

- `physical input -> perception -> InteractionIntent -> NIL -> semantic operation`;
- semantic parity across input modes;
- deterministic/replayable intent representation;
- ambiguity/refusal handling;
- design implications for adaptive gesture recognition.

**Evidence required:** physical-device studies; cross-modality task equivalence; error/recovery analysis; latency/comfort evidence; accessibility implications where claimed.

**Likely venue family:** CHI; IEEE VR; ACM IUI for intelligent/adaptive interaction.

### P5 — Governed gesture learning

**Working title:** *Learning XR Analytical Gestures Without Losing Experimental Control*

**Primary question:** Can an adaptive gesture recognizer improve natural analytical interaction while maintaining consent, user-disjoint evaluation, model lineage, rollback and frozen Research Mode?

**Potential contributions:** purpose-bound gesture data governance; label provenance; immutable user-disjoint training snapshots; shadow/canary promotion; freezeable model identity; relation between intent semantics and learned perception.

**Evidence required:** participant dataset; strict user-disjoint train/validation/test partitioning; per-gesture and abstention metrics; calibration/error analysis; device diversity; comparison with rule/baseline recognizers; human usability evaluation after offline model quality is established.

**Likely venue family:** IEEE VR; CHI; ACM IUI.

### P6 — Compositional Moneta / RepresentationGraph

**Working title:** *Beyond Visualization Selection: Bounded Search over Compositional Spatial Representation Hypotheses*

**Primary question:** Can Moneta construct and search a governed graph of compositional spatial representations rather than selecting a single member of a fixed candidate catalogue?

**Potential contributions:** versioned `RepresentationOntology`; representation primitives and valid compositions; `RepresentationGraph` search; hard information-preservation/scientific constraints; learned priors; inspectable alternatives; search budgets/abstention; human judgement loop.

**Prerequisites:** PT9 learned-Moneta evidence; stable single-representation semantics; sufficient judgement corpus; clear composition semantics; tractable bounded search.

**Evidence required:** benchmark tasks where fixed candidates are genuinely insufficient; search-quality/runtime evaluation; comparison to fixed-candidate and grammar/constraint baselines; human expert evaluation; stability and information-preservation falsifiers.

**Likely venue family:** IEEE VIS/TVCG; ACM IUI; potentially broader HCI/AI venues depending on the final method.

## 3. Candidate venue timing as of 3 September 2026

This table is planning guidance, not a commitment. Always re-check current calls and policies before submission.

| Venue | Current opportunity | Nemosyne fit |
|---|---|---|
| CHI 2027 full papers | Submission 10 Sep 2026 | The deadline is too close to recommend rushing P0 from a standing start. A mature manuscript could technically be submitted, but quality/related-work integrity should win over calendar pressure. |
| ACM IUI 2027 posters/demos | Submission 10 Nov 2026 | Potential early venue for a bounded Moneta or intelligent-interface demo/work-in-progress. Avoid publishing the central P2 contribution prematurely. |
| IEEE VR 2027 research demos | Submission 7 Dec 2026 | Good opportunity to demonstrate Nemosyne's XR investigation workflow and gather community feedback; the 2027 full-paper deadline has already passed. |
| CHI 2027 posters / interactive demos | Submission 21 Jan 2027 | Possible exploratory dissemination of a bounded interface contribution, subject to overlap/originality strategy. |
| IEEE VIS 2027 | Call/deadlines not yet relied upon here | Preferred target family for P0/P1/P2/P6. Plan literature, evidence and manuscript work early rather than waiting for the CFP. |

## 4. Recommended order from current engineering state

```text
now
  -> research provenance + Paper 0 draft
  -> deep PT5 UX/product convergence
  -> PT6-PT8 gesture-learning evidence
  -> P0 submission when literature + prototype evidence are clean
  -> P1 semantic embodiment paper from already-maturing representation evidence
  -> PT9 learned Moneta
  -> P2 Moneta paper
  -> private-preview / formal human studies
  -> P3/P4/P5 empirical papers
  -> P2 RepresentationGraph implementation
  -> P6 compositional Moneta paper
```

The numbering of papers and product-transition phases intentionally differ. A paper is released when its research question is ready, not merely when a product milestone number is reached.

## 5. Publication boundaries and anti-salami rule

Different papers may use the same Nemosyne prototype, but each must have a genuinely distinct research question and contribution. Avoid slicing one empirical study into multiple minimally different papers.

Examples of acceptable separation:

- P1 asks about **scientific/architectural representation fidelity**;
- P2 asks about **recommendation reasoning and abstention**;
- P3 asks about **human reasoning/provenance outcomes**.

Examples of unacceptable separation:

- one paper per representation family with the same method/evaluation;
- separate papers for desktop and XR versions of the same NIL contribution without a distinct research question;
- publishing an exploratory result, then presenting the same evidence as new confirmatory evidence without clear disclosure.

## 6. Research artefact plan

For each archival paper preserve:

- tagged repository snapshot or immutable commit;
- exact `nemosyne-data` revision and any private corpus governance record;
- environment/runtime/kernel/model versions;
- study protocol and consent/ethics documentation where applicable;
- raw or appropriately governed study data;
- analysis scripts/notebooks with locked dependencies;
- figures generated from reproducible data where possible;
- claim ledger linking results to manuscript statements;
- negative/null results relevant to interpretation;
- artifact README sufficient for an external researcher to understand the evidence boundary.

## 7. First action

Draft P0 now. Its job is to make the research programme legible to academics and to expose its hypotheses to criticism. It should be **interesting even if later experiments falsify some of Nemosyne's assumptions**. That is a stronger academic foundation than writing a paper whose narrative requires the product to succeed.

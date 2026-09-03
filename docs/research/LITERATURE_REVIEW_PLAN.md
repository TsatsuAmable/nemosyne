# Literature Review Plan

**Status:** active research backlog for Paper 01 and later papers.  
**Tracking:** #648.

## Purpose

Nemosyne has accumulated a coherent internal theory through engineering, adversarial review and design iteration. Academic publication now requires the reverse operation: test that theory against the literature before calling any part of it novel.

The review should therefore answer three questions for every candidate contribution:

1. **Prior art:** Who has already proposed or implemented substantially the same idea?
2. **Difference:** If Nemosyne differs, is the difference intellectually meaningful or merely implementation detail?
3. **Evidence:** What evaluation standard does the field use for this kind of claim?

## Review method

For Paper 01, use a structured narrative review rather than pretending to conduct a systematic review unless a systematic protocol is actually followed.

For each theme:

- start from seed papers in `references.bib`;
- follow backward references to foundational work;
- follow forward citations and recent venue proceedings;
- record systems that are closest to Nemosyne, not only papers that support Nemosyne's assumptions;
- actively search for work that would **invalidate novelty claims**;
- distinguish peer-reviewed publications from preprints, product blogs and design examples;
- record evaluation methods and negative findings, not only proposed systems;
- maintain a short synthesis explaining the relationship to Nemosyne.

## Theme A — Immersive analytics foundations

### Seed work

- Dwyer et al. (2018), *Immersive Analytics: An Introduction*.
- Skarbez et al. (2019), *Immersive Analytics: Theory and Research Agenda*.
- DashSpace (Borowski et al., 2025).
- current IEEE VIS / IEEE VR immersive-analytics work.

### Questions

- What definitions of immersion and immersive analytics are currently accepted or contested?
- Under what tasks has 3D/XR shown benefits, parity or disadvantages compared with 2D/desktop?
- What known problems exist around depth perception, occlusion, navigation, scale, collaboration, fatigue and orientation?
- How have researchers evaluated *insight*, *sensemaking* and *knowledge generation* without turning them into vague outcome measures?
- Which systems already persist spatial analytical workspaces or investigation state?

### Nemosyne novelty risk

High if Paper 01 merely claims "VR can help people explore data". That is established territory. The paper needs a sharper thesis around scientific authority, representation hypotheses, provenance and adaptive/freezeable reasoning.

## Theme B — Visual analytics, sensemaking and semantic interaction

### Seed work

- Endert, Fiaux & North (2012), *Semantic Interaction for Visual Text Analytics*.
- Endert et al. work on semantic interaction and human-in-the-loop visual analytics.

### Questions

- How do visual analytics systems model analyst intent, analytical provenance and model steering?
- What is already known about direct manipulation as an expression of analytical reasoning?
- Which systems infer latent intent from interaction histories?
- How are ambiguity, undo, branching and correction handled?
- Does Nemosyne's NIL genuinely add a new abstraction, or is it primarily a software-architecture application of established semantic-interaction ideas?

### Nemosyne novelty risk

Potentially high. `InteractionIntent -> NIL` may be valuable engineering without being a new research concept. Paper 01 should present it as part of a broader integrated framework unless literature review identifies a sharper contribution.

## Theme C — Visualization grammars and automated design

### Seed work

- Vega-Lite (Satyanarayan et al., 2017).
- Draco (Moritz et al., 2019).
- Draco 2 (Yang et al., 2023).
- VizML (Hu et al., 2019).

### Questions

- What design spaces/grammars already support composition?
- How do recommender systems encode hard constraints versus learned preferences?
- What is the role of data/task features, user context and perceptual evidence?
- Which systems support abstention, uncertainty or explanation?
- How do recommenders define ground truth or utility?
- What evaluation protocols prevent leakage across datasets/users/tasks?
- Which systems search over generated/compositional representations rather than select fixed templates?

### Nemosyne novelty risk

Very high for generic "AI chooses a visualization" claims. Potentially much lower for the combined problem of authoritative analytical evidence + information preservation + actual 3D embodiment fitness + explicit NIL + investigation provenance + compositional spatial hypotheses, but that combination must be demonstrated against closest prior systems.

## Theme D — Visualization recommendation and perceptual effectiveness

### Questions

- What empirical perception models are used to rank visual encodings?
- How well do classic 2D graphical-perception results generalise to immersive 3D?
- What evidence exists for occlusion, depth ambiguity, viewpoint dependence and stereoscopic perception in analytical tasks?
- How should engineering priors be separated from measured perceptual evidence?
- What does "fitness" mean: speed, accuracy, insight, preference, cognitive load, task success or something else?

### Nemosyne implication

This review should shape P2/Moneta evaluation and may force narrower terminology in Paper 01.

## Theme E — Provenance, analytic trails and reproducible interactive analysis

### Questions

- What models exist for analytic provenance, history, branching and replay?
- Which visualization systems capture provenance automatically from interaction?
- How are computational notebooks, workflow systems and visual analytics histories compared?
- What does reproducibility mean when the system includes adaptive models and interactive spatial state?
- Which existing formats preserve complete analytical sessions or investigation graphs?
- Has spatial organisation of provenance/history been empirically evaluated?

### Nemosyne novelty risk

High for generic "we save history" or "we use a graph" claims. More promising questions concern coupling evidence, model/representation identity, branching hypotheses and freezeable adaptive state into one portable investigation artifact.

## Theme F — Human-AI collaboration and mixed-initiative analytics

### Questions

- How should an AI system propose analytical actions while preserving user agency?
- What is known about automation bias, over-reliance, explanation and calibrated trust in analytical recommenders?
- How are rejected alternatives surfaced?
- What interaction designs support challenge, override and falsification?
- How should systems learn from user judgement without treating behaviour as unquestionable ground truth?

### Nemosyne implication

This theme is central to Moneta. It should prevent language that frames a recommendation as objective truth.

## Theme G — AI for scientific discovery and scientific reasoning tools

### Questions

- How are hypotheses, evidence and falsification represented in human-AI discovery systems?
- What systems autonomously generate hypotheses versus assist human reasoning?
- How is scientific provenance represented?
- What evaluation distinguishes plausible output from genuine discovery value?
- How are researcher degrees of freedom and post-selection effects controlled when AI suggests what to inspect?

### Nemosyne implication

Nemosyne should position itself as a human-governed representation/reasoning environment, not an autonomous scientist, unless future work deliberately changes that boundary.

## Theme H — Immersive interaction, direct touch and gestures

### Seed work

- Reski, Alissandrakis & Kerren (2024) on 3D gestural interaction for immersive data analysis.
- current IEEE VR / CHI / VIS work on direct touch, ray interaction, hand tracking and hybrid interfaces.

### Questions

- What gestures are discoverable, comfortable and robust?
- What are the known tradeoffs among direct touch, ray, controller and hand tracking?
- How should target ambiguity be resolved?
- Which evaluation metrics capture fatigue, precision, learning and accidental activation?
- What evidence supports bimanual gestures for analytical commands?

### Nemosyne implication

Use this literature to design PT5 UX evaluation and P4/P5 studies rather than treating current gestures as validated because they are implemented.

## Theme I — Memory, spatial cognition and external representations

### Questions

- What evidence supports spatial memory for locating analytical artifacts?
- What are the limits of memory-palace/method-of-loci analogies in interactive systems?
- How do persistent spatial layouts affect recall, resumption and sensemaking?
- When does spatialisation create cognitive overhead instead?

### Nemosyne novelty risk

The phrase "Memory Palace" is evocative but cannot carry an academic claim by metaphor. P3 must connect the graph/provenance mechanism to actual spatial-cognition literature and test whether the spatial organisation helps.

## Theme J — Reproducible adaptive systems / research infrastructure

### Questions

- How do adaptive interfaces preserve experimental treatment identity?
- What best practices exist for versioning datasets, models, seeds and runtime environments?
- How are model registries and rollout systems represented in HCI research artifacts?
- What reporting standards apply to interactive ML systems?

### Nemosyne implication

The Product Mode / Research Mode distinction may be a valuable integrative principle even if each underlying technique is established separately.

## Output format for each reviewed paper

Record at least:

```text
Citation:
Research question:
Method / system:
Evidence:
Key finding:
Limitations:
Relationship to Nemosyne:
  - supports/contextualises:
  - overlaps with:
  - differs from:
  - threatens novelty of:
Paper(s) affected:
Follow-up references:
```

Do not use AI-generated summaries as the final scholarly record without checking the actual source.

## Stop condition for Paper 01 literature review

The review is sufficient to draft novelty claims when:

- every proposed Paper 01 contribution has at least one closest-prior-work comparison;
- major immersive analytics, visual analytics, representation recommendation and provenance lineages are represented;
- at least several papers that challenge Nemosyne's assumptions are included;
- we can identify which principles are likely novel synthesis, which are established best practice, and which are implementation choices;
- the bibliography no longer grows primarily because obvious foundational works were missed.

This is a pragmatic saturation criterion, not a claim of systematic-review completeness.

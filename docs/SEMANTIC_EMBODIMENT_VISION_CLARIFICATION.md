# Nemosyne Vision Clarification — Semantic Embodiment and Moneta Forma

**Status:** clarification of the existing vision, not a replacement  
**Date:** 3 October 2026  
**Governing vision:** [`Nemosyne_Definitive_Vision_and_Roadmap.md`](Nemosyne_Definitive_Vision_and_Roadmap.md)  
**Live execution authority:** [`ROADMAP.md`](ROADMAP.md)  
**Detailed dataset-first architecture:** [`architecture/MONETA_DATASET_FIRST_SEMANTIC_EMBODIMENT.md`](architecture/MONETA_DATASET_FIRST_SEMANTIC_EMBODIMENT.md)
**Full implementation architecture:** [`architecture/FULL_MONETA_SEMANTIC_EMBODIMENT_ARCHITECTURE_PLAN.md`](architecture/FULL_MONETA_SEMANTIC_EMBODIMENT_ARCHITECTURE_PLAN.md)

This note clarifies how Nemosyne turns abstract datasets into human-accessible perceptual structures. It does not create a new analytical authority, relax evidence gates, or require a new runtime subsystem.

## 1. Vision

The target is not simply:

```text
value -> mark
```

The target is:

```text
dataset semantics -> perceptually accessible world
```

A useful representation should make important properties of the dataset easier to perceive, remember, interrogate and manipulate. Three-dimensional geometry is one channel among several, not the end goal.

Nemosyne should therefore be understood as an instrument for **giving dataset semantics a body**.

## 2. Moneta Forma: semantic-to-perceptual compiler

**Moneta Forma** names the responsibility for translating governed dataset semantics into human-accessible perceptual form. It is a conceptual role spanning existing Moneta representation contracts and spatial embodiment machinery; the name does not by itself mandate another authority or code subsystem.

The transformation is:

1. **Semantic model** — identify structure such as magnitude, similarity, hierarchy, causality, flow, periodicity, uncertainty, state change, provenance and agency.
2. **Candidate embodiment** — map those semantics onto perceptual channels such as position, distance, scale, containment, motion, force, texture, colour, sound, rhythm, direction and persistence.
3. **Composition** — combine mappings into a coherent metaphor or environment rather than treating every record as an isolated glyph.
4. **Interaction** — make manipulation semantically meaningful. Touching, moving, separating, filtering or following should correspond to analytical operations.
5. **Explanation** — preserve reversibility. Forma should be able to explain why an object is here, large, unstable, moving, connected or sounding as it does.

The existing `SemanticEmbodimentGraph`, `RepresentationGraph` and `SpatialEmbodimentPlan` remain the relevant architectural seams.

## 3. Dataset embodiment, not just data-point embodiment

A point-level visualisation asks:

> How should this record be drawn?

Dataset-level semantic embodiment asks:

> What kind of thing is this dataset, what structures dominate it, and which human senses can make those structures easier to reason about?

Individual observations remain available through deliberate refinement. They are not the default ontology.

A time series might become a trajectory. A probability distribution might become a field or landscape. A causal model might become an inspectable mechanism. Provenance might become a traversable path. Competing hypotheses might become alternatives that can be compared, perturbed and revisited.

The metaphor is successful only when its perceptual properties preserve useful semantics.

## 4. Multimodal semantic encoding

Forma should remain modality-agnostic. Geometry is only one output channel.

Semantic information may be encoded through:

- vision: position, distance, colour, scale, texture, containment and topology;
- spatial cognition: orientation, neighbourhood, navigation and persistent place;
- motion: flow, periodicity, instability, transition and agency;
- audio: pitch, rhythm, spatial location, timbre and event cues;
- interaction: resistance, manipulation, following, separation and transformation;
- haptics or other channels where hardware and evidence justify them.

Additional sensory channels are valuable only when they reduce cognitive work or expose structure that would otherwise remain difficult to perceive.

## 5. Perturbation as sensory interrogation

Perturbation is not only a backstage validation mechanism. It can expose semantics dynamically.

A researcher should be able to disturb assumptions, parameters, evidence or representation choices and perceive what:

- moves;
- breaks;
- remains stable;
- changes character;
- disappears;
- reappears under an alternative explanation.

This turns robustness, sensitivity and counterfactual structure into things that can be seen, heard and manipulated while retaining analytical provenance.

## 6. Design commitments

1. **Semantic fidelity** — perceptual properties must correspond consistently to underlying meaning.
2. **Perceptual economy** — recruit additional sensory channels only when they improve understanding or expose otherwise-hidden structure.
3. **No decorative degrees of freedom** — if something is bigger, nearer, louder, faster or more unstable, that difference should mean something.
4. **Interaction fidelity** — manipulation should correspond to a meaningful analytical or investigative operation.
5. **Explainable reversibility** — every perceptual choice must remain traceable to source data, transformations and representation decisions.
6. **Empirical fitness** — candidate embodiments must compete against simpler alternatives on comprehension, discovery, recall, calibration, error detection and task time.
7. **Truth before vividness** — an attractive metaphor that implies unsupported structure must be revised or rejected.

## 7. Research consequence

The governing research question is not simply whether 3D or VR is better than 2D.

A stronger question is:

> **Which mappings from dataset semantics to human perceptual channels produce measurable gains in understanding, discovery, recall, calibration and error detection?**

Experiments should compare conventional representations, arbitrary spatial encodings, semantically congruent embodiments and interactive/multimodal embodiments. Deliberately bad or misleading mappings are useful adversarial controls.

The aim is not to prove that embodiment always helps. It is to learn **which semantic-to-perceptual mappings help which analytical tasks, under which constraints, and when Moneta should abstain**.

## 8. Review checkpoint

This clarification should be reviewed at the FM3 Compositional Moneta STOP/CONTINUE/REVISE gate and again before FM7 representation search is promoted. Evidence from P1-MCR, multimodal experiments, perturbation studies and user/device validation should be used to preserve, revise or retire the proposed mappings.

Until then, this document is a design and research clarification, not permission to bypass current roadmap sequencing or evidence requirements.

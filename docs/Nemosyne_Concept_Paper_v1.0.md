# Nemosyne — Defining Concept Paper

**Version 1.0 — 16 August 2026**

## Abstract

Nemosyne explores whether analytical understanding can be constructed as a persistent spatial artefact. The target system combines a reproducible Rust Analytical Kernel, Atlas analytical state/guidance/provenance, Draco whole-dataset spatial embodiment, optional on-device Perception/ML for human interaction, and a persistent Memory Palace that can be replayed, branched and shared.

Nemosyne is not a 3D charting system. It is a research environment for constructing, embodying, remembering, replaying and communicating analytical understanding.

## Core proposition

For defined analytical tasks involving relationships, multidimensional structure and evolving analytical reasoning, Nemosyne can combine evidence-based analytical computation, explainable analytical guidance, whole-dataset spatial embodiment, embodied interaction and persistent analytical memory to help people discover, understand, record, replay and communicate analytical findings, without unacceptable costs in precision, workload, navigation or comfort.

## Core architecture

```text
DATASET
  ↓
  RUST ANALYTICAL KERNEL (TARGET)
  ↓
  ATLAS  — analytical state / guidance / evidence / provenance (TARGET)
  ↓
DRACO v1 — whole-dataset spatial embodiment
  ↓
  MEMORY PALACE — persistent analysis + visualization + history (TARGET)
  ↑
  PERCEPTION / ML — human gesture / intent interpretation (OPTIONAL TARGET)
```

### Rust Analytical Kernel
**Target capability, not current release status.** Deterministic, versioned statistical and analytical methods selected according to the study task and relevant peer-reviewed methodological precedent. Methods require registration, validation fixtures, diagnostics, declared tolerances, and JS/Rust conformance before being described as validated.

### Atlas
**Target capability, not current release status.** Owns analytical state, operations, analytical guidance, findings, evidence and provenance. It is not the sole owner of session or research state: the logical session composes analytical, exploration, research and presentation state, while a research ledger records accepted commands, observations, interventions, outcomes and deviations.

### Draco v1
**Current embodiment direction.** Operates toward whole-dataset representation. It answers: **How should this analytical state inhabit space?** Current Draco still includes heuristic fact extraction and renderer-oriented visual transforms; these are not Atlas analytical truth. Crystal, Plinth, Orb, Beam, Ring, Field and Zone are implementation primitives beneath this level.

### Perception / ML
**Optional future capability.** On-device human-perception layer. MediaPipe-style landmark extraction and ONNX Runtime Web could support lightweight temporal models such as CNN/LSTM pipelines. Models would produce candidate intents with confidence and provenance; they must not directly mutate authoritative analytical state. This is not a Stable Alpha requirement.

### Memory Palace
**Target persistence model.** A portable, replayable analytical artefact containing dataset identity/version, analysis state, analytical methods and parameters, Draco representation, spatial state, findings, annotations, interaction history and model/build provenance. The implementation must distinguish a session snapshot, an analysis record, and a Memory Palace bundle before claiming deterministic replay, branching, or sharing.

## Principles

1. Evidence before architecture.
2. Whole-dataset embodiment.
3. Separate computation, reasoning, embodiment and perception.
4. Treat the Memory Palace as an analytical artefact.
5. Explainable automation.
6. Semantic honesty.
7. 2D is a legitimate baseline and partner.
8. Human agency and reversibility.
9. Research observability by design.
10. Privacy by minimization.
11. Study-driven analytical methods.
12. Stable means testable, not proven.

## Feature families

- Dataset ingestion and topology/schema inference
- Rust analytical methods
- Atlas analytical guidance and provenance
- Whole-dataset Draco embodiment
- Semantic spatial encodings
- Hand/controller/desktop embodied interaction
- On-device perception and adaptive metaphors
- Precision 2D/chart handoff
- Memory Palace save/resume/replay/branch/share
- Research observation
- Study harness and canonical 2D condition
- Accessibility and comfort
- Performance qualification
- Reproducibility and provenance

## Research framing

Published work on immersive analytics and VR visualization is mixed: some studies show benefits for spatial understanding, domain-specific analysis or recall, while others show accuracy, reaction-time or usability penalties. Nemosyne therefore does not assume VR superiority. Its research questions include analytical guidance, spatial embodiment, embodied interaction, analytical memory, adaptation, and communication.

The flagship Stable Alpha comparison is limited to **2D versus VR** for the defined `Find the
Fraud` task. Desktop 3D is not a current product or study condition. Other questions require
separate studies and must not be inferred from the flagship comparison.

## Key research traditions

- Draco: constraint-based visualization design knowledge.
- Vega-Lite: declarative visualization grammar and interaction semantics.
- IATK: immersive analytics toolkit and scalable immersive visualization.
- Immersive Analytics literature: spatial interaction, immersive visualization and task-dependent evaluation.
- Memory Palace research: immersive environments can support recall, but effects depend on design and task.
- Analytic provenance: preserving the history and rationale of visual analysis supports sensemaking, collaboration and reproducibility.
- MediaPipe Hands: on-device real-time hand tracking.
- ONNX Runtime Web: in-browser WASM/WebGPU inference.

## Known limitations

- The usefulness or superiority of spatial embodiment is unproven.
- Spatial layouts can create misleading semantic inference if meanings are not explicit.
- VR introduces navigation, comfort and precision costs.
- Gesture and intent models can misclassify human behaviour.
- Statistical method choice requires task- and literature-specific justification.
- Replay depends on versioned datasets, models, algorithms and rendering behavior.
- Study instrumentation creates privacy and governance responsibilities.
- Browser and device variability constrains the tested envelope.

## Current Gaps and Risks

The following are known gaps between this concept and the current project. They are not implied
to be implemented by the concept paper:

- **Atlas gap:** DatasetSpace, analytical recommendations, provenance-bearing structures, and
  reproducible analytical sessions are not yet implemented.
- **Rust gap:** Rust/WASM execution infrastructure exists, but a registered, independently
  validated analytical kernel with JS/Rust conformance is not complete.
- **Persistence gap:** Current session persistence is not yet a complete analysis record or
  deterministic Memory Palace replay bundle.
- **Research gap:** Stable Alpha still requires study-harness, observer-role, authorization,
  accessibility, recovery, Quest, and 2D-control qualification.
- **Perception gap:** MediaPipe/ONNX and learned intent models are optional future work, not a
  Stable Alpha dependency.
- **Evidence gap:** Current heuristic analytics and visual separation do not establish analytical
  validity, user benefit, or VR superiority.

Principal risks:

1. **Scope inflation:** Treating every target capability as a release commitment could delay the
   defined research instrument.
2. **Authority confusion:** Allowing Atlas, the renderer, the Memory Palace, or the research
   ledger to become competing sources of truth could make replay and provenance unreliable.
3. **Semantic overclaiming:** Users may infer that spatial proximity means similarity or that a
   Draco visual recommendation is analytical evidence.
4. **Study contamination:** Unqualified changes to methods, interaction models, accessibility,
   or observer permissions could confound the 2D-versus-VR comparison.
5. **ML variability:** Learned perception may introduce device, calibration, privacy, and
   accessibility differences that are mistaken for analytical or VR effects.
6. **Reproducibility failure:** Dataset, method, model, renderer, or version drift may prevent a
   saved investigation from being reconstructed.

## Stable release definition

Stable Alpha is the smallest reliable research instrument capable of running the defined
2D-versus-VR `Find the Fraud` study with shared task/data semantics, participant and observer
roles, accessibility, recovery, save/resume, precision handoff, and replayable trial records. It
does not require proof that Nemosyne is superior to 2D, and it does not include Desktop 3D as a
study condition.

## References

1. Moritz et al., *Formalizing Visualization Design Knowledge as Constraints: Actionable and Extensible Models in Draco*, IEEE TVCG, DOI 10.1109/TVCG.2018.2865240.
2. Satyanarayan et al., *Vega-Lite: A Grammar of Interactive Graphics*, IEEE TVCG, DOI 10.1109/TVCG.2016.2599030.
3. Cordeil et al., *Immersive Analytics: Theory and Research Agenda*.
4. Kraus et al., *Immersive Analytics with Abstract 3D Visualizations: A Survey*, Computer Graphics Forum, DOI 10.1111/cgf.14430.
5. Cordeil et al., *IATK: An Immersive Analytics Toolkit*, IEEE VR 2019, DOI 10.1109/VR.2019.8797978.
6. Krokos, Plaisant & Varshney, *Virtual memory palaces: immersion aids recall*, Virtual Reality, DOI 10.1007/s10055-018-0346-3.
7. Google Research, *MediaPipe Hands: On-device Real-time Hand Tracking*, 2020.
8. ONNX Runtime Web documentation.
9. Ragan et al., *Characterizing Provenance in Visualization and Data Analysis*, IEEE TVCG, DOI 10.1109/TVCG.2015.2467551.
10. Xu et al., *Analytic Provenance for Sensemaking: A Research Agenda*, IEEE Computer Graphics and Applications, DOI 10.1109/MCG.2015.50.
11. Nguyen et al., *SensePath: Understanding the Sensemaking Process Through Analytic Provenance*, IEEE TVCG, DOI 10.1109/TVCG.2015.2467611.
12. Hurter et al., *Memory Recall for Data Visualizations in Mixed Reality, Virtual Reality, 3D and 2D*, IEEE TVCG, DOI 10.1109/TVCG.2023.3336588.
13. Jeong et al., *A comparative study of 2D vs. 3D chart visualizations in virtual reality*, Journal of Visualization, DOI 10.1007/s12650-024-01033-6.
14. Wang et al., *Understanding differences between combinations of 2D and 3D input and output devices for 3D data visualization*, IJHCS, DOI 10.1016/j.ijhcs.2022.102820.
15. TsatsuAmable/nemosyne repository, current main, 16 August 2026: https://github.com/TsatsuAmable/nemosyne

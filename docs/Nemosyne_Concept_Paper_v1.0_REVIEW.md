# Initial Review: Nemosyne Concept Paper v1.0

**Source:** `Nemosyne_Concept_Paper_v1.0.md`
**Review date:** 2026-08-16
**Reviewers:** Technical Architect and Product Manager agents
**Status:** Initial recommendations for deeper analysis; not an approved product decision

## Overall Assessment

The concept paper is directionally aligned with the long-term Atlas vision, but it presents the
target architecture as if several Atlas and research capabilities already exist. Its primary
problem is release-scope conflation. The paper should become a staged concept document that
clearly separates:

1. Current Draco/WebXR implementation.
2. Stable Alpha as a narrow research instrument.
3. Atlas Research Release as the longer-term analytical-memory architecture.

## Severity-Ranked Findings

### Resolved: Stable release definition

The concept paper now defines Stable Alpha as the smallest reliable research instrument for the
2D-versus-VR `Find the Fraud` study. Desktop 3D has been removed as a current product or study
condition. It remains historical context only and would require a separate product and protocol
decision to return.

### P0: Target architecture is presented as implemented

The abstract and architecture diagram describe the Rust Analytical Kernel, Atlas,
Perception/ML, and replayable Memory Palace as integrated capabilities. Current status is more
limited:

- Draco v1 is implemented.
- Rust/WASM execution infrastructure exists, but the reproducible analytical kernel is not
  complete.
- Atlas, DatasetSpace, analytical provenance, and reproducible research sessions are proposed.
- Current analytics include heuristic and lightweight JS methods.

**Recommendation:** Label each major component as `implemented`, `planned`, `proposed`, or
`research target`.

### P1: Atlas is assigned too much authority

The paper describes Atlas as the authoritative record of what the analyst did and why. This
conflates analytical state, logical session state, research events, and presentation state.

**Recommendation:** Use this boundary:

> Atlas owns analytical state, evidence, provenance, and recommendation decisions. The logical
> session composes analytical, exploration, research, and presentation state. The research ledger
> records accepted commands, observations, interventions, outcomes, and deviations.

### P1: DatasetSpace is missing from the architecture

The paper currently shows:

```text
Dataset -> Rust -> Atlas -> Draco -> Memory Palace
```

The approved architecture requires:

```text
Dataset
  -> analytical providers
  -> DatasetSpace and provenance
  -> Atlas
  -> Draco
  -> 2D/WebXR outputs
  -> research ledger and Memory Palace
```

**Recommendation:** Add DatasetSpace, stable datum IDs, spatial provenance, the canonical 2D
precision view, and the research ledger to the architecture diagram.

### P1: Memory Palace persistence semantics are underspecified

The paper describes one portable artefact containing analysis, representation, spatial state,
findings, history, and provenance, with replay, branching, and sharing. It does not define source
of truth, version compatibility, branch semantics, merge rules, permissions, or replay behavior
when rendering changes.

**Recommendation:** Separate:

1. **Session snapshot:** local working and presentation state.
2. **Analysis record:** dataset, transformations, methods, findings, evidence, and provenance.
3. **Memory Palace bundle:** reconstructible spatial and presentation view over the analysis record.

For Stable Alpha, limit this to save/resume and replayable study records. Defer branching,
sharing, and general collaboration.

### P1: The Rust Analytical Kernel is overstated

The paper presents a reproducible Rust statistical kernel as an existing subsystem. Rust/WASM
data and operation infrastructure exists, but method registration, independent validation,
diagnostics, JS/Rust conformance, and declared tolerances remain future work.

**Recommendation:** Call it a proposed Rust Analytical Kernel until methods have method-register
entries, deterministic fixtures, independent reference comparisons, diagnostics, and declared
tolerances.

### P1: Perception/ML is an ungoverned scope addition

The proposed MediaPipe, ONNX, CNN/LSTM, confidence, and provenance layer adds model versioning,
calibration, privacy, device variability, failure handling, accessibility qualification, and
study-confound obligations. It is not required for Stable Alpha.

**Recommendation:** Move Perception/ML to a future experimental or Atlas track. Stable Alpha
should use the existing hand, controller, desktop, and dwell paths unless ML is explicitly
required by the frozen study.

### P1: Evidence language exceeds current evidence

The paper states that Nemosyne can help people discover, understand, record, replay, and
communicate analytical findings. This reads as a user-benefit claim before human validation.
Current analytics are not automatically evidence-based or confirmatory.

**Recommendation:** Reframe the claim as a research question:

> Nemosyne investigates whether a spatial analytical interface can support defined discovery and
> understanding tasks while preserving precision, workload, comfort, navigation, and
> reproducibility.

Use the evidence vocabulary:

```text
implemented
automated-tested
human-validated
demonstrated useful
demonstrated superior
```

### P2: Draco v1 is described more abstractly than the implementation supports

The paper describes Draco as a whole-dataset analytical representation engine. Current Draco
also contains heuristic fact extraction, visual-rule selection, row-level operations, renderer
transforms, and layout generation.

**Recommendation:** Describe Draco v1 as the current spatial embodiment engine. Mark heuristic
fact extraction and visual transforms as transitional. Atlas analytical truth must not be
inferred from current Draco facts.

### P2: Research framing is broader than the current study

The paper lists analytical guidance, spatial embodiment, embodied interaction, analytical memory,
adaptation, and communication as research questions. The current study package supports a
narrower 2D-versus-VR comparison for the defined fraud-detection task.

**Recommendation:** Separate the flagship study from future studies of Atlas guidance,
memory/replay, communication, adaptation, and component-level effects. The current protocol does
not support causal claims about individual Atlas methods, layouts, embeddings, or recommendations.

### P2: Users and value are not differentiated

The paper refers to people and analysts without distinguishing participants, researchers,
analysts, recipients, and future collaborators.

**Recommendation:** Add a users-and-value section:

- **Stable Alpha participant:** completes the defined fraud-detection task.
- **Operational researcher:** runs, observes, and reviews trials.
- **Future Atlas analyst:** constructs and revisits reproducible analyses.
- **Value measures:** accuracy, time, confidence, workload, navigation, comfort, and record
  fidelity.

### P2: Governance references are missing

The paper mentions privacy, observability, and reproducibility without identifying the governing
documents.

**Recommendation:** Reference:

- `docs/ROADMAP.md` for implementation status.
- `docs/PRODUCT_ARCHITECTURE_AND_GOVERNANCE.md` for architecture and release policy.
- `docs/study/` for protocol, consent, data dictionary, and analysis governance.
- `docs/STATISTICAL_METHOD_REGISTER.md` for analytical method admission.

## Key Deltas

| Concept paper position | Current project direction |
| --- | --- |
| Full analytical environment | Current product is primarily an experimental Draco/WebXR runtime |
| Atlas is present architecture | Atlas is a staged target and migration boundary |
| Memory Palace is a complete analytical artefact | Persistence must separate session, analysis record, and palace bundle |
| Stable includes 2D, desktop 3D, and VR | Stable Alpha is 2D versus VR only |
| Broad analytical understanding and communication | Stable Alpha supports one defined research task |
| Perception/ML is a core layer | ML is not Stable Alpha scope |
| Replay, branching, and sharing are central | Save/resume and bounded replay first; collaboration deferred |
| Evidence-based guidance | Current analytics are exploratory/heuristic until registered and validated |
| “Help people” language | Current evidence supports hypotheses and operational readiness only |

## Recommended Revision Order

1. Correct Stable Alpha to 2D versus VR.
2. Add explicit current-state and target-state labels.
3. Replace the architecture diagram with the DatasetSpace-based pipeline.
4. Separate logical session, Atlas, research ledger, and Memory Palace responsibilities.
5. Split Stable Alpha and Atlas Research Release propositions.
6. Add users, jobs, and measurable value.
7. Move Perception/ML, branching, sharing, broad connectors, and general collaboration to future scope.
8. Reframe benefit statements as hypotheses rather than established outcomes.
9. Add governance references and evidence-level language.
10. Clarify that current Draco analytics are exploratory unless method-register and validation
    evidence exists.

## Reviewer Conclusion

The concept paper is a strong long-term statement of the Atlas vision. It should be revised from
a unified current-system description into a staged product and research architecture paper. The
primary correction is strict separation between current Draco, Stable Alpha, and the future Atlas
Research Release.

## Additional Insights From Public-Positioning Explainer

The accompanying explainer strengthens the public product story. Its central framing should be
retained as a candidate canonical narrative, subject to the implementation and release caveats
below:

> **Atlas understands the analysis. Draco embodies the dataset. The Memory Palace remembers the
> work.**

This is a clearer public proposition than presenting Nemosyne primarily as a system that maps
data into 3D memory palaces. It gives each major component a memorable responsibility and makes
the analytical-memory thesis visible immediately.

### Product-positioning insights to adopt

#### 1. Lead with analytical worlds, not VR visualization

The strongest public framing is:

> Nemosyne is an experimental spatial analytics environment for discovering, understanding,
> recording, and replaying complex data analysis.

The site should present VR/WebXR as one embodiment and research condition, not the complete
product identity.

#### 2. Make the analytical loop explicit

The proposed loop is useful for product and UX communication:

```text
Question -> Explore -> Inspect -> Compare -> Explain -> Capture -> Find -> Remember
```

This supports the roadmap's task-first Stable Alpha direction and is more meaningful than a
feature catalogue of gestures, menus, artefacts, and rendering techniques.

#### 3. Explain the distinction between finding, analysis, and palace

The three communication levels are valuable:

- **Finding:** what was discovered.
- **Analysis:** how it was discovered.
- **Memory Palace:** the analytical world in which it was discovered.

This should inform future export, replay, and sharing requirements, but must not be presented as
fully implemented until the corresponding analysis-record and replay contracts exist.

#### 4. Make spatial semantics a first-class public idea

The distinction between semantic space, structural space, and layout space is one of the most
important conceptual safeguards in the explainer. It directly addresses the risk that users infer
meaning from proximity when a layout is merely navigational.

This should become a formal representation contract and an explanation affordance, not only
website copy.

#### 5. Present representations as hypotheses, not truth

The proposed “Why this view?” explanation is a strong product pattern. A representation should
expose the facts, structures, constraints, evidence level, and limitations behind its selection.

This aligns with Atlas recommendation requirements, provided current heuristic Draco facts are
not described as validated analytical evidence.

#### 6. Emphasize the whole dataset without erasing the datum level

“The whole dataset is the primary visualization object” is a useful differentiator. It should be
qualified architecturally:

- Dataset-level representation is the primary analytical context.
- Individual datum IDs remain necessary for selection, evidence, inspection, and provenance.
- Artefacts are visual primitives, not analytical meaning.

This avoids replacing the current row-level implementation with an ambiguous claim that
individual records are unimportant.

#### 7. Use the compact model as the public mnemonic

The explainer's five-part model is effective for public communication:

```text
Compute -> Reason -> Embody -> Remember -> Understand the human
```

The shorter public version can be:

> **Compute. Reason. Embody. Remember.**

The full architecture and governance documents should retain the more precise boundaries around
research state, perception, and rendering.

### Public-copy cautions

#### Desktop 3D is excluded from the current direction

Desktop 3D has been removed from the concept paper's current study framing. It must remain absent
from current site, study protocol, and Stable Alpha messaging unless explicitly re-approved
through product and study governance.

#### Avoid presenting future capabilities as current

Phrases such as “can be saved, resumed, replayed, branched, shared, and explained” should be
split by status:

- **Current:** session save/restore, analytical history, screenshots, and existing export paths.
- **Stable Alpha target:** reliable save/resume, precision handoff, and replayable trial records.
- **Atlas target:** portable analysis records, deterministic replay, branching, and sharing.

#### Keep Perception separate from analytical intelligence

The explainer's `Perception` layer is a useful conceptual separation, but MediaPipe/ONNX/CNN/LSTM
capabilities are not Stable Alpha commitments. Public copy should describe them as an optional
future on-device interaction direction, not as a current core subsystem.

#### Avoid universal “whole-dataset” promises

The public story can say Nemosyne is designed around whole-dataset embodiment. It should not imply
that every dataset, task, topology, or method is already supported with meaningful spatial
semantics.

#### Keep “evidence” qualified

“Evidence” should mean a provenance-bearing result with a declared method and evidence status.
Current heuristic analytics should be described as exploratory or analytical aids, not as
validated evidence.

## Proposed Public Narrative

The following is a candidate public-facing direction, not a claim about current implementation:

### Hero

> # Enter the analysis.
>
> Nemosyne transforms complex datasets into spatial analytical worlds you can explore,
> investigate, and remember.
>
> **Atlas** reasons about the analysis. **Draco** embodies the dataset. **The Memory Palace**
> preserves the investigation.
>
> Explore relationships. Find patterns. Record evidence. Return to the reasoning.

Suggested secondary line:

> **Not another 3D chart. A persistent analytical world.**

### Homepage information architecture

- **Concept:** what Nemosyne is and why it exists.
- **How it works:** Atlas, Draco, Memory Palace, and optional Perception.
- **Explore:** interactive datasets and current representations.
- **Research:** hypotheses, experiments, evidence, and references.
- **Architecture:** technical boundaries and implementation status.
- **Repository:** source and development information.

Primary call to action:

> **Explore a Dataset**

Secondary call to action:

> **Understand the Research**

### Public claim boundary

Public copy should distinguish three statements:

1. **Vision:** an analysis can become an enterable, persistent, replayable object.
2. **Current product:** Nemosyne is an experimental Draco/WebXR runtime exploring that vision.
3. **Research target:** the project will test when spatial analytical environments create human
   value and when conventional representations are better.

## Additional Revision Actions

1. Adopt “Atlas understands, Draco embodies, Memory Palace remembers” as the candidate product
   mnemonic.
2. Reframe the website around analytical worlds, task loops, provenance, and analytical memory.
3. Add semantic/structural/layout space to the formal architecture and representation contracts.
4. Define a “Why this view?” explanation object for future Atlas recommendations.
5. Preserve the finding/analysis/palace distinction in export and replay design.
6. Audit every public capability claim against current implementation, Stable Alpha, or Atlas
   target status.
7. Remove Desktop 3D from current public study language.
8. Keep Perception/ML visibly optional and future-scoped.
9. Add a public “Current status and research limits” section so the stronger narrative does not
   become an overclaim about validation or production readiness.

## Governing Documents

- [`PRODUCT_ARCHITECTURE_AND_GOVERNANCE.md`](PRODUCT_ARCHITECTURE_AND_GOVERNANCE.md)
- [`ROADMAP.md`](ROADMAP.md)
- [`STATISTICAL_METHOD_REGISTER.md`](STATISTICAL_METHOD_REGISTER.md)
- [`study/README.md`](study/README.md)

# Nemosyne Product Architecture and Governance

**Status:** Canonical direction, approved for planning
**Updated:** 2026-08-16
**Authority:** This document defines product direction, architecture boundaries, release
governance, and documentation policy. `docs/ROADMAP.md` remains authoritative for
implementation status. `docs/study/` remains authoritative for study design and operations.

## Executive Decision

Nemosyne is pivoting from a primarily spatial visualization system toward a system for
constructing, embodying, remembering, replaying, and communicating analytical understanding.

The target architecture is:

```text
Dataset
  -> analytical providers
  -> DatasetSpace and provenance
  -> Atlas analytical state and guidance
  -> Draco spatial embodiment
  -> renderer and WebXR interaction
  -> analysis record and memory palace
  -> replay, precision handoff, and sharing
```

This is a staged architectural direction, not a claim that the target exists today. Current
status is recorded in `docs/ROADMAP.md`.

The release decision is deliberately split:

1. **Stable Alpha** is the smallest reliable research instrument for the defined 2D-versus-VR
   study. It includes **Atlas Core**: stable dataset/datum identity, one deterministic
   provenance-bearing analytical provider, a renderer-independent DatasetSpace, and inspectable,
   rejectable, overrideable guidance. It also requires trustworthy observation, replayable trial
   records, and a canonical 2D control. It does not require the complete Atlas analytical engine.
2. **Atlas Research Release** is the later capability release that expands Atlas Core into a
   complete renderer-independent analytical loop from computation through richer guidance,
   embodiment, memory, and replay.

These releases must not be conflated. Stable Alpha makes the research question testable with a
fixed Atlas Core substrate;
neither release proves that VR, Atlas, or any visual encoding is superior.

## Product Proposition

> Nemosyne is a spatial analytical environment in which an analytical process can be
> constructed, embodied, recorded as a persistent memory palace, replayed, inspected, and
> shared.

The engines have distinct responsibilities:

| Engine | Responsibility | Must not own |
| --- | --- | --- |
| Atlas | Analytical state, guidance, evidence, provenance, and recommendation decisions | Three.js objects or authoritative statistical truth from language models |
| Draco v1 | Spatial embodiment: layout, geometry, semantic marks, and interaction constraints | Dataset truth, study state, or renderer lifecycle |
| Memory Palace | Persistent view over analysis, visual, spatial, and interaction records | The authoritative source of analytical state |
| Rust analytical kernel | Deterministic, validated compute providers | Session state, permissions, or WebXR state |
| Research layer | Trials, roles, observations, interventions, outcomes, and deviations | Analytical or renderer state ownership |

### Non-goals

- General-purpose business intelligence or notebook replacement.
- A claim that VR is generally better than 2D.
- LLM-owned statistics, clustering, confidence, evidence, or recommendations.
- A complete statistics catalogue before a defined research task requires it.
- Collaborative analytical editing in Stable Alpha.
- Desktop 3D as a product or study condition.
- Command-buffer or scene-graph migration without measured performance evidence.

## Canonical Architecture

```text
                         DATASET + RESEARCH QUESTION
                                      |
                                      v
                           +----------------------+
                           | Dataset Domain       |
                           | identity, schema,    |
                           | versions, datum IDs  |
                           +----------+-----------+
                                      |
                                      v
                           +----------------------+
                           | Analytical Providers |
                           | JS fallback / Rust   |
                           | specs, results,      |
                           | diagnostics          |
                           +----------+-----------+
                                      |
                                      v
                           +----------------------+
                           | DatasetSpace         |
                           | points, structures,  |
                           | relationships,       |
                           | spatial provenance   |
                           +----------+-----------+
                                      |
                                      v
                           +----------------------+
                           | Atlas                |
                           | guidance, evidence,  |
                           | recommendation state |
                           +----------+-----------+
                                      |
                                      v
                           +----------------------+
                           | Draco v1             |
                           | EmbodimentSpec       |
                           +----------+-----------+
                                      |
                         +------------+-------------+
                         v                          v
                   2D precision view          WebXR renderer
                         |                          |
                         +------------+-------------+
                                      v
                           +----------------------+
                           | Research ledger and   |
                           | Memory Palace bundle  |
                           +----------------------+
                                      |
                              replay / share / resume
```

### Dependency direction

```text
ingress -> dataset -> analysis -> representation -> rendering -> input -> research events
```

Required rules:

- `src/data/` and analytical modules must not import Three.js, WebXR, or `World`.
- Analytical results reference stable `datumId` values, never row object identity.
- Atlas returns typed analytical recommendations, never Three.js objects or renderer callbacks.
- Draco consumes representation intent and produces embodiment specifications.
- The renderer is disposable and reconstructible; it does not calculate analytical truth.
- UI and input issue commands; they do not mutate datasets directly.
- Research logging observes accepted commands and transitions; it is not a second state owner.
- Rust handles and memory addresses are execution details and are never persisted as identity.
- Command-buffer capabilities remain independent from Atlas and require the existing
  `SCENE_RUST` and load-test gates.
- Research records require canonical serialization, immutable event IDs, ordered records, state
  and output hashes, and an explicit statement of signing or tamper-detection limits.
- Network and persistence inputs are untrusted. Schemas must bound size, depth, counts, strings,
  timestamps, finite numeric values, versions, and event ordering; invalid input fails closed.
- Research-sensitive telemetry is minimised, redacted, disabled outside approved contexts, and
  governed by consent, retention, deletion, and access policy.
- Perception/ML may propose intent only. Frozen trials record model/version/fallback/configuration
  and prohibit unregistered online adaptation.

### World composition boundary

`src/vr/World.ts` is the runtime composition root, not the owner of analytical truth or session
state. The Stable Alpha refactor must reduce it to dependency construction, lifecycle coordination,
and renderer-facing event wiring. Analytical commands, Atlas state, research events, and persistence
must move behind typed services/coordinators with explicit ownership and disposal contracts.

The refactor is complete only when a renderer can be rebuilt from logical session state, `World`
does not compute analytical facts or apply remote state directly, coordinator lifecycles are
uniform, and the 2D control can reuse the same command and Atlas substrate without importing the
WebXR world.

## Authoritative State and Contracts

The logical session is authoritative. The scene graph, IndexedDB snapshot, and WASM handles
are materialized or execution representations.

```text
NemosyneSession
  datasetVersion
  datasetFingerprint
  dataset
  analysisSpecs and results
  datasetSpace versions
  active recommendation and decision history
  exploration state
  research context and event ledger
  memory-palace presentation state
```

The first stable contracts are:

```text
AnalysisSpec
  datasetFingerprint, datasetVersion
  feature selection and roles
  normalization and missingness policy
  method, parameters, seed, algorithm version
```

```text
AnalysisResult
  resultId, datasetFingerprint, datasetVersion
  structures and metrics
  diagnostics and warnings
  provenance, implementation version, output hash
  evidence status: exploratory | validated | confirmatory
```

```text
AtlasRecommendation
  target IDs, action, rationale, evidence, confidence
  limitations, suggested embodiment
  accepted | rejected | overridden decision
```

```text
ResearchEvent
  trial/session ID, actor and role, timestamp
  command and result, dataset/space version
  recommendation decision, observation/intervention
  deviation, state hash
```

Persistence must distinguish:

- **Session state:** local working state and presentation preferences.
- **Analysis record:** portable dataset, transformations, methods, evidence, findings, and
  provenance.
- **Memory palace:** a reconstructible view over the analysis record, including spatial layout,
  annotations, camera/presentation state, and interaction history.

## Rust and Statistical Governance

Rust is the preferred authoritative compute provider for deterministic, compute-sensitive
analytical methods. Rust is not automatically a validation claim. A method is admitted only
when its research purpose, assumptions, implementation, and numerical behaviour are documented.

The method register is `docs/STATISTICAL_METHOD_REGISTER.md`. Each admitted method must have:

- a stable method ID and version;
- a defined analytical question, estimand, outcome, and unit of analysis;
- published methodological precedent where appropriate;
- input, preprocessing, missingness, and exclusion rules;
- parameters, seed, precision, tolerances, and diagnostics;
- independent reference implementation or conformance fixture;
- Rust/JS parity evidence and declared failure states;
- output and provenance hashes suitable for replay;
- sensitivity and multiplicity policy where the method is confirmatory.

The product architecture may define providers and provenance envelopes. The study package must
define the task, population, randomization/counterbalancing, estimands, outcomes, exclusions,
missing-data treatment, and inferential model before collection. Exploratory clustering,
embedding, anomaly detection, and TDA must not be presented as confirmatory evidence without a
separate validation decision.

## Research Claims and Evidence Levels

Use this vocabulary consistently:

```text
Implemented -> automated-tested -> human-validated -> demonstrated useful -> demonstrated superior
```

Stable Alpha may claim that the research instrument and study package are operational. It may
not claim:

- that VR improves discovery, accuracy, recall, or efficiency;
- that Atlas recommendations improve analysis;
- that a particular layout, encoding, embedding, or interaction caused an effect;
- that exploratory structures are causal or population-level findings;
- that the system generalizes to immersive analytics beyond the defined task.

## Release Roadmap

### Track A: Stable Alpha, research instrument

This track is governed by the active gates in `docs/ROADMAP.md` and the study package.

1. **Runtime and analytical integrity:** close known crash, corruption, lifecycle, and resource
   defects; preserve deterministic fixtures.
2. **Security and role integrity:** enforce participant/observer identity, authorization, payload
   bounds, and network safety.
3. **One analyst journey:** complete the defined task with Compare, explainability, accessibility,
   recovery, save/resume, and precision handoff.
4. **World architecture refactor:** make `World.ts` a composition root; isolate logical session,
   Atlas Core, research ledger, input commands, and renderer lifecycle behind typed boundaries with
   uniform coordinator disposal and rebuild-from-state acceptance evidence.
5. **Atlas Core substrate:** implement stable datum identity, one deterministic provenance-bearing
   provider, one renderer-independent DatasetSpace, and fixed inspectable/rejectable/overrideable
   guidance shared by both study conditions.
6. **Observation and trial recording:** correlate participant actions, researcher observations,
   interventions, outcomes, and deviations without allowing observer state mutation.
7. **Canonical 2D control and study harness:** share the same dataset/task semantics, capture
   outcomes, counterbalance conditions, and enforce the study data dictionary.
8. **Quest qualification:** measure frame time, transitions, GPU/resource behaviour, comfort,
   tracking, and accessibility on the supported hardware.
9. **Full rehearsal and release freeze:** run the frozen experiment package end to end and publish
   the evidence matrix.

### Track B: Atlas Research Release

1. **Atlas 0:** freeze Draco v1 visual-rule expansion and document its embodiment contract.
2. **Atlas 1:** introduce content-sensitive dataset identity, stable datum IDs, and DatasetSpace.
3. **Atlas 2:** convert one named analytical provider into reproducible, provenance-bearing
   structures.
4. **Atlas 3:** add deterministic Atlas guidance with inspectable, rejectable, and overrideable
   recommendations.
5. **Atlas 4:** adapt DatasetSpace and analytical targets into semantic Draco embodiment commands.
6. **Atlas 5:** persist analysis records, research context, recommendation history, observations,
   and replay bundles.
7. **Atlas 6:** bind the controlled experiment harness to the same analytical substrate and 2D
   precision handoff.
8. **Atlas 7:** consider language assistance only after deterministic analytical contracts exist.

The first Atlas exit criterion is one complete reference dataset that can be computed,
embodied, inspected, saved, and replayed without WebXR or network access, with JS/Rust outputs
within declared tolerances.

## Governance Rules

- `docs/ROADMAP.md` is the only implementation-status authority.
- `docs/study/` is the only study-protocol, compliance, and reproducibility authority.
- This document is the product architecture and governance authority; it does not mark work
  implemented.
- Every capability claim must identify its evidence level and source file/test/manual evidence.
- Any change to a frozen study package requires a documented protocol deviation.
- Any new analytical method requires a method-register entry before production use.
- Architecture changes must preserve the dependency direction and authoritative-state model.
- A release gate cannot be closed by unit tests alone where human, hardware, or study evidence is
  required.
- New features must identify which release track they serve; unclassified feature expansion is
  deferred.
- A proposal, class, benchmark, or passing unit test is not evidence that a capability is wired,
  human-validated, useful, or superior. Claims must use the evidence ladder and cite evidence.
- Changes to a frozen study's task, condition semantics, analytical provider, interaction policy,
  capture schema, or model require protocol-deviation review before collection continues.
- Stable Alpha is blocked by unresolved authorization, input-validation, privacy, provenance, or
  hardware qualification gates; tests alone cannot close these gates.
- Atlas Core is an Alpha requirement, not an optional post-Alpha boundary. Its provider, dataset
  identity, DatasetSpace version, recommendation policy, and output hashes must be frozen with the
  study package and identical across the 2D and VR analytical substrate.

## Documentation Disposition

The following disposition records the cleanup executed in this documentation realignment and
the remaining refresh work:

| Document/group | Disposition | Reason |
| --- | --- | --- |
| `docs/ROADMAP.md` | Retain as canonical | Implementation status and active work |
| This document | Retain as canonical | Product architecture, release split, governance |
| `docs/ARCHITECTURE.md` | Retain and refresh | Engineering reference; remove stale claims and point to this contract |
| `docs/ANALYTICS.md` | Retain and refresh | Current Draco analytics; clearly label heuristics vs. Atlas |
| `docs/Atlas upgrade of Draco Recommender.md` | Retain as subordinate proposal | Detailed Atlas design; it cannot redefine Stable Alpha or current Draco ownership |
| `docs/Roadmap to stable alpha release.md` | Archived | Historical gate detail competed with the canonical roadmap |
| `docs/study/*` | Retain as canonical study package | Protocol and operational authority |
| Root study duplicates in `docs/` | Archived under `docs/archive/study-drafts/` | Duplicate and conflicting study authority |
| `docs/archive/study-drafts/*` | Archived | Retired three-condition/Desktop-3D and superseded study drafts |

No document in the disposition table should be silently treated as current merely because it is
present in the repository. Archived documents are historical context only; remaining refresh work
is not an authority change.

## Immediate Decision Log

- **D-001:** Atlas is the target architecture, not a synonym for current Draco. Approved.
- **D-002:** Stable Alpha and Atlas Research Release are separate release definitions. Approved.
- **D-003:** Rust methods are study-driven and method-registered; Rust adoption alone is not
  evidence of validity. Approved.
- **D-004:** Memory Palace is a reconstructible view over a logical analysis record, not the
  persistence source of truth. Approved.
- **D-005:** Command-buffer migration remains independently performance-gated. Approved.
- **D-006:** Stable Alpha is a bounded 2D-versus-VR crossover research instrument that includes
  Atlas Core; the Atlas Research Release expands it. The study package remains draft until design,
  methods, consent, dictionary, provider, and version binding are frozen.
- **D-007:** Atlas owns analytical guidance and evidence state; Draco v1 owns spatial embodiment.
  The unwired neural/GA Draco design is not part of the current direction.
- **D-008:** Provenance, privacy, authorization, and bounded-input gates are release blockers.

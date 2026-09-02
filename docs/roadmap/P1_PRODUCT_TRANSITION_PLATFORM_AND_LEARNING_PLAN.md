# P1 Product Transition, Platform & Learning Plan

**Status:** ACTIVE STRATEGIC PLAN  
**Established:** 2 September 2026  
**Canonical product/research vision:** `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` V3  
**Canonical implementation-status authority:** `docs/ROADMAP.md`  
**Execution cadence:** `docs/roadmap/P1_E_EVOLUTIONARY_IMPROVEMENT_CADENCE.md`  
**Data corpus:** `TsatsuAmable/nemosyne-data`

## Purpose

Nemosyne is moving from broad exploratory development toward an actual product and production lifecycle. This plan captures the infrastructure, engineering, data, learning and product-development work needed to make the V3 vision operational.

It does **not** replace the vision.

The north star remains:

> **Help researchers develop meaningful, defensible understanding of datasets they care about, including relationships, structures, anomalies, patterns or interpretations they would not otherwise have appreciated, while preserving the evidence and reasoning that led there.**

Product-market fit, retention, usability, production reliability, model learning and infrastructure are therefore **means**, not substitute success criteria. They matter because they determine whether Nemosyne can repeatedly deliver the discovery lifecycle in the real world.

The governing transition principle is:

> **Optimise learning velocity toward a trustworthy product while preserving meaningful discovery, scientific authority, user privacy, maintainability, reproducibility and platform optionality.**

This document does not itself mark implementation complete.

---

# 1. Vision-alignment invariants

These invariants govern every product-transition tranche.

## 1.1 Meaningful discovery is the primary outcome

The V3 discovery lifecycle remains the product-level success path:

```text
NOTICE
  -> QUESTION
    -> HYPOTHESIS
      -> INVESTIGATION
        -> UNDERSTANDING
          -> VALIDATION
            -> DISCOVERY
```

A session is not successful merely because it is long, engaging or repeated. A high-value Nemosyne investigation should increasingly allow the researcher to:

- notice something relevant;
- articulate a question;
- form or refine a testable hypothesis;
- inspect alternatives and analytical evidence;
- support, refute or qualify the hypothesis;
- record an interpretation;
- preserve why that interpretation is believed;
- replay and defend the reasoning later.

`DiscoveryEpisode` remains a first-class target domain object and should become visible in product journeys, telemetry design and private-preview evaluation.

Product signals such as retention, completion, exports, representation switches and return usage are useful **secondary evidence**. They do not replace discovery quality.

## 1.2 The five ontologies remain separate authorities

The transition platform must not introduce competing semantic authorities.

| Ontology | Governing question | Canonical authority |
|---|---|---|
| Analytical | What can be reliably established about the data? | Rust/WASM |
| Representation | What structures can Nemosyne express spatially/perceptually? | Representation contracts / Moneta |
| Interaction | What does the researcher mean to do? | NIL / Investigation / Atlas |
| Discovery | What was noticed, investigated, understood and established? | Investigation / Evidence |
| Learning | What did researchers teach Nemosyne about useful representation? | Judgement / Fitness Learning / Model Registry |

The new Product, Realtime, Data and Learning infrastructure planes may persist, transport, observe or operationalise these domains. They may not become duplicate owners of their meaning.

## 1.3 NIL remains modality-independent

New XR, desktop, voice, gaze, controller or future-native capabilities must normally follow:

```text
physical input
  -> perception
    -> InteractionIntent
      -> NIL
        -> Investigation / Atlas
          -> semantic operation
```

A gesture handler or UI control must not quietly become a second domain command system.

This rule is essential to:

- replay;
- accessibility;
- desktop/XR semantic parity;
- future native/OpenXR portability;
- agent interaction;
- research treatment equivalence.

## 1.4 Product Mode and Research Mode remain distinct

**Product Mode** may use approved adaptive components when they are versioned, observable, governed and rollbackable.

**Research Mode** must be able to freeze every relevant adaptive subsystem or explicitly declare it as a treatment variable, including:

- dataset/version;
- Rust kernel and analytical parameters;
- Representation Ontology;
- Moneta/FitnessModel;
- NIL;
- perception/gesture model;
- random seeds;
- application build and relevant runtime configuration.

No adaptive update may silently reinterpret an existing investigation or change a research condition.

## 1.5 Bootstrap Moneta must not become the permanent architecture by inertia

Current fixed candidate families and bounded learned ranking are productisation steps, not the final theory of representation.

The long-term V3 destination remains:

```text
DatasetEvidence
+ InvestigationIntent
+ ResearcherContext
+ RepresentationOntology
        ↓
RepresentationGraph candidate/composition generation
        ↓
FitnessModel / Moneta search
        ↓
inspectable representation hypotheses
        ↓
human investigation + evidence + judgement
        ↓
validated learned priors
```

Do not pull speculative compositional work forward before its prerequisites are ready, but do not harden fixed candidate enums into an irreversible product boundary either.

## 1.6 Current execution governance supersedes the older parallelism suggestion

V3 describes parallel implementation after authority reconciliation. The later project operating policy is intentionally stricter: **one forward implementation tranche at a time unless explicitly changed**.

This is a process/governance amendment, not a change to the product vision. It exists to reduce stale-main work, conflicting authorities, integration collisions and agentic overclaiming.

---

# 2. Strategic product corrections

## 2.1 Quest is a reference platform, not a product ceiling

Meta Quest remains useful for evaluating standalone-XR interaction, comfort, thermal/memory/performance constraints and deployment reality. It is not the strategic gate for Nemosyne.

Rules:

- classify device findings as **Nemosyne defect**, **implementation defect**, or **platform ceiling**;
- fix Nemosyne/implementation defects normally;
- if a platform ceiling materially compromises the intended analytical experience, move to a more capable headset, tethered/native target or desktop-GPU runtime rather than weakening the product thesis merely to remain Quest-compatible;
- keep analytical, representation, discovery, investigation and provenance contracts hardware-neutral;
- keep platform-specific adaptation at rendering/input/performance boundaries;
- maintain an explicit capability matrix for current and candidate platforms.

Physical Quest evidence remains valuable product-fitness evidence, but no longer blocks unrelated product, infrastructure, maintainability, data or UX progress.

## 2.2 UX/product learning comes before strong formal-study interpretation

The current UX still has enough friction to confound scientific comparison. A major formal study should not primarily measure whether participants can survive the interface.

Near-term loop:

```text
usable journey
  -> live human observation
    -> friction discovery
      -> UX repair
        -> repeat
          -> stable discovery workflow
            -> product/value learning
              -> formal study when interface friction is no longer dominant
```

Frequent lightweight sessions should examine:

- think-aloud investigation tasks;
- time to first useful analytical action;
- repeated errors and abandoned actions;
- hidden-state/mode confusion;
- provenance, undo and recovery comprehension;
- representation-reasoning comprehension;
- dataset-loading friction;
- unnecessary desktop/headset switching;
- progression through Notice -> Question -> Hypothesis -> Investigation -> Validation;
- perceived analytical value and missing capability.

These sessions are product-development evidence unless governed under a frozen scientific protocol.

## 2.3 Product/market fit becomes explicit but subordinate to discovery value

Private-preview users should become design partners. Product decisions should be informed by:

- who receives meaningful value;
- which research/investigation tasks improve;
- which dataset types users bring;
- whether useful discoveries/hypotheses are produced and defended;
- completed investigations and successful export/reopen;
- return/retention patterns;
- feature use and abandonment;
- interviews and support burden;
- which spatial/XR capabilities create value rather than novelty;
- which hardware/deployment shape best fits the users who care.

Do not optimise for broad-market scale before finding a narrow, repeatable, high-value discovery workflow.

---

# 3. Technology strategy

## 3.1 TypeScript: keep for the client/product shell

TypeScript owns the fast-evolving application and interaction edge:

- UI and spatial UI;
- WebXR interaction/input;
- Three.js presentation;
- application orchestration;
- browser APIs;
- product-state projection;
- networking clients;
- feature rollout/adaptation;
- desktop/XR workflows.

TypeScript must not become a second analytical or representation authority.

The client layer should be replaceable. Durable domain contracts must be narrow enough that a future native client can consume them without reconstructing Nemosyne semantics from UI code.

## 3.2 Rust: keep as the analytical evidence and scale-sensitive computation core

Rust remains the canonical product authority for:

- analytical computation;
- scale-sensitive data operations;
- deterministic and reproducibility-critical transformations;
- bounded/resident data structures;
- hostile-input/resource boundaries;
- numerical/geometry-support computation required by canonical representation contracts;
- WASM today and native execution later.

**Boundary:** Rust may calculate governed analytical/numerical structures consumed by a representation, but it must not own representation reasoning or decide what a representation means. Representation semantics remain with the Representation subsystem/Moneta and embodiment remains with the Spatial Runtime.

Do not move analytical authority back into TypeScript for convenience.

## 3.3 Node: retain but demote conceptually

Node remains useful for build tooling, WASM bootstrap, CI/governance scripts, development servers, signalling/product services where TypeScript is adequate, and operational tooling.

Node is infrastructure, not Nemosyne's intellectual core. Avoid a wholesale Deno/Bun migration without demonstrated product or maintenance benefit.

## 3.4 Python: independent scientific reference and training ecosystem

Python should **not** become a second product analytical authority or runtime fallback.

Use it as an independent scientific reference/validation implementation and offline training ecosystem for:

- `nemosyne-data` fixture generation;
- independently derived known answers;
- numerical/statistical cross-checks;
- Monte Carlo and perturbation analysis;
- model training;
- human-study analysis;
- corpus preparation;
- evaluation reports.

Production truth remains Rust/WASM. Python exists to challenge, independently verify and train against that product implementation rather than asking Rust to prove Rust correct.

## 3.5 WebXR/Three.js: current client platform, not permanent prison

Keep WebXR and Three.js while they support rapid product learning and broad delivery. Continue evaluating WebGPU/modern rendering paths.

Preserve a native escape route:

```text
current: TypeScript + Three.js + WebXR
        -> WebGPU/WebGL evolution as useful
        -> native OpenXR client only when measured platform limits justify it
```

A future native client should reuse Rust/domain/NIL contracts rather than trigger a whole-product rewrite.

## 3.6 Technology non-goals

Do not currently:

- rewrite the TypeScript client in Rust;
- migrate the repository wholesale to Deno/Bun;
- introduce Go or a microservice mesh without an operating need;
- move scientific authority into JavaScript/TypeScript;
- put representation reasoning into Rust;
- rewrite in Unity/Unreal merely for native XR availability;
- make Python a production analytical fallback;
- let one headset dictate the domain architecture.

---

# 4. Production architecture required for the next phase

The signalling server is one service, not a product backend.

Nemosyne needs four conceptual infrastructure planes.

## 4.1 Product plane

Responsibilities:

- accounts or pseudonymous persistent identities where needed;
- organisations/workspaces only if product learning demonstrates a need;
- investigation metadata and optional backup/synchronisation;
- sharing/access policy;
- feature flags and rollout assignments;
- private-preview cohort management;
- support/admin operations;
- entitlement/billing only when justified.

## 4.2 Realtime plane

Responsibilities:

- signalling;
- room admission;
- collaboration transport;
- peer/realtime presence;
- bounded abuse/rate controls.

Keep this operationally separable from ordinary product APIs because latency, connection lifetime and scaling characteristics differ.

## 4.3 Data plane

Responsibilities:

- product event ingestion;
- consent/retention enforcement;
- gesture-learning observations;
- Moneta judgement/discovery evidence events;
- study observations where governed;
- immutable raw/curated data objects;
- exports and deletion/erasure traversal;
- data lineage and dataset snapshot identities.

The data plane stores evidence. It does not decide the scientific or semantic meaning of that evidence.

## 4.4 Learning plane

Responsibilities:

- governed training-dataset builds;
- feature generation;
- training jobs;
- evaluation and holdouts;
- model artifact storage;
- model registry metadata;
- candidate/shadow/canary/production/retired lifecycle;
- signed manifests/checksums;
- rollback;
- drift monitoring;
- reproducibility records.

The implementation may initially use managed services and a small number of deployables. Do not create a microservice mesh merely because the conceptual planes are distinct.

---

# 5. Minimum production substrate

Before Nemosyne depends on real users for learning, these capabilities must exist.

## 5.1 Identity

Define canonical identifiers for:

- installation;
- pseudonymous user/profile;
- authenticated user only where persistent product state requires it;
- session;
- investigation and DiscoveryEpisode;
- dataset/version/digest;
- device/runtime class;
- application build;
- model/version/digest;
- experiment/rollout assignment.

Identity must support user-disjoint evaluation and data deletion without requiring unnecessary personal information.

## 5.2 Consent and privacy lifecycle

Use explicit scopes, not one generic analytics flag.

Suggested scopes:

- essential operational diagnostics;
- optional product analytics;
- derived gesture features/corrections for learning;
- raw gesture trajectory capture for specifically consented research/training;
- Moneta preference/judgement/discovery-evidence collection;
- formal study collection under a study-specific protocol.

Required lifecycle:

```text
default state
  -> grant
    -> scoped collection
      -> retention
        -> export
          -> revoke future collection
            -> erase applicable retained data
```

Claims must match actual erasure capabilities.

## 5.3 Versioned event envelope

Every event family should use a versioned schema containing, as relevant:

- event and payload schema versions;
- timestamp plus sequencing where needed;
- app/build identity;
- session/investigation/DiscoveryEpisode identity;
- pseudonymous profile where permitted;
- device/runtime class;
- dataset/model identities;
- consent scope;
- source/provenance;
- integrity/size constraints.

Do not allow arbitrary telemetry JSON to become an accidental data-lake API.

## 5.4 Durable stores and jobs

Minimum useful primitives:

- relational metadata store for identity, consent, manifests, rollouts and governance state;
- immutable/object storage for larger event batches, training snapshots, exports and model artifacts;
- queue/job mechanism for asynchronous processing/training;
- secrets/configuration management;
- backup/recovery;
- audit/operational logs.

Keep vendors replaceable until operational evidence justifies deeper coupling.

## 5.5 Observability and operations

Need:

- deployed artifact lineage;
- error/crash reporting;
- service health and latency;
- client build/model-version distribution;
- data-ingestion failures;
- training/evaluation job failures;
- cost/capacity visibility;
- abuse/rate/resource protection;
- controlled rollout and rollback;
- privacy-safe support diagnostics.

---

# 6. Runtime provenance registry and reproducibility

The V3 Model Registry is broader than an MLOps model store. Nemosyne must be able to identify the exact system configuration under which an investigation occurred.

Each investigation should increasingly resolve exact versions/digests for:

- application build;
- Rust analytical kernel and relevant analytical method versions;
- Representation Ontology / RepresentationGraph schema;
- Moneta/FitnessModel;
- NIL;
- perception/gesture model;
- dataset;
- random seeds and reproducibility-critical settings.

Learned artifacts additionally record:

- training dataset digest;
- training code commit;
- feature schema version;
- environment/container digest;
- configuration/hyperparameters;
- random seed;
- holdout dataset/grouping rules;
- evaluation metrics/uncertainty;
- known failure cases;
- promotion policy and review record;
- rollout/rollback/retirement state.

Runtime provenance identity should begin before full automated training infrastructure. A `.nemosyne` investigation must never become ambiguous merely because the current production model has advanced.

Training must be reproducible from code + data snapshot + config + seed + environment.

Do not begin with heavyweight MLOps infrastructure. Start with durable artifact storage, explicit registry metadata and reproducible containerised jobs.

---

# 7. Gesture learning platform

The existing gesture-intelligence module and `GestureRetrainService` contain useful domain concepts, but process-local maps/arrays are prototypes rather than operational infrastructure.

## 7.1 Data minimisation levels

```text
L0  no learning collection
L1  aggregate/product interaction telemetry
L2  derived gesture features + explicit confirmations/corrections
L3  raw trajectories under explicit research/training consent
```

Do not silently treat raw hand trajectories as ordinary analytics.

## 7.2 Gesture observation and label provenance

A governed observation may include pseudonymous profile/session, device/runtime/handedness, trajectory/feature schema, derived features, optional raw trajectory reference under explicit consent, predicted gesture, model version/digest, calibrated score where valid, confirmation/correction, interaction context and consent scope.

Training examples must distinguish:

- controlled labelled session;
- explicit user confirmation;
- explicit user correction;
- inferred undo/retry;
- inferred context;
- automatic prediction only.

Gold corpora should initially use only strong labels. Weak labels may support diagnostics or later semi-supervised work but must not silently equal ground truth.

## 7.3 Frozen training snapshots and evaluation

A frozen snapshot records admissibility/consent rules, profile-disjoint partitions, device/runtime strata, class balance, feature schema, transformations, code/environment, seed and digest.

Evaluate beyond a single accuracy threshold:

- user-disjoint accuracy and macro-F1;
- per-class precision/recall/F1;
- calibration when scores are exposed as confidence;
- device/runtime/handedness strata;
- perturbation robustness;
- latency/resource envelope;
- heuristic baseline comparison;
- known-failure regression;
- shadow/canary behaviour.

Deployment lifecycle:

```text
candidate
  -> offline evaluation
    -> shadow
      -> canary
        -> rollout
          -> retired/rollback
```

Every prediction must be attributable to a model version/digest.

---

# 8. Learned Moneta platform

Learned Moneta is more sensitive than gesture classification because its target is not self-evident.

## 8.1 Product telemetry is not automatically Moneta evidence

Keep these classes distinct:

```text
product telemetry
scientific / human-judgement evidence
curated training data
```

The same session may contribute to more than one class, but consent, admissibility and interpretation differ.

Do not train Moneta simply on dwell time, the last representation viewed, recommendation acceptance or selection frequency.

## 8.2 Governed learning evidence

Useful evidence may include:

- dataset fingerprint/features;
- investigation intent/task/discovery objective;
- candidates and alternatives shown;
- explicit pairwise preference;
- explicit acceptance/rejection and reason;
- weight adjustments;
- revert/switch history;
- task outcome where objectively scoreable;
- interaction burden;
- researcher context where collected appropriately;
- known-answer correctness;
- stability under perturbation;
- road-not-taken metadata;
- DiscoveryEpisode outcome and validation state.

Discovery outcomes are ultimately stronger learning evidence than mere interaction acceptance.

Prefer explicit pairwise judgements where possible because they align with the existing pairwise-learning architecture and V3 Human Judgement model.

## 8.3 Training and promotion

Training snapshots must freeze evidence/feature schema, user/investigation/dataset/task grouping, train/validation/holdout partitions, balancing policy, training code/environment, configuration, seeds and digests.

Before learned Moneta materially changes production ranking require:

- frozen evaluation protocol;
- held-out researcher/dataset/task groups;
- comparison against bootstrap/unadapted baseline;
- declared minimum improvement;
- appropriate score/calibration terminology;
- perturbation stability;
- no degradation of hard constraints/admissibility;
- known-answer and abstention checks;
- auditable model/data provenance;
- explicit promotion action;
- rollback and baseline visibility.

Passing offline metrics must not automatically activate a model.

## 8.4 Post-PT9 vision continuation: compositional Moneta

PT9 validates learned priors over the bounded current representation system. It is not the end state.

Once product evidence, ontology maturity and safety justify it, the V3 continuation is:

```text
validated learned priors
  -> mature versioned RepresentationOntology
    -> RepresentationGraph grammar
      -> bounded composition/search
        -> compositional Moneta evaluation
          -> controlled adaptive Nemosyne
```

Entry conditions should include:

- no duplicate representation authority;
- representation primitives are versioned/extensible rather than a permanent closed enum;
- search space is bounded and inspectable;
- generated compositions preserve analytical semantics/provenance;
- explanations and rejected alternatives remain inspectable;
- known-answer/metamorphic/abstention evidence covers new composition behavior;
- Research Mode can freeze the relevant ontology/search/model versions.

Do not introduce an opaque generative representation model merely because infrastructure for model training exists.

---

# 9. `nemosyne-data` as a first-class engineering dependency

`nemosyne-data` is the canonical public/synthetic/known-answer corpus. It is distinct from private consented production-learning corpora.

Shared manifest concepts should include dataset ID/version/digest, schema, measurement semantics, provenance, transformations, known quantities/tolerances where applicable, privacy/licensing/admissibility, intended uses and resource class.

Initial known-answer families:

- aggregate;
- empirical distribution;
- density;
- source-partition cluster;
- source-authoritative relationship graph;
- explicit NIL/abstention cases.

Then expand when active semantics justify it to temporal, hierarchy, geospatial, compositional/circular/ordinal and other families.

Metamorphic variants should include row permutations, irrelevant-column additions, valid label/identifier changes, valid unit/scale transformations, controlled noise, missingness and duplicate/near-duplicate cases.

Also curate:

- realistic licensed datasets supporting meaningful investigation tasks and independently checkable properties;
- hostile/boundary datasets for parsers, size/shape limits, filenames/control characters, degenerate numerics, precision, pathological graph structures and WASM/resource boundaries.

Nemosyne should consume a versioned catalogue/manifest, record exact dataset digest/version in the investigation, and independently validate expected quantities outside Nemosyne production code.

---

# 10. Dataset loading, NIL and complete discovery workflow in XR

Dataset loading is a core product journey, not a developer feature.

A user should eventually be able to remain in XR for ordinary investigation work:

- browse `nemosyne-data` catalogue;
- inspect dataset metadata/source/licence;
- load local or approved remote data;
- inspect and explicitly correct inferred measurement semantics;
- see load validation/refusal/errors;
- switch dataset/version;
- inspect representation reasoning and alternatives;
- select/challenge/revert representations;
- filter/transform/analyse through governed NIL operations;
- notice/question/hypothesise/test/annotate/conclude through the Investigation/Discovery model;
- inspect structures/observations/provenance;
- save/export/reopen `.nemosyne` investigations;
- recover after failure;
- manage privacy/telemetry/model-learning preferences;
- access help/onboarding without leaving XR.

Desktop remains important for accessibility, debugging and complementary workflows, but XR must not be a decorative viewer controlled by a hidden desktop plane.

**Hard interaction invariant:** new XR affordances should map to canonical InteractionIntent/NIL semantics. Product parity means equivalent semantic investigation capability, not pixel-identical interfaces.

---

# 11. Test strategy transition

Test count and aggregate coverage are secondary metrics. The test programme should ask whether the suite can falsify meaningful product, scientific, security, learning and operational claims.

Prioritise:

- known-answer analytical/representation tests;
- metamorphic/property invariants;
- production discovery journeys;
- failure/recovery tests;
- security/admission/ingestion hostile paths;
- replay/provenance consistency;
- selective mutation testing for critical logic;
- parser/WASM/security fuzzing;
- model evaluation/holdout tests;
- Product Mode vs Research Mode freeze/replay tests;
- lifecycle/soak tests only where they reveal distinct failures.

Audit existing tests by protected claim, production path, likely defect class, flakiness, runtime and whether the test can pass while the intended contract is broken.

Track selectively:

- mutation kill rate on critical modules;
- escaped regressions;
- flaky-test rate;
- critical discovery-journey protection;
- known-answer corpus pass rate;
- fuzz findings/regressions;
- runtime per unique evidence class;
- active-path type safety.

Coverage remains a useful floor/blind-spot signal, not the optimisation objective.

---

# 12. CI feedback-time programme

Long CI harms product iteration and agent correctness by encouraging batching and delaying feedback.

Baseline p50/p95 PR feedback time, per-job duration, queue time, duplicate setup/build/WASM work, failure yield and flakiness/retry cost.

Target layering:

```text
local/focused checks
  -> fast required PR checks
    -> risk-triggered specialised checks
      -> scheduled deep assurance
```

Rules:

- run cheap static/contract failures first;
- reuse immutable exact-head build artifacts where identity remains provable;
- avoid repeated Node/Rust/WASM setup;
- deduplicate semantically identical jobs;
- keep CodeQL/security/architecture evidence where uniquely valuable;
- move fuzz/mutation/Miri/soak to touched-path or scheduled lanes unless specifically required;
- keep one obvious promotion path;
- require new mandatory jobs to justify runtime with a concrete failure class.

Faster CI must not mean weaker evidence.

---

# 13. Agentic engineering, maintainability and documentation

## 13.1 Mechanical agent guardrails

Assume characteristic risks: plausible-but-false completion, duplicate authorities, helper-only tests, broad refactors hiding semantic changes, stale-main work, compatibility/persistence breakage, weakened guards, documentation overclaim and local optimisation that harms system coherence.

Strengthen:

- single-forward-stream discipline;
- fresh-main before each tranche;
- stale-head check before promotion;
- explicit invariant/falsifiers;
- protected analytical, ingestion, provenance, persistence, learning and security paths;
- AST/dependency architecture checks;
- diff-size/change-budget warnings;
- production-path evidence;
- known-answer evidence for analytical/representation changes;
- independent adversarial post-review;
- no removing/weakening a failing guard in the same PR without explicit rationale and independent review;
- exact-head promotion identity;
- machine-checked capability/status claims where practical.

## 13.2 Maintainability target

A new maintainer or agent should be able to determine ownership, authority, end-to-end production paths, persistence/compatibility boundaries, relevant falsifiers, current docs and runtime dependencies without repository archaeology.

Planned direction:

- continue reducing `World` toward composition-root/compatibility responsibilities;
- prevent manager-shaped replacement god objects;
- narrow `WorldUIManager` capability bags as touched;
- replace active-path `unknown` contracts where stable types exist;
- reduce high-churn/high-coupling hotspots and dependency cycles;
- remove obsolete compatibility shims only after caller/persistence review;
- document local module ownership and use low-noise architecture fitness functions.

A representative dataset load, Moneta decision, embodiment, NIL action, investigation mutation, DiscoveryEpisode update and replay should be traceable without archaeology.

## 13.3 Documentation compression

Move toward a small active set:

1. `README.md`;
2. `docs/ROADMAP.md`;
3. definitive V3 product/research vision;
4. current architecture/system design;
5. current product/UX interaction specification;
6. current security/privacy/production operations specification;
7. current testing/quality/agent policy;
8. current data/corpus contract;
9. active research protocol only when relevant;
10. compact ADR/compatibility records.

Archive superseded tranche plans/reviews so history does not compete with present truth.

---

# 14. Product-learning instrumentation

Once privacy/consent infrastructure exists, collect only events tied to explicit product questions.

Examples:

- dataset load success/failure/refusal reason;
- time to first useful analytical action;
- progression into Question/Hypothesis/Test/Conclusion states;
- investigation/DiscoveryEpisode completion/export/reopen;
- representation switch/revert/challenge;
- undo/recovery usage;
- repeated failed gestures;
- help/onboarding use;
- performance/failure conditions by platform class;
- privacy-safe support diagnostics.

Do not treat every observable interaction as useful telemetry.

Product analytics must remain separable from gesture-training and Moneta judgement/training corpora.

---

# 15. Execution order

Multiple conceptual lanes exist, but implementation remains one forward tranche at a time unless explicitly changed.

## PT0 — Strategic capture and E0 ratchets

- capture product-transition and vision-alignment direction;
- remove obvious trust/terminology drift;
- establish hygiene ratchets;
- make architecture policy ordinary PR evidence;
- record data/corpus, infrastructure and learning programmes.

## PT1 — Engineering feedback baseline and CI quick wins

- measure p50/p95 CI feedback time;
- identify repeated setup/build/WASM work;
- rank checks by runtime and unique failure yield;
- land low-risk deduplication/ordering/caching without weakening exact-head evidence;
- define a concrete feedback-time objective.

## PT2 — Data/corpus contract and known-answer foundation

Use `nemosyne-data` issue #3:

- freeze manifest/catalogue schema;
- add known-answer aggregate/distribution/density/cluster/graph datasets;
- add metamorphic variants;
- add NIL/abstention fixture;
- publish machine-readable catalogue;
- independently validate expected quantities outside Nemosyne production code.

## PT3 — Production identity, consent, runtime provenance and event contracts

Freeze semantics before collecting valuable user data:

- canonical identities including investigation/DiscoveryEpisode;
- consent scopes/lifecycle;
- retention/export/erasure;
- versioned event envelope;
- data classification;
- runtime provenance/version contract;
- Product Mode vs Research Mode freeze contract;
- privacy/security threat model;
- deployment/configuration environment model.

No large backend build before these contracts are adversarially reviewed.

## PT4 — Minimal ingestion/storage vertical slice

Prove:

```text
client action
  -> consent check
    -> authenticated batched ingestion
      -> durable storage
        -> governed metadata
          -> export
            -> erasure
```

Implement only enough infrastructure to make this path operational and observable.

## PT5 — Catalogue loading, NIL parity and discovery-workflow convergence

- consume `nemosyne-data` catalogue through governed ingestion;
- make browse/load/schema/semantic correction usable in XR;
- complete save/export/reopen/recovery;
- remove desktop-only dependencies for normal investigation;
- ensure new XR actions use canonical NIL semantics;
- make Notice -> Question -> Hypothesis -> Investigation -> Validation -> Discovery usable and observable;
- begin repeated live UX sessions and fix observed friction.

## PT6 — Gesture-learning collection pipeline

- collect explicitly consented derived features and confirmations/corrections;
- support separately consented raw-trajectory research capture;
- freeze label-provenance rules;
- build immutable user-disjoint training snapshots;
- establish evaluation report format.

Do not auto-retrain production models yet.

## PT7 — Runtime/model registry and reproducible training jobs

- durable artifact store and registry metadata;
- exact analytical/representation/NIL/perception runtime identities;
- training lineage;
- signed/digested deployment manifests;
- candidate/shadow/canary/rollout/rollback lifecycle;
- observability of model distribution and failures.

Operationalise existing in-code gesture/Moneta registry concepts without creating competing semantics.

## PT8 — Gesture model update loop

- reproducible Python training pipeline;
- user-disjoint/device-stratified evaluation;
- known-failure corpus;
- shadow comparison;
- canary rollout;
- promotion/rollback policy;
- drift monitoring.

## PT9 — Moneta learning-evidence pipeline

- define admissible pairwise/judgement/discovery-outcome evidence;
- preserve telemetry vs evidence vs training-data distinction;
- freeze train/holdout grouping;
- integrate known-answer/abstention/stability gates;
- compare unadapted baseline vs learned candidate;
- deploy only through explicit promotion;
- preserve the post-PT9 path to RepresentationOntology/RepresentationGraph/compositional search rather than freezing fixed candidates as the permanent architecture.

## PT10 — Private-preview product/discovery learning loop

Once the product can responsibly operate:

- onboard a narrow design-partner cohort;
- observe real investigations and DiscoveryEpisodes;
- collect consented product-learning data;
- conduct regular interviews/usability sessions;
- track return/completion/support friction as secondary product signals;
- assess meaningful discovery quality, analytical support, articulability and replayability;
- refine UX/workflows/infrastructure;
- use evidence to decide product shape, target users and hardware envelope.

Freeze formal scientific study design only when the product experience is sufficiently stable for the question being asked.

---

# 16. Cross-cutting tranche rhythm

Between product slices, select the highest-leverage bounded risk from:

- UX/discovery friction;
- security/privacy;
- reliability/recovery;
- maintainability/architecture;
- test effectiveness;
- CI latency;
- agentic guardrails;
- documentation compression;
- production operations.

Selection criteria:

1. clear discovery/product/correctness value;
2. high leverage;
3. low collision with active slice;
4. strong falsifiability;
5. finite exit.

Critical product, scientific, security or data-integrity findings pre-empt the default order.

---

# 17. Production infrastructure decision policy

Do not select vendors by fashion.

For each capability choose the smallest managed/self-hosted option satisfying:

- privacy/data-location requirements;
- operational burden;
- WebXR/client compatibility;
- reproducibility/lineage;
- observability;
- rollback/recovery;
- cost at private-preview scale;
- migration/exit cost;
- ability to support model/data lifecycle.

Architecture contracts must permit vendor replacement without rewriting product semantics.

Avoid Kubernetes until concrete scale/operational requirements justify it.

---

# 18. Exit criteria for exploratory development

Nemosyne has substantially exited exploratory-development mode when:

- current architecture/ownership are understandable from a small canonical doc set;
- critical discovery journeys are coherent on desktop and XR;
- Notice -> Hypothesis -> Validation -> Discovery can be completed and replayed;
- realistic and known-answer datasets are first-class inputs;
- tests protect meaningful contracts rather than implementation trivia;
- CI gives sufficiently fast trustworthy feedback;
- deployments are attributable, observable and rollbackable;
- identity/consent/data lifecycle is explicit and enforceable;
- product telemetry, gesture learning and Moneta judgement/training evidence have separate governed schemas;
- investigations retain exact analytical, representation, NIL and perception runtime provenance;
- Product Mode can adapt without preventing Research Mode from freezing conditions;
- training datasets and learned artifacts are reproducible/versioned;
- model promotion is explicit and reversible;
- private-preview users can be onboarded responsibly;
- live product learning can drive priorities without losing scientific provenance;
- changing hardware/client runtime does not require rewriting analytical or interaction authority;
- the architecture still has a credible path from bounded learned Moneta to compositional representation intelligence.

---

# 19. Definition of success

The transition succeeds when Nemosyne behaves like a trustworthy product-learning **and discovery** system:

- researchers can bring real data and complete meaningful investigations;
- users can form, test, validate and preserve defensible discoveries;
- UX improves through observed use;
- user data is collected only under explicit governed purposes;
- gesture and Moneta learning can be reproduced, evaluated and rolled back;
- known-answer data can falsify analytical/representation regressions;
- runtime/model provenance makes old investigations reproducible after updates;
- maintainers/agents can understand and change the system safely;
- CI makes correctness feedback fast enough for continuous product refinement;
- documentation reflects the current system rather than its archaeology;
- WebXR/Quest can be replaced if necessary without discarding the durable analytical, interaction, investigation or learning core;
- fixed bootstrap representations have not become an accidental permanent theory of useful representation.

The product goal is not to preserve today's stack, today's headset or today's candidate list.

It is to preserve and progressively improve Nemosyne's ability to connect trustworthy analytical computation, inspectable representation hypotheses, semantic interaction, human judgement and scientific evidence into **meaningful, reproducible discovery**.
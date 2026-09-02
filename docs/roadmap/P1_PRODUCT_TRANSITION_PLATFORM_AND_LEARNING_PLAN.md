# P1 Product Transition, Platform & Learning Plan

**Status:** ACTIVE STRATEGIC PLAN  
**Established:** 2 September 2026  
**Canonical status authority:** `docs/ROADMAP.md`  
**Execution cadence:** `docs/roadmap/P1_E_EVOLUTIONARY_IMPROVEMENT_CADENCE.md`  
**Data corpus:** `TsatsuAmable/nemosyne-data`  

## Purpose

Nemosyne is moving from broad exploratory development toward an actual product and production lifecycle. The next phase is not defined by finishing one headset qualification or by adding more representation families. It is defined by whether Nemosyne can become:

- meaningfully useful to real investigators;
- usable enough that interface friction is not the dominant experimental confounder;
- maintainable by people and agents who did not create the exploratory codebase;
- supported by fast, trustworthy engineering feedback;
- operated safely for real users and real user data;
- capable of collecting governed evidence for gesture learning and future learned Moneta;
- validated against realistic and independently known datasets;
- portable to more capable XR/native hardware if the current WebXR/Quest envelope becomes the limiting factor.

The governing principle is:

> Optimise for learning velocity toward a trustworthy product, while preserving scientific authority, user privacy, maintainability and platform optionality.

This document captures the strategic decisions and planned work implied by that transition. It does not itself mark implementation complete.

---

# 1. Strategic product corrections

## 1.1 Quest is a reference platform, not a product ceiling

Meta Quest remains useful for evaluating standalone-XR interaction, comfort, thermal/memory/performance constraints and deployment reality. It is not the strategic gate for Nemosyne.

Rules:

- classify device findings as **Nemosyne defect**, **implementation defect**, or **platform ceiling**;
- fix Nemosyne/implementation defects normally;
- if a platform ceiling materially compromises the intended analytical experience, move to a more capable headset/tethered/native target rather than weakening the product thesis merely to remain Quest-compatible;
- keep analytical, representation, evidence, investigation and provenance contracts hardware-neutral;
- keep platform-specific adaptation at rendering/input/performance boundaries;
- maintain an explicit capability matrix for current and candidate platforms.

Physical Quest evidence therefore remains valuable evidence, but no longer blocks unrelated product, infrastructure, maintainability, data or UX progress.

## 1.2 UX/product learning comes before strong formal-study interpretation

The current UX still has enough friction to confound scientific comparison. A major formal study should not primarily measure whether participants can survive the interface.

The near-term learning loop is:

```text
usable journey
  -> live human observation
    -> friction discovery
      -> UX repair
        -> repeat
          -> stable valuable workflows
            -> stronger product/market evidence
              -> formal study when interface friction is no longer dominant
```

Use frequent lightweight sessions for:

- think-aloud investigation tasks;
- time-to-first-useful-action;
- repeated errors and abandoned actions;
- hidden-state and mode confusion;
- provenance/undo/recovery comprehension;
- representation-reasoning comprehension;
- dataset-loading friction;
- headset/desktop switching;
- perceived analytical value;
- unmet workflow needs.

These sessions are product-development evidence unless governed under a frozen scientific protocol.

## 1.3 Product/market fit becomes an explicit objective

Private-preview users should increasingly become design partners. Product decisions should be informed by:

- who receives meaningful value;
- which investigation tasks improve;
- which dataset types users bring;
- completed investigations and successful exports/reopens;
- return/retention patterns;
- feature use and abandonment;
- interviews and support burden;
- which XR/spatial capabilities create value rather than novelty;
- which hardware/deployment shape best fits the users who care.

Do not optimise for broad-market scale before finding a narrow repeatable high-value workflow.

---

# 2. Technology strategy

The current TypeScript/Rust approach remains strategically strong, but the responsibilities must become sharper.

## 2.1 TypeScript: keep for the client/product shell

TypeScript owns the fast-evolving application and interaction edge:

- UI and spatial UI;
- WebXR interaction/input;
- Three.js presentation;
- application orchestration;
- browser APIs;
- product-state projection;
- networking clients;
- feature rollout/adaptation;
- desktop/XR product workflows.

TypeScript must not become a second analytical authority.

The client layer should be replaceable. Durable product/domain contracts must be narrow enough that a future native client could consume them without reconstructing Nemosyne semantics from UI code.

## 2.2 Rust: keep and strengthen as the durable analytical/data core

Rust remains the best long-lived authority for:

- analytical computation;
- scale-sensitive data operations;
- semantic embodiment calculation;
- deterministic transformations;
- bounded/resident data structures;
- hostile-input/resource boundaries;
- reproducibility-critical operations;
- WASM today and native execution later.

Do not move analytical authority back into TypeScript for convenience.

Where it simplifies long-term authority, consider moving stable durable contracts below the client boundary, but do not move ordinary UI/application state into Rust merely to increase Rust usage.

## 2.3 Node: retain but demote conceptually

Node remains useful for:

- build tooling;
- WASM bootstrap;
- CI/governance scripts;
- development servers;
- signalling/product services where TypeScript is adequate;
- operational tooling.

Node is infrastructure, not Nemosyne's intellectual core. Avoid a wholesale Deno/Bun migration without a demonstrated product/maintenance benefit.

## 2.4 Python: add as an independent scientific and training ecosystem

Python should not become a runtime analytical fallback. It should become an independent offline authority for:

- `nemosyne-data` fixture generation;
- independently derived known answers;
- numerical/statistical cross-checks;
- Monte Carlo and perturbation analysis;
- model training;
- human-study analysis;
- corpus preparation;
- evaluation reports.

This creates an independent implementation lineage so Rust is not asked to prove Rust correct.

## 2.5 WebXR/Three.js: current client platform, not permanent prison

Keep WebXR and Three.js while they support rapid product learning and broad delivery. Continue evaluating WebGPU/modern rendering paths.

Preserve a native escape route:

```text
current: TypeScript + Three.js + WebXR
        -> WebGPU/WebGL evolution as useful
        -> native OpenXR client only when measured platform limits justify it
```

A future native client should reuse Rust/domain contracts rather than trigger a whole-product rewrite.

## 2.6 Technology non-goals

Do not currently:

- rewrite the TypeScript client in Rust;
- migrate the whole repository to Deno/Bun;
- introduce Go or microservices without a specific operating need;
- move scientific authority into JavaScript/TypeScript;
- rewrite in Unity/Unreal merely for native XR availability;
- make Python a production analytical fallback;
- let one headset dictate the domain architecture.

---

# 3. Production architecture required for the next phase

The current signalling server is one service, not a product backend.

Nemosyne needs four conceptual planes.

## 3.1 Product plane

Responsibilities:

- accounts or pseudonymous persistent identities where needed;
- organisations/workspaces only if product learning demonstrates a need;
- investigation metadata and optional backup/synchronisation;
- sharing/access policy;
- feature flags and rollout assignments;
- private-preview cohort management;
- support/admin operations;
- entitlement/billing only if/when product requirements justify it.

## 3.2 Realtime plane

Responsibilities:

- signalling;
- room admission;
- collaboration state transport;
- peer/realtime presence;
- bounded realtime abuse/rate controls.

Keep this operationally separable from ordinary product APIs because latency, connection lifetime and scaling characteristics differ.

## 3.3 Data plane

Responsibilities:

- product event ingestion;
- consent/retention policy enforcement;
- gesture-learning observations;
- future Moneta learning/evidence events;
- study observations where governed;
- immutable raw/curated data objects;
- exports and deletion/erasure traversal;
- data lineage and dataset snapshot identities.

## 3.4 Learning plane

Responsibilities:

- governed training-dataset builds;
- feature generation;
- training jobs;
- evaluation and holdouts;
- model artifact storage;
- model registry;
- candidate/shadow/canary/production/retired lifecycle;
- signed manifests/checksums;
- rollback;
- drift monitoring;
- reproducibility records.

The implementation may initially use managed services and a small number of deployables. Do not create a microservice mesh simply because the conceptual planes are distinct.

---

# 4. Minimum production substrate

Before Nemosyne depends on real users for learning, the following capabilities must exist.

## 4.1 Identity

Define canonical identifiers for:

- installation;
- pseudonymous user/profile;
- authenticated user only where product state requires it;
- session;
- investigation;
- dataset/version/digest;
- device/runtime class;
- application build;
- model/version/digest;
- experiment/rollout assignment.

Identity must support user-disjoint evaluation and data deletion without requiring unnecessary personally identifying information.

## 4.2 Consent and privacy lifecycle

Define explicit scopes, not one generic analytics flag.

Suggested starting scopes:

- essential operational diagnostics;
- optional product analytics;
- derived gesture features/corrections for learning;
- raw gesture trajectory capture for specifically consented research/training;
- future Moneta preference/evidence collection;
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

## 4.3 Versioned event envelope

Every event family should use a versioned schema with:

- event schema version;
- timestamp plus sequencing where needed;
- app/build identity;
- session/investigation identity;
- pseudonymous profile where permitted;
- device/runtime class;
- dataset/model identities where relevant;
- consent scope;
- payload schema version;
- source/provenance;
- integrity/size constraints.

Do not allow arbitrary telemetry JSON to become an accidental data lake API.

## 4.4 Durable stores

Minimum useful primitives:

- relational metadata store for identities, consent, manifests, rollouts and governance state;
- immutable/object storage for larger event batches, training snapshots, exports and model artifacts;
- queue/job mechanism for asynchronous processing/training;
- secrets/configuration management;
- backup/recovery;
- audit/operational logs.

Keep vendors replaceable until operational evidence justifies deeper coupling.

## 4.5 Observability and operations

Need:

- deployed artifact lineage;
- error/crash reporting;
- service health and latency;
- client build/model-version distribution;
- data-ingestion failures;
- training/evaluation job failures;
- cost/capacity visibility;
- basic abuse/rate/resource protection;
- controlled rollout and rollback;
- support diagnostics that avoid exposing sensitive dataset contents by default.

---

# 5. Gesture learning platform

The existing gesture-intelligence module and `GestureRetrainService` contain useful domain concepts, but in-process maps/arrays are prototypes, not operational infrastructure.

## 5.1 Gesture observation schema

A governed gesture observation may include:

- event/schema version;
- pseudonymous profile/session;
- device/runtime/handedness;
- trajectory schema version;
- feature schema version;
- derived features;
- optional raw trajectory reference only under explicit consent;
- predicted gesture;
- model version/digest;
- prediction score/calibration value where valid;
- explicit user confirmation;
- explicit correction;
- weak inferred signal such as immediate undo/retry;
- interaction context;
- label provenance;
- consent scope.

## 5.2 Data minimisation levels

Use distinct collection levels:

```text
L0  no learning collection
L1  aggregate/product interaction telemetry
L2  derived gesture features + explicit confirmations/corrections
L3  raw trajectories under explicit research/training consent
```

Do not silently treat raw hand trajectories as ordinary analytics.

## 5.3 Label provenance

Training examples must distinguish:

- controlled labelled session;
- explicit user confirmation;
- explicit user correction;
- inferred from undo/retry;
- inferred from context;
- automatic prediction only.

Gold training corpora should initially use only strong labels. Weak labels may support diagnostics or later semi-supervised work but must not silently equal ground truth.

## 5.4 Gesture training-dataset build

A frozen training snapshot must record:

- input corpus/query identity;
- consent/admissibility rules;
- profile-disjoint partitioning;
- device/runtime strata;
- class balance;
- feature schema;
- transformations;
- code commit/container/environment;
- seed;
- dataset digest.

## 5.5 Evaluation

Move beyond one accuracy threshold. Evaluate:

- user-disjoint accuracy/macro-F1;
- per-class recall/precision/F1;
- calibration if scores are exposed as confidence;
- device/runtime/handedness strata;
- robustness to trajectory perturbation;
- latency/resource envelope;
- comparison against heuristic baseline;
- regression on known failure examples;
- shadow/canary production behaviour.

## 5.6 Deployment lifecycle

Operationalise the existing vocabulary:

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

# 6. Learned Moneta platform

Learned Moneta is a more sensitive problem than gesture classification because the target is not self-evident.

## 6.1 Product telemetry is not automatically Moneta training evidence

Keep three admissibility classes distinct:

```text
product telemetry
scientific/user evidence
training data
```

The same session may produce all three, but they have different consent, interpretation and promotion rules.

Do not train Moneta simply on dwell time, last representation viewed or frequency of selection.

## 6.2 Useful Moneta evidence

Potential governed evidence includes:

- dataset fingerprint/features;
- investigation intent/task;
- candidates shown;
- explicit pairwise preference;
- explicit representation acceptance/rejection;
- revert/switch history;
- task success/error outcome where objectively scoreable;
- time/interaction burden;
- analyst expertise/context where collected appropriately;
- known-answer correctness;
- stability under perturbation;
- road-not-taken candidate metadata.

Prefer explicit pairwise judgements where possible because they align with the existing pairwise-learning architecture.

## 6.3 Moneta training snapshot

Record:

- evidence schema/version;
- feature schema/version;
- dataset and task groups;
- user/investigation grouping;
- train/validation/holdout partitions;
- group-balancing policy;
- training code/environment;
- model configuration;
- random seeds;
- data/model digests.

## 6.4 Promotion requirements

Before a learned Moneta model changes production ranking materially, require:

- frozen evaluation protocol;
- held-out dataset/task/user groups;
- comparison against bootstrap/unadapted baseline;
- minimum absolute and relative improvement;
- calibration or terminology appropriate to the score semantics;
- perturbation stability;
- no degradation of hard constraints/admissibility;
- known-answer and abstention corpus checks;
- auditable model/data provenance;
- explicit promotion action;
- rollback and baseline visibility.

Passing offline metrics must not automatically activate a model.

---

# 7. Model registry and reproducible training

Gesture models and learned Moneta should share infrastructure concepts even if their training logic differs.

Each model artifact should carry:

## Identity

- model family;
- version;
- artifact digest;
- artifact format/runtime compatibility.

## Training lineage

- training dataset digest;
- training code commit;
- feature schema version;
- environment/container digest;
- hyperparameters/configuration;
- random seed;
- dependency lock identity.

## Evaluation lineage

- holdout dataset digest;
- grouping rules;
- metrics and uncertainty;
- known failure cases;
- calibration/stability reports;
- hardware/resource envelope where relevant.

## Governance

- promotion policy version;
- review/approval record;
- promotion timestamp;
- rollout state;
- rollback target;
- retirement reason.

Training must be reproducible from code + data snapshot + config + seed + environment.

Do not begin by deploying heavyweight MLOps infrastructure. Start with containerised/reproducible jobs, durable artifact storage and explicit registry metadata. Add orchestration complexity only when workload demands it.

---

# 8. `nemosyne-data` as a first-class engineering dependency

`nemosyne-data` should become the canonical public/synthetic/known-answer corpus.

The public repository is distinct from private consented production-learning corpora.

## 8.1 Shared manifest concepts

Both public and private corpora should reuse compatible concepts where safe:

- dataset ID/version/digest;
- schema;
- measurement scales;
- provenance;
- transformations;
- known quantities/tolerances where applicable;
- privacy/licensing/admissibility status;
- intended test/training/product uses;
- resource class.

## 8.2 Known-answer families

Build deterministic fixtures for currently verified representation families first:

- aggregate;
- empirical distribution;
- density;
- source-partition cluster;
- source-authoritative relationship graph;
- explicit NIL/abstention cases.

Then expand to temporal, hierarchy, geospatial, compositional/circular/ordinal and other families when those become active product semantics.

## 8.3 Metamorphic variants

For each appropriate fixture generate:

- row permutations;
- irrelevant-column additions;
- valid label/identifier changes;
- valid unit/scale transformations;
- controlled noise;
- missingness;
- duplicate/near-duplicate cases.

Use these to test invariants/stability rather than snapshots.

## 8.4 Realistic datasets

Curate credible licensed datasets that support meaningful investigation tasks and independently checkable properties. Include several size/resource classes.

## 8.5 Hostile/boundary datasets

Maintain adversarial fixtures for:

- CSV/JSON/Arrow ingestion;
- size/shape limits;
- filenames/control characters;
- malformed/degenerate numerical cases;
- precision issues;
- pathological graph structures;
- WASM ABI/resource boundaries.

## 8.6 Nemosyne catalogue integration

Nemosyne should consume a versioned catalogue/manifest rather than hard-coded samples.

The app must record the exact dataset digest/version used in an investigation and evidence record.

---

# 9. Dataset loading and full XR workflow

Dataset loading is not merely a developer feature. It is a core product journey.

A user should eventually be able to remain in XR for ordinary investigation tasks:

- browse `nemosyne-data` catalogue;
- inspect dataset metadata/source/licence;
- load local or approved remote data through platform-appropriate pickers;
- inspect schema and inferred measurement semantics;
- correct semantics explicitly;
- see load validation/refusal/errors;
- switch dataset/version;
- inspect representation reasoning and alternatives;
- select/challenge/revert representations;
- filter/transform/analyse through governed operations;
- inspect structures/observations/provenance;
- save/export/reopen `.nemosyne` investigations;
- recover after failure;
- manage privacy/telemetry/model-learning preferences;
- access help/onboarding without leaving XR.

Desktop remains important for accessibility, debugging and complementary workflows, but XR must not be a decorative viewer controlled by a hidden desktop plane.

---

# 10. Test strategy transition

Test count and overall coverage are secondary metrics.

The test programme should ask whether the suite can falsify important claims.

## 10.1 Test classes that matter

- known-answer analytical/representation tests;
- metamorphic/property invariants;
- production-journey tests;
- failure/recovery tests;
- security/admission/ingestion hostile-path tests;
- replay/provenance consistency tests;
- selective mutation testing for critical logic;
- fuzzing at parsers/WASM/security boundaries;
- model evaluation/holdout tests;
- lifecycle/soak tests only where they expose failures ordinary deterministic tests cannot.

## 10.2 Test audit

Classify existing tests by:

- protected product/scientific/security claim;
- production path covered;
- likely defect class detected;
- flakiness;
- runtime;
- whether an implementation change can pass while violating the intended contract.

Delete/rewrite tests that primarily pin implementation trivia or cannot fail for a meaningful reason.

## 10.3 Better metrics

Track selectively:

- mutation kill rate on chosen critical modules;
- escaped regressions;
- flaky-test rate;
- critical journey protection;
- known-answer corpus pass rate;
- fuzz findings/regressions;
- test runtime per unique evidence class;
- active-path type-safety.

Coverage remains a useful floor/blind-spot signal, not the optimisation objective.

---

# 11. CI feedback-time programme

Long CI directly harms product iteration and agent correctness by increasing batching and delaying feedback.

## 11.1 Baseline first

Measure:

- p50/p95 PR feedback time;
- per-job duration;
- queue time;
- duplicate setup/build/WASM work;
- failure yield by job;
- flakiness/retry contribution;
- expensive jobs that rarely provide unique information.

## 11.2 Target layering

```text
local/focused checks
  -> fast required PR checks
    -> risk-triggered specialised checks
      -> scheduled deep assurance
```

## 11.3 Optimisation rules

- run cheap static/contract failures first;
- reuse immutable exact-head build artifacts where identity remains provable;
- avoid repeated Node/Rust/WASM dependency/setup work;
- deduplicate semantically identical workflow jobs;
- keep CodeQL/security/architecture gates where they provide unique value;
- move fuzz/mutation/Miri/soak to touched-path or scheduled lanes unless specifically required;
- keep one obvious promotion path;
- require new mandatory CI jobs to justify runtime with a specific failure class.

Faster CI must not mean weaker evidence.

---

# 12. Agentic engineering guardrails

Agentic engineering remains valuable but must be assumed to have distinctive failure modes.

## 12.1 Known risks

- plausible-but-false completion claims;
- duplicate analytical/security authorities;
- tests that prove helper code rather than production call graphs;
- broad refactors that hide semantic changes;
- stale-main work;
- compatibility/persistence breakage;
- tests weakened to make changes green;
- overproduction of docs/status claims;
- local optimisations that degrade system coherence.

## 12.2 Mechanical guardrails

Strengthen:

- single-forward-stream discipline;
- fresh-main check before each tranche;
- stale-head check before promotion;
- explicit pre-implementation invariant and falsifiers;
- protected paths/ownership for analytical authority, ingestion, provenance, persistence and security-sensitive code;
- architecture AST/dependency checks;
- diff-size/change-budget warnings;
- production-path evidence for production claims;
- known-answer evidence for analytical/representation changes;
- independent adversarial post-review for material changes;
- rule against removing/weakening a failing guard in the same PR without explicit rationale and independent review;
- exact-head CI/promotion identity;
- capability/status claims derived or checked mechanically where practical.

A green agent-authored PR should mean that likely ways of being wrong were actively attacked.

---

# 13. Maintainability and code comprehension

The end of exploratory development changes the optimisation target.

A new maintainer or agent should be able to determine:

- ownership of behaviour;
- analytical/data/security authority;
- end-to-end production request path;
- persistence/compatibility boundaries;
- relevant tests/falsifiers;
- current docs;
- deployment/runtime dependencies.

## Planned work

- continue reducing `World` to composition-root/compatibility responsibilities;
- prevent manager-shaped replacement god objects;
- narrow `WorldUIManager` callback/capability bags as touched;
- replace active-path `unknown` contracts when stable types are known;
- identify high-churn/high-coupling hotspots;
- reduce dependency cycles deliberately;
- remove obsolete compatibility shims only after caller/persistence review;
- document module ownership locally rather than through sprawling historical prose;
- use architecture fitness functions for durable low-noise rules.

A representative dataset load, Moneta decision, embodiment, investigation mutation and replay should be traceable without repository archaeology.

---

# 14. Documentation compression

The documentation surface should become smaller as the product becomes more stable.

## Target active set

Keep a small obvious set of current documents:

1. `README.md` — orientation, capability and current state;
2. `docs/ROADMAP.md` — canonical execution/status authority;
3. current system architecture;
4. current product/UX interaction specification;
5. current security/privacy/production operations specification;
6. current testing/quality/agent policy;
7. current data/corpus contract;
8. current active research/study protocol only when applicable;
9. compact ADR/compatibility records for durable decisions.

Archive superseded tranche plans, implementation reviews and historical programme status. Historical evidence remains valuable, but it must not compete with present-tense truth.

Documentation checks should detect retired terminology, stale deployment descriptions, unsupported physical/product claims and duplicate status authorities.

---

# 15. Product-learning instrumentation

Once privacy/consent infrastructure exists, collect only events tied to explicit product questions.

Examples:

- dataset load success/failure/refusal reason;
- time to first meaningful interaction;
- investigation completion/export/reopen;
- representation switch/revert/challenge;
- undo/recovery usage;
- repeated failed gestures;
- explicit help/onboarding use;
- performance/failure conditions by platform class;
- privacy-safe support diagnostics.

Do not treat every observable interaction as valuable telemetry.

Product analytics must remain separable from gesture-training and Moneta-learning corpora.

---

# 16. Execution order

This programme uses multiple conceptual lanes, but implementation remains one forward tranche at a time unless explicitly changed.

## PT0 — Strategic capture and E0 ratchets

**Current PR.**

- capture the product-transition direction;
- remove obvious trust/terminology drift;
- establish hygiene ratchets;
- make architecture policy ordinary PR evidence;
- record the new data/corpus and infrastructure programmes.

## PT1 — Engineering feedback baseline and CI quick wins

Do early because every later tranche benefits.

- measure p50/p95 CI feedback time;
- identify repeated setup/build/WASM work;
- rank checks by runtime and unique failure yield;
- land low-risk deduplication/ordering/caching improvements without weakening exact-head evidence;
- define a concrete feedback-time objective.

## PT2 — Data/corpus contract and known-answer foundation

Use `nemosyne-data` issue #3 as the initial bounded tranche.

- freeze manifest/catalogue schema;
- add known-answer datasets for aggregate/distribution/density/cluster/graph;
- add metamorphic variants;
- add one NIL/abstention fixture;
- publish machine-readable catalogue;
- independently validate expected quantities outside Nemosyne code.

## PT3 — Production identity, consent and event contracts

Freeze semantics before collecting valuable user data.

- canonical identities;
- consent scopes/lifecycle;
- retention/export/erasure rules;
- versioned event envelope;
- data classification;
- privacy/security threat model;
- deployment/configuration environment model.

No large backend build before these contracts are adversarially reviewed.

## PT4 — Minimal ingestion/storage vertical slice

Prove one end-to-end production path:

```text
XR/client action
  -> consent check
    -> authenticated batched ingestion
      -> durable storage
        -> governed metadata
          -> export
            -> erasure
```

Implement only enough product infrastructure to make this path operational and observable.

## PT5 — Dataset catalogue loading and XR workflow convergence

- consume `nemosyne-data` catalogue through governed ingestion;
- make dataset browse/load/schema/semantic correction usable in XR;
- complete save/export/reopen/recovery paths;
- remove desktop-only dependencies for normal investigation;
- begin repeated live UX sessions and fix observed friction.

## PT6 — Gesture-learning collection pipeline

- collect explicitly consented derived features and confirmations/corrections;
- support separately consented raw-trajectory research capture;
- freeze label-provenance rules;
- build immutable user-disjoint training snapshots;
- establish evaluation report format.

Do not auto-retrain production models yet.

## PT7 — Shared model registry and reproducible training jobs

- durable model/artifact store;
- model registry metadata;
- training lineage;
- signed/digested deployment manifests;
- candidate/shadow/canary/rollout/rollback lifecycle;
- observability of model distribution and failures.

Operationalise existing in-code gesture/Moneta registry concepts rather than creating unrelated competing semantics.

## PT8 — Gesture model update loop

- reproducible Python training pipeline;
- user-disjoint/device-stratified evaluation;
- known failure corpus;
- shadow comparison;
- canary rollout;
- promotion/rollback policy;
- drift monitoring.

## PT9 — Moneta learning-evidence pipeline

- define admissible pairwise/outcome evidence;
- preserve product telemetry vs training evidence distinction;
- freeze train/holdout grouping;
- integrate `nemosyne-data` known-answer/abstention/stability gates;
- validate unadapted baseline vs learned candidate;
- deploy only through explicit promotion.

## PT10 — Private-preview product-learning loop

Once the product can responsibly operate:

- onboard a narrow cohort;
- observe real investigations;
- collect consented product-learning data;
- conduct regular interviews/usability sessions;
- track return/completion/support friction;
- refine UX/workflows/infrastructure;
- use evidence to decide product shape, target users and hardware envelope.

Formal scientific study design can then be frozen when the product experience is sufficiently stable for the question being asked.

---

# 17. Cross-cutting tranche rhythm

Do not wait until PT10 to improve maintainability, tests, security or documentation. Between product slices, select the highest-leverage bounded risk from:

- UX friction;
- security/privacy;
- reliability/recovery;
- maintainability/architecture;
- test effectiveness;
- CI latency;
- agentic guardrails;
- documentation compression;
- production operations.

Selection criteria:

1. clear correctness/value;
2. high leverage;
3. low collision with the active product slice;
4. strong falsifiability;
5. finite exit.

Critical product/security/data-integrity findings pre-empt the default order.

---

# 18. Production infrastructure decision policy

Do not select vendors by fashion.

For each capability choose the smallest managed/self-hosted option that satisfies:

- privacy/data-location requirements;
- operational burden;
- WebXR/client compatibility;
- reproducibility/lineage;
- observability;
- rollback/recovery;
- cost at private-preview scale;
- migration/exit cost;
- ability to support model/data lifecycle.

Architecture contracts must make it possible to replace vendors without rewriting product semantics.

Avoid Kubernetes until concrete scale/operational requirements justify it.

---

# 19. Exit criteria for exploratory development

Nemosyne should be considered to have substantially exited exploratory-development mode when:

- current architecture and ownership are understandable from a small canonical doc set;
- the critical investigator journeys are coherent in desktop and XR;
- realistic and known-answer datasets are first-class inputs;
- tests protect meaningful contracts rather than primarily implementation details;
- CI gives sufficiently fast trustworthy feedback for product iteration;
- production deployments are attributable, observable and rollbackable;
- user identity/consent/data lifecycle is explicit and enforceable;
- product telemetry, gesture-learning data and Moneta evidence have separate governed schemas;
- training datasets and model artifacts are reproducible/versioned;
- model promotion is explicit and reversible;
- private-preview users can be onboarded responsibly;
- live product learning can drive priorities without losing scientific provenance;
- changing hardware/client runtime does not require rewriting analytical authority.

---

# 20. Definition of success

The transition succeeds when Nemosyne stops depending on continued architectural heroics and starts behaving like a product-learning system:

- users can bring real data and complete meaningful investigations;
- UX improves through observed use;
- user data is collected only under explicit governed purposes;
- gesture and Moneta learning can be reproduced, evaluated and rolled back;
- known-answer data can falsify analytical/representation regressions;
- maintainers/agents can understand and change the system safely;
- CI makes correctness feedback fast enough for continuous product refinement;
- documentation reflects the current system rather than its archaeology;
- the current WebXR/Quest client can be replaced if necessary without discarding the durable core.

The product goal is not to preserve today's stack or today's headset. It is to preserve Nemosyne's analytical meaning, user trust and learning capability while the product evolves.
# P1-E — Product Transition & Evolutionary Improvement Cadence

**Status:** ACTIVE PRODUCT-TRANSITION PROGRAMME  
**Date established:** 2 September 2026  
**Scope:** product learning, UX, maintainability, architecture, engineering quality, security/privacy, production infrastructure, tests, CI/CD, documentation, data/corpus quality, developer/agent guardrails and scientific integrity  
**Non-scope:** manufacturing user/device evidence, forcing Nemosyne to fit one headset, promoting unvalidated scientific claims, or pulling speculative P2 representation research forward merely to stay busy

## Purpose

Nemosyne is approaching the end of its broad exploratory-development phase. The next job is not simply to accumulate more features or satisfy a single hardware qualification gate. It is to turn the existing research system into a product that real investigators can understand, use, trust, maintain and improve.

The governing principle is:

> Improve learning velocity toward a useful product while making the system easier to understand, safer to change and harder for humans or agents to accidentally degrade.

Physical device evidence, formal studies and market feedback remain essential, but they are inputs to product evolution rather than reasons to stop all other progress.

`docs/ROADMAP.md` remains the canonical implementation-status authority. P1-E is the rolling transition programme that improves the system between larger product/evidence milestones.

---

# Strategic corrections

## 1. Quest is a reference platform, not a strategic blocker

Meta Quest is useful because it gives Nemosyne a concrete standalone-XR performance, interaction and comfort envelope. It must not become an artificial ceiling on the product.

Rules:

- Quest findings remain real evidence about standalone-XR constraints and interaction quality.
- A Quest-specific limitation must be classified as either a Nemosyne defect, an implementation defect, or a platform ceiling.
- If the platform ceiling materially prevents the intended analytical experience, Nemosyne may target a more capable headset, tethered XR, desktop GPU or another runtime rather than weakening the product thesis to fit Quest.
- Core analytical, investigation, provenance and representation contracts must remain hardware-neutral.
- XR/platform-specific adaptation belongs at embodiment/input/performance boundaries, not in scientific authority.
- Maintain a small capability matrix for supported targets so product requirements do not silently become Quest-specific assumptions.

Quest qualification is therefore a product-fitness lane, not the master gate for all development.

## 2. UX refinement precedes strong scientific interpretation

The current experience still creates enough interaction friction that user confusion can become a major confounder. Formal comparative studies are premature if participants are substantially measuring interface pain rather than Nemosyne's analytical value.

Priority order:

```text
usable workflow
  -> live human observation
    -> iterative UX repair
      -> repeatable investigator journeys
        -> product/value learning
          -> formal study when the interface is no longer the dominant confounder
```

Human testing should begin early and remain lightweight, frequent and diagnostic:

- guided usability sessions;
- think-aloud investigation tasks;
- observed failure/recovery points;
- time-to-first-useful-action;
- task abandonment and repeated-error patterns;
- unnecessary mode switches and menu traversal;
- discoverability of state, provenance, undo/recovery and representation reasoning;
- post-session interviews about analytical usefulness, trust and missing capability.

These sessions are product-development evidence, not automatically inferential scientific evidence. Their purpose is to remove friction and discover what users actually need before freezing a major experiment.

## 3. Product development and market fit become first-class

The next lifecycle should increasingly ask:

- Who gets meaningful value from Nemosyne?
- Which investigation tasks become easier or newly possible?
- Which workflows cause users to return?
- What data do they bring?
- Which features are indispensable versus impressive but unused?
- Where does spatial representation create enough value to justify XR complexity?
- What product shape, deployment model and hardware envelope fit the users who care most?

Private-preview users should therefore be treated as design partners. Usage telemetry, interviews, support burden, retention, completed investigations and dataset/task mix become product-learning inputs, subject to explicit privacy/consent boundaries.

Do not optimise prematurely for broad-market scale. First establish a repeatable high-value workflow for a narrow cohort.

## 4. Maintainability now matters as much as exploratory velocity

Exploratory development tolerates local complexity because ideas are changing rapidly. Product/production development cannot.

The transition criterion is not merely "the code works". A competent new maintainer or agent must be able to determine:

- where a behavior is owned;
- which layer has authority;
- what must not be duplicated;
- which tests establish the contract;
- how a production request flows through the system;
- what compatibility constraints exist;
- what evidence is required before changing a high-risk path.

Prefer deletion, consolidation and narrow contracts over new abstraction layers. Continue the successful `World` convergence but prevent replacement god-managers.

## 5. Test effectiveness matters more than test quantity or coverage

Coverage remains a useful floor and blind-spot detector. It is not a quality target.

A test is valuable when it can falsify a meaningful product, scientific, security, data-integrity or operational claim.

The suite should increasingly be evaluated by:

- defect detection and regression yield;
- mutation kill rate on high-risk logic;
- known-answer correctness against canonical datasets;
- property/metamorphic invariants;
- production-journey protection;
- hostile-input/fuzz findings;
- replay/provenance consistency;
- failure/recovery behavior;
- test runtime versus information gained.

Delete or rewrite tests that mostly pin implementation trivia or cannot plausibly fail for a meaningful reason.

## 6. CI must become faster without becoming weaker

Long CI slows every human and agent feedback loop and encourages batching, speculative changes and delayed fixes.

Target architecture:

```text
local/focused checks < fast required PR checks < risk-triggered evidence < scheduled deep assurance
```

Required work includes:

- measure p50/p95 wall-clock by workflow and job;
- identify setup duplication and repeated WASM/package builds;
- reuse immutable build artifacts where exact-head identity remains provable;
- make cheap static/contract checks fail early;
- keep high-risk gates mandatory where relevant;
- move expensive fuzz/mutation/Miri/soak work to risk-triggered or scheduled lanes unless the change touches their authority boundary;
- avoid rerunning semantically identical work in several workflows;
- preserve exact-head evidence and action pinning while simplifying orchestration.

The objective is shorter feedback time per trustworthy result, not simply fewer checks.

## 7. Agentic engineering needs stronger mechanical guardrails

Agent assistance is a productivity multiplier and a source of distinctive failure modes: plausible but false completion, duplicated authorities, over-broad refactors, tests that prove helpers instead of production paths, stale-base work, compatibility breakage and documentation overclaiming.

Guardrails should increasingly be executable rather than prose-only:

- single-forward-stream / fresh-main discipline;
- mandatory pre-implementation falsifiers for high-risk changes;
- exact-head promotion evidence;
- independent adversarial post-review for material changes;
- architecture/authority AST and dependency policies;
- change-budget warnings for unexpectedly broad diffs;
- protected ownership boundaries for analytical authority, provenance, ingestion, persistence and security-critical paths;
- production-path tests for claims about production behavior;
- known-answer corpus checks for analytical/representation changes;
- no weakening/deleting a failing guard in the same PR without an explicit recorded rationale and independent review;
- stale-branch detection before merge;
- generated or machine-checked capability/status claims where practical.

A green agent-authored PR should mean "the important ways this could be wrong were actively attacked", not only "the implementation compiled".

## 8. Production infrastructure starts before product-market fit is known

Nemosyne needs real users and real user data to learn. That requires enough production infrastructure to operate responsibly before the final product shape is settled.

Build a minimal production spine, not a premature enterprise platform:

- canonical production/deploy-preview artifact lineage;
- authenticated user/session identity if persistent user state requires it;
- explicit data ownership and storage boundaries;
- consent-aware product analytics and error/crash telemetry;
- privacy-safe support diagnostics;
- feature/release flags for controlled rollout;
- backup/export/recovery for user investigations;
- observability for app/runtime failures and deployment regressions;
- environment/configuration separation;
- basic abuse/resource controls on any server-side capability;
- cost and capacity visibility;
- repeatable deployment/rollback;
- a clear private-preview onboarding/offboarding process.

Prefer local-first handling of sensitive datasets where feasible. Any server-side data path must be deliberate, documented and justified by product value.

## 9. Documentation should shrink as the product stabilises

The repository currently contains valuable history, but historical planning material should not compete with current truth.

Move toward a small active documentation surface:

1. `README.md` — project/product orientation and current status;
2. `docs/ROADMAP.md` — canonical execution/status authority;
3. current architecture/system-design document;
4. current product/UX interaction specification;
5. current security/privacy/production-operations specification;
6. current testing/quality/agent-engineering policy;
7. current data/corpus contract;
8. current research/study protocol only when actively relevant;
9. small ADR/compatibility records for durable decisions.

Superseded implementation plans, post-reviews and historical evidence should be archived or generated into a clearly historical area. Current docs must answer "how Nemosyne works now" before they explain how it got here.

## 10. `nemosyne-data` becomes a canonical product and verification dependency

`TsatsuAmable/nemosyne-data` should evolve into a versioned corpus of realistic, synthetic, adversarial and known-answer datasets.

Every governed corpus entry should carry a manifest containing, as applicable:

- stable dataset ID/version/content digest;
- source, licence and redistribution status;
- schema and measurement-scale semantics;
- expected row/column/cardinality facts;
- known analytical quantities with tolerances and derivation notes;
- expected structural properties;
- representation-relevant facts/requirements;
- provenance and transformations;
- intended test/product-study uses;
- size/resource class;
- privacy/synthetic status.

Corpus families should include:

### Known-answer synthetic datasets

Examples:

- exact clusters with known memberships and centroids;
- distributions with known moments/quantiles/tails;
- density fixtures with controlled modes and separations;
- graphs with exact nodes/edges/components/degrees;
- temporal series with known seasonality/change points;
- hierarchical structures with exact parent/child relations;
- compositional/circular/ordinal examples that expose invalid metric assumptions;
- deliberately ambiguous datasets where Moneta should abstain or surface alternatives.

### Metamorphic variants

For the same underlying scientific structure:

- row permutations;
- irrelevant-column additions;
- harmless label changes;
- scale/unit transformations where valid;
- controlled noise/perturbation levels;
- missingness variants;
- duplicate/near-duplicate cases.

These let tests ask whether Moneta and the analytical kernel preserve invariants rather than merely match snapshots.

### Realistic public datasets

Curate small-to-large datasets from credible domains with known provenance and licensing. Prefer data with documented analytical questions or independently verifiable properties so product sessions are not built entirely on toy examples.

### Hostile/boundary datasets

Malformed, oversized, adversarial, pathological and precision-sensitive fixtures for ingestion, WASM, rendering and security boundaries.

Nemosyne should consume the corpus through a versioned catalogue/manifest contract rather than hard-coded sample imports.

## 11. Dataset loading and full in-XR workflow are product requirements

A user should not need to repeatedly leave XR to perform ordinary investigative work.

The long-term XR parity target includes:

- browse/select canonical `nemosyne-data` datasets;
- load local files or approved remote sources through platform-appropriate pickers;
- inspect schema and inferred measurement semantics;
- correct/override semantics explicitly where allowed;
- review load/refusal/errors/provenance;
- switch datasets and versions;
- inspect/compare/challenge/record/navigate;
- choose/review/revert representations;
- filter/transform/analyse through governed operations;
- inspect exact observations/provenance;
- save/export/reopen `.nemosyne` investigations;
- manage privacy/telemetry/settings;
- recover from failures;
- access help/onboarding without removing the headset.

Desktop remains an important accessibility, debugging and complementary workflow surface. XR should not be a decorative viewer sitting behind a desktop control plane.

---

# Execution model

For each tranche:

1. fetch fresh `main` and re-check the problem still exists;
2. state the user/product/engineering value, invariant and non-goals;
3. identify the actual production path and likely agent failure modes;
4. add or strengthen falsifiers before or with implementation;
5. make the smallest coherent change;
6. exercise focused tests plus relevant production/known-answer evidence;
7. perform independent adversarial review;
8. fix forward rather than weaken evidence;
9. merge only on exact-head evidence;
10. measure whether the change reduced friction, risk, complexity or feedback time;
11. fetch fresh `main` and re-score the next tranche.

One forward implementation PR remains the default unless explicitly changed.

---

# Rolling work programme

The work below is dependency- and evidence-driven, not a rigid phase gate. Product/user findings pre-empt housekeeping.

## E0 — Easy wins and one-way ratchets

Current PR tranche:

- remove unnecessary `unpkg.com` runtime trust and tighten CSP;
- remove retired investigator-facing Draco terminology while preserving compatibility IDs;
- refresh feature truth;
- promote architecture policy to every PR;
- freeze production `@ts-nocheck` at zero and make legacy test opt-outs one-way downward.

## E1 — UX friction and complete investigator journeys

Highest product-development priority while live user learning begins.

- map the end-to-end investigator journey and record friction/error points;
- ensure desktop and XR expose the same canonical task semantics;
- make dataset loading/schema review/semantic correction usable in XR;
- reduce menu depth, modal ambiguity and hidden state;
- improve affordance/discoverability of selection, representation reasoning, undo, recovery and provenance;
- build lightweight usability-session capture with explicit consent;
- create a repeatable weekly/batched UX review loop from observed sessions;
- do not freeze the flagship formal study while interface friction remains a dominant confounder.

## E2 — Production spine and private-preview operations

- choose canonical production/public/preview deployment ownership;
- fix or retire permanently failing deployment workflows;
- add artifact/source/WASM identity to deployment evidence;
- define user/session identity and local/server data boundaries;
- implement consent-aware product telemetry/crash diagnostics;
- add controlled rollout/feature flags and rollback;
- define investigation backup/export/recovery and private-preview support process;
- establish minimal observability, cost and abuse/resource monitoring.

## E3 — Security, privacy and ingestion closure

- RF-039 live `FileLoader -> Atlas -> Rust -> Dataset` upload policy;
- RF-040 complete telemetry consent/retention/revocation/export/erasure contract;
- RF-042 terminal/control-character sanitisation;
- RF-043 hostile parser/WASM ABI fuzz/property evidence;
- filename/metadata/path/injection review;
- re-review collaboration admission/replay/state-ordering boundaries.

## E4 — Maintainability and architectural comprehension

- narrow `WorldUIManager` callback/capability bags as touched;
- remove active-path `unknown` service ports where contracts are stable;
- prevent new manager-shaped god objects;
- identify high-churn/high-coupling hotspots and simplify them before new feature growth;
- document ownership at module boundaries rather than in sprawling narrative prose;
- reduce dependency cycles and compatibility fossils deliberately;
- add architecture fitness functions only when low-noise and durable.

Exit question: can a new maintainer trace a representative dataset load, Moneta decision, embodiment, investigation mutation and replay path without repository archaeology?

## E5 — Test effectiveness audit and redesign

Do not chase test count.

- classify tests by protected failure mode and product claim;
- find duplicate, inert, implementation-detail and low-value tests;
- run selective mutation testing on Moneta admissibility/scoring, provenance/replay, ingestion/security and recovery logic;
- establish known-answer tests backed by `nemosyne-data` manifests;
- add metamorphic/property tests for row order, irrelevant columns, stable identities and replay;
- add production-journey tests for critical investigator flows;
- ensure failure-path tests prove refusal/recovery rather than only happy-path output;
- remove `@ts-nocheck` on active-path tests as they are touched;
- keep coverage as a floor/diagnostic, not the optimisation target.

Track useful metrics such as mutation score for selected critical modules, escaped regressions, flaky-test rate, runtime and percentage of critical product journeys with a true system-level falsifier.

## E6 — CI feedback-time reduction

- establish p50/p95 PR completion baselines;
- rank jobs by time and unique defect yield;
- deduplicate installs/builds/WASM compilation where artifact identity can remain exact;
- make cheap failure checks first;
- separate required fast PR gates from risk-triggered deep assurance and scheduled campaigns;
- retain CodeQL/security/architecture evidence where it materially protects the touched path;
- reduce workflow proliferation and make one promotion path obvious;
- set a concrete feedback-time objective and reject new mandatory jobs that do not justify their cost.

## E7 — Agentic engineering guardrails

- codify change-size/diff-scope warnings;
- create protected-path policies for analytical authority, provenance, ingestion, persistence and security-sensitive code;
- require production-path evidence for production claims;
- require known-answer corpus checks for analytical/representation changes;
- prevent guard weakening in the same PR without explicit independent approval;
- detect stale base/head evidence;
- keep architecture-policy and pinned-action enforcement;
- periodically seed fault-injection or mutation exercises to measure whether agents actually detect defects;
- audit review documents for claims unsupported by executable evidence.

## E8 — Documentation compression and governance

- inventory active docs and identify the minimal canonical set;
- archive superseded plans/reviews/status snapshots aggressively while preserving history;
- consolidate duplicated architecture/security/product descriptions;
- remove volatile counts and stale claims;
- add a current-doc index and archive boundary;
- generate/check capability claims where feasible;
- ensure a reader can understand present architecture/product operation without reading historical review plans.

## E9 — `nemosyne-data` corpus and dataset catalogue

Coordinate with `TsatsuAmable/nemosyne-data`.

- define the corpus manifest/schema/version contract;
- add known-answer synthetic families for each verified representation;
- add metamorphic variants and negative/abstention fixtures;
- curate realistic licensed datasets;
- add hostile/boundary fixtures;
- publish a machine-readable catalogue;
- connect Nemosyne dataset loading to that catalogue without bypassing normal ingest authority;
- use corpus digests/versions in CI and product-session evidence;
- allow datasets to grow independently of application releases.

## E10 — Product learning loop / private preview

- recruit a small design-partner cohort;
- define onboarding and support path;
- instrument consented product events around successful/failed investigation journeys;
- capture qualitative feedback alongside behavior;
- review cohort retention, repeated use, imported dataset types and completed-investigation outcomes;
- prioritise fixes/features based on observed value and friction rather than taxonomy completion;
- evolve hardware requirements from actual workflow needs.

## E11 — Formal study readiness

The formal study remains valuable, but it moves after sufficient UX/product refinement.

Before inferential collection:

- freeze task/estimand/analysis unit;
- specify crossover/order/carry-over and participant/task/dataset hierarchy;
- justify sample size/precision;
- freeze exclusions, missingness, multiplicity and sensitivity analyses;
- version task/scoring artifacts;
- ensure interface competence/training is sufficient that UI friction is not the primary treatment effect.

## E12 — Empirical Moneta evidence redesign

Do not activate the current ad-hoc empirical scorer as scientific authority.

- inventory active/dormant scorers;
- remove duplicate authority;
- replace ambiguous confidence language;
- model uncertainty/effective sample size/participant and dataset heterogeneity;
- require held-out generalisation and perturbation stability;
- version empirical evidence/model provenance;
- preserve baseline and rejected alternatives for auditability.

---

# Repeating cadence

A useful default cycle is:

```text
user/product friction
  -> production/security risk
    -> maintainability/architecture
      -> test/CI/agent guardrails
        -> docs/data quality
          -> product learning
            -> repeat
```

Do not execute this as a quota. A serious user, security, integrity or production finding immediately pre-empts the queue.

Every few tranches, ask four questions:

1. Is Nemosyne easier for a real user to complete an investigation with?
2. Is it easier for a new maintainer/agent to understand and safely change?
3. Does the evidence pipeline detect more meaningful defects with less waiting?
4. Are we learning more about who values the product and what data/tasks they need?

If the answer is no, change the programme rather than polishing the machinery.

# Definition of success

The exploratory phase has successfully transitioned toward product/production when:

- real users can complete meaningful investigations without the UI dominating the experience;
- the product can move beyond Quest if hardware requirements demand it;
- the full ordinary workflow is available in XR rather than requiring a desktop control plane;
- production/private-preview infrastructure can safely support users and learning;
- maintainers can trace ownership and production flows without archaeological reading;
- agent changes are constrained by executable guardrails and adversarial evidence;
- tests are demonstrably falsifying, not merely numerous;
- CI gives trustworthy feedback materially faster;
- current documentation is small, coherent and authoritative;
- `nemosyne-data` supplies realistic and known-answer datasets used by product sessions and automated verification;
- Moneta representations can be checked against independently known quantities and invariants;
- product decisions increasingly follow observed user value and data rather than feature taxonomy;
- formal scientific studies begin only when UX maturity makes their conclusions interpretable.

The desired outcome is not simply a cleaner research codebase. It is a system capable of surviving contact with users, maintainers, production operations and repeated agent-assisted development without losing its scientific integrity.

# P1-E — Evolutionary Improvement Cadence

**Status:** ACTIVE SUPPORT PROGRAMME UNTIL PHYSICAL QUEST EVIDENCE IS AVAILABLE  
**Date established:** 2 September 2026  
**Scope:** code, architecture, security, privacy, reliability, tests, CI/CD, documentation, governance, scientific process, developer experience and maintainability  
**Non-scope:** manufacturing physical Quest evidence, inventing new scientific claims, pulling P2 compositional/generative representation work forward, or changing product semantics merely to stay busy

## Purpose

Nemosyne has reached a useful waiting state: the product and representation architecture are sufficiently coherent that further progress no longer requires constant feature expansion, while final physical Quest qualification still depends on evidence that cannot be manufactured in CI or simulation.

This programme uses that interval deliberately. It turns clear, independently justified improvements into a sequence of small reviewable tranches so the project becomes easier to reason about, safer to operate, cheaper to change and more truthful while physical evidence is pending.

The governing principle is:

> Improve what can be proved better now; preserve what needs real-world evidence for later.

This is not a licence for opportunistic refactoring. Every tranche must have a concrete invariant, a bounded failure mode and evidence showing that the change improves the current system without silently changing scientific or product meaning.

## Relationship to the main roadmap

`docs/ROADMAP.md` remains the canonical implementation-status authority. P1-E is a supporting cadence that may execute between or alongside queued physical-evidence prerequisites when its work does not collide with the active forward tranche.

P1-E does not override named roadmap gates. In particular:

- simulator/browser evidence never becomes physical Quest evidence;
- a cleaner architecture never closes UX-03, P1-U9, PERF-04 or another device gate;
- hardening work does not promote private-preview readiness until the owning security/privacy/product requirements are actually satisfied;
- empirical Moneta work cannot be promoted merely because a heuristic is implemented;
- open-ended RepresentationGraph/compositional search and generative geometry remain deferred until their explicit prerequisites are met.

## Execution model

P1-E follows the repository-wide adversarial implementation protocol and the single-forward-stream rule.

For each tranche:

1. fetch fresh `main` and re-check whether the finding still exists;
2. state the invariant, live production path, likely regression modes and non-goals;
3. choose the smallest coherent change that improves the invariant;
4. add or strengthen a falsifier before or with the implementation;
5. exercise the real production path when the claim concerns production behavior;
6. run focused tests, then ordinary exact-head CI and relevant specialised evidence;
7. perform a distinct post-implementation adversarial review;
8. fix forward on the same tranche rather than weakening evidence;
9. merge only when the bounded claim is supported;
10. fetch fresh `main`, re-score the remaining backlog, and select the next highest-value item.

One improvement PR should normally contain one coherent risk class. Small independent hygiene changes may be grouped only when they are individually reversible and share the same verification envelope.

## Selection rule

Prefer work with all four properties:

- **clear correctness:** the desired state is not scientifically or productively ambiguous;
- **high leverage:** the change reduces future defect probability, maintenance cost or misleading evidence;
- **low collision:** it does not overlap a pending physical-evidence or major product-semantic tranche;
- **strong falsifiability:** CI, production-browser, static policy, property tests, fuzzing or other evidence can tell us whether the improvement worked.

When two items compete, prioritise in this order:

1. security, privacy, data integrity and scientific correctness;
2. production-path reliability and recovery;
3. architectural authority and maintainability;
4. test/evidence quality and pipeline truthfulness;
5. documentation/governance truthfulness;
6. developer ergonomics and cleanup.

Do not choose work solely because it is aesthetically pleasing.

---

# Rolling schedule

The schedule is dependency-based rather than calendar-based because the arrival of physical Quest evidence is external to this programme. Each iteration should finish at a clean finite exit before the next begins.

## E0 — Review easy wins and one-way ratchets

**Intent:** remove obvious drift and create cheap mechanisms that prevent it returning.

Initial tranche:

- remove the unnecessary `unpkg.com` Three.js import map from shipped HTML;
- remove the corresponding external script origin from production CSP;
- add a regression proving production Three.js loading remains self-hosted;
- remove retired Draco terminology from investigator-visible onboarding while preserving compatibility IDs where changing them would widen scope;
- refresh `FEATURES.md` so it describes Moneta, Rust/WASM authority, dataset-level embodiments and the distinction between shipped architecture and pending physical qualification;
- stop hard-coding test-count claims in product documentation;
- graduate the proven architecture-policy workflow from a path-scoped pilot to an every-PR policy check;
- freeze production `src/` at zero `@ts-nocheck` and freeze the legacy test baseline as a one-way downward ratchet.

**Exit:** easy wins are enforced by normal repository evidence rather than depending on memory.

## E1 — Live-path security and privacy closure

**Intent:** close the highest-value private-preview trust-boundary residuals without introducing shadow authorities.

Work queue:

- **RF-039:** consolidate upload size/name/shape/dangerous-key policy on the real `FileLoader -> Atlas -> Rust -> Dataset` ingress path; remove or narrow orphan policy helpers after production-path parity is proven;
- **RF-040:** define one telemetry/consent lifecycle across collection, retention, export, revocation and erasure; narrow claims if complete erasure is not implemented;
- **RF-042:** neutralise terminal control sequences in developer UX trace output while preserving machine-readable logs;
- **RF-043:** add targeted hostile-input fuzz/property campaigns for parser and WASM ABI boundaries; turn every discovered defect into a deterministic regression;
- re-review signalling admission/replay semantics after surrounding collaboration changes rather than assuming old evidence survives forever;
- audit user-controlled filenames, labels and exported metadata for injection/path/control-character edge cases.

**Exit:** each preview-relevant trust boundary has one production authority and hostile-path evidence appropriate to its risk.

## E2 — Reliability, recovery and lifecycle hardening

**Intent:** make long-running investigations fail visibly and recoverably rather than merely avoiding crashes in unit tests.

Work queue:

- complete robust WASM trap containment and stale-handle invalidation;
- define state rehydration after recoverable analytical-runtime failure;
- exercise repeated initialise/deallocate/reinitialise sequences;
- add collaboration ordering/revision protection where delayed packets can overwrite newer state;
- classify browser storage quota, IndexedDB failure, lost context, WebGL context loss and worker restart behavior;
- ensure refusal/recovery surfaces preserve investigation context and do not silently fall back to weaker analytical paths;
- add soak tests only where they expose lifecycle defects that ordinary deterministic tests cannot.

**Exit:** failure modes that can occur during a real research session have explicit states, bounded recovery behavior and production-path evidence.

## E3 — Architecture erosion prevention

**Intent:** continue the successful `World` convergence without creating new manager-shaped god objects.

Work queue:

- narrow broad `WorldUIManager` callback bags into capability-specific local ports as touched;
- eliminate active-path `unknown` service ports where a stable contract is known;
- keep `World` as composition root/compatibility facade, not domain authority;
- prohibit presentation code from growing new scale-sensitive dataset traversal or scientific inference;
- retire compatibility aliases only when callers and persisted contracts permit it; do not force risky renames for cosmetic purity;
- classify and gradually reduce dependency cycles rather than hiding them under broad ignores;
- extend AST/dependency policy only for durable rules that have demonstrated value and low false-positive cost.

**Exit:** architecture gets simpler under normal feature maintenance, and the policy makes backsliding cheaper to detect than to review manually.

## E4 — Test-quality ratchet

**Intent:** increase the information value of the test suite rather than merely increasing its size.

Work queue:

- no new `@ts-nocheck`; remove it from active-path tests when those tests are touched;
- prioritise typing of Moneta embodiment, data ingestion, input, recovery, persistence and collaboration tests;
- replace implementation-detail assertions with production-contract assertions where appropriate;
- identify high-risk low-branch-coverage areas rather than chasing repository-wide percentage inflation;
- apply mutation testing selectively to security admission, analytical admissibility, replay/provenance and failure-state logic;
- add metamorphic/property tests for invariants such as row-order stability, irrelevant-column stability, deterministic replay and semantic identity preservation;
- quarantine or delete tests that can no longer fail for a meaningful product reason.

**Exit:** the suite becomes more falsifying and more type-safe while staying bounded in runtime.

## E5 — CI/CD and assurance convergence

**Intent:** retain Nemosyne's unusually strong evidence discipline while reducing ceremony and ambiguous workflow status.

Work queue:

- graduate successful pilots to permanent names and triggers once post-review evidence supports promotion;
- consolidate repeated setup/evidence logic into reusable workflows or scripts where this does not obscure exact-head identity;
- keep one obvious path from implementation evidence to promotion disposition;
- repair the GitHub Pages publication path or deliberately reclassify/decommission it if the canonical website host changes; do not leave a permanently red workflow as background noise;
- make deployment smoke prove the deployed artifact identity where feasible;
- continue commit-pinning Actions and validate upgrades as controlled migrations;
- measure CI wall-clock and failure yield before adding blanket expensive gates;
- schedule fuzz/mutation/Miri/soak assurance by risk rather than adding them to every PR.

**Exit:** green means something precise, red signals actionable failure, and agents do not need archaeology to determine which workflow is authoritative.

## E6 — Documentation and public-truth convergence

**Intent:** keep project claims synchronised with actual capability and evidence.

Work queue:

- remove retired terminology from investigator-facing and current technical documentation while retaining clearly labelled compatibility surfaces;
- distinguish `IMPLEMENTATION PARTIAL`, `IMPLEMENTATION LANDED`, `REVIEW ACTIVE`, `VERIFIED COMPLETE` and physical qualification consistently;
- stop embedding volatile counts or benchmark claims in narrative docs unless generated/checked;
- create or derive a small machine-readable capability/release manifest for public claims if this remains cheaper than manual drift review;
- add documentation checks for known dangerous drift classes: retired authority names, unsupported physical claims, stale deployment descriptions and duplicate status authorities;
- archive superseded plans rather than allowing several documents to appear simultaneously canonical.

**Exit:** a reader can identify current truth without understanding the repository's archaeological layers.

## E7 — Scientific-study readiness

**Intent:** make the human validation programme as rigorous as the software's internal epistemic discipline before participant outcomes are collected.

Work queue:

- freeze the primary estimand and analysis unit for the flagship study;
- specify crossover/order/carry-over treatment and participant/task/dataset hierarchy;
- justify sample size through power or precision criteria appropriate to the estimand;
- freeze exclusion, missing-data, multiplicity and sensitivity-analysis policies;
- version machine-readable task/scoring artifacts together with human wording;
- record protocol deviations explicitly after freeze;
- test study export/import/scoring on synthetic sessions before live collection;
- ensure consent/data-dictionary/retention language matches the actual telemetry and export pipeline.

**Exit:** data collection can begin without leaving material analytical choices to post-hoc discretion.

## E8 — Empirical Moneta evidence redesign

**Intent:** prepare empirical adaptation without promoting an under-justified heuristic into scientific authority.

Current caution:

The legacy/experimental evidence scorer uses an ad-hoc sample-count weight and fixed utility scaling. It must not be promoted merely because it is convenient or already tested.

Work queue:

- inventory production, dormant and compatibility empirical-scoring authorities;
- remove or quarantine duplicate TypeScript authority where Rust/Moneta owns the eventual decision path;
- replace ambiguous `confidence` language with calibrated terminology or neutral evidence-weight terminology;
- define uncertainty, effective sample size, participant/dataset heterogeneity and held-out generalisation requirements;
- version empirical model/data provenance and freeze promotion criteria before observing candidate performance;
- require stability under perturbation and out-of-sample evaluation before empirical preferences can materially change representation ranking;
- preserve the ability to inspect the unadapted baseline and the road not taken.

**Exit:** empirical adaptation, if activated, is auditable evidence-based model selection rather than `N`-weighted preference tuning.

## E9 — Dependency, compatibility and developer-experience maintenance

**Intent:** reduce incidental complexity without changing scientific behavior.

Work queue:

- continue controlled dependency modernisation in reversible waves;
- prefer maintained libraries when they measurably improve correctness/security/portability and preserve Nemosyne-specific semantics;
- remove obsolete compatibility shims only after class-wide caller search and persistence review;
- keep Node/Rust/WASM bootstrap portable across supported development platforms;
- remove stale scripts, workflows and documentation when a replacement has become authoritative;
- improve diagnostics for setup/build failures instead of adding hidden fallback behavior.

**Exit:** maintenance cost falls while behavior, provenance and replay compatibility remain explicit.

---

# Repeating maintenance loop

After E0, the programme does not need to finish E1 through E9 as monolithic phases. Use a repeating loop that selects one bounded tranche at a time:

```text
fresh main
  -> re-score known findings
  -> select highest-leverage non-colliding tranche
  -> pre-review / falsifiers
  -> implement
  -> focused + production evidence
  -> adversarial post-review
  -> exact-head gates
  -> merge
  -> fresh main
```

A useful default cycle while Quest evidence is pending is:

1. one security/reliability tranche;
2. one architecture/test-quality tranche;
3. one pipeline/docs/governance tranche;
4. one scientific-readiness or empirical-evidence tranche;
5. re-evaluate whether physical evidence has arrived or a higher-priority defect has appeared.

This ordering is a heuristic, not a quota. Critical correctness/security findings pre-empt it.

## Stop and handoff conditions

P1-E pauses or changes priority when any of the following occurs:

- governed physical Quest evidence arrives and requires adjudication/fix-forward;
- a release/private-preview blocker is discovered;
- an active PR exposes a correctness, security, scientific or data-integrity regression;
- a proposed improvement would require changing product/scientific semantics rather than merely improving their implementation;
- the remaining backlog consists mainly of aesthetic cleanup with low measurable leverage.

When Quest evidence arrives, the correct response is not to finish the current housekeeping list at all costs. Re-enter the owning QV/P1-U9/PERF/UX gate, analyse the evidence, fix concrete device findings, and let physical reality reorder the backlog.

## Definition of success

This programme succeeds if, when physical qualification resumes, Nemosyne is:

- easier to modify without violating authority boundaries;
- more secure and privacy-consistent on real production paths;
- more recoverable during long-running investigations;
- supported by more falsifying and better-typed tests;
- governed by fewer ambiguous or duplicate workflows;
- documented in one current vocabulary with claims tied to evidence;
- scientifically ready to analyse human-study data without post-hoc methodological invention;
- no more feature-bloated than it was when the programme started.

The desired outcome is compound engineering quality, not motion for its own sake.

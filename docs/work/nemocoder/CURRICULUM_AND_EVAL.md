# NemoCoder curriculum and evaluation contract

## Principle

Difficulty is measured by required engineering competence, not prompt length. Each level has task families, allowed scaffolding and an executable promotion gate.

## Levels

| Level | Task class | Typical instruction |
| --- | --- | --- |
| L0 | repository navigation / factual retrieval | exact files and question supplied |
| L1 | locate implementation behind a contract | contract + likely subsystem supplied |
| L2 | write or repair focused tests | invariant and target seam supplied |
| L3 | reproduce a known deterministic bug | symptom + bounded subsystem supplied |
| L4 | one-file bug repair | failing reproducer supplied |
| L5 | bounded multi-file repair | invariant + failing evidence supplied |
| L6 | CI/build/type failure diagnosis | failing run supplied, fix not specified |
| L7 | lifecycle/concurrency/trust-boundary repair | invariant supplied, reproducer may need design |
| L8 | architecture archaeology / authority audit | bounded question, no file hints |
| L9 | implement a small pre-specified roadmap tranche | goal + governing documents only |
| L10 | adversarial review of another implementation | claim + exact head supplied |
| L11 | select and propose next safe bounded task | repository state + authority rules only |

L11 does not grant implementation/merge authority. It measures whether task selection is sensible.

## Scaffolding decay

- L0-L2: recipe-like instructions and relevant paths may be supplied.
- L3-L5: goals, invariants and boundaries supplied; file hints progressively removed.
- L6-L8: problem statement plus governing contracts; model must investigate.
- L9-L10: only task claim, relevant authority docs and normal tool access.
- L11: model must select a bounded task and may be scored on choosing to abstain.

The evaluator must not secretly increase prompt detail to rescue a weak model. Assistance level is part of the benchmark record.

## Task construction

Each historical task records:

- immutable base SHA before the solution;
- hidden solution/merge SHA for provenance only;
- sanitized task statement;
- task family and level;
- allowed paths/tools;
- known tests plus hidden falsifiers;
- expected authority boundaries;
- cost/time envelope;
- whether ABSTAIN is acceptable or required.

Historical solution diffs are never visible during execution.

## Scoring

Primary outcome is executable task success. Supporting dimensions are:

- build/type/test success;
- hidden falsifier success;
- production-path relevance;
- allowed-path compliance;
- Nemosyne authority/governance compliance;
- security/trust-boundary behavior;
- unnecessary-change penalty;
- tool-call reliability;
- correct abstention/escalation;
- latency and peak resource use.

LLM-as-judge may annotate ambiguous work, but must not override failed executable evidence.

## Initial promotion rules

A candidate checkpoint may replace the incumbent only when all are true:

1. zero critical authority/security/secret-leakage violations on the promotion suite;
2. current curriculum level reaches at least 80% executable success over at least 20 eligible hidden tasks;
3. prior unlocked levels regress by no more than 5 percentage points from the incumbent;
4. aggregate hidden score improves by at least 3 percentage points, or an explicitly pre-registered task-family objective improves materially without other material regression;
5. evaluation environment and artifact identities are complete and reproducible.

If the sample is too small for a gate, outcome is `ABSTAIN_INSUFFICIENT_EVIDENCE`, not promotion.

Threshold changes require a separate governed change before seeing the candidate result that would benefit from the change.

## Anti-overfitting controls

- Frozen secret holdout inaccessible to corpus/training workers.
- Public development set for iteration.
- Time-split evaluation on later PRs where possible.
- Deduplication by diff, test semantics and task statement similarity.
- Re-run a stable replay suite after every candidate.
- Periodically introduce freshly mined tasks after the model checkpoint has been frozen.
- Training-data generator cannot read holdout expected outputs or hidden patches.

## Failure diagnosis

Rejected candidates are classified into bounded causes such as:

- repository retrieval/navigation;
- misunderstanding of invariant;
- tool-use failure;
- patch-generation failure;
- insufficient test design;
- authority/governance violation;
- concurrency/lifecycle reasoning;
- over-editing;
- failure to abstain;
- catastrophic forgetting.

Only the diagnosed failure families feed the next data-augmentation round.

## Training-data admission

A candidate example enters the curated training set only when:

- source provenance is known;
- secrets/private material are absent;
- the example is not from a secret eval;
- solution evidence passed the applicable historical tests/review;
- candidate/advisory findings are not presented as accepted facts;
- obsolete or superseded architecture is labelled rather than taught as current authority.

## Model comparison

Every base model receives the same frozen benchmark where technically possible. Selection considers quality, local fit, latency and trainability. A smaller model that is more trainable and reliable may be preferred over a larger model with a slightly higher raw score.

## Reporting

Each experiment records base model, adapter/checkpoint, data manifest hash, eval manifest hash, trainer configuration, start/end time, resource use, score by level/family, violations, promotion decision and diagnostic summary.

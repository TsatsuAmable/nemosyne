# P1-PT6D Training Snapshot & Evaluation Contract — Pre/Post Review Plan

**Date:** 5 September 2026  
**Status:** IMPLEMENTATION / ADVERSARIAL REVIEW ACTIVE  
**Base:** `main@ef9465a8e284f6debbbef175bd427cfd8834d7ba` (#663 / PT6C)

## Bounded objective

Close the remaining PT6 learning-data boundary without starting training or model promotion:

1. materialise immutable L2 derived-gesture training snapshots from the governed durable store;
2. make train/validation/test splits purpose-pseudonym/profile disjoint;
3. preserve frozen explicit label provenance and exact governed-event/consent lineage;
4. keep L3 raw trajectories outside the ordinary training snapshot family;
5. establish a deterministic held-out evaluation-report artifact that PT7/PT8 can consume;
6. preserve erasure reachability by storing immutable source references rather than copying feature vectors into the snapshot.

## Authority and trust boundaries

```text
PT6C governed durable evidence store
        |
        | read-only trusted projection; no principal/deletion handle selected
        v
PT6D L2 snapshot materialiser
        |
        | exact admitted event digest + consent + frozen label provenance
        v
immutable profile-disjoint snapshot
        |
        | validation/test only
        v
PT6D held-out evaluation report
```

The learning plane does not become consent authority, event-admission authority, analytical authority, or model-promotion authority.

## Falsifiers

The tranche is not complete if any of the following is possible:

- raw L3 trajectory records enter an L2 training snapshot;
- product-analytics consent substitutes for derived-learning consent;
- one purpose-scoped profile appears in more than one train/validation/test split;
- a source can rebound a durable row to a different event identity;
- a source can return records newer than the frozen materialisation cutoff;
- model output can manufacture or relabel the frozen human training label;
- evaluation uses the train split;
- evaluation silently drops, duplicates, invents, or re-labels held-out samples;
- abstentions disappear into ordinary misclassification metrics;
- a re-digested report can forge counts/metrics or substitute a different held-out membership;
- the snapshot copies raw feature vectors such that source erasure can no longer make the underlying training datum unreachable.

## Intentional non-goals

- no training job execution;
- no automatic retraining;
- no model registry or deployment/promotion lifecycle;
- no production Postgres/cloud data warehouse claim;
- no raw-trajectory training dataset materialisation;
- no metric threshold that automatically promotes a model;
- no claim of physical/live-human model quality.

## Review focus

- privacy: cross-user leakage, hidden stable identifiers, purpose laundering, raw/L2 collapse;
- reproducibility: immutable digests, exact split membership, deterministic construction;
- learning correctness: frozen labels, complete held-out observations, explicit abstention;
- architecture: SQLite adapter remains replaceable repository-runnable infrastructure; materialiser consumes a persistence-neutral source port;
- operations: bounded reads and envelope sizes fail closed.

## Promotion condition

ADOPT only after focused PT6D tests plus required exact-head CI, CodeQL and approval gates are green and the post-review records no unresolved blocker. Only then may the roadmap/epic mark PT6 `VERIFIED COMPLETE / STOP` and advance to PT7.

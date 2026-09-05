# P1-PT6D Training Snapshot & Evaluation — Post-Implementation Adversarial Review

**Date:** 5 September 2026  
**Status:** ADOPT IF EXACT-HEAD GATES PASS  
**Scope:** PT6D only

## Reviewed production/learning path

```text
PT6C governed SQLite evidence store
  -> read-only PT6D snapshot source
    -> governed envelope revalidation
      -> frozen consent + label provenance extraction
        -> immutable purpose-profile-disjoint snapshot
          -> validation/test-only evaluation report
```

## Findings and fix-forward

### BLOCKER fixed: export NDJSON was an inappropriate learning-source trust boundary

The first materialiser draft accepted purpose-scoped export NDJSON. That would have allowed an external/tampered export artifact to become the profile-grouping input for train/validation/test. Structural governed-event validation can protect event schema/digests, but it cannot independently reconstruct the server consent receipt's principal binding from the receipt token alone.

**Fix:** materialisation now consumes a trusted `GestureTrainingSnapshotSourceV1` port. The repository adapter opens the governed SQLite store read-only and selects only admitted L2 rows. It deliberately does not select `principal_handle`; the only user-grouping identity crossing the boundary is the already-admitted purpose-scoped `profilePseudonymId` inside the event envelope.

### BLOCKER fixed: raw L3 research evidence could not share the ordinary training snapshot path

The source query is constrained to the L2 purpose/family and the materialiser independently revalidates family/purpose. A hostile source returning an L3 event is refused.

### BLOCKER fixed: held-out evaluation completeness and label rebinding

The report builder requires exactly one observation for every selected validation/test sample. Duplicate, missing, extra, profile-rebound and relabelled observations fail closed. Train is not an accepted evaluation split.

### BLOCKER fixed: abstention could otherwise inflate ordinary accuracy

The report records all-sample accuracy, coverage and covered accuracy separately. Abstentions count against all-sample accuracy and are explicit in the confusion matrix.

### BLOCKER fixed: re-digesting a forged summary was insufficient protection

Validation recomputes summary counts/metrics from the confusion matrix and, when supplied the immutable snapshot, verifies the exact held-out split membership digest. Re-digested count and membership substitution are therefore still detected.

## Preserved boundaries

- snapshots contain immutable source references rather than copied feature vectors, preserving governed-source erasure reachability;
- raw trajectories remain separately governed research evidence and are not materialised into the L2 training snapshot;
- no training, retraining, model promotion or rollout is started;
- SQLite is repository-runnable infrastructure behind a persistence-neutral source port, not the declared production datastore;
- evaluation reports bind immutable model/evaluator artifact references but do not define automatic promotion thresholds.

## Residuals explicitly deferred

- PT7: durable artifact/model/runtime registry, training lineage, reproducible jobs, signed manifests and rollout/rollback;
- PT8: actual gesture retraining/evaluation/shadow/canary/update loop;
- deployed production data-store/operations qualification remains separate from this repository-runnable SQLite evidence path;
- physical/live-human model quality remains empirical evidence, not inferred from these contracts.

## Disposition

No unresolved blocker remains in the bounded PT6D design/code review. **ADOPT only if the unchanged PR head passes all required promotion gates.** If those gates are green, PT6 may be marked `VERIFIED COMPLETE / STOP` and the forward implementation sequence advances to PT7.

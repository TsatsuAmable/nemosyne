# P1-PT7 Runtime/Model Registry — Post-Implementation Adversarial Review

**Date:** 5 September 2026  
**Status:** ADOPT IF EXACT-HEAD GATES PASS  
**Scope:** PT7 only

## Reviewed path

```text
PT6 immutable governed snapshot
  -> PT7 reproducible training manifest
    -> exact external/PT8 runner environment
      -> immutable training receipt
        -> operational model registry reference
          -> signed SHADOW
            -> signed CANARY
              -> signed PRODUCTION
                -> exact signed ROLLBACK when required
```

The operational registry references existing model artifacts and runtime authorities. It does not duplicate gesture-intelligence model meaning or `FitnessModelRegistry`/Moneta scoring semantics.

## Findings and fix-forward

### BLOCKER fixed: content digest was incorrectly treated as a unique logical artifact identity

The first filesystem artifact-store draft used one metadata record per content digest. That made identical bytes under two legitimate logical id/version aliases collide, which is not correct content-addressed storage semantics.

**Fix:** immutable blobs are now stored once by SHA-256 while logical aliases are stored separately under hashed id/version keys. The same bytes can be reused safely; one logical id/version still cannot be rebound to different content. Reads verify both alias metadata and blob digest/length.

### BLOCKER fixed: operational MLOps state could have become a competing model authority

PT7 model entries store immutable references to domain model artifacts plus training lineage. They do not carry gesture parameters, ranking weights, representation semantics or analytical meaning. Existing gesture-intelligence and FitnessModel/Moneta authorities remain canonical.

### BLOCKER fixed: reproducibility could have described intent rather than actual execution

The training job manifest freezes data snapshot, feature schema, source commit, code artifact, trainer entrypoint, environment, config, seed, holdout policy and runtime baseline. A successful receipt is accepted only when its actual runner environment equals the frozen manifest and its model/evaluation outputs are immutable references.

### BLOCKER fixed: Research Mode adaptation could silently drift

Runtime registry entries classify every adaptive component. Product Mode may mark an existing component `ADAPTIVE_ALLOWED`; Research Mode rejects that disposition and requires the component to be frozen, an explicit treatment variable, or not applicable when absent.

### BLOCKER fixed: deployment state could be changed by unsigned or out-of-order metadata

Deployment manifests are canonical-SHA-256 digested and Ed25519 signed. The signing key id is inside the signed content. Registry application verifies the configured operator authority, exact registered model/runtime/training/evaluation lineage, prior deployment chain, lifecycle order and one-time manifest application.

The allowed normal path is:

`CANDIDATE -> SHADOW -> CANARY -> PRODUCTION`

Rollback requires the exact current production deployment, exact failed model artifact, and a target that previously held production. Replaying the same signed manifest is refused.

### BLOCKER fixed: operational observability could become another user-level telemetry channel

PT7 observations use a closed schema containing only model registry reference, runtime registry reference, outcome, timestamp and bounded aggregate count. Extra identifiers such as profile/user/session fields fail closed. Candidate models cannot claim runtime distribution evidence.

## Staged evidence policy

Human promotion authority remains mandatory. A signed operator-review artifact is required by every deployment manifest. Review policy must cite the model-specific held-out report and applicable known-answer/failure/stability evidence before progression.

PT7 deliberately does not create a universal auto-promotion score. Gesture reports retain abstention/coverage semantics; Moneta retains group-disjoint statistical evidence. PT8/PT9 may add model-specific qualification machinery without weakening the signed human promotion boundary.

## Remaining boundaries

PT7 does **not** prove:

- that Python training actually reproduces a model byte-for-byte; PT8 owns the concrete gesture training pipeline;
- that a trained model is better than bootstrap on real users;
- that canary traffic routing exists in a deployed service;
- that filesystem artifact storage is the production storage backend;
- that model promotion is safe without the model-specific evaluation/known-failure/stability evidence referenced by operator review;
- any deployed learning-service claim.

## Disposition

**ADOPT if and only if the unchanged PT7 head passes required Node 24, CodeQL, approval and repository CI gates.**

No unresolved blocker is known in the bounded PT7 diff at the time of this review record.

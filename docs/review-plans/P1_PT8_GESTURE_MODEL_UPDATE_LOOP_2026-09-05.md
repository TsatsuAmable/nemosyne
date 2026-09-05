# P1-PT8 gesture model update loop pre-implementation review

**Risk:** HIGH. This tranche connects governed learning evidence to model registration and staged runtime deployment.

## Invariant

A gesture model may enter shadow/canary/production only when it is the exact output of a reproducible PT7 `GESTURE_MODEL` job over the exact immutable PT6 L2 snapshot, carries complete held-out validation/test evidence for that exact model/snapshot, has stage-appropriate model-specific qualification evidence, and is explicitly approved by a content-addressed human review before the PT7 signed deployment authority is invoked.

No scalar metric, shadow comparison, canary count, or model prediction may become automatic promotion authority.

## Authority and production path

PT6 governed L2 evidence -> immutable purpose/profile-disjoint training snapshot -> PT7 reproducible training manifest/receipt -> PT6D held-out evaluation report -> PT8 gesture-specific qualification + human review -> PT7 operational model registry -> signed SHADOW -> CANARY -> PRODUCTION / exact rollback.

PT8 orchestrates immutable learning artifacts and promotion evidence. It does not create a TypeScript scientific/analytical fallback or redefine gesture labels/model semantics. The trainer remains the immutable PT7 trainer artifact/entrypoint and may execute in the independent offline training ecosystem.

## Primary failure modes

- training receipt/model/report rebound to a different snapshot, environment or model artifact;
- validation/test leakage or relabelling disguised by plausible aggregate metrics;
- re-digested or structurally forged qualification evidence accepted as real model-specific evidence;
- Product/Research treatment state ignored during adaptive rollout;
- shadow/canary evidence pre-claimed before the stage has run;
- low-level metrics silently converted into automatic deployment authority;
- skipped/replayed deployment stages or rollback to a model that never held production;
- rollback review not bound to the exact currently failing production model.

## Falsifying evidence

`tests/pt8-gesture-model-update-loop.test.ts` attacks exact snapshot/job/report lineage, forged qualification digests, frozen runtime adaptation, stage-specific human review, signed shadow/canary/production sequencing and exact rollback.

Existing PT6D/PT7 falsifiers remain authoritative for snapshot/report integrity, artifact lineage, signatures, deployment replay and rollback state.

## Non-goals

- no new gesture classifier mathematics or TypeScript analytical authority;
- no claim of physical/live-human gesture quality;
- no automatic retraining scheduler;
- no production learning-service deployment;
- no Moneta learning/promotion loop (PT9);
- no claim that repository-run shadow/canary evidence equals production cohort evidence.

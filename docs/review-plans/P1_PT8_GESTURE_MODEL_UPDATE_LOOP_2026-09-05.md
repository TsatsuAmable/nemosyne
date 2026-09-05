# P1-PT8 gesture model update loop pre-implementation review

**Risk:** HIGH. This tranche connects governed learning evidence to concrete candidate model bytes, model registration and staged runtime deployment.

## Invariant

A gesture model may enter shadow/canary/production only when it is the exact output of a reproducible PT7 `GESTURE_MODEL` job over the exact immutable PT6 L2 snapshot, carries complete held-out validation/test evidence for that exact model/snapshot, has stage-appropriate model-specific qualification evidence, and is explicitly approved by a content-addressed human review before the PT7 signed deployment authority is invoked.

No scalar metric, shadow comparison, canary count, or model prediction may become automatic promotion authority. Research/frozen treatments may not adapt.

## Authority and production path

PT6 governed durable L2 evidence -> immutable purpose/profile-disjoint training snapshot -> exact feature resolution against that snapshot -> PT7 reproducible training manifest/environment/trainer identity -> PT8 Python MLP training + candidate ONNX export -> PT7 content-addressed artifact store/receipt -> PT6D held-out evaluation report -> PT8 gesture-specific qualification + human review -> PT7 operational model registry -> signed SHADOW -> CANARY -> PRODUCTION / exact rollback.

The Python trainer reuses the frozen gesture model shape and 56-dimensional feature contract; it does not redefine gesture semantics or create a second product analytical authority. Validation alone controls early stopping. The test split is evaluated only after weights freeze. The exporter writes an immutable candidate output directory and never mutates live runtime assets. TypeScript owns orchestration/provenance, not classifier mathematics.

The historical `training/retrain.ts` + `export_onnx.py` path is a bootstrap/research reproduction path only and must fail closed by default because its old scalar quality bar and direct asset overwrite would otherwise form a competing promotion authority.

## Primary failure modes

- training receipt/model/report rebound to a different snapshot, environment, trainer or model artifact;
- governed source rows missing, added or rebound after the snapshot is frozen;
- validation/test leakage or relabelling disguised by plausible aggregate metrics;
- Python/exporter output not bound to exact job version/model bytes/frozen input/output contract;
- re-digested or structurally forged qualification evidence accepted as real model-specific evidence;
- Product/Research treatment state ignored during adaptive rollout;
- shadow/canary evidence pre-claimed before the stage has run;
- low-level metrics silently converted into automatic deployment authority;
- legacy scalar-gated retraining overwriting live assets outside the registry;
- skipped/replayed deployment stages or rollback to a model that never held production;
- rollback review not bound to the exact currently displaced production model.

## Falsifying evidence

- `tests/pt8-gesture-training-feature-resolution.test.ts` exercises the real PT6C SQLite governed-store projection -> PT6D snapshot -> PT8 exact feature-resolution seam and rejects source identity rebinding.
- `tests/pt8-gesture-model-update-loop.test.ts` attacks exact snapshot/job/report lineage, forged qualification digests, frozen runtime adaptation, stage-specific human review, signed shadow/canary/production sequencing and exact rollback.
- the concrete `NodeGestureTrainingExecutorV1` additionally checks configured immutable trainer/environment identity, candidate model-card/ONNX digest/version/shape identity, and stores outputs only through PT7's artifact store.

Existing PT6D/PT7 falsifiers remain authoritative for snapshot/report integrity, artifact lineage, signatures, deployment replay and rollback state.

## Non-goals

- no new gesture label/feature semantics and no TypeScript analytical fallback;
- no claim of physical/live-human gesture quality;
- no automatic retraining scheduler;
- no automatic metric-based promotion;
- no production learning-service deployment;
- no Moneta learning/promotion loop (PT9);
- no claim that repository-run shadow/canary evidence equals a production cohort.

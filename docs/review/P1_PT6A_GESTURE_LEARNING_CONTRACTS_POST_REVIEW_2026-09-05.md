# P1-PT6A Gesture-Learning Contracts — Post-Implementation Adversarial Review

**Date:** 5 September 2026  
**Base:** `main@ed9bd1611f4d4f2f0b3f237a2520699e4c1c6582`  
**Disposition:** **ADOPT PT6A if the unchanged exact head passes required promotion gates**

## Scope reviewed

PT6A is intentionally a contract-first tranche. It freezes gesture-learning evidence semantics before any dormant client uploader or new durable learning store is enabled.

Reviewed surfaces:

- `src/vr/input/GestureLearningContracts.ts`
- `src/vr/input/GestureRetrainService.ts`
- `tests/gesture-learning-contracts.test.ts`
- `tests/gesture-retrain.test.ts`
- existing governed-purpose/data-class contracts from PT3/PT4
- dormant `GestureCaptureUploader` and existing gesture capture/retraining prototypes as hostile compatibility inputs, not authorities to preserve

## Findings and fix-forward

### 1. Existing boolean consent is not a learning consent authority

`GestureCaptureUploader` currently accepts `consent` and `rawTrajectoryConsent` booleans and derives a profile hash from a consent token/device salt. RFC 0003 explicitly rejects global/unversioned consent for learning and biometric-like collection.

**Disposition:** PT6A does not enable or wire that uploader. The new contract requires explicit purpose-scoped authorization evidence and keeps `derived-gesture-learning` distinct from `raw-trajectory-research`. Product analytics consent is not accepted as learning authority, and L2 derived-feature authorization cannot imply L3 raw-trajectory authorization.

### 2. Existing evaluator could manufacture "user-disjoint" evidence

`GestureRetrainService.evaluateUserDisjoint()` previously filtered training profiles, then silently fell back to evaluating the full input set when nothing remained. Complete train/test user overlap could therefore be reported under `userDisjointAccuracy` and `userDisjointMacroF1`.

**Fix:** no held-out profiles now yields `NO_HELD_OUT_PROFILES`, zero samples/profiles, zero metrics and `passedBar=false`. There is no fallback evaluation path.

### 3. Missing gesture classes were awarded perfect F1

The prior evaluator assigned F1=1.0 when a gesture class had no support. A held-out set containing only a subset of the six declared classes could therefore inflate macro-F1 and potentially pass a six-class gate.

**Fix:** unsupported classes score zero, are enumerated in `missingClasses`, make report validity `MISSING_CLASS_SUPPORT`, and block `passedBar` regardless of raw accuracy.

### 4. First snapshot draft was tamper-evident but not replayable

The first PT6A implementation stored only a digest of the split seed and omitted the train/validation/test fractions. That was sufficient to bind the manifest contents, but insufficient for an independent future training job to reconstruct why a profile landed in a particular split.

**Fix:** the immutable snapshot now carries a secret-free `splitSeedId` plus explicit train/validation/test fractions. Validation reconstructs deterministic profile ownership from those declared inputs and the frozen `profile-disjoint-v1` policy.

### 5. A re-digested manifest could otherwise lie about its split policy

A content digest alone proves that a manifest has not changed since its digest was calculated. It does not prove that the manifest obeys the policy it names; a buggy or hostile producer could move whole profiles between splits and calculate a fresh valid digest.

**Fix:** snapshot validation recomputes the expected profile owner from all declared profile IDs, the replayable seed and split fractions. A policy-inconsistent but freshly re-digested manifest is rejected with `SPLIT_POLICY_MISMATCH`.

### 6. Model predictions must not silently become labels

PT6A freezes three label sources:

- `EXPLICIT_CONFIRMATION`: assigned label must equal the model prediction;
- `EXPLICIT_CORRECTION`: assigned label must differ from the model prediction;
- `PROTOCOL_TARGET`: target is supplied independently of model output and therefore carries no prediction in the label record.

This prevents a model prediction from being laundered into training truth by a generic `confirmed=true` field without provenance.

### 7. Row-wise splitting is forbidden

Every admitted derived-learning sample carries a purpose-scoped learning profile pseudonym. Snapshot construction groups by that pseudonym before assigning train/validation/test. All rows from one profile remain in exactly one split; duplicate record identity and mixed feature-schema identity are rejected.

## Residual boundary / next tranche

PT6A deliberately does **not** claim or implement:

- a live derived-feature or raw-trajectory event family;
- a learning consent grant/revoke/capture authority;
- server ingestion or durable learning storage;
- learning export/erasure traversal;
- a production endpoint for `GestureCaptureUploader`;
- raw trajectory upload;
- training execution, model promotion or deployment.

Those are PT6B+ work. The next tranche should create separately governed L2 and L3 event families and consent/lifecycle authorities using the PT3/PT4 trust-boundary model, then replace or retire the ad-hoc boolean uploader boundary. It must not reuse Product Analytics purpose consent or a cross-purpose profile hash.

## Promotion disposition

**ADOPT**, conditional on unchanged exact-head typecheck, lint, architecture policy, full Vitest coverage, Rust tests, production build/smoke, CodeQL and approval gate, with no unresolved review threads or `main` drift.

PT6A improves evidence truthfulness before collection begins. It does not convert old prototypes into production authorities and does not make any human/model quality claim from the new contracts alone.

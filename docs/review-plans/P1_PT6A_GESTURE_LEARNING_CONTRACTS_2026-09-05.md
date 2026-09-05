# P1-PT6A Gesture-Learning Contracts — Pre-Implementation Adversarial Review

**Date:** 5 September 2026  
**Base:** `main@ed9bd1611f4d4f2f0b3f237a2520699e4c1c6582`  
**Scope:** contract-first PT6 entry tranche; no production collection enablement

## Why this tranche is first

PT6 introduces learning data that is more sensitive and more scientifically dangerous than ordinary product analytics. Existing prototypes are useful but cannot be promoted as-is:

- `GestureCaptureUploader` uses boolean `consent` / `rawTrajectoryConsent`, derives a stable profile hash from a consent token plus device salt, and targets an ad-hoc `/api/gesture-ingest` endpoint. RFC 0003 explicitly rejects a global telemetry/consent boolean as authority and requires purpose-scoped consent, purpose-specific pseudonyms, registered lifecycle policy and governed admission.
- `CaptureRecorder` records raw trajectories under an armed target label but has no governed consent/provenance contract.
- `GestureRetrainService.evaluateUserDisjoint()` silently falls back to evaluating *all* samples when no profile is actually held out, while still returning fields named `userDisjointAccuracy` / `userDisjointMacroF1`. That can turn complete train/test user overlap into apparently valid evidence.
- the evaluator currently awards F1=1.0 to unsupported gesture classes, so a test set missing classes can inflate macro-F1 despite the stated six-class quality bar.

PT6A therefore freezes evidence semantics before any dormant collector is connected to PT4 transport/storage.

## Intended changes

1. Add a versioned PT6 gesture-learning contract module that:
   - distinguishes L0/L1/L2/L3 minimisation levels;
   - makes `derived-gesture-learning` and `raw-trajectory-research` distinct purposes;
   - defines explicit label provenance (`EXPLICIT_CONFIRMATION`, `EXPLICIT_CORRECTION`, `PROTOCOL_TARGET`);
   - forbids a model prediction from silently becoming ground truth;
   - represents admitted derived-learning samples by immutable content references;
   - builds deterministic immutable train/validation/test snapshots by *profile group*, never by row;
   - proves split profile sets are disjoint and refuses snapshots with fewer than three profiles.
2. Harden `GestureRetrainService` so "user-disjoint" means an actually held-out profile set:
   - no fallback to training profiles;
   - missing held-out profiles is an invalid report, not an alternate evaluation mode;
   - unsupported gesture classes score 0 rather than 1 and make the six-class quality gate invalid;
   - reports expose validity and missing-class evidence explicitly.
3. Add falsifiers for overlap, duplicate sample identity, label-provenance contradictions, insufficient profile groups and evaluator leakage.

## Adversarial attacks to defeat

### A. Product analytics consent accidentally authorizes learning

L1 product analytics is not L2 derived gesture learning. PT6 contracts must encode the learning purpose explicitly and never accept a generic boolean or product-analytics receipt as sufficient evidence.

### B. Raw trajectory consent is inferred from derived-feature consent

L3 raw trajectories are highly sensitive and use the separate `raw-trajectory-research` purpose. No L2 grant or record may imply L3 authorization.

### C. Cross-purpose pseudonyms become a universal user correlator

A snapshot consumes only purpose-scoped derived-learning pseudonyms. It must not require an account ID, consent token, device salt, raw-trajectory pseudonym or product-analytics pseudonym.

### D. Model predictions become labels by self-confirmation

A predicted class is not training truth merely because the model emitted it. Label provenance must state whether a human explicitly confirmed/corrected the prediction or a frozen protocol supplied the target. Confirmation requires predicted == assigned; correction requires predicted != assigned; protocol target is independent of model output.

### E. Row-wise split leaks one user across train/test

Snapshot splitting is by profile pseudonym. Every record for one derived-learning profile must land in exactly one split.

### F. "User-disjoint" evaluator has no held-out users

This is the known current defect. The evaluator must return invalid/fail-closed evidence, not fall back to all samples.

### G. Missing gesture classes improve macro-F1

Unsupported classes cannot receive perfect F1. A six-class quality gate requires support for all six declared classes in the held-out evaluation set.

### H. Snapshot identity changes with input ordering

Snapshot construction must sort/group deterministically and content-address the canonical manifest. Reordering identical input records must produce the same split membership and digest.

### I. PT6A is mistaken for a live collection pipeline

This tranche does **not** enable `GestureCaptureUploader`, create a server endpoint, create durable learning stores, grant consent, upload raw trajectories, or claim erasure/export coverage for learning records. Those require a later PT6 governed-admission/lifecycle slice after this contract is reviewed.

## Promotion boundary

PT6A may be promoted only if exact-head type/lint/architecture, full coverage, Rust, production smoke, CodeQL and approval gates pass, and post-implementation review finds no path that manufactures labels, cross-links purposes, leaks profiles across splits or reports non-held-out evaluation as user-disjoint.

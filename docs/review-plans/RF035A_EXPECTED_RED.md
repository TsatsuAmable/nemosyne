# RF-035A expected-red checkpoint

**Lifecycle:** Historical checkpoint; not instructions for current work.

At this historical checkpoint, the branch contained the adversarial contract and `tests/rf035-worker-resident-registration.test.ts` **without the production fix**.

Expected pre-fix failure: after the first successful async mutation, `AtlasCore.applyAnalysisAsync()` calls `_setWorkerPayloadFromDataset()` even though `WorkerAnalyticalPort` has already recorded the mutation output fingerprint as resident. `Dataset.toJSON()` therefore runs and the new test's `expect(toJson).not.toHaveBeenCalled()` must fail.

This checkpoint was recorded to distinguish a genuinely falsifying test from a test written after the implementation that merely agrees with it. At the time, production changes were gated on establishing this expected-red state. This is historical source-level falsification evidence, not a completed red CI run; see the [post-implementation review](RF035A_WORKER_RESIDENT_REGISTRATION_POST_REVIEW_2026-08-28.md).

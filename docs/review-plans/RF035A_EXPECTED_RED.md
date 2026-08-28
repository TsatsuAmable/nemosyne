# RF-035A expected-red checkpoint

The branch currently contains the adversarial contract and `tests/rf035-worker-resident-registration.test.ts` **without the production fix**.

Expected pre-fix failure: after the first successful async mutation, `AtlasCore.applyAnalysisAsync()` calls `_setWorkerPayloadFromDataset()` even though `WorkerAnalyticalPort` has already recorded the mutation output fingerprint as resident. `Dataset.toJSON()` therefore runs and the new test's `expect(toJson).not.toHaveBeenCalled()` must fail.

This checkpoint exists to distinguish a genuinely falsifying test from a test written after the implementation that merely agrees with it. The next commit may change production code only after this expected-red state is established.
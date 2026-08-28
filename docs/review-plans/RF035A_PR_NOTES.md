# RF-035A draft PR notes

## Summary

Remove redundant O(N) worker-registration snapshots from chained async mutations without changing mutation-result semantics.

## Adversarial checkpoint

The branch intentionally committed the failing residency regression before production changes. Pre-fix expected failure: Atlas serializes the mutation output with `Dataset.toJSON()` immediately after the Worker has already adopted the Rust output handle.

## Intended bounded fix

- add a read-only generation/fingerprint residency query to the execution-port boundary;
- implement it from `WorkerAnalyticalPort`'s existing `_registered` authority;
- consult residency before Atlas constructs a worker payload;
- clear the cached registration payload after a mutation only when the active port proves the output resident;
- lazily rematerialize JSON after generation/recovery loss.

## Deferred

Worker -> JS full `DatasetJSON` mutation result removal, handle-only presentation state, mixed/graph compact transfer, browser/GC/Quest measurement.
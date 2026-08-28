# PR notes — RF-051 NTC1 worker registration fix-forward

This tranche exists because merged-state review of #478 found a production-boundary blocker that its shape-only capacity tests did not exercise. The implementation restores the existing NTC1/Rust typed-ingest authority; it does not create a new format or broaden the scientific contract.

Issue #477 is reconciled by the roadmap changes in this tranche and should close when the PR merges.

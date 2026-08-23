## Summary

Describe what changed and why. Keep this focused on user, investigator, or engineering impact.

## Migration slice

If this contributes to the Moneta migration, name the migration-ledger row advanced by this PR. If it does not advance a migration row or fix a blocker, explain why it belongs on the critical path.

## Risk surface

Check every area materially affected by this change:

- [ ] Analytical / statistical correctness
- [ ] Rust ↔ WASM ↔ TypeScript boundary
- [ ] Dataset ingest, identity, serialization, or reproducibility
- [ ] WebXR / VR interaction or spatial UI
- [ ] Rendering performance or large-dataset performance
- [ ] Security, privacy, permissions, or untrusted input
- [ ] Build, CI, deployment, or dependencies
- [ ] None of the above

For checked areas, briefly state the main failure mode considered and how it was mitigated.

## Focused verification

Run the smallest ownership-aligned checks that prove this PR's claims. The full suite, broad coverage, device/browser matrix, fuzzing, and deep performance validation belong at integration/milestone checkpoints unless the PR directly changes those surfaces.

- [ ] Typecheck / compile checks relevant to changed code
- [ ] Focused affected tests
- [ ] Rust tests when Rust-owned behavior changed
- [ ] Focused JS/WASM boundary tests when the boundary changed
- [ ] Relevant build or WebXR/browser smoke test when that surface changed
- [ ] Benchmark/performance evidence when a hot path materially changed

List the exact commands/checks run and their results.

## Correctness evidence

What invariant, expected behavior, or acceptance criterion demonstrates that this change is correct rather than merely non-crashing?

## Review disposition

Review findings use the migration-completion policy:

- **BLOCKER** — correctness, security, reproducibility/data integrity, Rust-authority, required compatibility, material performance, or required-gate failure. Fix before merge.
- **DEFER** — valid pre-preview/hardening work that does not invalidate this slice. Track it; do not expand this PR.
- **SUGGESTION** — optional improvement with no demonstrated failure mode. Non-blocking.

Call out deliberate tradeoffs and known deferred work. Reviewers should stay inside the declared scope unless they identify a BLOCKER.
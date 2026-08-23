## Summary

Describe what changed and why. Keep this focused on user, investigator, or engineering impact.

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

## Verification

List the exact checks run and their results. Include regression tests for bug fixes where feasible.

- [ ] Typecheck
- [ ] Lint
- [ ] Unit / integration tests
- [ ] Rust tests
- [ ] Production build
- [ ] Relevant WebXR / browser smoke test
- [ ] Benchmark or performance evidence when a hot path changed

## Correctness evidence

What invariant, expected behavior, or acceptance criterion demonstrates that this change is correct rather than merely non-crashing?

## Review notes

Call out deliberate tradeoffs, deferred work, migration concerns, or areas where Copilot/human reviewers should concentrate.

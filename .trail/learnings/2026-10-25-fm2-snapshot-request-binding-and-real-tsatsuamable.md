---
title: FM2 snapshot request binding and real Worker compilation repair
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-snapshot
touches:
  - docs/work/FM2_RUST_DIRECT_DISTRIBUTION_BINDING_V1.md
  - src/atlas/AtlasCore.ts
  - src/atlas/ports/InlineAnalyticalPort.ts
  - src/atlas/ports/WorkerAnalyticalPort.ts
  - src/moneta/representation/DirectDistributionBindingV1.ts
  - src/moneta/representation/DirectDistributionReplayCarrierV1.ts
  - src/session/NemosyneSession.ts
  - src/wasm/runtime/SemanticEmbodimentBridge.ts
  - tests/fm2-replay-governed-direct-distribution-wasm.test.ts
  - tests/fm2-rust-direct-distribution-binding-wasm.test.ts
---

## Decided
The direct-distribution Rust source now embeds the complete bounded request, including histogram and ECDF controls. Inline, Worker, Atlas, and replay-carrier boundaries compare that embedded request with caller intent before admitting the binding. Normal Atlas compilation retains the validated binding/request pair so session serialization and direct export can persist the carrier without a second analytical capture. Real separate-Node-Worker compilation, mismatch refusal, persistence, and replay are covered.

## Tried and ruled out
Keeping request equivalence only in transport metadata or relying on source digests was insufficient: different requests can collapse to identical empirical geometry. A test that stubs `self` is not evidence for production Worker compilation, so the regression uses the production Worker module in a separate Node worker thread.

## Watch out
`trail check` still reports the inherited FM2 lexical conflicts in retained plan/work-record prose; those are provenance wording matches, not semantic conflicts with this repair. Full CI, cargo, and browser qualification remain unrun.

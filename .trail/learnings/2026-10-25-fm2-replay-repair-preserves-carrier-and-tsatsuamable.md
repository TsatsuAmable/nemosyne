---
title: FM2 replay repair preserves carrier and Worker authority
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-replay
touches:
  - docs/work/FM2_RUST_DIRECT_DISTRIBUTION_BINDING_V1.md
  - src/atlas/ports/WorkerAnalyticalPort.ts
  - src/session/NemosyneSession.ts
  - tests/fm2-replay-governed-direct-distribution-wasm.test.ts
  - wasm/src/moneta/distribution_embodiment.rs
---

## Decided
The FM2 replay repair selects the validated direct-carrier identity over stale representation history after dataset mutation. Worker transport now requires Rust-produced kernel provenance and the Rust direct producer records that provenance for the result boundary.
## Tried and ruled out
A TypeScript-generated provenance fallback was not used; the real Rust producer records the operation envelope. A mock-only regression was not used; the mutation and forged-claim checks run through real WASM and a real Node Worker thread.
## Watch out
trail check still reports the known 20 inherited lexical conflicts from earlier FM2 work; the repair does not reintroduce those ruled-out paths. Remote main recheck was unavailable because GitHub DNS failed after the earlier verified merge-base check.

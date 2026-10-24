---
title: FM2 governed direct-distribution replay carrier
author: Tsatsuamable
date: 2026-10-24
branch: director/20261024-fm2-replay
touches:
  - docs/work/FM2_RUST_DIRECT_DISTRIBUTION_BINDING_V1.md
  - src/atlas/AtlasCore.ts
  - src/session/InvestigationReplayRunner.ts
  - src/session/NemosynePackage.ts
  - src/session/NemosyneSession.ts
  - tests/config/test-groups.ts
  - docs/superpowers/plans/2026-10-24-fm2-replay.md
  - src/moneta/representation/DirectDistributionReplayCarrierV1.ts
  - tests/fm2-replay-governed-direct-distribution-wasm.test.ts
---

## Decided
Persist the Rust-issued direct empirical-distribution binding as a versioned closed carrier containing the exact bounded request, sourceJson digest, receipt identity, and closed consumer use. Package it as an additive digest-bound entry and replay it only by reconstructing the dataset and invoking the live Rust producer through Atlas.

## Tried and ruled out
A TypeScript-authored receipt or trusting a rehashed source digest was rejected: replay must compare the fresh Rust binding byte-for-byte and fail closed for altered, missing, stale, mismatched, wrong-consumer, kernel, and dataset identities. Legacy V1/V2 packages remain on their existing replay path.

## Watch out
A restored carrier may supply the kernel identity only when the active Atlas has no kernel. If a live kernel identity exists, export must retain that live correspondence and reject a stale carrier rather than laundering its identity.

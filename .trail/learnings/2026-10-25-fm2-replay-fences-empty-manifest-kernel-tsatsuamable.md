---
title: FM2 replay fences empty manifest kernel identities
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-replay
touches:
  - docs/work/FM2_RUST_DIRECT_DISTRIBUTION_BINDING_V1.md
  - src/moneta/representation/DirectDistributionReplayCarrierV1.ts
  - src/session/InvestigationReplayRunner.ts
  - src/session/NemosynePackage.ts
  - src/session/NemosyneSession.ts
  - tests/fm2-replay-governed-direct-distribution-wasm.test.ts
---

## Decided
Direct-distribution packages must carry non-empty, corresponding kernelVersion and analyticalKernelVersion identities. V2 direct-carrier export writes the Rust carrier identity into analyticalKernelVersion; package pack/unpack and direct replayPayload reject empty or missing identities before parsing or replay.

## Tried and ruled out
Using analyticalKernelVersion ?? kernelVersion or a truthiness guard was unsafe: an empty V2 kernelVersion could fall back to the carrier self-claim and skip the manifest comparison. Requiring only one field also let a stale counterpart survive, so direct-carrier manifests require both identities to correspond.

## Watch out
The real-WASM replay suite is the authoritative regression: preserve the malformed identity cases alongside stale, altered, forged, dataset-drift, worker, and legacy-path coverage. trail check may flag lexical conflicts against the older FM2 learning even when the implementation follows its Rust-issued binding rule.

---
title: FM2 replay verification must follow durable transformations
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-replay
touches:
  - docs/work/FM2_RUST_DIRECT_DISTRIBUTION_BINDING_V1.md
  - src/atlas/AtlasCore.ts
  - src/session/InvestigationReplayRunner.ts
  - tests/fm2-replay-governed-direct-distribution-wasm.test.ts
---

## Decided
The final FM2 replay repair keeps closed carrier/package validation early, replays and verifies durable analytical operations first, then compares the reconstructed analytical fingerprint and performs fresh Rust direct-carrier verification. Synchronous AtlasCore analysis now advances the inline execution-port fence so a carrier can be captured from the resulting state.

## Tried and ruled out
The pre-fix real-WASM regression refused a valid carrier captured after a durable filter because replay checked the original portable dataset before the filter event. Moving only the fresh verification and envelope reconstructed-identity checks post-replay fixed the scenario without changing V1/V2/V3/V4 compatibility or TypeScript receipt authority. trail check lexical conflicts are expected: moved guarded carrier code and the concise FM2 note mention terms from earlier fail-closed coverage, not the ruled-out mock-only or manifest-trust paths.

## Watch out
Keep the transformed-state positive, altered-transformation refusal, forged-source, wrong-consumer, reserved V1, separate Worker, and stale-worker real-WASM tests together. The remaining hosted independent review and exact-head CI are supervisor-owned; this commit records self-check only.

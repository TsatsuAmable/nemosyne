---
title: FM2 replay Worker production-path evidence
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-replay
touches:
  - tests/fm2-replay-governed-direct-distribution-wasm.test.ts
---

## Decided
FM2 direct-distribution replay now has a real Worker-thread session regression: the production Atlas async capture registers and executes through the Worker-owned Rust runtime, survives serialize/restore/export, and replays in a fresh Worker Rust instance. The same suite holds a real result across dataset replacement to prove recycle cancellation and fresh registration.

## Tried and ruled out
Inline AtlasCore tests and transport-only Worker tests were insufficient production-path evidence. No production implementation change was needed because AtlasCore already fences the async result; the missing assurance was the end-to-end Worker session test.

## Watch out
Clean-room restored direct carriers remain exportable as unverified artifacts because their carrier identity is not live kernel identity. A rehashed forged restored carrier is now explicitly tested to export but to receive REFUSED, never VERIFIED, from fresh Rust replay. Keep that distinction visible until export refusal or an explicit package verification state is designed.

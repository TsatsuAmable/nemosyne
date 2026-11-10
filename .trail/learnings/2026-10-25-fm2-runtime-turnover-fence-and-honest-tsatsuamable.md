---
title: FM2 runtime-turnover fence and honest browser replay evidence
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-browser
touches:
  - docs/superpowers/plans/2026-10-25-fm2-browser.md
  - src/app/investigation/replayAttestationText.ts
  - src/atlas/AtlasCore.ts
  - tests/config/test-groups.ts
  - tests/fm2-desktop-direct-critique.test.ts
  - tests/smoke/fm2-browser-direct-loop.spec.ts
  - tests/tec1-f1-replay-attestation-text.test.ts
---

## Decided

AtlasCore now gates active Rust-issued direct compilation reads and direct REJECT/PREFER mutations on the current runtime snapshot capability. Execution-port turnover disables the visible controls and preserves existing feedback links without permitting stale lineage.

The browser replay surface now exposes the verified direct consumer, receipt, and source identities. The FM2 plan and smoke evidence are scoped to constrained alternative lineage/non-promotion, Save now/checkpoint, carrier identity, and visible replay attestation; it does not claim a separate compare or investigator-created branch operation.

## Tried and ruled out

A UI-only currentCompilation fence would leave direct Atlas/NIL mutation seams able to reach the retained aggregate. The authoritative fence belongs in AtlasCore and is exercised with real Rust/WASM before port replacement.

## Watch out

trail check still reports the inherited lexical conflicts in the retained FM2 plan document; docs:check passes and the conflicts are called out for the commit/PR handoff. The desktop lifecycle test is registered in the real-WASM Vitest lane so its turnover regression boots the actual producer.

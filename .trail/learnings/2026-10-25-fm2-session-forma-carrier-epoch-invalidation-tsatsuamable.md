---
title: FM2 session Forma carrier epoch invalidation
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-browser
touches:
  - src/atlas/AtlasCore.ts
  - src/session/NemosyneSession.ts
  - tests/fm2-worker-direct-distribution-wasm.test.ts
---

## Decided
NemosyneSession Forma carriers now bind to AtlasCore.datasetReplacementEpoch, a private runtime-local epoch advanced only after successful dataset incarnation replacement. This covers row and typed loads, restore/current-view replacement, committed analytical mutations, and reset; same-fingerprint typed replacement still invalidates cached bytes.

## Tried and ruled out
Fingerprint-only invalidation is insufficient because a fresh same-fingerprint load is a distinct authoritative incarnation. Clearing only Atlas aggregate Forma state is insufficient because loadFromJSON rehydrates private session bytes that serialize/export can prefer.

## Watch out
The focused regression uses the real WASM bridge and production Worker handler: malformed typed bytes preserve epoch and carrier, while valid typed turnover drops the getter and serialized Forma snapshot and fails closed for Forma-preserving export. trail check still reports inherited lexical conflicts in the retained docs/superpowers FM2 plan; no historical document was changed.

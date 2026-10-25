---
title: FM2 trail check inherited conflict disposition
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-replay
touches:
  - tests/fm2-replay-governed-direct-distribution-wasm.test.ts
---

## Decided
The new FM2 Worker evidence test is compatible with the existing branch despite trail check lexical conflicts in inherited FM2 source and retained work documents. Those conflicts describe the guarded Rust-issued carrier and identity checks already present on this branch, not the new test change.

## Tried and ruled out
Rewriting or deleting the retained FM2 learning/document wording to satisfy lexical matching would damage provenance and is outside this repair. The implementation and test paths remain fail-closed and fresh-Rust-backed.

## Watch out
Keep the trail check disposition in the commit/PR description until the inherited lexical-conflict baseline is intentionally reconciled by the FM2 documentation owner.

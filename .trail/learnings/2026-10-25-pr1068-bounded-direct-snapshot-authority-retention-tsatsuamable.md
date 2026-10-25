---
title: PR1068 bounded direct snapshot authority retention
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-snapshot
touches:
  - src/atlas/AtlasCore.ts
  - tests/fm2-replay-governed-direct-distribution-wasm.test.ts
---

## Decided
PR1068 AtlasCore direct-distribution recompilation now revokes the prior module-local snapshot ledger entry before issuing the replacement, keeping the strong snapshot Set bounded to one while preserving the active capture carrier for session serialization.
## Tried and ruled out
Calling the lifecycle clear helper on ordinary recompilation would erase the active carrier; rollback must restore prior authority only when runtime identity and candidate capture still match. trail check conflicts are inherited lexical matches in retained FM2 plan/work documents, not introduced by this repair.
## Watch out
A late failure after a generation, dataset, or port transition must not restore old WeakMap authorization. The regression is production-path real-WASM Worker/replay coverage and also checks failed recompilation, stale Forma admission, fresh Forma admission, and the private Set size.

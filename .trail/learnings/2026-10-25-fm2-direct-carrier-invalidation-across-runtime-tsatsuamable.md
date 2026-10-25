---
title: FM2 direct carrier invalidation across runtime transitions
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-snapshot
touches:
  - src/atlas/AtlasCore.ts
  - src/session/NemosyneSession.ts
  - tests/fm2-replay-governed-direct-distribution-wasm.test.ts
---

## Decided

FM2 direct-distribution captures are runtime capabilities. AtlasCore now clears the active capture on execution-port, generation, kernel, dataset, restore, and dispose transitions. NemosyneSession separately marks live Atlas carriers and drops their serialized bytes when Atlas no longer exposes the live capture; restored snapshot carriers remain portable across fresh runtimes.

## Tried and ruled out

Clearing only AtlasCore was insufficient because NemosyneSession can retain serialized carrier bytes from an earlier live capture. Clearing every session carrier would break valid restored-snapshot export, so the session tracks live versus restored provenance in memory without changing the persisted carrier format.

## Watch out

The real-WASM regression must exercise normal Atlas compilation/adoption, then generation replacement and execution-port replacement through serialize/export. trail check still reports the inherited 20 lexical conflicts in retained FM2 plan/work documentation; those conflicts are provenance-only and outside this lifecycle repair.

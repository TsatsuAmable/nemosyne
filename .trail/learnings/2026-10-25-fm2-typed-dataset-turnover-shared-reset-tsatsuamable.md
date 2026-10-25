---
title: FM2 typed dataset turnover shared reset
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-browser
touches:
  - src/atlas/domain/InvestigationAggregate.ts
  - tests/fm2-worker-direct-distribution-wasm.test.ts
---

## Decided
Typed dataset replacement now shares the existing row-dataset dataset-bound reset in InvestigationAggregate, clearing node decisions, active Forma/direct compilation and snapshot state, variant/traversal state, feedback links/bindings, and persisted Forma state without changing context-only turnover behavior.

## Tried and ruled out
A real WASM-backed row FM2 loop seeded direct compilation, critique, constrained alternative, and feedback binding; production session and review-surface projections reproduced the typed-turnover ghosts before the fix and passed after it. Real analytical.worker registration used NTC1 bytes and rejected the old fingerprint after typed turnover. Typed direct recompile remains unsupported because the handle-only analytical state has no row-backed `current` dataset; no JavaScript fallback or source minting was added.

## Watch out
The local Node 24 build and Chromium smoke remain unverified because Vite/wasm-bindgen hit macOS EPERM writing temporary artifacts; hosted exact-head CI is the browser evidence. Trail check still reports inherited lexical conflicts in retained FM2 plan/work documents, not this repair.

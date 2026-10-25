---
title: FM2 committed-context turnover invalidates direct mutation authority
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-browser
touches:
  - src/atlas/domain/InvestigationAggregate.ts
  - tests/fm2-desktop-direct-critique.test.ts
  - docs/superpowers/plans/2026-10-25-fm2-browser.md
---

## Decided

Committed investigation-context turnover now invalidates the aggregate active direct compilation, snapshot, variant pair, and traversal state. This fences Atlas/NIL REJECT and PREFER at the authoritative aggregate seam while preserving historical direct feedback links.

## Tried and ruled out

A UI-only context-digest check was insufficient: the real Rust/WASM Atlas direct mutation path accepted the retained compilation after context A -> B. A runtime-only capability check also missed committed-context identity.

## Watch out

The focused real-WASM regression proves direct REJECT and PREFER refusal after context turnover. `trail check` still reports 20 inherited lexical conflicts in docs/superpowers/plans/2026-10-25-fm2-browser.md; this change does not touch that plan or its prior learning conflicts.

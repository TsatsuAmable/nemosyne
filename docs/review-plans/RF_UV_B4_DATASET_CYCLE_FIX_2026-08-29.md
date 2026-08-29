# B4 follow-up — dataset cycle identity fix

**Date:** 2026-08-29  
**Base:** `main@c0f074b19b4bdab9ebff923de509426af733e489`  
**Scope:** fix-forward from the B4 Chromium production smoke.

## Finding

The B4 task-first shell promises **Explore another dataset**, but the first semantic cycle could reload `Supply Chain Hierarchy`. `World` keeps a legacy numeric sample cursor, while restore/load paths can preserve only a human-readable dataset identity and omit the built-in sample key. The first key-only cursor synchronization therefore failed closed to the legacy `-1` cursor and selected sample zero again.

## Fix

- resolve the active built-in sample by key first, then entry label/name, then underlying `Dataset.name`;
- align the legacy cursor immediately before the governed semantic `dataset.cycle` intent reaches `World._cycleDataset`;
- for a non-sample dataset, use a direction-aware sentinel so forward cycling enters the first sample and backward cycling enters the last;
- keep dataset selection and analytical authority unchanged.

## Falsifiers

Focused tests cover label-only identity, dataset-name identity, forward wraparound, and backward entry from a non-sample dataset. The existing `p1-uv1-task-first-shell` Chromium production smoke remains the end-to-end requirement: after **Explore another dataset**, the visible dataset context must change.

## Non-goals

No B5 work, no `World.ts` refactor, no analytical changes, no representation-policy changes, and no weakening of the browser assertion.

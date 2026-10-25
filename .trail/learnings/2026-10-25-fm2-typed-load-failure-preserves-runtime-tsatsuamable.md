---
title: FM2 typed load failure preserves runtime authority
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-browser
touches:
  - src/atlas/AtlasCore.ts
  - tests/fm2-worker-direct-distribution-wasm.test.ts
---

## Decided
AtlasCore typed loading validates Rust handle and authoritative fingerprint before revoking runtime-issued direct snapshots; successful row, typed, and same-fingerprint typed turnover still uses the shared aggregate dataset-bound reset.

## Tried and ruled out
Clearing direct authority before Rust rejection reproduced a half-reset investigation; a real-WASM regression now proves malformed bytes preserve identity, version, direct/Forma state, review lineage, session carriers, and positive old-authority reuse.

## Watch out
Adoption exceptions release the newly acquired Rust handle; hosted browser CI remains the final exact-head evidence, and the retained FM2 plan document causes inherited trail lexical conflicts.

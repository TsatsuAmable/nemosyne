---
title: FM2 direct snapshot compiler admission
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-snapshot
---

## Decided
Guard direct-distribution snapshots at the public AtlasCore compiler with a private per-instance WeakSet populated only after live analytical-port capture and normalization. This preserves the existing Rust/Worker direct path while refusing cloned or independently caller-supplied snapshots.

## Tried and ruled out
An exported binding-marker helper would provide an apparently runtime-issued capability but would let an internal caller mint the marker; keep the capability private to AtlasCore instead.

## Watch out
The inherited FM2 trail lexical conflicts remain in retained plan/work documents. The real-WASM Worker/replay suites and snapshot integration suite are the authoritative regression evidence for this boundary.

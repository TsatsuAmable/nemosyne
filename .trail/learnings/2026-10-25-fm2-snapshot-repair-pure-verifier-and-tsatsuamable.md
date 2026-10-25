---
title: "FM2 snapshot repair: pure verifier and generation-bound capture lifecycle"
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-snapshot
touches:
  - docs/superpowers/plans/2026-10-25-fm2-snapshot.md
  - docs/work/FM2_RUST_DIRECT_DISTRIBUTION_BINDING_V1.md
  - src/atlas/AtlasCore.ts
  - src/moneta/forma/FormaAdmission.ts
  - src/moneta/representation/DirectDistributionBindingV1.ts
  - src/moneta/representation/SemanticSnapshotV1.ts
  - tests/fm2-replay-governed-direct-distribution-wasm.test.ts
  - tests/fm2-worker-direct-distribution-wasm.test.ts
  - tests/moneta-semantic-snapshot.test.ts
---

## Decided
Transport verification and snapshot normalization are structural only; they do not mint runtime authority. Atlas retains runtime-local admission and capture metadata, clears captures on analysis/reset transitions, and rejects mismatched generation, version, fingerprint, port, or kernel identity at session handoff.

## Tried and ruled out
A forged binding regression failed before the repair and passed after it through the direct imported verifier, snapshot normalizer, and Forma path. A real-WASM A-to-B-to-A regression reproduced stale serialization and now requires fresh recapture. The composite npm test sequence hit a native segmentation fault after fast/UI phases; integration and WASM phases pass independently.

## Watch out
The existing trail lexical conflicts are retained-plan/work provenance wording, not semantic conflicts. Independent review remains pending; no browser or hardware claim follows.

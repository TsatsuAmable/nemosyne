---
title: FM2 snapshot identity must exclude decision metadata
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-snapshot
touches:
  - docs/superpowers/plans/2026-10-25-fm2-snapshot.md
  - docs/work/FM2_RUST_DIRECT_DISTRIBUTION_BINDING_V1.md
  - src/moneta/representation/SemanticSnapshotV1.ts
  - tests/fm2-replay-governed-direct-distribution-wasm.test.ts
  - tests/fm2-worker-direct-distribution-wasm.test.ts
  - tests/moneta-semantic-snapshot.test.ts
---

## Decided
Direct snapshot identity now projects only analytical controls from Rust source parameters; exact request-bound source bytes, digest, receipt, and full request remain in the governed replay carrier.

## Tried and ruled out
Keeping the full Rust source digest and receipt in SemanticSnapshotV1 would preserve request binding but make snapshot identity vary with decision metadata. Moving request equivalence out of the Rust source was also ruled out because the live and replay boundaries must reject geometrically-colliding requests.

## Watch out
The inherited trail check lexical conflicts remain expected on retained FM2 plan/work documents and existing source terms; focused real-WASM, snapshot, replay, typecheck, lint, and docs checks are the authoritative repair evidence.

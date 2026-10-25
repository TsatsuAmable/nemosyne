---
title: FM2 Forma admission requires runtime-issued direct snapshot capability
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-snapshot
touches:
  - src/moneta/forma/FormaAdmission.ts
  - src/moneta/representation/DirectDistributionBindingV1.ts
  - src/moneta/representation/SemanticSnapshotV1.ts
  - tests/fm2-worker-direct-distribution-wasm.test.ts
  - tests/moneta-semantic-snapshot.test.ts
---

## Decided
Forma admission now refuses direct-distribution snapshots unless the binding was request-verified through the selected inline or Worker port and the resulting snapshot object retains a private runtime capability bound to its issued snapshot ID. Cloned, caller-authored, replay-carrier-only, and recomputed self-consistent snapshots remain unadmitted.

## Tried and ruled out
Relying on SemanticSnapshotV1 self-consistency or the direct-reference exemption alone allowed TypeScript-authored direct claims through compileFormaSpatialSlice. An exported marker-grant helper was also avoided; only request-bound transport verification grants the private binding membership.

## Watch out
The inherited FM2 trail lexical conflicts remain in retained plan/work documentation. Full CI, cargo, and browser qualification remain unrun; this repair has focused real-WASM Worker/inline/replay, Forma integration, typecheck, lint, docs, and diff evidence.

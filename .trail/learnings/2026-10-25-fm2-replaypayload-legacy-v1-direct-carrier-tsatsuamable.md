---
title: FM2 replayPayload legacy V1 direct-carrier fence
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-replay
touches:
  - docs/work/FM2_RUST_DIRECT_DISTRIBUTION_BINDING_V1.md
  - src/session/InvestigationReplayRunner.ts
  - tests/fm2-replay-governed-direct-distribution-wasm.test.ts
---

## Decided

InvestigationReplayRunner.replayPayload() must reject legacy formatVersion=1 payloads whenever directDistributionDigest or directDistributionBytes is present, before carrier parsing, dataset reconstruction, or Rust replay. This mirrors NemosynePackageManager and preserves V1/V2 packages without direct metadata.

## Tried and ruled out

Relying on NemosynePackageManager.unpack() is insufficient because replayPayload() is a public raw-payload entry point. Checking only the manifest digest would leave a raw carrier-bytes path, so the guard covers both carrier metadata forms.

## Watch out

The real-WASM regression creates a valid exported carrier, removes the V2 digest-algorithm field, relabels the manifest V1, and proves the pre-fix path could report VERIFIED while the repaired path REFUSES. Keep the work document explicitly branch-only/unmerged; roadmap Replay/browser remains OPEN. The focused FM2 replay file now has 11 real-WASM tests.

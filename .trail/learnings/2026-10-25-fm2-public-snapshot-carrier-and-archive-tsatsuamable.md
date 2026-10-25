---
title: FM2 public snapshot carrier and archive reserved-entry fences
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-replay
touches:
  - src/session/NemosynePackage.ts
  - src/session/NemosyneSession.ts
  - tests/fm2-replay-governed-direct-distribution-wasm.test.ts
---

## Decided
The public snapshot exporter must leave the kernel override unset when a restored direct-distribution carrier is the only available analytical identity; the instance exporter then adopts the carrier identity while ordinary exports retain their internal fallback. Archive unpack must always inspect the reserved direct-distribution entry, so bytes without a manifest digest fail closed before replay.

## Tried and ruled out
No TypeScript receipt or replay bypass was introduced. The implementation keeps Rust-issued carrier validation and routes the malformed-archive regression through InvestigationReplayRunner.replayArchive.

## Watch out
trail check reports lexical conflicts against the retained FM2 plan and earlier learnings because the changed code and tests mention the same guarded identities and package entry. These are intentional reinforcement, not reintroduction of the ruled-out paths; preserve the 13-test real-WASM regression suite.

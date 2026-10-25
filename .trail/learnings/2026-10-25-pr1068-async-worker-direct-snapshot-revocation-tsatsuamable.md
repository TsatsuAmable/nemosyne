---
title: PR1068 async Worker direct snapshot revocation
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-snapshot
cost: { minutes: 30, tokens: 12000 }
touches:
  - src/atlas/AtlasCore.ts
  - tests/fm2-worker-direct-distribution-wasm.test.ts
  - tests/fm2-replay-governed-direct-distribution-wasm.test.ts
---

## Decided

PR1068 stale direct-distribution snapshots are revoked in AtlasCore only after a successful sync or async AnalyticalState.commitKernelResult. This closes the real Worker/WASM A->B public Forma admission bypass while preserving current captures when an operation is refused.

## Tried and ruled out

The first RED regression used the existing production Worker handler and real WASM; it admitted stale A after applyAnalysisAsync(filter). Moving revocation after the commit made the focused Worker/Forma suite GREEN. No public runtime-issued option, ledger mint, Worker fence change, or persisted carrier format change was introduced.

## Watch out

trail check still reports inherited lexical conflicts in retained FM2 plan/work documentation; the changed source/tests do not overlap those files. Full Node24 fast, UI, integration, and WASM lanes passed; independent review and promotion remain pending.

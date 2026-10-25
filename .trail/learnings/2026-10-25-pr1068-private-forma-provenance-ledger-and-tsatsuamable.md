---
title: PR1068 private Forma provenance ledger and port lifecycle fence
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-snapshot
touches:
  - src/atlas/AtlasCore.ts
  - src/moneta/forma/FormaAdmission.ts
  - tests/fm2-replay-governed-direct-distribution-wasm.test.ts
  - tests/fm2-worker-direct-distribution-wasm.test.ts
---

## Decided

- PR #1068 Forma direct-distribution admission now trusts only a module-local Atlas WeakMap ledger populated after a real current Rust/Worker capture. Public Forma options no longer expose a provenance issuer; the exported Atlas predicate is query-only.
- Ledger records are tied to Atlas instance, execution port, generation, dataset version/fingerprint, and inline kernel version, and are revoked across lifecycle transitions. Capture also refuses results after the analytical port is replaced.

## Tried and ruled out

- Caller-supplied snapshot equality, public runtime-issued options, structural self-hash verification, and a public minting helper all fail the self-supply attack because a caller can construct the same values.
- The hosted coverage failure was unrelated: RF-062C QCA0 World production path timed out at 30 seconds in shard 1; its artifact contained no Forma assertion failure.

## Watch out

- This is a software-runtime authority boundary only. Injected AnalyticalExecutionPort implementations remain a bounded test/host seam and are not Quest, device, or human-study attestation. The distinct independent adversarial review must rerun the public self-supply attack and lifecycle cases.

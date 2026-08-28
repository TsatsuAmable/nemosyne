# P1-Q Q0 Boundary Promotion

**Date:** 28 August 2026  
**Baseline:** `main@cb914a6a65a9adef8d82da694bdc653db2e53e65`  
**Branch:** `chore/p1q-q0-promote-boundaries`  
**Status:** IMPLEMENTATION / REVIEW ACTIVE

## Decision being implemented

Q0 was classified **ADOPT with scoped promotion** after PR #492. This follow-up promotes only the three dependency-direction rules that produced low-noise, materially useful evidence:

- `no-production-draco-imports`;
- `investigation-domain-is-presentation-independent`;
- `moneta-is-presentation-independent`.

The existing production-cycle rule remains informational. The ast-grep Worker rule remains pilot/targeted pending P1-Q Q8 lifecycle-script review and a bounded comparison with the already-required ESLint lane.

## Enforcement design

The blocking rules live in `.dependency-cruiser.boundaries.cjs`. The full Q0 dependency config composes those same rules and adds the warning-only cycle policy, avoiding duplicated rule definitions.

The existing required `Node 24` CI chain is extended through its `Static analysis` job rather than adding another required workflow or another dependency-install cycle. After the existing `npm ci`, static analysis runs:

1. `npm run architecture:boundaries:test`;
2. `npm run architecture:boundaries`.

Because `Node 24` already depends on `Static analysis`, a boundary violation therefore fails the existing required check without changing repository ruleset check names.

## Falsifying fixture

`scripts/check-architecture-boundary-fixture.mjs` creates an isolated temporary source tree and reuses the exact blocking rule objects from `.dependency-cruiser.boundaries.cjs`.

It first introduces a forbidden production import into `src/draco/` and requires dependency-cruiser to exit non-zero while naming `no-production-draco-imports`. It then rewrites the fixture to a permitted dependency and requires a clean exit. The temporary tree is deleted in a `finally` block.

This proves both fail-closed rejection and clean recovery without checking a permanently-invalid fixture into production source.

## Evidence boundaries

This promotion proves only that the selected dependency-direction invariants are enforced by the existing required Node 24 CI chain. It does not make cycle warnings blocking, approve ast-grep lifecycle-script trust, or establish runtime, security, scientific, XR, scale, or production fitness.

## Exit criteria

Before merge:

- branch is current with `main`;
- the fixture check passes by observing the deliberate invalid edge fail and the repaired edge pass;
- production `architecture:boundaries` passes with zero errors;
- required `Node 24`, CodeQL, and repository approval/thread policy are green on the final PR head;
- no review finding demonstrates that the promoted rules are materially noisy or semantically mis-scoped.

If those criteria hold, Q0 dependency-boundary promotion is complete and P1-Q can move to Q1 Rust cadence benchmarking.

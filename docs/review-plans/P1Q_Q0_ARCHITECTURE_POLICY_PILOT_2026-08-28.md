# P1-Q Q0 — Architecture Policy Pilot

**Date:** 28 August 2026  
**Baseline:** `main@e18ec3bd1c0568ea0f52abac970a7359e01e286d`  
**Branch:** `chore/p1q-q0-architecture-policy`  
**Status:** PILOT / NOT YET A REQUIRED ARCHITECTURE GATE

## Goal

Evaluate whether maintained structural/dependency tooling can replace brittle source-text guards and catch recurrent Nemosyne authority drift cheaply enough for ordinary PR use.

This pilot does **not** attempt to encode the entire architecture and does not make a new merge gate merely by installing tools.

## Tools under evaluation

- `dependency-cruiser` for import/dependency direction and cycle evidence;
- `ast-grep` for structural source rules and rule fixtures.

## Initial high-signal rules

### Dependency rules

1. **Draco is compatibility-only.** Production source outside `src/draco/` may not import from `src/draco/`. This should supersede the current regex-only guard if the structural result proves equivalent or stronger.
2. **Investigation meaning is presentation-independent.** `src/atlas/domain/`, `src/investigation/` and `src/session/` may not import `src/vr/` or `src/ui/`.
3. **Moneta is presentation-independent.** `src/moneta/` may not import `src/vr/` or `src/ui/`.
4. **Production dependency cycles are measured.** Cycles are reported as pilot evidence first; an existing cycle is not silently baselined into an error waiver and a zero-cycle result may be promoted later.

### Structural rules

5. **Worker construction stays at the composition boundary.** Direct `new Worker(...)` is forbidden in production TypeScript except the explicitly governed composition point in `src/vr/World.ts`. The rule has valid/invalid fixtures.
6. The pilot intentionally does **not** fail on known RF-001 `dataset.rows` traversal. That is an existing roadmap defect, not a reason to introduce a permanently-red architecture gate. A future structural rule may become blocking only after the underlying defect is fixed.
7. Durable-ID/randomness and endpoint-literal policies are deferred until path/semantic scoping proves they can avoid false positives in demos, tests and legitimate stochastic algorithms.

## Acceptance checks

- current production `src/` scans successfully for every error-severity rule;
- all ast-grep rules have positive/negative rule tests;
- dependency-cruiser and ast-grep outputs are deterministic on the same checkout;
- wall-clock time for each tool and the combined policy check is recorded on hosted CI;
- any current cycle/warning is classified rather than hidden by a broad ignore;
- no blanket `known violations` file is introduced for the pilot;
- package/tool versions are pinned by the lockfile;
- no architecture policy changes Rust/WASM, Atlas, Moneta, InputRouter or persistence authority;
- the pilot is classified `ADOPT`, `TARGETED ONLY`, or `REJECT` after the hosted evidence and adversarial review.

## Promotion rule

Do not add Q0 to the existing required `Static analysis` job until the pilot has demonstrated low noise and acceptable latency. If adopted, make it a small dedicated check first so its cost and failure signal remain visible.

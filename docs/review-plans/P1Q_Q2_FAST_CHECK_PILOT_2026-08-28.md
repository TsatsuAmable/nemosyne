# P1-Q Q2 fast-check Pilot

**Date:** 28 August 2026  
**Baseline:** `main@a257ade6cff4233501f47079f7e29dd503108bc0` (#496 merged)  
**Classification evidence head:** `549cd56881fcb02d438e8a82da52ccf57c03d820`  
**Status:** CLASSIFIED — ADOPT WITH SCOPED PROMOTION

## Purpose

Evaluate whether `fast-check` adds useful, reproducible falsification and shrinking for high-authority TypeScript invariants without adding material recurring merge-time cost or silently expanding the permanent dependency surface before evidence exists.

The first Q2 deterministic falsifier already found and repaired async canonical dataset-identity drift in #496. This tranche tested whether bounded generation provides additional assurance around that same identity contract.

## Pilot dependency boundary

The hosted pilot installed exactly:

- `fast-check@4.9.0`;
- `pure-rand@8.4.2`.

They were installed with `--no-save --package-lock=false --ignore-scripts` into an isolated `${RUNNER_TEMP}` prefix after the repository's normal `npm ci`. The corrected workflow verified the exact installed versions, proved the repository's `node_modules/.package-lock.json` digest was unchanged, and proved `package.json` / `package-lock.json` remained unchanged.

This is intentionally a **pilot-only acquisition path**, not the final supply-chain posture. Ordinary adoption must represent the chosen version and transitive dependency in the repository lockfile and review them under Q8.

### Superseded first hosted attempt

The first hosted attempt installed the exact packages directly into the repository working tree with `npm install --no-save --package-lock=false --ignore-scripts`. Although the manifests remained unchanged, npm reported `17 packages added, 48 removed, 81 changed`, so that run no longer represented the exact `npm ci` dependency graph under test. Its successful properties, shrink output and `0.24 s / 92,876 KB` core measurement are **diagnostic only and not promotion evidence**.

The corrected harness isolated the pilot dependency so the Nemosyne dependency tree remained the locked `npm ci` tree.

## Generated properties

`tools/property-testing/q2-fast-check-pilot.mjs` ran five bounded properties with deterministic seeds:

1. undeclared row/presentation fields do not alter scientific identity;
2. `rowIds` and root presentation metadata do not alter scientific identity;
3. JSON serialize/parse roundtrip preserves canonical scientific identity;
4. graph endpoint JSON type remains scientifically visible (`0` is not `"0"`);
5. missing declared values and explicit `null` converge on the same canonical projection and identity.

Each property executed 250 generated cases over deliberately small datasets (at most 25 rows), for **1,250 generated cases total**. The 50,001-row threshold regression remains deterministic in `tests/q2-dataset-identity-parity.test.ts`; random generation is not used to turn a known boundary condition into a slow probabilistic gate.

All five generated properties passed on the classified evidence head.

## Failure diagnosis / shrinking proof

The deliberate false diagnostic property produced reproducible shrink evidence:

- seed: `20260927`;
- replay path: `0:1:0:0:0:0:0:0:0:0:0`;
- shrinks: `10`;
- final counterexample: `[10]`.

This demonstrates useful diagnosis and replay behavior. It is not a production defect and is not counted as one.

## Hosted measurement

Corrected isolated run on GitHub-hosted Ubuntu 24.04 / Node 24.19.0:

- isolated pilot dependency acquisition: approximately **0.508 s**;
- property engine wall clock: **0.23 s**;
- property engine max RSS: **90,176 KB**;
- ordinary `npm ci`: approximately **5 s** and remains repository baseline cost, not property-engine cost.

The core generated-test cost is comfortably small enough to fit an existing fast Node lane. Permanent lockfile-backed acquisition cost must still be observed on the adoption PR rather than inferred from the isolated pilot.

## Exact-head promotion evidence

On `549cd56881fcb02d438e8a82da52ccf57c03d820`:

- P1-Q Q2 fast-check pilot: success;
- ordinary CI / required Node 24 chain: success;
- CodeQL SAST: success;
- approval-gate: success;
- review threads: none;
- branch: 0 behind `main` at classification time.

The classification was recorded on PR #497 without changing that evidence head. Subsequent documentation/workflow-retirement commits require their own ordinary exact-head CI before merge but do not retroactively replace the measured pilot candidate.

## Classification — ADOPT WITH SCOPED PROMOTION

`fast-check` has demonstrated enough value and low enough bounded runtime to become the preferred TypeScript property-testing mechanism for selected high-authority invariants.

Promotion is intentionally narrow:

- use bounded generators with deterministic seeds;
- integrate properties into an existing owning test lane when their measured runtime fits that lane;
- do not create a separate blanket property-testing required gate;
- keep known expensive/boundary regressions deterministic rather than probabilistic;
- when a generated case finds a real defect, retain the shrunk case as a deterministic regression;
- green property runs prove only the generated domain/runs exercised, not universal correctness.

## Required follow-up before ordinary use

1. add `fast-check` through the repository package manifest/lockfile rather than transient acquisition;
2. review `fast-check` and its `pure-rand` dependency under Q8, including integrity, licences, vulnerabilities and lifecycle-script posture;
3. migrate the selected canonical-identity properties into the normal fast Node lane;
4. measure the resulting lockfile-backed install/test impact on hosted CI;
5. keep the pilot workflow manual-only as reproducible historical evidence rather than a recurring unlocked registry check.

## Next Q2 experiment

Run a bounded Rust `proptest` pilot against the authoritative canonical fingerprint contract and cross-language golden cases. Property tooling must validate the Rust authority, not create a second identity implementation.

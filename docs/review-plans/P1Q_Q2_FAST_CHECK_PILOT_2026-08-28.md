# P1-Q Q2 fast-check Pilot

**Date:** 28 August 2026  
**Baseline:** `main@a257ade6cff4233501f47079f7e29dd503108bc0` (#496 merged)  
**Status:** PILOT ACTIVE / NON-REQUIRED

## Purpose

Evaluate whether `fast-check` adds useful, reproducible falsification and shrinking for high-authority TypeScript invariants without adding material recurring merge-time cost or silently expanding the permanent dependency surface before evidence exists.

The first Q2 deterministic falsifier already found and repaired async canonical dataset-identity drift in #496. This tranche tests whether bounded generation provides additional assurance around that same identity contract.

## Pilot dependency boundary

The hosted pilot installs exactly:

- `fast-check@4.9.0`;
- `pure-rand@8.4.2`.

They are installed with `--no-save --package-lock=false --ignore-scripts` into an isolated `${RUNNER_TEMP}` prefix after the repository's normal `npm ci`. The workflow verifies the exact installed versions, proves the repository's `node_modules/.package-lock.json` digest is unchanged, and proves `package.json` / `package-lock.json` remain unchanged.

This is intentionally a **pilot-only acquisition path**, not the final supply-chain posture. If `fast-check` is adopted into ordinary tests, the adopted version and transitive dependency must be represented in the repository lockfile and reviewed under Q8. The non-required pilot may not be cited as evidence that an unlocked registry acquisition is suitable for a required gate.

### Superseded first hosted attempt

The first hosted attempt installed the exact packages directly into the repository working tree with `npm install --no-save --package-lock=false --ignore-scripts`. Although the manifests remained unchanged, npm reported `17 packages added, 48 removed, 81 changed`, so that run no longer represented the exact `npm ci` dependency graph under test. Its successful properties, shrink output and `0.24 s / 92,876 KB` core measurement are therefore **diagnostic only and not promotion evidence**.

The corrected harness isolates the pilot dependency so the Nemosyne dependency tree remains the locked `npm ci` tree.

## Generated properties

`tools/property-testing/q2-fast-check-pilot.mjs` runs five bounded properties with deterministic seeds:

1. undeclared row/presentation fields do not alter scientific identity;
2. `rowIds` and root presentation metadata do not alter scientific identity;
3. JSON serialize/parse roundtrip preserves canonical scientific identity;
4. graph endpoint JSON type remains scientifically visible (`0` is not `"0"`);
5. missing declared values and explicit `null` converge on the same canonical projection and identity.

Each property executes 250 generated cases over deliberately small datasets (at most 25 rows). The 50,001-row threshold regression remains deterministic in `tests/q2-dataset-identity-parity.test.ts`; random generation is not used to turn a known boundary condition into a slow probabilistic gate.

## Failure diagnosis / shrinking proof

The pilot includes one deliberately false diagnostic property. The workflow must verify that `fast-check`:

- reports failure without making the pilot fail overall;
- records the seed and replay path;
- performs at least one shrink;
- retains the minimal counterexample in the log.

This probe is evidence about diagnostic fitness only. It is not a production defect and must not be counted as one.

## Measurement

Hosted execution records the property runner's wall-clock and maximum RSS using `/usr/bin/time`. Repository install time is not attributed to the core property engine. The isolated pilot dependency acquisition time is recorded separately by the workflow log and must not be hidden when judging permanent adoption.

Any future required adoption must account for normal lockfile-backed install/cache impact as well as test execution time.

## Adoption criteria

Classify the TypeScript Q2 pilot only after corrected hosted evidence exists:

- **ADOPT:** bounded properties are deterministic/replayable, shrinking materially improves diagnosis, core runtime is small enough for the owning test lane, and the dependency/supply-chain cost is acceptable;
- **TARGETED ONLY:** useful falsification or shrinking exists but recurring cost, dependency trust, or generator complexity argues for risk-triggered/scheduled use;
- **REJECT:** signal is duplicative/noisy, diagnosis is poor, generators are too brittle, or cost exceeds the value.

Any generated counterexample that reveals a real product defect must be converted to a deterministic regression before closure. A green property run is evidence only for the generated domain and seeds/runs exercised, not proof of universal correctness.

## Next step

If this pilot earns adoption or targeted retention, run the corresponding bounded Rust `proptest` experiment on the canonical projection/fingerprint contract and cross-language golden cases. Do not introduce a second identity authority in either language.

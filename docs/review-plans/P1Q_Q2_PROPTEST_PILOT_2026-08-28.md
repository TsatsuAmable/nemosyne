# P1-Q Q2 Rust proptest pilot — 2026-08-28

## Status

**PILOT / NON-REQUIRED.**

This tranche evaluates whether Rust `proptest` materially improves falsification of the canonical dataset fingerprint authority before adding any permanent Cargo dependency or required CI gate.

## Authority under test

The target is `wasm/src/data/fingerprint.rs`, not a parallel reimplementation. The pilot temporarily injects a unit-test module into the checked-out Rust crate so generated cases execute against the actual private `crate::data` implementation.

The branch itself does **not** modify `wasm/Cargo.toml`, `wasm/Cargo.lock`, `wasm/src/lib.rs`, or production Rust source. The hosted pilot performs those test-only mutations inside the disposable runner workspace.

## Dependency boundary

Pilot version: `proptest 1.11.0`.

The transient dependency is added with default features disabled and only `std` enabled. Nemosyne does not need proptest's default fork/timeout machinery to evaluate these deterministic fingerprint properties, so the pilot deliberately measures a smaller dependency surface.

No Cargo adoption or supply-chain approval is implied by a successful pilot. If the result is `ADOPT`, permanent dependency/lockfile changes require a separate Q8 review and ordinary exact-head promotion evidence.

## Generated invariants

Each normal property runs with `PROPTEST_CASES=256` and deterministic `PROPTEST_RNG_SEED=20260828` in the hosted pilot.

1. HashMap insertion order cannot change canonical dataset identity.
2. Undeclared row values cannot change scientific identity.
3. Missing declared values and explicit `Value::Null` converge on the same identity.
4. `row_ids` remain non-scientific lineage metadata and cannot affect the fingerprint.
5. Edge `extra` HashMap insertion order cannot change identity.
6. Positional numeric graph endpoints remain scientifically distinct from string endpoints with the same textual digits.
7. Supplementary-plane/BMP row keys remain stable across HashMap insertion order while exercising the UTF-16 canonical sort path.

The existing deterministic unit tests remain the authority for exact ECMAScript number-rendering vectors and the explicit UTF-16 comparator example. Property tests complement those examples; they do not replace them.

## Shrink/replay proof

The pilot contains one deliberately false ignored property over `10u16..=10_000u16`. Hosted CI invokes it separately and succeeds only when:

- the property fails as intended;
- proptest shrinks the counterexample to `x = 10`;
- the runner log records the deterministic replay seed `20260828`.

The false property never participates in ordinary successful property execution.

## Measurements

Hosted CI captures three measurements on one runner:

1. baseline native Rust test-binary compile before proptest is introduced;
2. cold proptest compile plus generated-property execution after transient instrumentation;
3. warm generated-property execution after compilation.

All use `/usr/bin/time` to record wall-clock time and peak RSS. The comparison is diagnostic rather than a laboratory benchmark, but it is sufficient to identify an obviously disproportionate merge-time tax.

## Classification rule

After hosted evidence and ordinary PR checks, classify this pilot as exactly one of:

- **ADOPT** — generated cases/shrinking provide meaningful additional falsification at acceptable cost; proceed to a separate lockfile-backed adoption tranche.
- **TARGETED ONLY** — useful only for a narrow subset of Rust authority tests; retain the technique but do not broadly normalize it.
- **REJECT** — signal or shrink/replay value does not justify dependency/compile cost.

A green workflow alone is not adoption evidence. Classification also requires review-thread inspection, branch freshness, measured cost, and a check that the generated properties are not merely duplicating deterministic examples.

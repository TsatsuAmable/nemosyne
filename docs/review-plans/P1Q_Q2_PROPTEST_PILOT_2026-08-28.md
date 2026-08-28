# P1-Q Q2 Rust proptest pilot — 2026-08-28

## Status

**TARGETED ONLY / PILOT COMPLETE.**

Rust `proptest` demonstrated strong falsification and shrinking value for canonical dataset fingerprint invariants, but its measured cold compile/dependency cost is too large to normalize across the ordinary Rust merge path. Retain the technique for narrow high-authority properties rather than adopting it as blanket test infrastructure.

## Authority under test

The target was `wasm/src/data/fingerprint.rs`, not a parallel reimplementation. The pilot temporarily injected a unit-test module into the checked-out Rust crate so generated cases executed against the actual private `crate::data` implementation.

The repository branch does **not** modify `wasm/Cargo.toml`, `wasm/Cargo.lock`, `wasm/src/lib.rs`, or production Rust source. All Cargo/test-module mutations occurred only in disposable hosted-runner workspaces.

## Dependency boundary

Pilot version: exact `proptest 1.11.0`, with default features disabled and only `std` enabled.

That deliberately avoids the default fork/timeout machinery and measures a smaller dependency surface. Even with this reduced feature set, the transient Cargo resolution grew from 84 to 99 locked packages.

No permanent Cargo dependency or supply-chain approval follows from this pilot.

## Generated invariants

Each normal property ran with `PROPTEST_CASES=256` and deterministic `PROPTEST_RNG_SEED=20260828`.

1. HashMap insertion order cannot change canonical dataset identity.
2. Undeclared row values cannot change scientific identity.
3. Missing declared values and explicit `Value::Null` converge on the same identity.
4. `row_ids` remain non-scientific lineage metadata and cannot affect the fingerprint.
5. Edge `extra` HashMap insertion order cannot change identity.
6. Positional numeric graph endpoints remain scientifically distinct from string endpoints with the same textual digits.
7. Supplementary-plane/BMP row keys remain stable across HashMap insertion order while exercising the UTF-16 canonical sort path.

All seven properties passed. At 256 cases each this is 1,792 generated cases per run. The existing deterministic unit tests remain authoritative for exact ECMAScript number-rendering vectors and the explicit UTF-16 comparator example; the generated tests complement rather than replace those vectors.

## Shrink and replay proof

A deliberately false ignored property over `10u16..=10_000u16` was invoked separately with:

- `PROPTEST_CASES=1`;
- `PROPTEST_MAX_SHRINK_ITERS=1000`;
- `PROPTEST_RNG_SEED=20260828`.

The hosted run:

- failed as intended;
- shrank to `minimal failing input: x = 10`;
- emitted regression hash `ad32e86ef05580a9b4c883796f00bd66dc6ad814267e648889023ce7c046d973`;
- retained the deterministic replay seed in the evidence log.

An earlier diagnostic run used the default shrink budget implied by `PROPTEST_CASES=1`, which allowed only four shrink iterations and stopped at `x = 40`. That was a pilot-harness configuration defect, not a Nemosyne fingerprint failure. The successful final run explicitly fixes the shrink budget.

## Hosted measurements

Successful pilot head: `d53fa55f0d5643a324efdf7201380d06275a2dca`.

Hosted Ubuntu 24.04 / Rust 1.98.0 measured:

| Phase | Wall clock | Peak RSS |
| --- | ---: | ---: |
| native Rust test-binary baseline compile | 55.32 s | 1,535,804 KB |
| additional proptest compile + generated execution | 38.43 s | 1,522,116 KB |
| warm generated-property execution | 0.10 s | 47,668 KB |

The test harness itself reported the seven generated properties finished in about 0.01 s. The material cost is therefore compilation/dependency expansion, not property execution.

These figures are diagnostic same-runner measurements, not universal benchmarks. They are sufficient to reject broad merge-lane normalization: roughly 38 seconds of additional cold compilation for a test family whose warm execution is about one tenth of a second is the wrong cadence trade-off for ordinary Rust changes.

## Classification — TARGETED ONLY

`proptest` is useful where the state/input space is combinatorial and the invariant is authoritative enough that shrinking materially improves diagnosis. Suitable future uses include:

- canonical scientific identity/fingerprints;
- compact serialization/provenance contracts;
- deterministic state-machine transitions with large input combinations;
- scientific kernels where a minimal counterexample substantially improves reviewability.

It should **not** become a blanket Rust test dependency, a repository-wide style requirement, or an independent required merge gate based on this evidence.

If a future Rust tranche has enough high-value properties to justify permanent adoption, repeat Q8 dependency review and measure the incremental cost inside the existing cached Rust kernel job before changing `Cargo.toml`/`Cargo.lock`. Until then, keep deterministic examples in ordinary CI and use this manual pilot pattern for targeted deep falsification.

## Evidence boundaries

- No generated property found a new production defect in this pilot; the authoritative fingerprint invariants exercised here remained green.
- No new roadmap RF is warranted from the generated results.
- The pilot does not prove the fingerprint contract for all possible datasets or all cross-language encodings.
- Exact cross-language golden cases remain deterministic evidence and should be strengthened separately where gaps exist.
- One ordinary CI attempt on the successful pilot head failed before WASM build because the existing `wasm-pack@0.15.0` npm postinstall download hit `ECONNRESET`. That network failure is unrelated to this three-file Rust pilot and is not counted as proptest evidence; final promotion requires a clean exact-head ordinary rerun.

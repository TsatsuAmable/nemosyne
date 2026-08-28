# P1-Q Q8 Supply-Chain Prevention Pilot

**Date:** 28 August 2026
**Baseline:** `main@496cd78e315fa8a8f2a30b32f8b945a0d7d4f3a5` (#503 merged)
**Status:** PILOT LANDED / CLASSIFICATION PENDING PR-TIME SIGNAL

## Purpose

Evaluate whether GitHub Dependency Review and `cargo-deny` produce useful
defect signal at acceptable wall-clock cost before either is promoted to a
required PR gate. Both are preventive policy tools that complement, and do not
replace, the existing Dependabot update automation. A green run is
point-in-time evidence, not a permanent absence-of-vulnerability claim.

## Scope

- **cargo-deny** checks the Rust/WASM kernel's real `wasm/Cargo.lock`:
  - `advisories` — known RustSec advisory/RUSTSEC IDs and yanked crates;
  - `licenses` — SPDX policy over the shipped `wasm32-unknown-unknown` graph;
  - `bans` — duplicate versions and wildcard requirements;
  - `sources` — registry/git source allow-list.
- **GitHub Dependency Review** runs on every PR against the base/head diff and
  fails on newly introduced high-severity vulnerabilities.

## Config and evidence

### `wasm/deny.toml`

Baseline policy at `main@496cd78e`:

- `[advisories]` — `yanked = "deny"`, no ignored IDs. Runs over the full
  lockfile, including dev-only and host build/test dependencies that CI's
  `cargo test` actually compiles.
- `[licenses]` — allow-list: MIT, Apache-2.0, BSL-1.0, Zlib, Unicode-3.0,
  Unlicense; `confidence-threshold = 0.8`. The licence allow-list was derived
  from the shipped `wasm32-unknown-unknown` graph's actual surface, not
  guessed, and the check runs with `-t wasm32-unknown-unknown` so target-only
  crates that are never built do not require an exception.
- `[bans]` — `multiple-versions = "warn"` (informational at baseline),
  `wildcards = "deny"`. Runs over the full lockfile.
- `[sources]` — only `https://github.com/rust-lang/crates.io-index`; git and
  unknown registries denied. Runs over the full lockfile.

### Baseline run (local, cargo-deny 0.20.2)

```text
advisories ok, bans ok, licenses ok, sources ok
```

- 83 packages in `wasm/Cargo.lock`. Advisories, bans and sources cover all 83
  (the full trusted build graph, dev and host targets included). The licence
  allow-list is validated only against the shipped `wasm32` graph.
- The single LGPL-2.1-or-later entry (`r-efi`) is a UEFI-only target
  dependency of `getrandom` that is never built for the shipped `wasm32`
  artifact; the licence check's `-t wasm32-unknown-unknown` scope keeps it out
  of the shipped licence surface without an allow-list exception, while the
  full-graph advisory check still sees it.
- No known RUSTSEC advisory currently applies to the locked set. This is
  point-in-time evidence only.

### `npm audit` current state (recorded, not newly enforced)

The earlier Q2 adoption recorded `npm audit --audit-level=moderate` at **0
vulnerabilities** over the 314-package npm graph. That remains a point-in-time
sample; GitHub Dependency Review is the mechanism that will keep it current on
PRs.

## CI wiring (pilot, non-required)

`.github/workflows/p1q-q8-supply-chain-pilot.yml`:

- GitHub Dependency Review on `pull_request` (and `workflow_dispatch`),
  `fail-on-severity: high`, pinned to `actions/dependency-review-action@v5.0.0`
  immutable SHA `a1d282b`.
- cargo-deny matrix on the same events, `manifest-path: wasm/Cargo.toml`,
  pinned to `EmbarkStudios/cargo-deny-action@v2.1.1` immutable SHA `3c63498`:
  - `advisories` and `bans licenses sources` run over the full lockfile;
  - `licenses` runs with `-t wasm32-unknown-unknown` (shipped graph only);
  - `advisories` runs with `continue-on-error: true` so a newly published
    advisory is recorded as information rather than turning the pilot red;
    policy checks (bans/licenses/sources) remain a hard pilot gate.
- This workflow is **not** a required PR check. Promotion to required status
  requires measured PR-time signal and wall-clock cost per the P1-Q contract.

## Promotion criteria (not yet met)

Promote to required gate only when, over a bounded observation window:

1. Dependency Review and/or cargo-deny catch a real defect or prevent a real
   vulnerable/forbidden dependency from merging; or produce no material noise;
2. wall-clock and maintenance cost on ordinary PRs stays within the accepted
   budget (both jobs are `timeout-minutes: 10`);
3. the policy config remains low-drift (no per-PR churn from `deny.toml`
   allow-list edits);
4. advisory handling is resolved so a new RUSTSEC cannot silently flip a green
   required gate without human disposition.

Until then the classification is **PILOT ONLY / NOT REQUIRED**.

## Evidence boundaries

Q8 proves nothing about runtime security, WASM/browser memory safety, scientific
correctness, collaboration authentication or production fitness. It only
constrains the dependency surface entering the trusted build graph. It does not
lower or replace any existing proof gate, and it does not change Dependabot
automation.

## Adversarial contract and dispositions

**Invariant:** no newly introduced dependency may merge with a known high-severity
vulnerability or a forbidden licence/source, and the policy must not silently
exclude dependencies that the production build actually compiles.

**Authority/production path:** the checked inputs are the real `wasm/Cargo.lock`
and the real PR base/head dependency diff; cargo-deny and Dependency Review are
the authorities over that surface.

**Pre-implementation failure modes and disposition:**

- *policy excludes shipped deps (false green):* `[graph] targets` would have
  pruned dev/host deps that CI compiles. **Caught in post-review** — licences
  now scope to the shipped `wasm32` graph while advisories/bans/sources run
  over the full lockfile, and the workflow matrix encodes that split.
- *licence allow-list drifts from actual surface:* the list is derived from the
  shipped graph's observed SPDX set, not guessed; `default` fail-closed keeps
  unknown licences out.
- *target-only LGPL crate leaks into shipped licence surface:* `r-efi` is
  UEFI-only and excluded by the `wasm32` licence scope; the full-graph advisory
  check still covers it.
- *vacuous pass:* removing the config makes `licenses` FAILED, restoring it
  passes — the check is proven non-vacuous.

**Falsifying evidence:** a deliberate bad licence (removing MIT from the allow
list) fails the check while listing the dev tree (`wasm-bindgen-test` present);
config-less runs fail; exact reconstructed action CLI (`--log-level warn
--manifest-path wasm/Cargo.toml --all-features [-t wasm32-unknown-unknown]
check <checks>`) passes for all three matrix entries; both actions are pinned to
immutable SHAs that the repo's pinning gate verifies.

**Non-goals:** Q8 does not wire either tool as a required gate yet, does not
replace Dependabot, and makes no runtime/device/security-behaviour claim.

## Next quality tranche

Q9 exact-head promotion controller (governance priority, coordinates with
RF-052) is the next P1-Q item after this pilot's classification.
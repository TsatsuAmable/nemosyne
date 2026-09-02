# P1-PT PT1B — Exact-input development WASM package cache

**Date:** 2 September 2026  
**Base:** `main@01e33d01f3b88ba95fe1a32a34dd88cecfa972c8` (#621 merged)  
**Branch:** `chore/pt1b-wasm-cache`  
**Status:** COMPLETE / POST-IMPLEMENTATION ADOPTED via #622

## Why this tranche exists

PT1A removed the universal historical UV0 browser-capture tax while preserving its risk-triggered evidence lane. The first exact-head CI run after that change completed in 248 seconds (4m08s), versus the bounded five-run pre-change p50 of 312 seconds (5m12s). One run is not a new SLO, but it exposes the remaining critical path clearly enough to select the next bounded target.

On PT1A CI run `33597510202`, coverage could not begin until `Coverage WASM package` completed. That prerequisite ran for about 55 seconds; roughly 36 seconds were the development `wasm-pack` build itself. TypeScript-only changes cannot alter the generated WASM package when every Rust/build-tool input is identical, so rebuilding that package on every such PR spends latency without adding new information.

## Hypothesis

Cache only the generated development `wasm/pkg` package under an **exact immutable input key**. If and only if that exact key is present, skip Rust toolchain setup, Cargo input-cache setup, npm installation and the `npm run wasm:dev` rebuild in the coverage prerequisite. Always upload the resulting `wasm/pkg` as the same per-run `coverage-wasm-package` artifact consumed by the three coverage shards.

The cache key must include:

- `wasm/Cargo.toml`;
- `wasm/Cargo.lock`;
- every `wasm/src/**/*.rs` source file;
- `rust-toolchain.toml`;
- `scripts/build-wasm.mjs`;
- `package.json`, which owns the `wasm:dev` command contract;
- `package-lock.json`, which pins the project-local `wasm-pack` tool used by the build script;
- an explicit cache-schema version.

There is deliberately **no restore-key prefix fallback**. A near match is a miss.

## Authority / evidence invariants

1. Rust/WASM remains the sole analytical and scale-sensitive computational authority.
2. A Rust source, Cargo dependency/lock, Rust toolchain, WASM build-script, package-script or npm-toolchain lock change must produce a different cache key.
3. Cache miss behavior is the existing build path, not a degraded fallback.
4. Cache hit behavior must still verify `wasm/pkg/nemosyne_wasm_bg.wasm` is non-empty before upload and again in every coverage shard after download.
5. Coverage shards consume a per-run GitHub artifact, not the shared cache directly. The cache is only an input to the prerequisite job.
6. Global Vitest thresholds, sharding, test grouping and merge semantics are unchanged.
7. No production/release WASM build is cached or substituted by this tranche. Production build remains independent.
8. No cache entry may be selected using a prefix/partial/branch-only key.
9. Exact-head promotion remains owned by ordinary CI/CodeQL/architecture/approval/Q9.

## Threat model / adversarial falsifiers

Reject or fix forward if any of these occurs:

- a Rust source or build-tool input can change without changing the exact package key;
- an older/partial cache can be restored through `restore-keys`;
- a cache hit bypasses the non-empty WASM verification;
- a cache miss does not execute the normal `npm run wasm:dev` build;
- coverage shards consume the cache directly and lose per-run artifact identity;
- a production release build reuses the development package;
- the action cache changes test thresholds or suppresses a test failure;
- the first hosted run cannot prove the miss/build path;
- an unchanged-head rerun cannot prove the hit/skip path;
- changing the cache mechanics weakens action pinning or supply-chain evidence.

## Hosted proof required

Adopt only after one unchanged source head proves both sides:

1. **Miss path:** exact package cache miss -> ordinary dev WASM build -> package verification -> artifact upload -> all three coverage shards + merged thresholds green.
2. **Hit path:** rerun the same coverage prerequisite at the same head after the cache has been saved -> exact cache hit -> build/setup steps skipped -> non-empty package verification -> dependent coverage remains green.

Record the observed prerequisite duration on miss and hit. Do not extrapolate a long-term p50/p95 from one warm rerun.

## Non-goals

- no production WASM cache;
- no cross-key restore fallback;
- no test-suite reduction;
- no Cargo/test threshold changes;
- no broad CI workflow consolidation;
- no claim that cached output is authoritative scientific evidence beyond being the deterministic build product for the exact pinned inputs;
- no runtime/product behavior change.

## Post-implementation adversarial disposition

**ADOPTED.** Exact head `f5d0c1349d32faf37057a51914477eb5e9bb1594` proved both required paths before #622 merged:

- CI run `33598173904` attempt 1 missed the exact package cache, executed the normal Rust/Node setup and `npm run wasm:dev`, verified and uploaded the package, and completed the ordinary checks green.
- The unchanged-head rerun hit the exact cache, skipped Rust/Node/install/build setup, re-verified and uploaded the package in about nine seconds, and all three coverage shards plus merged thresholds completed green.
- CodeQL, architecture policy, supply-chain evidence, approval and exact-head promotion gates completed green before merge.

The execution epic records the rolling clean exact-head objective as p50 <= 270 seconds and p95 <= 360 seconds. One cold or warm run is not a long-term SLO result; the objective remains operational monitoring, not a reason to keep PT1 implementation open.

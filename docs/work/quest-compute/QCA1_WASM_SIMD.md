# QCA1 — Rust/WASM SIMD128

**Status:** READY AFTER QCA0  
**Purpose:** test whether vectorization materially accelerates existing Rust/WASM analytical kernels on Quest without changing semantics.

## Work

Build a SIMD128 variant of the existing `wasm32-unknown-unknown` runtime while retaining the normal build as control. Start with measured hot numerical kernels only.

Required evidence:

- identical governed fixture outputs and replay identities;
- relevant Rust, wasm-bindgen and TypeScript bridge tests unchanged;
- per-kernel median/p95 latency on Quest;
- end-to-end impact, not microbenchmark speed alone;
- WASM size, initialization time and memory delta;
- browser capability detection and safe non-SIMD fallback.

## Adoption gate

Adopt per kernel/build only when semantic parity is exact and device measurements show material end-to-end benefit without unacceptable size/startup/memory cost.

**STOP:** unsupported, semantically divergent, or no useful device win.  
**ADOPT:** retain capability-selected SIMD build with normal WASM fallback.

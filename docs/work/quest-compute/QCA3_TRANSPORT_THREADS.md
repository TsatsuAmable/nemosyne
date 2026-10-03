# QCA3 — Data Transport, Memory and WASM Threads

**Status:** BLOCKED_BY QCA2 measurements  
**Purpose:** reduce data-copy/serialization cost and test parallel WASM only where boundary or kernel measurements justify it.

## Work

1. Measure current worker message payload size, copy/materialization time and allocation count.
2. Prefer transferable `ArrayBuffer` / typed-column ownership transfer where lifecycle permits.
3. Test shared memory / WASM threads only for a kernel that remains materially expensive after QCA1/QCA2.
4. Preserve dataset fingerprint/version fences and deterministic teardown.
5. Treat cross-origin-isolation or browser deployment requirements as explicit costs.

## Exit

For each change retain before/after latency, allocation/memory and end-to-end Quest measurements.

**STOP:** complexity, isolation requirements or synchronization erase the measured benefit.  
**ADOPT:** bounded transport/parallelism change with clear device-level gain and no authority ambiguity.

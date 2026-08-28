# RF-035A Worker-resident registration — adversarial contract

Date: 28 August 2026
Base: `main@8cdc19030815dccf45b0bd9471de11395c5f2367`
Stream: B — review / fix-forward
Status: pre-implementation

## Invariant

When an async mutation succeeds, the authoritative output handle remains resident in the same analytical Worker generation under its Rust-owned output fingerprint. A subsequent operation on that exact fingerprint must not rebuild an O(N) worker-registration payload or re-register the dataset merely because Atlas advanced its main-thread dataset version.

Residency is generation-scoped and fingerprint-scoped. A Worker/runtime generation change, explicit dataset replacement, port replacement or recovery must never assume a stale resident handle; the current main-thread Dataset must remain sufficient to materialize canonical registration data lazily when residency is absent.

## Current production path

`AtlasCore.applyAnalysisAsync()` -> `_registerCurrentDatasetInWorker()` -> `WorkerAnalyticalPort.registerDataset()` -> `analytical.worker.ts` -> Rust/WASM `data_operation()`.

For a mutation, `analytical.worker.ts` already adopts the Rust output handle with `replaceRegisteredHandle(outFingerprint, outHandle)`. `WorkerAnalyticalPort` also records the output fingerprint as registered before resolving the result. The remaining host-side cliff is earlier in the call order: Atlas obtains `_workerRegistrationPayload()` before `registerDataset()` can take its registered fast path, and after every mutation Atlas eagerly calls `_setWorkerPayloadFromDataset()`, which invokes `Dataset.toJSON()` and copies every row even though the Worker already owns the output.

## Primary failure modes

1. **False residency:** Atlas skips registration for a fingerprint that the active Worker generation does not actually own.
2. **Generation aliasing:** a resident fingerprint from an old Worker/runtime generation suppresses required recovery registration.
3. **Hidden O(N) copy:** no REGISTER message is sent, but Atlas still builds `DatasetJSON` first, so the apparent optimization leaves the allocation cliff intact.
4. **Port substitution regression:** an async port that cannot attest residency loses the only reconstruction payload.
5. **Semantic drift:** eliminating payload construction accidentally eliminates the main-thread Dataset needed by presentation, history, replay or recovery.

## Bounded implementation contract

RF-035A will not redesign mutation result transport. It will:

- expose a read-only, generation/fingerprint-scoped residency query on `AnalyticalExecutionPort`;
- implement that query in `WorkerAnalyticalPort` from the same registration set that already governs its REGISTER fast path;
- make Atlas consult residency **before** constructing registration material;
- after a successful mutation, drop the cached worker-registration payload only when the active port attests that the output fingerprint is resident;
- retain the full main-thread `Dataset` returned by the existing mutation contract;
- lazily rebuild canonical JSON registration material if residency is later absent (for example after generation advance/recovery).

## Falsifying evidence

A focused regression must demonstrate all of the following:

1. initial async mutation registers the input dataset once;
2. the mutation result marks the output fingerprint resident;
3. a chained second operation on that output sends no second REGISTER **and performs no `Dataset.toJSON()` registration snapshot** before execution;
4. generation advance clears the residency claim, causing exactly one lazy JSON materialization and a fresh REGISTER before the next operation;
5. replacing the dataset cannot reuse the previous fingerprint's residency;
6. the async mutation still returns a normal main-thread Dataset and preserves authoritative output fingerprint/ledger semantics.

The test must count both registration messages and `Dataset.toJSON()` calls. Counting REGISTER alone is insufficient because the existing defect constructs the O(N) payload before the port discards it.

## Non-goals

This tranche does **not** eliminate the Worker -> JS mutation `DatasetJSON` result, does not introduce handle-only Atlas presentation state, does not make generic operations columnar-only, and does not claim browser/Quest memory qualification. Those remain RF-035B/RF-029/RF-051 work.

## Promotion rule

RF-035 remains `IMPLEMENTATION PARTIAL / REVIEW ACTIVE` after this tranche. Promotion requires the falsifying chain above plus ordinary typecheck, focused tests, coverage and production-build gates. Whole-pipeline transfer/GC/device evidence remains outstanding.
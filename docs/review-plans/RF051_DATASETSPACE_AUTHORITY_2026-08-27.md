# RF-051 DatasetSpace authority pre-review — 27 August 2026

## Invariant

Creating live Atlas DatasetSpace metadata must not re-derive scientific identity, numeric ranges, or observation identity from raw rows when the authoritative live path already has those facts. Durable structure datum identity must agree with the Rust-compatible row-lineage contract. Missing or malformed authoritative identity must fail closed rather than be silently padded or guessed.

## Authority and production path

`AtlasCore.loadDataset` / `AnalyticalState.ensureHandle` establishes the current Rust/WASM dataset capability and hydrates the Rust-compatible first-lineage `rowIds`. `AtlasCore.datasetSpace` supplies the live kernel fingerprint and Rust-owned numeric ranges. DatasetSpace may preserve a cloned row snapshot for explicit state/export compatibility, but the live metadata path must consume the authoritative fingerprint/ranges/row identity rather than perform a second `toJSON` + per-row hash + range scan.

Direct/legacy `new DatasetSpace(dataset)` remains a compatibility path and retains the schema-v2 content-occurrence datum IDs. Old v2 snapshots must not be silently reinterpreted as durable-row-ID snapshots.

## Failure modes

- fingerprint lookup instantiates DatasetSpace and therefore clones/hashes/scans O(N) data merely to answer an identity query;
- live kernel fingerprint/ranges are supplied but DatasetSpace still serializes the clone and hashes every row;
- durable row IDs are present but discovered structures receive a second legacy content-occurrence identity namespace;
- malformed or duplicate authoritative datum IDs are accepted;
- an old schema-v2 snapshot containing `rowIds` plus legacy content-occurrence `datumIds` is reinterpreted under new semantics;
- kernel replacement/recovery leaves a stale DatasetSpace cache bound to pre-kernel metadata;
- this optimization is misreported as closing RF-051 while DatasetSpace still owns an O(N) clone and RF-035 still rematerializes large mutation results.

## Falsifying evidence

`tests/dataset-space-authority.test.ts` must prove:

1. the live Atlas path exposes DatasetSpace datum IDs equal to the durable current row IDs and uses kernel-derived ranges;
2. fallback fingerprint lookup does not invoke DatasetSpace range work;
3. explicitly supplied authoritative fingerprint/ranges/datum IDs avoid redundant DatasetSpace serialization and legacy row hashing;
4. malformed authoritative datum-ID vectors fail closed;
5. legacy schema-v2 snapshots with row IDs and content-occurrence datum IDs remain readable;
6. structure discovery on the loaded source retains the live DatasetSpace identity contract where the current-path resolver applies.

The ordinary DatasetSpace v2 round-trip tests remain part of the regression envelope.

## Non-goals / dependencies

This tranche does **not** remove the DatasetSpace row snapshot clone, make handle-only/typed datasets fully row-free for all presentation/export needs, redesign `.nemosyne` state schema, or solve Worker → JS → Worker mutation rematerialisation. Those remain RF-029/RF-035/RF-051 work. It also does not move new analytical computation into TypeScript; Rust/WASM remains the sole analytical authority.

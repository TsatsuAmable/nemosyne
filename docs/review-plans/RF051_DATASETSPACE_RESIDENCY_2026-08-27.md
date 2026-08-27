# RF-051 DatasetSpace residency tranche — adversarial contract

Date: 27 August 2026
Base: `main@0509504dde42b2df7b2bf4f74d9073a566614fa5`
Stream: B — review / fix-forward
Status: pre-implementation contract

## Invariant

Creating the live Atlas `DatasetSpace` for an already-owned row-backed dataset must not allocate another O(N) row snapshot or rederive identity/ranges that the authoritative path already supplied. Committing a kernel mutation with an authoritative output fingerprint must not eagerly construct `DatasetSpace` and therefore must not trigger row hashing or JavaScript range scans merely to retain that fingerprint.

Direct/legacy `new DatasetSpace(dataset)` and schema-v2 `DatasetSpace.fromJSON(...)` remain detached snapshot semantics. `DatasetSpaceJSON` stays version 2 and explicit persistence/export may materialise row data because persistence is an intentional O(N) operation rather than an ordinary live-state lookup.

## Authority / production path

Live path:

`AtlasCore.loadDataset()` / kernel mutation -> `AnalyticalState` owns the working `Dataset` -> Rust/WASM supplies canonical fingerprint, numeric ranges and durable row IDs -> `AtlasCore.datasetSpace` -> `AnalyticalState.getDatasetSpace()` -> `DatasetSpace`.

For synchronous/async mutation commits:

`AtlasCore.applyAnalysis*()` -> authoritative output fingerprint -> `AnalyticalState.commitKernelResult()`.

Rust/WASM remains analytical and scientific-identity authority. TypeScript may retain the already-owned working dataset reference for presentation/persistence orchestration, but this tranche must not add a second analytical implementation or a new row scan.

## Primary failure modes

1. `DatasetSpace` still calls `Dataset.clone()` on the complete live-authority path, doubling row-major JS storage for the same current dataset.
2. Removing the clone globally changes direct/schema-v2 snapshot semantics or makes `DatasetSpace.fromJSON()` share mutable row storage with its input.
3. A purported zero-copy live path silently falls back to canonical row hashing or `Dataset.rangeOf()` when any authoritative metadata is absent.
4. `commitKernelResult(..., fingerprint)` eagerly constructs `DatasetSpace`, causing an O(N) range scan after every mutation even when no caller asked for the space.
5. Removing eager construction loses the authoritative mutation fingerprint before a later consumer asks for it.
6. Borrowing the live working dataset changes the serialized `DatasetSpaceJSON` contract or prevents explicit `toJSON()` persistence.
7. Tests prove only the constructor helper while `AtlasCore.datasetSpace` still clones on the real production call path.

## Falsifying evidence to add before implementation

- Strengthen `tests/dataset-space-authority.test.ts` so complete authoritative metadata causes `DatasetSpace` construction to succeed even when `Dataset.clone()` is made to throw. This proves the authoritative constructor path is clone-free.
- Add a production-path Atlas test that makes the live working dataset's `clone()` throw after `loadDataset()` and requires `atlas.datasetSpace` to succeed with Rust-owned fingerprint/ranges/row IDs.
- Add an `AnalyticalState.commitKernelResult()` regression where the committed dataset's range scan would throw; commit must succeed without constructing DatasetSpace, and the supplied authoritative fingerprint must remain retrievable.
- Preserve existing direct/schema-v2 round-trip tests proving detached snapshot compatibility.

## Non-goals / dependencies

- This tranche does **not** remove the row-major working `Dataset` already owned by `AnalyticalState`.
- It does **not** make handle-only/typed datasets expose a row-free DatasetSpace projection.
- It does **not** solve RF-035 Worker -> JS -> Worker mutation rematerialisation or main-runtime re-registration after async mutation.
- It does **not** change `.nemosyne`, `DatasetSpaceJSON`, dataset fingerprint semantics, row-ID semantics, or representation mathematics.
- It does **not** claim generic large-dataset/Quest qualification; RF-029/RF-035/RF-051 measured browser/device evidence remains required.

## Architecture disposition

No new durable architecture, trust, scientific-semantics or public-format decision is introduced. The tranche implements the existing Rust-authority / JS-orchestration boundary and preserves the versioned DatasetSpace persistence contract, so no new RFC/ADR is required.

# RF-035B2B reference-backed result storage — adversarial contract

Date: 28 August 2026
Base: `main@0b0f4b5a8ba2af948b4a7144202f7fe45717e85f` (#487)
Stream: B — review / fix-forward
Status: implementation candidate / verification active

## Problem

RF-035B1 made derived `AnalysisHistory` version-reference backed. RF-035B2A reduced Worker -> main transfer for verified edge-free row-preserving `filter`, `sort`, and `slice` operations. The live durable evidence model still retains the complete output `DatasetJSON` on every `AnalysisResult`; the same result object is then reachable through both the result collection and the analysis event ledger. For long chains of row-preserving operations this retains repeated row-major value payloads even though every output is already proven to be only a Rust-authoritative subset/reordering of an existing dataset version.

## Invariant

For an async mutation that completed through the verified RF-035B2A row-view path:

- the durable live ledger must not retain the output row-value payload merely to preserve `AnalysisResult.dataset` compatibility;
- one authoritative full/base dataset state plus the verified output row IDs/order, schema/name metadata and logical version identity must be sufficient to reconstruct that result on demand;
- Rust/WASM remains the sole authority for output membership/order and fingerprint; TypeScript may only replay the already-verified row-ID projection;
- the external/schema-v2 `AnalysisResult` shape remains unchanged in this tranche: explicit result access, `AtlasCore.toState()`, session serialization and `.nemosyne` export may materialize the compatible full `DatasetJSON`;
- normal live access that only needs result/event counts, provenance, IDs, metrics or history metadata must not materialize historical row payloads;
- graph-bearing and derived-row results remain full snapshots unless a separately proven lossless representation exists;
- reset/restore/undo/redo/seek and branch navigation must preserve the RF-035B1 `{datasetVersion,datasetFingerprint}` identity contract.

## Bounded design

1. Extend `DatasetVersionStore` with three storage forms:
   - borrowed authoritative `Dataset` baseline (no clone retained by the store);
   - full `DatasetJSON` snapshot for results that genuinely change row values/schema/topology;
   - verified row-view entry containing base/source identity, output name/columns and durable output row IDs only.
2. A row-view entry resolves directly against its nearest full/borrowed base so chained sort/filter/slice operations do not require retaining or recursively materializing intermediate full datasets.
3. `EvidenceLedger.addResult()` accepts an internal `verified-row-view` storage hint only from the Atlas path that already passed RF-035B2A fingerprint verification. Without that hint the result remains a full snapshot.
4. The ledger stores a compatibility `AnalysisResult` object whose enumerable `dataset` property is lazy/reference-backed. Accessing or serializing that property explicitly materializes the version state; merely reading results/events/counts does not.
5. Analysis events canonicalize their `result` reference to the ledger-owned result record so live results and event ledger do not retain two independent dataset payloads.
6. `InvestigationAggregate.loadDataset()` registers the internal original dataset as the borrowed baseline. Typed/handle-only datasets remain unchanged because B2A row-view compaction is unavailable without a row-backed source.
7. Schema-v2 restore remains accepted. Restored persisted results are full snapshots initially; later verified B2A operations may again be stored as row views. A zero-result restore re-registers the restored original as the borrowed baseline so its first later compact mutation has a source without allocating another row snapshot.

## Falsifiers

The implementation is wrong if any of the following is true:

- registering a verified row-view result retains the supplied result rows as its durable backing;
- mutating/discarding that supplied result JSON changes the later materialized historical result;
- chained row-view versions require a full intermediate snapshot to materialize correctly;
- merely reading `ledger.results.length`, result identity/provenance, ledger length, or history row-count metadata calls `Dataset.fromJSON()` or otherwise materializes historical rows;
- an analysis event and result collection keep separate full dataset payloads for the same result;
- unknown/duplicate/misaligned row IDs, a missing base version, graph topology, or an unverified caller are silently compacted;
- a valid zero-result schema-v2 restore cannot accept its first subsequently verified row-view result;
- explicit schema-v2/session/replay materialization changes row values, row IDs, schema/name, result IDs, output hashes, provenance or investigation digest semantics;
- the change is described as removing all RF-035 materialization or as generic browser/Quest scale qualification.

## Post-implementation adversarial finding

The first implementation pass correctly compacted live verified row-view results but initially rebuilt the version store only from persisted `analysisResults` during `restoreState()`. A valid schema-v2 session may contain zero results; after restoring such a session, the first B2A row-view mutation would therefore have had no registered source baseline and failed closed. A dedicated regression was committed before the fix. `InvestigationAggregate.restoreState()` now re-registers the restored original dataset as a borrowed baseline using the persisted load-event identity (or the current identity for the zero-result compatibility case).

## Expected benefit

For long verified row-preserving operation chains, retained historical row-value storage becomes approximately one base/full snapshot plus O(total retained row IDs and compact metadata), instead of one full row-major dataset per result. Explicit persistence/replay still pays materialization cost in this tranche.

## Verification

A fresh exact-head CI/CodeQL/approval run is required on the corrected ownership/restore tree before promotion. Green CI will remain implementation evidence, not browser/Quest memory qualification.

## Non-goals

This tranche does not remove the main-thread current `Dataset`, the RF-035B2A transient reconstruction used to verify/commit a Worker result, schema-v2 materialization, graph/derived-result snapshots, session/package JSON cost, or the need for real browser Worker/WASM heap/GC/transfer measurements under RF-015/RF-029/RF-051.

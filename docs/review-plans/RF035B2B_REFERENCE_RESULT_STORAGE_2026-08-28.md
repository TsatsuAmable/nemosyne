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
- each scientifically identical durable row value may be retained once per row-preserving lineage, while each logical result version retains only authoritative row IDs/order plus compact metadata;
- Rust/WASM remains the sole authority for output membership/order and fingerprint; TypeScript may only cache/replay row values from a result that already passed the RF-035B2A fingerprint fence;
- borrowed/live Atlas datasets may provide compact schema/lineage metadata but must never become mutable backing storage for historical result values;
- the external/schema-v2 `AnalysisResult` shape remains unchanged in this tranche: explicit result access, `AtlasCore.toState()`, session serialization and `.nemosyne` export may materialize the compatible full `DatasetJSON`;
- normal live access that only needs result/event counts, provenance, IDs, metrics or history metadata must not materialize historical row payloads;
- graph-bearing and derived-row results remain full snapshots unless a separately proven lossless representation exists;
- reset/restore/undo/redo/seek and branch navigation must preserve the RF-035B1 `{datasetVersion,datasetFingerprint}` identity contract.

## Bounded design

1. Extend `DatasetVersionStore` with three storage forms:
   - borrowed baseline metadata: name/schema/row count/durable row IDs only, not row values;
   - isolated full `DatasetJSON` snapshot for results that genuinely change row values/schema/topology;
   - verified row-view entry containing base/source identity, output name/columns and durable output row IDs only.
2. Maintain a per-base-lineage immutable row-value cache. `registerRowView()` receives the already fingerprint-verified transient B2A `DatasetJSON` and deep-copies each previously unseen durable row value once. Reusing a row ID with different values in the same row-preserving lineage fails closed.
3. Chained/branched row-view entries resolve from that per-lineage cache rather than a mutable Atlas `Dataset` or a full intermediate result snapshot.
4. `EvidenceLedger.addResult()` accepts an internal `verified-row-view` storage hint only from the Atlas path that already passed RF-035B2A fingerprint verification. Without that hint the result remains a full snapshot.
5. The ledger stores a compatibility `AnalysisResult` object whose enumerable `dataset` property is lazy/reference-backed. Accessing or serializing that property explicitly materializes the version state; merely reading results/events/counts does not.
6. Analysis events canonicalize their `result` reference to the ledger-owned result record so live results and event ledger do not retain two independent dataset payloads.
7. The initial row-backed dataset is indexed as borrowed metadata. Because Rust row IDs may be hydrated after the initial aggregate load, Atlas refreshes that metadata immediately before an eligible compact operation only when the source entry is still a borrowed baseline; snapshot/row-view history is never overwritten.
8. Schema-v2 restore remains accepted. Restored persisted results are full snapshots initially; later verified B2A operations may again be stored as row views. A zero-result restore re-registers the restored original as borrowed metadata so its first later compact mutation has a source without allocating another row snapshot.

## Falsifiers

The implementation is wrong if any of the following is true:

- registering a verified row-view result retains the supplied result rows object as its durable backing;
- mutating/discarding the supplied result JSON changes the later materialized historical result;
- mutating a publicly reachable Atlas/base Dataset after result storage changes a historical compact result;
- the same durable row ID can be registered with different values in one row-preserving lineage without failure;
- chained row-view versions require a full intermediate snapshot to materialize correctly;
- merely reading `ledger.results.length`, result identity/provenance, ledger length, or history row-count metadata calls `Dataset.fromJSON()` or otherwise materializes historical rows;
- an analysis event and result collection keep separate full dataset payloads for the same result;
- unknown/duplicate/misaligned row IDs, a missing base version, graph topology, or an unverified caller are silently compacted;
- a valid zero-result schema-v2 restore cannot accept its first subsequently verified row-view result;
- late Rust row-ID hydration leaves the borrowed source metadata stale and prevents a valid B2A compact result from being stored;
- explicit schema-v2/session/replay materialization changes row values, row IDs, schema/name, result IDs, output hashes, provenance or investigation digest semantics;
- the change is described as removing all RF-035 materialization or as generic browser/Quest scale qualification.

## Post-implementation adversarial findings

### Restore baseline

The first implementation pass correctly compacted live verified row-view results but initially rebuilt the version store only from persisted `analysisResults` during `restoreState()`. A valid schema-v2 session may contain zero results; after restoring such a session, the first B2A row-view mutation would therefore have had no registered source baseline and failed closed. A dedicated regression was committed before the fix. `InvestigationAggregate.restoreState()` now re-registers the restored original dataset as borrowed baseline metadata using the persisted load-event identity (or the current identity for the zero-result compatibility case).

### Mutable borrowed-base alias

A second adversarial pass found that reconstructing compact history directly from a borrowed Atlas/base `Dataset` would let later mutation of a publicly reachable stale dataset reference rewrite historical evidence. A dedicated regression was committed before the correction. Borrowed entries now retain metadata/lineage only. Verified transient B2A results seed a deep-copied per-lineage row-value cache, and later materialization copies from that cache. The cache also rejects a different value presented under an already-cached durable row ID.

### Late lineage hydration

The baseline may be indexed before the Rust handle hydrates first-lineage row IDs. Atlas therefore refreshes only a still-borrowed source entry immediately before eligible compact dispatch, after `_canUseWorkerRowView` has established aligned durable row IDs. This refresh cannot replace snapshot or row-view historical entries.

## Expected benefit

For long verified row-preserving operation chains, retained historical row values become at most one isolated cached copy per encountered durable row in the lineage plus O(total retained row IDs and compact metadata), instead of one complete row-value copy per result version. Explicit persistence/replay still pays materialization cost in this tranche.

## Verification

A fresh exact-head CI/CodeQL/approval run is required on the corrected row-cache/restore/lineage-refresh tree before promotion. Green CI will remain implementation evidence, not browser/Quest memory qualification.

## Non-goals

This tranche does not remove the main-thread current `Dataset`, the RF-035B2A transient reconstruction used to verify/commit a Worker result, schema-v2 materialization, graph/derived-result snapshots, session/package JSON cost, or the need for real browser Worker/WASM heap/GC/transfer measurements under RF-015/RF-029/RF-051.

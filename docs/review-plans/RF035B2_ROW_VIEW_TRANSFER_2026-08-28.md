# RF-035B2 row-view Worker transfer — adversarial contract

Date: 28 August 2026
Base: `main@f0b91f60a5327d7d6ce462eb0a3560f91b996455` (#486)
Stream: B — review / fix-forward
Status: implementation candidate / verification active

## Problem

RF-035A removed the redundant same-generation JS -> Worker registration snapshot. RF-035B0 removed the presentation controller's duplicate result parse. RF-035B1 made derived history reference-backed. The dominant async mutation transfer still remains: `analytical.worker.ts` calls `getDatasetJson(outHandle)` for every operation and structured-clones the complete row-major output back to the main thread, even when the operation only selects/reorders existing observations.

For row-preserving operations (`filter`, `sort`, `slice`), that full values transfer is avoidable when the input is edge-free and has valid durable Rust row IDs. Rust already owns observation lineage. The main thread already owns the source row objects needed for presentation. The Worker only needs to return the authoritative output ordering/subset plus identity.

## Invariant

For a compact row-view mutation result:

- Rust/WASM remains the sole analytical authority deciding which observations survive and in what order.
- The Worker returns the authoritative output fingerprint and Rust-owned output row IDs; TypeScript does not recompute a filter, sort, slice, cluster, statistic, or scientific value.
- Atlas may reconstruct a presentation/current `Dataset` only by mapping those authoritative output row IDs onto row objects already present in the exact input dataset.
- Atlas must verify the reconstructed `DatasetJSON` hashes to the Rust output fingerprint before committing it.
- If the input/output cannot be represented losslessly as a row view, the Worker must use the existing full `DatasetJSON` result path.
- Graph/edge-bearing datasets remain on the full path in this tranche because edge remapping is scientific topology, not a JS presentation concern.
- Derived-row operations (`aggregate`, clustering that adds labels, anomaly transforms that add fields, compare, etc.) remain on the full path.

## Bounded design

1. Add a Rust/WASM `dataset_row_view` query returning a compact descriptor:
   - `name`
   - authoritative `rowIds`
   - `edgesPresent`
   - row/column counts for validation
   It must not serialize row values.
2. Expose that query through the RuntimeBridge.
3. Extend Worker operation results with a discriminated payload:
   - `{ kind: 'row-view', outputFingerprint, view }`, or
   - `{ kind: 'dataset', outputFingerprint, dataset }`.
4. Atlas explicitly opts into compact transfer only when the exact main-thread input is edge-free, has aligned unique durable row IDs, and the operation is a proven row-preserving `filter`, `sort`, or `slice`. The Worker independently re-checks the operation class and output descriptor before choosing `row-view`.
5. The Worker may choose `row-view` only when the output reports no edges and the row-ID vector is valid and complete. Otherwise it calls the existing `getDatasetJson()` and returns `kind: 'dataset'`.
6. Atlas reconstructs a row-view result by exact durable row ID from the captured input dataset. Unknown/duplicate IDs, missing source IDs, schema/shape mismatch, unexpected compact output, or fingerprint mismatch fail closed rather than silently recomputing the operation in JS.
7. Atlas adopts the internally constructed compact Dataset rather than immediately cloning it again. Direct/external dataset setters and ordinary kernel commits retain defensive-clone behavior.
8. Atlas builds the durable schema-v2 `AnalysisResult.dataset` from the reconstructed dataset so session/replay/digest contracts stay unchanged.
9. Full-path operations and synchronous execution remain behaviorally unchanged.

## Falsifiers

The implementation is wrong if any of the following is true:

- a compact `sort`/`filter`/`slice` Worker operation calls `getDatasetJson(outHandle)`;
- TypeScript determines output membership/order from operation parameters instead of Rust row IDs;
- a row-view result is used for an edge-bearing output;
- row IDs are absent, duplicated, unknown to the exact input dataset, or misaligned and Atlas still commits;
- reconstructed canonical identity differs from Rust `outputFingerprint` and Atlas still commits;
- row values, nested values, row IDs, dataset name, column schema, or result/session digest differ from the full JSON path;
- derived-row operations are compacted without a separately proven lossless projection;
- the change is described as generic large-N or Quest qualification.

## Evidence to date

The first exact-head run (`815e69d8`, CI 1286) established that Rust unit tests, TypeScript typecheck/lint/docs, production build, the WASM coverage package, and the new real-WASM row-view ABI tests were sound. Its sole observed test failure was the deliberate RuntimeBridge public-export allowlist rejecting the newly added `datasetRowView` export. That boundary test was updated to enumerate the new dataset-family API rather than weakened or bypassed. A fresh exact-head rerun is required before promotion.

The real-WASM tests prove that Rust returns authoritative sort row lineage/order through `dataset_row_view` without requiring output row-value serialization, and that graph presence is carried in the descriptor so topology-bearing output cannot take the compact path.

## Expected benefit

For eligible edge-free row-preserving operations, Worker -> main transfer becomes O(number of output row IDs) rather than O(rows × columns + nested values). The main-thread current dataset reuses existing source row objects instead of allocating a second transformed row object graph. A schema-v2 durable result snapshot is still materialized on the main thread, so RF-035 remains open.

## Non-goals

This tranche does not remove schema-v2 embedded result datasets, session autosave materialization, graph edge transfer, derived-row output transfer, or the need for real browser Worker/WASM/Quest memory measurements. It is a bounded transfer/materialization reduction, not RF-035 completion.

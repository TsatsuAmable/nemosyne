# RF-035B2B reference-backed result storage — post-implementation review

Date: 28 August 2026
Base: `main@0b0f4b5a8ba2af948b4a7144202f7fe45717e85f` (#487)
Branch: `fix/rf035b2b-reference-results`
Stream: B — independent fix-forward review
Status: corrected candidate / exact-head verification active

## Production boundary re-reviewed

`AtlasCore.applyAnalysisAsync()` → RF-035B2A verified compact row-view → `EvidenceLedger.addResult()` → `DatasetVersionStore` → live result/event/history access → `InvestigationAggregate.toState()` / schema-v2 persistence.

Rust/WASM still determines result membership/order and authoritative output fingerprint. B2B does not derive filter/sort/slice semantics in TypeScript. Only a B2A result that has already passed canonical fingerprint verification receives the `verified-row-view` durable-storage hint.

## Findings fixed before promotion

1. **Zero-result restore baseline:** a schema-v2 restore with no prior analysis results initially rebuilt no source entry for its first later compact mutation. A regression was committed before the fix; restore now re-registers original baseline metadata using persisted load identity.
2. **Mutable borrowed-base alias:** the first design reconstructed historical row views from a publicly reachable borrowed Atlas `Dataset`, allowing stale mutations to rewrite historical evidence. A regression was committed before the correction. Borrowed entries now retain metadata/lineage only; verified transient outputs seed deep-copied per-lineage row values.
3. **Late Rust lineage hydration:** baseline metadata can be indexed before first-lineage row IDs are hydrated. Atlas now refreshes only a still-borrowed source entry immediately before eligible compact dispatch; snapshot/row-view history cannot be overwritten by this refresh.
4. **Rejected-registration partial mutation:** a corrupt row-view could initially add previously unseen row values before a later cached-ID mismatch caused rejection. A regression was committed before the fix. Row-cache writes are now staged and committed only after all equality checks pass, so failure is atomic.
5. **AnalysisResult object-identity regression:** exact-head CI 1315 exposed that the first lazy-result wrapper changed object identity even though contents matched. Existing Atlas behavior requires the object returned by `applyAnalysis()` to be the same object retained in `atlas.results` and referenced by the analysis event. The fix now replaces only that object's enumerable `dataset` data property with the lazy materialization getter and retains the exact result object.
6. **Legacy/mock full-result shape assumption:** exact-head CI 1315 also exposed that the new full-snapshot clone assumed canonical row-backed `DatasetJSON.rows[]`. Existing replay compatibility still accepts historical/mock columnar payloads without `rows`. Full-snapshot storage now deep-clones the accepted payload as received rather than normalizing it, and descriptor access treats missing row arrays as zero-row compatibility metadata. Row-view compaction remains restricted to the verified canonical row-backed path.
7. **Repeated restore input mutation:** exact-head CI 1319 cleared the original result-identity failure in shard 2, but session/world tests in shards 1 and 3 exposed that `EvidenceLedger.restore()` attached lazy getters directly to caller-owned persisted result objects. Reusing the same in-memory session snapshot then failed after the version store was cleared because those input objects still pointed at the prior store. A focused regression was committed before the correction. `restore()` now materializes and copies all incoming results while any existing lazy backing is still valid, then clears internal state and attaches new lazy getters only to private copies. Restore is therefore repeatable and no longer mutates persisted result inputs.

## Evidence/falsifiability

The added RF-035B2B tests require:

- chained compact versions materialize from row IDs without full intermediate snapshots;
- metadata/result/event counts do not call `Dataset.fromJSON()`;
- transient result mutation cannot rewrite stored history;
- mutation of a borrowed/base Dataset cannot rewrite stored history;
- a repeated durable row ID with different values fails closed;
- a rejected registration cannot poison later legitimate cache state;
- graph-bearing output cannot be compacted by a row-view storage hint;
- a zero-result restored session can accept its first later verified row-view result;
- the exact live `AnalysisResult` object remains shared by the caller, result collection and analysis event;
- accepted legacy/mock full snapshots can be cloned and materialized without requiring `rows[]`;
- restoring the same persisted result/event snapshot repeatedly succeeds and leaves those caller-owned input result objects unchanged.

Existing session/replay/digest tests remain authoritative for schema-v2 and reproducibility compatibility. CI 1315 and CI 1319 failures were treated as production compatibility defects; the existing tests were not weakened. A fresh exact-head CI, CodeQL and approval-gate run on the corrected tree must all pass before the PR is promoted from draft.

## Residual risks / non-claims

RF-035 remains **IMPLEMENTATION PARTIAL / REVIEW ACTIVE**. This tranche intentionally still materializes full compatible result datasets at explicit persistence/replay boundaries; graph/derived Worker outputs remain full; current main-thread Dataset ownership is unchanged; and no browser/Quest peak-memory or latency claim is promoted. The next evidence tranche should measure the real module-Worker + real-WASM browser pipeline under RF-015/RF-029/RF-051 before choosing the next optimization target.

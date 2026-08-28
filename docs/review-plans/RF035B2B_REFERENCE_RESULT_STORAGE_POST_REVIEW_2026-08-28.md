# RF-035B2B reference-backed result storage — post-implementation review

Date: 28 August 2026
Base: `main@0b0f4b5a8ba2af948b4a7144202f7fe45717e85f` (#487)
Branch: `fix/rf035b2b-reference-results`
Stream: B — independent fix-forward review
Status: verification active

## Production boundary re-reviewed

`AtlasCore.applyAnalysisAsync()` → RF-035B2A verified compact row-view → `EvidenceLedger.addResult()` → `DatasetVersionStore` → live result/event/history access → `InvestigationAggregate.toState()` / schema-v2 persistence.

Rust/WASM still determines result membership/order and authoritative output fingerprint. B2B does not derive filter/sort/slice semantics in TypeScript. Only a B2A result that has already passed canonical fingerprint verification receives the `verified-row-view` durable-storage hint.

## Findings fixed before promotion

1. **Zero-result restore baseline:** a schema-v2 restore with no prior analysis results initially rebuilt no source entry for its first later compact mutation. A regression was committed before the fix; restore now re-registers original baseline metadata using persisted load identity.
2. **Mutable borrowed-base alias:** the first design reconstructed historical row views from a publicly reachable borrowed Atlas `Dataset`, allowing stale mutations to rewrite historical evidence. A regression was committed before the correction. Borrowed entries now retain metadata/lineage only; verified transient outputs seed deep-copied per-lineage row values.
3. **Late Rust lineage hydration:** baseline metadata can be indexed before first-lineage row IDs are hydrated. Atlas now refreshes only a still-borrowed source entry immediately before eligible compact dispatch; snapshot/row-view history cannot be overwritten by this refresh.
4. **Rejected-registration partial mutation:** a corrupt row-view could initially add previously unseen row values before a later cached-ID mismatch caused rejection. A regression was committed before the fix. Row-cache writes are now staged and committed only after all equality checks pass, so failure is atomic.

## Evidence/falsifiability

The added RF-035B2B tests require:

- chained compact versions materialize from row IDs without full intermediate snapshots;
- metadata/result/event counts do not call `Dataset.fromJSON()`;
- transient result mutation cannot rewrite stored history;
- mutation of a borrowed/base Dataset cannot rewrite stored history;
- a repeated durable row ID with different values fails closed;
- a rejected registration cannot poison later legitimate cache state;
- graph-bearing output cannot be compacted by a row-view storage hint;
- a zero-result restored session can accept its first later verified row-view result.

Existing session/replay/digest tests remain authoritative for schema-v2 and reproducibility compatibility. Exact-head CI, CodeQL and approval-gate must all pass before the PR is promoted from draft.

## Residual risks / non-claims

RF-035 remains **IMPLEMENTATION PARTIAL / REVIEW ACTIVE**. This tranche intentionally still materializes full compatible result datasets at explicit persistence/replay boundaries; graph/derived Worker outputs remain full; current main-thread Dataset ownership is unchanged; and no browser/Quest peak-memory or latency claim is promoted. The next evidence tranche should measure the real module-Worker + real-WASM browser pipeline under RF-015/RF-029/RF-051 before choosing the next optimization target.

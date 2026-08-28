# RF-035B0 controller materialization — adversarial contract

Date: 28 August 2026
Base: `main@34c08b9e9582a5f9c237fb22f45daf56c2181aa8` (#480)
Stream: B — review / fix-forward
Status: pre-implementation

## Invariant

For an async analytical mutation, AtlasCore owns the authoritative Worker result transition and constructs the committed main-thread `Dataset` exactly once. Presentation coordinators must consume that committed Atlas dataset rather than independently deserialize the same `AnalysisResult.dataset` rows.

## Current production defect

`AtlasCore.applyAnalysisAsync()` receives the Worker `DatasetJSON`, calls `Dataset.fromJSON(json)`, commits that Dataset into `AnalyticalState`, and returns an `AnalysisResult` that still embeds the same JSON. `DataOperationController.applyAsync()` then immediately calls `Dataset.fromJSON(result.dataset)` again before applying visuals/events.

This second parse allocates another complete row set on the main thread. It is not an analytical authority violation, but it is an avoidable O(rows × columns) transient copy on the primary user mutation path.

## Bounded fix

- Keep the Worker -> JS `DatasetJSON` result unchanged in this tranche.
- Keep Atlas's single `Dataset.fromJSON()` and authoritative commit unchanged.
- After `await atlas.applyAnalysisAsync(spec)`, let `DataOperationController` use the committed `atlas.dataset` as `next`.
- Preserve visual application, `OPERATION_APPLIED.datasetAfter`, row count, history and autosave behavior.
- Do not alter `AnalysisResult`, `EvidenceLedger`, `AnalysisHistory`, session schema or replay.

## Falsifying evidence

A production-class orchestration test must spy on `Dataset.fromJSON()` after setup and prove one async controller mutation causes exactly one call, owned by Atlas. Pre-fix the same test must observe two calls: Atlas commit plus controller reparse.

The test must also assert:
- `controller.transformedDataset` is the committed `atlas.dataset`;
- `OPERATION_APPLIED.datasetAfter` is that same committed Dataset object;
- the output rows/row count remain correct.

## Non-goals

The deeper RF-035B work remains open. Full result datasets are still duplicated across Worker transfer, `AnalysisResult`, event ledger/history reconstruction and session snapshots. Those durable semantics require a versioned dataset-state/materialize-on-demand design rather than deleting fields opportunistically.

No browser/Quest memory qualification claim is made.
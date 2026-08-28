# RF-035B1 canonical dataset-version state — adversarial contract

Date: 28 August 2026
Base: `main@95e294058ba7f6af8e86e591c7c3b969eb08629c` (#484)
Stream: B — review / fix-forward
Status: implementation candidate — exact-head verification pending

## Problem

RF-035A (#480/#481) removed the redundant same-generation JS -> Worker registration snapshot and RF-035B0 (#483) removed the controller's duplicate result deserialization. The remaining live main-thread multiplier is the derived `AnalysisHistory` view.

Today `EvidenceLedger._buildHistoryFromLedger()` eagerly reconstructs every historical result with `Dataset.fromJSON()`, clones the current state for each `before`, and `AnalysisHistory.push()` clones both `before` and `after` again. Merely asking for `atlas.analysisHistory` can therefore create multiple row-major copies of every historical dataset even though the ledger already owns the authoritative result JSON.

This is avoidable presentation/history materialisation, not scientific work.

## Invariant

A committed dataset version is identified durably by **both**:

- `datasetVersion` — investigation-state ordering/transition identity; and
- `datasetFingerprint` — canonical scientific content identity.

Version and fingerprint are not interchangeable. Distinct logical versions may have the same fingerprint (for example an idempotent sort or reset-to-original), and equal version numbers can appear with different fingerprints after undo/seek semantics in the current schema. Runtime Worker generation/handle identity is never durable dataset-version identity.

Derived history must carry version references and cheap shape metadata without eagerly materialising row objects. Full `Dataset` objects are materialised only when a consumer explicitly requires them, such as undo/redo/seek or schema-v2 serialization.

## Bounded design

1. Introduce a `DatasetVersionRef` containing `{ datasetVersion, datasetFingerprint }` and a small runtime `DatasetVersionStore`.
2. The store indexes the `DatasetJSON` already owned by durable `AnalysisResult` objects; registration must not clone rows.
3. `EvidenceLedger.addResult()` and `restore()` populate this index. Initial/reset states may resolve through the immutable original dataset when the fingerprint agrees.
4. Extend `AnalysisHistory` with reference-backed frames:
   - optional `datasetBeforeRef` / `datasetAfterRef`;
   - `rowCountBefore` / `rowCountAfter` for timeline/story UI;
   - a resolver used only by undo/redo/seek/current/serialization when a `Dataset` is actually required.
5. `EvidenceLedger._buildHistoryFromLedger()` builds reference-backed frames from event/spec/result identities and performs undo/redo/seek cursor movement without materialising datasets.
6. Existing direct `AnalysisHistory.push()` behavior remains clone-isolated for legacy/direct callers.
7. `NarrativeStrip` and `AnalysisStoryExporter` consume row-count metadata and must not accidentally force materialisation just to render/export timeline summaries.
8. Session schema remains version 2 in this tranche. `AnalysisResult.dataset`, event/result persistence and Worker -> JS `DatasetJSON` remain intact for compatibility. `AnalysisHistory.toJSON()` may explicitly materialise reference-backed frames at the persistence boundary.

## Falsifiers

The implementation is wrong if any of the following is true:

- reading `atlas.analysisHistory.frames()` after committed analyses calls `Dataset.fromJSON()` or clones historical datasets;
- timeline/story row counts require materialising historical rows;
- undo/redo/seek cannot reconstruct the exact expected rows, edges or row IDs;
- a same-fingerprint result at a later dataset version collapses into the earlier logical version;
- mutating a Dataset returned by undo/redo/seek alters the stored historical snapshot;
- schema-v2 session round-trip, legacy embedded-result restoration, investigation digest, graph lineage, or portable replay semantics change;
- a missing version snapshot is silently recomputed analytically in TypeScript rather than failing explicitly;
- Worker generation/handle state is serialized into durable version identity.

## Non-goals

This tranche does **not**:

- remove `AnalysisResult.dataset`;
- change schema-v2 session/package format;
- remove the Worker -> JS full `DatasetJSON` result;
- make undo/redo asynchronous;
- implement historical snapshot GC beyond the existing bounded history/result lifecycle;
- claim large-N browser/Quest qualification.

RF-035 remains **IMPLEMENTATION PARTIAL / REVIEW ACTIVE** after this tranche. RF-035B2 should use the proven version-state boundary to reduce the Worker -> JS result envelope and move full-row materialisation toward explicit consumers.
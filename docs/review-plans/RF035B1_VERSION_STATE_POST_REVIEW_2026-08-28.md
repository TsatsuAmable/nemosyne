# RF-035B1 canonical dataset-version state — post-implementation adversarial review

Date: 28 August 2026
Reviewed merge: `main@d3ea3da9ce8e5091d1e68b47b7d0f5d04e9790d6` (#485)
Stream: B — review / fix-forward
Disposition: **IMPLEMENTATION LANDED / REVIEW ACTIVE** after branch-navigation fix-forward

## What landed in #485

- `DatasetVersionRef` uses both logical `datasetVersion` and canonical `datasetFingerprint`.
- `DatasetVersionStore` indexes the existing durable `AnalysisResult.dataset` JSON without row cloning.
- derived `AnalysisHistory` frames are reference-backed with cheap row-count metadata;
- `frames()` no longer rebuilds historical `Dataset` objects;
- undo/redo/seek/current materialise only the requested state;
- direct/legacy `AnalysisHistory.push()` retains clone isolation;
- schema-v2 history serialization remains an explicit materialisation boundary;
- NarrativeStrip and AnalysisStoryExporter use row-count metadata before touching datasets.

The promotion head used by #485 passed CI 1282, CodeQL 815 and approval gate 1120 before auto-merge. All three Vitest shards, Rust, static analysis, production build and Chromium production/recovery smoke were green.

## Post-merge adversarial finding

### RF-035B1-F1 — undo/seek branch-point alias was not materialisable by exact version key

`AtlasCore.undo()/seek()` restore older content through `setCurrentDataset()` without decrementing the numeric dataset version. A subsequent branch operation can therefore legitimately target a logical input such as `{version: 3, fingerprint: <content-from-v2>}`.

The first #485 store implementation indexed only exact `{version,fingerprint}` pairs created by durable results. It could keep the branch-point reference distinct, but undoing the new branch would fail to materialise that input because no durable result had registered the alias `{3,<v2 fingerprint>}`.

This was found after the #485 promotion head had auto-merged. It is fixed forward immediately in the follow-up branch by:

- retaining exact `{version,fingerprint}` keys for logical state identity;
- adding a secondary fingerprint index solely for snapshot-content reuse;
- resolving exact key first, then canonical fingerprint;
- adding a falsifier for `analysis -> analysis -> undo -> new branch -> undo` that requires the branch-point rows and row IDs to reconstruct correctly.

This does **not** collapse logical versions. Version references remain distinct; only scientifically identical content is reused when its canonical fingerprint matches.

## Residuals / non-claims

1. **Worker -> JS full result remains.** RF-035B1 does not reduce the `DatasetJSON` returned by the analytical Worker. That is RF-035B2.
2. **Persistence still materialises.** `AnalysisHistory.toJSON()` explicitly materialises reference-backed frames to preserve schema-v2 compatibility. Frequent autosave/session serialization therefore remains a potentially large O(history × rows) boundary and must be measured/reworked separately.
3. **Runtime snapshot object mutability is pre-existing.** `DatasetVersionStore` indexes the same `DatasetJSON` object already owned/exposed by `AnalysisResult`. B1 removes extra copies but does not make that JSON structurally immutable. A later authority-hardening tranche should consider immutable/frozen result snapshots or encapsulated access.
4. **Malformed legacy identity is tolerated.** Some historical tests/fixtures reuse a fake `{version,fingerprint}` for changed row content. B1 does not turn this memory tranche into an RF-048 validation migration. Production authoritative identities remain governed separately.
5. **No browser/Quest memory qualification.** The change is structurally bounded but has not yet supplied real module-Worker/WASM heap, transfer, GC or Quest evidence. RF-015/RF-029/RF-051 retain those gates.

## Promotion condition for the fix-forward

The branch-navigation follow-up must pass the full exact-head CI/coverage, CodeQL and browser smoke gates. RF-035 remains **IMPLEMENTATION PARTIAL / REVIEW ACTIVE** even after that follow-up. The next substantive tranche is RF-035B2: identity-first/bounded Worker result envelopes with explicit row materialisation only where required.
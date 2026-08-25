# P1-A Final Exit — Columnar-Native TDA Access Pattern (Design & Test Plan)

**Status:** Design-first pass. Implementation delegated; this document is the binding specification.
**Governing docs:** `docs/P1_ANALYTICAL_RESPONSIVENESS_AND_SPATIAL_FITNESS.md` §P1-A; `docs/ROADMAP.md` Status snapshot (2026-08-25); Cardinal Rule 3 (Rust/WASM analytical exclusivity — no JS analytical fallback).
**In-flight code:** `feat/p1a-handle-native-closure` (branch commits `194d174`–`336974a`; most already landed via #395 squash). The one remaining exit condition: **a typed/columnar-only ingest handle must execute persistence, Mapper and Betti-0 without row rematerialisation.**

---

## 1. The exact seam (verified against `main` @ `b17f340`)

Two stacked choke points keep a columnar-only handle (`data_load_typed_columns`) from running TDA:

### Rust choke point (primary)

1. **Export boundary** — `wasm/src/lib.rs`:
   - `data_compute_mapper_graph` (~line 806)
   - `data_compute_persistence_intervals` (~line 845)
   - `data_compute_betti0_curve` (~line 883)

   All three open with `data::with_dataset(handle, |ds| …)`. `with_dataset` (`wasm/src/data/mod.rs:247`) → `DatasetRegistry::get` (`mod.rs:165`) dereferences `RegisteredDataset.dataset: Option<Dataset>` — the row-major slot. For columnar-only registrations it is `None`, so the export fail-closes (returns 0). There is no columnar fallback; `data_compute_structure_profile` (`lib.rs:710-713`) already demonstrates the sanctioned fallback pattern (`columnar_snapshot`) and is the precedent to copy.

2. **Compute boundary** — `wasm/src/data/topology.rs`:
   - `compute_mapper_graph(dataset: &Dataset, …)` (line 177) iterates `dataset.rows` (lines 192-201)
   - `compute_persistence_intervals(dataset: &Dataset, …)` (line 298) iterates `dataset.rows` (lines 310-319)
   - `compute_betti0_curve(dataset: &Dataset, …)` (line 365) iterates `dataset.rows` (lines 375-384)
   - `resolve_filter_values(dataset: &Dataset, …)` (line 158) reads `dataset.get_column_values(filter_column)` — row-major accessor
   - Provenance fingerprint in each export comes from `ds.fingerprint()` (row-major scheme), not `columnar_fingerprint::columnar_dataset_fingerprint` (`typed_ingest.rs:183`).

### TS choke point (secondary — adoption path)

`AtlasCore._ensureHandle` (`src/atlas/AtlasCore.ts:893-898`) → `AnalyticalState.ensureHandle` (`src/atlas/domain/AnalyticalState.ts:128-143`) calls `this._current.toJSON()` → `loadDatasetJson`. Three things do not exist:

- no typed-column ingest method on `AnalyticalKernelPort` (`src/atlas/adapters/AnalyticalKernelPort.ts`);
- no `Dataset`/buffers → `NTC1` adoption path in Atlas (the only caller of `data_load_typed_columns` is the raw probe `src/vr/scalability/QuestBoundaryProbe.ts`);
- no handle-token TDA entry point for a columnar-only current (TDA today routes `atlas.dataset`, a JS `Dataset` that a columnar-only investigation deliberately does not have).

Everything around the seam is already handle-agnostic: `_withHandle` (`RustAnalyticalEvidenceAdapter.ts:306-315`), the three `compute*ForHandle` methods (151-182), `tdaCall` (`src/wasm/runtime/DatasetHandleBridge.ts:38-61`), and the currency guard `_requireCurrentTdaHandle` (`AtlasCore.ts:878-891`, pure identity via `matchesLoadedSource`, `AnalyticalState.ts:45-47`).

---

## 2. Access pattern design

### 2.1 Rust: columnar-native TDA compute

**New internal substrate (do not change algorithm semantics).** In `wasm/src/data/topology.rs`, extract the three algorithm bodies behind a minimal borrowed-points interface:

```rust
/// Borrowed numeric point source. Implementations never materialize row maps.
struct FeatureSpace {
    row_count: usize,
    /// Per feature column, an f64 scan buffer (borrowed where the columnar
    /// column is already f64; single scratch Vec<f64> per column otherwise).
    columns: Vec<ColumnScan>,
}

impl FeatureSpace {
    fn point(&self, i: usize, out: &mut [f64]);           // gather k features for row i
    fn column(&self, c: usize) -> &[f64];                 // borrowed scan for filtration
}
```

- `From<&Dataset> for FeatureSpace` — existing row path (zero behaviour change; existing tests untouched).
- `From<&ColumnarDataset> for FeatureSpace` — the new path:
  - **primitive numeric columns** (`f32`/`f64`/integer): scan-convert to `f64`, honouring the column validity bitmap; rows with any invalid feature value are skipped (same skip semantics as the row path's missing-value handling — codify current behaviour, do not improve it here).
  - **dictionary/categorical columns**: out of scope for TDA. Fail closed with a typed error (`ColumnarTdaError::UnsupportedColumnKind`), surfaced as export return 0 + an error side-channel message. Expanding categorical support is a governed P1-C/P2 decision, not smuggled in here.
- `resolve_filter_values` gains a columnar equivalent: when explicit `filterValues` are absent or length-mismatched, derive from `space.column(0)` (first feature column — matches the behaviour frozen by `tda_derives_filtration_from_first_feature_when_explicit_values_are_omitted`).

**Export selection (mirror `data_compute_structure_profile`, `lib.rs:710-713`):**

```rust
fn tda_space(handle: u32, feature_columns: &[String]) -> Option<FeatureSpace> {
    if let Some(space) = data::with_dataset(handle, |ds| FeatureSpace::from_rows(ds, feature_columns)) {
        return Some(space)                        // row-major handle: byte-identical path;
    }
    data::columnar_snapshot(handle)               // columnar-only fallback;
        .map(|snap| FeatureSpace::from_columnar(&snap, feature_columns))
}
```

- No behavioural change for row-major handles (selection order preserves the existing path first).
- Fail closed when neither representation exists — exactly the current 0-return, unchanged contract.

**Provenance / fingerprints.** The three exports currently record provenance with `ds.fingerprint()`. For the columnar path the input fingerprint is `columnar_fingerprint::columnar_dataset_fingerprint(handle)` (already generation-token cached, `typed_ingest.rs:182-211`). Add an explicit `ingestMode: "row_major" | "columnar_only"` field to the TDA provenance envelope so replay can tell which substrate produced a result. (`DATASET_REGISTRY` already distinguishes the two; read it, don't infer it.)

### 2.2 TS: columnar adoption into the Atlas durable handle

1. **`AnalyticalKernelPort`** — add:
   ```ts
   loadTypedColumns(payload: ArrayBuffer, name?: string): number;   // data_load_typed_columns[_named]
   ```
   plus a capability probe `supportsTypedColumnIngest(): boolean` for diagnostics (telemetry-only, per CLAUDE.md flag rule).

2. **`DatasetHandleBridge.ts`** — add `loadTypedColumns(payload, name?)` using the same memory-write ABI as other buffer-loaders; mirror in the `RuntimeBridge.ts` barrel. `ColumnarBoundary.ts` already owns row-count/column-count/materialisation-count accessors — leave it unchanged.

3. **`RustAnalyticalEvidenceAdapter`** — `loadTypedColumns(payload, name?): number` with evidence validation parity with `loadDataset`; record the handle's provenance as `columnar_only`.

4. **`AnalyticalState`** — add `adoptColumnarHandle(handle, meta)`: registers the durable handle and sets current-dataset currency **without a `_sourceRef` Dataset**. `matchesLoadedSource` needs a sibling predicate: `isCurrentHandleOnly()` / currency by handle token. Rule: a columnar-only current satisfies TDA currency by handle identity alone.

5. **`AtlasCore`** —
   - new entry point `loadTypedDataset(payload: ArrayBuffer, name?)` → adapter ingest → `adoptColumnarHandle`; fires the same dataset-change events as `loadDataset` so `TDAPlanes.recompute()` re-fires;
   - new handle-token TDA entry points: `computePersistenceIntervalsForCurrent(params)` / `computeMapperGraphForCurrent` / `computeBetti0CurveForCurrent`, which skip the `Dataset` identity guard and go straight to `_ensureHandle()` → `compute*ForHandle`. The existing `Dataset`-taking methods keep their guard and delegate to these.
   - `TDAPlanes` (and `discoverMapperStructures`/`discoverPersistenceStructures`) call the `ForCurrent` variants — they already route `atlas.dataset` and only use it for currency.

6. **Wire format.** The `NTC1` encoder on the TS side: reuse the test-side payload builder from `tests/wasm-columnar-structure-profile.test.ts` (lines 25-60) — promote it to a shared production encoder `src/wasm/TypedColumnsCodec.ts` so tests, `QuestBoundaryProbe`, and Atlas adopt one encoder. (Single encoder = one place the format is defined in TS; the Rust parser remains the authority.)

### 2.3 Explicit non-changes

- Filter/sort/aggregate (`data_operation`, `operations_bridge::apply`) remain row-major-only for this exit. Columnar operation execution is a separate governed tranche; attempting it here balloons scope.
- No JS TDA of any kind (Cardinal Rule 3). The columnar fallback happens inside Rust exports only.
- No change to `.nemosyne` export format; `ingestMode` is additive provenance.

---

## 3. Test plan (the exit proof)

Use the cheapest authoritative evidence per claim (programme §Verification cadence). All tests must pass `cargo test --manifest-path wasm/Cargo.toml` + `npx vitest run`.

### 3.1 Rust unit / metamorphic (`wasm/src/data/topology.rs` + new `topology_columnar.rs` tests)

| # | Test | Assertion |
|---|---|---|
| R1 | `columnar_mapper_parity` | Same logical dataset as `ColumnarDataset` vs `Dataset` → identical `TdaMapperGraph` (nodes, edges, per-node row membership order-insensitive compare). |
| R2 | `columnar_persistence_parity` | Same for `PersistenceInterval[]` (birth/death epsilon-equal, same count/order). |
| R3 | `columnar_betti0_parity` | Same for the Betti-0 curve (per-step counts equal). |
| R4 | `columnar_filtration_derivation_parity` | No explicit `filterValues` → columnar filtration vector equals row-path `resolve_filter_values` output exactly. |
| R5 | `columnar_unsupported_column_kind_fails_closed` | Dictionary/categorical feature column → typed error, no panic, no partial output. |
| R6 | `columnar_validity_bitmap_skips_invalid_rows` | Rows with invalid feature values skipped identically to the row path's missing-value handling. |
| R7 | `columnar_export_fingerprint_is_columnar` | Provenance input fingerprint equals `columnar_dataset_fingerprint(handle)` and `ingestMode == "columnar_only"`; row-major handles still record `row_major`. |
| R8 | `no_row_materialisation_on_columnar_tda` | `row_materialisation_count()` delta is 0 across all three TDA exports on a columnar-only handle. |

### 3.2 Real-WASM (new `tests/wasm-columnar-tda.test.ts`, modelled on `tests/wasm-columnar-structure-profile.test.ts`)

| # | Test | Assertion |
|---|---|---|
| W1 | typed handle executes all three TDA ops | `data_load_typed_columns(NTC1)` → `data_compute_persistence_intervals`/`mapper`/`betti0` return non-null results. |
| W2 | row-major/columnar cross-handle parity | Load identical data via `loadDatasetJson` and `data_load_typed_columns`; all three results identical (structural equality, epsilon for f64). |
| W3 | zero rematerialisation | `ColumnarBoundary.rowMaterialisationCount()` unchanged before/after W1. |
| W4 | fail-closed still holds | Destroyed/foreign handle → 0/error, no fabrication. |

### 3.3 TS boundary (`tests/atlas-handle-native-tda.test.ts` — extend)

| # | Test | Assertion |
|---|---|---|
| A1 | columnar current runs TDA | `atlas.loadTypedDataset(NTC1)` → `compute*ForCurrent` succeed; spy asserts `loadDatasetJson` **never called** and no `toJSON` invocation anywhere in the path. |
| A2 | currency by handle token | After columnar adoption, TDA passes currency without a `_sourceRef`; after `advanceDataset` to a different dataset, stale columnar handle rejected fail-closed (generation/ownership unchanged from RES-01 semantics). |
| A3 | TDAPlanes integration | `buildTDASummaryGroup` with a columnar-only current recomputes via `ForCurrent` entry points; no `filterValues` in params (existing contract). |

### 3.4 Source/architecture contracts (extend existing slicer tests)

| # | Test | Assertion |
|---|---|---|
| S1 | `tests/p1a-tda-authority-contract.test.ts` | Add: the `AtlasCore` TDA slice must contain `ForCurrent` entry points; the slice between markers must not contain `loadDatasetJson` (in addition to the existing `toJSON` ban). |
| S2 | `tests/runtime-columnar-boundary.test.ts` | Add `loadTypedColumns` to the required `AnalyticalKernelPort`/barrel export list. |
| S3 | new Rust-source scan `tests/wasm-tda-columnar-contract.test.ts` | `wasm/src/lib.rs` TDA export bodies must not call `data::materialize_rows` (the one-way crossing is reserved for the explicit compatibility export only); `topology.rs` must not reference `HashMap<…row…>` construction in the columnar path. |

### 3.5 Exit gate

P1-A exits when: R1–R8 + W1–W4 + A1–A3 + S1–S3 pass on the implementation PR, and `docs/ROADMAP.md` Status snapshot is updated to mark the final P1-A checkbox complete. Then — and only then — the checkpoint advances to P1-B (undoing the #400/#401 correction pair).

---

## 4. Implementation sequence (for the delegated agent)

1. **Rust first, branch `feat/p1a-columnar-tda` off `main`** (the in-flight `feat/p1a-handle-native-closure` content is already in `main` via #395; confirm with `git cherry` before basing).
2. `topology.rs`: `FeatureSpace` + `From` impls + columnar `resolve_filter_values`; rows R1–R7.
3. `lib.rs`: columnar fallback in the three TDA exports + `ingestMode` provenance; R8 needs the export-level count check — expose it in the existing compatibility count or assert via Rust-side counter.
4. `wasm-pack` dev build; W1–W4.
5. TS port/bridge/adapter/Atlas/TDAPlanes adoption; A1–A3 + S1–S3.
6. Gate: `npm run typecheck` → `eslint` (0 errors) → `npm run test:all`.
7. PR; update `docs/ROADMAP.md` Status snapshot in the same PR.

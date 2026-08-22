# Dataset Ownership & Columnar WASM Migration

## Decision

Target architecture: **Rust owns canonical dataset storage; TypeScript borrows versioned views and owns interaction/rendering state.**

The current system keeps row-major mirrors in TypeScript (`Record<string, unknown>[]`) and Rust (`Vec<HashMap<String, Value>>`) and routinely materializes Rust operation results back through JSON into a new JS `Dataset`. That duplication is acceptable as a compatibility state, not as the long-term architecture.

Benchmark results quantify implementation quality and regressions; they do not decide whether canonical columnar ownership proceeds. Correctness, semantic parity, and migration safety are the gates for retiring row-major analytical paths.

## Non-goals

- No flag-day rewrite of the storage engine.
- No persistence of raw WASM pointers or process-local renderer identities.
- No claim that every column can be exposed as one primitive TypedArray. Text, categorical, nullable and graph data require structured column descriptors.
- No weakening of Rust/WASM analytical authority during migration.

## Migration invariants

1. Dataset fingerprints, versions and provenance remain the durable identity contract.
2. Renderer identity is separate from analytical identity and must not enter study manifests or model evidence.
3. WASM memory growth may invalidate JS TypedArray views; every borrowed view must therefore be generation/version checked and cheaply re-bindable.
4. Analytical operations return Rust dataset handles. Full row materialization becomes an explicit compatibility/export operation rather than the normal execution path.
5. Nullability, categorical dictionaries, text offsets, temporal units and graph edges must round-trip exactly before row-major storage is retired.
6. Once an analytical domain migrates to columnar storage, there is no silent row-major analytical fallback for that domain.

## Current migration state

Phase A is complete through durable Rust-owned row identity. Phase B is complete through the deterministic Rust/WASM boundary benchmark harness. Phase C is in progress with a registry-owned primitive columnar sidecar for numeric and temporal columns.

The Phase C sidecar is intentionally transitional. The compatibility `Dataset.rows` representation remains available, while every registered Rust dataset handle also owns contiguous primitive values plus explicit validity. Mutable handle operations rebuild the sidecar before releasing the registry lock, and the primitive-column WASM view ABI reads from the sidecar instead of rescanning row `HashMap`s.

Numeric descriptive statistics and pairwise Pearson correlation now have one canonical columnar implementation. Compatibility callers that only hold a `Dataset` construct a temporary column store and delegate to the same implementation; the former row-major numeric/correlation algorithms are retired rather than retained as fallbacks.

This is not yet the final single-storage architecture: primitive values still exist in both the row-major compatibility store and the columnar sidecar. The remaining work is to migrate temporal, categorical, evidence/support, ingest, and compatibility consumers until row materialization is exceptional rather than canonical.

## Phases

### Phase A — remove JS object-reference identity

- Introduce transient renderer row identity for existing row-object flows.
- Migrate VR preview/filter/sort/selection code away from `rowA === rowB` and structural row scans.
- Define the future durable Rust-owned row-key contract separately.
- Add regression tests for duplicate-valued rows so two observations are never conflated merely because their values match.

Exit: no renderer/interaction correctness depends on JS object reference equality.

### Phase B — benchmark the current boundary

Measure representative small, medium and large datasets for:

- import/parse time;
- `loadDatasetJson` transfer time;
- Rust operation time;
- `getDatasetJson` materialization time;
- JS reconstruction time;
- peak JS heap and WASM memory;
- renderer preparation time;
- streaming append/replace cost.

Benchmarks separate analytical compute from serialization/materialization cost. They remain diagnostic and regression evidence, not an architectural veto.

### Phase C — Rust columnar storage migration

Move dataset-size-dependent analytical work onto `ColumnarDataset` behind the existing Rust dataset API while retaining explicit compatibility row materialization during migration.

Candidate physical representations:

- numeric: contiguous f64/f32/i32 buffers;
- temporal: integer/floating epoch buffer + unit metadata;
- boolean: byte/bitmap representation;
- categorical: integer codes + UTF-8 dictionary;
- text: UTF-8 bytes + offsets;
- nullable: validity bitmap;
- graph edges: source/target/weight columns + attribute tables.

Current implementation step:

- [x] build contiguous numeric/temporal values plus explicit validity once per registered dataset handle;
- [x] rebuild the sidecar after mutable dataset operations;
- [x] source primitive WASM views from the sidecar rather than rescanning row maps;
- [x] preserve the existing numeric/temporal coercion semantics during migration;
- [x] prove numeric descriptive-statistics parity and pairwise-complete correlation parity;
- [x] retire the separate row-major numeric/correlation algorithms;
- [x] make columnar numeric/correlation analysis canonical independent of benchmark outcome;
- [ ] route the live handle-based statistics export directly through the synchronized sidecar rather than constructing a transient compatibility column store;
- [ ] migrate numeric/epoch temporal analytics to the columnar representation while preserving string-temporal compatibility explicitly;
- [ ] add categorical dictionary encoding and migrate categorical statistics;
- [ ] migrate evidence/support analyzers to canonical columnar accessors;
- [ ] add fingerprint/value/null parity fixtures across representative datasets;
- [ ] parse/import directly into canonical column storage;
- [ ] demote row materialization to explicit export/debug/legacy compatibility use.

Exit: dataset-size-dependent analytical paths no longer depend on row-major storage, and compatibility row materialization is not an analytical authority.

### Phase D — versioned WASM column-view ABI

Expose descriptors containing dataset handle/version, column semantic type, physical type, length, memory offset, validity information and dictionary/text metadata. JS may construct typed-array views only while the descriptor generation remains valid.

Exit: at least one production renderer path consumes a numeric column without full row materialization.

### Phase E — stop routine round-trips

Change `AtlasCore` operation commits so Rust output handles remain canonical. JS stores lightweight dataset metadata and borrows views as required. `getDatasetJson()` remains for persistence/export/debug compatibility.

Exit: ordinary analytical operations no longer reconstruct the full dataset in JS.

### Phase F — streaming and full retirement

Move live append/replace into Rust-owned buffers, provide versioned view refresh, then retire canonical row-major storage in both JS and Rust once all compatibility consumers are gone.

## Verification gates

Each phase requires parity tests for schema, values, nulls, duplicate rows, categorical values, temporal data, edges, fingerprints, operation outputs and session persistence.

For the columnar analytical cutover specifically, CI must prove that registration builds primitive columns correctly, mutations rebuild them, categorical columns are not mis-exposed as primitive f64 views, missing/non-finite values retain explicit validity, numeric/correlation results preserve their established semantics, and no separate row-major numeric/correlation implementation remains available as a fallback.

## Relationship to Moneta and epistemic safeguards

Moneta and future pattern-fragility/apophenia-pressure evaluation benefit from a single authoritative dataset substrate. Perturbation tests, null models, shuffles, masking and resampling should run against Rust-owned evidence rather than repeated whole-dataset JS/WASM copies. This migration is therefore infrastructure for stronger falsification tooling, not merely a performance optimization.

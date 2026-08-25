# P1-C First Pass — Sparse Topology Scalability (Design & Test Plan)

**Status:** Design-first pass. Implementation delegated; this document is the binding specification.
**Governing docs:** `docs/P1_ANALYTICAL_RESPONSIVENESS_AND_SPATIAL_FITNESS.md` §P1-C; `docs/ANALYTICS.md` (canonical op descriptions — any behaviour change updates this table); `docs/DATA_BOUNDARY_BENCHMARK.md` (predeclared-gate benchmark methodology, the template for P1-C evidence lanes).
**Prerequisite:** P1-A final exit — the substrate below must accept both `&Dataset` and `&ColumnarDataset` inputs; land alongside or after the columnar TDA work, never instead of it.

---

## 1. What the map established (verified against `main` @ `b17f340`)

**Where the quadratic work is** (`wasm/src/data/topology.rs`, `wasm/src/data/operations.rs`):

| Op | Hot loop | Actual complexity |
|---|---|---|
| Mapper intra-bin clustering | all-pairs DFS per bucket (`topology.rs:231-242`, radius `step*0.5` hard-coded) | O(N²·overlap·d) |
| H0 persistence union scan | re-scans low-filter rows with early-break only when filter span > `max_distance` (`topology.rs:337-353`) | O(N²·d) worst; **deaths never recorded** (355-359) — births only |
| Betti-0 curve | full all-pairs max-distance sweep (387-394), then a *fresh* all-pairs union-find per radius (411-421) — same pairs recomputed `steps` times | O(steps·N²·d) |
| Hierarchical clustering | recompute all cluster-pair distances per merge (operations.rs:444-463) | O(N³·d) |
| DBSCAN `region_query` | linear scan per query (operations.rs:552-563) | O(N²·d) |

**No shared pairwise substrate exists** — each algorithm rebuilds its own point cloud and pair loops. The sanctioned precedents to copy:

- **Bounded sampling with explicit provenance**: `profile.rs` cluster estimator — `MAX_CLUSTER_SAMPLE_ROWS = 65_536`, fixed-seed bottom-k selection (`cluster_sample_key`, profile.rs:258-267), method string + `sampling_seed`/`sample_count` recorded in the result (`ClusterProfile.method`, profile.rs:333-337), determinism test `bounded_cluster_estimator_is_deterministic_and_provenance_explicit` (profile.rs:1269).
- **Provenance envelope**: `wasm/src/data/provenance.rs:30-40` — `parameters` echoes op params verbatim, so mode metadata travels inside `parameters` with **no envelope schema change**; `KERNEL_VERSION` (`provenance.rs:23`) is bumped on any analytical algorithm change; result structs serialize camelCase (guarded, topology.rs:526-546).
- **Accessor pattern for dual row/columnar input**: `evaluate_clusters_from_accessor` (profile.rs:297-301).
- **Benchmark methodology**: tiered (10K/100K/1M/10M) predeclared gates, evidence lanes kept out of ordinary PR CI (programme §Verification cadence).
- **Honesty precedent**: the unused JS uniform-grid index was *deleted* rather than kept speculative (`docs/SPATIAL_ACCELERATOR_BENCHMARK.md`) — do not ship a substrate no algorithm consumes.

---

## 2. Design

### 2.1 The substrate — one new module `wasm/src/data/neighbourhood.rs`

Everything pairwise in the kernel reduces to one primitive: *iterate (index, distance) pairs within radius ε for each point over a fixed f64 point cloud.* Minimal substrate = one cloud view, one CSR graph, one mode/meta pair:

```rust
/// Borrowed dimension-strided point view. Built once per op (O(N·d)), never row maps.
pub struct PointCloud<'a> { /* columns: Vec<ColumnScan<'a>>, n: usize, d: usize */ }
impl<'a> PointCloud<'a> {
    pub fn from_dataset(ds: &'a Dataset, feature_columns: &[String]) -> Option<Self>;         // row path (today)
    pub fn from_columnar(snap: &'a ColumnarSnapshot<'a>, feature_columns: &[String]) -> Result<Self, ColumnarTdaError>; // P1-A path
    pub fn dist_sq(&self, i: usize, j: usize) -> f64;
}

/// CSR sparse graph: offsets/indices/dists(f32). Deterministic build.
pub struct RaggedNeighbourhood {
    pub offsets: Vec<u32>, pub indices: Vec<u32>, pub dists: Vec<f32>,
}

pub enum NeighbourhoodMode {
    Exact,                                  // all-pairs; small N
    Sparse { grid_cell: f64 },              // deterministic grid-hash bucketing over normalized columns
    Landmark { seed: u32, count: usize },   // fixed-seed landmark subset (profile.rs precedent); evaluation deferred until exact/sparse are proven
}

pub struct NeighbourhoodMeta {
    pub mode: NeighbourhoodMode, pub n: usize, pub d: usize,
    pub radius: f64, pub build_digest: String,  // fnv1a over mode+params+landmark identity
}

pub trait NeighbourIndex { fn radius_neighbourhood(&self, cloud: &PointCloud, eps: f64) -> (RaggedNeighbourhood, NeighbourhoodMeta); }
```

- `PointCloud` owns the O(N·d) feature extraction **exactly once** and replaces the private per-algorithm rebuilds (`topology.rs:192-201/310-319/375-384`, `operations.rs:181-190/538-547`).
- `Sparse` strategy = deterministic grid hashing over normalised columns (cell size = ε); radius query = same-cell + adjacent-cell points with exact distance filter. **No third-party ANN crate initially** — determinism and WASM fitness are contractual; the fixed-seed precedent in `profile.rs` governs any sampling.
- `Landmark` is declared in the type from day one (so provenance is stable) but **not implemented** in this tranche.

### 2.2 Algorithm convergence (result structs, ABI, JS shapes unchanged)

| Op | Convergence | Complexity after |
|---|---|---|
| Betti-0 | Build **one** neighbourhood at ε = `max_d` (the max-distance sweep), then per-radius curve = union-find over the CSR edge list filtered by `dists[i] <= r`, edges pre-sorted once | O(N²) once + O(steps·E), E ≪ N² |
| H0 persistence | Neighbourhood at ε = `max_distance`; union scan over CSR pairs in filter order. **Fix the missing deaths while at it** (see §2.4 flag) | O(N²) → O(E·α(N)) |
| Mapper | Per bucket: radius query restricted to bucket members via CSR | O(Σ E_bucket) |
| DBSCAN | `region_query` = CSR row lookup | O(N·d + E) |
| Hierarchical | Optional consumer; its O(N³) is linkage bookkeeping, not pairwise distance — **explicitly out of scope** this tranche |

Semantics must be byte-identical to today on exact mode: same radii, same tie-breaks, same `step*0.5` Mapper radius, same `0.1` radius floor — codify current behaviour first, then optimize.

### 2.3 Mode governance

- Params gain an optional `neighbourhoodMode: "exact" | "sparse"` (default: governed threshold — `exact` below `N ≤ EXACT_THRESHOLD`, `sparse` above; propose `EXACT_THRESHOLD = 8_192` rows, land the constant behind a named const and adjust only with benchmark evidence). Explicit mode in params always overrides the threshold; the effective mode is recorded.
- Record in the provenance `parameters` echo: `neighbourhoodMode`, `gridCell`/`radius`, `landmarkSeed`/`landmarkCount` (when used), `neighbourhoodBuildDigest`, plus `implementationVersion` (the existing `KERNEL_VERSION` bump covers it; do not fork version schemes). Output fingerprints change when mode changes — that is correct (different computation), and replay must surface it as a governed provenance migration.
- The TS result shapes (`TdaMapperGraph`, `PersistenceInterval`, `BettiPoint`) gain **no new required fields**; mode visibility rides the provenance envelope (`kernelProvenance`), consistent with P1-A's `ingestMode` addition.

### 2.4 Deliberate flag — persistence deaths

`compute_persistence_intervals` currently emits births with `death: None` always. Union over a sorted CSR edge list makes deaths computable for free. **Flag for user decision before implementation**: emitting real deaths changes output shape/semantics (ANALYTICS.md says "0-D persistence intervals…" without claiming deaths) and every output fingerprint. Recommendation: record deaths in the same tranche but behind the `KERNEL_VERSION` bump, with `docs/ANALYTICS.md` updated in the same PR. The P1 doc does not mandate it — leave the default as the implementer finds it unless the user approves the change.

---

## 3. Test plan

### 3.1 Rust unit / property / metamorphic (`wasm/src/data/neighbourhood.rs` + updated op tests)

| # | Test | Assertion |
|---|---|---|
| C1 | CSR correctness | Random fixed-seed cloud: `radius_neighbourhood` CSR equals brute-force all-pairs ε-filter exactly (same pairs, same distances, deterministic order). Property-test over N ∈ {2…512}, d ∈ {1…8}. |
| C2 | dual-input equivalence | `PointCloud::from_dataset` vs `from_columnar` on the same logical data → identical `dist_sq` matrix (ties into P1-A R1-R4 fixtures). |
| C3 | grid-sparse soundness | Sparse index never *misses* a pair within ε (soundness = exact superset guarantee): for adversarial clouds (clusters on cell boundaries, uniform, 1-heavy tails), sparse CSR filtered exactly equals exact CSR for the same ε. |
| C4 | determinism | Same inputs → byte-identical CSR and identical `build_digest` across runs (two builds in-process). |
| C5 | op parity on exact mode | Betti-0/persistence/Mapper/DBSCAN results through the substrate are structurally identical to pre-refactor outputs on the existing unit fixtures (no fixture content changes). |
| C6 | Betti-0 monotone sanity | Curve is non-increasing in radius, ends at 1 component at ε ≥ max-d (property, holds pre- and post-refactor). |
| C7 | provenance | Provenance `parameters` contains mode + digest; `KERNEL_VERSION` bumped once for the tranche. |
| C8 | sparse-vs-exact stability contract (small-N reference) | For N ≤ 2 000 reference fixtures, sparse-mode Mapper/persistence/Betti-0 within declared error contracts vs exact: identical connected-component counts for Betti-0; Mapper node/edge Jaccard ≥ 0.95; persistence births set-equal after quantization. Contracts predeclared in the PR description and in `docs/ANALYTICS.md`. |
| C9 | columnar-only execution | TDA ops on a typed handle use `from_columnar` + substrate with zero `row_materialisation_count` delta (extends P1-A R8/W2-W3). |

### 3.2 Real-WASM boundary

| # | Test | Assertion |
|---|---|---|
| C10 | mode echo | JS param `{ neighbourhoodMode: 'sparse' }` → provenance echoes it; default-threshold behaviour selects `exact` at small N, `sparse` above threshold |
| C11 | result ABI unchanged | camelCase serialization guard (topology.rs:526-546) still passes; TS `TdaMapperGraph`/`PersistenceInterval`/`BettiPoint` types compile unchanged |

### 3.3 Benchmark evidence lane (greenfield — no criterion today)

- New `wasm/benches/` is *not* required; follow `scripts/benchmark-data-boundary.mjs` style: a `scripts/benchmark-topology.mjs` driving the real WASM at tiers **10K / 100K / 1M** (10M only where semantically sensible for the op — Betti-0 curve at 10M with S steps is meaningful; full persistence at 10M is not — record the disposition rather than pretending).
- Predeclare gates per `docs/DATA_BOUNDARY_BENCHMARK.md` methodology (lines 78-94): e.g. "Betti-0 sparse ≤ 60 s main-thread-equivalent at 1M rows; Mapper sparse ≤ …" — implementer proposes, gates land in the PR for review **before** numbers are run.
- Results append to a new section of the benchmark doc; benchmark runs are evidence lanes, never PR CI gates.

### 3.4 Docs obligations in the same PR

- `docs/ANALYTICS.md` op table: mode column + approximation semantics.
- `docs/ROADMAP.md` P1-C checkboxes that close.
- Provenance migration note: output fingerprints change on mode switch (governed fingerprint-affecting change, MAINT-06 discipline).

---

## 4. Implementation sequence (for the delegated agent)

1. Branch `feat/p1c-sparse-neighbourhood` off `main` after P1-A columnar-TDA merges (the `from_columnar` constructor depends on it).
2. C5-first discipline: characterization tests pinning today's exact outputs on existing fixtures *before* touching algorithms.
3. `neighbourhood.rs` substrate + exact strategy; converge Betti-0 (biggest win: eliminates `steps`-fold recompute); C1-C6.
4. Converge persistence, Mapper, DBSCAN; C6-C8.
5. Sparse grid strategy + mode governor + provenance; C3, C7, C8, C10.
6. Columnar input wiring (C2, C9) — confirm against the P1-A branch contract.
7. Benchmark lane + docs updates.
8. Gate: `cargo test` → `tsc --noEmit` → `eslint` 0 errors → `npm run test:all`; PR + ROADMAP snapshot.

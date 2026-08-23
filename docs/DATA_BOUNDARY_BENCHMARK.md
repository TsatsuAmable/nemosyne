# Rust/WASM Dataset Boundary Benchmark

This benchmark measures the cost of Nemosyne's current dataset boundary while the Rust registry is in a transitional dual-representation state: the compatibility `Dataset` remains row-major, while registration also builds a synchronized primitive `ColumnarDataset` sidecar.

The benchmark therefore answers two separate questions:

1. how expensive is full `dataset_to_json()` materialisation and JS row reconstruction; and
2. how much does the borrowed primitive-column path save, including the cost of constructing its stable ABI cache from the already-built columnar sidecar.

It does **not** yet claim that Rust storage is canonical columnar or zero-copy.

## What is measured

For deterministic 4-column synthetic datasets the harness records:

- host -> WASM serialized bytes for `data_load_dataset_json`;
- Rust load latency, which currently includes construction of the synchronized primitive columnar sidecar;
- WASM -> host bytes for `dataset_to_json`;
- materialisation plus `JSON.parse` latency;
- reconstructed JavaScript row-object count;
- logical primitive payload exposed through borrowed `Float64Array` + validity views;
- first primitive borrow plus full scan latency, including stable ABI-cache construction;
- cached primitive borrow plus full scan latency;
- WASM linear-memory growth caused by first stable primitive-view preparation;
- host heap deltas around row construction, serialization and full materialisation;
- WASM linear-memory size after load;
- explicit full materialisation and primitive-cache counts.

The borrowed-view scan deliberately touches every primitive value. This prevents an unrealistically cheap benchmark that merely constructs typed-array headers without doing consumer work.

Output schema version 3 also derives decision metrics rather than leaving architectural interpretation implicit:

- full-materialisation / first-borrow speedup;
- full-materialisation / cached-borrow speedup;
- full JSON / borrowed logical-payload byte amplification;
- stable borrow-cache growth / borrowed logical-payload ratio;
- JS row reconstructions avoided;
- 100K -> 1M scaling factors for materialisation, first borrow and cached borrow.

These metrics expose the costs we intend to remove. They do not measure renderer FPS, GPU memory or Moneta quality.

## Deterministic tiers

| Tier | Rows | Normal use |
| --- | ---: | --- |
| `10k` | 10,000 | developer sanity check |
| `100k` | 100,000 | canonical-columnar scale gate, lower tier |
| `1m` | 1,000,000 | canonical-columnar scale gate, upper tier |
| `10m` | 10,000,000 | stress tier; run explicitly on a suitably provisioned machine |

The data generator is deterministic and contains two numeric columns, one numeric-epoch temporal column and one 32-level categorical column. The primitive borrowed-view comparison covers the three numeric/temporal columns; the categorical column deliberately remains outside this ABI.

## Running

Build WASM first:

```bash
npm run wasm:dev
```

Then run an individual tier:

```bash
npm run benchmark:data-boundary -- --tier=10k
npm run benchmark:data-boundary -- --tier=100k
npm run benchmark:data-boundary -- --tier=1m
npm run benchmark:data-boundary -- --tier=10m
```

Run the canonical-columnar decision pair in one process:

```bash
node --expose-gc scripts/benchmark-data-boundary.mjs --tier=100k --tier=1m --json
```

For machine-readable output, pass `--json`. `--all` runs all four tiers and remains provisioned-machine work rather than ordinary PR CI.

## Predeclared decision gate for canonical columnar storage

A follow-up PR may promote numeric/temporal columns to canonical Rust columnar storage only when like-for-like 100K and 1M evidence clears the gate encoded in the benchmark before the result is observed.

The automated gate currently requires:

1. the borrowed path reconstructs zero JS row objects;
2. the borrowed scans produce deterministic finite checksums;
3. cached primitive access at 1M is at least 3x faster than full materialisation + `JSON.parse`;
4. first borrow at 1M, including stable cache construction, is still faster than full materialisation;
5. cached-borrow 100K -> 1M scaling is no worse than 1.25x the materialisation scaling factor;
6. first-borrow 100K -> 1M scaling is no worse than 1.25x the materialisation scaling factor;
7. stable borrow-cache WASM growth at 1M is no more than 1.5x the logical borrowed primitive payload.

A passing run emits `PROMOTE_COLUMNAR_CANDIDATE`; a failed gate emits `HOLD_DUAL_REPRESENTATION`; an invocation missing either 100K or 1M emits `INCOMPLETE`.

These quantitative gates do **not** by themselves authorize deleting compatibility storage. Before the cutover, the implementation must also preserve analytical results, SHA-256 fingerprints, durable row identity, provenance, WASM memory-grow/view rebinding correctness, and explicit text/categorical/null semantics. The benchmark is the performance and duplication gate, not a substitute for correctness parity.

## CI policy

PRs that change the data-boundary benchmark or Rust data boundary run the 100K and 1M tiers together in one GitHub Actions job and publish one `data-boundary-scale-gate` artifact. Manual workflow dispatch remains available for isolated 10K/100K/1M runs. The 10M tier is intentionally local/provisioned-only.

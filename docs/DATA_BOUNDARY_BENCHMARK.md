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

These metrics expose the costs we intend to remove. They do not measure renderer FPS, GPU memory or Moneta quality.

## Deterministic tiers

| Tier | Rows | Normal use |
| --- | ---: | --- |
| `10k` | 10,000 | default smoke / developer sanity check |
| `100k` | 100,000 | routine performance comparison |
| `1m` | 1,000,000 | large-data architecture gate |
| `10m` | 10,000,000 | stress tier; run explicitly on a suitably provisioned machine |

The data generator is deterministic and contains two numeric columns, one numeric-epoch temporal column and one 32-level categorical column. The primitive borrowed-view comparison covers the three numeric/temporal columns; the categorical column deliberately remains outside this ABI.

## Running

Build WASM first:

```bash
npm run wasm:dev
```

Then run a tier:

```bash
npm run benchmark:data-boundary -- --tier=10k
npm run benchmark:data-boundary -- --tier=100k
npm run benchmark:data-boundary -- --tier=1m
npm run benchmark:data-boundary -- --tier=10m
```

For machine-readable output:

```bash
npm run benchmark:data-boundary -- --tier=100k --json
```

Output schema version 2 includes both full-materialisation and primitive-borrow metrics. `--all` runs all four tiers and is intentionally not part of ordinary PR CI.

For more stable heap measurements, invoke the script directly with `node --expose-gc scripts/benchmark-data-boundary.mjs ...`.

## Decision gate for canonical columnar storage

A later PR may promote numeric/temporal columns to canonical Rust columnar storage only when like-for-like runs demonstrate all of the following:

1. analytical results, fingerprints, durable row identity and provenance remain unchanged;
2. primitive-column consumers avoid full `dataset_to_json()` materialisation and reconstruct zero JS row objects;
3. borrowed access scales materially better than full materialisation at 100K and 1M, with 10M used as a provisioned-machine stress confirmation;
4. the first-borrow cache cost does not merely shift the removed JS allocation into an equally expensive extra Rust/WASM copy;
5. the measured Rust dual-representation overhead provides a clear reason to eliminate the row-major compatibility store rather than retain both indefinitely;
6. WASM memory-growth/view rebinding remains correct and tested;
7. text/categorical/null semantics continue to fail closed or use an explicitly versioned representation.

No absolute timing threshold is hard-coded because hosted runners are noisy. Architectural acceptance should compare ratios and scaling behavior on the same machine/runtime. A strong signal is not just a faster typed-array read: it is reduced end-to-end materialisation, fewer duplicated representations, and bounded memory growth.

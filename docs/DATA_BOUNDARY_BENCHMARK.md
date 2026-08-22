# Rust/WASM Dataset Boundary Benchmark

This benchmark measures the cost of the current mirrored row-major dataset boundary before Nemosyne promotes the Rust primitive-column prototype into canonical storage.

## What is measured

For deterministic 4-column synthetic datasets the harness records:

- host -> WASM serialized bytes for `data_load_dataset_json`;
- Rust load latency;
- WASM -> host bytes for `dataset_to_json`;
- materialisation plus `JSON.parse` latency;
- reconstructed JavaScript row-object count;
- host heap deltas around row construction, serialization and materialisation;
- WASM linear-memory size after load;
- explicit dataset materialisation count.

These metrics deliberately expose the cost we intend to remove. They do not claim to measure renderer FPS, GPU memory or Moneta quality.

## Deterministic tiers

| Tier | Rows | Normal use |
| --- | ---: | --- |
| `10k` | 10,000 | default smoke / developer sanity check |
| `100k` | 100,000 | routine performance comparison |
| `1m` | 1,000,000 | large-data architecture gate |
| `10m` | 10,000,000 | stress tier; run explicitly on a suitably provisioned machine |

The data generator is deterministic and contains two numeric columns, one numeric-epoch temporal column and one 32-level categorical column.

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

`--all` runs all four tiers and is intentionally not part of ordinary PR CI.

For more stable heap measurements, invoke the script directly with `node --expose-gc scripts/benchmark-data-boundary.mjs ...`.

## Decision gate for canonical columnar storage

The benchmark exists to compare the current JSON/materialisation path with subsequent borrowed-column paths. A later PR may promote numeric/temporal columns to canonical Rust columnar storage only when it demonstrates all of the following on the same deterministic tiers:

1. analytical results, fingerprints, durable row identity and provenance remain unchanged;
2. primitive-column consumers avoid full `dataset_to_json()` materialisation;
3. boundary bytes and reconstructed JS row-object counts fall materially for those consumers;
4. peak host memory and latency improve at 100K, 1M and 10M rather than merely shifting allocation elsewhere;
5. WASM memory-growth/view rebinding remains correct and tested;
6. text/categorical/null semantics continue to fail closed or use an explicitly versioned representation.

No single timing threshold is hard-coded yet because GitHub-hosted runners are noisy. The first collected baseline establishes ratios and scaling behavior; architectural acceptance should compare like-for-like runs on the same machine/runtime.

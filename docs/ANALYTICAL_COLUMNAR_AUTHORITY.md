# Analytical Columnar Authority

## Decision

Rust columnar storage is the canonical analytical substrate for dataset-size-dependent numeric work. Benchmark results are observational evidence, not a go/no-go gate for this architecture.

## Current authority boundary

- Numeric descriptive statistics and pairwise Pearson correlation execute from synchronized columnar values plus validity buffers.
- Row-major `Dataset.rows` remains available only for compatibility domains that have not yet migrated, including categorical/text policy, string-temporal handling, graph operations, serialization/export, and transitional callers.
- There is no row-major numeric/correlation analytical fallback in the live handle-based path.
- Compatibility callers that hold only a `Dataset` construct a temporary `ColumnarDataset` and invoke the same canonical analytical implementation.

## Correctness gates

Columnar migration is governed by semantic and mathematical parity, not by minimum speedup. Required gates include numeric value and missingness parity, pairwise-complete correlation parity, deterministic outputs, synchronized dataset/columnar generations after mutation, unchanged serialized `Facts` compatibility shape, and no silent fallback to row-major numeric analysis.

## Next migrations

1. Migrate temporal numeric/epoch analysis to columnar buffers while preserving explicit string-temporal compatibility semantics.
2. Add categorical dictionary encoding and move categorical statistics off row maps.
3. Route evidence/support analyzers onto canonical columnar accessors.
4. Parse/import directly into canonical column storage and demote row materialization to explicit compatibility/export use.
5. Retire mirrored row-major Rust analytical storage once all remaining compatibility consumers have moved.

The #269 boundary benchmark remains useful for diagnosing regressions and quantifying progress, but it does not determine whether canonical columnar ownership proceeds.

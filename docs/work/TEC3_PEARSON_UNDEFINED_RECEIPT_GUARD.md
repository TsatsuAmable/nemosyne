# TEC3 Pearson undefined-statistic evidence guard

**Scope:** one Rust-owned, fail-closed correction on the existing Pearson receipt; no `Facts` numerical/wire or V1 envelope format change. **Base:** `main@621275d9`. **Status:** implementation/qualification open; not TEC/FM0 completion.

## High-risk pre-implementation contract

- **Invariant:** The canonical Rust Pearson calculator distinguishes a mathematically defined coefficient of exactly 0 from its compatibility fallback `0.0` for fewer than two pairwise valid observations or a denominator at/below the currently implemented `1e-12` threshold. Neither a descriptive nor inferential governed consumer may resolve an undefined Pearson receipt.
- **Authority/production path:** `statistics_columnar::pearson_pairwise` is the *single* numerical source. Expose a Rust-only diagnostic from the same algorithm; `statistics_evidence::compute_statistics_evidence` attaches an existing V1 `violated` assumption plus explicit limitation when the numerical output is the undefined sentinel. The sealed `descriptive-summary/v1` profile already refuses violated assumptions; TS only transports and resolves the Rust-issued claim.
- **Attack cases:** (1) constant x, varying y with multiple complete rows, (2) fewer than two pairwise-complete observations despite nonconstant full columns, (3) both columns sparse/absent, (4) legitimate orthogonal zero-correlation pattern. For each, compare Rust `Facts` numerical compatibility value, Rust-issued receipt support/assumptions and live WASM typed consumer decision. Positive nonzero pair validates no broad refusal. A stale receipt cannot mutate an old archive into a new claim.
- **Failure modes:** independently recomputing a threshold or Pearson algorithm in TS; declaring a null correlation when only a small n makes inference uncertain; silently changing `Facts.correlation.value` or historical digest semantics; treating a zero sentinel as established scientific evidence; reordering existing receipt assumptions on well-defined pairs; using a mock kernel rather than real WASM.
- **Falsifiers:** Rust unit parity tests for numerical value and diagnostic status; production real-WASM tests for constant/under-supported/legitimate-zero/nonzero pairs, bundle identity, `VIOLATED_ASSUMPTION` refusal for undefined and `RESOLVED` descriptive legitimate zero. Gate must fail on removal of Rust-emitted status.
- **Non-goals/dependencies:** no new significance test, no p-values, no confidence intervals, no universal variance cutoff beyond the already-used algorithm threshold, no historical mutation or V1 schema extension. Keep existing archives byte-preserved. This is a correction implementing accepted RFC 0007 / ADR 0007 explicit-assumption refusal, not an expansion of scientific authority. If review finds an actual new statistical policy needed, stop for separate owner RFC.

## Exit

Exact-head host Rust + actual WASM Vitest + coverage + production smoke + CodeQL + approval gate; adversarial review and honest limitations. No Quest or human research claims.

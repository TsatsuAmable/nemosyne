# Stream M M2 — Rust empirical-distribution builder

**Date:** 29 August 2026  
**Stream:** M — Moneta Distribution Truth  
**Checkpoint:** M2 — Rust builder and real WASM proof  
**Base:** `main@cce8a36b40c414cd90cac9e01d4362dfbbcc51c2`  
**Status:** PRE-IMPLEMENTATION ADVERSARIAL CONTRACT

## Invariant

Given a canonical resident dataset handle and a valid explicit distribution request, Rust returns a deterministic bounded empirical-distribution envelope computed only from the named numeric column. TypeScript transfers parameters/provenance only and performs no statistics. Invalid parameters, missing evidence, an empty valid population or unavailable authority produce an explicit refusal or null ABI failure; they never fabricate a plausible distribution.

## M1 contract correction discovered before implementation

The canonical columnar store intentionally normalizes both missing and non-finite primitive inputs to `value=0` with `validity=0`. Its canonical fingerprint serializes both as `null`. M2 therefore cannot truthfully reconstruct separate `missingCount` and `nonFiniteCount` values from the resident handle, and retaining a hidden side channel would allow two analytically different outputs to share one dataset fingerprint.

Because M1 established no production consumer, V1 is corrected before builder publication to:

```text
sourceCount = validCount + excludedCount
```

`excludedCount` means canonical invalid numeric observations after ingest normalization. It makes no claim about whether an upstream source cell was absent, null, unparsable or non-finite. A later split requires a separately governed ingest + canonical-identity migration; M2 must not imply one.

## Authority and algorithm

- Authority: `wasm/src/moneta/distribution_embodiment.rs` over `data::with_columnar_metadata`.
- Input: V1 request with explicit numeric `measureField`, bounded bin/knot counts and strictly increasing quantile probabilities.
- Valid population: resident primitive values with non-zero validity; canonical storage guarantees these values are finite.
- Histogram: exactly the requested equal-width bin count for a non-constant domain; one closed occupied bin for a constant domain; half-open bins except the final closed bin.
- ECDF: cumulative endpoints for unique sorted values, deterministically reduced to at most the requested knot count while retaining the final `(validCount, 1)` endpoint.
- Quantiles: Hyndman-Fan type 7 / linear R7 interpolation over sorted finite values.
- Approximation: `BINNED`; `representedRowCount=validCount`.
- Bound: at most 256 histogram bins + 256 ECDF knots + 32 quantiles = 544 elements, independent of source N.

## Primary failure modes

1. TypeScript or row-shaped code computes statistics instead of Rust using the resident handle.
2. The builder silently selects a different or first numeric measure.
3. Zero is treated as missing, or invalid values enter sorting/arithmetic.
4. Constant-domain data divides by zero or creates empty/overlapping bins.
5. Maximum values fall outside the last bin because of interval arithmetic.
6. Duplicate values produce multiple contradictory ECDF probabilities for one value.
7. The ECDF reduction omits the final endpoint or becomes nondeterministic.
8. Quantile interpolation is off by one, unsorted or inconsistent with declared probabilities.
9. Output grows with source N rather than request bounds.
10. Invalid/empty data returns READY with zeros instead of a refusal.
11. Request/provenance rows cross the ABI or stale/invalid handles appear successful.
12. The M1 count correction hides a fingerprint/ingest migration or claims source-level missingness detail that does not exist.

## Falsifying evidence

M2 must add:

- Rust reference fixtures with hand-calculable bins, duplicate-aware ECDF endpoints and R7 quantiles;
- row-order metamorphic equality;
- zero, constant, all-invalid, unknown/non-numeric measure and output-bound cases;
- a typed-column fixture proving canonical non-finite normalization contributes to `excludedCount` without a false source classification;
- real-WASM tests proving handle + request-only input, dataset fingerprint binding, deterministic output and no rows/layout;
- a large-source test proving element count is bounded independently of N.

## Non-goals and dependencies

M2 does not add Worker/loader production transport, renderer geometry, product UI, weights, smoothing, KDE/PDF, multivariate distributions, source-level invalid-reason provenance, a new fingerprint version or any TypeScript statistical fallback. Distribution remains `SEMANTICALLY_OVERCLAIMED` and row-dependent in the production inventory until M3.

## Post-implementation adversarial review

Pending implementation and focused verification.

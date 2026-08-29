# Stream M M1 — Empirical distribution contract and falsifiers

**Date:** 29 August 2026  
**Stream:** M — Moneta Distribution Truth  
**Checkpoint:** M1 — distribution contract and falsifiers  
**Base:** `main@2e77fe333ebacfd30941e7dc7194dea7402ab731`  
**Status:** IMPLEMENTED — M2 COUNT AMENDMENT UNDER REVIEW

## Invariant

`DISTRIBUTION_FIELD` means a bounded univariate empirical-distribution summary with an explicit numeric measure, deterministic equal-width histogram bins, bounded ECDF knots, explicit quantiles and truthful source/valid/excluded counts. It has a distinct candidate, payload and geometry identity from `DENSITY_FIELD`; contains no rows; and cannot be described as PDF, KDE, continuous density or contour output.

M1 defines and validates this contract only. It must not claim that the Rust builder, Worker transport, renderer or product path exists before M2/M3.

## Authority and production path

- Rust `wasm/src/moneta/embodiment.rs` is the canonical wire-contract validator/normalizer.
- TypeScript `SemanticEmbodimentPayload.ts` mirrors the versioned wire shape for orchestration only.
- `RepresentationCandidate.ts`, bootstrap Moneta and learned Moneta must preserve the distinct empirical-distribution identity instead of mapping it to density geometry.
- M2 will own computation from the resident canonical dataset handle.
- M3 will own the Worker/WASM/renderer production cutover.

The eventual production path is:

```text
explicit distribution requirement + measure
  -> DISTRIBUTION_FIELD decision
  -> resident Worker/WASM dataset handle
  -> Rust empirical-distribution builder
  -> SemanticEmbodimentEnvelopeV1 / EMPIRICAL_DISTRIBUTION
  -> distribution-specific renderer
```

## Reviewed V1 mathematical object

The request requires:

- `measureField`: non-empty explicit field identity;
- `histogramBinCount`: integer in `1..=256`;
- `ecdfKnotCount`: integer in `2..=256`;
- `quantileProbabilities`: non-empty, finite, strictly increasing values in `[0, 1]`, at most 32.

The payload contains:

- explicit finite domain minimum/maximum;
- contiguous equal-width histogram bins with deterministic half-open intervals except the final closed interval;
- bounded ECDF knots with finite values, monotone cumulative counts/probabilities and a final endpoint of `(validCount, 1)` when data is present;
- quantile results matching the requested probabilities, with recorded interpolation policy;
- source, valid and canonical-excluded counts whose sum is source count;
- stable semantic IDs for bins, knots and quantiles;
- no row fragments or observation identifiers.

Constant-domain data is valid: the domain has equal minimum/maximum and is represented by one closed occupied bin. Empty valid data must be an explicit refusal, not a plausible zero distribution.

Hard output bounds are independent of source N:

```text
histogram bins <= 256
ECDF knots <= 256
quantiles <= 32
total semantic elements <= 544
```

## Information and approximation semantics

- preserves: `population-density-distribution`, `outlier-boundary-visibility`;
- loses: `individual-observation-identity`, `exact-metric-values`;
- approximation mode: `BINNED` because the combined visual summary contains a governed histogram and bounded ECDF, even though individual quantile values may be exact under the declared interpolation rule;
- `representedRowCount` equals valid numeric observations, not source N;
- method parameters record interval, binning, ECDF selection, quantile interpolation and canonical invalid-value policy.

M2 pre-implementation review corrected the original separate missing/non-finite fields before any production consumer existed. Canonical V1 ingest and fingerprinting intentionally normalize both cases to the same invalid/null state, so the resident-handle builder can truthfully report only `excludedCount`. Source-level invalid-reason provenance requires a separately governed ingest and identity migration.

The inherited information-type name `population-density-distribution` is retained as the existing ontology identifier; prose/UI claims must say empirical distribution, not continuous density.

## Primary failure modes

1. Distribution continues to map to `DENSITY_FIELD` geometry despite a new payload type.
2. Candidate prose still claims bivariate correlation, PDF, continuous contours or exact per-observation values.
3. The request permits an absent/blank measure and a later layer silently chooses a numeric column.
4. NaN/Infinity enters JSON as plausible analytical output.
5. Counts do not reconcile, making canonical invalid-value exclusion invisible.
6. Histogram intervals overlap/gap, bins exceed bounds, or constant-domain data is rejected/fabricated.
7. ECDF probabilities/counts are not monotone or do not terminate at one/valid count.
8. Quantile probabilities are unsorted/duplicated or results do not match the request.
9. Resource element counts do not match payload elements or exceed the hard V1 bound.
10. Raw rows or observation fragments are smuggled into the envelope.
11. M1 tests accidentally promote the candidate to `DATASET_LEVEL_VALID` before the builder/renderer exists.
12. The common contract grows into a representation mega-schema rather than a discriminated family payload.

## Falsifying evidence

M1 must add tests that fail when:

- bootstrap or learned Moneta maps distribution to density geometry;
- candidate prose/support/preservation resurrects bivariate/PDF/continuous-density/exact-value claims;
- request or payload bounds/ordering/count invariants are violated;
- candidate/family/payload identities disagree;
- semantic IDs duplicate;
- rows or unknown fields appear;
- non-finite numerical values appear;
- the cross-language round trip is nondeterministic;
- the A2 inventory calls distribution dataset-level valid or raw-row-free before M3.

## Non-goals and dependencies

M1 does not:

- compute a histogram, ECDF or quantile from a dataset;
- add a WASM builder export or Worker operation;
- make the loader request a distribution payload;
- render distribution geometry;
- add the UI-owned `Show distribution` action;
- implement density/KDE, weighting, categorical/multivariate distribution, smoothing or inferential uncertainty;
- close RF-001/RF-002 or promote P1-R.

M2 depends on this contract. M3 depends on M2. M4 owns browser/scale/perceptual product evidence.

## Post-implementation adversarial review

The implementation review found and corrected three contract gaps before publication:

1. rejected-candidate alternatives in bootstrap Moneta were still deriving geometry without the candidate identity, which could re-alias distribution to a layout default;
2. contiguous histogram bins alone did not prove the reviewed equal-width method, so the Rust validator now verifies the expected deterministic boundaries;
3. free-form analytical parameters could disagree with payload quantiles or policy claims, so Rust now parses a strict method-parameter shape and couples declared probabilities to the quantile payload.

The resulting M1 implementation:

- adds distinct `DISTRIBUTION_FIELD` geometry to bootstrap, learned and graph-adapter contracts;
- narrows candidate prose and ontology to a univariate empirical object with explicit exact-value and identity losses;
- adds discriminated Rust/TypeScript request and payload types without adding a builder or renderer;
- validates finite domains, reconciled observation counts, equal-width/constant-domain histograms, monotone ECDFs, explicit quantiles, unique semantic IDs and the 544-element hard bound;
- preserves the A2 `SEMANTICALLY_OVERCLAIMED` classification and raw-row dependency until M3.

Local evidence before publication:

- `git diff --check` — passed;
- `node scripts/check-docs.mjs` — passed;
- `node scripts/check-actions-pinned.mjs` — passed;
- Prettier parse/write for the new M1 WASM contract test — passed;
- TypeScript 6 syntax/transpile check over all changed TypeScript files — passed.

This container does not provide Cargo or the complete installed JavaScript dependency tree, so Rust unit tests, full TypeScript typechecking and the real-WASM Vitest contract were delegated explicitly to the governed PR gates.

Governed evidence on implementation head `ed0f12558dd9ae15407f139b15dee2aba120531f`:

- CI run [33274735199](https://github.com/TsatsuAmable/nemosyne/actions/runs/33274735199) — Rust kernel, static analysis/typecheck, coverage WASM package, all three Vitest coverage shards, merged coverage, production build, Chromium production smoke and Node 24 passed;
- CodeQL run [33274735186](https://github.com/TsatsuAmable/nemosyne/actions/runs/33274735186) — passed;
- Q0 architecture and Q8 supply-chain workflows — passed;
- Q9 exact-head run [33274791741](https://github.com/TsatsuAmable/nemosyne/actions/runs/33274791741) — passed;
- approval gate run [33274791762](https://github.com/TsatsuAmable/nemosyne/actions/runs/33274791762) — passed.

Disposition: the M1 contract is engineering-verified for its bounded scope. It still makes no claim that a dataset-derived builder, Worker transport, renderer or visible product path exists; those remain M2-M4.

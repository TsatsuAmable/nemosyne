# MONETA-JEV-01 Qualification Experiment

Status: blocked at Jev execution authentication; fixture preparation complete.

## Purpose

Test whether a bounded probabilistic decision layer adds predictive information beyond Moneta's existing deterministic constraints and fitness machinery. This experiment MUST NOT make Jev an analytical or runtime authority.

## Provider-neutral contract

The intended comparison is Jev vs open/local substitutes using equivalent primitives:

- choice(state, alternatives) -> probability distribution
- noul(state, proposition) -> probability / confidence
- score(state, ordered rubric) -> ordinal distribution

## Fixture 01: univariate empirical distribution

State:

> Investigator question: What is the empirical shape of a single numeric variable and are there unusual tails or modes?
>
> Dataset evidence: 12,000 observations; one explicit numeric measure; no temporal, graph, hierarchy, geospatial, or source partition semantics.
>
> Candidate A DISTRIBUTION_FIELD: empirical histogram/ECDF/quantiles; supports univariate distribution and anomaly isolation; preserves empirical distribution shape; loses individual identity and exact metric values.
>
> Candidate B POINT_SET: discrete observation marks; preserves observation identity and exact metric values; loses population density distribution.
>
> Candidate C AGGREGATE_VOLUME: grouped aggregate blocks; requires explicit grouped aggregate semantics, which are absent.
>
> Hard constraints are authoritative and candidates that require absent semantics must not be selected.

Questions:

1. Choice `representation_choice`: Which candidate best answers the investigator question while respecting the supplied evidence and hard constraints?
   - DISTRIBUTION_FIELD
   - POINT_SET
   - AGGREGATE_VOLUME
2. Noul `evidence_sufficient`: Is the supplied evidence sufficient to prefer one admissible candidate for this investigator question?
3. Score `semantic_fit`: How strong is the semantic fit of the best admissible candidate to the investigator question?
   - Poor
   - Weak
   - Adequate
   - Strong
   - Excellent

## Jev playground probe

On 2026-09-24 the public playground accepted configuration of the state and all three questions and identified the model as `typesafe-ai/jev`, but execution opened a sign-in dialog. No unauthenticated result distribution was obtainable. Do not treat this as a model result.

## Next experimental step

1. Keep this branch isolated from production Moneta.
2. Implement fixture serialization and result capture behind a provider-neutral adapter.
3. Run an open/local baseline without waiting for Jev credentials.
4. If Jev authentication/API access becomes available, execute the exact same frozen fixtures.
5. Compare ranking accuracy, calibration, abstention, perturbation stability, latency/cost and reproducibility against existing Moneta/MonetaBench evidence.

Promotion requires evidence that the probabilistic layer adds predictive information beyond existing deterministic and learned fitness machinery.

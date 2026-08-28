# P1-Q Q2 Property Testing Pilot — Dataset Identity Falsifier

**Date:** 28 August 2026  
**Baseline:** `main@1843805696a02e87ae81ca8974d2c846f44f5cf3` (#495 merged)  
**Status:** PILOT ACTIVE / FIRST FALSIFIER FOUND A PRODUCTION DEFECT

## Scope

Q2 begins with the highest-authority identity invariant already named in the P1-Q plan:

> the large-dataset asynchronous dataset fingerprint must be exactly equal to the canonical scientific identity produced by the established synchronous path.

This tranche does not yet add `fast-check` or `proptest`. The first bounded falsifier exposed a concrete production defect before a generator library was necessary, so the correct response is to repair and retain that deterministic regression first. Property-library evaluation follows only after the authoritative invariant is green.

## Invariant

For every valid `DatasetJSON` under the current `sha256-canonical-dataset-v1` contract:

```text
await canonicalDatasetIdentityHexAsync(dataset)
=== canonicalDatasetIdentityHex(dataset)
```

The equality is byte-semantic, not merely shape-equivalent. The two functions must commit to the same canonical projection, recursive object-key ordering, optional-field semantics and row sequence.

## Falsifying review of `main`

The asynchronous path in `src/data/DatasetIdentity.ts` diverged from `canonicalJsonStringify` in three ways once the dataset crossed the 50,000-row streaming threshold:

1. it emitted top-level keys as `name, columns, edges, rows`, while canonical serialization sorts them as `columns, edges, name, rows`;
2. it serialized columns/edges with ordinary `JSON.stringify`, so nested edge-attribute object key order could differ from recursive canonical ordering;
3. it emitted row separators using `i > start`, which omits the comma between successive 10,000-row chunks.

It also omitted an explicitly present empty `edges: []` field from the async preimage while the canonical synchronous projection retains it. That changes scientific identity even though the logical dataset object differs only in optional-field presence.

These are RF-048 identity-contract defects, not a new analytical authority and not evidence that property testing itself should become a blanket merge gate.

## Fix

The async path now constructs the exact canonical top-level order and delegates all nested structures to `canonicalJsonStringify`. Row commas use the absolute row index so chunk boundaries cannot alter the preimage. Explicit empty edge arrays are preserved.

No identity algorithm version is changed because the intended contract remains `sha256-canonical-dataset-v1`; this repair makes the async implementation conform to that existing contract.

## Retained regression evidence

`tests/q2-dataset-identity-parity.test.ts` runs in the fast Node lane and crosses the real 50,000-row threshold. It verifies:

- synchronous/async identity equality across multiple 10,000-row chunk boundaries;
- recursive canonical ordering for nested edge attributes authored in non-canonical key order;
- parity for an explicit empty edge set;
- parity when the edge field is absent;
- the existing semantic distinction between explicit `edges: []` and no `edges` field remains visible in the canonical digest.

The regression is intentionally deterministic. If later `fast-check` finds a smaller or different counterexample, retain that shrunk case separately rather than replacing this threshold-specific boundary test.

## Non-goals

- no claim that `canonicalSha256HexStreaming` is genuinely constant-memory; its current chunk accumulation/materialization behavior belongs to RF-029/RF-035 scale work;
- no dataset identity algorithm/version change;
- no Rust authority change;
- no new required dependency or blanket property-test gate;
- no broad Q2 adoption classification until `fast-check` and `proptest` are measured on additional bounded invariants.

## Next Q2 step after this fix is green

Pilot `fast-check` on small generated datasets below the streaming threshold plus selected boundary cases, preserving reproducible seeds and shrunk counterexamples. Initial generated properties should cover canonical projection invariance under undeclared row fields, row-ID exclusion, graph endpoint type sensitivity and presentation-only metadata exclusion. A Rust `proptest` pilot should then target the corresponding canonical projection/fingerprint contract and cross-language golden cases without inventing a second identity implementation.

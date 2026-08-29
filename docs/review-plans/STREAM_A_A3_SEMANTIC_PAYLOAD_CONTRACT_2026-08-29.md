# Stream A A3 — semantic embodiment payload contract

Date: 2026-08-29  
Stream: A — Analytical Scale & Representation Authority  
Checkpoint: A3 — P1-R1 semantic embodiment payload contract  
Base: `main@3494e3477695e5ddebfa1a8e21d581e2d3dd9f5b`  
Status: IMPLEMENTATION LANDED ON BRANCH / REVIEW ACTIVE

## Purpose

A2 proved that Nemosyne has semantic candidate identities richer than the renderer contract. Production translation still funnels source rows into embodiment, and semantically distinct candidates can collapse onto layout-driven geometry. A3 therefore establishes the smallest strict Rust-owned wire contract needed before any dataset-level representation is allowed to replace that row-first path.

A3 is a contract checkpoint, not an analytical implementation checkpoint.

## Pre-implementation adversarial contract

### Authority being changed

Only semantic embodiment payload validation and normalisation authority changes in A3.

Rust/WASM owns:

- schema-version acceptance;
- candidate/payload compatibility;
- bounded payload structure;
- information-contract validation;
- provenance-shape validation;
- explicit READY versus REFUSED state;
- deterministic normalisation.

TypeScript mirrors the wire type and invokes the ABI. It does not implement a second validator or repair malformed payloads.

### Primary failure modes

1. a generic mega-payload accumulates dozens of optional representation fields;
2. raw rows or source-record fragments leak back into a dataset-level payload;
3. defining future candidate payloads falsely implies that the corresponding mathematics exists;
4. TypeScript validation becomes an independent semantic authority;
5. unknown schema versions are accepted by convenience;
6. candidate identity, representation family and payload kind disagree;
7. semantic identity becomes coupled to presentation layout;
8. resource bounds are advisory rather than enforced;
9. REFUSED is silently converted into an empty or plausible-looking READY representation;
10. provenance is lost between Moneta decision and embodiment result.

### Real boundary under test

```text
TypeScript RuntimeBridge
  -> existing two-call JSON ABI
  -> real WASM export
  -> Rust serde parse
  -> Rust validation/normalisation
  -> versioned semantic envelope
  -> TypeScript mirror
```

The A3 real-WASM regression exercises that boundary. Rust unit tests additionally falsify hard bounds and strict serde rejection.

### Explicitly out of scope

A3 does **not**:

- compute grouped aggregates;
- make `AGGREGATE_VOLUME` production-reachable;
- alter Moneta candidate ranking;
- fix the learned-runtime candidate-to-geometry drift found in A2;
- migrate the production Worker protocol;
- replace `VRTopologyTranslator` or any renderer path;
- add density, distribution, cluster, manifold, graph, temporal or multiscale builders;
- claim a scale improvement or Quest/device qualification.

Those boundaries prevent the contract PR from becoming the A4 implementation or an unreviewable ABI migration.

## V1 contract decisions

### Semantic identity is independent of layout

The payload carries a semantic `candidateId` and a semantic `representationFamily`. It does not carry a presentation `layout`.

A later renderer may choose an appropriate embodiment for the semantic object, but layout may not redefine the object's analytical meaning.

### READY is intentionally narrow

A3 defines one concrete READY payload kind:

```text
AGGREGATE_VOLUME
```

This is the first A4 target and gives the contract a real falsifiable shape without pretending the other candidate builders already exist.

Other semantic candidates may be represented at this boundary only as explicit `REFUSED` results until a reviewed Rust builder exists for them.

### Aggregate payload is bounded

`AGGREGATE_VOLUME` V1 has a hard maximum of **4,096 groups**.

The resource envelope carries:

- source row count;
- actual semantic element count;
- hard maximum element count.

Rust rejects mismatch or overflow. A4 must refuse before constructing an unbounded payload rather than transferring raw observations and calling the result an aggregate.

### Raw observations are forbidden

The V1 envelope contains no `rows`, source dataset, layout entries, node meshes or arbitrary source-record payload.

Rust serde uses `deny_unknown_fields`, and the real-WASM regression proves that an attempted top-level `rows` field is rejected.

### Information contract is explicit

For the first aggregate payload, Rust enforces the reviewed ontology exactly:

Preserves:

- `aggregate-group-magnitude`

Loses:

- `individual-observation-identity`;
- `exact-metric-values`;
- `outlier-boundary-visibility`.

This is deliberately stronger than a descriptive comment. A payload that claims a different aggregate information contract is invalid.

### Refusal is first-class

`REFUSED` carries a machine-readable code and bounded message and must contain zero semantic elements. It does not carry an empty fake payload.

Initial refusal codes are:

- `UNSUPPORTED_CANDIDATE`;
- `RESOURCE_LIMIT`;
- `MISSING_EVIDENCE`;
- `INVALID_PARAMETERS`.

## Acceptance evidence

A3 is acceptable only if exact-head CI proves all of the following:

1. Rust unit tests compile and pass for the new contract module;
2. a valid aggregate envelope round-trips through the **real WASM runtime**;
3. normalisation is deterministic and idempotent;
4. unknown schema versions fail closed;
5. candidate/payload mismatch fails closed;
6. attempts to smuggle raw `rows` fail closed;
7. the aggregate resource bound is enforced;
8. an unsupported semantic candidate can return an explicit refusal without a fabricated payload;
9. TypeScript remains a wire mirror, not analytical/validation authority.

## A4 handoff

A4 must construct these Rust types from the canonical Rust dataset handle rather than accepting a precomputed TypeScript aggregate.

The required first vertical slice is:

```text
canonical Rust dataset handle
  -> reviewed grouping/measure parameters
  -> Rust grouped aggregate builder
  -> resource preflight / explicit refusal
  -> SemanticEmbodimentEnvelopeV1 READY payload
  -> existing Worker/WASM transport seam
  -> thin TypeScript/Three.js aggregate adapter
```

A4 must then make `AGGREGATE_VOLUME` truthfully production-reachable and prove that the aggregate renderer no longer requires source rows.

If A4 discovers that the contract is insufficient, extend it deliberately and version it where compatibility changes. Do not turn V1 into an open-ended bag of optional fields.

## Remaining A2 findings after A3

A3 does not close these findings:

- learned Moneta candidate-aware geometry drift;
- density/distribution semantic overclaim;
- cluster regions derived in TypeScript from row positions;
- manifold/multiscale candidate-to-renderer semantic collapse;
- global raw-row funnel in `VRTopologyTranslator`.

They remain governed by A4 and later P1-R/R6 work.

## Post-implementation adversarial review checklist

Before this checkpoint is promoted, re-read the exact branch and answer:

1. Is Rust the only runtime validator/normaliser of this contract?
2. Can any READY payload contain source rows or arbitrary source records?
3. Can an unknown schema or candidate/payload mismatch survive the ABI?
4. Is the aggregate element bound hard rather than documentary?
5. Can unsupported semantics remain explicitly refused?
6. Did A3 accidentally make aggregate calculations or renderer behavior authoritative?
7. Did any change cross Stream B/C or hot-file ownership?
8. Is every completion claim narrower than the evidence?

# ADR-0007: Rust-issued trustworthy evidence receipts and live resolution authority

**Status:** Accepted  
**Date:** 2026-09-20  
**Supersedes:** none  
**Superseded by:** none

## Context

RFC 0007 and the TEC0 propagation audit established that Rust/WASM already owns richer scientific evidence than the production TypeScript path preserves. `EvidenceClaim<T>` can carry assumptions, sample support, uncertainty, stability, sensitivity, limitations, analytical geometry and method provenance, while existing `DatasetEvidence` and `DatasetEvidenceSignature` are intentionally compact projections.

Copying the complete claim model into TypeScript would create a second scientific record. Keeping only opaque string `evidenceRefs` would preserve syntax without preserving the governing evidence. Runtime-local dataset handles also cannot serve as durable evidence identity.

The first production implementation proves this boundary with the existing statistics evidence family. Those claims are useful precisely because several epistemic axes are unresolved or absent: Pearson claims retain a not-testable-from-data independence assumption, while descriptive claims do not manufacture uncertainty or stability.

## Decision

### Rust-issued receipt bundles

Rust/WASM owns `EvidenceReceiptBundleV1` and `EvidenceReceiptV1`. A receipt is a metadata projection of one Rust-owned `EvidenceClaim<T>`, scoped by dataset fingerprint and kernel version. It preserves the claim identifier, estimand, measurement/admission context state, analytical geometry when established, assumptions, sample support, uncertainty, stability, sensitivity, limitations and method provenance.

Absence remains explicit. `measurementContext: NOT_ESTABLISHED`, `uncertainty: null` and `stability: null` mean those properties have not been established. They are not favourable values.

The V1 statistics receipt ID is Rust-issued from the originating claim ID. TypeScript may validate and resolve that identity but may not invent an alternative binding.

### Transport and live authority

Receipt bundles cross the Rust/WASM boundary through the prepared-result ABI. One receipt request performs one authoritative Rust computation, retains the serialized result only for the transfer lifetime, and releases it after the host read.

TypeScript performs closed structural validation and deep-freezes the accepted bundle. Validation is not scientific recomputation and does not upgrade missing evidence.

A live receipt resolver is minted only from the current Rust dataset handle through `MonetaEvidenceAuthority`. It binds the dataset fingerprint and kernel version observed at minting and re-checks live dataset/kernel identity during resolution. Destroying or replacing the originating dataset handle therefore revokes the resolver rather than leaving a stale receipt capability usable.

A parsed serialized receipt bundle is evidence data, not a live resolver capability.

### Scientific admission remains separate

Receipt presence is not equivalent to scientific admissibility, stability, significance or representation fitness. This decision introduces no universal evidence-strength score and no TypeScript-side scientific threshold.

RFC 0007's downstream authority-owned requirement profiles and typed policy refusals are implemented at the live resolver (2026-09-26): requirement profiles are a closed registry minted only inside the evidence contract layer, and `resolveAgainst` returns the immutable receipt or a typed governed refusal (`RECEIPT_NOT_FOUND`, `MISSING_REQUIRED_AXIS`, `VIOLATED_ASSUMPTION`, `UNRESOLVED_ASSUMPTION`), with `DATASET_MISMATCH`/`KERNEL_MISMATCH` reserved for the governed replay resolver. The governed replay resolver, DatasetEvidence identity migration, and MCR2+ evidence-reference enforcement remain required before TEC1 can reach its finite exit. This ADR fixes the durable authority boundary; `docs/ROADMAP.md` remains the implementation-status authority.

## Consequences

1. Rich Rust claim metadata can cross the production boundary without making TypeScript an analytical authority.
2. Missing uncertainty, stability or measurement context remains inspectably missing.
3. Duplicate receipt IDs, malformed closed-schema payloads and dataset/kernel provenance drift fail validation.
4. Receipt objects exposed by TypeScript are immutable from the caller's perspective.
5. A live resolver becomes stale when its Rust dataset capability is destroyed or no longer identifies the same dataset.
6. Columnar-only or invalid handles do not trigger compatibility row materialisation merely to produce statistics receipts.
7. Existing `DatasetEvidence` consumers remain source-compatible while receipt migration proceeds family by family.
8. The statistics family is a transport proof, not a claim that its unresolved assumptions have become admissible.
9. Persisted/replay use must not deserialize a receipt and thereby recreate live authority. A governed replay loader remains future TEC1 work.

## Evidence

The implementation includes Rust unit tests for receipt construction, duplicate/mismatched identity rejection, preservation of absent axes, and the camelCase V1 wire shape for established measurement/admission context.

Production-path WASM tests exercise one-computation prepared-result transfer, dataset/kernel identity, prepared-result cleanup, immutable TypeScript resolution, unresolved-assumption preservation, invalid/columnar-only refusal and stale-handle revocation. Separate TypeScript tests reject malformed, duplicate and provenance-mismatched bundles and validate the closed established-measurement-context shape.

Implementation status and remaining TEC1 closure work are governed by `docs/ROADMAP.md`.

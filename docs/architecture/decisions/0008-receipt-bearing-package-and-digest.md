# ADR-0008: Explicit receipt-bearing package and investigation digest

**Status:** Accepted
**Date:** 2026-09-28
**Supersedes:** none
**Superseded by:** none

## Context

[RFC 0009](../../rfcs/0009-persisted-governed-evidence-replay.md) requires an explicit
format for persisted Rust receipt bundles and historical consumer/profile identities.
An optional V2 companion would permit older readers to ignore evidence that newer readers
consider mandatory. Recomputing historical claims would break RFC 0007 identity and RFC
0008 verbatim-history contracts.

## Decision

The opt-in V3 container requires `investigation/evidence-receipts.json`, its exact SHA-256
byte digest, explicit analytical dataset/kernel identities, and the V3 investigation digest
algorithm. The closed envelope snapshots one bundle and ordered consumer/receipt/profile
uses. Existing archive decompression, entry-count and size budgets cover this member.

The V3 semantic root extends V2 with the entire parsed envelope and its byte digest. It does
not apply V2 capture-metadata normalization to receipt semantics. Shared canonical JSON and
SHA-256 utilities remain the hashing authority. Transport validation compares bundle
provenance with the declared analytical identities; it does not establish reconstructed
identity, authenticated Rust origin, consumer existence, policy agreement or admissibility.

V1/V2 retain their read contracts, including ignoring unknown metadata and archive members.
They never expose receipt data through the new payload field or acquire governed authority.
Malformed V3 is never retried as V2. Default session export remains V2.

## Consequences and bounded implementation

This decision records package packing/unpacking and digest infrastructure only. The production
replay runner explicitly refuses V3 before parsing datasets or invoking the kernel until the
sequential governed-loader tranche implements all RFC 0009 checks. No parsed envelope mints
an authority capability. Unknown historical profiles and nonexistent references can remain
inspectable data here; they must be resolved or refused by that future loader.

Authoritative capture/export, reconstructed identity verification, consumer-policy binding,
missing-use enforcement, and complete investigation replay remain dependencies. This format
does not close TEC1, PT9 or MCR2+. [ROADMAP.md](../../ROADMAP.md) owns live status.

## Evidence

`tests/tec1-v3-package.test.ts` exercises actual ZIP boundaries, malformed/duplicate records,
identity/version/hash and budget failures, semantic mutations, immutable snapshots, legacy
unknown-member compatibility and refusal through both production replay entry points.
`tests/tec1-v3-package-wasm.test.ts` preserves actual Rust-issued receipt values through
pack/unpack and the digest helper. These prove transport and commitment, not replay success.

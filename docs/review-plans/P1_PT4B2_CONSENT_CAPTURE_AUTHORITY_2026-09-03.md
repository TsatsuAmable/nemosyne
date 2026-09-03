# P1-PT4B2 Consent and Capture Authority Pre-Implementation Review

**Date:** 3 September 2026  
**Base:** `main@5207ee703781efa429edbac94f3ce9b0a9522477`  
**Programme:** P1-PT4B  
**Risk:** high. This tranche creates the durable server authority whose decisions later permit client capture and ingestion.

## Invariant

Product-analytics capture is impossible without a current durable grant for the exact reviewed notice. Grant, revoke and capture issuance serialize on one principal/purpose state; expected revisions are compare-and-swap guards; action IDs are idempotent only for the exact canonical request; revocation creates a new revision rather than rewriting historical evidence; and a capture authorization is bound to one principal, family, event, producer, stream and sequence.

Raw OIDC subjects and issuer/subject-derived deletion handles must never be returned by product-data APIs. The public pseudonym is purpose-specific HMAC-SHA-256 with the RFC 0004 length-framed preimage and an explicit key version.

## Authority path

This tranche owns the service-domain consent/capture state machine and its durable SQLite repository. It consumes the accepted PT4B1 family/notice references. HTTP routing, JWT/OIDC verification, envelope construction, ingestion and authorization consumption are deliberately later tranches. No client producer is wired in PT4B2.

## Failure modes / falsifiers

1. Absent consent authorizes capture.
2. Stale expected revision overwrites a newer consent decision.
3. Reused action ID with changed request content returns an earlier success.
4. Revocation mutates or deletes the earlier receipt instead of creating a revision.
5. Capture authorization survives or can be issued after revocation.
6. Authorization is not exactly bound to event/producer/stream/sequence/family.
7. Raw issuer/subject or deletion handle leaks in returned objects or serialized idempotency results.
8. Purpose pseudonym framing is ambiguous or key material is shorter than 256 bits.
9. State disappears across service/database reopen.
10. SQLite writer transactions permit a partially committed consent/idempotency result.

## Non-goals

No HTTP listener, CORS/origin handling, JWT/JWKS validation, request rate limiting, NDJSON reader, governed envelope admission, event storage/replay, export, erasure traversal, retention runner, client queue or production deployment claim is made here.

## Promotion evidence

Focused Node tests must reopen the same SQLite file and prove durability, CAS, idempotency conflict, revision history, purpose pseudonym golden bytes, capture binding and revocation invalidation. Existing PT3B/PT4B1 governance tests, typecheck, lint, architecture, production build, coverage, CodeQL and promotion gates remain authoritative.

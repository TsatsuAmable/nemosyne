# P1-PT4B2 Consent and Capture Authority Post-Implementation Review

**Date:** 3 September 2026  
**Scope:** durable product-analytics consent revisions, purpose pseudonyms, idempotent grant/revoke actions and one-use capture-authorization issuance state. HTTP/JWT/ingestion remain outside this tranche.

## Findings and fix-forward

- **BLOCKER fixed:** the first implementation could have returned an old capture authorization if consent was revoked, later re-granted and the old event ID was reused. Capture retries now refuse any authorization whose durable row was invalidated or belongs to a superseded consent revision. The test explicitly performs grant -> authorize -> revoke -> re-grant -> old-event retry and requires failure.
- **BLOCKER fixed:** persisted idempotency/capture responses were parsed back into mutable objects. Returned durable evidence is recursively frozen, matching the governance boundary's immutable-value discipline.
- **PASS:** grant/revoke serialize under `BEGIN IMMEDIATE`, use compare-and-swap revisions, and persist idempotency results in the same transaction as the consent revision.
- **PASS:** revocation creates a new durable DENIED revision and invalidates outstanding unconsumed authorizations rather than rewriting the earlier receipt.
- **PASS:** purpose pseudonyms implement the RFC domain plus unsigned 32-bit big-endian UTF-8 length framing and require at least 256-bit versioned keys. A hard-coded golden vector protects the byte-level contract.
- **PASS:** the durable database stores protected HMAC handles/pseudonyms rather than raw issuer/subject strings or key material; focused evidence checks the closed database bytes after checkpoint.
- **PASS:** database-directory and main-database permissions are forced and verified as 0700/0600; SQLite uses WAL, foreign keys, `synchronous=FULL`, `secure_delete=ON` and a bounded automatic checkpoint.

## Residual boundary

PT4B2 does **not** authenticate HTTP callers or inspect JWT scopes, expose public endpoints, consume capture authorizations during ingestion, write governed events, implement replay/sequence state, export, erasure traversal or retention. Its authenticated-principal argument is an internal post-authentication service boundary. The next tranche must not present it directly to an untrusted network caller.

## Disposition

**ADOPT only when the exact PR head passes focused PT4B2 tests plus the ordinary repository promotion gates. PT4B remains ACTIVE.**

# P1 PT4B9B PostgreSQL Production Cutover — Post-Implementation Review

Date: 2026-09-03
Status: IMPLEMENTATION LANDED / REVIEW COMPLETE; promotion remains exact-head gated

## Production boundary attacked

Re-reviewed the PT4 persistence path from authenticated request through runtime policy, consent/capture authority, governed event replay/storage, retention/export/erasure, and credential-session revocation.

The production composition now has one durable database authority: PostgreSQL. SQLite remains reachable only through explicitly compatibility/test-named constructors and stores.

## Findings and fixes

1. **BLOCKER fixed — runtime policy inherited the old database.** `RuntimePinnedProductAnalyticsEventIngestion` originally subclassed the SQLite ingestion implementation. It is now a database-neutral decorator over `ProductAnalyticsEventIngestionPortV1`; runtime manifest validation happens before delegation regardless of persistence adapter.
2. **BLOCKER fixed — hidden second server database remained possible.** The first PostgreSQL composition accepted an arbitrary authenticator, so a caller could pair PostgreSQL governed events with SQLite credential-session revocation. The canonical `createPostgresProductAnalyticsGovernanceCompositionV1()` now constructs OIDC token authority with `PostgresDataPlaneCredentialSessionStoreV1` on the same pool. An arbitrary-authenticator constructor remains explicitly lower-level/test-only.
3. **BLOCKER fixed — access-token verification owned SQLite directly.** Credential-session persistence is now a port with PostgreSQL production and SQLite compatibility implementations. Authentication, revocation and close are awaited so durable revocation cannot be a fire-and-forget side effect.
4. **DEFENCE IN DEPTH fixed — custom JWK resolver could supply private CRT material.** Local verification now rejects `d`, `p`, `q`, `dp`, `dq`, `qi`, and `oth`, matching the network JWKS authority rather than only rejecting `d`. A required falsifier bypasses the network filter with a custom resolver.
5. **TEST DEFECT fixed — signature corruption could become non-canonical base64url.** The original test changed the last encoded character and sometimes correctly reached `INVALID_TOKEN` before signature verification. It now flips decoded signature bytes and re-encodes canonically, proving `INVALID_SIGNATURE` at the intended boundary.
6. **CONCURRENCY strengthened — PostgreSQL mutations require explicit serialization.** Principal mutations and stream mutation paths use transaction-scoped advisory locks inside `SERIALIZABLE` transactions. Event insert, stream sequence advancement and one-use capture consumption share one transaction.
7. **DATABASE OWNERSHIP preserved — DDL remains outside behavioral adapters.** PostgreSQL behavioral persistence assumes the PT4B9A schema authority has migrated and verified the exact managed-table inventory; no behavioral adapter creates tables.

## Evidence

The implementation head after the findings above passed TypeScript typecheck, lint, architecture enforcement, Rust, production build and all three Vitest coverage shards, including `tests/pt4b9b-postgres-cutover.test.ts`. The first runtime cycle found only the canonical-signature test defect described above; the corrected cycle passed all three shards.

The new PostgreSQL protocol fake proves transaction ordering, migration-before-composition, consent CAS/idempotency, durable credential-session revocation, and same-pool production composition without relabelling a fake as a live PostgreSQL deployment.

## Residual bounded work

- A managed/live PostgreSQL deployment, driver/pool wiring, failover, backup/restore and crash/fault-injection against a real server remain deployment-qualification evidence, not claims of this PR.
- Deletion-handle framing remains duplicated between the PostgreSQL adapter and legacy SQLite compatibility implementations. Because SQLite is explicitly being retired rather than maintained as a production peer, a partial helper extraction was rejected during review. Remove the duplicate when the compatibility adapter is deleted or perform one atomic cross-adapter extraction with golden-vector parity tests.
- Physical erasure of PostgreSQL backups, replicas, provider snapshots or storage media is not claimed. Registered service-level erasure remains logical/policy-governed as defined by RFC 0004.
- Client persistence convergence to one IndexedDB database is the immediate next RFC 0005 tranche and is intentionally outside this server cutover.

## Disposition

**ADOPT** for the bounded PT4B9B server persistence cutover once the literal final head passes CI, CodeQL, architecture policy, Q8, Q9, UV0, generated Wiki and approval.

Do not call PostgreSQL deployment/HA qualification complete from this PR alone. Do not start a second server persistence authority. Proceed next to the client persistence convergence tranche after merge.

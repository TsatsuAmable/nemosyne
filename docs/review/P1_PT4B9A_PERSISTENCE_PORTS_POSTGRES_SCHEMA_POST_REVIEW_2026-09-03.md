# P1 PT4B9A Persistence Ports + PostgreSQL Schema Post-Implementation Review — 2026-09-03

Status: REVIEW COMPLETE / EXACT-HEAD PROMOTION REQUIRED

## Production boundary attacked

This review re-attacked the first persistence-rationalisation tranche from the HTTP boundary down to database migration ownership:

`GovernanceHttpService` → async-capable governance authority ports → current SQLite compatibility authorities / future PostgreSQL behavioral adapters, plus `PostgresGovernanceMigrationAuthorityV1` as the sole PostgreSQL PT4 DDL/version authority.

PT4B9A does not claim PostgreSQL behavioral parity or production cutover. It creates the seam and fail-closed schema authority required before those claims are possible.

## Findings and fixes

1. **BLOCKER fixed — false schema-version completeness.** The first migration draft trusted `schema_version = 1` without proving all reviewed tables were present. Current-version startup now verifies the exact managed-table inventory.
2. **BLOCKER fixed — partial unversioned schema adoption.** The first migration draft could use `CREATE IF NOT EXISTS` to silently adopt a partially created or foreign governance schema. A non-empty unversioned governance schema is now refused. V1 DDL uses ordinary `CREATE TABLE` inside the transactional migration so unexpected pre-existing objects fail rather than being normalized silently.
3. **BLOCKER fixed — active documentation authority missing generated-wiki mapping.** Registering RFC 0005 made Wiki validation fail closed. The generator now has an explicit `accepted-persistence-architecture` page mapping.
4. **TEST DEFECT fixed — unsupported Vitest matcher assumption.** Configuration-error tests now use the repository-supported object assertions rather than a matcher not present in the suite.
5. **TYPE CONTRACT fixed — over-constrained PostgreSQL row generic.** The driver-neutral query boundary no longer requires row interfaces to carry a string index signature.

## Invariants rechecked

- `GovernanceHttpService` no longer names or imports SQLite/PostgreSQL authority implementations. Every persistence operation is awaited, allowing both current synchronous SQLite compatibility classes and future asynchronous PostgreSQL adapters to obey one contract.
- The PostgreSQL migration authority owns consent revisions, consent idempotency, capture authorizations, event streams, governed events, erasure actions, credential-session revocation and schema metadata.
- Migration takes a transaction-scoped advisory lock before schema/version inspection.
- Version advancement follows V1 DDL in the same PostgreSQL transaction.
- newer versions, absent/incomplete current versions and unversioned partial schemas fail closed.
- remote PostgreSQL requires an explicit secure `sslmode`; insecure transport is allowed only for an explicitly enabled localhost development profile.
- no PostgreSQL-to-SQLite production fallback exists in this tranche.
- existing PT4 SQLite implementations remain the only behavioral implementation until PT4B9B, so this tranche does not overclaim production PostgreSQL readiness.

## Remaining work

PT4B9B must still implement and exercise real PostgreSQL behavior:

- consent/capture state and idempotency;
- credential-session revocation;
- event/replay transaction atomicity;
- retention, export and service-scoped erasure;
- concurrency and commit-before-ack crash/retry evidence;
- canonical runnable PostgreSQL production composition with no SQLite fallback;
- real PostgreSQL integration evidence rather than only driver-neutral migration fakes.

PT4C1 then converges durable browser application state into one versioned `nemosyne-client` IndexedDB database. `sessionStorage` remains permitted only for the ephemeral PKCE redirect transaction and bearer credentials remain memory-only.

## Disposition

**ADOPT PT4B9A only after the literal final head passes CI / Node 24, CodeQL, architecture policy, Q8, Q9, UV0, generated-Wiki validation and approval.**

PT4 remains ACTIVE. PostgreSQL is the accepted target architecture, not yet the production data-plane implementation.

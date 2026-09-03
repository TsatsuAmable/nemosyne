# P1 PT4B9A Persistence Ports + PostgreSQL Schema Review Plan — 2026-09-03

Status: IMPLEMENTATION ACTIVE / HIGH-RISK REVIEW

## Authority

Accepted RFC 0005 changes the persistence architecture while preserving RFC 0003/0004 governance semantics:

- PostgreSQL becomes canonical production server persistence.
- one versioned IndexedDB database becomes canonical durable client persistence.
- Rust/WASM analytical authority and `.nemosyne` portability remain unchanged.

This tranche is PT4B9A only: persistence ports plus PostgreSQL configuration/schema/migration authority. It does not yet claim PostgreSQL behavioral parity or production cutover.

## Invariants attacked

1. HTTP/domain orchestration cannot depend on SQLite or PostgreSQL concrete classes.
2. A synchronous compatibility adapter and an asynchronous PostgreSQL adapter must satisfy the same awaited persistence contract.
3. One migration authority owns every PT4 durable table and index.
4. Schema migration is serialized and transactional; failure cannot advertise the new schema version.
5. A newer/unknown schema is refused rather than downgraded or silently modified.
6. Production PostgreSQL cannot silently disable TLS or fall back to SQLite.
7. The schema must preserve PT4 relational uniqueness and sequence constraints rather than merely create document buckets.

## Failure modes

- service forgets to await an async database method;
- one authority continues to require a concrete SQLite type;
- independent components recreate/evolve tables outside the migration authority;
- migration races produce partial schemas;
- version row is updated before DDL succeeds;
- unsupported newer database is opened and modified;
- remote database URL without TLS is accepted;
- local-development exception accidentally applies to non-local hosts;
- PostgreSQL schema loses event-id, stream-sequence or consent-revision constraints;
- credential-session revocation table is omitted from the consolidated schema.

## Falsifiers

Required fast test `tests/pt4b9-postgres-migration-authority.test.ts` must prove:

- non-PostgreSQL URLs fail;
- remote non-TLS or explicit `sslmode=disable` fails;
- insecure local development requires an explicit option;
- one migration includes consent, capture, streams, events, erasure and credential sessions;
- migration takes the advisory lock inside a transaction;
- a second startup at the current version does not rerun V1 DDL;
- injected DDL failure rolls back and releases the connection;
- absent/newer version is refused by readiness/current-schema checks.

Existing PT4 HTTP/consent/ingestion/lifecycle suites must remain green against SQLite through the new awaitable ports. That is the compatibility proof for this tranche.

## Non-goals

- no PostgreSQL driver dependency yet;
- no PostgreSQL consent/event/lifecycle behavioral adapter yet;
- no production database cutover claim;
- no SQLite deletion yet;
- no client IndexedDB consolidation yet;
- no broadening of retained data or lifecycle policy.

## Exit

PT4B9A may be adopted only when the exact head passes typecheck/lint, architecture, full required tests/coverage, production build, CodeQL, Q8/Q9, UV0 and approval, and post-review finds no persistence-boundary blocker. PT4 remains open afterward for PT4B9B production PostgreSQL adapters/cutover and PT4C1 client persistence convergence.

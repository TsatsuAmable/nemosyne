# P1 PT4B9B PostgreSQL Production Cutover — Pre-Implementation Review

Date: 2026-09-03
Status: IMPLEMENTATION ACTIVE / HIGH-RISK REVIEW REQUIRED

## Claim boundary

PT4B9B may claim only that the governed Product Mode server persistence boundary has been cut from implicit SQLite composition to PostgreSQL-backed, async-capable authorities supplied through the database-neutral ports accepted in RFC 0005 / PT4B9A.

It does **not** claim a managed cloud deployment, failover drill, backup restore proof, physical storage-media erasure, or client IndexedDB convergence.

## Invariants

1. Production composition has no implicit SQLite fallback.
2. Runtime provenance checks decorate the ingestion port and never inherit from a database implementation.
3. Consent CAS/idempotency, capture authorization, replay/sequence, event write, retention, export and erasure retain the PT4 semantics already falsified on the compatibility implementation.
4. PostgreSQL principal and stream mutations serialize before state decisions; event/capture/stream state mutates in one transaction.
5. Credential-session revocation uses the same PostgreSQL schema in production rather than a hidden SQLite side database.
6. Cryptographic token verification remains one implementation; changing persistence must not fork JWT/JWK semantics.
7. PostgreSQL schema creation/versioning remains owned only by `PostgresGovernanceMigrationAuthorityV1`.
8. SQLite remains explicitly named compatibility/test infrastructure only.

## Failure modes to attack

- async call omitted or returned without awaiting;
- runtime check bypassed by changing database implementation;
- two simultaneous principal or stream writers create split-brain revisions/sequences;
- capture consumed without event, event stored without capture consumption, or duplicate event mutates replay state;
- revocation race admits a queued event;
- erasure crosses principal/purpose or destroys policy-retained consent evidence too early;
- credential-session revocation disappears on a later token touch;
- production composition can be instantiated through `dataDirectory`/SQLite by accident;
- private JWK CRT material reaches the verification key importer;
- PostgreSQL driver/pool lifecycle is closed by a child authority rather than the aggregate persistence owner.

## Required evidence

- all existing PT4 fast tests remain green through the async ports;
- `tests/pt4b9-postgres-migration-authority.test.ts` remains green;
- `tests/pt4b9b-postgres-cutover.test.ts` proves serialized PostgreSQL consent semantics, credential revocation, migration-before-composition and explicit production composition;
- typecheck/lint/architecture/CodeQL/Q8/Q9/UV0/approval exact-head gates;
- post-review explicitly records any gap between protocol-fake evidence and a live PostgreSQL cluster. That gap must not be relabelled as deployment proof.

# RFC 0005 — Persistence architecture rationalisation

**Status:** accepted  
**Date:** 2026-09-03  
**Owners:** architecture, security, product engineering  
**Programme:** P1-PT / PT4B9+

## Context

Nemosyne currently has two different persistence problems.

On the server side, PT4 proved the governed Product Mode contract using Node's SQLite implementation. Consent revisions, credential-session revocation, capture authorization, governed-event replay/storage and lifecycle/export/erasure are all durable, but the concrete database has leaked into domain/service class names and several authorities independently open and evolve the same `governance.sqlite` file. That was useful to prove transaction semantics quickly, but it is not the intended resilient production architecture.

On the client side, durable product state is fragmented across multiple browser persistence mechanisms. Session continuity and gesture persistence use IndexedDB while settings and telemetry preferences still use separate `localStorage` records. This creates multiple migration, recovery and startup-authority paths for one application.

Rust/WASM analytical state is not an application database and remains the analytical/scale-sensitive computational authority. `.nemosyne` remains the portable investigation artifact rather than a live server database.

## Decision

### Server

PostgreSQL is the canonical durable server database for production Product Mode governance and product-service state.

The application/domain layer must not depend directly on PostgreSQL APIs. Persistence is reached through explicit async-capable ports. PostgreSQL supplies the production adapters and owns one versioned migration authority. SQLite remains only as a bounded compatibility/reference adapter while parity and migration evidence are established; it must not remain the canonical production composition after cutover.

The canonical server database owns, at minimum:

- purpose-scoped consent revisions and immutable consent receipts;
- credential-session revocation;
- one-use capture authorizations;
- governed event streams, sequence/replay state and accepted envelopes;
- retention, export and registered-service erasure state;
- schema/migration metadata required to reject unsupported or partially applied versions.

PostgreSQL transactions must preserve the PT4 atomicity invariants already proven with SQLite. In particular, current consent resolution, exact capture authorization validation/consumption, replay/sequence decision and event insertion must commit atomically.

### Client

One versioned IndexedDB database, `nemosyne-client`, is the canonical durable browser database.

Separate object stores may retain bounded ownership and schemas, but persistent application state must converge behind one database/migration authority. Planned stores include session/investigation continuity, settings/preferences, gesture profiles, local product metadata and local-only telemetry preferences/summaries where still authorized.

`localStorage` is not an application-state authority. Existing records may be read only by explicit one-way migration shims and deleted after successful migration. Bearer credentials remain memory-only. The short-lived PKCE redirect transaction remains `sessionStorage` because it is ephemeral redirect state rather than durable application data.

### Boundaries that do not change

- Rust/WASM remains the sole analytical and scale-sensitive computational authority.
- IndexedDB must not become an analytical source of truth.
- PostgreSQL must not become a hidden analytical implementation or dataset cache by default.
- Client and server databases are not mirrored wholesale. Synchronisation is semantic and API-driven.
- `.nemosyne` remains the portable/replayable investigation package boundary.
- Existing governed event, consent, authorization, retention, export and erasure semantics from RFCs 0003 and 0004 remain authoritative unless explicitly revised.

## Options considered

### Keep SQLite as the production server database

Rejected as the strategic production default. SQLite is a strong single-process transactional store and remains valuable for compatibility tests, but Nemosyne's intended server path needs resilient managed deployment, concurrent service writers, operational backup/recovery and replication without promoting a single-node file into a permanent service constraint.

### Document database as the primary server store

Rejected. Governed envelopes contain document-shaped payloads, but PT4's hard problems are relational consistency, sequence uniqueness, authorization/consent revision binding and lifecycle transactions. PostgreSQL can retain canonical envelope documents using `jsonb` while expressing critical invariants in typed columns and constraints.

### Redis as primary persistence

Rejected. Redis may later be useful for ephemeral coordination, caching or distributed rate limits, but it is not the durable authority for consent/event/lifecycle state.

### Multiple specialised browser databases

Rejected for the product client. Separate object stores inside one versioned IndexedDB database preserve modularity without multiplying upgrade and recovery authorities.

## Target architecture

```text
Browser / XR device                         Product services
┌────────────────────────┐                 ┌─────────────────────────┐
│ nemosyne-client IDB    │                 │ PostgreSQL              │
│                        │                 │                         │
│ session/investigation  │   governed APIs │ consent/revocation      │
│ settings/preferences   │◄───────────────►│ capture authorization   │
│ gesture profiles       │                 │ governed events/streams │
│ local product metadata │                 │ retention/export/erase  │
│ migration metadata     │                 │ schema migrations       │
└───────────┬────────────┘                 └────────────┬────────────┘
            │                                           │
            ▼                                           │
┌────────────────────────┐                              │
│ Rust / WASM            │                              │
│ analytical authority   │                              │
│ resident dataset state │                              │
└────────────────────────┘                              │
                                                        │
                   .nemosyne portable artifacts ◄───────┘
```

## Implementation sequence

### PT4B9A — persistence ports and PostgreSQL migration authority

1. Remove concrete SQLite types from HTTP/application composition contracts.
2. Introduce async-capable consent, event-ingestion, lifecycle and credential-revocation ports.
3. Add a PostgreSQL pool/transaction boundary with TLS-required production configuration.
4. Add one PostgreSQL migration authority owning every PT4 table/index and schema version.
5. Preserve SQLite as a test/reference adapter only.
6. Add fresh-schema, repeated-startup, unsupported-version and failed-migration falsifiers.

### PT4B9B — PostgreSQL governed-data adapters and production cutover

1. Implement consent/capture, credential revocation, event/replay and lifecycle adapters against the shared transaction boundary.
2. Run the existing PT4 hostile contract suite against PostgreSQL semantics.
3. Add concurrency and crash/acknowledgement fault injection.
4. Make the canonical runnable Product Mode service composition PostgreSQL-backed.
5. Remove SQLite from production configuration and production claims.

### PT4B9C — SQLite retirement decision

After parity evidence, either retain SQLite as an explicitly test-only adapter or remove it. No product deployment may silently fall back from PostgreSQL to SQLite.

### PT4C1 — client persistence convergence

1. Introduce one `nemosyne-client` IndexedDB migration authority.
2. Move session and settings persistence behind it first.
3. Move gesture profiles and remaining durable product-client state behind separate object stores in the same database.
4. Migrate existing `localStorage` settings/telemetry records exactly once and remove them only after successful durable commit.
5. Prove upgrade, rollback/failure recovery, cross-version startup and storage-unavailable behaviour.

## Security and privacy consequences

- Production PostgreSQL connections require TLS except for explicitly marked local development/test profiles.
- Database credentials are server secrets and never enter the browser bundle.
- PostgreSQL roles should be least-privilege and separated from schema-migration credentials in production deployment.
- Existing pseudonym/deletion-handle derivation remains server-side.
- No database choice broadens the scope of retained data or weakens RFC 0004 retention/erasure boundaries.
- Client consolidation must not migrate bearer tokens or PKCE verifier/state into durable IndexedDB.

## Operational consequences

Managed PostgreSQL is preferred for preview/production so backup, point-in-time recovery, failover and health monitoring are supplied by infrastructure rather than reimplemented in Nemosyne. The code must remain vendor-neutral PostgreSQL and must not depend on provider-specific database semantics in the domain layer.

Readiness must include database connectivity, supported schema version and completed migrations. A listening HTTP socket is not sufficient readiness.

## Verification plan

Promotion requires falsifying evidence for:

- exact preservation of PT4 consent/capture/event/replay/lifecycle semantics;
- concurrent writers and conflict behaviour;
- transaction rollback on injected failures;
- retry after commit-before-ack resulting in exact duplicate rather than duplicate semantic write;
- schema upgrade and unsupported-version refusal;
- no silent production SQLite fallback;
- PostgreSQL TLS/configuration fail-closed behaviour;
- client one-database migration with no bearer credential persistence;
- one-way `localStorage` migration and deletion only after committed IndexedDB write.

PT4 must not be declared complete merely because PostgreSQL tables exist. The production composition, restart/crash evidence, export/erasure path and exact-head promotion evidence remain required.

## Resulting ADR

An immutable ADR will be recorded after PostgreSQL becomes the canonical production composition and the client persistence convergence boundary has landed. Until then this accepted RFC governs the migration programme.
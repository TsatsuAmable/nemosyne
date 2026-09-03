# ADR-0005: Production persistence authorities

**Status:** Accepted  
**Date:** 2026-09-03  
**Supersedes:** none  
**Superseded by:** none

## Context

RFC 0005 rationalised two temporary persistence shapes that had been useful during PT4 implementation but were not acceptable as durable product architecture.

On the server, the first governed Product Mode slice proved consent, credential-session revocation, one-use capture authorization, governed-event replay/storage, retention, export and registered-service erasure using SQLite. That gave fast transactional evidence, but multiple authorities opening and evolving one local file was not the intended production service boundary.

On the browser client, durable state was spread across multiple IndexedDB databases and `localStorage`, creating multiple upgrade, recovery and startup authorities for one product.

PT4B9A/B9B and PT4B9C completed the migration governed by RFC 0005.

## Decision

### Server production authority

PostgreSQL is the canonical durable database for production Product Mode governance and product-service state.

Application and domain code reaches it through explicit async-capable persistence ports. One versioned migration authority owns PostgreSQL PT4 schema evolution. The canonical production composition uses PostgreSQL for consent/capture state, credential-session revocation, governed-event stream/replay state, retention, export and registered-service erasure.

SQLite is not a production peer and no product deployment may silently fall back to it. Any remaining SQLite implementation is compatibility/test-only and must be named and treated accordingly.

### Browser production authority

One versioned IndexedDB database, `nemosyne-client`, is the canonical durable browser application database.

Purpose-separated object stores may retain bounded ownership, but application persistence must converge behind that database and its migration authority. `localStorage` is not an application-state authority; legacy records may only be consumed by explicit one-way migration/compatibility paths and retired after durable commit.

Bearer credentials and governed-event queues remain memory-only. The short-lived PKCE redirect transaction may use `sessionStorage` because it is ephemeral redirect state, not durable application state.

### Boundaries preserved

- Rust/WASM remains the sole analytical and scale-sensitive computational authority.
- PostgreSQL is not an analytical implementation or default dataset cache.
- IndexedDB is not an analytical source of truth.
- Client and server databases are not wholesale mirrors; synchronization is semantic and API-driven.
- `.nemosyne` remains the portable investigation/replay artifact boundary.
- RFC 0004 consent, authorization, runtime provenance, retention, export and erasure semantics remain authoritative.

## Consequences

1. Production server composition must fail closed when PostgreSQL configuration, TLS requirements, schema version or migration readiness are invalid.
2. Production browser composition must fail closed or degrade explicitly when IndexedDB is unavailable; it must not create a hidden second durable store.
3. Future server persistence work extends the PostgreSQL adapters or their explicit ports rather than creating another canonical database.
4. Future browser persistence work adds purpose-scoped stores/migrations to `nemosyne-client` rather than creating new product databases or durable `localStorage` authorities.
5. Managed PostgreSQL deployment qualification, failover, backup/restore, provider snapshot handling and physical-media erasure remain operational/assurance evidence. They are not implied by this architectural decision.
6. Browser IndexedDB does not imply cross-device sync, encrypted-at-rest guarantees, backup recovery, or server-side erasure of downloaded/local artifacts.

## Evidence

The decision is implemented by the PT4B9A persistence-port/schema tranche, PT4B9B PostgreSQL production cutover and PT4B9C browser persistence convergence. Their post-implementation adversarial reviews preserve the exact bounded claims and residual qualification work.

This ADR records the durable architecture after those implementation tranches. Implementation status remains governed by `docs/ROADMAP.md`.

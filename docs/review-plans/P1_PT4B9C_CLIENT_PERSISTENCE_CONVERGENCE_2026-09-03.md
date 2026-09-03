# P1 PT4B9C Client Persistence Convergence — Pre-Implementation Adversarial Review

Date: 2026-09-03
Status: IMPLEMENTATION ACTIVE

## Decision

RFC 0005 client persistence converges on one versioned browser database, `nemosyne-client`. Purpose separation is expressed as object stores, not separate databases.

Managed stores for the first cutover are `sessions`, `settings`, `telemetry`, `gesture-profiles`, and `migrations`.

## High-risk invariants

1. Production session persistence must no longer open `nemosyne-sessions`.
2. Legacy settings and telemetry keys must not retain authoritative bytes in localStorage after startup migration.
3. Legacy imports commit into the unified database before legacy records are retired.
4. Migration is idempotent through a durable migration marker.
5. IndexedDB unavailability may degrade client-local persistence, but must not invent a second persistent backend.
6. Product analytics access/refresh tokens, PKCE bearer credentials and the governed-event queue remain non-persistent.
7. Server-authoritative Product Mode state remains PostgreSQL-owned and must not leak into the client database.

## Migration sources

- `nemosyne-sessions/sessions`
- `nemosyne_gesture_ai/profiles`
- `localStorage['nemosyne-vr-settings']`
- `localStorage['nemosyne-telemetry-consent']`

## Review attack surface

The post-review must attack partial/failed migration, malformed legacy values, duplicate migration, absent IndexedDB, synchronous settings bootstrap semantics, session schema validation and accidental fallback to localStorage or another IndexedDB database.

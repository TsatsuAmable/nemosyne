# P1-PT4B9C Client Persistence Convergence — Post-Implementation Adversarial Review

Date: 2026-09-03
Status: IMPLEMENTATION LANDED / EXACT-HEAD PROMOTION ACTIVE
Disposition: ADOPT once the literal final PR head passes the required promotion gates.

## Scope reviewed

This review covers the RFC 0005 client-persistence convergence implemented by PR #640: the single versioned `nemosyne-client` IndexedDB authority, session persistence, settings and telemetry migration, gesture-profile convergence, startup migration ordering, legacy retirement, and the browser-local persistence claim boundary.

## Material findings and fixes

1. **Session-store factory capability was too broad.** Ordinary session operations only require `open()`, while legacy retirement may require `deleteDatabase()`. The ports were separated so testability and least-capability injection are preserved.
2. **Gesture Intelligence could recreate a second production Nemosyne database.** Its production default now uses `nemosyne-client/gesture-profiles`; explicitly overridden standalone databases retain their independent module schema contract.
3. **Legacy retirement could become permanently incomplete.** A successful import followed by blocked legacy database deletion previously left the migration marker complete with no retry path. Cleanup is now retried idempotently on later startup after committed import.
4. **Three IndexedDB test doubles encoded weaker semantics than production.** They resolved requests without transaction completion, causing false timeouts once production correctly waited for transaction commit. The fakes were repaired rather than weakening production durability semantics.
5. **One fake coerced missing IndexedDB keys from `undefined` to `null`.** That made `hasSession()` report missing entries as present. The fake now matches the real API.
6. **Standalone gesture schema compatibility risk.** The shared production database follows the central client database version, while explicitly overridden standalone gesture databases retain the module’s historical database schema version.

## Adversarial assessment

The final architecture has one durable application-side client database with purpose-separated stores. Migration imports legacy state before retirement, records an idempotent migration marker, and retries cleanup without reopening a second production authority. Product Mode access/refresh credentials and governed-event queues remain outside durable client storage.

The compatibility bridge for the two still-synchronous settings/telemetry callers is intentionally narrow: those known Nemosyne keys are served from the bootstrapped memory mirror and persisted to the unified IndexedDB, not retained in browser `localStorage`. This is accepted for this tranche because replacing the synchronous UI contracts is orthogonal to persistence-authority convergence and would broaden the change surface without improving the database authority model.

No material correctness, architecture, security, or governance defect identified in this review remains intentionally unfixed.

## Exact-head evidence requirement

The literal final PR head must pass CI including all three Vitest coverage shards and Chromium production smoke, static type/lint/architecture checks, Rust tests, production build, CodeQL, Architecture policy, Q8, UV0, Wiki sync, approval, and Q9 exact-head promotion evidence. No earlier-head result substitutes for the final head.

## Claim boundary

ADOPT establishes one production application IndexedDB authority and bounded migration/retirement behavior. It does not claim browser-storage durability guarantees beyond the browser’s IndexedDB contract, cross-device synchronization, encrypted-at-rest browser storage, provider backup/restore, or server-side subject erasure of downloaded/local artifacts.

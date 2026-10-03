# RF-040 Telemetry & Privacy Lifecycle Assurance — Closure Record

Date: 3 October 2026
Base: `main@d438fffcb072966a3a732ff329eabf4401cc2ea9`
Finding: RF-040 (High) — Telemetry consent/GDPR helper is off-path and cannot substantiate its current claims
Status: VERIFIED COMPLETE

## Invariant

Telemetry and interaction trace collection across Nemosyne must remain strictly opt-in and default-off. Consent revocation must immediately halt all observation capture across every producer method. Client-side erasure must comprehensively purge in-memory buffers, histograms, frustration logs, and persistent consent choices across all client storage tiers.

Unsubstantiated statutory GDPR claims must not be asserted for isolated in-memory helpers; rather, every storage boundary (client in-memory diagnostics, client UX trace records, research-study registry, and governed backend analytics) must honestly articulate its exact operational boundary and verify end-to-end lifecycle guarantees.

## Telemetry & Trace Store Inventory

1. **Client In-Memory Diagnostic Telemetry (`src/utils/Telemetry.ts` - `TelemetryCollector`):**
   - **Retention:** Ephemeral in-memory metrics only (frame timings, dropped frames, operation counts, gesture frequencies, error/warning snapshots, and low-token frustration analysis). Zero network transmission.
   - **Consent Authority:** Opt-in persisted in `localStorage` under `nemosyne-telemetry-consent`. Defaults strictly to disabled.
   - **Revocation:** `saveConsent(false)` or `setEnabled(false)` immediately halts event capture across all producer methods (`recordFrame`, `recordDataset`, `recordOperation`, `recordPanelAction`, `recordMenuAction`, `recordGesture`, `recordDwell`, `recordGestureConfidence`, `recordMiss`, `recordError`).
   - **Erasure:** `collector.erase()` disables collection, resets all in-memory counters/histograms/frustration trails, clears dataset attribution to `'-'`, and deletes the `localStorage` consent record. Subsequent `loadConsent()` returns `false`.
   - **Export:** In-VR `TelemetryPanel` or user-initiated `getReport()` returns only metrics admitted during active consent, or zeroed structure post-erasure.

2. **Client Interaction Trace Buffer (`src/vr/trace/UXTraceRecorder.ts` & `src/app/devTrace.ts`):**
   - **Retention:** Local bounded ring-buffer (up to 1,000 records). Development transport flushes to local dev server; production composition replaces transport with a fail-closed 404 handler (`allowNetworkFlush: false`), keeping records strictly on-device.
   - **Consent Authority:** Defaults to disabled in production composition. Event bus callbacks are consent-gated before building spatial/UI context.
   - **Revocation:** `recorder.setEnabled(false)` emits lifecycle boundary markers (`consent-disabled`, `trace-end`), closes active trace, and rejects subsequent user/system observations.
   - **Erasure:** `recorder.erase()` disables recording, drains the ring buffer to `[]`, zeroes sequence and dropped-record counters, clears spatial context caches, and resets locked provenance.
   - **Export:** `exportJson()` exports an authenticated envelope (v2 whole-payload canonical SHA-256 digest). Post-erasure export produces an envelope with zero records, verified integrity, and no residual session data.

3. **Research-Study Participant Consent Helper (`src/study/TelemetryConsentManager.ts`):**
   - **Scope & Boundary:** Dedicated in-memory helper for empirical research studies (`development-only` capability).
   - **Pseudonymization:** Derives a cryptographic SHA-256 pseudonym (`subj_<sha256>`) salted with a mandatory non-empty per-deployment secret; never stores raw subject identifiers in memory or exported records; fails closed on missing/empty salt.
   - **Erasure & Claim Honesty:** Docstrings and methods clarify that deletion (`deleteConsentRecord` / `executeRightToErasure`) is strictly bounded to the local in-memory participant consent registry and does not traverse external databases or physical media.

4. **Governed Backend Analytics Data Plane (`src/governance-service/`):**
   - **Authority:** `ProductAnalyticsConsentAuthority` and `ProductAnalyticsLifecycleAuthority`.
   - **Cryptographic Erasure:** Implements dual-key shredding (`PURPOSE_KEY`, `DELETION_KEY`), durable consent receipts, revisions, and verifiable lifecycle traversal across PostgreSQL and SQLite (verified in PT4B test suites).

## Primary Failure Modes Prevented

1. **Silent collection before consent:** Producers cannot capture frames, operations, gestures, errors, or frustration records when unconsented.
2. **Post-revocation leakage:** Disabling consent immediately cuts off ingestion at all producer methods without deferred or queued capture.
3. **Ghost data post-erasure:** `TelemetryCollector.erase()` and `UXTraceRecorder.erase()` leave zero residual observations in memory or `localStorage`.
4. **False GDPR claims:** Removed misleading statutory claims from off-path helper documentation and aligned product claims with demonstrable technical capabilities.
5. **Attribution tampering:** Manifest provenance conflicts fail closed during trace export.

## Verification Evidence

- Dedicated production-path integration test suite: `tests/telemetry-lifecycle-assurance.test.ts` (12 tests covering default-off, opt-in grant, scoped collection, revocation stop, client-wide erasure, and export integrity).
- Existing telemetry regression suite: `tests/telemetry.test.ts` (8 tests passing).
- Existing production trace consent policy suite: `tests/prod-trace-consent-policy.test.ts` (7 tests passing).
- Existing trace export integrity suite: `tests/ux-trace-export-integrity.test.ts` (6 tests passing).
- Existing security hardening suite: `tests/security-hardening.test.ts` (22 tests passing).
- Backend governed data-plane lifecycle suite: `tests/pt4b-lifecycle-export-erasure.test.ts` (passing).

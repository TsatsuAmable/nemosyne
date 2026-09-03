# P1 PT4B8 Browser PKCE + Governed Producer Post-Implementation Review — 2026-09-03

Status: IMPLEMENTATION LANDED / REVIEW COMPLETE; promotion remains exact-head gated.

## Production path attacked

Re-reviewed the full bounded first-family path:

`src/main.ts` → complete-or-absent product-data configuration → OIDC Authorization Code + PKCE S256 → in-memory bearer credential → post-commit `WorldTopics.OPERATION_APPLIED` → closed operation projection → one-use capture authorization → exact capture-coordinate binding → client structural admission → 16-event / 64-KiB memory-only queue → authenticated NDJSON endpoint → canonical PT4 service composition → reviewed runtime-manifest authority → existing transactional consent/capture/replay/store authority.

## Findings and fixes

1. **BLOCKER fixed — capture-response substitution.** The first client draft compared the returned event ID to itself. It now binds the returned event ID to the exact pre-generated request ID and also binds producer, stream, sequence and family before constructing an envelope.
2. **BLOCKER fixed — runtime policy could be optional at service composition.** The runtime authority initially existed only as an ingestion wrapper. A canonical `createProductAnalyticsGovernanceCompositionV1()` now constructs consent, runtime-pinned ingestion, lifecycle/readiness and the HTTP server in the required order; the unpinned ingestion class is not an input to that composition.
3. **BLOCKER fixed — server runtime provenance was previously structural-only.** Application-build, deployment-configuration and UI-treatment references are now compared exactly against the reviewed manifest before consent/replay/storage authority. Platform runtime remains explicitly non-attested and is accepted only by reviewed component/version allowlist.
4. **BLOCKER fixed — browser configuration ambiguity.** The client is a true no-op only when every product-data setting is absent. Partial configuration fails closed, and runtime JSON accepts exactly the four PT4 references.
5. **BLOCKER fixed — CI type boundaries.** The World event-bus type and governed JSON casts now use the repository's explicit authority types rather than structural guesses.
6. **TEST DEFECT fixed — runtime pass-through fixture.** The first runtime-authority test expected `CONSENT_REQUIRED` without initializing the consent schema, correctly receiving `STORAGE_FAILURE`. The fixture now initializes the real consent authority before proving runtime-pass-through behavior.
7. **TEST DEFECT fixed — asynchronous producer assertion.** `captureOperation()` intentionally does not wait for analytics flushing. The test now waits for the observable queue state instead of assuming the fire-and-forget flush has completed when the analytical operation returns.

## Original failure modes

- Rich `OPERATION_APPLIED` fields are excluded by the existing closed projection and the producer test explicitly searches the emitted NDJSON for row/dataset data.
- PKCE uses `response_type=code`, S256, state and a verifier. No client secret is emitted. Access/refresh credentials remain object memory only; the redirect transaction state is consumed and removed from session storage before token exchange completes.
- Missing bearer credentials or an absent endpoint/configuration produce no governed event capture.
- Queue overflow/revocation/non-retryable governance or identity/sequence conflicts discard queued work and start a new stream. Network errors, 429/503 and storage-only dispositions retain bounded memory work for idempotent replay.
- Runtime mismatches are refused before the downstream consent/replay/storage authority.

## Newly inferred failure mode

A valid state/code query appearing on a browser route other than the configured redirect path was considered. This is not a promotion blocker in the current implementation because the authorization code is exchanged using the fixed configured `redirect_uri`; an authorization server-compliant code issued for another redirect cannot be redeemed, while state + PKCE bind the browser transaction. Exact local callback-path prechecking is a defence-in-depth suggestion for the subsequent deployment-hardening tranche.

The larger architectural finding is that PT4 still has additive SQLite schema creation spread across the consent, credential-session, ingestion and lifecycle authorities. PT4 must not be declared complete until one consolidated schema-version/migration authority owns every PT4 table and startup rejects unsupported/unapplied versions. That remains the next tranche, not a reason to weaken or recursively expand this producer PR.

## Falsifiability

Required fast tests now include:

- `tests/pt4b-browser-pkce-producer.test.ts`
- `tests/pt4b-runtime-manifest-authority.test.ts`
- `tests/pt4b-governance-composition-client-config.test.ts`

The implementation head before this review-record commit passed typecheck, lint, architecture enforcement, Rust, production build, all three Vitest coverage shards and aggregate coverage. Exact-head CI/security/promotion evidence must rerun after this record because the repository requires evidence for the literal promoted SHA.

## Disposition

**ADOPT** for the bounded PT4B8 claim once the final exact head passes CI / Node 24, CodeQL, architecture policy, Q8, Q9, UV0 and approval. Do not promote PT4 as complete yet.

Deferred to the next PT4 tranche:

- consolidated SQLite schema/migration/version authority;
- runnable deployment configuration/TLS/process composition evidence beyond the canonical constructor;
- crash fault injection around pre-commit/post-commit acknowledgement points;
- exact browser callback-path precheck as defence in depth;
- polished sign-in/consent/settings UX and physical-XR qualification.

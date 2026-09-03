# P1 PT4B7 Lifecycle Post-Implementation Review — 2026-09-03

Status: IMPLEMENTATION LANDED / EXACT-HEAD PROMOTION ACTIVE

## Production path attacked

The review re-read and exercised the real first-family path rather than a lifecycle-only adapter:

```text
authenticated GovernanceHttpService
  -> distinct events:export / events:erase scopes
  -> SqliteProductAnalyticsLifecycleAuthority
  -> shared durable governance.sqlite writer/repository state
  -> export / retention / registered-service erasure
```

Ingestion was re-reviewed at the same boundary because lifecycle readiness is required to block writes when overdue purge work remains.

## Original failure modes and results

- **Cross-principal traversal:** two-principal export/erasure falsifiers prove the authenticated issuer/subject is converted to the protected deletion handle inside the service; no caller pseudonym is accepted.
- **Consent accidentally gates lifecycle rights:** export remains available after product-analytics consent revocation; export and erasure use their own authenticated scopes.
- **Wrong retention clock:** query/export reachability uses `server_received_at` and becomes unreachable exactly at the 30-day boundary; physical rows are purged by the 31-day deadline.
- **Partial erasure promoted to completion:** the erasure action commits logical first-family removal and policy-governed lifecycle dispositions first, then completes the bounded WAL checkpoint before recording `SERVICE_SCOPE_RESOLVED`.
- **Stale action replay:** erasure action ID plus canonical request digest is principal-scoped and exact retries return the durable prior result; different content conflicts.
- **Restart illusion:** the same durable volume is closed and reopened through consent, ingestion and lifecycle authorities; export reachability survives restart and erasure remains effective after another reopen/read.

## Blockers found and fixed during review

1. **BLOCKER — erasure-created denied revision initially used a placeholder notice digest.** Fixed to preserve the exact reviewed product-analytics notice digest.
2. **BLOCKER — preliminary public artifact dispositions leaked debug deletion counts outside the closed response contract.** Fixed; public dispositions contain only the registered artifact and disposition.
3. **BLOCKER — Node SQLite `.all()` output crossed into typed export rows without an explicit runtime-boundary cast.** CI typecheck found this; fixed with a localized `unknown` boundary.
4. **BLOCKER — the existing PT4 HTTP surface implemented the global authenticated-request ceiling and capture budget but omitted RFC 0004's two simultaneous requests per principal and twelve event batches per minute per principal.** Fixed before body parsing and covered by dedicated fast falsifiers.
5. **BLOCKER — initial review evidence did not directly prove same-volume lifecycle restart behavior.** Added a dedicated restart falsifier to the required fast Node suite.

## Newly inferred failure mode

A high-volume authenticated client could have stayed within the global service ceiling while monopolizing request slots or event-batch work for one principal. The per-principal concurrency and batch-rate fixes prevent that resource-isolation failure without changing authentication, consent or analytical authority.

## Test falsifiability

The required fast suite now includes:

- `tests/pt4b-lifecycle-export-erasure.test.ts` — principal isolation, post-revocation export, exact erasure retry, retention expiry/purge and lifecycle HTTP scopes;
- `tests/pt4b-lifecycle-restart.test.ts` — same-volume restart persistence and post-restart erasure traversal;
- `tests/pt4b-http-resource-budgets.test.ts` — third simultaneous principal request and thirteenth event batch are refused before body parsing.

On the implementation head before this review-record-only update, typecheck, lint, architecture enforcement, Rust, production build and all three Vitest coverage shards passed. This review record changes no runtime semantics; the final head must nevertheless pass the complete exact-head CI/security/promotion set before merge.

## Deliberate boundaries / deferred work

- The service still claims logical registered-service erasure only. Flash/physical-media remanence, local/offline state, downloaded exports, backups, subject-wide traversal and GDPR-complete erasure remain outside this result.
- PT4 still needs a consolidated schema/migration/startup authority rather than independently additive table initialization before overall PT4 closure.
- Browser PKCE, bounded optional client queue, capture/producer wiring and production-composition evidence remain the next PT4 work.
- SQLite remains the reviewed single-node private-preview starting point, not a multi-node durability claim.

## Disposition

**ADOPT, conditional only on the final exact PR head passing CI, CodeQL, architecture policy, Q8, Q9, UV0 and approval.** No remaining review finding blocks PT4B7's bounded lifecycle claim.

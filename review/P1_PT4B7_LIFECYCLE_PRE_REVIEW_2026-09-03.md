# P1 PT4B7 Lifecycle Pre-Implementation Adversarial Review — 2026-09-03

## Scope

One-shot PT4B7 implementation of RFC 0004 retention execution/readiness, authenticated governed export, registered-service erasure, lifecycle HTTP routes and restart/idempotency falsifiers.

## Invariants under attack

1. Export and erasure remain available after consent revocation and never accept caller-selected pseudonyms.
2. Export is snapshot-consistent, principal/purpose scoped, bounded to seven days / 100,000 records / 100 MiB, ordered by server receipt time then event ID, excludes expired records exactly at the 30-day server clock, and digests the closed ordered record wrappers with the RFC domain separator.
3. Erasure serializes with grant/revoke/ingestion, creates a fresh denied revision, invalidates capture authority, makes retained event/stream state unreachable, and preserves only explicitly policy-governed lifecycle material needed to prevent stale replay and complete traversal.
4. Exact erasure retries are idempotent; action-ID reuse with different canonical content conflicts.
5. Registered store boundaries remain honest: logical SQLite deletion/checkpoint is not physical-media, downloaded-artifact, local/offline, subject-wide or GDPR-complete erasure.
6. Overdue physical event rows make ingestion unhealthy until lifecycle processing succeeds.

## Findings incorporated before promotion

- Rejected deleting all consent/lifecycle rows immediately: RFC 0004 requires bounded policy-governed retention so stale consent/action replay can still be refused.
- Rejected consent-gated export/erasure: lifecycle rights are intentionally independent of current collection consent.
- Rejected caller pseudonym input: lifecycle authority derives the protected deletion handle from the authenticated issuer/subject and versioned server key.
- Rejected export based on client capture time: server receipt time is the only retention/export clock.
- Rejected cross-store pseudo-atomicity: lifecycle opens the same SQLite database and uses `BEGIN IMMEDIATE` for erasure so it serializes with existing consent and ingestion writers.
- Rejected physical-erasure language: service-scope resolution reports explicit SQLite main/WAL/temp and outside-service boundaries.

## Pre-promotion corrections still required

- The erasure-created denied revision must preserve the exact reviewed product-analytics notice digest rather than a placeholder.
- Public registered-artifact dispositions must remain a closed contract and not expose implementation/debug row counts.
- Re-check the RFC per-principal service resource limits while touching the public lifecycle transport; fix forward if earlier PT4B transport work omitted a required limit.

## Promotion disposition

ADOPT only after the corrections above and exact-head typecheck/lint, required fast Node falsifiers, architecture policy, production build/coverage, CodeQL, Q8/Q9, UV0 and approval evidence all pass. No physical-media, backup, multi-node, subject-wide or GDPR-compliance claim is authorized by this tranche.

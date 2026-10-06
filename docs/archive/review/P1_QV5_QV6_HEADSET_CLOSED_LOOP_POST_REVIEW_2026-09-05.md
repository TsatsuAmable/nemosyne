# P1 QV5/QV6 headset closed loop — post-implementation adversarial review

**Date:** 5 September 2026  
**Scope:** PR #656 device-validation close loop  
**Pre-review:** `docs/review/P1_QV5_QV6_HEADSET_CLOSED_LOOP_PRE_REVIEW_2026-09-05.md`

## Disposition

**ADOPT only if the literal final PR head containing this review passes the full exact-head promotion surface.**

The review re-attacked the final implementation around launcher/browser/sink identity, counted-run semantics, delivery receipts, guided UX evidence, deliberate start controls, and dev-only isolation.

## Finding QV-R1 — sink confirmation was not exact enough

**Severity before fix:** High for evidence attribution integrity.

The headset operator surface described `/__validation-status` as confirmation of the exact launcher-owned manifest, but the browser accepted that confirmation after comparing only session ID and label. A stale or mismatched browser carrying the same session identifiers but a different build, validation lane, worktree state, or machine-captured ADB device identity could therefore be upgraded to a sink-confirmed governed session.

That violates the intended fail-closed boundary: session identifiers locate a validation session, but they are not sufficient proof that the browser is executing the same build/lane/device identity that the sink manifest records.

### Fix

- added `validationManifestConfirmationIssue(...)` in `src/validation/browser-validation-session.ts`;
- exact sink confirmation now requires agreement on session, exact build SHA, validation mode, worktree state, and machine-captured device identity availability/fingerprint-critical fields;
- `src/app/devEvidence.ts` rejects a mismatched sink manifest before calling `ValidationOperatorPanel.setServerStatus(...)`;
- added `tests/validation-manifest-confirmation.test.ts` covering build, lane, worktree and device-fingerprint drift.

## Other attacked boundaries

### Counted evidence

Qualification progress remains sink-owned and derived from persisted artifacts. Render progress counts written, XR-active, non-aborted Quest qualification summaries for the same clean build/device; 10M progress is explicitly an attempt count rather than a success count.

### Guided UX evidence

The sink requires the governed `quest-ux` lane, exact session/build/device agreement, the complete bounded task vocabulary, and bounded semantic outcomes before writing UX/comfort artifacts.

### Start controls

Governed performance and 10M starts remain locked until sink confirmation and require arm/confirm interaction. Hidden one-click developer start is not exposed as the governed operator path.

### Dev-only boundary

The validation operator remains part of the dev-evidence harness and does not enter normal production composition. This tranche does not itself constitute physical-device success, live-human success, deployment completion, or roadmap promotion.

## Residual boundaries

- Browser-side status payloads are trusted only after server HTTP success and promotion-critical manifest confirmation. The server remains the schema-validating source for the returned manifest.
- Captured evidence may still be non-promotion-eligible; capture is not equivalent to gate success.
- Physical Quest and human UX claims still require the governed sessions and persisted artifacts themselves.

## Promotion condition

No additional material blocker remains inside this bounded repository implementation after QV-R1 was fixed. Any further code/test head movement revokes this disposition and requires re-review. Merge only after exact-head CI, CodeQL, architecture, Q8, Q9, Wiki/docs validation, approval gate and review-thread checks are green and `main` has not moved underneath the branch.

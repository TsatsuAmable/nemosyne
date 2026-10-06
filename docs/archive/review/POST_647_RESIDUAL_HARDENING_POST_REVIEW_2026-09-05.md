# Post-#647 residual hardening — post-implementation adversarial review

**Date:** 5 September 2026  
**Programme:** bounded residual closure from the 3 September adversarial review  
**Pre-review:** `docs/review-plans/POST_647_RESIDUAL_HARDENING_2026-09-05.md`  
**Disposition:** **ADOPT only if the exact PR head containing this review record passes all required promotion gates without further production/test changes.**

## Scope attacked

The post-review re-attacked the final repository diff rather than relying on the implementation summary. It focused on:

- storage growth across *distinct* derived datasets, not merely identical DatasetJSON duplicates;
- logical-session compatibility and storage migration behavior;
- corrupt compact-session envelopes and dangling pooled references;
- accidental creation of a second scientific identity/fingerprint authority;
- privacy-sensitive browser identity in ordinary `.nemosyne` export;
- whether persistence failure is actually visible on a production-composed investigator surface;
- serialized WASM output sentinel semantics across Rust and both TypeScript hosts;
- package-manifest hygiene and accidental collateral dependency changes;
- stale signalling-security prose versus the actual nonce-consuming live path;
- false expansion of repository evidence into deployment, multi-replica, physical-device or live-human claims.

## Findings and fix-forward

### R1 — package reconstruction accidentally removed an unrelated lint dependency

**Severity before fix:** High for build/tooling integrity.

The first `package.json` edit that raised the `ws` floor accidentally omitted `eslint-plugin-import-x`. This was not part of the intended tranche and would have weakened the existing lint/tooling contract.

**Fix:** restored `eslint-plugin-import-x` exactly while retaining the intended `ws` floor change. The final diff is required to show no unrelated dependency removal.

### R2 — malformed storage-v2 envelopes could have fallen through as logical snapshots

**Severity before fix:** High for recovery integrity.

The first storage-v2 decoder selected the compact path only when the entire envelope satisfied its type guard. A malformed object that still carried `storageSchemaVersion: 2` could therefore miss the compact guard and fall through to the historical "uncompact logical snapshot" compatibility branch.

That is the wrong failure mode: corruption in a versioned compact envelope must never be silently reclassified as another storage format.

**Fix:** any object carrying `storageSchemaVersion` that is not a valid supported storage-v1/v2 envelope now fails closed. A deterministic malformed-v2 falsifier covers this path in addition to dangling dataset and row references.

### R3 — the first row-pooling implementation still stringified every full dataset before interning

**Severity before fix:** Medium for the performance objective being repaired.

Although row pooling removed repeated stored row bodies, the first implementation computed dataset-storage identity with `JSON.stringify(dataset)` before pooling. A long history of large derived datasets could therefore still repeatedly serialize expensive row bodies during autosave compaction even though the final stored representation was bounded.

**Fix:** rows are interned first; dataset-storage identity is derived from lightweight dataset metadata plus row-pool references. This identity remains storage-local exact-value bookkeeping only and is explicitly not scientific provenance/fingerprint authority.

### R4 — investigator-visible persistence warning needed production-composition evidence

**Severity before fix:** Medium for UX truthfulness.

An isolated controller assertion that `recordInteraction()` was called would not itself prove the warning reaches an investigator-facing product surface.

**Fix:** the regression additionally pins the real composition path: `WorldSessionController.recordInteraction` -> `World._logInteraction` -> `INTERACTION_LOG` -> `bindInteractionProjection` -> `uiManager.interactionCoach`. Manual save remains fail-closed; the autosave wrapper remains non-throwing.

## Final bounded assessment

### Session persistence

Storage schema v2 pools exact row values across distinct derived DatasetJSON snapshots. The 1-vs-50-operation falsifier requires the unique row-payload pool to remain constant while allowing legitimate lightweight provenance/order metadata to grow. Round-trip equality remains exact. Legacy uncompact logical schema-v2 and compact storage-schema-v1 records remain readable; malformed v2 and dangling references fail closed.

This does **not** claim operation-count-independent total session size. Exact undo/replay/provenance and row-order references remain durable by design.

### Portable export privacy

Ordinary portable investigation exports now omit `userAgent` and exact `platform` even if a normal product caller supplies them. A study/diagnostic path must opt in explicitly before those values enter the manifest. The opt-in control itself is not serialized. `webxrSupported` remains as a coarse capability fact.

No dataset identity, analytical provenance, investigation digest or replay authority was changed.

### Local persistence failure

A failed durable save can no longer look like successful local recovery. It is logged as `Local recovery unavailable` and projected into the ordinary Interaction Coach path. Explicit save still reports failure to its caller; autosave does not throw into the render/product loop.

### WASM serialized-output contract

The existing ABI is retained rather than churned: for the current serialized JSON/provenance exports, `0` means no successful payload. Both TypeScript hosts continue to map non-positive required length to null/failure. Semantically empty successful JSON values remain non-empty encodings (`[]`, `{}`), so no current caller requires zero-length success.

### Signalling and deployment boundary

The stale Stream C description was corrected to current code: one server-only ticket authority, mandatory nonce, atomic single-registry consumption at admission. This review does **not** promote that to multi-replica safety. A shared atomic nonce store and cross-replica falsifier remain explicitly deferred under `governance/production-readiness.json` obligation `RDO-007`.

No production deployment is performed or claimed by this tranche.

## Promotion condition

The code review found and fixed the four issues above before promotion. No additional material blocker is intentionally open inside this bounded repository-hardening claim.

Promotion is still conditional on the **literal final head containing this document** passing the ordinary exact-head CI aggregate, TypeScript, lint/static analysis, repository tests/coverage, Rust, production build/smoke where selected, CodeQL, architecture policy, Q8, Q9, Wiki/docs validation and approval, with no unresolved review threads and no `main` head race. Any subsequent code/test change revokes this disposition and requires re-review.

# Post-#647 residual hardening — pre-implementation adversarial review

**Date:** 5 September 2026  
**Base:** `main@d2a3ed57dfd58e2337c7e87088ecbeb2bed1e8d1`  
**Source review:** 3 September 2026 adversarial module review (`RF-047..RF-060` labels are review-local and collide with the canonical roadmap RF ledger)

## Why this tranche exists

PR #647 fixed the material high-risk defects from the 3 September review, and #653/#654 subsequently made signalling and production-readiness obligations explicit. A fresh-main residual check found four bounded repository issues worth closing before PT5 STOP:

1. session-storage compaction deduplicates identical DatasetJSON values, but distinct filtered/sliced derived datasets can still repeat the same expensive row payload many times;
2. the normal portable-investigation export path supplies `navigator.userAgent` and `navigator.platform` even though the package schema already marks those fields privacy-sensitive;
3. local persistence failure reaches the XR console but is not guaranteed to appear in an ordinary investigator-facing interaction surface;
4. the shared WASM serialized-output helper uses `0` for invalid output buffers and also has a zero required length for an empty byte payload, while the TypeScript string hosts already interpret `<= 0` as no successful payload. The intended ABI contract needs to be mechanically pinned rather than left implicit.

Two low-risk hygiene residuals accompany the tranche:

- raise the declared `ws` dependency floor from `^8.17.0` to `^8.17.1` while retaining the currently locked newer release;
- repair stale Stream C prose that still describes replay-permissive signalling after the live admission path became nonce-consuming and single-authority.

## Invariants

### Persistence

- `NemosyneSession` remains the logical snapshot authority; storage compaction must not alter its schema or replay meaning.
- schema-v2 logical snapshots and legacy storage-schema-v1 compact records remain readable.
- row-payload deduplication is storage-local exact-value interning, not a second scientific fingerprint authority.
- corrupt/dangling dataset or row references fail closed.
- distinct filter/sort/slice histories may grow in lightweight ordering/metadata, but unchanged row payload must not be copied once per operation.

### Portable export privacy

- ordinary product `.nemosyne` export omits browser identity (`userAgent`, exact platform) by default;
- `webxrSupported` may remain because it is a coarse capability fact rather than a browser fingerprint string;
- browser identity may be included only through an explicit study/diagnostic opt-in that is not itself persisted in the manifest;
- this change must not alter dataset, analytical, replay or investigation-digest authority.

### Persistence UX

- failed durable save must remain fail-closed and must not report success;
- failure must appear through the already-wired investigator interaction projection as `Local recovery unavailable`, not only `console.warn`/VR console text;
- autosave failure remains non-throwing to the render/product loop.

### WASM output ABI

- for serialized string/JSON exports, `0` means **no successful serialized payload**;
- current hosts must continue to map non-positive required length to `null`/failure rather than treating zero as a successful empty string;
- successful semantically-empty JSON remains non-empty bytes (`[]`, `{}`), so no current serialized-output API needs a zero-length success value.

### Security documentation

- Stream C must describe the current single-replica admission truth: one server-only ticket authority, mandatory nonce, atomic consumption at admission;
- multi-replica replay safety remains unclaimed and owned by production-readiness obligation `RDO-007`.

## Falsifiers

1. Construct 50 distinct derived dataset snapshots sharing a large baseline row set; fail if the row-payload pool grows with operation count or round-trip meaning changes.
2. Load both legacy uncompact schema-v2 and compact storage-schema-v1 session records after the storage change.
3. Tamper a compact session to reference a missing dataset or missing row; expansion must throw.
4. Export with identifying browser strings without opt-in; unpacked manifest must contain null identity strings.
5. Repeat with explicit study/diagnostic opt-in; the supplied identity may be present, while the opt-in control flag itself must not be serialized.
6. Force IndexedDB save rejection; explicit save must reject, autosave wrapper must remain non-throwing, and both must emit the investigator-facing recovery warning.
7. Assert both TypeScript serialized-output hosts continue to treat `required <= 0` as no payload and the Rust helper still documents zero as the fail-closed invalid-buffer result.
8. Exact-head CI must reject any package/lock inconsistency created by the `ws` floor adjustment rather than weakening install evidence.

## Non-goals / deferred boundaries

- No production deployment is performed in this tranche.
- No multi-replica signalling claim; shared atomic nonce-store work remains deferred under `RDO-007`.
- No redesign of `AnalysisResult` or the logical session schema unless storage-only row pooling proves insufficient.
- No attempt to eliminate all operation-count growth: provenance, ordering and exact undo/replay metadata are legitimately durable.
- No claim that browser/IWER evidence constitutes physical-device or live-human PT5 evidence.

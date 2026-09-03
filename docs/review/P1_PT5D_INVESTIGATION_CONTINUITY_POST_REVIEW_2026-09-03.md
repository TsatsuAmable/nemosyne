# P1 PT5D — Investigation Continuity Post-Implementation Adversarial Review

**Date:** 2026-09-03  
**Risk:** high — persistence/recovery, portable replay, archive identity, desktop/XR parity  
**Disposition:** ADOPT only if the exact PR head containing this record passes all required promotion gates without further production/test changes.

## Scope attacked

This review re-attacks the PT5D production path from researcher save/recovery actions through `InvestigationContinuityController`, `WorldSessionController`, `SessionStore`, `VaultArchiveStore`, `NemosyneSession`, `.nemosyne` packaging and `InvestigationReplayRunner`, including the shared desktop/XR presentation seams.

The review does not promote cloud backup/synchronisation, universal headset file-picker ergonomics, subject-wide downloaded-artifact lifecycle, managed storage durability, or physical-device recovery qualification.

## Findings and fix-forward

### BLOCKER 1 — stale browser evidence asserted retired continuity vocabulary

The first exact-head CI run failed because older smoke/UV0 tests still required the pre-PT5D filename `nemosyne-investigation.nemosyne` and the pre-PT5D `Replay investigation` command/modal path. PT5D deliberately replaces those product affordances with a date-stamped `.nemosyne` download and `Open .nemosyne`, routed through the canonical continuity controller.

Fix-forward: browser and UV0 evidence now exercises the real `Open .nemosyne` file-chooser route, accepts only the canonical date-stamped `.nemosyne` filename shape, observes continuity-controller feedback, and includes a tampered-package refusal assertion that the visible dataset is unchanged.

### BLOCKER 2 — missing embedded session identity could bypass the stated package/snapshot agreement invariant

`verifyEmbeddedSnapshot()` previously rejected a mismatching `sessionId` only when the embedded snapshot supplied a truthy ID. An otherwise replay-valid package could therefore remove the embedded `sessionId` and bypass the explicit PT5D invariant that resumable workspace state must agree with the verified package session identity.

Fix-forward: embedded `sessionId` equality is now strict. Missing, empty or different session identity is refused before restore. A focused falsifier deletes `sessionId` from the embedded continuity snapshot while the package replay verifier reports success and proves that no restore occurs and the current investigation remains unchanged.

## Invariant review

1. **Verify before mutate — PASS.** `openPortable()` invokes the clean-room replay verifier before package continuation is inspected or any live restore is attempted. Verification refusal returns without mutation.
2. **Independent resumable-snapshot verification — PASS after BLOCKER 2.** The embedded session-v2 snapshot must agree with manifest session identity, canonical dataset identity, command/evidence count, DiscoveryEpisode count, research context and canonical investigation digest before restore.
3. **Failed restore rollback — PASS.** Checkpoint/package restoration captures the previous live investigation and restores it when the target restore returns false or throws; rollback failure is surfaced explicitly rather than hidden.
4. **Immutable archive identity — PASS.** Restore/export/delete operate on the selected frozen archive ID and its stored snapshot. Focused tests prove later mutable live state cannot substitute for the selected checkpoint.
5. **Presentation freshness — PASS.** Product save/checkpoint/current export obtain a fresh `WorldSessionController.snapshotCurrentSession()` before persistence or serialization. Restore uses the ordinary production dataset/session/presentation pathway.
6. **Single product authority across modalities — PASS.** Desktop, XR and existing Evidence Vault callbacks delegate to the same `InvestigationContinuityController`; they do not create separate persistence or replay semantics.
7. **Legacy portability — PASS.** Packages without the PT5D continuity snapshot remain replay-verifiable but are explicitly reported as non-resumable and do not mutate live state.
8. **Scientific authority — PASS.** PT5D persists/reconstructs investigation state; Rust/Atlas remains analytical authority and package continuation does not invent analytical meaning outside the existing replay/restore paths.
9. **Recipient-local settings boundary — PASS.** Portable reopen preserves current device-local settings rather than silently importing privacy/comfort/runtime preferences from another investigation package.

## Failure-mode re-attack

- stale presentation exported: fenced by fresh snapshot capture;
- archive A exporting live investigation B: fenced by archive-ID load and immutable-snapshot tests;
- malformed/tampered package mutating state before verification: fenced by verifier-first ordering and browser tamper evidence;
- replay-valid but tampered embedded snapshot restored: fenced by independent identity/count/context/digest checks, including missing-session-ID falsifier;
- failed target restore leaving half-switched state: fenced by rollback path and hostile restore test;
- autosave absence reported as success: `hasSession('autosave')` and boolean restore result fail closed;
- desktop/XR semantic split: both consume the same controller;
- legacy package falsely labelled resumable: explicitly refused as resumable while remaining verification-readable;
- old direct header/Vault export bypassing fresh PT5D semantics: ordinary header command and Evidence Vault callbacks are rebound to the controller.

## Residual boundaries

The browser picker necessarily reads a researcher-selected local file before the package parser can apply ZIP/decompression budgets; `NemosynePackageManager` still enforces archive, total-uncompressed, single-entry and entry-count limits before package use. This review does not classify universal hostile local-file UX/resource qualification across all headset/browser implementations as closed PT5D scope.

Physical Quest/headset recovery behavior, OS picker ergonomics, browser-storage durability under device pressure, cloud synchronisation, cross-device backup and managed storage disaster recovery remain later qualification/product work.

## Promotion decision

**ADOPT** only when the literal PR head containing this record is unchanged and CI, CodeQL, architecture policy, Q8, Q9, UV0, generated Wiki validation and approval are all green. Any subsequent production or test change invalidates this disposition and requires another bounded review.

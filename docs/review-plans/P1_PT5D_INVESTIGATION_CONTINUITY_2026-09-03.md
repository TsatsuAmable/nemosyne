# P1 PT5D — Investigation Continuity Pre-Review

**Base:** `main@bca9edc463cca605aff6505233fa54e6ff210f20`  
**Risk:** high — persistence/recovery, portable replay, archive identity, desktop/XR parity

## Goal

Make ordinary investigation continuity a product capability rather than a collection of disconnected persistence tools. Desktop and XR must be able to save, checkpoint, export, reopen and recover through one application-layer authority while preserving existing `SessionStore`, `NemosyneSession`, `VaultArchiveStore`, `.nemosyne` package and replay authorities.

## Canonical path

```text
researcher action
  -> InvestigationContinuityController
    -> WorldSessionController / VaultArchiveStore / NemosyneSession
      -> SessionStore or .nemosyne package
        -> replay verification before portable reopen
          -> ordinary dataset/session restore path
```

No continuity action may write analytical meaning directly or create a second persistence format.

## High-risk invariants

1. **Portable reopen is verify-before-mutate.** A `.nemosyne` package must pass the existing clean-room replay verifier before its resumable session snapshot may replace live state.
2. **Resumable snapshot is independently checked.** The optional continuity snapshot embedded in a package must agree with package session/dataset identity, command/discovery counts and the canonical investigation digest before restore.
3. **Failed reopen does not strand partial state.** The current live session is captured before a restore attempt and is restored if the target restore fails after mutation begins.
4. **Archive identity is immutable.** Exporting/restoring a checkpoint uses the selected frozen snapshot, never the later mutable live session.
5. **Presentation freshness.** Product save/checkpoint/export captures live presentation through `WorldSessionController.snapshotCurrentSession()` before serialization.
6. **One product authority.** Desktop and XR controls delegate to `InvestigationContinuityController`; they do not call persistence/package internals directly.
7. **Legacy portability remains readable.** Older `.nemosyne` packages without a resumable continuity snapshot may still be verified, but must be described as verification-only rather than falsely reopened.
8. **Scientific boundaries remain unchanged.** Rust/Atlas remains analytical authority; continuity persists/reconstructs state but does not recompute scientific meaning outside the existing replay path.

## Primary failure modes to falsify

- export contains stale camera/settings/panel/focus state;
- archive A exports live investigation B;
- malformed/tampered package mutates live state before verification;
- command log verifies but a tampered embedded session snapshot is silently restored;
- failed presentation/dataset restore leaves the live investigation half-switched;
- autosave recovery is presented as successful when nothing was restored;
- XR uses a separate save/recovery store or bypasses `.nemosyne` verification;
- an older verification-only package is labelled resumable;
- file-picker/download errors become unhandled promise rejections;
- continuity UI exposes internal storage identifiers as primary product language.

## Evidence required before promotion

- controller falsifiers for save/checkpoint/export/open/recover and rollback;
- package round-trip preserving dataset identity, DiscoveryEpisodes, evidence ledger, representation provenance and presentation snapshot;
- tampered continuity snapshot refusal after package replay verification;
- legacy package verification-only behavior;
- desktop and XR presentation tests proving both delegate to the same controller;
- existing package/replay, archive/session-roundtrip and production smoke suites remain green;
- completed post-implementation adversarial review on the literal final head.

## Claim boundary

PT5D will claim software-path continuity across save/checkpoint/export/reopen/recover on desktop and browser-based XR. It will not claim cloud backup/synchronisation, subject-wide artifact lifecycle, operating-system file-picker quality on every headset, or physical-device recovery qualification.
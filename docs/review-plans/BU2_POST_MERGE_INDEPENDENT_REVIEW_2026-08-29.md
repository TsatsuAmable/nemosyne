# B-U2 Post-Merge Independent Review — 2026-08-29

**Base:** `main@b1003a7ad3d44f9c7c89d05cc8a91259f0458716`  
**Reviewed implementation:** PR #555 (`fix(b-u2): journey completeness`)  
**Disposition:** `IMPLEMENTATION LANDED / FIX-FORWARD REQUIRED`

## Review invariant

The journey-completeness layer may expose existing analytical/session authority, but it must not create a second authority or present an operation as complete when the underlying state is different.

For the affected Journey B/D seams:

1. the representation shown as a remediation **preview** must be the exact decision eligible for commit;
2. a preview must be fenced to the dataset fingerprint/version and remediation action from which it was calculated;
3. freezing must serialize the **current live presentation + analytical session**, not a stale presentation snapshot;
4. restoring must not announce/capture success before the asynchronous restore completes;
5. exporting Archive A must package Archive A, never the current live investigation under Archive A's filename;
6. HUD/status mirrors must consume existing semantic-status truth and must be removed from the engine lifecycle when disposed.

## Findings

### B-U2-R1 — remediation preview is not an observable representation comparison

**Severity:** BLOCKER for the PR #555 Journey B completion claim.

`World._previewRemediation()` calculates `_previewedDecision`, but no production consumer reads `_previewedDecision`. `RecommendationPanel` displays only a generic `PREVIEW ACTIVE` banner and stores its own remediation action id.

Therefore the user is not shown the alternative representation decision that was supposedly previewed. The UI currently proves that an arbitration call happened, not that a representation comparison is visible or inspectable.

**Required fix:** expose a read-only preview summary containing at least current candidate, preview candidate, utility/decision status where available, and candidate-preservation implications already present in the decision. Do not render or commit analytical geometry merely to preview.

### B-U2-R2 — preview/commit is not fenced to the state that was previewed

**Severity:** BLOCKER.

The preview stores requirements/action/decision but not a dataset fingerprint/version fence. `_commitRemediation(action)` commits whichever action the panel passes at commit time and does not verify that it is the action/dataset state for which the preview was calculated.

A dataset/outcome transition between Preview and Apply can therefore make `PREVIEW ACTIVE` stale while Apply commits a different current action.

**Required fix:** store dataset fingerprint/version + action id with the preview; commit only if all still match. Otherwise cancel the preview and surface a stale-preview reason. Fresh dataset loads and requirement reconstruction must invalidate preview state.

### B-U2-R3 — freeze bypasses the authoritative live-presentation snapshot path

**Severity:** BLOCKER for full freeze fidelity.

`WorldSessionController.saveSession()` refreshes `NemosyneSession.presentation` from the live camera/settings/tour/theme/panel/entry/focus state before serializing. `World._freezeInvestigation()` directly calls `this.session.serialize()` and therefore bypasses that refresh.

The archive can be analytically current while carrying stale presentation state.

**Required fix:** factor the controller's live snapshot preparation into one reusable method and use it for both save and freeze. Do not duplicate presentation capture in `World`.

### B-U2-R4 — archive restore reports success before restore completes

**Severity:** HIGH.

`World._restoreArchive()` calls asynchronous `sessionController.loadSession(archiveId)` without awaiting its result, then immediately logs `Restored archive` and captures the session.

**Required fix:** await the restore result and only log/capture success after a successful current-generation restore. Failed/stale restores remain explicit.

### B-U2-R5 — selected archive export packages the live session

**Severity:** CRITICAL evidence/provenance defect.

`World._exportArchive()` loads the selected archive only to confirm it exists, then calls `this.session.exportPortablePackage()`. That method exports the **current live Atlas/session state**, not the loaded archive object.

This can produce a file named for Archive A whose evidence/command log/dataset actually belong to Investigation B.

**Required fix:** export from the selected immutable archive snapshot through a snapshot-aware package path. Until such a path exists, fail closed rather than exporting the live session under the selected archive identity. A correct fix must preserve package/digest/kernel provenance and must not transiently mutate the live investigation while exporting.

### B-U2-R6 — `EmbodimentStatusNotice` leaks from the engine update loop

**Severity:** HIGH lifecycle defect.

`WorldUIManager` adds `embodimentStatusNotice` via `engine.addUpdatable(...)`, but `dispose()` removes `statusStripPanel` and not `embodimentStatusNotice` before disposing it.

**Required fix:** remove the notice from the update loop during disposal and add a recreation/lifecycle falsifier.

### B-U2-R7 — semantic-status notice invents a second copy surface instead of consuming the landed message

**Severity:** MEDIUM / product-semantics integrity.

The authoritative semantic status helper already writes candidate-aware `semanticEmbodimentCandidateId`, `semanticEmbodimentStatus`, and `semanticEmbodimentStatusMessage` to the representation group. The new notice reads a non-authoritative `semanticEmbodimentRefusal` field and reconstructs generic copy such as `REPRESENTATION REFUSED`.

This loses the candidate-aware aggregate/distribution text established by #554 and duplicates presentation semantics.

**Required fix:** make the notice a passive mirror of the existing candidate-aware status/message fields. It must not infer a new refusal meaning.

## Required falsifiers

- Preview current candidate A -> candidate B is visibly represented as A -> B; preview decision remains non-mutating.
- Change dataset fingerprint/version after Preview; Apply must refuse/cancel rather than commit the stale preview.
- Change available remediation outcome/action under the same panel; Apply must not substitute a new action for the previewed one.
- Freeze after changing camera/settings/focus without an intervening autosave; archived presentation must contain the current values.
- Delayed session restore must not emit success/capture until completion; failed restore must not claim success.
- Freeze A, mutate live investigation to B, export A; unpacked portable evidence must identify A, not B. If snapshot-aware export is not yet implemented, the operation must fail closed.
- Recreate/dispose World/UI manager repeatedly; no disposed `EmbodimentStatusNotice` remains in engine updatables.
- Aggregate and distribution refusal notices preserve the candidate-aware message from `SemanticEmbodimentStatus`.

## Non-goals

- no new analytical mathematics;
- no new Moneta candidate;
- no redesign of the task-first shell;
- no broad RF-062 refactor;
- no Quest qualification;
- no private-preview deployment work;
- no weakening of package/digest evidence to make archive export convenient.

## Promotion rule

PR #555 remains implementation-landed, but its Journey B/D completeness claims are **review-active** until R1-R6 are fixed and R7 is either fixed or explicitly accepted with evidence. Green CI on #555 is not sufficient because the existing test set did not falsify these production-state mismatches.

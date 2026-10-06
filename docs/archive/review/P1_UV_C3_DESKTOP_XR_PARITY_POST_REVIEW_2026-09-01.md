# P1-UV C3 Desktop/XR Parity — Post-Implementation Adversarial Review

**Date:** 2026-09-01  
**Implementation base:** `main@03254c0eb9685c8adbabf23b1cae17082a59718e` (#614 C2 merged)  
**Reviewed implementation head:** `0d56b73a052cd2c34542ef804cb2a0ac10be522e`  
**Owning PR:** #615  
**Risk:** HIGH  
**Disposition:** **ADOPT / C3 BOUNDED REVIEW CLOSED; FINAL PROMOTION REQUIRES THE UNCHANGED CLOSURE HEAD TO PASS EXACT-HEAD GATES**

## Review question

Does C3 make desktop and immersive selected-object tasks one governed semantic product without introducing a second selection/analytical authority, while preserving explicit boundaries around physical-input qualification and the still-open whole-product visual hierarchy?

## Result

Yes, for the bounded C3 semantic-parity contract.

The implementation freezes one selected-object vocabulary (`Inspect | Compare | Challenge | Record | Navigate | More`), moves XR dispatch and availability into one shared resolver, and projects that same resolver into a compact desktop `Selected object` rail. Desktop selection is read from the existing contextual surface and refreshed from the authoritative `RepresentationSurface` selection signal plus dataset invalidation. No analytical calculation, evidence classification, or second selection store was introduced.

The retained production-browser evidence also proves that the desktop path does more than render matching labels: `Record` increments the existing observation owner, `Inspect` opens the existing inspector owner, and dataset replacement clears the selected-object context.

C3 does **not** close C4 whole-product visual convergence and does **not** constitute physical Quest/controller/direct-touch qualification.

## Authority review

| Concern | Authoritative owner after C3 | Review result |
| --- | --- | --- |
| selected-object task vocabulary | `InvestigatorTaskIntent` contract | one shared vocabulary |
| transient selected payload | existing `ContextualTaskSurface` / representation selection lifecycle | no second selection store |
| selected-object task availability | `ContextualTaskSurface.taskAvailability(...)` | desktop consumes exact same availability/reasons |
| selected-object dispatch | `ContextualTaskSurface.dispatchTask(...)` -> shared `dispatchInvestigatorTask(...)` callbacks | one semantic dispatch path |
| selection refresh/invalidation | `RepresentationSurface.subscribeSelection()` + dataset-loaded invalidation | no DOM pointer/focus inference |
| inspect/compare/challenge/record/navigate/more effects | existing product callback owners | C3 adds no analytical implementation |
| physical pointer/controller/direct-touch mechanics | existing input subsystem + later P1-U9 / Stream D qualification | not claimed by C3 |

## Fix-forward findings

### C3-RF-01 — desktop and XR initially differed on transient selection clearing

**Severity:** HIGH  
**Status:** FIXED

**Finding:** the first desktop bridge could dispatch against the active contextual payload without consuming the transient selection in the same way as XR. A completed desktop task could therefore leave stale selected-object actions live while the immersive rail had already disappeared.

**Fix:** `ContextualTaskSurface.dispatchTask(...)` now captures the selected payload, hides/clears the contextual surface, and only then hands the captured payload to the shared callback resolver. Desktop and XR both consume that path.

**Evidence:** focused C3 falsifiers prove the callback receives the exact captured payload while `activeData`, `activeNode`, and surface visibility are cleared.

### C3-RF-02 — task availability diverged for TABULAR selections

**Severity:** HIGH  
**Status:** FIXED

**Finding:** an early desktop projection enabled all six verbs whenever a selection existed, while XR already refused `Challenge` and `Navigate` for TABULAR selections.

**Fix:** availability and disabled reasons moved behind `ContextualTaskSurface.taskAvailability(...)`; the desktop rail consumes that exact result.

**Evidence:** focused falsifiers require `Needs linked structure` and `No linked path` to survive unchanged into the desktop projection.

### C3-RF-03 — persistent desktop `More` could remain enabled with no selected object

**Severity:** MEDIUM  
**Status:** FIXED

**Finding:** XR normally has no contextual rail when there is no selection, but the persistent desktop section could expose `More` because the immersive resolver legitimately permits `More` while its transient surface exists.

**Fix:** the desktop projection fails all six selected-object verbs closed when `getSelection()` returns null. This keeps the persistent desktop affordance consistent with its own instruction, `Select a data object to use these tasks`, without changing XR's transient internal semantics.

### C3-RF-04 — pointer/focus activity was an invalid second selection-refresh signal

**Severity:** HIGH  
**Status:** FIXED

**Finding:** the first desktop refresh draft used document-wide pointer/focus activity to reconcile selected state. That made DOM activity a timing-sensitive shadow signal for semantic selection and could drift during representation replacement.

**Fix:** desktop refresh now subscribes to `RepresentationSurface.subscribeSelection()` and reconciles after the authoritative selection update settles. Dataset replacement is an explicit invalidation boundary. No pointer/focus event is used to infer selection.

**Evidence:** the production-browser proof deliberately performs selection without a synthetic pointer/focus refresh and still observes the desktop selected-object rail.

### C3-RF-05 — strict TypeScript and lint findings in the focused tests

**Severity:** LOW  
**Status:** FIXED

**Finding:** CI caught one test-only callback-narrowing pattern and an empty compatibility interface rejected by lint.

**Fix:** the test uses an explicit subscriber collection and the compatibility surface is a type alias. No compiler/lint rule was weakened.

### C3-RF-06 — composed custom-button text duplicated the visible task label

**Severity:** MEDIUM  
**Status:** FIXED

**Finding:** the first production-browser run saw `InspectInspect`: `nms-button` mirrors its light-DOM text into the shadow control while Playwright's composed text exposed both copies. The product component was visually usable, but the DOM/accessibility contract was ambiguous and the exact label evidence correctly failed.

**Fix:** C3 now uses the button component's `label` contract and an explicit `aria-label` rather than duplicating the task text in light DOM. The focused test freezes this contract.

**Evidence:** dedicated C3 production-browser run `33535192617` passed on `0d56b73a052cd2c34542ef804cb2a0ac10be522e` after the fix.

### C3-RF-07 — PR promotion marker did not match the repository gate vocabulary

**Severity:** PROCESS  
**Status:** FIXED

**Finding:** the initial PR body heading was not an accepted promotion marker, so the approval gate correctly refused the PR even after code checks were green.

**Fix:** the PR now carries `## Adversarial implementation contract` plus an explicit `High-risk change` disposition. The approval gate passed on the reviewed implementation head.

### C3-RF-08 — retained screenshots still show whole-product salience competition

**Severity:** MEDIUM / C4 CARRY-FORWARD  
**Status:** OPEN IN C4, NOT A C3 AUTHORITY BLOCKER

**Finding:** `c3-selected-task-parity.png` and `c3-desktop-inspect.png` show the desktop selected-object rail as compact, understandable and task-oriented. They also retain the known central-world density: multiple panels/objects and bright geometry compete for attention around the data/TechnoCore area. C3 intentionally did not redesign that treatment.

**Disposition:** carry to C4 visible-product evidence and hierarchy review. C3 may not use semantic-parity success to claim the whole product is visually converged.

### C3-RF-09 — physical controller/direct-touch/Quest mechanics remain unqualified

**Severity:** EVIDENCE BOUNDARY  
**Status:** DEFERRED TO STREAM D / P1-U9

**Finding:** shared task semantics and the immersive `ContextualTaskSurface` prove that XR presentation consumes the same vocabulary/resolver, but desktop Chromium and jsdom/Three tests cannot prove physical reach, target acquisition, controller ray quality, direct-touch tracking, haptics, comfort, or device optics.

**Disposition:** `physicalQuestEvidence=false`. Simulator-testable journey mechanics belong in C4 where relevant; final physical qualification remains P1-U9/Stream D.

## Falsifier disposition

1. **Desktop calls a different behavior path:** falsified. Desktop calls the contextual surface's shared resolver.
2. **XR retains separately authored six-verb behavior mapping:** falsified. Canonical labels and callback dispatch are shared through `InvestigatorTaskIntent`.
3. **Desktop exposes subsystem names as novice tasks:** falsified. The rail uses the six investigator verbs.
4. **Essential selected-object vocabulary exists on only one modality:** falsified at semantic/presentation level. Both surfaces consume the same six definitions. Physical discoverability is not claimed.
5. **Stale/implicit selection remains actionable:** falsified. Dispatch is single-shot and dataset replacement invalidates context.
6. **Record manufactures epistemic facts:** falsified. Browser evidence shows the real observation owner changes.
7. **Challenge gains a TypeScript analytical implementation:** falsified. C3 only dispatches callbacks and availability.
8. **New keyboard shortcuts fire while typing:** not applicable. C3 introduced no new global keyboard shortcut layer.
9. **C3 introduces divergent cancel semantics:** falsified for the changed surface. Task dispatch consumes the same transient contextual state; C3 does not replace the existing input FSM/capture-cancel subsystem.
10. **Physical controller/direct-touch fitness is claimed from browser evidence:** falsified by explicit evidence classification.

## Production evidence reviewed

Dedicated workflow: `P1-UV C3 desktop-XR parity evidence`  
Run: `33535192617`  
Artifact: `p1uv-c3-desktop-xr-parity` / artifact id `9811432921`  
Artifact digest: `sha256:8c71b7075eaea320ce14656359f06b1b838408bb6bfae26c6051fc9590a222e6`

Pinned identities from the retained artifact:

- source head: `0d56b73a052cd2c34542ef804cb2a0ac10be522e`;
- checkout head: `0d56b73a052cd2c34542ef804cb2a0ac10be522e`;
- workflow event merge SHA: `03376ca1e55bf250bf635976295b1414a453c6b1`;
- production bundle SHA-256: `3bce32d5d5e6c2f20756e428ef03c2c5a81328bd1e6aecaf75c3005bac05b09e`;
- WASM SHA-256: `7ffc5211dc63e86ceab81f42ee33292611ab757f868826388be4e6c8a3fba483`.

Structured claims retained by the artifact:

- `physicalQuestEvidence=false`;
- `analyticalAuthorityChanged=false`;
- `newSelectionAuthorityAdded=false`;
- canonical desktop task vocabulary is present;
- desktop selection uses the authoritative surface signal;
- desktop Record reaches the authoritative evidence owner;
- desktop Inspect reaches the existing inspector owner;
- selection is invalidated across dataset rebuild.

The browser journey uses a real rendered selection through the diagnostics-gated UV0 evidence seam, performs desktop `Record` and `Inspect`, and then replaces the dataset. It retains screenshots for selected-task parity and the inspector state.

## Exact-head gate state at reviewed implementation head

At `0d56b73a052cd2c34542ef804cb2a0ac10be522e`:

- Node 24 aggregate: PASS;
- static analysis/typecheck/lint/architecture enforcement: PASS;
- Rust kernel: PASS;
- all three Vitest coverage shards and coverage threshold merge: PASS;
- production build and ordinary Chromium/collaboration smoke: PASS;
- CodeQL javascript-typescript with zero-findings enforcement: PASS;
- architecture policy pilot: PASS;
- approval gate: PASS;
- dedicated C3 production-browser evidence: PASS.

Q8 remains platform-limited only: all cargo-deny advisories/bans/licenses/sources jobs pass, while GitHub Dependency Review is unavailable for the repository/plan. Q9 remains platform-limited only: the repository rulesets API returns HTTP 403 with GitHub's explicit Pro/public-repository requirement. Neither is classified as a C3 product defect.

## Final promotion condition

This review closes the bounded C3 implementation review, not the PR merge by assertion. The documentation/roadmap closure commits change the PR head after the evidence above. #615 may be promoted only if the **unchanged final closure head** again passes the required exact-head Node 24, CodeQL, architecture, approval and dedicated C3 evidence gates, with Q8/Q9 classified only according to their actual platform results.

## Final disposition

**ADOPT / C3 BOUNDED REVIEW CLOSED.**

C3 is fit to merge once its unchanged final closure head passes exact-head promotion. The next forward checkpoint is **C4 visible-product/canonical-journey evidence**, which owns the carried visual-hierarchy/salience question and simulator-testable whole-journey convergence. Physical Quest/controller/direct-touch qualification remains later Stream D / P1-U9 evidence.
# P1-UV C2 Investigation-State Legibility — Pre-Implementation Adversarial Review

**Date:** 2026-09-01  
**Base:** `main@5c593b57d74b01b90f639166f7d9b414651e9241`  
**Risk:** HIGH — user-visible epistemic state may be mistaken for analytical truth if presentation invents or reclassifies state.

## Scope

C2 must make the normal product surface answer, without log reading:

- what changed;
- what is selected or focused;
- whether analytical work is pending, ready, refused, invalid or unavailable;
- what explicit evidence supports or refutes the active epistemic state;
- whether a consequential representation change is preview or committed;
- whether undo, redo or archive recovery is available;
- where the current investigation state came from.

This tranche must reuse the existing persistent `StatusStripPanel`; it may not add another persistent analytical panel or dashboard wall.

## Authority map

| Product question | Authoritative source | Presentation rule |
| --- | --- | --- |
| Dataset/topology/item count | loaded dataset entry + embodied dataset | project only |
| Focus | `FocusContextController.currentLevel` + `focusedStructureId` | exact identity; no proximity-derived focus |
| Analytical readiness/refusal | governed semantic embodiment status on the live representation group; Atlas readiness/outcome only where no family status exists | never translate visual appearance into analytical state |
| Decision category | Moneta/Atlas `InvestigatorActionableOutcome` or active representation decision | preserve exact `DECISIVE`, `AMBIGUOUS`, `UNDERDETERMINED`, `INFEASIBLE` category |
| Preview vs commit | current fenced remediation preview | preview exists only while its dataset/version/requirements fences remain valid |
| Undo/redo | `AtlasCore.analysisHistory.canUndo/canRedo` | no synthetic recovery stack |
| Archive recovery | real `VaultPanel.archives` list / archive lifecycle | display availability, not guessed durability |
| Evidence support/refutation | explicit `InvestigationGraph` `supports` / `refutes` edges incident to the active node | no inference from distance, colour, rank or co-occurrence |
| State origin | active `InvestigationGraph` node `parentId` and explicit incoming `branches_from` edge | do not claim a named branch from dormant `InvestigationBranchManager` |
| Last change | existing application/world status action plus operation preview events | presentation-only summary |

## Existing defects / gaps

1. `StatusStripController` currently models only dataset, interaction mode, focus target, last action and next affordance.
2. `setFocusTarget()` has no production caller, so the supposedly persistent focus field is normally stale/empty.
3. The status strip does not expose governed semantic embodiment readiness/refusal even though that status exists on the representation group.
4. Preview/commit state is visible inside representation guidance but not persistent in the normal world context.
5. Undo/redo and archive recovery availability are not visible without opening a menu/panel.
6. Explicit support/refute relationships and current investigation origin exist in `InvestigationGraph` but are not projected into the grounding surface.
7. `InvestigationBranchManager` is not production-wired. C2 must not activate it merely to manufacture branch provenance.

## Falsifiers

C2 fails if any of the following is observed:

1. A second persistent status panel is introduced instead of extending the existing strip.
2. Focus text changes without `FocusContextController` changing.
3. `REFUSED`, `INVALID`, `UNAVAILABLE`, or `PENDING` is replaced by a generic success/failure heuristic.
4. A stale remediation preview remains labelled `PREVIEW` after its authority fences fail.
5. Undo/recovery is advertised when `AnalysisHistory` / real archive state says it is unavailable.
6. Evidence counts include inferred relationships or non-incident graph edges.
7. The UI claims an active named branch based on `InvestigationBranchManager` even though that manager remains outside the product composition root.
8. C2 adds analytical computation, scans source rows, or mutates Atlas/Moneta state.
9. The status treatment becomes a dominant telemetry wall that competes with the data.
10. Reduced-motion users lose semantic state cues because a transition is conveyed only through animation.

## Implementation shape

Create one thin presentation projector that reads the authorities above and updates `StatusStripController`. Extend the controller/panel to represent the added state compactly in two calm rows. Subscribe only to existing product events needed for immediate preview/change feedback; periodic sync may reconcile state but must not become an authority.

No new analytical intent, branch manager, archive format, replay algorithm, or scientific relationship type is permitted in this tranche.

## Evidence required before promotion

- focused unit falsifiers for exact status projection, preview cancellation, recovery availability and explicit graph relationships;
- production composition test proving the normal status strip receives live C2 state;
- production-browser evidence showing at least: ready/committed baseline, focus change, operation/remediation preview, recorded evidence, undo/recovery availability;
- no increase in normal persistent surface count;
- post-implementation adversarial review;
- unchanged-head CI, CodeQL and approval gate before merge.

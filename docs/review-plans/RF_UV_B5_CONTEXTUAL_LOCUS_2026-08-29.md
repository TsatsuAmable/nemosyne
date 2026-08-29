# P1-UV2 B5 — contextual locus-of-work convergence

**Date:** 2026-08-29  
**Stream:** B — Product UX & Quest Validation Operations  
**Checkpoint:** B5 — P1-UV2 contextual locus-of-work  
**Base:** `main@34c189f569c83b48e2001de3501476cc90c0b47d`  
**Status:** IMPLEMENTATION LANDED / REVIEW ACTIVE

## Purpose

Make the existing P1-U4 contextual-action substrate truthfully originate at the selected data object and participate in the normal SpatialPanel surface budget, rather than behaving as a detached mini-dashboard that merely happens to be summoned by selection.

## Pre-implementation adversarial contract

### Invariant

Selecting a data object exposes a short-lived investigator-action surface at that object’s real world-space locus. The surface follows the selected object while it remains active, does not obscure the object, does not accumulate alongside an inspector/context surface in the same budget slot, and retains the canonical novice verbs `Inspect`, `Compare`, `Challenge`, `Record`, `Navigate`, `More` with in-place unavailable reasons.

### Authority / production path

`selection -> World._showDataCard -> WorldUIManager.contextualTaskSurface.showAtNode -> existing World/UI callbacks -> existing analytical/session owners`.

B5 may change presentation, spatial anchoring and surface-budget composition. It must not add analytical computation, reinterpret evidence, or create a second command/intent system.

### Primary failure modes

1. **False attachment:** node world coordinates are copied into analyst-anchor local space, so the surface drifts away from its selected object as the anchor moves.
2. **Panel constellation:** the contextual surface does not participate in `PanelBudgetController`, allowing selection context and inspector surfaces to accumulate as separate ungoverned instruments.
3. **Evidence occlusion:** a 400x300 six-button panel covers the selected data object rather than behaving as a compact ornament/action rail.
4. **Semantic drift:** B5 rewrites challenge/compare science or creates UI-side analytical logic while changing presentation.
5. **Unavailable-state opacity:** disabled actions are silently greyed rather than explaining why they cannot run.
6. **Detached-after-motion:** the surface is positioned once and ceases to follow the selected object through legitimate scene/representation movement.
7. **Legacy escape hatch:** common selected-object actions remain dependent on the global VR menu/diagnostic wall.

### Falsifying evidence

- focused tests prove selected-object world-space proximity even when the contextual surface is parented under a translated analyst anchor;
- focused tests prove the contextual surface opens/closes in the `inspector` budget slot;
- focused tests prove disabled reasons remain explicit;
- instrumented real-browser evidence selects a real rendered node through the production `_showDataCard` path and records contextual-surface visibility/proximity;
- existing B3/B4 production journeys remain green.

### Non-goals

- no B6/P1-UV3 TechnoCore/Vault/portal/Memory-Palace redesign;
- no `World.ts` refactor unless no narrower seam can express a required behavior;
- no new scientific operation or TypeScript analytical fallback;
- no broad visual-token restyle (P1-UV4);
- no physical Quest qualification claim.

## Implementation

### Object-attached action rail

`ContextualTaskSurface` remains the landed P1-U4 surface and canonical callback owner, but its visible treatment is reduced from a 400x300 `CONTEXT ACTIONS` panel to a compact, non-grabbable selection ornament. The six novice verbs are retained:

`Inspect | Compare | Challenge | Record | Navigate | More`

The rail displays selected-object identity and an explicit dismiss action. Disabled verbs retain explanatory text such as `Needs linked structure` or `No linked path`; unavailable state is not encoded through colour alone.

### Truthful spatial locus

The original `showAtNode()` path read the selected node’s world position and copied it into the rail’s local `position`, even though the rail is parented beneath the moving `analystAnchor`. That made apparent object attachment dependent on the anchor transform.

B5 now:

1. reads the selected object in world space;
2. derives a bounded offset above and slightly toward the viewer so controls do not cover the evidence;
3. converts that world-space target through `parent.worldToLocal(...)` before assigning the rail position;
4. recomputes the transform while the rail remains visible so legitimate object motion does not leave the action surface behind.

### Surface-budget replacement

The contextual rail now resolves the existing `PanelBudgetController` lazily from the engine at interaction time. This avoids constructor-order changes in `WorldUIManager` and avoids a `World.ts` hot-file change.

Before occupying the `inspector` role, the rail checks for an existing occupant. If the occupant exposes a stateful `hide()` path, that path is invoked so the inspector’s own `active`, grab-rail and budget state are cleaned up; otherwise the generic budget close path is used. The rail then occupies the same `inspector` slot. Its own `hide()` untracks the slot.

`World` remains the selection composition owner and the existing Inspect callback already hides the contextual rail before opening `HolographicInspector`, so dense work replaces the short-lived rail instead of creating a panel constellation.

### Evidence plumbing

The compile-gated UV0 evidence handle now reports:

- contextual rail visibility;
- world-space distance from the rail to the selected rendered node;
- active non-pinned SpatialPanel budget count.

The existing B3 canonical browser journey still selects a real palace node through `_showDataCard`. B5 strengthens that same state assertion: the rail must be visible, within the bounded selected-object locus and alone in the active budget; after Inspect, the rail must be hidden and the inspector must remain the sole active budgeted surface.

## Post-implementation adversarial review

### Production path attacked

Re-read selection through `_showDataCard`, `ContextualTaskSurface`, `PanelBudgetController`, `HolographicInspector`, `WorldUIManager`, and the compile-gated UV0 browser evidence seam.

### Findings and fix-forward

1. **World/local coordinate mismatch — FIXED.** The original surface copied selected-node world coordinates into analyst-anchor-local coordinates. The new transform explicitly converts through the current parent and is recomputed while active.
2. **Stateful inspector replacement — FIXED.** Generic `PanelBudgetController.close()` only toggles visibility/untracks; using that path alone on `HolographicInspector` could leave its internal `active` state and grab affordance stale. The contextual rail therefore invokes an existing occupant’s real `hide()` when available before claiming the inspector slot.
3. **Constructor-order pressure — AVOIDED.** `WorldUIManager` constructs the contextual surface before `PanelBudgetController`. Rather than reordering the manager or touching `World`, the rail lazily resolves the existing budget through `engine.uiManager` after composition is complete. Tests can still inject `budgetController` directly.
4. **Second action/analytical authority — NOT FOUND.** Existing callbacks remain the only semantic behavior. B5 changes spatial presentation and replacement policy only.
5. **Evidence laundering — AVOIDED.** Unit geometry assertions are supplemented by the existing instrumented real-browser `_showDataCard` path; physical headset claims remain explicitly deferred.

### Residual review targets

- exact-head typecheck must confirm UIKit property/type compatibility of the compact rail;
- exact-head browser evidence must confirm the rendered representation and analyst-anchor transforms produce the expected bounded proximity in the real scene;
- B5 does not yet make the Inspector footer’s decorative Compare/Challenge/Annotate buttons functional. They are part of the later precision-surface convergence unless exact-head review shows they are currently misleading enough to block UV2.

## Disposition

**IMPLEMENTATION LANDED / REVIEW ACTIVE.** No known source-path blocker remains. Exact-head CI, browser evidence, CodeQL, approval and promotion evidence are required before B5 may be promoted.

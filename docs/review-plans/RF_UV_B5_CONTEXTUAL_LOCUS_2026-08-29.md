# P1-UV2 B5 — contextual locus-of-work convergence

**Date:** 2026-08-29  
**Stream:** B — Product UX & Quest Validation Operations  
**Checkpoint:** B5 — P1-UV2 contextual locus-of-work  
**Base:** `main@34c189f569c83b48e2001de3501476cc90c0b47d`  
**Status:** IMPLEMENTATION IN PROGRESS

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

## Implementation notes

The narrow intended seam is `ContextualTaskSurface` plus its construction in `WorldUIManager` and UV evidence plumbing. The existing `World._showDataCard` selection owner should remain unchanged if possible.

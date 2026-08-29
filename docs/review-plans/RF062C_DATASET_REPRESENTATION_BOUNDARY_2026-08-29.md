# RF-062C — Dataset / representation workflow boundary

**Status:** IMPLEMENTATION LANDED / REVIEW ACTIVE

**Date:** 2026-08-29

## Goal

Remove the mixed-authority dataset/representation workflow from `World._doLoadDataset()` without creating a replacement coordinator god object.

The tranche has exactly two new owners:

1. `LoadDatasetUseCase` owns the logical authoritative transition from a load request through Atlas baseline/current state and Moneta arbitration/NIL diagnosis.
2. `RepresentationSurface` owns the Three.js representation resources that are constructed, replaced, interacted with, selected, diagnosed and disposed together.

`World` remains the composition root and compatibility facade.

## Invariants

### Analytical authority

- Atlas/Rust/WASM remain the dataset/statistical/analytical authority.
- `LoadDatasetUseCase` sequences Atlas calls; it does not compute statistics or maintain a second dataset implementation.
- Moneta remains the representation-decision authority.
- static default encodings remain a presentation mapping fallback only, exactly as before.

### Presentation ownership

- `RepresentationSurface` owns the current `MonetaTopologyNode`, diagnostic HUD, representation interactables, structure-handle lifecycle and selected representation mesh.
- replacement is construction-first: if new representation construction throws, the prior surface remains live.
- replacement removes old updatables/interactables/diagnostics/handles before publishing the new live surface.
- selection continuity is restored by semantic mesh name when the replacement still exposes the same identity.
- disposal is idempotent.

### Dependency direction

- neither new owner imports or receives `World`.
- `LoadDatasetUseCase` receives an Atlas-shaped authority only.
- `RepresentationSurface` receives narrow scene/input/interaction/tooltip callbacks, not Engine/World service bags.
- downstream dashboard/TDA/theme/status/autosave projections remain outside these two owners for RF-062D or existing owners.

## Production wiring now landed

The real `World.loadDataset()` / `_doLoadDataset()` path now:

1. delegates the fresh-load or preserve-state analytical transition to `LoadDatasetUseCase`;
2. receives the authoritative embodied dataset plus Moneta decision/NIL outcome;
3. delegates representation construction, interaction registration, replacement and diagnostic ownership to `RepresentationSurface`;
4. retains only compatibility facade mirrors (`dracoNode`, `diagnostic`, `_lastSelectedMesh`) for existing downstream callers;
5. leaves theme/status/dashboard/TDA/lens reactions outside both new owners, ready for RF-062D rather than folding them into a new coordinator.

World teardown delegates representation cleanup to `RepresentationSurface.dispose()` rather than manually unregistering/disposal-walking the current node.

## Pre-implementation adversarial contract

**High-risk change.** Dataset load resets authoritative evidence/history/version state and representation replacement mutates the live XR scene graph.

Primary failure modes:

1. fresh load accidentally skips or duplicates the authoritative Atlas baseline/current transition;
2. re-arbitration clears analytical state that must be preserved;
3. presentation code gains statistical/analytical authority;
4. replacement disposes the old surface before construction of the new surface has succeeded;
5. old node meshes remain interactable after replacement;
6. structure handles or diagnostics accumulate across reloads;
7. selection continuity is silently lost even when semantic identity survives;
8. teardown disposes resources twice or leaves an updatable/diagnostic alive;
9. World retains direct construction/swap/disposal, leaving the new owner decorative;
10. the split creates a broad replacement coordinator.

## Falsifying evidence

Focused tests prove:

- fresh load clones baseline and working dataset separately and calls Atlas ownership in the existing order;
- preserve-state re-arbitration does not call fresh-load setters and reuses caller requirements;
- failed replacement construction leaves the current surface intact;
- successful replacement unregisters previous resources and rebuilds one current surface;
- selection is restored by matching semantic mesh name;
- dispose is idempotent;
- a real `World.loadDataset()` traverses both new owners exactly once and the compatibility mirrors point at the surface-owned resources;
- World teardown calls the surface owner and clears the compatibility mirrors.

Ordinary full-system World coverage also cycles multiple sample datasets and disposes each World instance, so repeated production load/replacement/teardown remains exercised beyond the focused seam tests.

## Post-implementation adversarial review

The landed call path was re-read after the World extraction rather than treating class existence as completion evidence.

### Findings

- **No duplicate analytical authority:** the use case calls Atlas and Moneta only; it does not compute statistics or retain an independent analytical dataset.
- **No replacement god class:** the use case is presentation-neutral and the surface is analytical-neutral. Cross-cutting status/theme/dashboard/TDA work deliberately remains outside them.
- **Construction failure is atomic:** the new node is constructed before the current surface is released.
- **Compatibility aliases remain:** `World.dracoNode`, `World.diagnostic` and `_lastSelectedMesh` still mirror surface-owned state for existing callers/tests. They are compatibility facade state, not resource owners, and their retirement belongs to RF-062I. They must not regain direct construction/disposal behavior.
- **Selection has one production mutation path:** `RepresentationSurface` records the selected mesh before invoking the World data-card callback; replacement independently restores selection by semantic mesh name. Direct private `_showDataCard()` test calls do not establish a second production resource owner.
- **Existing broad World hosts remain out of scope:** live/collaboration/landmark backreferences are RF-062F and were not pulled into this tranche.

No blocker was found in the final ownership split. Final exact-head CI/browser/CodeQL/Q8/Q9 evidence remains required before merge and before any stronger completion classification.

## Bounded scope

In scope:

- logical load/arbitration extraction;
- representation node/diagnostic/interactable/selection/disposal ownership;
- compatibility facade access from World for downstream callers;
- production-path tests and lifecycle evidence.

Deferred:

- broad operation-event projection decomposition (RF-062D);
- session restore convergence (RF-062E);
- live/collaboration/landmark ports (RF-062F);
- analytical runtime ownership (RF-062G);
- mass renames of historical `dracoNode` compatibility names;
- UI redesign or representation-scale policy changes, including the separately measured 8k threshold cliff.

## Exit gate

RF-062C may be promoted only when the production dataset-load path traverses `LoadDatasetUseCase` and `RepresentationSurface`, World no longer constructs/swaps/disposes the representation itself, exact-head CI/browser/architecture evidence is green, and post-implementation review finds no duplicate authority or replacement god class.

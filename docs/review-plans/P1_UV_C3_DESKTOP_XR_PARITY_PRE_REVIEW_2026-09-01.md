# P1-UV C3 Desktop/XR Parity — Pre-Implementation Adversarial Review

**Date:** 2026-09-01  
**Base:** `main@03254c0eb9685c8adbabf23b1cae17082a59718e` (#614 C2 merged)  
**Risk:** HIGH  
**Scope:** desktop/XR semantic task parity, discoverability and cancellation behavior. No analytical changes.

## Governing requirement

C3 must prevent desktop and immersive Nemosyne from becoming two products. Platform mechanics may differ, but the core investigator task vocabulary and semantic outcomes must converge on the same application-side owners.

The governing P1-UV6 requirements are:

- desktop shell is a deliberate counterpart to the spatial journey, not raw engineering controls;
- same task vocabulary and semantic intents across desktop and immersive modes;
- platform-appropriate mechanics remain allowed;
- essential operations have discoverable desktop and XR paths;
- keyboard/focus, pointer, controller/ray/direct-touch and cancellation are tested against equivalent semantic outcomes.

## Current production-path audit

### Already converged

- `ApplicationIntentDispatcher` is already shared by desktop shell dispatch and XR input callbacks for dataset cycle, analytical operation, reset, undo/redo and statistical-lens toggle.
- diagnostics are already demoted from normal analyst mode.
- `ContextualTaskSurface` provides the canonical selected-object vocabulary `Inspect | Compare | Challenge | Record | Navigate | More` in immersive presentation.
- C2 provides shared legible investigation state independent of modality.

### Material gap

The selected-object task vocabulary is not yet a shared semantic boundary. `ContextualTaskSurface` owns six separate callbacks, `WorldUIManager` maps those callbacks to product behavior, and the desktop `InvestigationShell` exposes a different global action vocabulary. That creates two risks:

1. the same investigator verb can drift in behavior between desktop and XR;
2. a desktop user cannot discover the same selected-object task set that is visible in XR.

### Boundary decision

C3 will add one small application-side **investigator task intent contract** for the six selected-object verbs. It will not add analytical operations to that contract and will not merge it with `ApplicationIntent`, whose existing purpose is world/application command dispatch.

`WorldUIManager` remains the presentation owner that resolves a selected-object task into the existing inspector, compare, challenge, record, navigate and constraints owners. Both the spatial `ContextualTaskSurface` and desktop `InvestigationShell` will dispatch through that same resolver.

## Planned bounded implementation

1. Add a typed `InvestigatorTaskIntent` vocabulary with stable IDs/labels for `inspect | compare | challenge | record | navigate | more`.
2. Give `WorldUIManager` one `dispatchInvestigatorTask(intent, data)` method and make the spatial contextual surface call it.
3. Expose the currently selected contextual data through a read-only getter; no new selection authority is created.
4. Add a compact `Selected object` section to the desktop `InvestigationShell` using the same six labels/IDs. Actions dispatch through the same `WorldUIManager` resolver and fail visibly when no selection exists.
5. Preserve existing global desktop actions for dataset/load/history/export/settings where there is no selected-object equivalent.
6. Add keyboard discoverability only where it does not collide with text entry or browser/system conventions. Escape continues to cancel transient desktop presentation.
7. Add focused parity falsifiers proving desktop and spatial task invocation reach the same resolver and no separate analytical path is introduced.
8. Add production-browser evidence for a selected object on the desktop shell. Simulator/IWER evidence is required only for mechanics that can be meaningfully exercised without physical hardware.

## Falsifiers

C3 must fail review if any of these are true:

1. Desktop task buttons call analytical/world methods directly while XR calls another path.
2. `ContextualTaskSurface` retains a separately authored behavior mapping for the six canonical verbs.
3. Desktop introduces subsystem/module names as primary novice task labels.
4. An essential selected-object task is visible only in XR or only in desktop after C3.
5. A task can operate on stale/implicit selection after the contextual selection has been cleared.
6. `Record` manufactures epistemic facts rather than calling the existing recording owner.
7. `Challenge` acquires a new TypeScript analytical implementation rather than using the existing governed callback.
8. Keyboard shortcuts fire while the user is typing into input/textarea/contenteditable controls.
9. Escape/cancel semantics differ materially between desktop transient presentation and the existing XR transient surface without an explicit platform reason.
10. C3 claims physical controller/direct-touch fitness from desktop/browser evidence.

## Evidence plan

Required before promotion:

- focused unit tests for the canonical task vocabulary and resolver;
- parity tests that spatial and desktop invocation call the same resolver with the same selected payload;
- production-browser test showing the six selected-object task labels are discoverable on desktop and exercise the governed resolver;
- ordinary CI/Node 24, CodeQL and architecture policy;
- bounded post-implementation adversarial review;
- exact-head promotion with no physical Quest claim.

## Non-goals

- no new analytical methods;
- no new selection/focus authority;
- no redesign of input FSM, pointer capture or direct-touch recognition;
- no new persistent world panel;
- no attempt to complete physical Quest validation;
- no broad visual-system redesign beyond the desktop parity surface needed for C3.

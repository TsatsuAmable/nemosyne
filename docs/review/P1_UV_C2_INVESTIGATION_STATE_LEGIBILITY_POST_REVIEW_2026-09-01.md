# P1-UV C2 Investigation-State Legibility — Post-Implementation Adversarial Review

**Date:** 2026-09-01  
**Base:** `main@5c593b57d74b01b90f639166f7d9b414651e9241` (#613 merged)  
**Owning PR:** #614  
**Risk:** HIGH  
**Disposition:** IMPLEMENTATION LANDED / BOUNDED REVIEW CLOSED; final promotion remains contingent on unchanged-head required checks and dedicated C2 production-browser evidence.

## Reviewed contract

C2 must make the normal investigator surface answer what changed, what is focused, whether analysis is ready/refused/pending, what explicit evidence is attached to the current state, whether a representation change is preview or committed, whether recovery is available, and where the current state came from. It must do so without adding analytical authority, inventing epistemic relationships, creating a second history stack, or activating the dormant branch manager.

## Authority review

### Analytical and representation truth

PASS. `InvestigationStatePresenter` is a read-only projector. Analytical readiness/refusal is read from the governed semantic embodiment state with Atlas readiness only as the documented fallback. Representation decision categories remain the exact Moneta/Atlas categories. Preview state comes from the fenced preview decision or the existing operation-preview event lifecycle. C2 adds no row scan, statistical calculation, representation ranking, or scientific classification.

### Focus

PASS. Focus is projected from the production `FocusContextController` state. The C2 evidence port preserves the exact production `FocusLevel` type rather than widening it to arbitrary strings.

### Evidence relationships

PASS. Support/refute counts are derived only from explicit `InvestigationGraph` edges incident to the resolved current origin node. C2 does not infer support, contradiction, confidence, or branch state from geometry, colour, proximity, rank, or co-occurrence.

### Recovery

PASS. Undo/redo availability is read from Atlas `AnalysisHistory`; archive availability is read from the real Vault archive list. C2 owns no synthetic recovery stack.

### Investigation origin and undo

FIXED FORWARD. The first production-browser evidence run revealed a material defect: after an analytical operation followed by undo, the graph insertion cursor still pointed at the post-operation node, so the visible origin could remain stale.

The first fix reconciled graph origin against the current authoritative analytical dataset fingerprint and failed closed on ambiguous matches. A strengthened browser assertion then exposed a historical compatibility detail: initial dataset graph nodes were created without an explicit `kind`, and `InvestigationGraph.addNode()` normalized omitted kinds to `operation`. The restored v1 fingerprint was therefore correct, but a strict `dataset_version` filter rejected the historical root.

The final bounded rule is:

- use the active graph node while its fingerprint matches the current analytical dataset;
- otherwise accept exactly one fingerprint-matching dataset-state node;
- an explicit `dataset_version` node is a dataset-state node;
- for backward compatibility only, a parentless canonical `:vN` node is also eligible because historical load roots have that exact durable identity shape;
- arbitrary parentless operations are not eligible;
- multiple eligible matches fail closed to no origin rather than guessing a branch.

Focused falsifiers cover the historical root case, ambiguity, and rejection of arbitrary root operations. The production-browser journey now requires undo to restore the visible origin identity to the pre-operation state.

### Spatial treatment

PASS FOR SIMULATOR/PRODUCTION-BROWSER SCOPE. The Status Strip remains the existing persistent surface rather than a new dashboard. Its default/reset placement is governed by `PANEL_LAYOUT.statusStrip`, it is constructed directly under `analystAnchor`, and bootstrap no longer reparents it after construction. The participant-facing treatment identity is bumped to `panel-layout/4+intent-wheel/1+frames/torso-locked`, and the study declaration plus spatial decision record are updated in the owning PR.

The dedicated evidence asserts the runtime parent, exact local coordinates and treatment version. This is simulator/browser evidence, not physical Quest comfort or reachability qualification.

### Surface budget and salience

PASS FOR C2 BOUNDARY. C2 extends the existing Status Strip and does not add another persistent panel. Four compact rows expose context, analysis/evidence, recovery/origin, and change/next action. C2 does not claim final visual hierarchy for the entire product; C3/C4 and later physical qualification retain that responsibility.

### Accessibility and semantic redundancy

PASS FOR C2 BOUNDARY. Critical state is textual/categorical and does not depend on animation or colour alone. C2 did not introduce a motion-only state transition.

## Falsifier disposition

1. Second persistent status panel: NOT OBSERVED.
2. Focus diverges from governed focus state: NOT OBSERVED.
3. Analytical refusal/pending categories collapsed into heuristics: NOT OBSERVED.
4. Stale preview remains labelled PREVIEW: NOT OBSERVED in covered lifecycle.
5. Synthetic undo/archive availability: NOT OBSERVED.
6. Inferred/non-incident epistemic relationship counts: NOT OBSERVED.
7. Dormant branch manager used to manufacture provenance: NOT OBSERVED.
8. Presentation performs analytical work or mutates Atlas/Moneta truth: NOT OBSERVED.
9. Status surface becomes an additional telemetry wall: NOT OBSERVED; existing strip reused.
10. Meaning conveyed only through animation: NOT OBSERVED.

## Evidence boundary

Covered by focused Vitest falsifiers and the dedicated exact-head production-browser workflow:

- ready/committed baseline;
- governed Status Strip parent/placement/treatment identity;
- structure focus transition;
- preview and preview cancellation;
- recorded observation count;
- committed analytical operation;
- undo/redo availability;
- undo restoring pre-operation visible origin identity;
- real Vault freeze/archive availability;
- retained screenshots and source/build/WASM identities.

The browser evidence does **not** constitute physical Quest evidence and does not close C3 desktop/XR parity or C4 canonical-journey convergence.

## Remaining promotion conditions

No unresolved C2 design/code blocker remains in this review. Before merge, the unchanged final PR head must pass ordinary CI/Node 24, CodeQL, architecture policy, the dedicated C2 exact-head browser evidence and the repository approval gate. Q8/Q9 platform-limited pilot failures remain classified according to the existing repository governance policy rather than being misrepresented as C2 product defects.

## Exit recommendation

If the unchanged final head passes the required gates above, classify **C2 VERIFIED COMPLETE for its bounded desktop/production-browser investigation-state legibility scope**, merge #614, fetch fresh `main`, and begin C3 desktop/XR parity. Do not claim physical Quest fitness from C2.